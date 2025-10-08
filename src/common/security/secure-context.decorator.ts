import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { SecureRequestState } from './secure-request.interface';

export const SecureContext = createParamDecorator((data: keyof SecureRequestState | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const secureContext = request.secureContext;
  if (!secureContext) {
    throw new UnauthorizedException('Secure context is missing');
  }
  if (data) {
    return secureContext[data];
  }
  return secureContext;
});
