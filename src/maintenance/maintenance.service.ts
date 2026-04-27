import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async onModuleInit() {
    this.logger.log('Maintenance Service initialized. Checking database connection...');
    await this.handleHeartbeat();
  }

  // Every 2 days at midnight: 0 0 */2 * *
  // Using daily for better reliability, but can be changed to 2 days as requested.
  @Cron('0 0 */2 * *')
  async handleHeartbeat() {
    this.logger.log('Starting Supabase heartbeat operation to prevent hibernation...');

    const supabase = this.supabaseService.getClient();
    const tempId = `heartbeat-${Date.now()}`;

    try {
      // 1. Insert a temporary record
      this.logger.log(`Inserting temporary heartbeat record: ${tempId}`);
      const { error: insertError } = await supabase
        .from('_heartbeat')
        .insert({ id: tempId, last_ping: new Date().toISOString() });

      if (insertError) {
        throw new Error(`Failed to insert heartbeat: ${insertError.message}`);
      }

      this.logger.log('Successfully inserted heartbeat record.');

      // 2. Delete the temporary record immediately
      this.logger.log(`Deleting temporary heartbeat record: ${tempId}`);
      const { error: deleteError } = await supabase
        .from('_heartbeat')
        .delete()
        .eq('id', tempId);

      if (deleteError) {
        throw new Error(`Failed to delete heartbeat: ${deleteError.message}`);
      }

      this.logger.log('Successfully deleted heartbeat record. Activity cycle complete.');
    } catch (error) {
      this.logger.error(`Database keep-alive failed: ${error.message}`);
      this.logger.warn(
        'Make sure the "_heartbeat" table exists in your Supabase database. Run the provided SQL migration if you haven\'t already.',
      );
    }
  }
}
