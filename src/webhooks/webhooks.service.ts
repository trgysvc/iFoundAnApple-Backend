import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { PaynetProvider } from '../payments/providers/paynet.provider';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly supabase: SupabaseClient;
  private readonly processedWebhooks = new Set<string>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly paynetProvider: PaynetProvider,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Handle PAYNET webhook callback (confirmation_url)
   * Based on: https://doc.paynet.com.tr/oedeme-metotlari/ortak-odeme-sayfasi/odeme-emri-olusturma/confirmation-url-adresine-post-edilen-parametreler
   * 
   * PAYNET webhook payload structure:
   * {
   *   "reference_no": "string",      // Ödeme işleminin referans numarası (payment_id)
   *   "xact_date": "string",         // Ödeme işleminin yapıldığı zaman
   *   "agent_id": "string",          // Bayi kodu (opsiyonel)
   *   "bank_id": "string",           // Ödemenin yapıldığı banka numarası
   *   "instalment": "int",           // Taksit sayısı
   *   "card_holder": "string",       // Kart sahibinin adı ve soyadı
   *   "card_number": "string",       // Kart numarasının ilk 6 ve son 4 hanesi
   *   "amount": "decimal",           // Yapılan ödemenin brüt tutarı
   *   "netAmount": "decimal",        // Yapılan ödemenin net tutarı
   *   "comission": "decimal",        // Hizmet bedeli tutarı
   *   "comission_tax": "decimal",    // Hizmet bedeli vergisi
   *   "currency": "string",          // Para birimi (TRY)
   *   "authorization_code": "string", // Bankadan dönen onay kodu
   *   "order_id": "string",          // Bankadan dönen satış kodu
   *   "is_succeed": "boolean"        // Ödemenin başarılı olup olmadığı
   * }
   * 
   * Steps:
   * 1. Verify signature (if available)
   * 2. Check idempotency (using reference_no)
   * 3. Update payment status
   * 4. Update escrow status
   * 5. Update device status
   */
  async handlePaynetWebhook(
    payload: any,
    signature: string,
    timestamp: string,
  ): Promise<void> {
    this.logger.log(`Received PAYNET webhook: ${JSON.stringify(payload)}`);

    // PAYNET webhook signature verification (if signature is provided)
    if (signature && !this.paynetProvider.verifyWebhookSignature(payload, signature, timestamp)) {
      this.logger.error('Invalid webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    // PAYNET uses reference_no as unique identifier for idempotency
    const referenceNo = payload.reference_no;
    if (!referenceNo) {
      throw new BadRequestException('Missing reference_no in webhook payload');
    }

    // Check idempotency using reference_no
    if (this.processedWebhooks.has(referenceNo)) {
      this.logger.warn(`Duplicate webhook detected: reference_no=${referenceNo}`);
      return;
    }

    this.processedWebhooks.add(referenceNo);

    // PAYNET uses is_succeed to indicate payment success
    const isSucceed = payload.is_succeed === true || payload.is_succeed === 'true';
    
    if (isSucceed) {
      await this.completePayment(referenceNo, payload);
    } else {
      await this.failPayment(referenceNo);
    }
  }

  private async completePayment(referenceNo: string, payload: any): Promise<void> {
    // Find payment by reference_no (which is our payment_id)
    const { data: payment, error: findError } = await this.supabase
      .from('payments')
      .select('id, device_id, payment_status, provider_transaction_id')
      .eq('id', referenceNo)
      .single();

    if (findError || !payment) {
      this.logger.error(`Payment not found for reference_no: ${referenceNo}`, findError);
      throw new BadRequestException(`Payment not found for reference_no: ${referenceNo}`);
    }

    if (payment.payment_status === 'completed') {
      this.logger.warn(`Payment ${payment.id} already completed, skipping update`);
      return;
    }

    const deviceId = payment.device_id;
    const paymentId = payment.id;
    const now = new Date().toISOString();

    // Update payment with PAYNET transaction details
    const { error: paymentError } = await this.supabase
      .from('payments')
      .update({
        payment_status: 'completed',
        escrow_status: 'held',
        escrow_held_at: now,
        completed_at: now,
        updated_at: now,
        provider_transaction_id: payload.order_id || payload.authorization_code, // PAYNET order_id or authorization_code
        provider_authorization_code: payload.authorization_code,
        provider_bank_id: payload.bank_id,
        provider_instalment: payload.instalment,
        provider_card_holder: payload.card_holder,
        provider_card_number: payload.card_number, // Masked card number (first 6 + last 4 digits)
      })
      .eq('id', paymentId);

    if (paymentError) {
      this.logger.error(`Failed to update payment: ${paymentError.message}`, paymentError);
      throw new BadRequestException('Failed to update payment status');
    }

    const { error: escrowError } = await this.supabase
      .from('escrow_accounts')
      .update({
        status: 'held',
        held_at: now,
        updated_at: now,
      })
      .eq('payment_id', paymentId);

    if (escrowError) {
      this.logger.error(`Failed to update escrow: ${escrowError.message}`, escrowError);
    }

    const { error: deviceError } = await this.supabase
      .from('devices')
      .update({
        status: 'payment_completed',
        updated_at: now,
      })
      .eq('id', deviceId);

    if (deviceError) {
      this.logger.error(`Failed to update device: ${deviceError.message}`, deviceError);
    }

    const { error: transactionError } = await this.supabase
      .from('financial_transactions')
      .insert({
        payment_id: paymentId,
        device_id: deviceId,
        transaction_type: 'payment',
        amount: payload.amount || 0,
        currency: payload.currency || 'TRY',
        status: 'completed',
        description: `Payment completed for device - PAYNET transaction`,
        completed_at: now,
      });

    if (transactionError) {
      this.logger.warn(`Failed to create financial transaction: ${transactionError.message}`);
    }

    this.logger.log(`Payment ${paymentId} completed successfully via PAYNET webhook`);
  }

  private async failPayment(referenceNo: string): Promise<void> {
    // Find payment by reference_no
    const { data: payment, error: findError } = await this.supabase
      .from('payments')
      .select('id')
      .eq('id', referenceNo)
      .single();

    if (findError || !payment) {
      this.logger.error(`Payment not found for reference_no: ${referenceNo}`, findError);
      throw new BadRequestException(`Payment not found for reference_no: ${referenceNo}`);
    }

    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from('payments')
      .update({
        payment_status: 'failed',
        updated_at: now,
      })
      .eq('id', payment.id);

    if (error) {
      this.logger.error(`Failed to update payment status: ${error.message}`, error);
    }

    this.logger.log(`Payment ${payment.id} marked as failed via PAYNET webhook`);
  }
}

