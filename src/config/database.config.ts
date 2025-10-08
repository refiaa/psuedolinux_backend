import { registerAs } from '@nestjs/config';

export type DatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
};

export default registerAs<DatabaseConfig>('database', () => ({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'vrchat',
  password: process.env.DB_PASSWORD ?? 'vrchat',
  database: process.env.DB_DATABASE ?? 'vrchat',
  ssl: (process.env.DB_SSL ?? 'false').toLowerCase() === 'true'
}));
