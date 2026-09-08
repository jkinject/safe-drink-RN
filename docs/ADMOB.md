# AdMob 배너 (탭바 위 하단 광고) · 광고 제거 인앱결제

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

## 광고 제거 인앱결제 (expo-iap)

설정 탭 → "광고" 섹션에 **광고 제거**(비소모성, 1회 결제)와 **구매 복원**이 있다.

| 항목 | 값 | 위치 |
|------|----|------|
| 상품 ID | `remove_ads` | `src/config/iap.ts` |
| 상품 종류 | 비소모성 (Non-Consumable / 관리되는 상품 1회성) | App Store Connect · Play Console 에 **같은 ID** 로 등록 |

- `src/services/iap.ts` — expo-iap 래퍼. 연결·상품 조회·구매·복원·리스너.
- `src/state/purchaseStore.ts` — `adsRemoved`(구매 여부)·`product`(가격)·`status`. 루트 레이아웃이 시작 시 `load()`(AsyncStorage 캐시) → `initialize()`(스토어 연결·보유 확인·리스너 구독) 순으로 부른다.
- `src/storage/purchaseStorage.ts` — 캐시 키 `ads_removed`. 스토어 조회가 끝나면 그 결과로 덮어쓴다(환불·계정 전환 대응).
- 탭 레이아웃은 `adsRemoved` 면 배너를 마운트하지 않는다.
- 구매 결과는 `requestPurchase` 반환값이 아니라 `purchaseUpdatedListener` 로 온다. 완료되면 `finishTransaction` 으로 마무리(Android 는 3일 안에 acknowledge 안 하면 자동 환불). 앱 밖에서 끝난 결제·재설치 후 재생되는 트랜잭션도 같은 리스너로 들어온다.
- 서버 영수증 검증은 없다(클라이언트 판단). 소액 1회 결제라 감수하는 구조이며, 부정 사용을 막아야 하면 `verifyPurchase` 로 서버 검증을 붙인다.

### 테스트

- **iOS 시뮬레이터**: `expo run:ios` 로 띄운 앱은 StoreKit 테스트 구성이 붙지 않아 상품 조회가 비어 "지금은 구매할 수 없어요" 로 보인다. 결제 흐름을 보려면 `ios/Safedrink.xcworkspace` 를 Xcode 로 열고 Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration 에 `storekit/Safedrink.storekit` 을 고른 뒤 Xcode 에서 실행한다. 이 파일에는 `remove_ads` 가 ₩3,300 으로 들어 있다.
- **실기기**: App Store Connect 에 상품을 만들고 Sandbox 테스터 계정으로, Android 는 Play Console 라이선스 테스터로 확인한다.
- 단위 테스트: `src/state/__tests__/purchaseStore.test.ts` (services/iap 목).

### 스토어 등록 체크리스트

- App Store Connect: 앱 → 인앱 구입 → 비소모성 `remove_ads`, 가격·현지화 입력, **심사용 스크린샷** 필수. 앱 심사 제출 시 인앱 구입을 같이 제출.
- Play Console: 수익 창출 → 제품 → 인앱 상품 `remove_ads` 활성화. 결제 라이브러리 권한(`com.android.vending.BILLING`)은 expo-iap 플러그인이 넣는다.

## 아직 안 한 것

- iOS ATT(App Tracking Transparency) 프롬프트·EU 동의(UMP). 지금은 프롬프트 없이 동작하며 IDFA 없이 비개인화에 가깝게 서빙된다. 넣을 땐 `AdsConsent.gatherConsent()` 를 쓰고 플러그인 옵션에 `userTrackingUsageDescription` 을 추가한다.
- App Store 개인정보 라벨·Play 데이터 보안 설문에 광고 SDK 수집 항목 반영.
