import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  SUPABASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().min(10).required(),
  SUPABASE_JWKS_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  SUPABASE_JWT_AUDIENCE: Joi.string().default('authenticated'),
  SUPABASE_JWT_ISSUER: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  AUTH_CACHE_TTL_SECONDS: Joi.number().min(30).default(60),
  AUTH_ADMIN_ROLES: Joi.string().default('admin'),
  PAYNET_API_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').optional(),
  PAYNET_API_KEY: Joi.string().allow('').optional(),
  PAYNET_SECRET_KEY: Joi.string().allow('').optional(),
  PAYNET_PUBLISHABLE_KEY: Joi.string().allow('').optional(),
  FRONTEND_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').optional(),
  BACKEND_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').optional(),
});
