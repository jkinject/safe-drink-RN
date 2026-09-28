import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { BACKUP_SUPPORTED, GOOGLE_WEB_CLIENT_ID } from '@/config/backup';

/**
 * Google 로그인 래퍼 — 백업 Worker 에 보낼 ID 토큰을 얻는 용도로만 쓴다.
 *
 * 라이브러리는 `@react-native-google-signin/google-signin` 무료 판의 Original Google Sign-In
 * 흐름(선정 근거는 docs/BACKUP.md). 화면 쪽은 라이브러리 타입·에러 코드를 몰라도 되도록
 * 여기서 결과와 에러를 앱 형태로 바꿔 돌려준다.
 */

export type GoogleAuthErrorCode = 'cancelled' | 'reauth' | 'network' | 'unknown';

export class GoogleAuthError extends Error {
  readonly code: GoogleAuthErrorCode;

  constructor(code: GoogleAuthErrorCode, message?: string) {
    super(message ?? `GoogleAuthError: ${code}`);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

export type GoogleAccount = {
  /** Google 계정 고유 ID(ID 토큰의 `sub`). 서버는 이 값으로만 백업 행을 찾는다. */
  sub: string;
  email: string | null;
  idToken: string;
};

/** Android GoogleSignInStatusCodes / CommonStatusCodes 의 NETWORK_ERROR(7). 네이티브가 문자열로 넘긴다. */
const ANDROID_NETWORK_ERROR = '7';

let configured = false;

/**
 * SDK 초기화. 앱 시작 시 한 번 부른다. 백업이 꺼진 빌드(BACKUP_SUPPORTED=false)에서는
 * 네이티브 모듈을 건드리지 않는다.
 *
 * offlineAccess 는 끈다 — 서버가 Google API 를 대신 부를 일이 없어서 serverAuthCode 가 필요 없다.
 * webClientId 를 줘야 ID 토큰이 발급되고, 그 `aud` 가 이 웹 클라이언트 ID 가 된다.
 */
export function configure(): void {
  if (!BACKUP_SUPPORTED || configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
  configured = true;
}

/**
 * 계정 선택 UI 를 띄워 로그인한다. 사용자가 닫으면 null.
 * 실패는 GoogleAuthError 로 던진다(네트워크·Play 서비스 없음·설정 오류 등).
 */
export async function signIn(): Promise<GoogleAccount | null> {
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return null;
    const idToken = res.data.idToken;
    if (!idToken) {
      // webClientId 가 틀리거나 비어 있으면 로그인은 되는데 ID 토큰이 없다
      throw new GoogleAuthError('unknown', 'Google sign-in returned no idToken');
    }
    return { sub: readSub(idToken), email: res.data.user.email ?? null, idToken };
  } catch (e) {
    const err = normalizeError(e);
    if (err.code === 'cancelled') return null;
    throw err;
  }
}

/**
 * 백업 요청에 붙일 신선한 ID 토큰(유효 1시간). UI 없이 조용히 갱신한다.
 *
 * getTokens() 대신 signInSilently() 를 쓰는 이유: Android 의 getTokens() 는 마지막 로그인 때
 * 캐시된 계정의 idToken 을 그대로 돌려줘 만료돼 있을 수 있고, 액세스 토큰까지 따로 받는다.
 * signInSilently() 는 필요하면 토큰을 새로 받아 온다.
 *
 * 저장된 로그인이 없거나 권한이 회수됐으면 GoogleAuthError('reauth') — 호출부는 다시
 * signIn() 을 유도한다.
 */
export async function getIdToken(): Promise<string> {
  configure();
  try {
    const res = await GoogleSignin.signInSilently();
    if (res.type !== 'success' || !res.data.idToken) {
      throw new GoogleAuthError('reauth', 'No saved Google sign-in');
    }
    return res.data.idToken;
  } catch (e) {
    const err = normalizeError(e);
    // 조용한 갱신에는 사용자 취소가 없다 — 취소로 보이는 것도 다시 로그인이 필요하다는 뜻
    if (err.code === 'cancelled') throw new GoogleAuthError('reauth', err.message);
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
function normalizeError(e: unknown): GoogleAuthError {
  if (e instanceof GoogleAuthError) return e;
  const message = e instanceof Error ? e.message : String(e);
  if (!isErrorWithCode(e)) return new GoogleAuthError('unknown', message);
  switch (e.code) {
    case statusCodes.SIGN_IN_CANCELLED:
      return new GoogleAuthError('cancelled', message);
    case statusCodes.SIGN_IN_REQUIRED:
      return new GoogleAuthError('reauth', message);
    case ANDROID_NETWORK_ERROR:
      return new GoogleAuthError('network', message);
    default:
      // IN_PROGRESS, PLAY_SERVICES_NOT_AVAILABLE, DEVELOPER_ERROR(10, SHA-1·클라이언트 설정 오류) 등
      return new GoogleAuthError('unknown', message);
  }
}

/**
 * ID 토큰(JWT) payload 의 `sub` 를 읽는다. 서명 검증은 서버(Worker)가 하므로 여기선 디코드만.
 * 형식이 깨졌으면 GoogleAuthError('unknown').
 */
function readSub(idToken: string): string {
  try {
    const payload = idToken.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { sub?: unknown };
    if (typeof claims.sub === 'string' && claims.sub !== '') return claims.sub;
  } catch {
    // 아래에서 던진다
  }
  throw new GoogleAuthError('unknown', 'Malformed Google idToken');
}
