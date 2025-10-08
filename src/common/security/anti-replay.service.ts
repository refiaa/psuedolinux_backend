import { ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../../infra/redis/redis.constants';

type SecurityConfig = {
  nonceTtlPaddingSeconds: number;
};

@Injectable()
export class AntiReplayService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService
  ) {}

  async assertNonce(nonce: string, ttlSeconds: number): Promise<void> {
    const config = this.configService.get<SecurityConfig>('security');
    if (!config) {
      throw new Error('Security configuration missing');
    }
    const ttlWithPadding = ttlSeconds + config.nonceTtlPaddingSeconds;
    try {
      const key = `nonce:${nonce}`;
      const result = await this.redis.set(key, '1', 'EX', ttlWithPadding, 'NX');
      if (result !== 'OK') {
        throw new ConflictException('Nonce has already been used');
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new ServiceUnavailableException(`Anti-replay check failed: ${(error as Error).message}`);
    }
  }
}
