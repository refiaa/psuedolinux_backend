import { registerAs } from '@nestjs/config';

type CryptoConfig = {
  aeadAlgorithm: 'aes-256-gcm';
  hmacAlgorithm: 'sha256';
  keyDerivationInfoHmac: string;
  keyDerivationInfoAead: string;
  keyRotationGraceSeconds: number;
  allowedRequestVersion: number[];
};

export default registerAs<CryptoConfig>('crypto', () => ({
  aeadAlgorithm: 'aes-256-gcm',
  hmacAlgorithm: 'sha256',
  keyDerivationInfoHmac: process.env.CRYPTO_INFO_HMAC ?? 'v1/hmac',
  keyDerivationInfoAead: process.env.CRYPTO_INFO_AEAD ?? 'v1/aead',
  keyRotationGraceSeconds: parseInt(process.env.CRYPTO_KEY_GRACE ?? '86400', 10),
  allowedRequestVersion: (process.env.CRYPTO_ALLOWED_VERSIONS ?? '1')
    .split(',')
    .map((version) => parseInt(version.trim(), 10))
    .filter((version) => !Number.isNaN(version))
}));
