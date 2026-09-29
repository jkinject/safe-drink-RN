import { beforeAll, describe, expect, it } from 'vitest';
import { handleRequest, MAX_BODY_BYTES, type Env } from '../src/handler';
import {
  appleClaims,
  baseClaims,
  CLIENT_ID,
  makeKey,
  memoryD1,
  NOW_MS,
  NOW_SEC,
  SESSION_SECRET,
  signToken,
  stubJwks,
  type TestKey,
} from './helpers';

const URL_BACKUP = 'https://safedrink-backup.example.workers.dev/backup';

let key: TestKey;
let otherKey: TestKey;
let appleKey: TestKey;
let token: string;

beforeAll(async () => {
  key = await makeKey('kid-1');
  otherKey = await makeKey('kid-other');
  appleKey = await makeKey('apple-kid-1');
  token = await signToken(key, baseClaims());
});

function setup() {
  const { db, rows } = memoryD1();
  const env: Env = { DB: db, GOOGLE_CLIENT_ID: CLIENT_ID, SESSION_SECRET };
  let now = NOW_MS;
  const deps = { fetchJwks: stubJwks([key.jwk]), fetchAppleJwks: stubJwks([appleKey.jwk]), now: () => now };
  const call = (method: string, init: { body?: BodyInit; token?: string | null; path?: string } = {}) => {
    const headers = new Headers();
    const t = init.token === undefined ? token : init.token;
    if (t) headers.set('Authorization', `Bearer ${t}`);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');
    const url = init.path ? URL_BACKUP.replace('/backup', init.path) : URL_BACKUP;
    return handleRequest(new Request(url, { method, headers, body: init.body }), env, deps);
  };
  return { call, rows, env, deps, setNow: (ms: number) => (now = ms) };
}

const payload = { profile: { gender: 'male', weightKg: 70 }, drinkRecords: [{ id: 1, finishedAt: null }] };

