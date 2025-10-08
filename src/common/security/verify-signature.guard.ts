import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { z } from 'zod';

import { CryptoService } from '../crypto/crypto.service';
import { HmacService } from '../crypto/hmac.service';
import { KeyDerivationService } from '../crypto/key-derivation.service';
import { AntiReplayService } from './anti-replay.service';
import type { SecureRequestState } from './secure-request.interface';

const base64urlRegex = /^[A-Za-z0-9_-]+$/;

const MAX_NONCE_LENGTH = 256;
const MAX_WORLD_ID_LENGTH = 128;
const MAX_INSTANCE_ID_LENGTH = 128;
const MAX_CIPHERTEXT_LENGTH = 4096;
const MAX_IV_LENGTH = 128;
const MAX_TAG_LENGTH = 128;

const plainPayloadSchema = z.object({
  p: z.number({ invalid_type_error: 'p must be a number' }).nonnegative(),
  m: z.union([z.literal(0), z.literal(1)]),
  o: z.union([z.literal(0), z.literal(1)]),
  c: z.number({ invalid_type_error: 'c must be a number' }).positive(),
  t: z.number({ invalid_type_error: 't must be a number' }).int().positive(),
  x: z.number({ invalid_type_error: 'x must be a number' }).int().positive(),
  n: z
    .string()
    .max(MAX_NONCE_LENGTH, 'nonce is too long')
    .regex(base64urlRegex, 'nonce must be base64url encoded'),
  wrld: z.string().min(1).max(MAX_WORLD_ID_LENGTH, 'worldId is too long'),
  iid: z
    .string()
    .min(1)
    .max(MAX_INSTANCE_ID_LENGTH, 'instanceId is too long')
    .optional(),
  q: z.unknown()
});

const encryptedMetadataSchema = z.object({
  p: z.string().regex(/^\d+$/).transform(Number),
  m: z.union([z.literal('0'), z.literal('1')]),
  o: z.union([z.literal('0'), z.literal('1')]),
  pc: z.string().regex(/^\d+$/).transform(Number),
  t: z.string().regex(/^\d+$/).transform(Number),
  x: z.string().regex(/^\d+$/).transform(Number),
  n: z
    .string()
    .max(MAX_NONCE_LENGTH, 'nonce is too long')
    .regex(base64urlRegex),
  wrld: z.string().min(1).max(MAX_WORLD_ID_LENGTH, 'worldId is too long'),
  iid: z
    .string()
    .min(1)
    .max(MAX_INSTANCE_ID_LENGTH, 'instanceId is too long')
    .optional(),
  c: z
    .string()
    .max(MAX_CIPHERTEXT_LENGTH, 'ciphertext is too long')
    .regex(base64urlRegex),
  iv: z
    .string()
    .max(MAX_IV_LENGTH, 'iv is too long')
    .regex(base64urlRegex),
  tag: z
    .string()
    .max(MAX_TAG_LENGTH, 'tag is too long')
    .regex(base64urlRegex)
});

type SecurityConfig = {
  maxTtlSeconds: number;
  allowedClockSkewSeconds: number;
  canonicalizeTrailingSlash: boolean;
};

@Injectable()
export class VerifySignatureGuard implements CanActivate {
  constructor(
    private readonly keyDerivationService: KeyDerivationService,
    private readonly hmacService: HmacService,
    private readonly antiReplayService: AntiReplayService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const version = this.parseIntegerParam(request, 'v');
    const signature = this.getSingleParam(request, 's');

    const hasData = typeof request.query.d === 'string';
    const hasCipher = typeof request.query.c === 'string';

    if ((hasData ? 1 : 0) + (hasCipher ? 1 : 0) !== 1) {
      throw new BadRequestException('Exactly one of d or c must be provided');
    }

    let secureState: SecureRequestState;

    if (hasData) {
      secureState = await this.handlePlainRequest(request, version, signature);
    } else {
      secureState = await this.handleEncryptedRequest(request, version, signature);
    }

    request.secureContext = secureState;
    await this.performReplayPrevention(secureState);
    return true;
  }

  private async handlePlainRequest(request: Request, version: number, signature: string): Promise<SecureRequestState> {
    const rawPayload = this.getSingleParam(request, 'd');
    const payloadBuffer = this.decodeBase64url(rawPayload, 'd');

    let parsedPayload: z.infer<typeof plainPayloadSchema>;
    try {
      parsedPayload = plainPayloadSchema.parse(JSON.parse(payloadBuffer.toString('utf8')));
    } catch (error) {
      throw new BadRequestException(`Failed to parse JSON payload: ${(error as Error).message}`);
    }

    const secureState = await this.buildSecureState({
      mode: 'HMAC_ONLY',
      version,
      signature,
      rawPayloadBase64: rawPayload,
      payload: {
        playerId: parsedPayload.p,
        isMaster: parsedPayload.m === 1,
        isInstanceOwner: parsedPayload.o === 1,
        playerCount: parsedPayload.c,
        issuedAt: parsedPayload.t,
        ttl: parsedPayload.x,
        nonce: parsedPayload.n,
        worldId: parsedPayload.wrld,
        instanceId: parsedPayload.iid,
        query: parsedPayload.q
      },
      components: undefined,
      request
    });

    return secureState;
  }

