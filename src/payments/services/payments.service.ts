import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import { FeeValidationService } from './fee-validation.service';
import { PaynetProvider } from '../providers/paynet.provider';
import { WebhooksService } from '../../webhooks/webhooks.service';
import { ProcessPaymentDto } from '../dto/process-payment.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { Complete3DPaymentDto } from '../dto/complete-3d-payment.dto';

interface DeviceInfo {
  id: string;
  userId: string;
  model: string;
  status: string;
  device_role?: string; // 'owner' or 'finder' - from schema
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly feeValidationService: FeeValidationService,
    private readonly paynetProvider: PaynetProvider,
    private readonly webhooksService: WebhooksService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Process payment request
   * Backend creates payment record in database with 'pending' status
   * Frontend/iOS receives payment URL and initiates 3D Secure
   * 
   * 1. Validate device exists and belongs to user
   * 2. Validate device status is 'payment_pending'
   * 3. Validate amount (security check - never trust frontend)
   * 4. Find matched finder user_id
   * 5. Generate payment ID (UUID)
   * 6. Create payment record in database with 'pending' status
   * 7. Initiate PAYNET 3D Secure payment
   * 8. Return payment info
   */
  async processPayment(
    dto: ProcessPaymentDto,
    payerUserId: string,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Processing payment for device ${dto.deviceId} by user ${payerUserId}`);

    // 1. Get device info for validation
    const device = await this.getDevice(dto.deviceId);

    // 2. Validate device ownership
    if (device.userId !== payerUserId) {
      this.logger.warn(
        `User ${payerUserId} attempted to process payment for device ${dto.deviceId} that belongs to ${device.userId}`,
      );
      throw new BadRequestException(
        `User ${payerUserId} is not the owner of device ${dto.deviceId}`,
      );
    }

    // 3. Validate device status
    if (
      device.status !== 'payment_pending' &&
      device.status !== 'PAYMENT_PENDING'
    ) {
      throw new BadRequestException(
        `Device ${dto.deviceId} is not in 'payment_pending' status. Current status: ${device.status}`,
      );
    }

    // 4. Validate amount (security check - never trust frontend)
    // Frontend might have sent wrong amount, so we validate against database
    const calculatedFees = await this.feeValidationService.validateAmount(
      dto.deviceId,
      dto.totalAmount,
    );

    // 5. Find matched finder user_id
    const finderUserId = await this.getMatchedFinderUserId(dto.deviceId);
    if (!finderUserId) {
      throw new BadRequestException(
        `No matched finder found for device ${dto.deviceId}`,
      );
    }

    // 6. Generate payment ID (UUID) - this will be used as reference_no in Paynet
    const paymentId = randomUUID();

    // 7. Create payment record in database with 'pending' status
    const { error: paymentError } = await this.supabase.from('payments').insert({
      id: paymentId,
      device_id: dto.deviceId,
      payer_id: payerUserId,
      receiver_id: finderUserId,
      total_amount: dto.totalAmount,
      reward_amount: dto.feeBreakdown.rewardAmount,
      cargo_fee: dto.feeBreakdown.cargoFee,
      payment_gateway_fee: dto.feeBreakdown.gatewayFee,
      service_fee: dto.feeBreakdown.serviceFee,
      net_payout: dto.feeBreakdown.netPayout,
      payment_provider: 'paynet',
      payment_status: 'pending',
      escrow_status: 'pending',
      currency: 'TRY',
    });

    if (paymentError) {
      this.logger.error(`Failed to create payment record: ${paymentError.message}`, paymentError);
      throw new BadRequestException('Failed to create payment record');
    }

    this.logger.log(`Payment record created: ${paymentId} with status 'pending'`);

    // 8. Initiate 3D Secure payment with PAYNET
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    const paynetResponse = await this.paynetProvider.initiate3DPayment({
      amount: dto.totalAmount,
      reference_no: paymentId, // Use generated payment ID as reference_no
      return_url: `${frontendUrl}/payment/callback`,
      domain: new URL(backendUrl).hostname,
      is_escrow: true,
      description: `Payment for device ${device.model}`,
    });

    // 9. Return payment info
    return {
      id: paymentId,
      deviceId: dto.deviceId,
      paymentStatus: 'pending',
      escrowStatus: 'pending',
      totalAmount: dto.totalAmount,
      providerTransactionId: paynetResponse.transaction_id,
      publishableKey: this.paynetProvider.getPublishableKey(),
      paymentUrl: paynetResponse.post_url || paynetResponse.html_content,
      feeBreakdown: dto.feeBreakdown,
    };
  }

  private async getDevice(deviceId: string): Promise<DeviceInfo> {
    // Note: devices table uses camelCase columns: userId, serialNumber, etc.
    const { data, error } = await this.supabase
      .from('devices')
      .select('id, userId, model, status, device_role')
      .eq('id', deviceId)
      .single();

    if (error || !data) {
      this.logger.error(`Device not found: ${deviceId}`, error);
      throw new NotFoundException(`Device not found: ${deviceId}`);
    }

    return data as DeviceInfo;
  }

  /**
   * Get matched finder user_id for a device (owner's device)
   * Finds the matched finder device with same serialNumber and model
   */
  private async getMatchedFinderUserId(deviceId: string): Promise<string | null> {
    // Get current device info
    const { data: currentDevice, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, userId, model, serialNumber, status, device_role')
      .eq('id', deviceId)
      .single();

    if (deviceError || !currentDevice) {
      this.logger.error(`Device not found: ${deviceId}`, deviceError);
      return null;
    }

    // Find matched device with same serialNumber and model
    const currentUserRole = (currentDevice as any).device_role || 'owner';
    const expectedMatchedRole = currentUserRole === 'owner' ? 'finder' : 'owner';

    const { data: matchedDevice, error: matchedError } = await this.supabase
      .from('devices')
      .select('id, userId, device_role')
      .eq('serialNumber', currentDevice.serialNumber)
      .eq('model', currentDevice.model)
      .neq('userId', currentDevice.userId)
      .eq('device_role', expectedMatchedRole)
      .maybeSingle();

    if (!matchedError && matchedDevice?.userId) {
      this.logger.log(
        `Found matched device: ${matchedDevice.id} with finder user: ${matchedDevice.userId}`,
      );
      return matchedDevice.userId;
    }

    // Check audit_logs as fallback
    const { data: auditLog, error: auditError } = await this.supabase
      .from('audit_logs')
      .select('event_data')
      .eq('resource_type', 'device')
      .eq('resource_id', deviceId)
      .eq('event_type', 'device_matching')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!auditError && auditLog?.event_data) {
      const eventData = auditLog.event_data as any;
      if (eventData.finder_user_id) {
        this.logger.log(`Found finder_user_id from audit_logs: ${eventData.finder_user_id}`);
        return eventData.finder_user_id;
      }
      if (eventData.finderDeviceId) {
        const { data: finderDevice, error: finderDeviceError } = await this.supabase
          .from('devices')
          .select('userId')
          .eq('id', eventData.finderDeviceId)
          .single();

        if (!finderDeviceError && finderDevice?.userId) {
          return finderDevice.userId;
        }
      }
    }

    this.logger.warn(
      `No finder found for device ${deviceId}. Device is in matched status but no finder found.`,
    );
    return null;
  }

  /**
   * Create payment and escrow records
   * NOTE: This method is no longer used in Senaryo B
   * Frontend creates these records before calling backend
   * Kept for reference or future use
   */
  /*
  private async createPaymentRecords(
    device: DeviceInfo,
    fees: any,
    payerUserId: string,
    receiverUserId: string,
  ): Promise<string> {
    const paymentId = crypto.randomUUID();

    const { error: paymentError } = await this.supabase.from('payments').insert({
      id: paymentId,
      device_id: device.id,
      payer_id: payerUserId,
      receiver_id: receiverUserId,
      total_amount: fees.totalAmount,
      reward_amount: fees.rewardAmount,
      cargo_fee: fees.cargoFee,
      payment_gateway_fee: fees.gatewayFee,
      service_fee: fees.serviceFee,
      net_payout: fees.netPayout,
      payment_provider: 'paynet',
      payment_status: 'pending',
      escrow_status: 'pending',
      currency: 'TRY',
    });

    if (paymentError) {
      this.logger.error(`Failed to create payment record: ${paymentError.message}`, paymentError);
      throw new BadRequestException('Failed to create payment record');
    }

    const { error: escrowError } = await this.supabase
      .from('escrow_accounts')
      .insert({
        payment_id: paymentId,
        device_id: device.id,
        holder_user_id: payerUserId,
        beneficiary_user_id: receiverUserId,
        total_amount: fees.totalAmount,
        reward_amount: fees.rewardAmount,
        service_fee: fees.serviceFee,
        gateway_fee: fees.gatewayFee,
        cargo_fee: fees.cargoFee,
        net_payout: fees.netPayout,
        status: 'pending',
        currency: 'TRY',
        release_conditions: [],
        confirmations: [],
      });

    if (escrowError) {
      this.logger.error(`Failed to create escrow record: ${escrowError.message}`, escrowError);
      throw new BadRequestException('Failed to create escrow record');
    }

    this.logger.log(`Payment initiated for device ${device.id} with status: ${device.status}`);

    return paymentId;
  }
  */

  /**
   * Complete 3D Secure payment after user verification
   * Called after user completes 3D Secure verification on bank's page
   * 
   * Backend does NOT write to database, only communicates with Paynet API
   * Frontend/iOS will create payment records when webhook arrives
   * 
   * Security: This endpoint validates that:
   * 1. Session ID and Token ID are provided
   * 2. Payment ID is valid UUID format
   * 3. Paynet API accepts the completion request
   */
  async complete3DPayment(
    dto: Complete3DPaymentDto,
    userId: string,
  ): Promise<{ success: boolean; paymentId: string; message: string }> {
    this.logger.log(
      `Completing 3D payment: paymentId=${dto.paymentId}, userId=${userId}`,
    );

    // Complete 3D payment with PAYNET
    // Backend does NOT validate payment ownership or status from database
    // Payment records don't exist yet - they will be created by frontend/iOS when webhook arrives
    try {
      const paynetResponse = await this.paynetProvider.complete3DPayment({
        session_id: dto.sessionId,
        token_id: dto.tokenId,
        transaction_type: 1, // 1 = Satış (Sale)
      });

      this.logger.log(
        `3D payment completion initiated: paymentId=${dto.paymentId}, transactionId=${paynetResponse.transaction_id}`,
      );

      return {
        success: true,
        paymentId: dto.paymentId,
        message: '3D Secure payment completed. Waiting for webhook confirmation.',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to complete 3D payment: ${error.message}`,
        error.stack,
      );

