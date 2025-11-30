import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SupabaseModule } from '../supabase/supabase.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PaymentsController } from './payments.controller';
import { PaynetProvider } from './providers/paynet.provider';
import { FeeValidationService } from './services/fee-validation.service';
import { PaymentReconciliationService } from './services/payment-reconciliation.service';
import { PaymentsService } from './services/payments.service';

@Module({
  imports: [HttpModule, SupabaseModule, WebhooksModule, ScheduleModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    FeeValidationService,
    PaynetProvider,
    PaymentReconciliationService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}

