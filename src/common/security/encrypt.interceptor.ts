import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AeadService } from '../crypto/aead.service';
import { base64UrlEncode } from '../crypto/base64url.util';
import { CryptoService } from '../crypto/crypto.service';
import { HmacService } from '../crypto/hmac.service';
import type { SecureRequestState } from './secure-request.interface';

@Injectable()
export class EncryptInterceptor implements NestInterceptor {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly hmacService: HmacService,
    private readonly aeadService: AeadService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const secureContext = request.secureContext;

    if (!secureContext) {
      return next.handle();
    }

    return next.handle().pipe(
      map((body) => this.transformBody(body, request, response, secureContext))
    );
  }

  private transformBody(body: unknown, request: Request, response: Response, state: SecureRequestState): unknown {
    if (state.mode === 'HMAC_ONLY') {
      return this.buildHmacOnlyResponse(body, request, response, state);
    }
    return this.buildEncryptedResponse(body, request, response, state);
  }

  private buildHmacOnlyResponse(body: unknown, request: Request, response: Response, state: SecureRequestState): unknown {
    const json = JSON.stringify(body ?? null);
    const payloadBase64 = base64UrlEncode(Buffer.from(json, 'utf8'));
    const signatureBuffer = this.cryptoService.buildResponseCanonical('HMAC_ONLY', request, response.statusCode, state.version, [payloadBase64]);
    const signature = this.hmacService.sign(signatureBuffer, state.derivedKeys.hmacKey);
    return {
      v: state.version,
      d: payloadBase64,
      s: signature
    };
  }

  private buildEncryptedResponse(body: unknown, request: Request, response: Response, state: SecureRequestState): unknown {
    const json = JSON.stringify(body ?? null);
    const associatedData = this.cryptoService.buildResponseAssociatedData(request, response.statusCode, state.version);
    const encrypted = this.aeadService.encrypt({
      plaintext: Buffer.from(json, 'utf8'),
      associatedData,
      key: state.derivedKeys.aeadKey
    });

    const ciphertext = base64UrlEncode(encrypted.ciphertext);
    const iv = base64UrlEncode(encrypted.iv);
    const tag = base64UrlEncode(encrypted.authTag);

    const signatureBuffer = this.cryptoService.buildResponseCanonical('AEAD', request, response.statusCode, state.version, [ciphertext, iv, tag]);
    const signature = this.hmacService.sign(signatureBuffer, state.derivedKeys.hmacKey);

    return {
      v: state.version,
      c: ciphertext,
      iv,
      tag,
      s: signature
    };
  }
}
