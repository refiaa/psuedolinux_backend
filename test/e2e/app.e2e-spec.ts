import { randomBytes } from 'crypto';

import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { base64UrlEncode, base64UrlDecode } from '../../src/common/crypto/base64url.util';
import { CryptoService } from '../../src/common/crypto/crypto.service';
import { HmacService } from '../../src/common/crypto/hmac.service';
import { KeyDerivationService } from '../../src/common/crypto/key-derivation.service';
import type { SecureTransportPayload } from '../../src/common/security/secure-request.interface';
import { AWS_SECRETS_MANAGER, AWS_KMS } from '../../src/infra/aws/aws.constants';
import { REDIS_CLIENT } from '../../src/infra/redis/redis.constants';
import { UserEntity } from '../../src/features/users/user.entity';

const MASTER_SECRET = Buffer.alloc(32, 7).toString('base64');

class InMemoryRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();
  status = 'ready';

  async set(key: string, value: string, mode: string, ttlSeconds: number, condition: string): Promise<'OK' | null> {
    if (mode !== 'EX' || condition !== 'NX') {
      throw new Error('Unsupported Redis set options');
    }
    this.cleanup();
    if (this.store.has(key)) {
      return null;
    }
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async quit(): Promise<'OK'> {
    this.status = 'end';
    this.store.clear();
    return 'OK';
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

describe('AppModule e2e', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let hmacService: HmacService;
  let cryptoService: CryptoService;
  let keyDerivationService: KeyDerivationService;
  let user: UserEntity;
  let AppModuleClass: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_GLOBAL_PREFIX = 'api';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_SECRETS_MANAGER_SECRET_ID = 'test';
    process.env.AWS_KMS_KEY_ID = 'test';
    process.env.REDIS_HOST = 'localhost';
    process.env.DB_HOST = 'localhost';
    process.env.DB_USERNAME = 'user';
    process.env.DB_PASSWORD = 'password';
    process.env.DB_DATABASE = 'test';
    process.env.CRYPTO_MASTER_SECRET_OVERRIDE = MASTER_SECRET;

    const imported = await import('../../src/app.module');
    AppModuleClass = imported.AppModule;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModuleClass]
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(new InMemoryRedis())
      .overrideProvider(AWS_SECRETS_MANAGER)
      .useValue({ send: async () => ({ SecretString: JSON.stringify({ versions: { '1': MASTER_SECRET } }) }) })
      .overrideProvider(AWS_KMS)
      .useValue({ send: async () => ({}) })
      .compile();

    app = moduleFixture.createNestApplication();
    const configService = app.get(ConfigService);
    const prefix = configService.get<string>('app.globalPrefix');
    if (prefix) {
      app.setGlobalPrefix(prefix);
    }
    await app.init();

    dataSource = app.get(DataSource);
    hmacService = app.get(HmacService);
    cryptoService = app.get(CryptoService);
    keyDerivationService = app.get(KeyDerivationService);

    const repository = dataSource.getRepository(UserEntity);
    user = await repository.save(
      repository.create({
        displayName: 'Test User',
        email: 'test@example.com',
        avatarUrl: null,
        isActive: true
      })
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return user data with valid signature', async () => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const nonce = base64UrlEncode(randomBytes(12));
    const query = {
      id: user.id,
      fields: ['id', 'displayName', 'email', 'createdAt']
    };
    const dataPayload = {
      p: 1234,
      m: 1,
      o: 0,
      c: 5,
      t: issuedAt,
      x: 120,
      n: nonce,
      wrld: 'wrld_secure',
      q: query
    };
    const rawPayload = base64UrlEncode(Buffer.from(JSON.stringify(dataPayload), 'utf8'));

    const securePayload: SecureTransportPayload = {
      playerId: dataPayload.p,
      isMaster: dataPayload.m === 1,
      isInstanceOwner: dataPayload.o === 1,
      playerCount: dataPayload.c,
      issuedAt: dataPayload.t,
      ttl: dataPayload.x,
      nonce: dataPayload.n,
      worldId: dataPayload.wrld,
      instanceId: undefined,
      query: dataPayload.q
    };

    const derivedKeys = await keyDerivationService.deriveKeySet(1, securePayload.worldId, securePayload.instanceId);
    const canonicalBuffer = cryptoService.buildCanonicalBuffer({
      mode: 'HMAC_ONLY',
      request: { method: 'GET', path: '/api/users' } as any,
      version: 1,
      payload: securePayload,
      rawPayloadBase64: rawPayload
    });
    const signature = hmacService.sign(canonicalBuffer, derivedKeys.hmacKey);

    const response = await request(app.getHttpServer())
      .get('/api/users')
      .query({ v: '1', d: rawPayload, s: signature })
      .expect(200);

    expect(response.body).toHaveProperty('v', 1);
    expect(response.body).toHaveProperty('d');
    expect(response.body).toHaveProperty('s');

    const decoded = JSON.parse(base64UrlDecode(response.body.d).toString('utf8'));
    expect(decoded).toMatchObject({
      id: user.id,
      displayName: 'Test User',
      email: 'test@example.com'
    });
  });

  it('should reject replayed nonce', async () => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const nonce = base64UrlEncode(randomBytes(12));
    const query = { id: user.id, fields: ['id'] };
    const dataPayload = {
      p: 999,
      m: 0,
      o: 0,
      c: 5,
      t: issuedAt,
      x: 30,
      n: nonce,
      wrld: 'wrld_secure',
      q: query
    };
    const rawPayload = base64UrlEncode(Buffer.from(JSON.stringify(dataPayload), 'utf8'));
    const securePayload: SecureTransportPayload = {
      playerId: dataPayload.p,
      isMaster: false,
      isInstanceOwner: false,
      playerCount: dataPayload.c,
      issuedAt: dataPayload.t,
      ttl: dataPayload.x,
      nonce: dataPayload.n,
      worldId: dataPayload.wrld,
      instanceId: undefined,
      query: dataPayload.q
    };
    const derivedKeys = await keyDerivationService.deriveKeySet(1, securePayload.worldId, securePayload.instanceId);
    const canonicalBuffer = cryptoService.buildCanonicalBuffer({
      mode: 'HMAC_ONLY',
      request: { method: 'GET', path: '/api/users' } as any,
      version: 1,
      payload: securePayload,
      rawPayloadBase64: rawPayload
    });
    const signature = hmacService.sign(canonicalBuffer, derivedKeys.hmacKey);

    await request(app.getHttpServer())
      .get('/api/users')
      .query({ v: '1', d: rawPayload, s: signature })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/users')
      .query({ v: '1', d: rawPayload, s: signature })
      .expect(409);
  });
});
