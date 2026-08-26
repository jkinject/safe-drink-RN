# Safedrink RN (React Native / Expo)

음주 후 혈중알코올농도(BAC)가 0이 될 때까지 남은 시간을 계산해주는 앱.
Flutter 원작(`~/Documents/projects/safe-drink`)의 완전 이식판이며, **앞으로의 개발은 이 폴더에서만 진행**한다.
Flutter 폴더는 계산 검증 수치·디자인 레퍼런스 참고용으로만 사용.

## 명령어

| 작업 | 명령 |
|------|------|
| 타입 체크 | `npx tsc --noEmit` |
| 테스트 (61+) | `npx jest` |
| 개발 서버 | `npx expo start` |
| iOS 시뮬레이터 빌드·실행 | `npx expo run:ios --device 0247D9DE-DC44-4617-B5A3-0AB05FF8E983` (iPhone 17) |
| Android 로컬 릴리스 APK | `cd android && ./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk` |
| OTA 게시 | `npx eas-cli update --channel preview --environment preview -m "메시지"` |

- **번들 검증 시 `expo export`는 `--platform ios`(또는 android)로** — web 타깃은 expo-sqlite wasm 미지원으로 제거됨 (app.json platforms: ios/android).
- 빌드/설치 명령을 파이프(`| tail`)로 자르면 실패가 가려진다 — 전체 로그를 남길 것.

## Android 빌드·기기

- **JDK: 반드시 17** — `android/gradle.properties`의 `org.gradle.java.home`이 Android Studio JBR로 고정되어 있음. 시스템 기본(JDK 25)으로 빌드하면 CMake 단계에서 "restricted method" 오류.
- `android/local.properties`: `sdk.dir=/Users/tim/Library/Android/sdk`
- adb는 PATH에 없음 → `~/Library/Android/sdk/platform-tools/adb`
- 무선 기기: `adb pair IP:페어링포트 코드` → **`adb mdns services`로 연결 포트 확인** → `adb connect IP:연결포트`. 페어링 포트와 연결 포트는 다르다(연결은 `_adb-tls-connect._tcp` 항목의 포트).
- 알려진 기기 (설치 대상은 아래 두 폰뿐):
  - **갤럭시 Z 폴드7 — SM-F966N (R3CY8031TKF), product `q7qksx`** — 192.168.200.111
  - **갤럭시 Z 플립7 — SM-F766N (R3CY7057FCY), product `b7sksx`** — 192.168.200.193
    - 모델 번호 SM-F9xx = 폴드, SM-F7xx = 플립. 둘 다 접히는 폰이라 헷갈리기 쉬우니 product 코드로 구분할 것(`q7q`=폴드, `b7s`=플립).
    - 무선 디버깅 포트는 재연결마다 바뀐다 → 페어링 후 `adb mdns services`로 확인.
  - **레노버 태블릿 TB331FC — 192.168.200.195:5555 — 설치 절대 금지.** (TCP 모드라 `adb connect`만으로 붙어버리므로, `adb devices` 결과를 확인하지 않고 `adb install`을 쏘면 여기로 들어간다. 항상 `-s <기기>`로 대상을 지정할 것.)
- **접히는 폰은 `exec-out screencap`이 깨진다** — 디스플레이가 2개라 PNG 앞에 "[Warning] Multiple displays..." 경고가 섞여 파일이 손상된다. `adb shell "screencap -p /sdcard/sc.png"` 후 `adb pull` 로 받을 것. 화면이 꺼져 있으면 캡처가 전부 검게 나오므로 `dumpsys display | grep mScreenState` 로 먼저 확인한다.

## OTA (EAS Update)

- **OTA 채널은 `eas.json` 프로필이 정한다. `app.json` 에 `updates.requestHeaders` 를 넣지 말 것** — 프로덕션 빌드가 preview 채널을 물어 실사용자에게 테스트 번들이 나간다.
- 로컬(비-EAS) 릴리스 빌드가 preview OTA 를 받게 하려면 `android/app/src/main/AndroidManifest.xml` 에 직접 넣는다 (이 파일은 `/android` 가 gitignore 라 로컬에만 남고 EAS 빌드에는 영향이 없다):
  ```xml
  <meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY"
             android:value="{&quot;expo-channel-name&quot;:&quot;preview&quot;}"/>
  ```

