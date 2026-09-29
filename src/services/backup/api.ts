/**
 * 백업 Worker HTTP 클라이언트 — `GET/PUT/DELETE {BACKUP_API_URL}/backup`.
 *
 * 인증은 전부 `Authorization: Bearer <Google ID 토큰>`. 서버 응답 코드를 앱이 할 일로 바꿔
 * BackupApiError.code 로 돌려준다(서버 명세: server/backup-worker/README.md).
 *   - 401          → 'reauth'  (토큰 만료·검증 실패 — 다시 로그인)
 *   - 400 / 413    → 'invalid' (본문 형식·크기 문제 — 재시도해도 같다)
 *   - 5xx 와 그 밖 → 'server'  (503 = JWKS·D1 일시 장애 — 나중에 재시도)
 *   - fetch 실패·15초 타임아웃 → 'network'
 */
import { BACKUP_API_URL } from '../../config/backup';
import type { AuthProvider } from '../auth/types';
import type { BackupSnapshot } from './snapshot';

export type BackupApiErrorCode = 'reauth' | 'network' | 'server' | 'invalid';

export class BackupApiError extends Error {
  readonly code: BackupApiErrorCode;
  /** HTTP 상태 코드. 네트워크 실패면 undefined */
  readonly status?: number;

  constructor(code: BackupApiErrorCode, message?: string, status?: number) {
    super(message ?? `BackupApiError: ${code}`);
    this.name = 'BackupApiError';
    this.code = code;
    this.status = status;
  }
}

/** GET /backup 200 응답. payload 는 검증 전이라 unknown — 호출부가 validateSnapshot 한다 */
export type RemoteBackup = {
  schemaVersion: number;
  /** 서버가 마지막으로 저장한 시각(ms) */
  updatedAt: number;
  email: string | null;
  payload: unknown;
};

const TIMEOUT_MS = 15_000;

function codeForStatus(status: number): BackupApiErrorCode {
  if (status === 401) return 'reauth';
  if (status === 400 || status === 413) return 'invalid';
  return 'server';
}

async function request(
  method: 'GET' | 'PUT' | 'DELETE' | 'POST',
  path: '/backup' | '/auth/session',
  /** Bearer 토큰. null 이면 Authorization 헤더 없이 보낸다(/auth/session) */
  token: string | null,
  body?: unknown,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (token != null) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return await fetch(`${BACKUP_API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    // 오프라인·DNS 실패·타임아웃(abort) 모두 "연결되면 다시" 로 같게 다룬다
    throw new BackupApiError('network', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

/** 응답 본문 JSON. 깨졌으면 서버 문제로 본다 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await res.json();
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    // 아래에서 던진다
  }
  throw new BackupApiError('server', 'Malformed response body', res.status);
}

/** 저장된 백업을 받는다. 서버에 백업이 없으면(404) null */
export async function fetchBackup(idToken: string): Promise<RemoteBackup | null> {
  const res = await request('GET', '/backup', idToken);
  if (res.status === 404) return null;
  if (res.status !== 200) {
    throw new BackupApiError(codeForStatus(res.status), `GET /backup ${res.status}`, res.status);
  }
  const data = await readJson(res);
  if (typeof data.schemaVersion !== 'number' || typeof data.updatedAt !== 'number') {
    throw new BackupApiError('server', 'Malformed GET /backup response', res.status);
  }
  return {
    schemaVersion: data.schemaVersion,
    updatedAt: data.updatedAt,
    email: typeof data.email === 'string' ? data.email : null,
    payload: data.payload,
  };
}

/** 스냅샷을 올린다(같은 계정 행을 덮어씀). 서버 저장 시각을 돌려준다 */
export async function uploadBackup(
  idToken: string,
  snapshot: BackupSnapshot,
): Promise<{ updatedAt: number }> {
  const res = await request('PUT', '/backup', idToken, {
    schemaVersion: snapshot.schemaVersion,
    payload: snapshot,
  });
  if (res.status !== 200) {
    throw new BackupApiError(codeForStatus(res.status), `PUT /backup ${res.status}`, res.status);
  }
  const data = await readJson(res);
  if (typeof data.updatedAt !== 'number') {
    throw new BackupApiError('server', 'Malformed PUT /backup response', res.status);
  }
  return { updatedAt: data.updatedAt };
}

/** 서버 백업을 지운다. 행이 없어도 204 */
export async function deleteBackup(idToken: string): Promise<void> {
  const res = await request('DELETE', '/backup', idToken);
  if (res.status !== 204 && res.status !== 200) {
    throw new BackupApiError(codeForStatus(res.status), `DELETE /backup ${res.status}`, res.status);
  }
}

/** POST /auth/session 200 응답 */
export type SessionResponse = {
  sessionToken: string;
  /** 세션 만료 시각(ms) */
  expiresAt: number;
  /** 제공자 계정 고유 ID — 로그인한 계정과 같아야 한다 */
  sub: string;
  email: string | null;
  provider: AuthProvider;
};

/**
 * 제공자 ID 토큰(Google ID 토큰·Apple identity token)을 서버 세션 토큰으로 바꾼다.
 * Apple identity token 은 10분짜리라 그대로는 자동 백업에 못 쓴다 — 두 제공자 모두 이 경로를 탄다.
 * 401 = 토큰 검증 실패(reauth), 503 = 일시 장애(server).
 */
export async function createSession(
  provider: AuthProvider,
  idToken: string,
): Promise<SessionResponse> {
  const res = await request('POST', '/auth/session', null, { provider, token: idToken });
  if (res.status !== 200) {
    throw new BackupApiError(
      codeForStatus(res.status),
      `POST /auth/session ${res.status}`,
      res.status,
    );
  }
  const data = await readJson(res);
  if (
    typeof data.sessionToken !== 'string' ||
    data.sessionToken === '' ||
    typeof data.expiresAt !== 'number' ||
    typeof data.sub !== 'string' ||
    data.sub === ''
  ) {
    throw new BackupApiError('server', 'Malformed POST /auth/session response', res.status);
  }
  return {
    sessionToken: data.sessionToken,
    expiresAt: data.expiresAt,
    sub: data.sub,
    email: typeof data.email === 'string' ? data.email : null,
    provider: data.provider === 'apple' ? 'apple' : 'google',
  };
}
