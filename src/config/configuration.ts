export interface AppConfig {
  port: number;
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface AuthConfig {
  jwksUrl: string;
  audience: string;
  issuer: string;
  cacheTtlSeconds: number;
  adminRoles: string[];
}

export interface AppConfiguration {
  app: AppConfig;
  supabase: SupabaseConfig;
  auth: AuthConfig;
}

export const loadConfiguration = (): AppConfiguration => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
  auth: {
    jwksUrl: process.env.SUPABASE_JWKS_URL ?? '',
    audience: process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated',
    issuer: process.env.SUPABASE_JWT_ISSUER ?? '',
    cacheTtlSeconds: parseInt(process.env.AUTH_CACHE_TTL_SECONDS ?? '60', 10),
    adminRoles: (process.env.AUTH_ADMIN_ROLES ?? 'admin')
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role.length > 0),
  },
});