- EAS 프로젝트: `@jkinject/safe-drink-rn` (projectId `d4523f48-fc64-42d2-a324-64a6e6b6cee0`)
- runtimeVersion 정책: `appVersion` (app.json `version`) — **네이티브 모듈 추가/변경 시 version 올리고 새 바이너리 배포 필수** (OTA는 JS/에셋만 전달)
- 채널: development / preview / production (eas.json)
- 시작 시 자동 확인·즉시 적용: `src/hooks/useOtaUpdates.ts` (루트 레이아웃에서 호출)
- 상세: `docs/OTA-UPDATE.md`

## Android 권한 (Play 정책)

- **`USE_EXACT_ALARM` 금지.** Play 는 알람시계·캘린더가 핵심 기능인 앱에만 허용한다. 음주 타이머는 해당하지 않아 심사에서 막힌다. `app.json` 의 `blockedPermissions` 로 차단해 둔다.
- **`SYSTEM_ALERT_WINDOW` 금지.** 코드에서 쓰지 않는데 prebuild 가 매니페스트에 넣는다. 마찬가지로 `blockedPermissions` 로 차단 (`tools:node="remove"` 로 병합 단계에서 제거됨).
- `SCHEDULE_EXACT_ALARM` 은 유지한다. Android 14+ 는 기본 거부지만 expo-notifications 가 `canScheduleExactAlarms()` 로 가드하고 `setAndAllowWhileIdle` 로 폴백하므로 **예외가 나지 않는다** (`ExpoSchedulingDelegate.kt:105`). 거부 상태에서는 "이제 안전해요" 알림이 몇 분 늦을 수 있고, 알림창 카운트다운은 시스템 크로노미터라 영향 없다.
- 권한을 바꾼 뒤에는 `aapt2 dump permissions <APK>` 로 실제 산출물을 확인할 것 — app.json 만 고치고 `android/` 를 재생성하지 않으면 로컬 빌드에는 반영되지 않는다.

## 구조

```
src/
├── core/          # 순수 계산 로직 (bacCalculator, planCalculator, types) — UI 의존 금지
├── storage/       # expo-sqlite(기록) + AsyncStorage(프로필/프리셋/로케일)
├── services/      # notifications (expo-notifications 래핑)
├── state/         # zustand 스토어 (session/profile/presets/locale)
├── i18n/          # ko/en 딕셔너리 (i18n-js)
├── components/    # 공용 UI (character-image, bac-graph, floating-label-input, time-picker-sheet …)
├── hooks/         # useOtaUpdates
└── app/           # expo-router 라우트 (onboarding, (tabs)/{index,plan,settings}, add-drink, info)
```

## 도메인 규칙 (변경 금지에 가까움)

- **BAC 모델**: 순차 섭취 + 단일 β 소거 (`bacCalculator.ts` `accumulateUntil`). 시간순으로 훑으며 잔을 비우면 기여분을 더하고, 구간 사이는 `0.015 %/h` 로 깎고 0 클램프.
  - 기록별 개별 분해(`Σ max(0, bac_i − β·t_i)`)는 분해 속도가 N×β가 되는 수학적 오류라 **금지**. 누산 방식은 구간마다 β 항이 하나뿐이라 이에 해당하지 않는다.
  - 총량 일괄(`Σbac_i − β × (now − 첫 완료시각)`)로 되돌리지 말 것. 그래프가 첫 잔 시점부터 전체 합에서 시작해 계단이 사라지고, 잔 사이에 BAC 가 0 을 찍고 다시 마시면 "마시자마자 0" 이 나온다. 잔 사이에 0 을 찍지 않는 보통의 세션에서는 두 방식의 수치가 동일하다.
  - **`currentBac` vs `bacAt`**: `currentBac` 은 "지금" 전용으로, 기기 시계 역행 대비로 조회 시각을 마지막 완료 시각까지 앞당긴다. 과거 시점(그래프·`computePeakBac`)에는 `bacAt` 을 쓸 것 — `currentBac` 을 쓰면 곡선이 평평해진다.
