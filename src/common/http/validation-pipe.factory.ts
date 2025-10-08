import { ValidationPipe } from '@nestjs/common';

export class ValidationPipeFactory {
  static create(): ValidationPipe {
    return new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      },
      validationError: { target: false }
    });
  }
}
