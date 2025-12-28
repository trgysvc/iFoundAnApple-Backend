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
  // In-memory cache for frequently accessed webhooks (complements database storage)
  private readonly webhookCache = new Map<string, StoredWebhook>();

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

    // PAYNET uses is_succeed to indicate payment success
    const isSucceed = payload.is_succeed === true || payload.is_succeed === 'true';

    // Check idempotency using database (webhook_storage table)
    const { data: existingWebhook } = await this.supabase
      .from('webhook_storage')
      .select('id, processed_at')
      .eq('reference_no', referenceNo)
      .maybeSingle();

    if (existingWebhook?.processed_at) {
      this.logger.warn(
        `Duplicate webhook detected (already processed): reference_no=${referenceNo}`,
      );
      return; // Webhook already processed
    }

    // Store webhook in database for idempotency and retry mechanism
    const webhookRecord = {
      payment_id: referenceNo, // payment_id is same as reference_no in our system
      reference_no: referenceNo,
      webhook_payload: payload,
      is_succeed: isSucceed,
      received_at: new Date().toISOString(),
      signature: signature || null,
      provider: 'paynet',
      processed_at: null, // Will be set when processing is complete
      retry_count: 0,
    };

    // Insert or update webhook record
    if (existingWebhook) {
      // Update existing unprocessed webhook
      const { error: updateError } = await this.supabase
        .from('webhook_storage')
        .update({
          webhook_payload: payload,
          is_succeed: isSucceed,
          received_at: new Date().toISOString(),
          signature: signature || null,
          retry_count: 0, // Reset retry count for new webhook
        })
        .eq('reference_no', referenceNo);

      if (updateError) {
        this.logger.error(
          `Failed to update webhook storage: ${updateError.message}`,
          updateError,
        );
        // Continue processing even if storage fails
      }
    } else {
      // Insert new webhook record
      const { error: insertError } = await this.supabase
        .from('webhook_storage')
        .insert(webhookRecord);

      if (insertError) {
        this.logger.error(
          `Failed to store webhook: ${insertError.message}`,
          insertError,
        );
        // Continue processing even if storage fails
      }
    }

    // Store in memory cache for quick retrieval
    this.webhookCache.set(referenceNo, {
      payload,
      receivedAt: new Date().toISOString(),
      isSucceed,
    });

    // Mark as processed in memory (for quick duplicate check)
    this.processedWebhooks.add(referenceNo);

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

    try {
      if (isSucceed) {
        // Payment successful - create all database records
        await this.processSuccessfulPayment(payment, payload, referenceNo);
      } else {
        // Payment failed - update payment status
        await this.processFailedPayment(payment, payload, referenceNo);
      }

      // Mark webhook as processed
      await this.supabase
        .from('webhook_storage')
        .update({
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('reference_no', referenceNo);
    } catch (error: any) {
      // Webhook processing failed - will be retried later
      this.logger.error(
        `Error processing webhook ${referenceNo}: ${error.message}`,
        error.stack,
      );

      // Update retry count - get current count first, then increment
      const { data: currentWebhook } = await this.supabase
        .from('webhook_storage')
        .select('retry_count')
        .eq('reference_no', referenceNo)
        .single();

      await this.supabase
        .from('webhook_storage')
        .update({
          retry_count: (currentWebhook?.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          error_message: error.message,
          updated_at: new Date().toISOString(),
        })
        .eq('reference_no', referenceNo);

      throw error; // Re-throw to let caller know processing failed
    }
  }

  /**
   * Process successful payment webhook
   * Creates all required database records
   */
  private async processSuccessfulPayment(
    payment: any,
    webhookPayload: any,
    referenceNo: string,
  ): Promise<void> {
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

      // 3.5. Update matched finder device status to 'payment_completed'
      // Get owner device details first
      const { data: ownerDevice } = await this.supabase
        .from('devices')
        .select('serialNumber, model')
        .eq('id', payment.device_id)
        .single();

      if (ownerDevice) {
        // Find and update finder device
        const { data: finderDevice } = await this.supabase
          .from('devices')
          .select('id')
          .eq('serialNumber', ownerDevice.serialNumber)
          .eq('model', ownerDevice.model)
          .eq('device_role', 'finder')
          .maybeSingle();

        if (finderDevice) {
          const { error: finderDeviceError } = await this.supabase
            .from('devices')
            .update({
              status: 'payment_completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', finderDevice.id);

          if (finderDeviceError) {
            this.logger.error(
              `Failed to update finder device status: ${finderDeviceError.message}`,
              finderDeviceError,
            );
            // Don't throw - owner device update succeeded
          } else {
            this.logger.log(`Finder device status updated to payment_completed: ${finderDevice.id}`);
          }
        }
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
   * Updates payment status to 'failed' and resets device status
   */
  private async processFailedPayment(
    payment: any,
    webhookPayload: any,
    referenceNo: string,
  ): Promise<void> {
    const paymentId = payment.id;
    this.logger.log(`Processing failed payment: ${paymentId}`);

    try {
      // 1. Update payments table with failed status
      const { error: updateError } = await this.supabase
        .from('payments')
        .update({
          payment_status: 'failed',
          failure_reason: webhookPayload.error_message || 'Payment failed',
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (updateError) {
        this.logger.error(
          `Failed to update payment status: ${updateError.message}`,
          updateError,
        );
        throw updateError;
      }

      // 2. Reset device status to 'payment_pending' so user can retry payment
      const { error: deviceError } = await this.supabase
        .from('devices')
        .update({
          status: 'payment_pending', // Allow user to retry payment
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.device_id);

      if (deviceError) {
        this.logger.error(
          `Failed to reset device status: ${deviceError.message}`,
          deviceError,
        );
        // Don't throw - payment update succeeded, device status is less critical
      }

      // 3. Create notification for payer
      const { error: notifError } = await this.supabase.from('notifications').insert({
        user_id: payment.payer_id,
        message_key: 'payment_failed',
        type: 'error',
        is_read: false,
        metadata: {
          payment_id: paymentId,
          failure_reason: webhookPayload.error_message || 'Payment failed',
        },
      });

      if (notifError) {
        this.logger.error(
          `Failed to create notification: ${notifError.message}`,
          notifError,
        );
        // Don't throw - notifications are not critical
      }

      // 4. Create audit log
      const { error: auditError } = await this.supabase.from('audit_logs').insert({
        event_type: 'payment_failed',
        event_category: 'payment',
        event_action: 'fail',
        event_severity: 'warning',
        user_id: payment.payer_id,
        resource_type: 'payment',
        resource_id: paymentId,
        event_description: `Payment failed: ${webhookPayload.error_message || 'Payment failed'}`,
        event_data: {
          payment_id: paymentId,
          reference_no: referenceNo,
          failure_reason: webhookPayload.error_message,
        },
      });

      if (auditError) {
        this.logger.error(
          `Failed to create audit log: ${auditError.message}`,
          auditError,
        );
        // Don't throw - audit logs are not critical
      }

      this.logger.log(`Successfully processed failed payment: ${paymentId}`);
    } catch (error: any) {
      this.logger.error(`Error processing failed payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get stored webhook data for a payment
   * Frontend/iOS calls this after detecting webhookReceived: true in status endpoint
   */
  async getWebhookData(paymentId: string): Promise<StoredWebhook | null> {
    // Check cache first
    if (this.webhookCache.has(paymentId)) {
      return this.webhookCache.get(paymentId) || null;
    }

    // Query database
    const { data: webhook } = await this.supabase
      .from('webhook_storage')
      .select('webhook_payload, received_at, is_succeed')
      .eq('reference_no', paymentId)
      .maybeSingle();

    if (!webhook) {
      return null;
    }

    const storedWebhook: StoredWebhook = {
      payload: webhook.webhook_payload,
      receivedAt: webhook.received_at,
      isSucceed: webhook.is_succeed,
    };

    // Cache for future requests
    this.webhookCache.set(paymentId, storedWebhook);
    return storedWebhook;
  }

  /**
   * Check if webhook has been received for a payment
   */
  async hasWebhook(paymentId: string): Promise<boolean> {
    // Check cache first
    if (this.webhookCache.has(paymentId)) {
      return true;
    }

    // Query database
    const { data: webhook } = await this.supabase
      .from('webhook_storage')
      .select('id')
      .eq('reference_no', paymentId)
      .maybeSingle();

    return webhook !== null;
  }

}

