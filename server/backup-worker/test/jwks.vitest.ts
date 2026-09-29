import { describe, expect, it } from 'vitest';
import { APPLE_JWKS_URL, createJwksFetcher, GOOGLE_JWKS_URL } from '../src/jwks';

const KEYS = { keys: [{ kid: 'a', kty: 'RSA', n: 'n', e: 'AQAB' }] };

// caches.default 를 흉내 내는 Map 기반 캐시. 만료는 흉내 내지 않고 저장된 헤더만 확인한다.
function memoryCache() {
  const store = new Map<string, Response>();
  return {
    store,
    async match(req: RequestInfo | URL) {
      const r = store.get(typeof req === 'string' ? req : (req as Request).url);
      return r ? r.clone() : undefined;
    },
    async put(req: RequestInfo | URL, res: Response) {
      store.set(typeof req === 'string' ? req : (req as Request).url, res.clone());
    },
  };
}

function countingFetch(cacheControl: string | null) {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cacheControl) headers['Cache-Control'] = cacheControl;
    return new Response(JSON.stringify(KEYS), { headers });
  }) as typeof fetch;
  return Object.assign(fn, { calls });
}

describe('createJwksFetcher', () => {
  it('처음엔 Google 에서 받고 Cache API 에 Google 의 max-age 로 넣는다', async () => {
    const cache = memoryCache();
    const fetch = countingFetch('public, max-age=19000, must-revalidate');
    const get = createJwksFetcher({ fetch, cache, now: () => 0 });
    expect(await get(false)).toEqual(KEYS.keys);
    expect(fetch.calls).toEqual([GOOGLE_JWKS_URL]);
    expect(cache.store.get(GOOGLE_JWKS_URL)?.headers.get('Cache-Control')).toBe('public, max-age=19000');
  });

  it('Cache-Control 이 없으면 6시간', async () => {
    const cache = memoryCache();
    const get = createJwksFetcher({ fetch: countingFetch(null), cache, now: () => 0 });
    await get(false);
    expect(cache.store.get(GOOGLE_JWKS_URL)?.headers.get('Cache-Control')).toBe('public, max-age=21600');
  });

  it('메모리·Cache API 에 있으면 다시 받지 않는다', async () => {
    const cache = memoryCache();
    const fetch = countingFetch('max-age=100');
    await createJwksFetcher({ fetch, cache, now: () => 0 })(false);
    // 새 isolate 를 흉내 — 메모리는 비었지만 Cache API 에는 남아 있다.
    let t = 0;
    const fresh = createJwksFetcher({ fetch, cache, now: () => t });
    expect(await fresh(false)).toEqual(KEYS.keys);
    t = 50_000;
    await fresh(false);
    expect(fetch.calls).toHaveLength(1);
  });

  it('forceRefresh 는 캐시를 건너뛰고 다시 받는다', async () => {
    const cache = memoryCache();
    const fetch = countingFetch('max-age=100');
    const get = createJwksFetcher({ fetch, cache, now: () => 0 });
    await get(false);
    await get(true);
    expect(fetch.calls).toHaveLength(2);
  });

  it('Google 응답 실패는 예외', async () => {
    const fetch = (async () => new Response('oops', { status: 500 })) as unknown as typeof globalThis.fetch;
    const get = createJwksFetcher({ fetch, cache: memoryCache(), now: () => 0 });
    await expect(get(false)).rejects.toThrow('jwks-fetch-failed:500');
  });

  it('60초 안의 두 번째 강제 재조회 미스는 Google 을 다시 부르지 않는다', async () => {
    const cache = memoryCache();
    const fetch = countingFetch('max-age=100');
    let t = 0;
    const get = createJwksFetcher({ fetch, cache, now: () => t });
    await get(false); // 최초 채움 (fetch 1회)
    await get(true); // kid 미스 → 강제 재조회 (fetch 2회)
    expect(fetch.calls).toHaveLength(2);

    t = 59_000; // 60초 안
    await expect(get(true)).resolves.toEqual(KEYS.keys); // 캐시된 키로만 판정, fetch 없음
    expect(fetch.calls).toHaveLength(2);
  });

  it('60초 뒤 강제 재조회는 다시 Google 을 부른다', async () => {
    const cache = memoryCache();
    const fetch = countingFetch('max-age=100');
    let t = 0;
    const get = createJwksFetcher({ fetch, cache, now: () => t });
    await get(false);
    await get(true);
    expect(fetch.calls).toHaveLength(2);

    t = 60_000; // 정확히 60초 후
    await get(true);
    expect(fetch.calls).toHaveLength(3);
  });

  it('발급자별 페처는 Cache API 키와 강제 재조회 간격을 따로 쓴다', async () => {
    const cache = memoryCache();
    const fetch = countingFetch('max-age=100');
    let t = 0;
    const google = createJwksFetcher({ url: GOOGLE_JWKS_URL, fetch, cache, now: () => t });
    const apple = createJwksFetcher({ url: APPLE_JWKS_URL, fetch, cache, now: () => t });
    await google(false);
    await apple(false);
    expect(fetch.calls).toEqual([GOOGLE_JWKS_URL, APPLE_JWKS_URL]);
    expect([...cache.store.keys()]).toEqual([GOOGLE_JWKS_URL, APPLE_JWKS_URL]);

    await google(true); // Google 강제 재조회
    t = 1_000;
    await apple(true); // Google 의 60초 간격에 묶이지 않는다
    expect(fetch.calls).toEqual([GOOGLE_JWKS_URL, APPLE_JWKS_URL, GOOGLE_JWKS_URL, APPLE_JWKS_URL]);
  });
});
