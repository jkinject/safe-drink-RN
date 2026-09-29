// 서버 세션 토큰(HS256 JWT). Apple identity token 은 10분짜리이고 기기에서 조용히 갱신할 API 가 없어,
// /auth/session 에서 공급자 토큰을 한 번 검증한 뒤 이 토큰으로 이후 요청을 인증한다.
// WebCrypto HMAC 만 쓴다(외부 JWT 라이브러리 없음).
import { AuthError, base64UrlToBytes, decodeJsonPart } from './auth';

export type Provider = 'google' | 'apple';

// 180일. 앱이 쓰는 동안 만료되면 앱은 공급자 로그인을 다시 거쳐 새로 받는다.
export const SESSION_TTL_SEC = 180 * 24 * 60 * 60;

export interface SessionClaims {
  /** 사용자 키(Google 은 sub 그대로, Apple 은 "apple:<sub>") */
  sub: string;
  email: string | null;
  provider: Provider;
  iat: number;
  exp: number;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

export async function issueSessionToken(
  user: { sub: string; email: string | null; provider: Provider },
  secret: string,
  nowMs: number,
): Promise<{ token: string; expiresAt: number }> {
  if (!secret) throw new Error('session-secret-missing');
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + SESSION_TTL_SEC;
  const claims: SessionClaims = { sub: user.sub, email: user.email, provider: user.provider, iat, exp };
  const signingInput = `${jsonToBase64Url({ alg: 'HS256', typ: 'JWT' })}.${jsonToBase64Url(claims)}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(signingInput));
  return { token: `${signingInput}.${bytesToBase64Url(new Uint8Array(sig))}`, expiresAt: exp * 1000 };
}

export async function verifySessionToken(token: string, secret: string, nowMs: number): Promise<SessionClaims> {
  // 비밀키가 없는 건 토큰 문제가 아니라 서버 설정 문제 — AuthError(401) 가 아닌 예외로 올려 503 으로 낸다.
  if (!secret) throw new Error('session-secret-missing');
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('malformed');
  const [headerPart, payloadPart, sigPart] = parts;

  // alg 를 토큰이 고르게 두지 않는다 — HS256 만.
  if (decodeJsonPart(headerPart).alg !== 'HS256') throw new AuthError('bad-header');

  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlToBytes(sigPart);
  } catch {
    throw new AuthError('malformed');
  }
  // crypto.subtle.verify 는 상수 시간 비교다(문자열 비교로 서명을 맞춰 보지 않는다).
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret, 'verify'),
    signature,
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) throw new AuthError('bad-signature');

  const c = decodeJsonPart(payloadPart);
  if (typeof c.exp !== 'number' || c.exp <= Math.floor(nowMs / 1000)) throw new AuthError('expired');
  if (typeof c.sub !== 'string' || c.sub === '') throw new AuthError('no-sub');
  if (c.provider !== 'google' && c.provider !== 'apple') throw new AuthError('bad-provider');
  return {
    sub: c.sub,
    email: typeof c.email === 'string' ? c.email : null,
    provider: c.provider,
    iat: typeof c.iat === 'number' ? c.iat : 0,
    exp: c.exp,
  };
}
