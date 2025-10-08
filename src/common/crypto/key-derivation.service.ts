import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hkdfSync, createHash } from 'crypto';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import { AWS_SECRETS_MANAGER } from '../../infra/aws/aws.constants';

type CryptoConfig = {
  keyDerivationInfoHmac: string;
  keyDerivationInfoAead: string;
  allowedRequestVersion: number[];
  keyRotationGraceSeconds: number;
};

type AwsConfig = {
  secretsManagerSecretId: string;
  kmsKeyId: string;
};

type SecretsManagerPayload = {
  versions: Record<string, string>;
};

export interface DerivedKeySet {
  hmacKey: Buffer;
  aeadKey: Buffer;
}

interface CachedKeySet {
  value: DerivedKeySet;
  expiresAt: number;
}

@Injectable()
export class KeyDerivationService {
  private readonly logger = new Logger(KeyDerivationService.name);
  private readonly keyCache = new Map<string, CachedKeySet>();
  private secretsPayload?: SecretsManagerPayload;
  private secretsPayloadExpiresAt = 0;

  constructor(
    private readonly configService: ConfigService,
    @Inject(AWS_SECRETS_MANAGER) private readonly secretsManager: SecretsManagerClient
  ) {}

  async deriveKeySet(version: number, worldId: string, internalId?: string): Promise<DerivedKeySet> {
    const cryptoConfig = this.configService.get<CryptoConfig>('crypto');
    if (!cryptoConfig) {
      throw new Error('Crypto configuration is missing');
    }
    if (!cryptoConfig.allowedRequestVersion.includes(version)) {
      throw new UnauthorizedException(`Requested crypto version is not allowed: ${version}`);
    }

    const cacheKey = `${version}:${worldId}:${internalId ?? 'global'}`;
    const cached = this.keyCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const rootSecret = await this.resolveRootSecret(version);
    const salt = createHash('sha256')
      .update(worldId, 'utf8')
      .update(internalId ?? 'global', 'utf8')
      .digest();
    const ikm = Buffer.concat([rootSecret, Buffer.from(worldId, 'utf8'), Buffer.from(internalId ?? 'global', 'utf8')]);

    const hmacKey = Buffer.from(hkdfSync('sha256', ikm, salt, cryptoConfig.keyDerivationInfoHmac, 32));
    const aeadKey = Buffer.from(hkdfSync('sha256', ikm, salt, cryptoConfig.keyDerivationInfoAead, 32));

    const derived: DerivedKeySet = { hmacKey, aeadKey };
    this.keyCache.set(cacheKey, {
      value: derived,
      expiresAt: Date.now() + cryptoConfig.keyRotationGraceSeconds * 1000
    });
    return derived;
  }

  private async resolveRootSecret(version: number): Promise<Buffer> {
    const override = process.env.CRYPTO_MASTER_SECRET_OVERRIDE;
    if (override) {
      return this.decodeSecretString(override.trim(), version);
    }

    if (!this.secretsPayload || Date.now() > this.secretsPayloadExpiresAt) {
      await this.fetchSecretsPayload();
    }

    const payload = this.secretsPayload;
    if (!payload?.versions) {
      throw new Error('Secrets Manager payload is missing the versions map');
    }

    const record = payload.versions[String(version)];
    if (!record) {
      throw new Error(`Secret version ${version} was not found`);
    }

    return this.decodeSecretString(record, version);
  }

  private async fetchSecretsPayload(): Promise<void> {
    const awsConfig = this.configService.get<AwsConfig>('aws');
    if (!awsConfig) {
      throw new Error('AWS configuration is missing');
    }

    const command = new GetSecretValueCommand({
      SecretId: awsConfig.secretsManagerSecretId
    });
    const response = await this.secretsManager.send(command);
    let secretString: string | undefined;

    if (response.SecretString) {
      secretString = response.SecretString;
    } else if (response.SecretBinary) {
      secretString = Buffer.from(response.SecretBinary as Uint8Array).toString('utf8');
    }

    if (!secretString) {
      throw new Error('Secret payload is empty');
    }

    try {
      const parsed = JSON.parse(secretString) as SecretsManagerPayload;
      if (!parsed.versions || typeof parsed.versions !== 'object') {
        throw new Error('versions field is missing or invalid');
      }
      this.secretsPayload = parsed;
      this.secretsPayloadExpiresAt = Date.now() + this.resolveSecretsCacheTtl();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to parse Secrets Manager payload: ${err.message}`);
      throw new Error('Secrets Manager payload validation failed');
    }
  }

  private resolveSecretsCacheTtl(): number {
    const cryptoConfig = this.configService.get<CryptoConfig>('crypto');
    if (!cryptoConfig) {
      throw new Error('Crypto configuration is missing');
    }
    const capped = Math.min(cryptoConfig.keyRotationGraceSeconds, 3600);
    const ttlSeconds = Math.max(capped, 60);
    return ttlSeconds * 1000;
  }

  private decodeSecretString(value: string, version: number): Buffer {
    try {
      const decoded = Buffer.from(value, 'base64');
      if (decoded.length < 32) {
        throw new Error('Decoded secret must be at least 32 bytes');
      }
      return decoded;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to decode secret (version=${version}): ${err.message}`);
      throw new Error(`Secret decode failed for version: ${version}`);
    }
  }
}
