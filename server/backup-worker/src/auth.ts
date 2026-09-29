// Google·Apple ID 토큰(RS256) 검증. 외부 JWT 라이브러리 없이 WebCrypto 만 쓴다 —
// Workers 무료 플랜은 호출당 CPU 10ms 라 번들·파싱 비용을 최소로 유지해야 한다.

export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
export const APPLE_ISSUER = 'https://appleid.apple.com';

// APPLE_BUNDLE_ID 가 비어 있을 때 쓰는 앱 번들 ID(Apple identity token 의 aud)
export const DEFAULT_APPLE_BUNDLE_ID = 'com.safedrink.app';

// exp 비교 때 허용하는 기기·서버 시계 차이
const CLOCK_SKEW_SEC = 60;

export type Jwk = JsonWebKey & { kid?: string };

// forceRefresh=true 는 "캐시 무시하고 Google 에서 다시 받아 와라". 키 회전 직후 kid 미스 대응용.
export type FetchJwks = (forceRefresh: boolean) => Promise<Jwk[]>;

// 발급자가 준 sub 그대로(사용자 키 변환 전)와 표시용 email
export interface IdTokenClaims {
  sub: string;
  email: string | null;
}

export interface VerifyOptions {
  clientIds: string[];
  fetchJwks: FetchJwks;
  /** 테스트에서 시각을 고정하려고 주입. 기본 Date.now() */
  now?: () => number;
}

export interface AppleVerifyOptions {
  /** 허용할 aud(앱 번들 ID). parseAppleBundleIds(env.APPLE_BUNDLE_ID) */
  bundleIds: string[];
  fetchJwks: FetchJwks;
  now?: () => number;
}

interface IssuerRule {
  issuers: string[];
  audiences: string[];
  fetchJwks: FetchJwks;
  now?: () => number;
}

// 토큰 자체가 잘못된 경우. JWKS 를 못 받아 온 것(네트워크)과 구분해야
// 앱이 "다시 로그인" 과 "잠시 후 재시도" 를 가를 수 있다.
export class AuthError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AuthError';
  }
}

export function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function decodeJsonPart(part: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
  } catch {
    throw new AuthError('malformed');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AuthError('malformed');
  }
  return parsed as Record<string, unknown>;
}

// 서명 확인 전에 헤더 alg 와 payload iss 만 엿본다 — 어느 검증기로 보낼지 고르는 용도.
// 여기서 읽은 값은 아직 믿을 수 없으므로 라우팅에만 쓰고, 판정은 각 검증기가 서명 확인 후 다시 한다.
export function peekToken(token: string): { alg: unknown; iss: unknown } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('malformed');
  return { alg: decodeJsonPart(parts[0]).alg, iss: decodeJsonPart(parts[1]).iss };
}

export function verifyGoogleIdToken(token: string, opts: VerifyOptions): Promise<IdTokenClaims> {
  return verifyRs256IdToken(token, {
    issuers: GOOGLE_ISSUERS,
    audiences: opts.clientIds,
    fetchJwks: opts.fetchJwks,
    now: opts.now,
  });
}

// Apple identity token(Sign in with Apple). 수명이 10분이라 앱은 이걸로 /auth/session 을 불러
// 서버 세션 토큰으로 바꿔 쓴다. email 은 첫 로그인에만 오거나 private relay 주소일 수 있어 표시용일 뿐이다.
// email_verified 는 문자열 "true" 로 오기도 하지만 email 을 식별에 쓰지 않으므로 판정에 쓰지 않는다.
export function verifyAppleIdToken(token: string, opts: AppleVerifyOptions): Promise<IdTokenClaims> {
  return verifyRs256IdToken(token, {
    issuers: [APPLE_ISSUER],
    audiences: opts.bundleIds,
    fetchJwks: opts.fetchJwks,
    now: opts.now,
  });
}

async function verifyRs256IdToken(token: string, opts: IssuerRule): Promise<IdTokenClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('malformed');
  const [headerPart, payloadPart, sigPart] = parts;

  const header = decodeJsonPart(headerPart);
  // alg 를 토큰이 고르게 두면 'none'·HS256 치환 공격이 가능하므로 RS256 만 받는다.
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new AuthError('bad-header');
  const kid = header.kid;

  let keys = await opts.fetchJwks(false);
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    // Google·Apple 은 키를 주기적으로 회전한다. 캐시가 회전 전 목록이면 한 번만 새로 받는다
    // (위조 kid 로 무한 재조회하지 않도록 1회로 제한).
    keys = await opts.fetchJwks(true);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk || jwk.kty !== 'RSA' || !jwk.n || !jwk.e) throw new AuthError('unknown-kid');

  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlToBytes(sigPart);
  } catch {
    throw new AuthError('malformed');
  }

  // JWK 의 use/key_ops 가 importKey 용도와 어긋나면 예외가 나므로 필요한 필드만 넘긴다.
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) throw new AuthError('bad-signature');

  // 서명이 맞은 뒤에야 클레임을 믿는다.
  const claims = decodeJsonPart(payloadPart);

  if (typeof claims.iss !== 'string' || !opts.issuers.includes(claims.iss)) {
    throw new AuthError('bad-iss');
  }

  // aud 는 보통 문자열이지만 JWT 표준상 배열일 수도 있다.
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.some((a) => typeof a === 'string' && opts.audiences.includes(a))) {
    throw new AuthError('bad-aud');
  }

  const nowSec = Math.floor((opts.now ?? Date.now)() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SEC <= nowSec) {
    throw new AuthError('expired');
  }

  if (typeof claims.sub !== 'string' || claims.sub === '') throw new AuthError('no-sub');

  return { sub: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
}

// env.GOOGLE_CLIENT_ID 는 "웹ID,안드로이드ID" 처럼 쉼표로 여러 개를 받는다.
// 비어 있으면 빈 배열 → 모든 토큰이 aud 불일치로 거부된다(설정 누락 시 열리지 않고 닫힌다).
export function parseClientIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

// env.APPLE_BUNDLE_ID 도 쉼표로 여러 개. 비어 있으면(미설정) 기본 번들 ID 하나.
export function parseAppleBundleIds(raw: string | undefined): string[] {
  const ids = parseClientIds(raw);
  return ids.length > 0 ? ids : [DEFAULT_APPLE_BUNDLE_ID];
}
