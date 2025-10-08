import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

type RedisConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tlsEnabled: boolean;
  keyPrefix: string;
};

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const config = configService.get<RedisConfig>('redis');
    if (!config) {
      throw new Error('Redis configuration is missing');
    }

    const options: RedisOptions = {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      keyPrefix: `${config.keyPrefix}:`,
      tls: config.tlsEnabled ? {} : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true
    };

    const client = new Redis(options);

    client.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('Redis connection error', error);
    });

    return client;
  }
};
