# Safedrink

음주 후 혈중알코올농도(BAC)가 0이 될 때까지 남은 시간을 계산해주는 React Native(Expo) 앱.

> ⚠️ 이 앱은 참고용이며 법적·의학적 판단 기준이 아닙니다. 실제 알코올 분해 속도는 개인차가 크므로,
> 계산 결과와 무관하게 음주 후 운전은 하지 마세요.

## 주요 기능

- **타이머** — 오늘 마신 술을 기록하면 BAC가 0이 될 때까지 남은 시간을 실시간으로 보여줍니다.
- **음주 기록** — 맥주·소주·와인 등 프리셋으로 빠르게 추가하고, 도수·용량을 직접 입력하거나
  "나만의 술"을 프리셋으로 저장할 수 있습니다. "마시는중" 상태로 두었다가 나중에 완료 시각을 지정합니다.
- **BAC 그래프** — 시간에 따른 BAC 변화를 면허 정지(0.03%)·취소(0.08%) 기준선과 함께 표시합니다.
- **계획 모드** — 음주 *전에* 목표 시각을 정하면, 그 시각까지 BAC가 0이 되도록 마실 수 있는
  최대 음주량을 역산해 줍니다.
- **알림** — 분해 완료 시점에 로컬 알림을 보냅니다.
- **한국어 / 영어** 지원.

## 계산 모델

Widmark 식을 기반으로 하되, 기본값은 개인 체수분량을 반영한 값을 사용합니다.

- **BAC 계산** — 총량 기준 단순 분해: `현재 BAC = Σ(각 기록의 BAC) − 0.015 × (현재 − 첫 완료 시각)`, 0에서 클램프.
- **분포계수 r** — Watson 공식의 총체수분량(TBW)을 체중의 0.8로 나눈 값(성별·키·몸무게·나이 반영).
  결과가 0.4~0.9 범위를 벗어나면 상수 fallback(남 0.68 / 여 0.55)을 씁니다.
- **표준(Widmark) 비교값** — 성별 상수 r만 쓰는 보수적 추정치를 함께 표시해, 개인 맞춤 결과와 비교할 수 있습니다.
- 아직 "마시는중"인 기록은 BAC·그래프·알림 계산에서 제외되며, 완료 기록의 기준 시각은 완료 시각입니다.

계산 로직은 `src/core/`에 UI 의존성 없이 분리되어 있고, 61개의 단위 테스트로 검증합니다.

## 기술 스택

Expo SDK 57 · React Native 0.86 · TypeScript · expo-router(파일 기반 라우팅) ·
zustand(상태) · expo-sqlite(기록) + AsyncStorage(프로필·프리셋·로케일) ·
react-native-svg(그래프) · expo-notifications · i18n-js · EAS Update(OTA)

## 시작하기

```bash
npm install          # postinstall로 patch-package가 자동 적용됩니다
npx expo start
```

네이티브 모듈을 포함하므로 Expo Go가 아닌 **개발 빌드**가 필요합니다.

| 작업 | 명령 |
|------|------|
| 타입 체크 | `npx tsc --noEmit` |
| 테스트 | `npx jest` |
| 개발 서버 | `npx expo start` |
| iOS 실행 | `npx expo run:ios` |
| Android 실행 | `npx expo run:android` |
| Android 릴리스 APK | `cd android && ./gradlew assembleRelease` |
| OTA 게시 | `npx eas-cli update --channel preview --environment preview -m "메시지"` |

번들을 검증할 때 `expo export`는 `--platform ios`(또는 `android`)로 지정하세요 — 웹 타깃은 지원하지 않습니다.

### Android 빌드 참고

- **JDK 17이 필요합니다.** `android/gradle.properties`의 `org.gradle.java.home`이 Android Studio JBR로 고정돼 있습니다.
- `android/local.properties`에 `sdk.dir` 경로가 필요합니다.

### OTA(EAS Update)

runtimeVersion 정책이 `appVersion`이라, **네이티브 모듈을 추가·변경하면 버전을 올리고 새 바이너리를 배포해야 합니다**
(OTA는 JS와 에셋만 전달합니다). 채널은 development / preview / production이며,
앱 시작 시 자동으로 확인하고 즉시 적용합니다(`src/hooks/useOtaUpdates.ts`).
자세한 내용은 [`docs/OTA-UPDATE.md`](docs/OTA-UPDATE.md)를 참고하세요.

## 프로젝트 구조

```
src/
├── core/          # 순수 계산 로직 (bacCalculator, planCalculator, types) — UI 의존 없음
├── storage/       # expo-sqlite(기록) + AsyncStorage(프로필·프리셋·로케일)
├── services/      # notifications (expo-notifications 래핑)
├── state/         # zustand 스토어 (session/profile/presets/locale)
├── i18n/          # ko/en 딕셔너리 (i18n-js)
├── components/    # 공용 UI (character-image, bac-graph, floating-label-input, time-picker-sheet …)
├── hooks/         # useOtaUpdates
└── app/           # expo-router 라우트 (onboarding, (tabs)/{index,plan,settings}, add-drink, info)
```

개발 규칙과 알려진 함정은 [`CLAUDE.md`](CLAUDE.md)에 정리돼 있습니다.

## 이력

Flutter로 만든 원작을 React Native로 완전 이식한 버전입니다. 계산 결과는 원작과 1:1로 일치하도록
테스트 수치가 고정돼 있습니다(예: 남성 70kg/175cm가 맥주 500ml 4.5%를 마시면 BAC 0.03388%, 2.259시간).

## 라이선스

MIT — [`LICENSE`](LICENSE) 참고.
