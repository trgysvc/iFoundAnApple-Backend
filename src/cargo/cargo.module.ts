import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CargoController } from './cargo.controller';
import { CargoService } from './cargo.service';

@Module({
  imports: [SupabaseModule],
  controllers: [CargoController],
  providers: [CargoService],
  exports: [CargoService],
})
export class CargoModule {}
