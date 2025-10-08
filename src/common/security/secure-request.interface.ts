import type { DerivedKeySet } from '../crypto/key-derivation.service';

export type EncryptionMode = 'HMAC_ONLY' | 'AEAD';

export interface SecureTransportPayload {
  playerId: number;
  isMaster: boolean;
  isInstanceOwner: boolean;
  playerCount: number;
  issuedAt: number;
  ttl: number;
  nonce: string;
  worldId: string;
  instanceId?: string;
  query: unknown;
}

export interface AeadTransportComponents {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface SecureRequestState {
  version: number;
  mode: EncryptionMode;
  payload: SecureTransportPayload;
  derivedKeys: DerivedKeySet;
  rawPayloadBase64?: string;
  aeadComponents?: AeadTransportComponents;
}

declare module 'express-serve-static-core' {
  interface Request {
    secureContext?: SecureRequestState;
  }
}
