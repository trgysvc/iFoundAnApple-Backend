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
  matched_with_user_id?: string;
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

    if (device.status !== 'matched') {
      throw new BadRequestException(
        `Device must be in 'matched' status. Current status: ${device.status}`,
      );
    }

    if (!device.matched_with_user_id) {
      throw new BadRequestException('Device has no matched finder');
    }

    const paymentId = await this.createPaymentRecords(
      device,
      fees,
      payerUserId,
      device.matched_with_user_id,
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
    const { data, error } = await this.supabase
      .from('devices')
      .select('id, userId, model, status, matched_with_user_id')
      .eq('id', deviceId)
      .single();

    if (error || !data) {
      this.logger.error(`Device not found: ${deviceId}`, error);
      throw new NotFoundException(`Device not found: ${deviceId}`);
    }

    return data as DeviceInfo;
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

    const { error: deviceError } = await this.supabase
      .from('devices')
      .update({ status: 'payment_pending', updated_at: new Date().toISOString() })
      .eq('id', device.id);

    if (deviceError) {
      this.logger.error(`Failed to update device status: ${deviceError.message}`, deviceError);
    }

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
    const { error } = await this.supabase
      .from('payments')
      .update({
        provider_transaction_id: paynetResponse.transaction_id || paynetResponse.transactionId,
        provider_session_id: paynetResponse.session_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (error) {
      this.logger.warn(
        `Failed to update payment with provider info: ${error.message}`,
      );
    }
  }
}

