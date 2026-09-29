/**
 * 서버 세션 — 제공자 ID 토큰을 `POST /auth/session` 으로 바꾼 백업 전용 토큰.
 *
 * 왜 세션인가: Apple identity token 은 10분짜리이고 조용한 갱신이 없어 자동 백업에 그대로 못 쓴다.
 * Google 도 같은 경로를 태워 두 제공자의 백업 호출이 한 모양(Bearer 세션 토큰)이 되게 한다.
 *
 * 여기서는 발급만 하고 저장하지 않는다. 저장 시점은 호출부가 정한다 — 로그인 직후 기존 백업
 * 복원/교체를 고르는 동안에는 계정을 아직 저장하지 않으므로 세션도 같이 미뤄야, 되돌려진 로그인의
 * 세션이 남아 이전 계정의 백업을 엉뚱한 행에 올리는 일이 없다(backupStore.commitAccount).
 */
import { BackupApiError, createSession } from '../backup/api';
import type { StoredSession } from '../../storage/backupStorage';
import { AuthError, userKeyOf, type AuthProvider, type ProviderSignIn } from './types';

/** 제공자 ID 토큰 → 서버 세션. 실패는 BackupApiError(401=reauth, 503=server, 오프라인=network) */
export async function exchangeForSession(
  provider: AuthProvider,
  idToken: string,
): Promise<StoredSession> {
  const res = await createSession(provider, idToken);
  return { token: res.sessionToken, expiresAt: res.expiresAt, sub: res.sub };
}

/**
 * 방금 로그인한 결과로 세션을 연다. 서버가 돌려준 sub 가 로그인한 계정과 다르면 reauth.
 *
 * Google 은 `/backup` 이 Google ID 토큰도 직접 받으므로, 세션 발급이 서버 쪽 사정(5xx·404 —
 * 예: /auth/session 이 없는 이전 Worker)으로 실패하면 ID 토큰을 그대로 쓴다(session=null).
 * Apple 은 그런 대안이 없어 실패를 그대로 던진다.
 */
export async function openSession(
  signed: ProviderSignIn,
): Promise<{ accessToken: string; session: StoredSession | null }> {
  try {
    const session = await exchangeForSession(signed.provider, signed.idToken);
    // 서버는 사용자 키(Apple 은 `apple:` 접두사)를 돌려준다 — 원본 sub 와 비교하면 Apple 이 늘 실패한다
    if (session.sub !== userKeyOf(signed.provider, signed.sub)) {
      throw new AuthError('reauth', 'Session subject does not match signed-in account');
    }
    return { accessToken: session.token, session };
  } catch (e) {
    if (signed.provider === 'google' && e instanceof BackupApiError && e.code === 'server') {
      return { accessToken: signed.idToken, session: null };
    }
    throw e;
  }
}
