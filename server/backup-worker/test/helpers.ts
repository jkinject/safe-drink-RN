import type { FetchJwks, Jwk } from '../src/auth';

export const CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const NOW_MS = Date.UTC(2026, 8, 28, 12, 0, 0);
export const NOW_SEC = Math.floor(NOW_MS / 1000);

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export interface TestKey {
  kid: string;
  privateKey: CryptoKey;
  jwk: Jwk;
}

// 실제 Google 과 같은 RS256 키를 로컬에서 만들어 토큰을 직접 서명한다.
export async function makeKey(kid: string): Promise<TestKey> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const exported = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  // Google JWKS 와 같은 모양(use/alg/kid 포함)으로 만든다.
  return { kid, privateKey: pair.privateKey, jwk: { ...exported, kid, use: 'sig', alg: 'RS256' } };
}

export function baseClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'user-sub-1',
    email: 'user@example.com',
    iat: NOW_SEC - 10,
    exp: NOW_SEC + 3600,
    ...overrides,
  };
}

export async function signToken(
  key: TestKey,
  claims: Record<string, unknown>,
  header: Record<string, unknown> = {},
): Promise<string> {
  const head = jsonToBase64Url({ alg: 'RS256', typ: 'JWT', kid: key.kid, ...header });
  const body = jsonToBase64Url(claims);
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key.privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

// 호출 기록이 남는 JWKS 스텁. stale 은 캐시가 들고 있는 (회전 전) 목록을 흉내 낸다.
export function stubJwks(fresh: Jwk[], stale: Jwk[] = fresh): FetchJwks & { calls: boolean[] } {
  const calls: boolean[] = [];
  const fn = async (forceRefresh: boolean) => {
    calls.push(forceRefresh);
    return forceRefresh ? fresh : stale;
  };
  return Object.assign(fn, { calls });
}

interface Row {
  user_sub: string;
  email: string | null;
  schema_version: number;
  updated_at: number;
  payload: string;
}

// handler 가 쓰는 세 가지 쿼리(SELECT/UPSERT/DELETE)만 흉내 내는 인메모리 D1.
export function memoryD1(): { db: D1Database; rows: Map<string, Row> } {
  const rows = new Map<string, Row>();
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async first<T>(): Promise<T | null> {
          if (!/^\s*SELECT/i.test(sql)) throw new Error(`unexpected first(): ${sql}`);
          const row = rows.get(args[0] as string);
          return row ? ({ ...row } as T) : null;
        },
        async run() {
          if (/^\s*INSERT/i.test(sql)) {
            if (!/ON CONFLICT\(user_sub\) DO UPDATE/i.test(sql)) throw new Error('upsert expected');
            const [user_sub, email, schema_version, updated_at, payload] = args as [
              string,
              string | null,
              number,
              number,
              string,
            ];
            rows.set(user_sub, { user_sub, email, schema_version, updated_at, payload });
          } else if (/^\s*DELETE/i.test(sql)) {
            rows.delete(args[0] as string);
          } else {
            throw new Error(`unexpected run(): ${sql}`);
          }
          return { success: true, meta: {}, results: [] };
        },
      };
      return stmt;
    },
  };
  return { db: db as unknown as D1Database, rows };
}
