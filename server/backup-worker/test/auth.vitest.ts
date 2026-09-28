import { beforeAll, describe, expect, it } from 'vitest';
import { AuthError, parseClientIds, verifyGoogleIdToken } from '../src/auth';
import { baseClaims, CLIENT_ID, makeKey, NOW_MS, NOW_SEC, signToken, stubJwks, type TestKey } from './helpers';

let key: TestKey;
let otherKey: TestKey;

beforeAll(async () => {
  key = await makeKey('kid-1');
  otherKey = await makeKey('kid-other');
});

function verify(token: string, fetchJwks = stubJwks([key.jwk]), clientIds = [CLIENT_ID]) {
  return verifyGoogleIdToken(token, { clientIds, fetchJwks, now: () => NOW_MS });
}

describe('verifyGoogleIdToken', () => {
  it('유효 토큰은 sub·email 을 돌려준다', async () => {
    const token = await signToken(key, baseClaims());
    await expect(verify(token)).resolves.toEqual({ sub: 'user-sub-1', email: 'user@example.com' });
  });

  it('iss 는 스킴 없는 accounts.google.com 도 허용한다', async () => {
    const token = await signToken(key, baseClaims({ iss: 'accounts.google.com' }));
    await expect(verify(token)).resolves.toMatchObject({ sub: 'user-sub-1' });
  });

  it('email 클레임이 없으면 null', async () => {
    const token = await signToken(key, baseClaims({ email: undefined }));
    await expect(verify(token)).resolves.toEqual({ sub: 'user-sub-1', email: null });
  });

  it('만료 토큰은 거부, 60초 이내 시계 차이는 허용', async () => {
    const expired = await signToken(key, baseClaims({ exp: NOW_SEC - 61 }));
    await expect(verify(expired)).rejects.toThrow(AuthError);
    const withinSkew = await signToken(key, baseClaims({ exp: NOW_SEC - 30 }));
    await expect(verify(withinSkew)).resolves.toMatchObject({ sub: 'user-sub-1' });
  });

  it('aud 불일치는 거부', async () => {
    const token = await signToken(key, baseClaims({ aud: 'someone-else.apps.googleusercontent.com' }));
    await expect(verify(token)).rejects.toThrow('bad-aud');
  });

  it('쉼표로 준 여러 클라이언트 ID 중 하나와 맞으면 통과', async () => {
    const token = await signToken(key, baseClaims({ aud: 'android-client' }));
    const ids = parseClientIds(` ${CLIENT_ID} , android-client `);
    await expect(verify(token, stubJwks([key.jwk]), ids)).resolves.toMatchObject({ sub: 'user-sub-1' });
  });

  it('클라이언트 ID 가 비어 있으면 모두 거부', async () => {
    const token = await signToken(key, baseClaims());
    await expect(verify(token, stubJwks([key.jwk]), parseClientIds(''))).rejects.toThrow('bad-aud');
  });

  it('iss 불일치는 거부', async () => {
    const token = await signToken(key, baseClaims({ iss: 'https://evil.example.com' }));
    await expect(verify(token)).rejects.toThrow('bad-iss');
  });

  it('다른 키로 서명한 위조 토큰(같은 kid)은 거부', async () => {
    const forged = await signToken({ ...otherKey, kid: key.kid }, baseClaims());
    await expect(verify(forged)).rejects.toThrow('bad-signature');
  });

  it('서명 후 클레임을 바꾼 토큰은 거부', async () => {
    const token = await signToken(key, baseClaims());
    const [h, , s] = token.split('.');
    const tampered = btoa(JSON.stringify(baseClaims({ sub: 'victim' })))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    await expect(verify(`${h}.${tampered}.${s}`)).rejects.toThrow('bad-signature');
  });

  it('RS256 이 아닌 alg 는 거부', async () => {
    const token = await signToken(key, baseClaims(), { alg: 'none' });
    await expect(verify(token)).rejects.toThrow('bad-header');
  });

  it('형식이 깨진 토큰은 거부', async () => {
    await expect(verify('not-a-jwt')).rejects.toThrow(AuthError);
    await expect(verify('a.b.c')).rejects.toThrow(AuthError);
  });

  it('캐시에 kid 가 없으면 한 번만 새로 받아 통과', async () => {
    const jwks = stubJwks([key.jwk], [otherKey.jwk]);
    const token = await signToken(key, baseClaims());
    await expect(verify(token, jwks)).resolves.toMatchObject({ sub: 'user-sub-1' });
    expect(jwks.calls).toEqual([false, true]);
  });

  it('새로 받아도 kid 가 없으면 거부하고 더 조회하지 않는다', async () => {
    const jwks = stubJwks([otherKey.jwk]);
    const token = await signToken(key, baseClaims());
    await expect(verify(token, jwks)).rejects.toThrow('unknown-kid');
    expect(jwks.calls).toEqual([false, true]);
  });

  it('캐시에 kid 가 있으면 재조회하지 않는다', async () => {
    const jwks = stubJwks([key.jwk]);
    await verify(await signToken(key, baseClaims()), jwks);
    expect(jwks.calls).toEqual([false]);
  });
});
