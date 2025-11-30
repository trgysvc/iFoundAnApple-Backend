import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { PaynetProvider } from '../payments/providers/paynet.provider';

interface StoredWebhook {
  payload: any;
  receivedAt: string;
  isSucceed: boolean;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly supabase: SupabaseClient;
  private readonly processedWebhooks = new Set<string>();
  // In-memory storage for webhook payloads (frontend/iOS can retrieve via GET endpoint)
  // In production, consider using Redis or a database table for persistence
  private readonly webhookStorage = new Map<string, StoredWebhook>();

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
   * 3. Store webhook payload in memory (for retrieval)
   * 4. Store webhook payload in database (webhook_storage table if exists)
   * 5. Find payment record by reference_no
   * 6. If payment successful (is_succeed: true), create all database records:
   *    - Update payments table
   *    - Create escrow_accounts record
   *    - Update devices table status to 'payment_completed'
   *    - Create audit_logs record
   *    - Create notifications records
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
    
    // Store webhook payload in memory for retrieval
    this.webhookStorage.set(referenceNo, {
      payload,
      receivedAt: new Date().toISOString(),
      isSucceed,
    });

    // Find payment record by reference_no (which is the payment ID)
    const { data: payment, error: paymentError } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', referenceNo)
      .single();

    if (paymentError || !payment) {
      this.logger.error(`Payment not found for reference_no: ${referenceNo}`, paymentError);
      // Still store webhook but log error
      return;
    }

    if (isSucceed) {
      // Payment successful - create all database records
      await this.processSuccessfulPayment(payment, payload);
    } else {
      // Payment failed - update payment status
      await this.processFailedPayment(payment, payload);
    }
  }

  /**
   * Process successful payment webhook
   * Creates all required database records
   */
  private async processSuccessfulPayment(payment: any, webhookPayload: any): Promise<void> {
    const paymentId = payment.id;
    this.logger.log(`Processing successful payment: ${paymentId}`);

    try {
      // 1. Update payments table
      const { error: updateError } = await this.supabase
        .from('payments')
        .update({
          payment_status: 'completed',
          escrow_status: 'held',
          provider_payment_id: webhookPayload.order_id,
          provider_transaction_id: webhookPayload.reference_no,
          authorization_code: webhookPayload.authorization_code,
          completed_at: webhookPayload.xact_date || new Date().toISOString(),
          payment_gateway_fee: webhookPayload.comission || payment.payment_gateway_fee,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (updateError) {
        this.logger.error(`Failed to update payment: ${updateError.message}`, updateError);
        throw updateError;
      }

      // 2. Create escrow_accounts record
      const { error: escrowError } = await this.supabase
        .from('escrow_accounts')
        .insert({
          payment_id: paymentId,
          device_id: payment.device_id,
          holder_user_id: payment.payer_id,
          beneficiary_user_id: payment.receiver_id,
          total_amount: payment.total_amount,
          reward_amount: payment.reward_amount,
          service_fee: payment.service_fee,
          gateway_fee: payment.payment_gateway_fee,
          cargo_fee: payment.cargo_fee,
          net_payout: payment.net_payout,
          status: 'held',
          escrow_type: 'standard',
          auto_release_days: 30,
          release_conditions: [],
          confirmations: [],
          currency: 'TRY',
          held_at: new Date().toISOString(),
        });

      if (escrowError) {
        this.logger.error(`Failed to create escrow account: ${escrowError.message}`, escrowError);
        throw escrowError;
      }

      // 3. Update devices table status to 'payment_completed'
      const { error: deviceError } = await this.supabase
        .from('devices')
        .update({
          status: 'payment_completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.device_id);

      if (deviceError) {
        this.logger.error(`Failed to update device status: ${deviceError.message}`, deviceError);
        throw deviceError;
      }

      // 4. Create audit_logs record
      const { error: auditError } = await this.supabase
        .from('audit_logs')
        .insert({
          event_type: 'payment_completed',
          event_category: 'payment',
          event_action: 'complete',
          event_severity: 'info',
          user_id: payment.payer_id,
          resource_type: 'payment',
          resource_id: paymentId,
          event_description: 'Payment completed successfully via PAYNET',
          event_data: {
            amount: payment.total_amount,
            provider: 'paynet',
            authorization_code: webhookPayload.authorization_code,
            order_id: webhookPayload.order_id,
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
          message_key: 'payment_completed_owner',
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
            message_key: 'payment_received_finder',
            type: 'payment_success',
            is_read: false,
          });

        if (finderNotifError) {
          this.logger.error(`Failed to create finder notification: ${finderNotifError.message}`, finderNotifError);
          // Don't throw - notifications are not critical
        }
      }

      this.logger.log(`Successfully processed payment webhook: ${paymentId}`);
    } catch (error: any) {
      this.logger.error(`Error processing successful payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process failed payment webhook
   * Updates payment status to 'failed'
   */
  private async processFailedPayment(payment: any, webhookPayload: any): Promise<void> {
    const paymentId = payment.id;
    this.logger.log(`Processing failed payment: ${paymentId}`);

    try {
      // Update payments table with failed status
      const { error: updateError } = await this.supabase
        .from('payments')
        .update({
          payment_status: 'failed',
          failure_reason: webhookPayload.error_message || 'Payment failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (updateError) {
        this.logger.error(`Failed to update payment status: ${updateError.message}`, updateError);
        throw updateError;
      }

      this.logger.log(`Successfully updated failed payment: ${paymentId}`);
    } catch (error: any) {
      this.logger.error(`Error processing failed payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get stored webhook data for a payment
   * Frontend/iOS calls this after detecting webhookReceived: true in status endpoint
   */
  getWebhookData(paymentId: string): StoredWebhook | null {
    return this.webhookStorage.get(paymentId) || null;
  }

  /**
   * Check if webhook has been received for a payment
   */
  hasWebhook(paymentId: string): boolean {
    return this.webhookStorage.has(paymentId);
  }

}

