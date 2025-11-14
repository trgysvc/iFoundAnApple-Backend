import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import { FeeValidationService } from './fee-validation.service';
import { PaynetProvider } from '../providers/paynet.provider';
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
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Process payment request
   * 1. Validate fees against database
   * 2. Get device and finder information
   * 3. Initiate PAYNET payment
   * 4. Create payment and escrow records
   */
  async processPayment(
    dto: ProcessPaymentDto,
    payerUserId: string,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Processing payment for device ${dto.deviceId} by user ${payerUserId}`);

    const fees = await this.feeValidationService.validateAmount(
      dto.deviceId,
      dto.totalAmount,
    );

    const device = await this.getDevice(dto.deviceId);

    if (device.userId !== payerUserId) {
      throw new BadRequestException('Device does not belong to the payer');
    }

    // After matching, owner device status becomes 'payment_pending' to allow payment
    // Process: matched → payment_pending → (payment) → payment_completed
    if (
      device.status !== 'payment_pending' &&
      device.status !== 'PAYMENT_PENDING'
    ) {
      throw new BadRequestException(
        `Device must be in 'payment_pending' status to proceed with payment. Current status: ${device.status}. Please complete matching first.`,
      );
    }

    // Get matched finder from payments table if payment already exists, 
    // or from device matching logic (to be implemented in frontend/match service)
    // For now, receiver_id will be set when payment is created
    // TODO: Implement proper matching logic to get receiver_id (finder's user_id)
    // This might require querying for matched device or using a matching table
    const receiverId = await this.getMatchedReceiverId(device.id);
    
    if (!receiverId) {
      throw new BadRequestException('Device has no matched finder. Please complete matching first.');
    }

    const paymentId = await this.createPaymentRecords(
      device,
      fees,
      payerUserId,
      receiverId,
    );

    // Initiate 3D Secure payment with PAYNET
    // is_escrow: true - Ödeme PAYNET tarafında da tutulur (ana firma onayına tabi)
    // Backend'deki escrow yönetimi ile birlikte çalışır
    // 
    // PAYNET API format:
    // - Endpoint: POST /v2/transaction/tds_initial
    // - Field names: snake_case (reference_no, return_url, domain, etc.)
    // - Card details should come from frontend, not stored in backend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    const paynetResponse = await this.paynetProvider.initiate3DPayment({
      amount: fees.totalAmount,
      reference_no: paymentId, // PAYNET uses reference_no instead of order_id
      return_url: `${frontendUrl}/payment/callback`, // 3D doğrulama sonucunun post edileceği URL
      domain: new URL(backendUrl).hostname, // Domain bilgisi (hostname only)
      is_escrow: true, // PAYNET escrow özelliği aktif - ödeme tutulur
      description: `Payment for device ${device.model}`,
      // Note: Card details (pan, card_holder, month, year, cvc) should come from frontend
      // Frontend will handle card input and send to PAYNET directly or via backend
    });

    await this.updatePaymentWithProviderInfo(paymentId, paynetResponse);

    return {
      id: paymentId,
      deviceId: dto.deviceId,
      paymentStatus: 'pending',
      escrowStatus: 'pending',
      totalAmount: fees.totalAmount,
      providerTransactionId: paynetResponse.transaction_id,
      publishableKey: this.paynetProvider.getPublishableKey(),
      paymentUrl: paynetResponse.post_url || paynetResponse.html_content, // 3D verification URL
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
   * Get matched receiver ID (finder's user_id) for a device
   * Uses existing tables:
   * 1. First check payments table (if payment already exists)
   * 2. Then find matched device with same serialNumber and model
   * 3. Alternative: Check audit_logs for device_matching event
   */
  private async getMatchedReceiverId(deviceId: string): Promise<string | null> {
    // Option 1: Check if payment already exists with receiver_id
    const { data: existingPayment, error: paymentError } = await this.supabase
      .from('payments')
      .select('receiver_id')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!paymentError && existingPayment?.receiver_id) {
      return existingPayment.receiver_id;
    }

    // Option 2: Get current device info
    const { data: currentDevice, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, userId, model, serialNumber, status, device_role')
      .eq('id', deviceId)
      .single();

    if (deviceError || !currentDevice) {
      this.logger.error(`Device not found: ${deviceId}`, deviceError);
      return null;
    }

    // Option 3: Find matched device with same serialNumber and model
    // The matched device should have:
    // - Same serialNumber and model
    // - Different userId (not the same user)
    // - Different device_role (if current is 'owner', finder should be 'finder' and vice versa)
    // Note: Only owner device needs to be 'matched' status for payment.
    // Finder device can have any status (REPORTED, matched, etc.) - we just need to find it.
    const currentUserRole = (currentDevice as any).device_role || 'owner'; // Default to owner if null
    const expectedMatchedRole = currentUserRole === 'owner' ? 'finder' : 'owner';

    const { data: matchedDevice, error: matchedError } = await this.supabase
      .from('devices')
      .select('id, userId, device_role')
      .eq('serialNumber', currentDevice.serialNumber)
      .eq('model', currentDevice.model)
      .neq('userId', currentDevice.userId) // Different user
      .eq('device_role', expectedMatchedRole) // Opposite role (owner ↔ finder)
      .maybeSingle();

    if (!matchedError && matchedDevice?.userId) {
      this.logger.log(
        `Found matched device: ${matchedDevice.id} with finder user: ${matchedDevice.userId}`,
      );
      return matchedDevice.userId;
    }

    // Option 4: Check audit_logs as fallback
    // Look for device_matching event with this device_id
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
        // If finderDeviceId is available, get its userId
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
      `No receiver_id found for device ${deviceId}. Device is in matched status but no finder found.`,
    );
    return null;
  }

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

    // Device status is already 'payment_pending' at this point (set during matching phase)
    // After payment is initiated, status will be updated to 'payment_completed' by webhook
    // No need to update device status here as it's already in payment_pending state
    this.logger.log(`Payment initiated for device ${device.id} with status: ${device.status}`);

    return paymentId;
  }

  /**
   * Complete 3D Secure payment after user verification
   * Called after user completes 3D Secure verification on bank's page
   * 
   * Security: This endpoint validates that:
   * 1. Payment exists and belongs to the user
   * 2. Payment is in 'pending' status
   * 3. Session ID and Token ID are valid
   */
  async complete3DPayment(
    dto: Complete3DPaymentDto,
    userId: string,
  ): Promise<{ success: boolean; paymentId: string; message: string }> {
    this.logger.log(
      `Completing 3D payment: paymentId=${dto.paymentId}, userId=${userId}`,
    );

    // Get payment and verify ownership
    const { data: payment, error: paymentError } = await this.supabase
      .from('payments')
      .select('id, payer_id, payment_status, provider_transaction_id')
      .eq('id', dto.paymentId)
      .single();

    if (paymentError || !payment) {
      this.logger.error(
        `Payment not found: ${dto.paymentId}`,
        paymentError,
      );
      throw new NotFoundException(`Payment not found: ${dto.paymentId}`);
    }

    // Security: Verify payment belongs to the user
    if (payment.payer_id !== userId) {
      this.logger.warn(
        `User ${userId} attempted to complete payment ${dto.paymentId} that belongs to ${payment.payer_id}`,
      );
      throw new BadRequestException('Payment does not belong to the user');
    }

    // Verify payment is in pending status
    if (payment.payment_status !== 'pending') {
      this.logger.warn(
        `Payment ${dto.paymentId} is not in pending status. Current status: ${payment.payment_status}`,
      );
      throw new BadRequestException(
        `Payment is not in pending status. Current status: ${payment.payment_status}`,
      );
    }

    // Complete 3D payment with PAYNET
    try {
      const paynetResponse = await this.paynetProvider.complete3DPayment({
        session_id: dto.sessionId,
        token_id: dto.tokenId,
        transaction_type: 1, // 1 = Satış (Sale)
      });

      // Update payment with PAYNET response
      // Note: Final payment status will be updated by webhook
      // But we can update transaction_id if available
      if (paynetResponse.transaction_id) {
        await this.supabase
          .from('payments')
          .update({
            provider_transaction_id: paynetResponse.transaction_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', dto.paymentId);
      }

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

      // Update payment status to failed if PAYNET returns error
      await this.supabase
        .from('payments')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', dto.paymentId);

      throw new BadRequestException(
        `Payment completion failed: ${error.message}`,
      );
    }
  }

  private async updatePaymentWithProviderInfo(
    paymentId: string,
    paynetResponse: any,
  ): Promise<void> {
    // payments table schema: provider_transaction_id exists, provider_session_id doesn't
    // Store session_id in provider_response JSONB or ignore if not critical
    const updateData: any = {
      provider_transaction_id: paynetResponse.transaction_id || paynetResponse.transactionId,
      updated_at: new Date().toISOString(),
    };

    // Store additional provider info in provider_response if needed
    if (paynetResponse.session_id) {
      // provider_response is text, could be JSON string
      // For now, we'll just store transaction_id which is the main field
      this.logger.debug(`PAYNET session_id received but not stored: ${paynetResponse.session_id}`);
    }

    const { error } = await this.supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId);

    if (error) {
      this.logger.warn(
        `Failed to update payment with provider info: ${error.message}`,
      );
    }
  }
}