describe('인증', () => {
  it('Authorization 없음 → 401', async () => {
    const { call } = setup();
    const res = await call('GET', { token: null });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('만료 토큰 → 401', async () => {
    const { call } = setup();
    const expired = await signToken(key, baseClaims({ exp: NOW_SEC - 120 }));
    expect((await call('GET', { token: expired })).status).toBe(401);
  });

  it('aud 불일치 → 401', async () => {
    const { call } = setup();
    const t = await signToken(key, baseClaims({ aud: 'other-app' }));
    expect((await call('GET', { token: t })).status).toBe(401);
  });

  it('iss 불일치 → 401', async () => {
    const { call } = setup();
    const t = await signToken(key, baseClaims({ iss: 'https://evil.example.com' }));
    expect((await call('GET', { token: t })).status).toBe(401);
  });

  it('서명 위조 → 401', async () => {
    const { call } = setup();
    const forged = await signToken({ ...otherKey, kid: key.kid }, baseClaims());
    expect((await call('PUT', { token: forged, body: JSON.stringify({ schemaVersion: 1, payload }) })).status).toBe(401);
  });

  it('JWKS 를 못 받으면 401 이 아니라 503 (재로그인 불필요)', async () => {
    const { db } = memoryD1();
    const res = await handleRequest(
      new Request(URL_BACKUP, { headers: { Authorization: `Bearer ${token}` } }),
      { DB: db, GOOGLE_CLIENT_ID: CLIENT_ID },
      {
        fetchJwks: async () => {
          throw new Error('network');
        },
        fetchAppleJwks: stubJwks([appleKey.jwk]),
        now: () => NOW_MS,
      },
    );
    expect(res.status).toBe(503);
  });
});

describe('/backup', () => {
  it('백업이 없으면 GET 404', async () => {
    const { call } = setup();
    const res = await call('GET');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not-found' });
  });

  it('PUT → GET 왕복: payload·schemaVersion·updatedAt·email', async () => {
    const { call, rows } = setup();
    const put = await call('PUT', { body: JSON.stringify({ schemaVersion: 1, payload }) });
    expect(put.status).toBe(200);
    expect(put.headers.get('Cache-Control')).toBe('no-store');
    expect(await put.json()).toEqual({ updatedAt: NOW_MS });
    expect([...rows.keys()]).toEqual(['user-sub-1']);

    const get = await call('GET');
    expect(get.status).toBe(200);
    expect(get.headers.get('Cache-Control')).toBe('no-store');
    expect(await get.json()).toEqual({ schemaVersion: 1, updatedAt: NOW_MS, email: 'user@example.com', payload });
  });

  it('두 번째 PUT 은 같은 행을 덮어쓴다(사용자당 1행)', async () => {
    const { call, rows, setNow } = setup();
    await call('PUT', { body: JSON.stringify({ schemaVersion: 1, payload }) });
    setNow(NOW_MS + 30_000);
    const next = { ...payload, drinkRecords: [] };
    const put = await call('PUT', { body: JSON.stringify({ schemaVersion: 2, payload: next }) });
    expect(await put.json()).toEqual({ updatedAt: NOW_MS + 30_000 });
    expect(rows.size).toBe(1);
    expect(await (await call('GET')).json()).toMatchObject({ schemaVersion: 2, payload: next });
  });

  it('행은 sub 로만 구분된다 — 다른 사용자의 백업은 안 보인다', async () => {
    const { call } = setup();
    await call('PUT', { body: JSON.stringify({ schemaVersion: 1, payload }) });
    const other = await signToken(key, baseClaims({ sub: 'user-sub-2', email: 'user@example.com' }));
    expect((await call('GET', { token: other })).status).toBe(404);
  });

  it('email 클레임이 없으면 null 로 저장', async () => {
    const { call } = setup();
    const t = await signToken(key, baseClaims({ email: undefined }));
    await call('PUT', { token: t, body: JSON.stringify({ schemaVersion: 1, payload }) });
    expect(await (await call('GET', { token: t })).json()).toMatchObject({ email: null });
  });

  it('DELETE 후 GET 404, 없는 행 DELETE 도 204', async () => {
    const { call } = setup();
    await call('PUT', { body: JSON.stringify({ schemaVersion: 1, payload }) });
    const del = await call('DELETE');
    expect(del.status).toBe(204);
    expect(await del.text()).toBe('');
    expect((await call('GET')).status).toBe(404);
    expect((await call('DELETE')).status).toBe(204);
  });

  it('1MB 초과 본문 → 413', async () => {
    const { call, rows } = setup();
    const big = JSON.stringify({ schemaVersion: 1, payload: { blob: 'x'.repeat(MAX_BODY_BYTES) } });
    const res = await call('PUT', { body: big });
    expect(res.status).toBe(413);
    expect(rows.size).toBe(0);
  });

  it('Content-Length 없이 흘러 들어온 1MB 초과 본문도 413', async () => {
    const chunk = new TextEncoder().encode('x'.repeat(64 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > MAX_BODY_BYTES) return controller.close();
        sent += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const res = await handleStream(stream);
    expect(res.status).toBe(413);
  });

  it('잘못된 JSON → 400', async () => {
    const { call } = setup();
    const res = await call('PUT', { body: '{not json' });
    expect(res.status).toBe(400);
  });

  it('형식 불일치(schemaVersion 누락·payload 배열) → 400', async () => {
    const { call } = setup();
    expect((await call('PUT', { body: JSON.stringify({ payload }) })).status).toBe(400);
    expect((await call('PUT', { body: JSON.stringify({ schemaVersion: '1', payload }) })).status).toBe(400);
    expect((await call('PUT', { body: JSON.stringify({ schemaVersion: 1, payload: [] }) })).status).toBe(400);
    expect((await call('PUT', { body: JSON.stringify([1]) })).status).toBe(400);
  });

  it('다른 경로 404, 다른 메서드 405', async () => {
    const { call } = setup();
    expect((await call('GET', { path: '/other' })).status).toBe(404);
    const res = await call('POST', { body: '{}' });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, PUT, DELETE');
  });
});

const SESSION_URL = 'https://safedrink-backup.example.workers.dev/auth/session';

function postSession(env: Env, deps: Parameters<typeof handleRequest>[2], body: unknown, method = 'POST') {
  return handleRequest(
    new Request(SESSION_URL, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
    deps,
  );
}

describe('Apple ID 토큰 Bearer', () => {
  it('Apple 토큰으로 PUT → GET, 행 키는 apple:<sub>', async () => {
    const { call, rows } = setup();
    const t = await signToken(appleKey, appleClaims());
    expect((await call('PUT', { token: t, body: JSON.stringify({ schemaVersion: 1, payload }) })).status).toBe(200);
    expect([...rows.keys()]).toEqual(['apple:001234.abcdef0123456789.0123']);
    expect(await (await call('GET', { token: t })).json()).toMatchObject({
      email: 'abc123@privaterelay.appleid.com',
      payload,
    });
  });

  it('aud 불일치 → 401', async () => {
    const { call } = setup();
    const t = await signToken(appleKey, appleClaims({ aud: 'com.other.app' }));
    expect((await call('GET', { token: t })).status).toBe(401);
  });

  it('iss 불일치 → 401', async () => {
    const { call } = setup();
    const t = await signToken(appleKey, appleClaims({ iss: 'https://appleid.example.com' }));
    expect((await call('GET', { token: t })).status).toBe(401);
  });

  it('APPLE_BUNDLE_ID 로 aud 를 바꿀 수 있다', async () => {
    const { call, env } = setup();
    env.APPLE_BUNDLE_ID = 'com.safedrink.app, com.safedrink.dev';
    const t = await signToken(appleKey, appleClaims({ aud: 'com.safedrink.dev' }));
    expect((await call('GET', { token: t })).status).toBe(404);
  });

  it('Apple·Google 은 sub 가 같아도 서로 다른 행', async () => {
    const { call, rows } = setup();
    const apple = await signToken(appleKey, appleClaims({ sub: 'user-sub-1' }));
    await call('PUT', { token: apple, body: JSON.stringify({ schemaVersion: 1, payload }) });
    expect((await call('GET')).status).toBe(404); // Google user-sub-1 에게는 안 보인다
    await call('PUT', { body: JSON.stringify({ schemaVersion: 2, payload: {} }) });
    expect([...rows.keys()].sort()).toEqual(['apple:user-sub-1', 'user-sub-1']);
    expect(await (await call('GET', { token: apple })).json()).toMatchObject({ schemaVersion: 1, payload });
    await call('DELETE', { token: apple });
    expect([...rows.keys()]).toEqual(['user-sub-1']);
  });

  it('알 수 없는 alg(HS512 등) Bearer → 401', async () => {
    const { call } = setup();
    const t = await signToken(key, baseClaims(), { alg: 'HS512' });
    expect((await call('GET', { token: t })).status).toBe(401);
  });
});

describe('/auth/session', () => {
  it('Google 토큰으로 세션 발급 → 세션 토큰으로 PUT → GET (Google 행과 같은 키)', async () => {
    const { call, env, deps, rows } = setup();
    const res = await postSession(env, deps, { provider: 'google', token });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ sub: 'user-sub-1', email: 'user@example.com', provider: 'google' });
    expect(body.expiresAt).toBe((NOW_SEC + 180 * 86400) * 1000);
    const session = body.sessionToken as string;

    expect((await call('PUT', { token: session, body: JSON.stringify({ schemaVersion: 1, payload }) })).status).toBe(200);
    expect([...rows.keys()]).toEqual(['user-sub-1']);
    expect(await (await call('GET', { token: session })).json()).toMatchObject({ email: 'user@example.com', payload });
    // 기존 Google Bearer 로 봐도 같은 행
    expect((await call('GET')).status).toBe(200);
  });

  it('Apple 토큰으로 세션 발급 → Apple 토큰 만료 후에도 세션으로 PUT → GET', async () => {
    const { call, env, deps, rows, setNow } = setup();
    const apple = await signToken(appleKey, appleClaims());
    const res = await postSession(env, deps, { provider: 'apple', token: apple });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      sub: 'apple:001234.abcdef0123456789.0123',
      email: 'abc123@privaterelay.appleid.com',
      provider: 'apple',
    });
    const session = body.sessionToken as string;

    setNow(NOW_MS + 24 * 3600 * 1000); // 하루 뒤 — Apple 토큰은 이미 만료
    expect((await call('GET', { token: apple })).status).toBe(401);
    expect((await call('PUT', { token: session, body: JSON.stringify({ schemaVersion: 1, payload }) })).status).toBe(200);
    expect([...rows.keys()]).toEqual(['apple:001234.abcdef0123456789.0123']);
    expect(await (await call('GET', { token: session })).json()).toMatchObject({ payload });
  });

  it('만료된 세션 토큰 → 401', async () => {
    const { call, env, deps, setNow } = setup();
    const body = (await (await postSession(env, deps, { provider: 'google', token })).json()) as { sessionToken: string };
    setNow(NOW_MS + 181 * 86400 * 1000);
    expect((await call('GET', { token: body.sessionToken })).status).toBe(401);
  });

  it('다른 secret 으로 서명한 세션 토큰 → 401', async () => {
    const { call, env, deps } = setup();
    const body = (await (
      await postSession({ ...env, SESSION_SECRET: 'attacker-secret' }, deps, { provider: 'google', token })
    ).json()) as { sessionToken: string };
    expect((await call('GET', { token: body.sessionToken })).status).toBe(401);
  });

  it('SESSION_SECRET 이 없으면 발급 503, 세션 토큰 인증도 503', async () => {
    const { call, env, deps } = setup();
    const body = (await (await postSession(env, deps, { provider: 'google', token })).json()) as {
      sessionToken: string;
    };
    delete env.SESSION_SECRET;
    const res = await postSession(env, deps, { provider: 'google', token });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable' });
    expect((await call('GET', { token: body.sessionToken })).status).toBe(503);
    // Google Bearer 경로는 secret 과 무관
    expect((await call('GET')).status).toBe(404);
  });

  it('공급자 토큰 검증 실패 → 401', async () => {
    const { env, deps } = setup();
    const badAud = await signToken(appleKey, appleClaims({ aud: 'com.other.app' }));
    expect((await postSession(env, deps, { provider: 'apple', token: badAud })).status).toBe(401);
    const expired = await signToken(key, baseClaims({ exp: NOW_SEC - 120 }));
    expect((await postSession(env, deps, { provider: 'google', token: expired })).status).toBe(401);
    expect((await postSession(env, deps, { provider: 'google', token: 'not-a-jwt' })).status).toBe(401);
  });

  it('provider 와 토큰 발급자가 다르면 401 (JWKS 조회 없이)', async () => {
    const { env, deps } = setup();
    const apple = await signToken(appleKey, appleClaims());
    expect((await postSession(env, deps, { provider: 'google', token: apple })).status).toBe(401);
    expect((await postSession(env, deps, { provider: 'apple', token })).status).toBe(401);
    expect(deps.fetchJwks.calls).toEqual([]);
    expect(deps.fetchAppleJwks.calls).toEqual([]);
  });

  it('세션 토큰으로 세션을 다시 발급받을 수는 없다', async () => {
    const { env, deps } = setup();
    const body = (await (await postSession(env, deps, { provider: 'google', token })).json()) as {
      sessionToken: string;
    };
    expect((await postSession(env, deps, { provider: 'google', token: body.sessionToken })).status).toBe(401);
  });

  it('본문 형식 오류 → 400, POST 외 → 405', async () => {
    const { env, deps } = setup();
    expect((await postSession(env, deps, '{bad')).status).toBe(400);
    expect((await postSession(env, deps, { provider: 'facebook', token })).status).toBe(400);
    expect((await postSession(env, deps, { provider: 'google' })).status).toBe(400);
    const res = await postSession(env, deps, null, 'GET');
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });

  it('Apple JWKS 를 못 받으면 503', async () => {
    const { env, deps } = setup();
    const apple = await signToken(appleKey, appleClaims());
    const res = await postSession(
      env,
      {
        ...deps,
        fetchAppleJwks: async () => {
          throw new Error('network');
        },
      },
      { provider: 'apple', token: apple },
    );
    expect(res.status).toBe(503);
  });
});

// Request 에 스트림 본문을 실으려면 duplex 가 필요해 별도로 만든다.
async function handleStream(stream: ReadableStream<Uint8Array>): Promise<Response> {
  const { db } = memoryD1();
  const req = new Request(URL_BACKUP, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: stream,
    duplex: 'half',
  } as RequestInit);
  return handleRequest(
    req,
    { DB: db, GOOGLE_CLIENT_ID: CLIENT_ID },
    { fetchJwks: stubJwks([key.jwk]), fetchAppleJwks: stubJwks([appleKey.jwk]), now: () => NOW_MS },
  );
}
