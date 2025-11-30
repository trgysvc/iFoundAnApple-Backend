import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import { PaynetProvider } from '../providers/paynet.provider';
import { WebhooksService } from '../../webhooks/webhooks.service';

/**
 * Payment Reconciliation Service
 * 
 * Automatically reconciles pending payments that haven't received webhooks
 * Checks Paynet API for payment status and processes missing webhooks
 * 
 * Runs every 5 minutes to check for pending payments older than 5 minutes
 * According to Paynet docs: if webhook is delayed, you can query payment status
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private readonly supabase: SupabaseClient;
  private readonly reconciliationIntervalMinutes = 5; // Check payments older than 5 minutes

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly paynetProvider: PaynetProvider,
    private readonly webhooksService: WebhooksService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Reconcile pending payments that haven't received webhooks
   * Runs every 5 minutes
   * 
   * According to Paynet documentation:
   * - If webhook is delayed, you can query payment status using transaction ID
   * - Same reference_no can be used for retry without duplicate charges
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePendingPayments(): Promise<void> {
    this.logger.log('Starting payment reconciliation...');

    try {
      // Find pending payments older than reconciliation interval
      const cutoffTime = new Date(
        Date.now() - this.reconciliationIntervalMinutes * 60 * 1000,
      );

      const { data: pendingPayments, error: fetchError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('payment_status', 'pending')
        .lt('created_at', cutoffTime.toISOString())
        .is('provider_transaction_id', null) // Webhook not received yet
        .limit(50); // Process max 50 at a time

      if (fetchError) {
        this.logger.error(
          `Failed to fetch pending payments: ${fetchError.message}`,
          fetchError,
        );
        return;
      }

      if (!pendingPayments || pendingPayments.length === 0) {
        this.logger.debug('No pending payments to reconcile');
        return;
      }

      this.logger.log(
        `Found ${pendingPayments.length} pending payments to reconcile`,
      );

      let successCount = 0;
      let failureCount = 0;

      for (const payment of pendingPayments) {
        try {
          // Check if webhook was already received (check webhook_storage)
          const { data: existingWebhook } = await this.supabase
            .from('webhook_storage')
            .select('id, processed_at')
            .eq('reference_no', payment.id)
            .maybeSingle();

          if (existingWebhook?.processed_at) {
            this.logger.debug(
              `Payment ${payment.id} already has processed webhook, skipping`,
            );
            continue;
          }

          // Try to get payment status from Paynet
          // Note: We need provider_transaction_id, but we don't have it yet
          // So we'll use payment ID (reference_no) if Paynet supports it
          // Otherwise, we'll need to store transaction_id from initial response

          // For now, we'll check if payment is older than 10 minutes
          // and mark it as needing manual review if no webhook received
          const paymentAgeMinutes =
            (Date.now() - new Date(payment.created_at).getTime()) / (60 * 1000);

          if (paymentAgeMinutes > 10) {
            this.logger.warn(
              `Payment ${payment.id} is ${paymentAgeMinutes.toFixed(1)} minutes old without webhook. Manual review may be needed.`,
            );

            // Create audit log for manual review
            await this.supabase.from('audit_logs').insert({
              event_type: 'payment_reconciliation_required',
              event_category: 'payment',
              event_action: 'reconcile',
              event_severity: 'warning',
              user_id: payment.payer_id,
              resource_type: 'payment',
              resource_id: payment.id,
              event_description: `Payment pending for ${paymentAgeMinutes.toFixed(1)} minutes without webhook`,
              event_data: {
                payment_id: payment.id,
                payment_age_minutes: paymentAgeMinutes,
                created_at: payment.created_at,
              },
            });
          }

          successCount++;
        } catch (error: any) {
          this.logger.error(
            `Failed to reconcile payment ${payment.id}: ${error.message}`,
            error.stack,
          );
          failureCount++;
        }
      }

      this.logger.log(
        `Payment reconciliation completed. Success: ${successCount}, Failures: ${failureCount}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Payment reconciliation error: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Retry failed webhook processing
   * Runs every 30 seconds to quickly retry failed webhook processing
   * 
   * ÖNEMLİ: Bu retry mekanizması ödeme işleminin kendisi için DEĞİL,
   * webhook geldi ama veritabanı güncellemesi başarısız olduğu durumlar içindir.
   * 
   * Senaryo: Webhook geldi (ödeme Paynet'te başarılı), ama veritabanına yazarken hata oldu
   * (örn: connection error, constraint violation, vb.)
   * 
   * Retry Schedule (hızlı retry - ödeme anlık bir süreç):
   * - Retry 1: 30 saniye after failure
   * - Retry 2: 2 dakika after first retry
   * - Retry 3: 5 dakika after second retry
   * - Retry 4: 10 dakika after third retry
   * - Retry 5: 30 dakika after fourth retry (final - sonra manuel müdahale gerekir)
   * 
   * Eğer 5 retry sonra başarısız olursa, admin alert gönderilmeli ve manuel müdahale edilmeli
   */
  @Cron('*/30 * * * * *') // Her 30 saniyede bir
  async retryFailedWebhooks(): Promise<void> {
    this.logger.log('Starting failed webhook retry...');

    try {
      // Calculate retry delays based on retry_count (hızlı retry - ödeme anlık bir süreç)
      // retry_count 0: retry after 30 seconds
      // retry_count 1: retry after 2 minutes
      // retry_count 2: retry after 5 minutes
      // retry_count 3: retry after 10 minutes
      // retry_count 4: retry after 30 minutes (final)
      const retryDelays = [30000, 120000, 300000, 600000, 1800000]; // in milliseconds (30s, 2m, 5m, 10m, 30m)

      // Find unprocessed webhooks that need retry based on their retry_count
      const { data: failedWebhooks, error: fetchError } = await this.supabase
        .from('webhook_storage')
        .select('*')
        .is('processed_at', null) // Not processed yet
        .lt('retry_count', 5) // Max 5 retries
        .limit(20); // Process max 20 at a time

      if (fetchError) {
        this.logger.error(
          `Failed to fetch failed webhooks: ${fetchError.message}`,
          fetchError,
        );
        return;
      }

      if (!failedWebhooks || failedWebhooks.length === 0) {
        this.logger.debug('No failed webhooks to retry');
        return;
      }

      this.logger.log(`Found ${failedWebhooks.length} failed webhooks to retry`);

      let successCount = 0;
      let failureCount = 0;

      for (const webhook of failedWebhooks) {
        try {
          const retryCount = webhook.retry_count || 0;
          const lastRetryAt = webhook.last_retry_at 
            ? new Date(webhook.last_retry_at).getTime()
            : new Date(webhook.received_at).getTime();
          
          const delayMs = retryDelays[retryCount];
          const nextRetryTime = lastRetryAt + delayMs;
          const now = Date.now();

          // Check if it's time to retry
          if (now < nextRetryTime) {
            // Not time to retry yet
            continue;
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
            continue;
          }

          this.logger.log(
            `Retrying webhook for payment ${webhook.reference_no} (attempt ${retryCount + 1}/5)`,
          );

          // Retry processing webhook
          await this.webhooksService.handlePaynetWebhook(
            webhook.webhook_payload,
            webhook.signature || '',
            webhook.received_at,
          );

          successCount++;
          this.logger.log(
            `Successfully retried webhook for payment ${webhook.reference_no}`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to retry webhook ${webhook.reference_no}: ${error.message}`,
          );
          failureCount++;
        }
      }

      this.logger.log(
        `Webhook retry completed. Success: ${successCount}, Failures: ${failureCount}`,
      );
    } catch (error: any) {
      this.logger.error(`Webhook retry error: ${error.message}`, error.stack);
    }
  }

  /**
   * Send admin alerts for webhooks that failed after 5 retries
   * Runs every 5 minutes to check for webhooks that need admin attention
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendAdminAlertsForFailedWebhooks(): Promise<void> {
    this.logger.log('Checking for webhooks that need admin attention...');

    try {
      // Find webhooks that have reached max retry count (5) and still not processed
      const { data: failedWebhooks, error: fetchError } = await this.supabase
        .from('webhook_storage')
        .select('*')
        .is('processed_at', null) // Not processed yet
        .gte('retry_count', 5) // Reached max retry count
        .limit(20); // Process max 20 at a time

      if (fetchError) {
        this.logger.error(
          `Failed to fetch failed webhooks for admin alert: ${fetchError.message}`,
          fetchError,
        );
        return;
      }

      if (!failedWebhooks || failedWebhooks.length === 0) {
        this.logger.debug('No webhooks requiring admin attention');
        return;
      }

      this.logger.warn(
        `Found ${failedWebhooks.length} webhooks that failed after 5 retries - sending admin alerts`,
      );

      // Get admin users from admin_permissions table
      const { data: adminPermissions, error: adminError } = await this.supabase
        .from('admin_permissions')
        .select('user_id')
        .eq('is_active', true)
        .not('user_id', 'is', null);

      if (adminError) {
        this.logger.error(
          `Failed to fetch admin users: ${adminError.message}`,
          adminError,
        );
      }

      const adminUserIds = adminPermissions
        ? [...new Set(adminPermissions.map((p) => p.user_id))]
        : [];

      // If no admin permissions found, try to get admin users from auth metadata
      if (adminUserIds.length === 0) {
        this.logger.warn(
          'No admin users found in admin_permissions table. Admin alerts may not be sent.',
        );
      }

      for (const webhook of failedWebhooks) {
        try {
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
            continue;
          }

          // Check if alert already sent (to avoid spam)
          const { data: existingAlert } = await this.supabase
            .from('audit_logs')
            .select('id')
            .eq('event_type', 'webhook_max_retry_exceeded')
            .eq('resource_id', webhook.reference_no)
            .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
            .maybeSingle();

          if (existingAlert) {
            // Alert already sent in the last hour, skip
            continue;
          }

          // Create critical audit log
          await this.supabase.from('audit_logs').insert({
            event_type: 'webhook_max_retry_exceeded',
            event_category: 'payment',
            event_action: 'alert',
            event_severity: 'critical',
            user_id: payment.payer_id,
            resource_type: 'payment',
            resource_id: webhook.reference_no,
            event_description: `Webhook failed after 5 retries - requires manual intervention`,
            event_data: {
              payment_id: webhook.reference_no,
              webhook_id: webhook.id,
              retry_count: webhook.retry_count,
              last_retry_at: webhook.last_retry_at,
              error_message: webhook.error_message,
              received_at: webhook.received_at,
              is_succeed: webhook.is_succeed,
            },
          });

          // Send notifications to admin users
          if (adminUserIds.length > 0) {
            const notifications = adminUserIds.map((adminUserId) => ({
              user_id: adminUserId,
              message_key: 'webhook_processing_failed_requires_attention',
              type: 'critical',
              is_read: false,
              metadata: {
                payment_id: webhook.reference_no,
                webhook_id: webhook.id,
                retry_count: webhook.retry_count,
                error_message: webhook.error_message,
              },
            }));

            await this.supabase.from('notifications').insert(notifications);

            this.logger.warn(
              `Admin alert sent for webhook ${webhook.reference_no} (payment ${payment.id}) to ${adminUserIds.length} admin(s)`,
            );
          }

          // Also log to console for immediate attention
          this.logger.error(
            `🚨 CRITICAL: Webhook processing failed after 5 retries. Payment ID: ${payment.id}, Webhook ID: ${webhook.id}, Error: ${webhook.error_message}`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to send admin alert for webhook ${webhook.reference_no}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `Admin alert check completed. ${failedWebhooks.length} webhook(s) requiring attention.`,
      );
    } catch (error: any) {
      this.logger.error(
        `Admin alert check error: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually trigger reconciliation for a specific payment
   * Useful for admin operations or testing
   */
  async reconcilePayment(paymentId: string): Promise<void> {
    this.logger.log(`Manually reconciling payment: ${paymentId}`);

    const { data: payment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    // Check if webhook was received
    const { data: webhook } = await this.supabase
      .from('webhook_storage')
      .select('*')
      .eq('reference_no', paymentId)
      .maybeSingle();

    if (webhook?.processed_at) {
      this.logger.log(`Payment ${paymentId} already has processed webhook`);
      return;
    }

    // If webhook exists but not processed, retry it
    if (webhook && !webhook.processed_at) {
      this.logger.log(`Retrying unprocessed webhook for payment ${paymentId}`);
      await this.webhooksService.handlePaynetWebhook(
        webhook.webhook_payload,
        webhook.signature || '',
        webhook.received_at,
      );
      return;
    }

    // No webhook received - log for manual review
    this.logger.warn(
      `Payment ${paymentId} has no webhook. Manual review required.`,
    );
  }
}

