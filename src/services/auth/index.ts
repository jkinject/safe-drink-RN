/**
 * 백업 인증 진입점 — 제공자 로그인(Google·Apple)과 백업 요청용 토큰(서버 세션) 관리.
 *
 * 스토어·스케줄러는 이 모듈만 쓴다. 백업 요청에는 항상 withAccessToken() 을 거친다:
 *   - 저장된 세션이 만료까지 7일 이상 남았으면 그대로 쓴다.
 *   - 임박·없음: Google 은 조용히 ID 토큰을 받아 새 세션을 발급받는다(UI 없음).
 *     Apple 은 조용한 갱신이 없어, 아직 유효한 세션은 만료까지 쓰고 만료되면 reauth.
 *   - 서버가 세션을 401 로 거부하면 세션을 버리고, Google 은 한 번 재발급해 다시 시도한다.
 */
import * as backupStorage from '../../storage/backupStorage';
import { BackupApiError } from '../backup/api';
import * as apple from './apple';
import * as google from './google';
import { exchangeForSession } from './session';
import { AuthError, userKeyOf, type AuthProvider, type ProviderSignIn } from './types';

export { apple, google };
export { openSession } from './session';
export * from './types';

/** 만료까지 이보다 적게 남으면 (Google 은) 미리 새 세션을 받는다 */
export const SESSION_REFRESH_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;
/** 이보다 적게 남은 세션은 요청 도중 만료될 수 있어 없는 것으로 본다 */
const SESSION_MIN_VALID_MS = 60 * 1000;

/** 토큰을 받을 계정 — backupStore 의 account 를 그대로 넘기면 된다 */
export type AuthAccount = { provider: AuthProvider; sub: string };

/** SDK 초기화. 앱 시작 시 한 번(Apple 은 초기화가 필요 없다) */
export function configure(): void {
  google.configure();
}

/** 로그인 UI 를 띄운다. 사용자가 닫으면 null, 실패는 AuthError */
export function signIn(provider: AuthProvider): Promise<ProviderSignIn | null> {
  return provider === 'apple' ? apple.signIn() : google.signIn();
}

/** 제공자 로그아웃. Apple 은 앱 쪽 로그아웃이 없어 아무것도 안 한다(세션 삭제는 호출부가) */
export async function signOut(provider: AuthProvider): Promise<void> {
  if (provider === 'google') await google.signOut();
}

/**
 * 백업 요청에 붙일 Bearer 토큰(서버 세션 토큰. Google 은 세션 발급이 서버 사정으로 실패하면
 * ID 토큰). 다시 로그인해야 하면 AuthError('reauth').
 */
export async function getAccessToken(account: AuthAccount): Promise<string> {
  const now = Date.now();
  const saved = await backupStorage.loadSession().catch(() => null);
  const usable =
    saved && saved.sub === userKeyOf(account.provider, account.sub) && saved.expiresAt - now > SESSION_MIN_VALID_MS
      ? saved
      : null;
  if (usable && usable.expiresAt - now >= SESSION_REFRESH_BEFORE_MS) return usable.token;

  if (account.provider === 'apple') {
    if (usable) return usable.token;
    throw new AuthError('reauth', 'Apple session expired');
  }

  try {
    return await refreshGoogleSession(account.sub);
  } catch (e) {
    // 갱신이 안 돼도(오프라인 등) 아직 유효한 세션이 있으면 그걸로 간다
    if (usable) return usable.token;
    throw e;
  }
}

/** Google ID 토큰을 조용히 받아 새 세션을 발급·저장한다 */
async function refreshGoogleSession(sub: string): Promise<string> {
  const idToken = await google.getIdToken();
  let session;
  try {
    session = await exchangeForSession('google', idToken);
  } catch (e) {
    // /backup 은 Google ID 토큰도 받는다 — 세션 발급만 서버 사정으로 안 되면 ID 토큰으로 간다
    if (e instanceof BackupApiError && e.code === 'server') return idToken;
    throw e;
  }
  if (session.sub !== sub) {
    // 기기의 Google 로그인이 연동 계정과 다르다 — 다른 계정 백업을 건드리지 않는다
    throw new AuthError('reauth', 'Signed-in Google account differs from linked account');
  }
  await backupStorage.saveSession(session).catch(() => {});
  return session.token;
}

/**
 * 토큰을 받아 fn 을 부른다. 서버가 401 을 주면 저장된 세션을 버리고, Google 은 새 세션으로
 * 한 번 더 시도한다(서버 쪽 세션 무효화에도 재로그인 없이 이어지도록). Apple 은 그대로 reauth.
 */
export async function withAccessToken<T>(
  account: AuthAccount,
  fn: (token: string) => Promise<T>,
): Promise<T> {
  const token = await getAccessToken(account);
  try {
    return await fn(token);
  } catch (e) {
    if (!(e instanceof BackupApiError && e.code === 'reauth')) throw e;
    await backupStorage.clearSession().catch(() => {});
    if (account.provider !== 'google') throw e;
    const fresh = await refreshGoogleSession(account.sub);
    if (fresh === token) throw e;
    return fn(fresh);
  }
}
