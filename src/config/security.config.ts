import { registerAs } from '@nestjs/config';

type SecurityConfig = {
  maxTtlSeconds: number;
  allowedClockSkewSeconds: number;
  nonceTtlPaddingSeconds: number;
  canonicalizeTrailingSlash: boolean;
};

export default registerAs<SecurityConfig>('security', () => ({
  maxTtlSeconds: parseInt(process.env.SECURITY_MAX_TTL ?? '300', 10),
  allowedClockSkewSeconds: parseInt(process.env.SECURITY_CLOCK_SKEW ?? '10', 10),
  nonceTtlPaddingSeconds: parseInt(process.env.SECURITY_NONCE_PADDING ?? '5', 10),
  canonicalizeTrailingSlash: (process.env.SECURITY_CANONICALIZE_SLASH ?? 'true').toLowerCase() === 'true'
}));
