import { describe, expect, it } from 'vitest';
import { AuthError } from '../src/auth';
import { issueSessionToken, SESSION_TTL_SEC, verifySessionToken } from '../src/session';
import { NOW_MS, NOW_SEC, SESSION_SECRET } from './helpers';

const user = { sub: 'apple:001234.abc', email: 'a@privaterelay.appleid.com', provider: 'apple' as const };

function b64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('세션 토큰', () => {
  it('발급 → 검증 왕복, 만료 180일', async () => {
    const { token, expiresAt } = await issueSessionToken(user, SESSION_SECRET, NOW_MS);
    expect(expiresAt).toBe((NOW_SEC + SESSION_TTL_SEC) * 1000);
    expect(SESSION_TTL_SEC).toBe(180 * 86400);
    const header = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    await expect(verifySessionToken(token, SESSION_SECRET, NOW_MS)).resolves.toEqual({
      ...user,
      iat: NOW_SEC,
      exp: NOW_SEC + SESSION_TTL_SEC,
    });
  });

  it('만료 시각이 지나면 거부', async () => {
    const { token, expiresAt } = await issueSessionToken(user, SESSION_SECRET, NOW_MS);
    await expect(verifySessionToken(token, SESSION_SECRET, expiresAt - 1000)).resolves.toMatchObject({ sub: user.sub });
    await expect(verifySessionToken(token, SESSION_SECRET, expiresAt)).rejects.toThrow('expired');
  });

  it('다른 secret 으로 서명한 토큰은 거부', async () => {
    const { token } = await issueSessionToken(user, 'another-secret', NOW_MS);
    await expect(verifySessionToken(token, SESSION_SECRET, NOW_MS)).rejects.toThrow('bad-signature');
  });

  it('서명 후 payload 를 바꾸면 거부', async () => {
    const { token } = await issueSessionToken(user, SESSION_SECRET, NOW_MS);
    const [h, , s] = token.split('.');
    const forged = b64url({ ...user, sub: 'victim', iat: NOW_SEC, exp: NOW_SEC + 100 });
    await expect(verifySessionToken(`${h}.${forged}.${s}`, SESSION_SECRET, NOW_MS)).rejects.toThrow('bad-signature');
  });

  it('HS256 이 아닌 alg(none 등)는 거부', async () => {
    const { token } = await issueSessionToken(user, SESSION_SECRET, NOW_MS);
    const [, p] = token.split('.');
    await expect(verifySessionToken(`${b64url({ alg: 'none' })}.${p}.`, SESSION_SECRET, NOW_MS)).rejects.toThrow(
      'bad-header',
    );
  });

  it('형식이 깨진 토큰은 AuthError', async () => {
    await expect(verifySessionToken('abc', SESSION_SECRET, NOW_MS)).rejects.toThrow(AuthError);
  });

  it('secret 이 비어 있으면 AuthError 가 아닌 예외(→ 503)', async () => {
    const { token } = await issueSessionToken(user, SESSION_SECRET, NOW_MS);
    const err = await verifySessionToken(token, '', NOW_MS).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AuthError);
    await expect(issueSessionToken(user, '', NOW_MS)).rejects.toThrow('session-secret-missing');
  });
});
