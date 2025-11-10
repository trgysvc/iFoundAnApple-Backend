import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  SUPABASE_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().min(10).required()
});

