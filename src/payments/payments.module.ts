import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PaymentsController } from './payments.controller';
import { PaynetProvider } from './providers/paynet.provider';
import { FeeValidationService } from './services/fee-validation.service';
import { PaymentsService } from './services/payments.service';

@Module({
  imports: [HttpModule, SupabaseModule, WebhooksModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, FeeValidationService, PaynetProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}

