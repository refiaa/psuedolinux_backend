import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

import { AeadService } from '../crypto/aead.service';
import { base64UrlDecode } from '../crypto/base64url.util';
import { CryptoService } from '../crypto/crypto.service';
import type { SecureRequestState } from './secure-request.interface';

@Injectable()
export class DecryptInterceptor implements NestInterceptor {
  constructor(
    private readonly aeadService: AeadService,
    private readonly cryptoService: CryptoService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const secureContext = request.secureContext;

    if (secureContext && secureContext.mode === 'AEAD') {
      const decrypted = this.decryptPayload(request, secureContext);
      secureContext.payload.query = decrypted;
    }

    return next.handle();
  }

  private decryptPayload(request: Request, state: SecureRequestState): unknown {
    if (!state.aeadComponents) {
      throw new UnauthorizedException('AEAD components are missing');
    }

    const associatedData = this.cryptoService.buildAssociatedData(request, state.version);

    const plaintext = this.aeadService.decrypt({
      ciphertext: base64UrlDecode(state.aeadComponents.ciphertext),
      key: state.derivedKeys.aeadKey,
      associatedData,
      iv: base64UrlDecode(state.aeadComponents.iv),
      authTag: base64UrlDecode(state.aeadComponents.tag)
    });

    try {
      return JSON.parse(plaintext.toString('utf8'));
    } catch (error) {
      throw new UnauthorizedException(`Failed to parse decrypted payload: ${(error as Error).message}`);
    }
  }
}
