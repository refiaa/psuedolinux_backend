import 'reflect-metadata';

import compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { LoggingInterceptor } from './common/http/logging.interceptor';
import { ValidationPipeFactory } from './common/http/validation-pipe.factory';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const appLogger = new Logger('App');
  app.useLogger(appLogger);

  const configService = app.get(ConfigService);
  const globalPrefix = configService.get<string>('app.globalPrefix') ?? 'api';
  const port = configService.get<number>('app.port') ?? 8080;
  const bodyLimit = configService.get<string>('app.bodyLimit') ?? '10kb';

  app.setGlobalPrefix(globalPrefix);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' }
  }));
  app.use(compression());
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: false, limit: bodyLimit }));

  app.useGlobalFilters(new HttpExceptionFilter(new Logger('HttpExceptionFilter')));
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(ValidationPipeFactory.create());
  app.enableShutdownHooks();

  await app.listen(port);
  appLogger.log(`Application started on port ${port} with prefix ${globalPrefix}`);
}

bootstrap().catch((error) => {
  bootstrapLogger.error('Fatal bootstrap error', error.stack ?? error);
  process.exitCode = 1;
});
