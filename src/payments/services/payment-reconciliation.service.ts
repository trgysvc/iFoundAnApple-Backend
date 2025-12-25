import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

/**
 * Payment Reconciliation Service - Sadeleştirilmiş Versiyon
 * 
 * SADECE webhook işleme hatalarını retry eder.
 * 
 * Paynet dokümantasyonuna göre:
 * - Aynı reference_no ile tekrar gönderimde duplicate tahsilat yapılmaz
 * - Ödeme gönderildiğinde yanıt alınır (başarılı/başarısız)
 * - Webhook sadece bildirimdir, ödeme zaten Paynet tarafında sonuçlanmıştır
 * 
 * Bu servis SADECE webhook geldi ama veritabanı güncellemesi başarısız olduğu durumlar için retry yapar.
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private readonly supabase: SupabaseClient;
  private readonly maxRetries = 3; // Maksimum 3 retry
  private readonly retryDelays = [60000, 300000, 900000]; // 1 dakika, 5 dakika, 15 dakika

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly webhooksService: WebhooksService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Retry failed webhook processing
   * SADECE webhook geldi ama veritabanı güncellemesi başarısız olduğu durumlar için
   * 
   * Retry Schedule:
   * - Retry 1: 1 dakika after failure
   * - Retry 2: 5 dakika after first retry
   * - Retry 3: 15 dakika after second retry
   * 
   * Eğer 3 retry sonra başarısız olursa, admin alert gönderilir ve manuel müdahale gerekir
   */
  @Cron(CronExpression.EVERY_MINUTE) // Her 1 dakikada bir kontrol et
  async retryFailedWebhooks(): Promise<void> {
    this.logger.debug('Checking for failed webhooks to retry...');

    try {
      // Find unprocessed webhooks that need retry based on their retry_count
      const { data: failedWebhooks, error: fetchError } = await this.supabase
        .from('webhook_storage')
        .select('*')
        .is('processed_at', null) // Not processed yet
        .lt('retry_count', this.maxRetries) // Max 3 retries
        .limit(10); // Process max 10 at a time

      if (fetchError) {
        this.logger.error(
          `Failed to fetch failed webhooks: ${fetchError.message}`,
          fetchError,
        );
        return;
      }

      if (!failedWebhooks || failedWebhooks.length === 0) {
        return; // No failed webhooks
      }

      this.logger.log(`Found ${failedWebhooks.length} failed webhooks to retry`);

      for (const webhook of failedWebhooks) {
        try {
          const retryCount = webhook.retry_count || 0;
          const lastRetryAt = webhook.last_retry_at 
            ? new Date(webhook.last_retry_at).getTime()
            : new Date(webhook.received_at).getTime();
          
          const delayMs = this.retryDelays[retryCount];
          const nextRetryTime = lastRetryAt + delayMs;
          const now = Date.now();

          // Check if it's time to retry
          if (now < nextRetryTime) {
            continue; // Not time to retry yet
          }

          // Find payment record
          const { data: payment } = await this.supabase
            .from('payments')
            .select('*')
            .eq('id', webhook.reference_no)
            .single();

          if (!payment) {
            this.logger.warn(
              `Payment not found for webhook ${webhook.reference_no}`,
            );
            // Mark as processed to avoid infinite retries
            await this.supabase
              .from('webhook_storage')
              .update({
                processed_at: new Date().toISOString(),
                error_message: 'Payment not found',
              })
              .eq('id', webhook.id);
            continue;
          }

          this.logger.log(
            `Retrying webhook for payment ${webhook.reference_no} (attempt ${retryCount + 1}/${this.maxRetries})`,
          );

          // Retry processing webhook
          await this.webhooksService.handlePaynetWebhook(
            webhook.webhook_payload,
            webhook.signature || '',
            webhook.received_at,
          );

          this.logger.log(
            `Successfully retried webhook for payment ${webhook.reference_no}`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to retry webhook ${webhook.reference_no}: ${error.message}`,
          );
          
          // Update retry count
          const retryCount = (webhook.retry_count || 0) + 1;
          await this.supabase
            .from('webhook_storage')
            .update({
              retry_count: retryCount,
              last_retry_at: new Date().toISOString(),
              error_message: error.message,
            })
            .eq('id', webhook.id);

          // If max retries reached, send admin alert
          if (retryCount >= this.maxRetries) {
            const { data: paymentForAlert } = await this.supabase
              .from('payments')
              .select('payer_id')
              .eq('id', webhook.reference_no)
              .maybeSingle();
            await this.sendAdminAlert(webhook, paymentForAlert || null);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Webhook retry error: ${error.message}`, error.stack);
    }
  }

  /**
   * Send admin alert for webhooks that failed after max retries
   */
  private async sendAdminAlert(webhook: any, payment: any | null): Promise<void> {
    try {
      // Check if alert already sent (to avoid spam)
      const { data: existingAlert } = await this.supabase
        .from('audit_logs')
        .select('id')
        .eq('event_type', 'webhook_max_retry_exceeded')
        .eq('resource_id', webhook.reference_no)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .maybeSingle();

      if (existingAlert) {
        return; // Alert already sent
      }

      // Create critical audit log
      await this.supabase.from('audit_logs').insert({
        event_type: 'webhook_max_retry_exceeded',
        event_category: 'payment',
        event_action: 'alert',
        event_severity: 'critical',
        user_id: payment?.payer_id || null,
        resource_type: 'payment',
        resource_id: webhook.reference_no,
        event_description: `Webhook failed after ${this.maxRetries} retries - requires manual intervention`,
        event_data: {
          payment_id: webhook.reference_no,
          webhook_id: webhook.id,
          retry_count: webhook.retry_count,
          error_message: webhook.error_message,
        },
      });

      this.logger.error(
        `🚨 CRITICAL: Webhook processing failed after ${this.maxRetries} retries. Payment ID: ${webhook.reference_no}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send admin alert: ${error.message}`,
        error.stack,
      );
    }
  }
}

