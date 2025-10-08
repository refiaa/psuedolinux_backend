import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z
    .string()
    .transform((value) => parseInt(value, 10))
    .refine((value) => Number.isInteger(value) && value > 0, 'APP_PORT must be a positive integer')
    .or(z.undefined()),
  APP_GLOBAL_PREFIX: z.string().optional(),
  APP_BODY_LIMIT: z.string().optional(),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_SECRETS_MANAGER_ENDPOINT: z.string().optional(),
  AWS_KMS_ENDPOINT: z.string().optional(),
  AWS_SECRETS_MANAGER_SECRET_ID: z.string().min(1, 'AWS_SECRETS_MANAGER_SECRET_ID is required'),
  AWS_KMS_KEY_ID: z.string().min(1, 'AWS_KMS_KEY_ID is required'),
  CRYPTO_INFO_HMAC: z.string().optional(),
  CRYPTO_INFO_AEAD: z.string().optional(),
  CRYPTO_KEY_GRACE: z.string().optional(),
  CRYPTO_ALLOWED_VERSIONS: z.string().optional(),
  SECURITY_MAX_TTL: z.string().optional(),
  SECURITY_CLOCK_SKEW: z.string().optional(),
  SECURITY_NONCE_PADDING: z.string().optional(),
  SECURITY_CANONICALIZE_SLASH: z.string().optional(),
  REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
  REDIS_PORT: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.string().optional(),
  REDIS_KEY_PREFIX: z.string().optional(),
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.string().optional(),
  DB_USERNAME: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_DATABASE: z.string().optional(),
  DB_SSL: z.string().optional(),
  CRYPTO_MASTER_SECRET_OVERRIDE: z.string().optional()
});

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join(', ');
    throw new Error(`Environment validation failed: ${formatted}`);
  }
  return config;
}
