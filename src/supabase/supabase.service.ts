import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { AppConfiguration, SupabaseConfig } from '../config/configuration';

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  private readonly client: SupabaseClient;

  constructor(
    private readonly configService: ConfigService<AppConfiguration, true>
  ) {
    const supabaseConfig = this.configService.get<SupabaseConfig>('supabase', {
      infer: true
    });

    this.client = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
      auth: { persistSession: false },
      global: { headers: { 'X-Client-Info': 'ifoundanapple-backend/1.0.0' } }
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.auth.signOut();
  }
}

