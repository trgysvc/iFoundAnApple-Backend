# iFoundAnApple-Backend
Backend service for iFoundAnApple platform. Features payment processing (Stripe/Paynet), cargo company integrations (Yurtiçi), escrow management, and comprehensive admin panel APIs.

## Environment Setup

This project requires a `.env` file in the root directory with the following required environment variables:

### Required Variables
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (keep secret!)
- `SUPABASE_JWKS_URL` - JWKS URL for JWT verification (typically `https://your-project.supabase.co/.well-known/jwks.json`)
- `SUPABASE_JWT_ISSUER` - JWT issuer URL (typically `https://your-project.supabase.co/auth/v1`)

### Optional Variables
- `NODE_ENV` - Environment (default: `development`)
- `PORT` - Server port (default: `3000`)
- `SUPABASE_JWT_AUDIENCE` - JWT audience (default: `authenticated`)
- `AUTH_CACHE_TTL_SECONDS` - Auth cache TTL (default: `60`)
- `AUTH_ADMIN_ROLES` - Comma-separated admin roles (default: `admin`)
- `PAYNET_*` - Paynet payment integration variables (optional)
- `FRONTEND_URL` - Frontend URL for CORS
- `BACKEND_URL` - Backend URL for webhooks

If you have a `.env.local` file, copy it to `.env`:
```bash
cp .env.local .env
```

For detailed API documentation, see the [docs](./docs) directory. 
