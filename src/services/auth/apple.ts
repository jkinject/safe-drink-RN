import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import { AuthError, readJwtClaims, type ProviderSignIn } from './types';

/**
 * Sign in with Apple 래퍼(iOS 전용) — App Store 심사 4.8 대응으로 Google 과 나란히 제공한다.
 *
 * Apple identity token 은 유효 10분이고 조용한 갱신 수단이 없다. 그래서 로그인 직후 서버 세션
 * 토큰으로 바꿔(session.ts) 자동 백업에 쓰고, 세션이 만료되면 다시 로그인하게 한다.
 * Apple 에는 앱 쪽 "로그아웃" API 가 없다 — 연동 해제는 로컬 세션을 지우는 것으로 끝난다.
 */

/** 이 기기에서 Apple 로그인을 쓸 수 있는지. iOS 13+ 이고 네이티브가 가능하다고 답해야 true */
export async function isAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  if (Number.parseInt(String(Platform.Version), 10) < 13) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Apple 로그인 시트를 띄운다. 사용자가 닫으면 null.
 *
 * 이메일은 **첫 로그인에만** credential.email 로 온다(이후는 null). identity token 에는
 * 매번 email 클레임이 들어 있으므로 그쪽으로 보충한다("나의 이메일 가리기"면 릴레이 주소).
 * sub 는 identity token 의 `sub` — credential.user 와 같은 값이다.
 */
export async function signIn(): Promise<ProviderSignIn | null> {
  if (!(await isAvailable())) throw new AuthError('unavailable', 'Sign in with Apple unavailable');
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });
    if (!cred.identityToken) {
      throw new AuthError('unknown', 'Sign in with Apple returned no identityToken');
    }
    const claims = readJwtClaims(cred.identityToken);
    return {
      provider: 'apple',
      sub: claims.sub,
      email: cred.email ?? claims.email,
      idToken: cred.identityToken,
    };
  } catch (e) {
    const err = normalizeError(e);
    if (err.code === 'cancelled') return null;
    throw err;
  }
}

/**
 * 사용자가 설정 앱에서 이 앱의 Apple ID 사용을 중단했는지(REVOKED) 또는 자격이 없어졌는지
 * (NOT_FOUND). true 면 세션을 버리고 다시 로그인하게 한다.
 * 조회 자체가 실패하면(시뮬레이터·네트워크) false — 확실하지 않은 걸로 연동을 끊지 않는다.
 */
export async function isCredentialRevoked(user: string): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const state = await AppleAuthentication.getCredentialStateAsync(user);
    return (
      state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED ||
      state === AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND
    );
  } catch {
    return false;
  }
}

/** expo-apple-authentication 에러(`ERR_*` 코드)를 앱 에러 코드로 바꾼다 */
function normalizeError(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  const message = e instanceof Error ? e.message : String(e);
  const code =
    typeof e === 'object' && e != null && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'ERR_REQUEST_CANCELED':
      return new AuthError('cancelled', message);
    case 'ERR_REQUEST_NOT_INTERACTIVE':
      return new AuthError('reauth', message);
    case 'ERR_REQUEST_NOT_HANDLED':
      return new AuthError('unavailable', message);
    default:
      // ERR_REQUEST_FAILED·ERR_REQUEST_UNKNOWN(iCloud 로그인 안 됨 포함)·ERR_INVALID_RESPONSE 등
      return new AuthError('unknown', message);
  }
}
