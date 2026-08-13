import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentsModule } from '../payments/payments.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { CargoController } from './cargo.controller';
import { CargoService } from './cargo.service';

@Module({
  imports: [SupabaseModule, PaymentsModule, ScheduleModule.forRoot()],
  controllers: [CargoController],
  providers: [CargoService],
  exports: [CargoService],
})
export class CargoModule {}
