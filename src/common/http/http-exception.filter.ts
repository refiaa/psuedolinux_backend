import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  traceId: string;
  message: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = randomUUID();

    const { status, message, details } = this.normalizeException(exception);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      method: request.method,
      traceId,
      message,
      details
    };

    this.logger.error(`HTTP ${status} ${request.method} ${request.url} traceId=${traceId}`);

    response.status(status).json(errorResponse);
  }

  private normalizeException(exception: unknown): { status: number; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message = typeof response === 'string' ? response : (response as any).message ?? exception.message;
      return {
        status: exception.getStatus(),
        message,
        details: typeof response === 'object' ? response : undefined
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred'
    };
  }
}