  private async handleEncryptedRequest(request: Request, version: number, signature: string): Promise<SecureRequestState> {
    const metadataResult = encryptedMetadataSchema.safeParse({
      p: this.getSingleParam(request, 'p'),
      m: this.getSingleParam(request, 'm'),
      o: this.getSingleParam(request, 'o'),
      pc: this.getSingleParam(request, 'pc'),
      t: this.getSingleParam(request, 't'),
      x: this.getSingleParam(request, 'x'),
      n: this.getSingleParam(request, 'n'),
      wrld: this.getSingleParam(request, 'wrld'),
      iid: this.getOptionalParam(request, 'iid'),
      c: this.getSingleParam(request, 'c'),
      iv: this.getSingleParam(request, 'iv'),
      tag: this.getSingleParam(request, 'tag')
    });

    if (!metadataResult.success) {
      throw new BadRequestException(`Invalid encrypted metadata: ${metadataResult.error.message}`);
    }

    const metadata = metadataResult.data;
    const secureState = await this.buildSecureState({
      mode: 'AEAD',
      version,
      signature,
      payload: {
        playerId: metadata.p,
        isMaster: metadata.m === '1',
        isInstanceOwner: metadata.o === '1',
        playerCount: metadata.pc,
        issuedAt: metadata.t,
        ttl: metadata.x,
        nonce: metadata.n,
        worldId: metadata.wrld,
        instanceId: metadata.iid,
        query: null
      },
      components: {
        ciphertext: metadata.c,
        iv: metadata.iv,
        tag: metadata.tag
      },
      request
    });

    return secureState;
  }

  private async buildSecureState(params: {
    mode: 'HMAC_ONLY' | 'AEAD';
    version: number;
    signature: string;
    rawPayloadBase64?: string;
    payload: SecureRequestState['payload'];
    components?: SecureRequestState['aeadComponents'];
    request: Request;
  }): Promise<SecureRequestState> {
    const { mode, version, signature, rawPayloadBase64, payload, components, request } = params;

    this.assertTimestamps(payload);

    const derivedKeys = await this.keyDerivationService.deriveKeySet(version, payload.worldId, payload.instanceId);

    const canonicalBuffer = this.cryptoService.buildCanonicalBuffer({
      mode,
      request,
      version,
      payload,
      rawPayloadBase64,
      components
    });

    const isValid = this.hmacService.verify(canonicalBuffer, signature, derivedKeys.hmacKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid request signature');
    }

    return {
      mode,
      version,
      payload,
      derivedKeys,
      rawPayloadBase64,
      aeadComponents: components
    };
  }

  private assertTimestamps(payload: SecureRequestState['payload']): void {
    const config = this.configService.get<SecurityConfig>('security');
    if (!config) {
      throw new Error('Security configuration missing');
    }

    if (payload.ttl > config.maxTtlSeconds) {
      throw new BadRequestException('TTL exceeds allowed maximum');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.issuedAt - config.allowedClockSkewSeconds > now) {
      throw new UnauthorizedException('Issued-at timestamp is too far in the future');
    }

    if (payload.issuedAt + payload.ttl + config.allowedClockSkewSeconds < now) {
      throw new UnauthorizedException('Request has expired');
    }
  }

  private async performReplayPrevention(state: SecureRequestState): Promise<void> {
    const config = this.configService.get<SecurityConfig>('security');
    const ttl = state.payload.ttl + (config?.allowedClockSkewSeconds ?? 0);
    await this.antiReplayService.assertNonce(state.payload.nonce, ttl);
  }

  private parseIntegerParam(request: Request, name: string): number {
    const value = this.getSingleParam(request, name);
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`${name} must be a valid integer`);
    }
    return parsed;
  }

  private getSingleParam(request: Request, name: string): string {
    const value = request.query[name];
    if (Array.isArray(value)) {
      throw new BadRequestException(`Multiple values provided for parameter ${name}`);
    }
    if (typeof value !== 'string' || value.length === 0) {
      throw new BadRequestException(`Missing parameter ${name}`);
    }
    return value;
  }

  private getOptionalParam(request: Request, name: string): string | undefined {
    const value = request.query[name];
    if (Array.isArray(value)) {
      throw new BadRequestException(`Multiple values provided for parameter ${name}`);
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    return value;
  }

  private decodeBase64url(value: string, fieldName: string): Buffer {
    try {
      const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
      const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
      return Buffer.from(normalized + padding, 'base64');
    } catch (error) {
      throw new BadRequestException(`Invalid base64url encoding for ${fieldName}: ${(error as Error).message}`);
    }
  }
}
