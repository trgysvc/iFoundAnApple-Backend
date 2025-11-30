import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PaynetProvider } from '../payments/providers/paynet.provider';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [HttpModule, SupabaseModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, PaynetProvider],
  exports: [WebhooksService],
})
export class WebhooksModule {}

