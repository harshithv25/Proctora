const { z } = require('zod');
require('dotenv').config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // 32 bytes expressed as 64 hex chars
  AES_ENCRYPTION_KEY: z.string().length(64),
  CSRF_SECRET: z.string().min(32),
  TOTP_ISSUER: z.string().default('Proctora-NITK'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ [Config] Invalid or missing environment variables:');
  console.error(parsed.error.format());
  // Provide safe dev-only defaults so local runs don't crash without a .env,
  // but log a loud warning so nobody ships this to production.
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // hard exit in prod — no silent insecure defaults
  }

  console.warn('⚠️  [Config] Using insecure dev-only fallback secrets. Do NOT use in production.');
  const devDefaults = {
    NODE_ENV: 'development',
    PORT: 3000,
    JWT_ACCESS_SECRET: 'dev_only_access_secret_do_not_use_in_prod_12345678',
    JWT_REFRESH_SECRET: 'dev_only_refresh_secret_do_not_use_in_prod_1234567',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    AES_ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
    CSRF_SECRET: 'dev_only_csrf_secret_do_not_use_in_prod_1234567890',
    TOTP_ISSUER: 'Proctora-NITK',
  };
  module.exports = { env: devDefaults };
} else {
  module.exports = { env: parsed.data };
}
