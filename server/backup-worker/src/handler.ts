import { AuthError, parseClientIds, verifyGoogleIdToken, type FetchJwks, type GoogleClaims } from './auth';

export interface Env {
  DB: D1Database;
  /** OAuth 클라이언트 ID(공개값). 쉼표로 여러 개 — 웹·Android 클라이언트를 같이 받을 수 있다 */
  GOOGLE_CLIENT_ID: string;
}

export interface Deps {
  fetchJwks: FetchJwks;
  now?: () => number;
}

// 스냅샷 한 개의 상한. D1 행 한도(약 2MB) 안쪽으로 여유를 두고, 기록 수천 건도 이 안에 들어간다.
export const MAX_BODY_BYTES = 1_048_576;

const BACKUP_PATH = '/backup';

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

async function authenticate(request: Request, env: Env, deps: Deps): Promise<GoogleClaims | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '');
  if (!m) return null;
  try {
    return await verifyGoogleIdToken(m[1], {
      clientIds: parseClientIds(env.GOOGLE_CLIENT_ID),
      fetchJwks: deps.fetchJwks,
      now: deps.now,
    });
  } catch (e) {
    if (e instanceof AuthError) return null;
    // JWKS 네트워크 실패 등은 토큰 문제가 아니다 — 위로 올려 503 으로 구분한다.
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

async function getBackup(env: Env, sub: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT email, schema_version, updated_at, payload FROM backups WHERE user_sub = ?1',
  )
    .bind(sub)
    .first<BackupRow>();
  if (!row) return json(404, { error: 'not-found' });
  return json(200, {
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
    email: row.email,
    payload: JSON.parse(row.payload),
  });
}

async function putBackup(request: Request, env: Env, deps: Deps, claims: GoogleClaims): Promise<Response> {
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
    .bind(claims.sub, claims.email, parsed.schemaVersion, updatedAt, JSON.stringify(parsed.payload))
    .run();
  return json(200, { updatedAt });
}

async function deleteBackup(env: Env, sub: string): Promise<Response> {
  await env.DB.prepare('DELETE FROM backups WHERE user_sub = ?1').bind(sub).run();
  // 이미 없어도 204 — 앱의 "백업 삭제 및 연동 해제" 를 재시도해도 같은 결과가 나오게.
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleRequest(request: Request, env: Env, deps: Deps): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname !== BACKUP_PATH) return json(404, { error: 'not-found' });
  if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
    const res = json(405, { error: 'method-not-allowed' });
    res.headers.set('Allow', 'GET, PUT, DELETE');
    return res;
  }

  try {
    const claims = await authenticate(request, env, deps);
    if (!claims) return json(401, { error: 'unauthorized' });

    // 행 식별은 sub 로만 — 이메일은 바뀌거나 재사용될 수 있다.
    switch (request.method) {
      case 'GET':
        return await getBackup(env, claims.sub);
      case 'PUT':
        return await putBackup(request, env, deps, claims);
      default:
        return await deleteBackup(env, claims.sub);
    }
  } catch (e) {
    console.error('backup-worker error', e);
    // JWKS 를 못 받았거나 D1 이 일시 실패 — 앱은 재로그인 없이 나중에 재시도하면 된다.
    return json(503, { error: 'unavailable' });
  }
}
