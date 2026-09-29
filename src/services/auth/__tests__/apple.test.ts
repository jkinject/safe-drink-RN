/**
 * Sign in with Apple 래퍼 — 로그인 결과 변환, 취소, 이메일 보충, 자격 상태.
 * expo-apple-authentication 은 루트 __mocks__ 가 자동 대체한다(기본: 사용 가능·취소·AUTHORIZED).
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import * as apple from '../apple';
import { AuthError } from '../types';

const signInAsync = AppleAuthentication.signInAsync as jest.Mock;
const isAvailableAsync = AppleAuthentication.isAvailableAsync as jest.Mock;
const getCredentialStateAsync = AppleAuthentication.getCredentialStateAsync as jest.Mock;
const { AppleAuthenticationCredentialState: State } = AppleAuthentication;

/** 서명 없는 가짜 JWT */
function jwt(claims: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `h.${b64}.s`;
}

function credential(overrides: Record<string, unknown> = {}) {
  return {
    user: 'apple-sub',
    state: null,
    fullName: null,
    email: 'first@example.com',
    realUserStatus: 1,
    identityToken: jwt({ sub: 'apple-sub', email: 'token@privaterelay.appleid.com' }),
    authorizationCode: 'code',
    ...overrides,
  };
}

const prevOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
  isAvailableAsync.mockResolvedValue(true);
  getCredentialStateAsync.mockResolvedValue(State.AUTHORIZED);
});
afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => prevOS });
});

describe('signIn', () => {
  it('found — identity token 의 sub 와 첫 로그인 이메일을 돌려준다', async () => {
    const cred = credential();
    signInAsync.mockResolvedValueOnce(cred);
    await expect(apple.signIn()).resolves.toEqual({
      provider: 'apple',
      sub: 'apple-sub',
      email: 'first@example.com',
      idToken: cred.identityToken,
    });
    expect(signInAsync).toHaveBeenCalledWith({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });
  });

  it('두 번째 로그인부터는 credential.email 이 없어 identity token 의 email 로 보충한다', async () => {
    signInAsync.mockResolvedValueOnce(credential({ email: null }));
    await expect(apple.signIn()).resolves.toMatchObject({
      email: 'token@privaterelay.appleid.com',
    });
  });

  it('cancelled — ERR_REQUEST_CANCELED 는 null', async () => {
    // 목 기본값이 사용자 취소
    await expect(apple.signIn()).resolves.toBeNull();
  });

  it('identityToken 이 없으면 unknown', async () => {
    signInAsync.mockResolvedValueOnce(credential({ identityToken: null }));
    await expect(apple.signIn()).rejects.toMatchObject({ code: 'unknown' });
  });

  it('쓸 수 없는 기기면 unavailable, 네이티브를 부르지 않는다', async () => {
    isAvailableAsync.mockResolvedValueOnce(false);
    const err = await apple.signIn().catch(e => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe('unavailable');
    expect(signInAsync).not.toHaveBeenCalled();
  });
});

describe('isAvailable', () => {
  it('Android 에서는 false', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    await expect(apple.isAvailable()).resolves.toBe(false);
    expect(isAvailableAsync).not.toHaveBeenCalled();
  });

  it('iOS 에서는 네이티브 응답을 따른다', async () => {
    await expect(apple.isAvailable()).resolves.toBe(true);
    isAvailableAsync.mockRejectedValueOnce(new Error('x'));
    await expect(apple.isAvailable()).resolves.toBe(false);
  });
});

describe('isCredentialRevoked', () => {
  it.each([
    [State.REVOKED, true],
    [State.NOT_FOUND, true],
    [State.AUTHORIZED, false],
    [State.TRANSFERRED, false],
  ])('상태 %i → %s', async (state, expected) => {
    getCredentialStateAsync.mockResolvedValueOnce(state);
    await expect(apple.isCredentialRevoked('apple-sub')).resolves.toBe(expected);
  });

  it('조회 실패는 false(확실하지 않으면 연동을 끊지 않는다)', async () => {
    getCredentialStateAsync.mockRejectedValueOnce(new Error('simulator'));
    await expect(apple.isCredentialRevoked('apple-sub')).resolves.toBe(false);
  });
});
