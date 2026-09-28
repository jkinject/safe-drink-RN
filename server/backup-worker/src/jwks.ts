import type { FetchJwks, Jwk } from './auth';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

// Google 응답에 Cache-Control 이 없을 때 쓰는 기본 보존 시간(6시간)
const DEFAULT_MAX_AGE_SEC = 6 * 60 * 60;

// 강제 재조회(forceRefresh=true) 최소 간격. 인증 없이 임의 kid 를 반복 보내면
// auth.ts 가 매 요청마다 forceRefresh 를 요청하므로, 여기서 isolate 당 1회/60초로 눌러 둔다.
const MIN_FORCE_REFRESH_INTERVAL_MS = 60 * 1000;

export interface JwksFetcherDeps {
  fetch: typeof fetch;
  /** 보통 caches.default. 테스트에서는 Map 기반 스텁 */
  cache: Pick<Cache, 'match' | 'put'>;
  now?: () => number;
}

function maxAgeOf(res: Response): number {
  const m = /max-age=(\d+)/i.exec(res.headers.get('Cache-Control') ?? '');
  return m ? Number(m[1]) : DEFAULT_MAX_AGE_SEC;
}

function keysOf(body: unknown): Jwk[] {
  const keys = (body as { keys?: unknown } | null)?.keys;
  if (!Array.isArray(keys)) throw new Error('jwks-malformed');
  return keys as Jwk[];
}

// 요청마다 Google 에 가지 않도록 두 겹으로 캐시한다.
//  1) isolate 메모리 — 같은 isolate 가 이어 받는 요청은 Cache API 조회조차 없이 끝난다.
//     *.workers.dev 배포에서는 Cache API 가 효과가 없을 수 있어 이 층이 그 공백을 메운다.
//  2) caches.default — isolate 가 새로 떠도 같은 데이터센터 안에서는 재사용된다.
//     Cache API 는 넣는 응답의 Cache-Control 을 존중하므로 Google 의 max-age 를 그대로 실어 둔다.
export function createJwksFetcher(deps: JwksFetcherDeps): FetchJwks {
  const now = deps.now ?? Date.now;
  let memo: { keys: Jwk[]; expiresAt: number } | null = null;
  let lastForcedAt: number | null = null;

  return async (forceRefresh) => {
    // Request 는 전역 생성자가 준비된 요청 처리 중에 만든다(모듈 최상위 생성 회피).
    const cacheKey = new Request(GOOGLE_JWKS_URL);

    if (forceRefresh) {
      // 60초 안에 이미 강제 재조회를 했고 그때 받은 메모가 있으면 Google 을 다시 부르지 않고
      // 캐시된 키로만 판정한다 (kid 가 여전히 없으면 401). 메모가 아직 없으면(비정상 경로) 그대로 진행.
      if (memo && lastForcedAt !== null && now() - lastForcedAt < MIN_FORCE_REFRESH_INTERVAL_MS) {
        return memo.keys;
      }
      lastForcedAt = now();
    }

    if (!forceRefresh) {
      if (memo && memo.expiresAt > now()) return memo.keys;
      const cached = await deps.cache.match(cacheKey);
      if (cached) {
        const keys = keysOf(await cached.json());
        memo = { keys, expiresAt: now() + maxAgeOf(cached) * 1000 };
        return keys;
      }
    }

    const res = await deps.fetch(GOOGLE_JWKS_URL);
    if (!res.ok) throw new Error(`jwks-fetch-failed:${res.status}`);
    const text = await res.text();
    const keys = keysOf(JSON.parse(text));
    const maxAge = maxAgeOf(res);

    memo = { keys, expiresAt: now() + maxAge * 1000 };
    // 원 응답을 그대로 넣지 않고 필요한 헤더만 담아 새로 만든다 — Vary·Set-Cookie 등이
    // 섞이면 Cache API 가 저장을 거부할 수 있다.
    await deps.cache.put(
      cacheKey,
      new Response(text, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` },
      }),
    );
    return keys;
  };
}
