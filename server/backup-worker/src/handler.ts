import {
  APPLE_ISSUER,
  AuthError,
  GOOGLE_ISSUERS,
  parseAppleBundleIds,
  parseClientIds,
  peekToken,
  verifyAppleIdToken,
  verifyGoogleIdToken,
  type FetchJwks,
} from './auth';
import { issueSessionToken, verifySessionToken, type Provider } from './session';

export interface Env {
  DB: D1Database;
  /** OAuth 클라이언트 ID(공개값). 쉼표로 여러 개 — 웹·Android 클라이언트를 같이 받을 수 있다 */
  GOOGLE_CLIENT_ID: string;
  /** Apple identity token 의 aud 로 허용할 번들 ID(쉼표 구분). 비어 있으면 com.safedrink.app */
  APPLE_BUNDLE_ID?: string;
  /** 세션 토큰 HS256 서명 키(wrangler secret). 비어 있으면 /auth/session 과 세션 토큰 인증이 503 */
  SESSION_SECRET?: string;
}

export interface Deps {
  /** Google JWKS */
  fetchJwks: FetchJwks;
  /** Apple JWKS */
  fetchAppleJwks: FetchJwks;
  now?: () => number;
}

// 인증 결과. 세션 토큰·Google ID 토큰·Apple ID 토큰 어느 경로든 이 모양으로 통일한다.
export interface AuthUser {
  /** D1 user_sub. Google 은 sub 그대로(기존 행 호환), Apple 은 "apple:<sub>" */
  userKey: string;
  email: string | null;
  provider: Provider;
}

// 스냅샷 한 개의 상한. D1 행 한도(약 2MB) 안쪽으로 여유를 두고, 기록 수천 건도 이 안에 들어간다.
export const MAX_BODY_BYTES = 1_048_576;

const BACKUP_PATH = '/backup';
const SESSION_PATH = '/auth/session';

// Google sub 는 숫자 문자열이라 "apple:" 로 시작할 수 없다 — 두 공급자의 행이 섞이지 않는다.
export function userKeyOf(provider: Provider, sub: string): string {
  return provider === 'apple' ? `apple:${sub}` : sub;
}

interface BackupRow {
  email: string | null;
  schema_version: number;
  updated_at: number;
  payload: string;
}

// 개인 데이터라 중간 프록시·기기 캐시에 남지 않게 모든 응답에 no-store.
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// 공급자 ID 토큰(RS256)을 검증해 사용자로 바꾼다. 검증기는 (아직 믿지 않는) iss 로 고르고,
// expected 가 있으면 그 공급자여야 한다 — 어긋나면 엉뚱한 JWKS 를 강제 재조회하지 않고 바로 401.
async function verifyProviderToken(
  token: string,
  expected: Provider | null,
  env: Env,
  deps: Deps,
): Promise<AuthUser> {
  const { iss } = peekToken(token);
  let provider: Provider;
  if (typeof iss === 'string' && GOOGLE_ISSUERS.includes(iss)) provider = 'google';
  else if (iss === APPLE_ISSUER) provider = 'apple';
  else throw new AuthError('bad-iss');
  if (expected !== null && expected !== provider) throw new AuthError('bad-iss');
  const claims =
    provider === 'apple'
      ? await verifyAppleIdToken(token, {
          bundleIds: parseAppleBundleIds(env.APPLE_BUNDLE_ID),
          fetchJwks: deps.fetchAppleJwks,
          now: deps.now,
        })
      : await verifyGoogleIdToken(token, {
          clientIds: parseClientIds(env.GOOGLE_CLIENT_ID),
          fetchJwks: deps.fetchJwks,
          now: deps.now,
        });
  return { userKey: userKeyOf(provider, claims.sub), email: claims.email, provider };
}

// Authorization: Bearer <t> — 헤더 alg 로 경로를 가른다.
//  HS256 → 서버 세션 토큰, RS256 → iss 로 Google/Apple ID 토큰.
async function authenticate(request: Request, env: Env, deps: Deps): Promise<AuthUser | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '');
  if (!m) return null;
  const token = m[1];
  try {
    const { alg } = peekToken(token);
    if (alg === 'HS256') {
      const s = await verifySessionToken(token, env.SESSION_SECRET ?? '', (deps.now ?? Date.now)());
      return { userKey: s.sub, email: s.email, provider: s.provider };
    }
    if (alg === 'RS256') return await verifyProviderToken(token, null, env, deps);
    return null;
  } catch (e) {
    if (e instanceof AuthError) return null;
    // JWKS 네트워크 실패·SESSION_SECRET 미설정 등은 토큰 문제가 아니다 — 위로 올려 503 으로 구분한다.
    throw e;
  }
}

// 본문은 스트림이라 Content-Length 가 없을(chunked) 수도 있다. 헤더로 먼저 거르고, 실제 길이로 한 번 더 확인.
async function readBody(request: Request): Promise<ArrayBuffer | 'too-large'> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return 'too-large';
  const buf = await request.arrayBuffer();
  return buf.byteLength > MAX_BODY_BYTES ? 'too-large' : buf;
}

