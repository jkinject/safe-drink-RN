# safedrink-backup (Cloudflare Worker + D1)

Safedrink 앱의 Google 계정 연동 백업 API. 사용자당 스냅샷 1행을 D1 에 저장한다.
**Workers Free + D1 Free 만 사용한다** — 유료 바인딩·Durable Objects·Queues·KV 없음.

앱과는 독립된 npm 프로젝트다. 루트 `tsconfig.json` 은 `server` 를 exclude 하고, 테스트 파일은
`*.vitest.ts` 라 루트 jest(`*.test.ts`)가 잡지 않는다.

## 요구 사항

- **Node 22.12+** (`.nvmrc`). wrangler 4.x·vitest 5 가 Node 22 이상을 요구한다. 앱 루트(Node 20)와 다르니 이 폴더에서는 `nvm use` 먼저.
- Cloudflare 계정(무료).

## API

모든 요청에 `Authorization: Bearer <Google ID 토큰>` 필수. 경로는 `/backup` 하나.

| 메서드 | 요청 | 응답 |
|--------|------|------|
| GET | — | 200 `{schemaVersion, updatedAt, email, payload}` / 404 `{error:'not-found'}` |
| PUT | `{schemaVersion: number(정수), payload: object}` | 200 `{updatedAt}` (서버 시각 ms, 같은 사용자 행 덮어쓰기) |
| DELETE | — | 204 (행이 없어도 204) |

| 상태 | 의미 |
|------|------|
| 400 | JSON 파싱 실패 또는 형식 불일치 (`invalid-json` / `invalid-body`) |
| 401 | 토큰 없음·형식 오류·서명 불일치·`iss`/`aud` 불일치·만료 (`unauthorized`) → 앱은 재로그인 |
| 404 / 405 | 다른 경로 / 다른 메서드 |
| 413 | 본문 1MB(1,048,576 bytes) 초과 |
| 503 | Google JWKS 조회 실패·D1 일시 오류 (`unavailable`) → 앱은 재로그인 없이 나중에 재시도 |

모든 응답에 `Cache-Control: no-store`.

### 토큰 검증

- RS256 서명 — JWKS `https://www.googleapis.com/oauth2/v3/certs`, WebCrypto(`RSASSA-PKCS1-v1_5`)만 사용(외부 JWT 라이브러리 없음, CPU 10ms 한도).
- `iss` ∈ {`accounts.google.com`, `https://accounts.google.com`}
- `aud` ∈ `GOOGLE_CLIENT_ID`(쉼표로 여러 개). **비어 있으면 모든 요청이 401.**
- `exp` > 현재 − 60초(시계 차이 허용)
- 행 식별은 `sub` 만. `email` 은 표시용으로 저장(없으면 null).
- JWKS 는 isolate 메모리 + `caches.default` 두 겹으로 캐시(Google 응답의 `Cache-Control: max-age`, 없으면 6시간). 토큰의 `kid` 가 캐시에 없으면 1회만 새로 받는다(키 회전 대응).
  `*.workers.dev` 에서는 Cache API 가 효과가 없을 수 있어 메모리 층이 이를 메운다.

## 배포 절차

```bash
cd server/backup-worker
nvm use            # Node 22
npm install

# 1. Cloudflare 로그인 (브라우저가 열린다)
npx wrangler login

# 2. D1 데이터베이스 생성 — 출력의 database_id 를 복사
npx wrangler d1 create safedrink-backup

# 3. wrangler.toml 의 database_id = "<채워 넣을 것>" 을 2번 값으로 교체

# 4. 스키마 적용 (원격)
npx wrangler d1 execute safedrink-backup --remote --file=schema.sql

# 5. wrangler.toml [vars] GOOGLE_CLIENT_ID 설정
#    Google Cloud 의 OAuth "웹 클라이언트 ID"(앱의 webClientId 와 같은 값 — Android 에서 받은 ID 토큰의 aud 가 이것).
#    공개값이라 secret 이 아니라 vars 로 충분하다. 여러 개면 쉼표로 구분.
#    GOOGLE_CLIENT_ID = "1234-abc.apps.googleusercontent.com"

# 6. 배포
npx wrangler deploy

# 7. 출력의 https://safedrink-backup.<계정 서브도메인>.workers.dev 확인
curl -i https://safedrink-backup.<서브도메인>.workers.dev/backup   # → 401 {"error":"unauthorized"} 이면 정상
```

스키마를 바꾸면 `schema.sql` 을 고치고 4번을 다시 실행한다(현재는 `CREATE TABLE IF NOT EXISTS` 라 재실행해도 안전).

## 무료 한도 근거

| 항목 | 무료 한도 | 이 API 사용량 |
|------|-----------|----------------|
| Workers 요청 | 100,000 요청/일 | 백업·복원·삭제 1회 = 1요청 |
| Workers CPU | 10ms/호출 | JSON 파싱 + RSA 서명 검증 1회. JWKS 는 캐시 |
| D1 행 쓰기 | 100,000 행/일 | 백업 1회 = 쓰기 1행 (upsert 한 번, 사전 조회 없음) |
| D1 행 읽기 | 5,000,000 행/일 | 복원 1회 = 읽기 1행 (PK 조회) |
| D1 저장 | 5GB (DB 당 500MB) | 사용자당 1행, 본문 상한 1MB (`WITHOUT ROWID` — TEXT PK 라 별도 rowid 인덱스로 중복 저장하지 않음) |

앱은 사용자당 최소 30초 디바운스로만 업로드하므로, 하루 10만 쓰기 한도 안에서 수천 명 규모까지 충분하다.
한도를 넘으면 Workers Free 는 요청을 거부할 뿐 과금되지 않는다.

## 로컬 개발·테스트

```bash
npm test                 # vitest (node 환경, D1·JWKS 는 스텁)
npm run typecheck        # src(Workers 타입) + test 각각 tsc
npx tsc --noEmit         # src 만

# 로컬 D1 + workerd 로 실행
npx wrangler d1 execute safedrink-backup --local --file=schema.sql
npx wrangler dev --var GOOGLE_CLIENT_ID:<웹 클라이언트 ID>
# → http://localhost:8787/backup
```

`wrangler dev` 는 기본적으로 로컬 D1(`.wrangler/state`)을 쓴다. 실제 Google ID 토큰으로 호출하려면
앱(또는 OAuth Playground)에서 받은 토큰을 `Authorization: Bearer` 로 넣는다.

## 구조

```
src/
├── index.ts     # Workers 진입점 — caches.default·fetch 를 묶어 handleRequest 에 주입
├── handler.ts   # 라우팅·본문 검증·D1 쿼리 (handleRequest(request, env, deps))
├── auth.ts      # verifyGoogleIdToken(token, {clientIds, fetchJwks}) — WebCrypto RS256
└── jwks.ts      # JWKS 조회 + 메모리/Cache API 캐시
test/            # *.vitest.ts — 로컬 생성 RSA 키로 토큰 서명, 인메모리 D1 스텁
schema.sql
```
