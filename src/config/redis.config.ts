import { registerAs } from '@nestjs/config';

type RedisConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tlsEnabled: boolean;
  keyPrefix: string;
};

export default registerAs<RedisConfig>('redis', () => ({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  tlsEnabled: (process.env.REDIS_TLS ?? 'false').toLowerCase() === 'true',
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'vrchat'
}));
