import { handleRequest, type Env } from './handler';
import { APPLE_JWKS_URL, createJwksFetcher, GOOGLE_JWKS_URL } from './jwks';

// isolate 가 살아 있는 동안 JWKS 메모리 캐시를 공유하려고 모듈 범위에 발급자당 하나만 둔다.
let fetchJwks: ReturnType<typeof createJwksFetcher> | null = null;
let fetchAppleJwks: ReturnType<typeof createJwksFetcher> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // caches.default 는 요청 처리 중에만 접근이 보장되므로 첫 요청 때 만든다.
    const doFetch: typeof fetch = (input, init) => fetch(input, init);
    fetchJwks ??= createJwksFetcher({ url: GOOGLE_JWKS_URL, fetch: doFetch, cache: caches.default });
    fetchAppleJwks ??= createJwksFetcher({ url: APPLE_JWKS_URL, fetch: doFetch, cache: caches.default });
    return handleRequest(request, env, { fetchJwks, fetchAppleJwks });
  },
} satisfies ExportedHandler<Env>;
