import { registerAs } from '@nestjs/config';

type AppConfig = {
  port: number;
  globalPrefix: string;
  bodyLimit: string;
  environment: string;
};

export default registerAs<AppConfig>('app', () => ({
  port: parseInt(process.env.APP_PORT ?? '8080', 10),
  globalPrefix: process.env.APP_GLOBAL_PREFIX ?? 'api',
  bodyLimit: process.env.APP_BODY_LIMIT ?? '10kb',
  environment: process.env.NODE_ENV ?? 'development'
}));
