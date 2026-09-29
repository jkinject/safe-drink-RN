import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { BACKUP_SUPPORTED, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/config/backup';
import { AuthError, readJwtClaims, type ProviderSignIn } from './types';

/**
 * Google 로그인 래퍼 — 서버 세션 발급(`/auth/session`)과 세션 갱신에 쓸 ID 토큰을 얻는다.
 *
 * 라이브러리는 `@react-native-google-signin/google-signin` 무료 판의 Original Google Sign-In
 * 흐름(선정 근거는 docs/BACKUP.md). 결과·에러를 앱 형태(ProviderSignIn·AuthError)로 바꿔 돌려준다.
 */

/** Android GoogleSignInStatusCodes / CommonStatusCodes 의 NETWORK_ERROR(7). 네이티브가 문자열로 넘긴다. */
const ANDROID_NETWORK_ERROR = '7';

/**
 * iOS 는 NSError.code 를 문자열로 넘긴다. 연결 없음(-1009)·타임아웃(-1001)·연결 끊김(-1005)·
 * 호스트 못 찾음(-1003)은 NSURLErrorDomain 코드다.
 */
const IOS_NETWORK_ERRORS = new Set(['-1009', '-1001', '-1005', '-1003']);

let configured = false;

/**
 * SDK 초기화. 앱 시작 시 한 번 부른다. 백업이 꺼진 빌드(BACKUP_SUPPORTED=false)에서는
 * 네이티브 모듈을 건드리지 않는다.
 *
 * offlineAccess 는 끈다 — 서버가 Google API 를 대신 부를 일이 없어서 serverAuthCode 가 필요 없다.
 * webClientId 를 줘야 ID 토큰이 발급되고, 그 `aud` 가 이 웹 클라이언트 ID 가 된다(iOS 도 동일).
 * iOS 는 iosClientId 가 없으면 configure 가 reject 된다 — BACKUP_SUPPORTED 가 이미 확인한다.
 */
export function configure(): void {
  if (!BACKUP_SUPPORTED || configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    ...(Platform.OS === 'ios' ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
  });
  configured = true;
}

/**
 * 계정 선택 UI 를 띄워 로그인한다. 사용자가 닫으면 null.
 * 실패는 AuthError 로 던진다(네트워크·Play 서비스 없음·설정 오류 등).
 */
export async function signIn(): Promise<ProviderSignIn | null> {
  configure();
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return null;
    const idToken = res.data.idToken;
    if (!idToken) {
      // webClientId 가 틀리거나 비어 있으면 로그인은 되는데 ID 토큰이 없다
      throw new AuthError('unknown', 'Google sign-in returned no idToken');
    }
    const { sub } = readJwtClaims(idToken);
    return { provider: 'google', sub, email: res.data.user.email ?? null, idToken };
  } catch (e) {
    const err = normalizeError(e);
    if (err.code === 'cancelled') return null;
    throw err;
  }
}

/**
 * 신선한 ID 토큰(유효 1시간). UI 없이 조용히 갱신한다 — 서버 세션 재발급용.
 *
 * getTokens() 대신 signInSilently() 를 쓰는 이유: Android 의 getTokens() 는 마지막 로그인 때
 * 캐시된 계정의 idToken 을 그대로 돌려줘 만료돼 있을 수 있고, 액세스 토큰까지 따로 받는다.
 * signInSilently() 는 필요하면 토큰을 새로 받아 온다.
 *
 * 저장된 로그인이 없거나 권한이 회수됐으면 AuthError('reauth') — 호출부는 다시 signIn() 을 유도한다.
 */
export async function getIdToken(): Promise<string> {
  configure();
  try {
    const res = await GoogleSignin.signInSilently();
    if (res.type !== 'success' || !res.data.idToken) {
      throw new AuthError('reauth', 'No saved Google sign-in');
    }
    return res.data.idToken;
  } catch (e) {
    const err = normalizeError(e);
    // 조용한 갱신에는 사용자 취소가 없다 — 취소로 보이는 것도 다시 로그인이 필요하다는 뜻
    if (err.code === 'cancelled') throw new AuthError('reauth', err.message);
    throw err;
  }
}

/** 로그아웃. 실패해도 앱 쪽 연동 해제는 계속 진행해야 하므로 에러를 삼킨다. */
export async function signOut(): Promise<void> {
  if (!BACKUP_SUPPORTED) return;
  configure();
  try {
    await GoogleSignin.signOut();
  } catch {
    // 무시
  }
}

/** 라이브러리 에러를 앱 에러 코드로 바꾼다. */
function normalizeError(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  const message = e instanceof Error ? e.message : String(e);
  if (!isErrorWithCode(e)) return new AuthError('unknown', message);
  if (e.code === statusCodes.SIGN_IN_CANCELLED) return new AuthError('cancelled', message);
  if (e.code === statusCodes.SIGN_IN_REQUIRED) return new AuthError('reauth', message);
  if (e.code === ANDROID_NETWORK_ERROR || IOS_NETWORK_ERRORS.has(e.code)) {
    return new AuthError('network', message);
  }
  if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return new AuthError('unavailable', message);
  }
  // IN_PROGRESS, DEVELOPER_ERROR(10, SHA-1·클라이언트 설정 오류) 등
  return new AuthError('unknown', message);
}
