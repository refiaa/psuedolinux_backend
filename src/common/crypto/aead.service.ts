import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';
import type { CipherGCM, DecipherGCM } from 'crypto';

interface EncryptParams {
  plaintext: Buffer;
  key: Buffer;
  associatedData: Buffer;
}

interface DecryptParams {
  ciphertext: Buffer;
  key: Buffer;
  associatedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

type CryptoConfig = {
  aeadAlgorithm: string;
};

@Injectable()
export class AeadService {
  private readonly logger = new Logger(AeadService.name);

  constructor(private readonly configService: ConfigService) {}

  encrypt({ plaintext, key, associatedData }: EncryptParams): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
    const iv = randomBytes(12);
    const algorithm = this.getAlgorithm(key);
    const cipher = createCipheriv(algorithm, key, iv) as CipherGCM;
    cipher.setAAD(associatedData);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag };
  }

  decrypt({ ciphertext, key, associatedData, iv, authTag }: DecryptParams): Buffer {
    const algorithm = this.getAlgorithm(key);
    const decipher = createDecipheriv(algorithm, key, iv) as DecipherGCM;
    decipher.setAAD(associatedData);
    decipher.setAuthTag(authTag);
    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (error) {
      this.logger.warn('AEAD decryption failed', error as Error);
      throw new Error('Unable to decrypt payload');
    }
  }

  private getAlgorithm(key: Buffer): string {
    if (key.length !== 32) {
      throw new Error(`AEAD key must be 32 bytes. length=${key.length}`);
    }
    const config = this.configService.get<CryptoConfig>('crypto');
    if (!config) {
      throw new Error('Crypto configuration is missing');
    }
    if (config.aeadAlgorithm !== 'aes-256-gcm') {
      throw new Error(`Unsupported AEAD algorithm: ${config.aeadAlgorithm}`);
    }
    return 'aes-256-gcm';
  }
}
