import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

import { base64UrlDecode, base64UrlEncode } from './base64url.util';

type CryptoConfig = {
  hmacAlgorithm: string;
};

@Injectable()
export class HmacService {
  constructor(private readonly configService: ConfigService) {}

  sign(data: Buffer, key: Buffer): string {
    const algorithm = this.getAlgorithm();
    const hmac = createHmac(algorithm, key).update(data);
    return base64UrlEncode(hmac.digest());
  }

  verify(data: Buffer, signature: string, key: Buffer): boolean {
    const algorithm = this.getAlgorithm();
    const hmac = createHmac(algorithm, key).update(data).digest();
    const expected = base64UrlDecode(signature);
    if (expected.length !== hmac.length) {
      return false;
    }
    return timingSafeEqual(hmac, expected);
  }

  private getAlgorithm(): string {
    const config = this.configService.get<CryptoConfig>('crypto');
    if (!config) {
      throw new Error('Crypto configuration is missing');
    }
    return config.hmacAlgorithm;
  }
}