      // Backend does NOT update database - frontend/iOS will handle error state
      throw new BadRequestException(
        `Payment completion failed: ${error.message}`,
      );
    }
  }

  /**
   * Get payment status from database
   * Reads payment record from database and returns status information
   */
  async getPaymentStatus(
    paymentId: string,
    userId: string,
  ): Promise<{
    id: string;
    deviceId: string;
    paymentStatus: string;
    escrowStatus: string;
    webhookReceived: boolean;
    totalAmount: number;
    providerTransactionId?: string;
  }> {
    this.logger.log(`Getting payment status: paymentId=${paymentId}, userId=${userId}`);

    // Read payment record from database
    const { data: payment, error: paymentError } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      this.logger.error(`Payment not found: ${paymentId}`, paymentError);
      throw new NotFoundException(`Payment not found: ${paymentId}`);
    }

    // Validate payment ownership (user must be payer or receiver)
    if (payment.payer_id !== userId && payment.receiver_id !== userId) {
      this.logger.warn(
        `User ${userId} attempted to access payment ${paymentId} that doesn't belong to them`,
      );
      throw new BadRequestException('Payment does not belong to this user');
    }

    // Check if webhook has been received
    const webhookReceived = this.webhooksService.hasWebhook(paymentId);

    return {
      id: payment.id,
      deviceId: payment.device_id,
      paymentStatus: payment.payment_status || 'pending',
      escrowStatus: payment.escrow_status || 'pending',
      webhookReceived,
      totalAmount: Number(payment.total_amount) || 0,
      providerTransactionId: payment.provider_transaction_id || payment.provider_payment_id,
    };
  }

  /**
   * Get webhook data for a payment
   * Frontend/iOS calls this after detecting webhookReceived: true
   */
  async getWebhookData(
    paymentId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    webhookData?: any;
    error?: string;
  }> {
    this.logger.log(`Getting webhook data: paymentId=${paymentId}, userId=${userId}`);

    const webhookData = this.webhooksService.getWebhookData(paymentId);

    if (!webhookData) {
      return {
        success: false,
        error: 'Webhook data not found for this payment',
      };
    }

    return {
      success: true,
      webhookData: webhookData.payload,
    };
  }

  /**
   * Release escrow payment
   * Backend communicates with Paynet API and updates database after successful release
   */
  async releaseEscrow(
    paymentId: string,
    deviceId: string,
    releaseReason: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Releasing escrow: paymentId=${paymentId}, deviceId=${deviceId}, userId=${userId}`,
    );

    // Get payment record from database
    const { data: payment, error: paymentError } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      throw new NotFoundException(`Payment not found: ${paymentId}`);
    }

    // Validate payment ownership
    if (payment.payer_id !== userId && payment.receiver_id !== userId) {
      throw new BadRequestException('Payment does not belong to this user');
    }

    // Validate payment status
    if (payment.payment_status !== 'completed' || payment.escrow_status !== 'held') {
      throw new BadRequestException(
        `Payment is not in valid state for escrow release. Status: ${payment.payment_status}, Escrow: ${payment.escrow_status}`,
      );
    }

    // Get Paynet transaction ID from payment record
    const paynetTransactionId =
      payment.provider_transaction_id || payment.provider_payment_id || paymentId;

    // Release escrow via Paynet API
    try {
      await this.paynetProvider.releaseEscrowPayment(paynetTransactionId, releaseReason);

      this.logger.log(`Escrow released successfully via Paynet: paymentId=${paymentId}`);

      // Update database after successful Paynet API call
      await this.updateDatabaseAfterEscrowRelease(payment, deviceId, releaseReason, userId);

      return {
        success: true,
        message: 'Escrow released successfully',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to release escrow: ${error.message}`,
        error.stack,
      );

      throw new BadRequestException(
        `Escrow release failed: ${error.message}`,
      );
    }
  }

  /**
   * Update database after successful escrow release
   */
  private async updateDatabaseAfterEscrowRelease(
    payment: any,
    deviceId: string,
    releaseReason: string,
    userId: string,
  ): Promise<void> {
    try {
      // 1. Update escrow_accounts table
      const { error: escrowError } = await this.supabase
        .from('escrow_accounts')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          released_by: userId,
          release_reason: releaseReason,
          updated_at: new Date().toISOString(),
        })
        .eq('payment_id', payment.id);

      if (escrowError) {
        this.logger.error(`Failed to update escrow account: ${escrowError.message}`, escrowError);
        throw escrowError;
      }

      // 2. Update payments table
      const { error: paymentError } = await this.supabase
        .from('payments')
        .update({
          escrow_status: 'released',
          escrow_released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (paymentError) {
        this.logger.error(`Failed to update payment: ${paymentError.message}`, paymentError);
        throw paymentError;
      }

      // 3. Update devices table
      const { error: deviceError } = await this.supabase
        .from('devices')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', deviceId);

      if (deviceError) {
        this.logger.error(`Failed to update device status: ${deviceError.message}`, deviceError);
        throw deviceError;
      }

      // 4. Create audit_logs record
      const { error: auditError } = await this.supabase
        .from('audit_logs')
        .insert({
          event_type: 'escrow_released',
          event_category: 'payment',
          event_action: 'release',
          event_severity: 'info',
          user_id: userId,
          resource_type: 'payment',
          resource_id: payment.id,
          event_description: 'Escrow released after device confirmation',
          event_data: {
            payment_id: payment.id,
            device_id: deviceId,
            net_payout: payment.net_payout,
            released_at: new Date().toISOString(),
            release_reason: releaseReason,
          },
        });

      if (auditError) {
        this.logger.error(`Failed to create audit log: ${auditError.message}`, auditError);
        // Don't throw - audit logs are not critical
      }

      // 5. Create notifications records
      // Notification for owner (payer)
      const { error: ownerNotifError } = await this.supabase
        .from('notifications')
        .insert({
          user_id: payment.payer_id,
          message_key: 'escrow_released_owner',
          type: 'success',
          is_read: false,
        });

      if (ownerNotifError) {
        this.logger.error(`Failed to create owner notification: ${ownerNotifError.message}`, ownerNotifError);
        // Don't throw - notifications are not critical
      }

      // Notification for finder (receiver)
      if (payment.receiver_id) {
        const { error: finderNotifError } = await this.supabase
          .from('notifications')
          .insert({
            user_id: payment.receiver_id,
            message_key: 'escrow_released_finder',
            type: 'payment_success',
            is_read: false,
          });

        if (finderNotifError) {
          this.logger.error(`Failed to create finder notification: ${finderNotifError.message}`, finderNotifError);
          // Don't throw - notifications are not critical
        }
      }

      this.logger.log(`Successfully updated database after escrow release: ${payment.id}`);
    } catch (error: any) {
      this.logger.error(`Error updating database after escrow release: ${error.message}`, error.stack);
      throw error;
    }
  }

}

