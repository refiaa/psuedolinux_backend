import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TypeOrmModule } from '@nestjs/typeorm';

import appConfig from './config/app.config';
import awsConfig from './config/aws.config';
import cryptoConfig from './config/crypto.config';
import databaseConfig from './config/database.config';
import type { DatabaseConfig } from './config/database.config';
import redisConfig from './config/redis.config';
import securityConfig from './config/security.config';
import { validateEnv } from './config/validation';
import { CryptoModule } from './common/crypto/crypto.module';
import { AntiReplayModule } from './common/security/anti-replay.module';
import { VerifySignatureGuard } from './common/security/verify-signature.guard';
import { DecryptInterceptor } from './common/security/decrypt.interceptor';
import { EncryptInterceptor } from './common/security/encrypt.interceptor';
import { UsersModule } from './features/users/users.module';
import { AwsModule } from './infra/aws/aws.module';
import { RedisModule } from './infra/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig, awsConfig, cryptoConfig, databaseConfig, redisConfig, securityConfig]
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' }
              }
            : undefined,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          remove: true
        },
        autoLogging: false
      }
    }),
    RedisModule,
    AwsModule,
    CryptoModule,
    AntiReplayModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('app.environment');
        if (env === 'test') {
          return {
            type: 'sqlite',
            database: ':memory:',
            dropSchema: true,
            entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'],
            synchronize: true,
            autoLoadEntities: true,
            logging: false
          };
        }

        const database = configService.get<DatabaseConfig>('database');
        if (!database) {
          throw new Error('Database configuration is missing');
        }
        return {
          type: 'postgres',
          host: database.host,
          port: database.port,
          username: database.username,
          password: database.password,
          database: database.database,
          ssl: database.ssl,
          synchronize: false,
          migrationsRun: true,
          autoLoadEntities: true,
          logging: process.env.NODE_ENV !== 'production'
        };
      }
    }),
    UsersModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: VerifySignatureGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DecryptInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: EncryptInterceptor
    }
  ]
})
export class AppModule {}
