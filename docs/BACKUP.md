# Google 계정 연동 백업

스펙: `.omc/specs/deep-interview-google-backup-d1.md`. 이 문서는 앱 쪽 Google 로그인(라이브러리·OAuth 설정)을 다룬다.

## 설정값

| 키 | 어디서 | 설명 |
|----|--------|------|
| `EXPO_PUBLIC_BACKUP_API_URL` | `.env.local` / EAS 환경변수 | 백업 Worker 주소(`https://….workers.dev`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `.env.local` / EAS 환경변수 | **웹 애플리케이션** OAuth 클라이언트 ID. ID 토큰의 `aud` = Worker 의 `GOOGLE_CLIENT_ID` |

- 코드: `src/config/backup.ts`. 둘 중 하나라도 비면 `BACKUP_SUPPORTED=false` → 백업 UI·SDK 초기화 전부 건너뛰고 1.2.x 와 똑같이 동작한다.
- 형식은 `.env.example` 참고. 값을 바꾼 뒤 로컬 릴리스 APK 를 다시 빌드할 땐 `android/app/build/generated/assets`·`generated/res` 를 지울 것(CLAUDE.md).
- 앱 서비스: `src/services/googleAuth.ts` — `configure()` / `signIn()` / `getIdToken()` / `signOut()`, 에러는 `GoogleAuthError.code`(`cancelled | reauth | network | unknown`).
  - `getIdToken()` 은 `getTokens()` 가 아니라 `signInSilently()` 로 받는다. Android `getTokens()` 는 마지막 로그인 때 캐시된 idToken(유효 1시간)을 그대로 돌려줘 만료돼 있을 수 있고, 쓰지 않는 액세스 토큰까지 따로 받는다.
  - `sub` 는 idToken payload 를 디코드해 읽기만 한다. 서명·`aud`·`iss`·`exp` 검증은 Worker 가 한다.
- jest: 루트 `__mocks__/@react-native-google-signin/google-signin.ts` 가 자동으로 대체한다(기본 응답 = 로그인 안 됨).

## 라이브러리 선정

**`@react-native-google-signin/google-signin` 16.1.5 (무료 공개판, 고정 버전)** — Original Google Sign-In 흐름.

| 기준 | google-signin 16.1.5 | expo-auth-session |
|------|----------------------|-------------------|
| 무료 | O (MIT 공개판. Credential Manager/One Tap 은 유료 판 전용이라 안 씀) | O |
| RN 0.86·Kotlin 2.1 빌드 | O — 아래 빌드 결과. Kotlin 은 프로젝트 `kotlinVersion` 을 그대로 쓰고, 네이티브 의존성은 `play-services-auth:21.4.0`(Java) 하나뿐 | 네이티브 없음(expo-web-browser 재사용) |
| ID 토큰 | `signIn()`/`signInSilently()` 결과의 `data.idToken` (`aud` = webClientId) | 가능하나 Google 이 네이티브 앱의 커스텀 스킴 리디렉션을 막는 추세라 Android 클라이언트는 사실상 웹 흐름 불가, 웹 클라이언트 + 프록시가 필요 |
| UX | 시스템 계정 선택 시트, 브라우저 안 띄움 | 브라우저(커스텀 탭) 전환 |
| 조용한 갱신 | `signInSilently()` — 백그라운드 자동 백업에 필수 | refresh token 을 앱이 직접 보관·갱신해야 함 |
| prebuild 후 유지 | O — Android 는 autolinking 만으로 붙는다(아래 참고) | O |

결론: 백그라운드 자동 백업에 "UI 없이 신선한 ID 토큰"이 필요해서 `signInSilently()` 가 있는 google-signin 이 맞다.
Original Google Sign-In(`GoogleSignInClient`)은 Google 이 deprecated 로 표시했지만 동작은 유지되고 있다. 막히면 유료 판(Credential Manager)이나 Credential Manager 를 직접 감싼 로컬 Expo 모듈로 옮긴다 — 앱은 `googleAuth.ts` 만 바꾸면 된다.

### app.json config plugin 을 넣지 않은 이유

이 라이브러리의 config plugin 은 두 모드뿐이다.
- 옵션 없이 쓰면 **Firebase 모드** — `google-services.json` / `GoogleService-Info.plist` 를 복사하고 google-services Gradle 플러그인을 건다. 우리는 Firebase 를 안 쓰므로 파일이 없어 전부 no-op.
- 옵션을 주면 `iosUrlScheme`(필수) 를 iOS Info.plist 에 넣는 일만 한다. **Android 에는 아무것도 하지 않는다.**

Android 는 autolinking 으로 네이티브 모듈이 붙고, 클라이언트 식별은 패키지명 + 서명 SHA-1(Google Cloud 쪽 등록)로 하므로 매니페스트·Gradle 설정이 필요 없다. 이번 범위는 Android 뿐이라 플러그인 항목을 넣지 않았다.
**iOS 를 붙일 때** `["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<iOS 클라이언트 ID 앞부분>" }]` 를 plugins 에 추가하고 iOS OAuth 클라이언트를 만든다.

### Android 빌드 검증 (2026-09-28)

- `npm install --save-exact @react-native-google-signin/google-signin@16.1.5` (npm latest = 16.1.5, peer `expo >=52.0.40`). postinstall `patch-package` 3개(expo-live-activity·expo-modules-jsi·expo-notifications) 정상 적용.
- `LANG=en_US.UTF-8 npx expo prebuild --platform android --clean` → CLAUDE.md 대로 `local.properties`(sdk.dir)·`gradle.properties`(JDK 17 `org.gradle.java.home`)·AndroidManifest preview 채널 헤더 복구. `debug.keystore` 는 prebuild 전후 동일.
- `cd android && ./gradlew assembleRelease` → **BUILD SUCCESSFUL** (로그 `.omc/logs/us002-assembleRelease-3.log`). RN 0.86.2 / Kotlin 2.1.20 / AGP 8.12.0 / Gradle 9.3.1, `play-services-auth:21.4.0` 로 해석됨. "incompatible version of Kotlin metadata" 없음. APK dex 에 `RNGoogleSigninModule`·`GoogleSignIn` 클래스 포함 확인.
- `aapt2 dump permissions` → `USE_EXACT_ALARM`·`SYSTEM_ALERT_WINDOW` 없음. 새 권한도 없음(라이브러리가 권한을 추가하지 않는다).
- **함정: 첫 빌드는 Gradle 데몬 Metaspace 고갈로 실패했다**(`:expo-updates:kspReleaseKotlin` / `:expo-modules-core:lintVitalAnalyzeRelease` → "Metaspace", 로그 `us002-assembleRelease.log`). 라이브러리와 무관하게 모듈이 늘면서 기본값 `-XX:MaxMetaspaceSize=512m` 이 모자란 것. `android/gradle.properties` 의 `org.gradle.jvmargs` 를 `-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8` 로 올려 해결. 실패한 데몬은 `./gradlew --stop` 으로 안 죽고 `~/.gradle/caches/journal-1` 잠금을 쥔 채 남아 다음 빌드를 막았다(`Timeout waiting to lock journal cache … Owner PID`) — 그 PID 를 직접 kill 해야 한다. **prebuild 는 이 jvmargs 도 기본값으로 되돌리므로** prebuild 후 복구 목록에 추가할 것.

## Google Cloud OAuth 설정

Google Cloud Console(<https://console.cloud.google.com>) → 프로젝트 선택(없으면 생성) → **API 및 서비스**.

### 1. OAuth 동의 화면

**API 및 서비스 → OAuth 동의 화면**(신 UI 는 "Google 인증 플랫폼" → 브랜딩/대상).
- 사용자 유형 **외부**. 앱 이름 Safedrink, 지원 이메일, 개인정보처리방침 URL(`docs/privacy-policy.html` 의 GitHub Pages 주소), 개발자 연락처.
- 범위는 기본(`openid`, `email`, `profile`)만. 민감 범위가 없어서 Google 검증 심사는 필요 없다.
- **게시 상태가 "테스트"면 "테스트 사용자"에 등록한 계정만 로그인된다**(최대 100명, 그 외 계정은 오류). 폴드7·플립7 에 로그인할 계정을 넣어 둘 것. 실사용자 배포 전에 **"앱 게시"로 프로덕션 전환**해야 한다.

### 2. 웹 애플리케이션 클라이언트 (1개)

**사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 애플리케이션 유형: 웹 애플리케이션**.
- 이름 예: `Safedrink backup (web)`. 승인된 JavaScript 원본·리디렉션 URI 는 비워 둔다.
- 생성된 클라이언트 ID(`….apps.googleusercontent.com`)가
  - 앱의 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (→ `GoogleSignin.configure({ webClientId })`)
  - Worker 의 `GOOGLE_CLIENT_ID` (idToken 의 `aud` 검증 값)
  둘 다 **같은 값**이다. 클라이언트 보안 비밀번호는 쓰지 않는다(커밋 금지).

### 3. Android 클라이언트 (SHA-1 하나당 1개)

**OAuth 클라이언트 ID → 애플리케이션 유형: Android**, 패키지 이름 `com.safedrink.app`, SHA-1 인증서 디지털 지문.
**Android 클라이언트 하나에는 SHA-1 을 하나만 넣을 수 있다** → 아래 **SHA-1 4개**마다 클라이언트를 하나씩 만든다(총 4개).
앱 코드에는 Android 클라이언트 ID 를 넣지 않는다 — Google Play 서비스가 "패키지명 + 실행 중인 APK 의 서명 SHA-1" 로 맞는 클라이언트를 찾는다.
하나라도 빠진 서명으로 설치된 앱은 로그인 시 `DEVELOPER_ERROR`(code `10`, 앱에서는 `unknown`) 로 실패한다.

| # | 서명 키 | 쓰이는 곳 | SHA-1 |
|---|---------|-----------|-------|
| a | 로컬 `android/app/debug.keystore` | 로컬 `assembleRelease`/`assembleDebug` APK (폴드7·플립7 테스트) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| b1 | Play 앱 서명 키 — **새 양자내성 키(2026-08 부터)** | Play 스토어 설치본(실사용자) | `C7:0A:7E:DC:40:65:52:67:1C:A0:A6:88:7F:9A:FF:1B:4F:9B:D7:15` |
| b2 | Play 앱 서명 키 — 이전 키 | 키 전환 전에 받은 설치본·일부 기기 | `52:C9:83:D2:52:2E:D2:CB:AE:5F:76:7D:6C:C6:CE:F7:F9:C4:28:6D` |
| c | 업로드 키 | EAS 빌드 AAB 를 직접 설치(내부 공유 등)할 때 | `57:88:7D:81:B4:0B:A3:65:58:2D:7B:10:38:A4:5E:51:63:0B:48:0E` |

Play 앱 서명 키가 두 개인 이유: 2026-08 부터 Play 가 새(양자내성) 앱 서명 키를 쓰기 시작했고 이전 키도 여전히 표시된다. 어떤 키로 서명된 설치본이 돌아다닐지 앱이 고를 수 없으므로 **둘 다 등록**한다.

**(a) debug.keystore** — 확인 명령(JDK 17 의 keytool):
```sh
"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" -list -v \
  -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```
- SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (SHA-256 `FA:C6:17:45:…:03:3B:9C`). React Native 템플릿 기본 debug 키라 `expo prebuild --clean` 후에도 같은 파일이 다시 생성된다 — 2026-09-28 prebuild 전후 파일이 바이트 단위로 같음을 확인.
- 이 키는 공개된 키라 같은 SHA-1 을 다른 사람도 가질 수 있다. 테스트 편의용이며, 서버는 어차피 idToken 의 서명·`aud` 로만 사용자를 판별하므로 백업 데이터 접근 보안과는 무관하다.

**(b1·b2) Play 앱 서명 키** — Play Console → Safedrink → **설정(테스트 및 출시 → 설정) → 앱 무결성 → 앱 서명** 탭 → "앱 서명 키 인증서"의 **SHA-1 인증서 지문**(새 키·이전 키 둘 다).
Play 는 업로드된 AAB 를 이 키로 다시 서명해 배포하므로, 스토어 설치본은 이 SHA-1 로 식별된다. **실사용자 로그인에 필수.** 키가 또 바뀌면 이 화면에서 새 SHA-1 을 확인해 Android 클라이언트를 추가한다.

**(c) 업로드 키** — 같은 화면의 "업로드 키 인증서" SHA-1.
EAS 가 관리하는 키이므로 `npx eas-cli credentials -p android` → production 프로필 → Keystore 에서도 SHA-1 을 볼 수 있다.

등록 후 반영까지 수 분~수십 분 걸릴 수 있다. `DEVELOPER_ERROR` 가 계속 나면 ① 패키지명 ② 설치된 APK 의 실제 서명(`apksigner verify --print-certs app.apk`) ③ webClientId 가 **웹** 클라이언트 ID 인지 ④ 테스트 사용자 등록 여부를 순서대로 확인.

## 아키텍처

```
앱 (Android)                          Cloudflare (무료 플랜)
┌──────────────────────────┐          ┌──────────────────────┐
│ googleAuth (ID token)    │──Bearer─▶│ Worker safedrink-    │
│ backupStore / scheduler  │  PUT/GET │  backup              │
│ snapshot (build/apply)   │  DELETE  │  · JWKS 서명 검증     │
│ SQLite + AsyncStorage    │◀─JSON────│  · aud = 웹 클라이언트 │
└──────────────────────────┘          │ D1 backups (1행/사용자)│
                                      └──────────────────────┘
```

- 클라이언트: `src/services/backup/{snapshot,api,scheduler,notifyChange,format}.ts`, `src/state/backupStore.ts`, `src/storage/backupStorage.ts`, `src/services/googleAuth.ts`, UI `src/components/{google-signin-button,backup-section}.tsx`, 온보딩 `src/app/onboarding.tsx`.
- 서버: `server/backup-worker/` (**Node 22 필수** — `nvm use` 후 작업). API·배포 절차는 그 안의 README.md.
- 스냅샷 방식: 사용자당 최신본 1개. 복원 = 로컬 전체 교체(병합 없음). `schemaVersion` 으로 앞뒤 호환 판정.
- 자동 백업: 데이터 변경 → `notifyBackupChange()` → 30초 디바운스 → 업로드. 앱이 백그라운드로 가면 즉시 flush. 업로드·복원·삭제는 mutex 로 직렬화. 로그인 안 한 사용자는 네트워크 호출 0.
- 온보딩 복원 흐름에서는 결정(복원/교체/취소) 전까지 업로드가 보류되고 계정도 저장되지 않는다(빈 로컬이 서버 백업을 덮어쓰지 않도록).

## 환경변수 한눈에

| 어디 | 키 | 값 |
|---|---|---|
| 앱 (.env.local / EAS env) | `EXPO_PUBLIC_BACKUP_API_URL` | `https://safedrink-backup.jkinject.workers.dev` |
| 앱 | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | 웹 클라이언트 ID `532458443458-5m5naofpqk5ko9a8h0usbv4jaki72dmt.apps.googleusercontent.com` |
| Worker (wrangler.toml [vars]) | `GOOGLE_CLIENT_ID` | 위와 같은 값 |

둘 중 하나라도 비면 `BACKUP_SUPPORTED=false` 로 백업 UI·SDK 초기화가 전부 꺼진다. `EXPO_PUBLIC_*` 는 JS 번들에 구워지므로 OTA 로도 바꿀 수 있다.

## Google Cloud 실제 값 (2026-09-28 생성, 프로젝트 `safedrink`, 계정 jkinject@gmail.com)

| 클라이언트 | ID |
|---|---|
| Web (ID token audience) | `532458443458-5m5naofpqk5ko9a8h0usbv4jaki72dmt.apps.googleusercontent.com` |
| Android debug (5E:8F:…F6:25) | `532458443458-0n65dojm38faqa05q3h1ari8rcgm9oql.apps.googleusercontent.com` |
| Android Play signing 2026 PQC (C7:0A:…D7:15) | `532458443458-kfv9lcu4icspkjl54339tuipkke37r0m.apps.googleusercontent.com` |
| Android Play signing legacy (52:C9:…28:6D) | `532458443458-eejce7pkoe5s17c5rpoj33uhaet59ngo.apps.googleusercontent.com` |
| Android upload key (57:88:…48:0E) | `532458443458-p09j1pif256fob89v5q8snghr7cqmlk0.apps.googleusercontent.com` |

OAuth 동의 화면은 외부·프로덕션 게시(민감 범위 없음). Android 클라이언트 ID 는 코드에 쓰지 않는다 — Google 이 패키지+SHA-1 로 자동 매칭한다.

## 무료 한도 (공식 문서 2026-09 확인)

| 항목 | Workers Free | D1 Free | 비고 |
|---|---|---|---|
| 요청 | 100,000/일 | — | UTC 자정 초기화 |
| CPU | 10ms/호출 | — | RS256 검증 1ms 안팎 |
| 쓰기 | — | 100,000 행/일 | 백업 1회 = 1행 |
| 읽기 | — | 5,000,000 행/일 | |
| 저장 | — | 5GB (DB 당 500MB) | 사용자당 수백 KB |

KV 는 무료 쓰기가 1,000회/일(계정 전체)이라 자동 백업에 부적합해 D1 을 쓴다.

## 배포 순서

1. `cd server/backup-worker && nvm use && npm install`
2. `npx wrangler login` (Cloudflare 계정)
3. `npx wrangler d1 create safedrink-backup` → 출력의 `database_id` 를 wrangler.toml 에
4. `npx wrangler d1 execute safedrink-backup --remote --file=schema.sql`
5. `npx wrangler deploy` → `https://safedrink-backup.jkinject.workers.dev`
6. 앱 `.env.local` 의 `EXPO_PUBLIC_BACKUP_API_URL` 에 그 URL. EAS 빌드에는 EAS 환경변수(production/preview)로 같은 두 키를 넣는다.
7. `android/app/build/generated/assets`·`generated/res` 삭제 후 `cd android && ./gradlew assembleRelease`

## 실기기 테스트 절차 (폴드7·플립7만)

1. `adb devices` 로 대상 확인 → `adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk` (레노버 태블릿 금지)
2. 기록 몇 건 + 커스텀 프리셋 추가 + 언어 English → 설정 → 백업 → Google 로그인 → "마지막 백업: 방금"
3. 앱 삭제 → 재설치 → 온보딩 "이전에 쓰던 기록이 있나요?" → 로그인 → "백업을 찾았어요" → 복원 → 홈에서 기록·프리셋·프로필·언어 확인
4. 비행기 모드에서 기록 추가 → "백업하지 못했어요" → 네트워크 복구 → 포그라운드 복귀 시 재시도
5. 설정 → 백업 삭제 및 연동 해제 → 기기 데이터 유지·미연동 UI

## 알려진 제약

- 스냅샷 1개: 여러 기기 동시 사용·병합 없음. 나중 백업이 이전 백업을 덮어쓴다.
- iOS 미적용: `googleAuth` 는 Android 에서만 검증됐고 app.json 에 iOS 옵션(iosUrlScheme) 이 없다. iOS 에 붙일 때 `store/app-review-reply.md` 의 "no account" 문구도 고쳐야 한다.
- 새 바이너리 필수: google-signin 은 네이티브 모듈이라 1.3.0 부터. 1.2.x 런타임에 이 번들을 OTA 하면 시작 시 죽는다(runtimeVersion=appVersion 이라 자동 분리됨).
- 종단간 암호화 없음(전송 HTTPS, 저장 D1). 필요하면 후속.
- Play 데이터 안전 설문·개인정보처리방침·계정 삭제 URL 은 `store/play-listing.md` 체크리스트와 `docs/delete-account.html` 참고.
- Gradle: `expo prebuild` 가 `org.gradle.jvmargs` 를 기본값으로 되돌린다 → Metaspace 고갈로 빌드가 죽는다. prebuild 후 `-Xmx4g -XX:MaxMetaspaceSize=1g` 를 다시 넣을 것.
