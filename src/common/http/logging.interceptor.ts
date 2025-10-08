import { Injectable, Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(`${request.method} ${request.originalUrl ?? request.url} ${request.ip} ${duration}ms`);
        },
        error: (error: unknown) => {
          const duration = Date.now() - start;
          this.logger.error(
            `${request.method} ${request.originalUrl ?? request.url} ${request.ip} ${duration}ms error`,
            (error as Error)?.stack ?? String(error)
          );
        }
      })
    );
  }
}