async function getBackup(env: Env, userKey: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT email, schema_version, updated_at, payload FROM backups WHERE user_sub = ?1',
  )
    .bind(userKey)
    .first<BackupRow>();
  if (!row) return json(404, { error: 'not-found' });
  return json(200, {
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
    email: row.email,
    payload: JSON.parse(row.payload),
  });
}

async function putBackup(request: Request, env: Env, deps: Deps, user: AuthUser): Promise<Response> {
  const body = await readBody(request);
  if (body === 'too-large') return json(413, { error: 'too-large' });

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return json(400, { error: 'invalid-json' });
  }
  if (
    !isPlainObject(parsed) ||
    !Number.isSafeInteger(parsed.schemaVersion) ||
    !isPlainObject(parsed.payload)
  ) {
    return json(400, { error: 'invalid-body' });
  }

  // 기기 시계는 믿지 않는다 — "마지막 백업" 표시가 기기마다 어긋나지 않도록 서버 시각으로 찍는다.
  const updatedAt = (deps.now ?? Date.now)();
  // 사용자당 1행 스냅샷. 존재 여부를 먼저 읽지 않고 upsert 한 번으로 끝내 행 쓰기 1회만 쓴다.
  await env.DB.prepare(
    `INSERT INTO backups (user_sub, email, schema_version, updated_at, payload)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(user_sub) DO UPDATE SET
       email = excluded.email,
       schema_version = excluded.schema_version,
       updated_at = excluded.updated_at,
       payload = excluded.payload`,
  )
    .bind(user.userKey, user.email, parsed.schemaVersion, updatedAt, JSON.stringify(parsed.payload))
    .run();
  return json(200, { updatedAt });
}

async function deleteBackup(env: Env, userKey: string): Promise<Response> {
  await env.DB.prepare('DELETE FROM backups WHERE user_sub = ?1').bind(userKey).run();
  // 이미 없어도 204 — 앱의 "백업 삭제 및 연동 해제" 를 재시도해도 같은 결과가 나오게.
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

// POST /auth/session {provider, token} → 공급자 ID 토큰을 검증하고 서버 세션 토큰을 발급한다.
async function createSession(request: Request, env: Env, deps: Deps): Promise<Response> {
  const secret = env.SESSION_SECRET ?? '';
  if (!secret) return json(503, { error: 'unavailable' });

  const body = await readBody(request);
  if (body === 'too-large') return json(413, { error: 'too-large' });
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return json(400, { error: 'invalid-json' });
  }
  if (
    !isPlainObject(parsed) ||
    (parsed.provider !== 'google' && parsed.provider !== 'apple') ||
    typeof parsed.token !== 'string' ||
    parsed.token === ''
  ) {
    return json(400, { error: 'invalid-body' });
  }

  let user: AuthUser;
  try {
    // provider 를 명시했으므로 그 발급자 규칙으로만 검증한다(다른 발급자 토큰은 iss 불일치로 401).
    user = await verifyProviderToken(parsed.token, parsed.provider, env, deps);
  } catch (e) {
    if (e instanceof AuthError) return json(401, { error: 'unauthorized' });
    throw e;
  }
  const { token, expiresAt } = await issueSessionToken(
    { sub: user.userKey, email: user.email, provider: user.provider },
    secret,
    (deps.now ?? Date.now)(),
  );
  return json(200, { sessionToken: token, expiresAt, sub: user.userKey, email: user.email, provider: user.provider });
}

export async function handleRequest(request: Request, env: Env, deps: Deps): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === SESSION_PATH) {
    if (request.method !== 'POST') {
      const res = json(405, { error: 'method-not-allowed' });
      res.headers.set('Allow', 'POST');
      return res;
    }
    try {
      return await createSession(request, env, deps);
    } catch (e) {
      console.error('backup-worker error', e);
      return json(503, { error: 'unavailable' });
    }
  }
  if (pathname !== BACKUP_PATH) return json(404, { error: 'not-found' });
  if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
    const res = json(405, { error: 'method-not-allowed' });
    res.headers.set('Allow', 'GET, PUT, DELETE');
    return res;
  }

  try {
    const user = await authenticate(request, env, deps);
    if (!user) return json(401, { error: 'unauthorized' });

    // 행 식별은 사용자 키로만 — 이메일은 바뀌거나 재사용될 수 있다.
    switch (request.method) {
      case 'GET':
        return await getBackup(env, user.userKey);
      case 'PUT':
        return await putBackup(request, env, deps, user);
      default:
        return await deleteBackup(env, user.userKey);
    }
  } catch (e) {
    console.error('backup-worker error', e);
    // JWKS 를 못 받았거나 D1 이 일시 실패 — 앱은 재로그인 없이 나중에 재시도하면 된다.
    return json(503, { error: 'unavailable' });
  }
}