- **r 계산**: 기본은 Watson TBW ÷ (체중×0.8) (성별·키·몸무게·출생연도 반영, birthYear 없으면 30세). r이 0.4~0.9 밖이면 상수 fallback(남 0.68/여 0.55). "표준(Widmark)" 상수 r 경로는 비교 표시 전용.
- **마시는중/다마심**: `finishedAt == null`이면 마시는중 → BAC·그래프·알림에서 제외. 완료 기록의 기준 시각은 `finishedAt`. **판정은 반드시 `== null`/`!= null`** (DB 재로드 시 null, 메모리 신규는 undefined — `=== undefined` 비교는 재시작 후 버그).
- **법령 뱃지**: BAC ≥0.08 "면허 취소", 0.03~0.08 "면허 정지", 미만은 표시 없음. 그래프 기준선도 동일 (0.08 빨강 / 0.03 주황).
- **테스트 수치는 Flutter판과 1:1** (예: 남 70kg/175cm 맥주 500ml 4.5% → BAC 0.03388%·2.259h). 계산 변경 시 두 프로젝트가 같이 틀어지지 않게 주의.
- 문구는 전부 `src/i18n` (ko/en) — 하드코딩 금지. 면책 배너는 항상 노출.

## 알려진 함정 / 이력

- **React Compiler 실험 기능 끔** (app.json experiments) — zustand v5와 충돌해 "Should have a queue" 렌더 오류. 다시 켜지 말 것.
- **patch-package**: `patches/expo-modules-jsi+*.patch` — 최신 Xcode Swift 타입 추론 버그 수정. postinstall로 자동 적용.
- **react-native-svg는 height 필수** — 없으면 높이 0으로 보이지 않음. BacGraph는 onLayout 실측 폭 기반 픽셀 렌더링 사용 (viewBox 스케일링 금지).
- **datetimepicker는 신 API** — `onValueChange`/`onDismiss` (onChange는 deprecated).
- **jest 타입**: `jest-types.d.ts`로 고정 (expo가 expo-env.d.ts를 재생성하며 참조를 지움).
- **expo 모듈은 기본적으로 프리빌트 AAR 로 링크된다** — `node_modules/<모듈>/local-maven-repo/` 에 .aar 가 있으면 Gradle 이 소스를 컴파일하지 않는다. patch-package 로 네이티브 소스를 고쳐도 **빌드에 반영되지 않는다**. 반영하려면 `package.json` 의 `expo.autolinking.android.buildFromSource` 에 모듈명을 넣어야 한다 (현재 expo-notifications 가 여기 등록돼 있다). 반영 여부는 `unzip -o APK 'classes*.dex'` 후 `strings -a` 로 패치 문자열을 찾아 확인할 것.
- **`npx expo prebuild` 는 `android/local.properties`·`gradle.properties` 의 JDK 고정과 아래 OTA 채널 헤더를 모두 지운다.** prebuild 후에는 `sdk.dir`, `org.gradle.java.home`(JDK 17), `expo-channel-name` 을 반드시 다시 넣을 것.
- 알림 카운트다운은 `patches/expo-notifications+*.patch` 로 `setChronometerCountDown` 을 붙여 구현했다. JS 에서 `data.chronometerAtMs` 로 목표 시각만 넘기면 시스템이 직접 1초씩 깎으므로 앱이 죽어도 정확하다. 남은 시간을 문자열로 구워 보내지 말 것.
- **Chronometer 는 0 에서 멈추지 않는다** — 목표 시각을 지나면 `-30:28` 처럼 음수로 계속 센다. 앱 프로세스가 죽어 있으면 JS 로 내릴 방법이 없으므로 취소도 시스템에 맡겨야 한다: 같은 패치에서 `setTimeoutAfter(남은 시간)` 을 건다. `setOngoing(true)` 와 함께 써도 취소된다.
- **patch-package 재생성 시 `node_modules/<모듈>/android/build` 를 먼저 지울 것.** 안 그러면 Gradle 산출물 수천 개가 패치에 섞여 들어간다(실제로 2.5MB 까지 불었다). 그리고 재생성 후에는 `grep '^diff --git' 패치` 로 **의도한 파일이 전부 들어갔는지** 확인할 것 — 새로 추가한 `res/values*/*.xml` 이 빠진 채 커밋돼 clean install 에서만 빌드가 깨진 적이 있다.
- 캐릭터 에셋(assets/images/character/, 10장)은 배경이 앱 배경색(#EEEDF8)으로 보정된 AI 생성 이미지. 재생성 파이프라인·레퍼런스는 Flutter 폴더(`design_refs/`, Replicate openai/gpt-image-2, 토큰 `~/.replicate_api_token`) 참조. 배경 보정은 flood fill 금지, 색 거리 기반 스무스 시프트만.

## 디자인 토큰

`src/constants/colors.ts` — 배경 #EEEDF8, 액센트 #6C63E0, 네이비 #2D2B52, 보조 #9E9AC8, 흰 카드 radius 16~20 + 연보라 그림자. 이모지 대신 생성 캐릭터 이미지 우선.
