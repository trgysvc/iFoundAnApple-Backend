export interface AppConfig {
  port: number;
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface AppConfiguration {
  app: AppConfig;
  supabase: SupabaseConfig;
}

export default (): AppConfiguration => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10)
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  }
});

