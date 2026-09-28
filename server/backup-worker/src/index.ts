import { handleRequest, type Env } from './handler';
import { createJwksFetcher } from './jwks';

// isolate 가 살아 있는 동안 JWKS 메모리 캐시를 공유하려고 모듈 범위에 하나만 둔다.
let fetchJwks: ReturnType<typeof createJwksFetcher> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // caches.default 는 요청 처리 중에만 접근이 보장되므로 첫 요청 때 만든다.
    fetchJwks ??= createJwksFetcher({ fetch: (input, init) => fetch(input, init), cache: caches.default });
    return handleRequest(request, env, { fetchJwks });
  },
} satisfies ExportedHandler<Env>;
