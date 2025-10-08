import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { SecureRequestState } from '../security/secure-request.interface';

type SecurityConfig = {
  canonicalizeTrailingSlash: boolean;
};

@Injectable()
export class CryptoService {
  constructor(private readonly configService: ConfigService) {}

  normalizePath(path: string): string {
    const config = this.configService.get<SecurityConfig>('security');
    const base = path || '/';
    if (config?.canonicalizeTrailingSlash === false) {
      return base;
    }
    if (base.length > 1 && base.endsWith('/')) {
      return base.substring(0, base.length - 1);
    }
    return base;
  }

  buildCanonicalBuffer(params: {
    mode: 'HMAC_ONLY' | 'AEAD';
    request: Request;
    version: number;
    payload: SecureRequestState['payload'];
    rawPayloadBase64?: string;
    components?: SecureRequestState['aeadComponents'];
  }): Buffer {
    const { mode, request, version, payload, rawPayloadBase64, components } = params;
    const method = request.method.toUpperCase();
    const normalizedPath = this.normalizePath(request.path);
    const parts = [
      method,
      normalizedPath,
      String(version),
      String(payload.issuedAt),
      String(payload.ttl),
      payload.nonce,
      String(payload.playerId),
      payload.isMaster ? '1' : '0',
      payload.isInstanceOwner ? '1' : '0',
      String(payload.playerCount),
      payload.worldId,
      payload.instanceId ?? '',
      mode
    ];

    if (mode === 'HMAC_ONLY') {
      if (!rawPayloadBase64) {
        throw new BadRequestException('Raw payload is missing');
      }
      parts.push(rawPayloadBase64);
    } else {
      if (!components) {
        throw new BadRequestException('AEAD components are missing');
      }
      parts.push(components.ciphertext, components.iv, components.tag);
    }

    return Buffer.from(parts.join('\n'), 'utf8');
  }

  buildAssociatedData(request: Request, version: number): Buffer {
    return Buffer.from(
      [request.method.toUpperCase(), this.normalizePath(request.path), String(version)].join('\n'),
      'utf8'
    );
  }

  buildResponseAssociatedData(request: Request, statusCode: number, version: number): Buffer {
    return Buffer.from(
      ['RESPONSE', this.normalizePath(request.path), String(version), String(statusCode)].join('\n'),
      'utf8'
    );
  }

  buildResponseCanonical(mode: 'HMAC_ONLY' | 'AEAD', request: Request, statusCode: number, version: number, payload: string[]): Buffer {
    const parts = ['RESPONSE', this.normalizePath(request.path), String(version), String(statusCode), mode, ...payload];
    return Buffer.from(parts.join('\n'), 'utf8');
  }
}
