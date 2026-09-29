/**
 * 백업 로그인 공통 타입 — Google(Android·iOS)과 Sign in with Apple(iOS).
 *
 * 화면·스토어는 제공자 라이브러리의 타입·에러 코드를 몰라도 되도록 이 형태만 본다.
 */

export type AuthProvider = 'google' | 'apple';

/**
 * - cancelled: 사용자가 로그인 창을 닫음(signIn 은 이 경우 null 을 돌려주므로 밖으로는 거의 안 나온다)
 * - reauth: 저장된 로그인이 없거나 만료·회수됨 — 다시 로그인해야 한다
 * - network: 오프라인·타임아웃
 * - unavailable: 이 기기에서 쓸 수 없는 제공자(예: iOS 13 미만의 Apple 로그인)
 * - unknown: 그 밖(설정 오류·토큰 형식 깨짐 등)
 */
export type AuthErrorCode = 'cancelled' | 'reauth' | 'network' | 'unavailable' | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? `AuthError: ${code}`);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** 제공자 로그인 결과. idToken 은 서버 세션 발급(`/auth/session`)에 한 번 쓰고 버린다 */
export type ProviderSignIn = {
  provider: AuthProvider;
  /** 제공자 계정 고유 ID(ID 토큰의 `sub`). 서버는 (provider, sub) 로 백업 행을 찾는다 */
  sub: string;
  email: string | null;
  idToken: string;
};

/**
 * JWT payload 를 읽는다. 서명 검증은 서버(Worker)가 하므로 여기선 디코드만.
 * `sub` 가 없거나 형식이 깨졌으면 AuthError('unknown').
 */
export function readJwtClaims(token: string): { sub: string; email: string | null } {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { sub?: unknown; email?: unknown };
    if (typeof claims.sub === 'string' && claims.sub !== '') {
      return { sub: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
    }
  } catch {
    // 아래에서 던진다
  }
  throw new AuthError('unknown', 'Malformed ID token');
}
