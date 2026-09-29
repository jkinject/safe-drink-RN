# safedrink-backup (Cloudflare Worker + D1)

Safedrink 앱의 계정 연동 백업 API(Google·Sign in with Apple). 사용자당 스냅샷 1행을 D1 에 저장한다.
**Workers Free + D1 Free 만 사용한다** — 유료 바인딩·Durable Objects·Queues·KV 없음.

앱과는 독립된 npm 프로젝트다. 루트 `tsconfig.json` 은 `server` 를 exclude 하고, 테스트 파일은
`*.vitest.ts` 라 루트 jest(`*.test.ts`)가 잡지 않는다.

## 요구 사항

- **Node 22.12+** (`.nvmrc`). wrangler 4.x·vitest 5 가 Node 22 이상을 요구한다. 앱 루트(Node 20)와 다르니 이 폴더에서는 `nvm use` 먼저.
- Cloudflare 계정(무료).

## API

| 경로 | 메서드 | 인증 | 요청 | 응답 |
|------|--------|------|------|------|
| `/auth/session` | POST | 없음(본문의 공급자 토큰) | `{provider: 'google'\|'apple', token: <공급자 ID 토큰>}` | 200 `{sessionToken, expiresAt, sub, email, provider}` |
| `/backup` | GET | Bearer | — | 200 `{schemaVersion, updatedAt, email, payload}` / 404 `{error:'not-found'}` |
| `/backup` | PUT | Bearer | `{schemaVersion: number(정수), payload: object}` | 200 `{updatedAt}` (서버 시각 ms, 같은 사용자 행 덮어쓰기) |
| `/backup` | DELETE | Bearer | — | 204 (행이 없어도 204) |

`/auth/session` 응답: `sessionToken` 은 HS256 JWT, `expiresAt` 은 만료 시각(epoch **ms**, 발급 후 180일),
`sub` 는 아래 사용자 키, `email` 은 공급자가 준 이메일(없으면 null — Apple 은 두 번째 로그인부터 빠지고 private relay 주소일 수 있다).
`provider` 와 토큰 발급자(`iss`)가 다르면 401. 세션 토큰으로 세션을 다시 발급받을 수는 없다(만료되면 공급자 로그인부터).

| 상태 | 의미 |
|------|------|
| 400 | JSON 파싱 실패 또는 형식 불일치 (`invalid-json` / `invalid-body`) |
| 401 | 토큰 없음·형식 오류·서명 불일치·`iss`/`aud` 불일치·만료 (`unauthorized`) → 앱은 재로그인 |
| 404 / 405 | 다른 경로 / 다른 메서드 (`/backup` 은 `Allow: GET, PUT, DELETE`, `/auth/session` 은 `Allow: POST`) |
| 413 | 본문 1MB(1,048,576 bytes) 초과 |
| 503 | JWKS 조회 실패·D1 일시 오류·`SESSION_SECRET` 미설정 (`unavailable`) → 앱은 재로그인 없이 나중에 재시도 |

모든 응답에 `Cache-Control: no-store`.

### 인증 방식 (Bearer 3종)

`/backup` 은 `Authorization: Bearer <토큰>` 의 JWT 헤더 `alg` 로 경로를 가른다. 어느 경로든 결과는 `{userKey, email, provider}` 로 같다.

| 토큰 | alg | 판별 | 비고 |
|------|-----|------|------|
| 서버 세션 토큰 | HS256 | — | `/auth/session` 이 발급. `SESSION_SECRET` 으로 서명 검증, 만료 180일. **iOS(Apple)는 이것을 쓴다(권장)** |
| Google ID 토큰 | RS256 | `iss` = Google | 이미 배포된 Android 클라이언트 호환 경로. 그대로 유지 |
| Apple identity token | RS256 | `iss` = `https://appleid.apple.com` | 동작은 하지만 수명 10분이고 기기에서 조용히 갱신할 API 가 없다 → `/auth/session` 으로 바꿔 쓸 것 |

그 밖의 `alg`(none·HS512 등)는 401.

### 사용자 키 (`backups.user_sub`)

| 공급자 | 키 |
|--------|----|
| Google | 토큰 `sub` 그대로 (기존 행 호환) |
| Apple | `apple:<sub>` |

Google `sub` 는 숫자 문자열이라 `apple:` 로 시작할 수 없으므로 두 공급자의 행은 섞이지 않는다(같은 사람이 두 공급자로
로그인하면 백업도 두 개). 세션 토큰의 `sub` 에는 이 사용자 키가 그대로 들어 있다.

### 환경변수

