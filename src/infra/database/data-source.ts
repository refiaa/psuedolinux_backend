import 'dotenv/config';
import { DataSource } from 'typeorm';

const ssl = (process.env.DB_SSL ?? 'false').toLowerCase() === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'vrchat',
  password: process.env.DB_PASSWORD ?? 'vrchat',
  database: process.env.DB_DATABASE ?? 'vrchat',
  ssl,
  synchronize: false,
  logging: false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations'
});

export default AppDataSource;
