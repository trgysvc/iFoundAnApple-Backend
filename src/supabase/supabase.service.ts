import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, User, createClient } from '@supabase/supabase-js';
import { AppConfiguration, SupabaseConfig } from '../config/configuration';

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  private readonly client: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private readonly configService: ConfigService<AppConfiguration, true>) {
    const supabaseConfig = this.configService.get<SupabaseConfig>('supabase', {
      infer: true,
    });

    this.client = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
      auth: { persistSession: false },
      global: { headers: { 'X-Client-Info': 'ifoundanapple-backend/1.0.0' } },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error) {
      this.logger.warn(`Supabase user lookup failed for ${userId}: ${error.message}`);
      return null;
    }

    return data.user ?? null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.auth.signOut();
  }
}