| 이름 | 종류 | 설명 |
|------|------|------|
| `GOOGLE_CLIENT_ID` | `[vars]` | Google ID 토큰 `aud` 허용값(쉼표로 여러 개). **비어 있으면 Google 토큰은 전부 401** |
| `APPLE_BUNDLE_ID` | `[vars]` | Apple identity token `aud` 허용값(쉼표로 여러 개). 비어 있으면 `com.safedrink.app` |
| `SESSION_SECRET` | **secret** | 세션 토큰 HS256 서명 키. `wrangler.toml` 에 넣지 말 것. **비어 있으면 `/auth/session` 과 세션 토큰 인증이 503**(Google Bearer 는 영향 없음) |

`SESSION_SECRET` 을 바꾸면 발급된 세션 토큰이 전부 401 이 되어 iOS 사용자는 다시 로그인해야 한다.

### 토큰 검증

- 공급자 ID 토큰: RS256 서명, WebCrypto(`RSASSA-PKCS1-v1_5`)만 사용(외부 JWT 라이브러리 없음, CPU 10ms 한도).
  - Google — JWKS `https://www.googleapis.com/oauth2/v3/certs`, `iss` ∈ {`accounts.google.com`, `https://accounts.google.com`}, `aud` ∈ `GOOGLE_CLIENT_ID`
  - Apple — JWKS `https://appleid.apple.com/auth/keys`, `iss` = `https://appleid.apple.com`, `aud` ∈ `APPLE_BUNDLE_ID`.
    `email_verified` 는 문자열 `"true"` 로 오기도 하지만 email 은 표시용이라 판정에 쓰지 않는다.
  - `exp` > 현재 − 60초(시계 차이 허용)
- 세션 토큰: HS256(WebCrypto HMAC-SHA256), payload `{sub: <사용자 키>, email, provider, iat, exp}`, `exp` 가 지나면 401(시계 차이 허용 없음 — 서버가 발급).
- 행 식별은 사용자 키만. `email` 은 표시용으로 저장(없으면 null).
- JWKS 는 발급자별 페처가 isolate 메모리 + `caches.default` 두 겹으로 캐시(응답의 `Cache-Control: max-age`, 없으면 6시간).
  토큰의 `kid` 가 캐시에 없으면 1회만 새로 받는다(키 회전 대응). 강제 재조회 60초 간격 제한도 발급자별로 따로 센다.
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

# 6. 세션 토큰 서명 키(secret) 등록 — Sign in with Apple(iOS)이 쓰는 /auth/session 에 필요
#    wrangler.toml [vars] 에 넣지 말 것(저장소에 커밋된다). 값은 한 번 정하면 바꾸지 않는다(바꾸면 모든 세션 무효).
openssl rand -base64 48 | npx wrangler secret put SESSION_SECRET
#    (대화형으로 넣으려면 `npx wrangler secret put SESSION_SECRET` 후 `openssl rand -base64 48` 출력을 붙여 넣는다)
#    APPLE_BUNDLE_ID 는 wrangler.toml [vars] 에 이미 com.safedrink.app 으로 들어 있다.

# 7. 배포
npx wrangler deploy

# 8. 출력의 https://safedrink-backup.<계정 서브도메인>.workers.dev 확인
curl -i https://safedrink-backup.<서브도메인>.workers.dev/backup   # → 401 {"error":"unauthorized"} 이면 정상
curl -i -X POST https://safedrink-backup.<서브도메인>.workers.dev/auth/session \
  -H 'Content-Type: application/json' -d '{"provider":"apple","token":"x"}'   # → 401 이면 정상, 503 이면 SESSION_SECRET 미등록
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
cp .dev.vars.example .dev.vars   # SESSION_SECRET= 뒤에 `openssl rand -base64 48` 값을 채운다
npx wrangler dev --var GOOGLE_CLIENT_ID:<웹 클라이언트 ID>
# → http://localhost:8787/backup
```

`wrangler dev` 는 기본적으로 로컬 D1(`.wrangler/state`)을 쓴다. 실제 Google ID 토큰으로 호출하려면
앱(또는 OAuth Playground)에서 받은 토큰을 `Authorization: Bearer` 로 넣는다.

## 구조

```
src/
├── index.ts     # Workers 진입점 — caches.default·fetch 를 묶어 handleRequest 에 주입
├── handler.ts   # 라우팅(/backup, /auth/session)·인증 분기·본문 검증·D1 쿼리 (handleRequest(request, env, deps))
├── auth.ts      # verifyGoogleIdToken / verifyAppleIdToken — WebCrypto RS256
├── session.ts   # issueSessionToken / verifySessionToken — WebCrypto HMAC HS256
└── jwks.ts      # JWKS 조회 + 메모리/Cache API 캐시 (발급자별 페처)
test/            # *.vitest.ts — 로컬 생성 RSA 키로 토큰 서명, 인메모리 D1 스텁
schema.sql
```
