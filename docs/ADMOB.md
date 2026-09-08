# AdMob 배너 (탭바 위 하단 광고)

`react-native-google-mobile-ads` 로 세 탭 화면 공통의 탭바 바로 위에 앵커드 적응형 배너를 띄운다.

## ID

| 항목 | 값 | 위치 |
|------|----|------|
| 하단 배너 광고 단위 | `ca-app-pub-3101837066146809/3087280996` | `src/config/ads.ts` |
| **앱 ID (iOS/Android)** | **아직 미입력 — Google 샘플 앱 ID 로 채워져 있음** | `app.json` 플러그인 옵션 `iosAppId` / `androidAppId` |

- ⚠️ 앱 ID(`ca-app-pub-3101837066146809~XXXXXXXXXX`)는 AdMob 콘솔 → 앱 → 앱 설정에서 확인해 **출시 전에 반드시 교체**한다. 샘플 앱 ID 인 채로 실단위를 요청하면 광고가 채워지지 않는다(no-fill). 앱 ID 는 네이티브(Info.plist / AndroidManifest)에 새겨지므로 교체 후 `version` 을 올리고 새 바이너리를 내야 한다 — OTA 로는 못 바꾼다.
- 광고 단위 ID 는 AdMob 에서 플랫폼별로 따로 만드는 게 원칙이다. 지금은 iOS/Android 둘 다 같은 단위를 쓰도록 돼 있으니, 다른 플랫폼 단위가 생기면 `src/config/ads.ts` 의 `Platform.select` 에 나눠 넣는다.
- 개발 빌드(`__DEV__`)는 Google 공식 테스트 단위(`TestIds.ADAPTIVE_BANNER`)를 자동으로 쓴다. 실단위로 개발 중 노출·클릭이 쌓이면 무효 트래픽으로 계정이 정지될 수 있다. 시뮬레이터·에뮬레이터는 항상 테스트 기기로 취급된다.

## 구조

- `src/config/ads.ts` — 단위 ID·배너 크기 상수
- `src/services/ads.ts` — SDK 초기화 (루트 레이아웃에서 한 번 호출)
- `src/state/adStore.ts` — 로드된 배너의 실측 높이(`bottomBannerHeight`)
- `src/components/ad-banner.tsx` — `BottomAdBanner`. 로드 전엔 높이 0, 로드되면 높이를 스토어에 올리고, 실패하면 접었다가 60초 뒤 재요청
- `src/app/(tabs)/_layout.tsx` — 탭바가 `position: absolute` 라 배너도 같은 방식으로 `bottom: 탭바 높이` 에 띄운다
- 각 탭 화면(index/plan/settings)은 하단 스페이서(와 index 의 FAB)에 `useBottomBannerHeight()` 를 더한다. 새 탭 화면을 만들면 같은 처리를 넣을 것.

## 네이티브 반영

플러그인이 넣는 것: iOS `GADApplicationIdentifier` + `SKAdNetworkItems`, Android `com.google.android.gms.ads.APPLICATION_ID` 메타데이터.
`app.json` 의 플러그인 옵션을 바꾼 뒤에는 `npx expo prebuild --platform ios|android` 로 다시 생성해야 반영된다 (Android 는 prebuild 가 지우는 `local.properties`·`gradle.properties`·OTA 채널 헤더를 CLAUDE.md 대로 다시 넣을 것). 반영 여부는
`grep -A1 GADApplicationIdentifier ios/Safedrink/Info.plist` 로 확인.

## 아직 안 한 것

- iOS ATT(App Tracking Transparency) 프롬프트·EU 동의(UMP). 지금은 프롬프트 없이 동작하며 IDFA 없이 비개인화에 가깝게 서빙된다. 넣을 땐 `AdsConsent.gatherConsent()` 를 쓰고 플러그인 옵션에 `userTrackingUsageDescription` 을 추가한다.
- App Store 개인정보 라벨·Play 데이터 보안 설문에 광고 SDK 수집 항목 반영.
