import { Platform } from 'react-native';
import { BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

/**
 * AdMob 광고 단위 ID.
 *
 * 앱 ID(`ca-app-pub-…~…`)는 네이티브에 새겨지므로 app.json 의
 * `react-native-google-mobile-ads` 플러그인 옵션에 있다. 여기는 JS 에서 요청할
 * 광고 단위(`ca-app-pub-…/…`)만 둔다.
 *
 * 개발 빌드(__DEV__)는 Google 공식 테스트 단위를 쓴다 — 실단위로 개발 중에
 * 노출·클릭을 쌓으면 무효 트래픽으로 계정이 정지될 수 있다.
 */
const PRODUCTION_BOTTOM_BANNER_UNIT_ID: string | null = Platform.select({
  android: 'ca-app-pub-3101837066146809/3087280996',
  // iOS 는 앱스토어 등록 뒤 AdMob 에 앱을 추가할 예정. 그때 iOS 전용 단위를 여기 넣고
  // app.json 플러그인 옵션의 iosAppId 도 실제 값으로 바꾼다.
  default: null,
});

/**
 * 탭바 바로 위 하단 배너. null 이면 이 플랫폼에서는 광고를 아예 띄우지 않는다
 * (배너·광고 제거 구매 섹션 모두 숨김). 개발 빌드는 플랫폼과 무관하게 테스트 단위.
 */
export const BOTTOM_BANNER_UNIT_ID: string | null = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : PRODUCTION_BOTTOM_BANNER_UNIT_ID;

/** 이 빌드에서 광고(와 광고 제거 구매)를 제공하는지 */
export const ADS_SUPPORTED = BOTTOM_BANNER_UNIT_ID != null;

/**
 * 하단 배너 크기. 화면 폭에 맞춰 높이(50~90)가 정해지는 앵커드 적응형.
 * `LARGE_ANCHORED_ADAPTIVE_BANNER` 는 더 높아서 FAB·콘텐츠 영역을 잡아먹으므로
 * 일단 기본 크기를 쓴다. 바꾸면 화면 쪽은 손댈 것 없이 실측 높이가 따라간다.
 */
export const BOTTOM_BANNER_SIZE = BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
