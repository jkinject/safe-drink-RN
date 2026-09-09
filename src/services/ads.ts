import mobileAds from 'react-native-google-mobile-ads';

/**
 * Google Mobile Ads SDK 초기화. 앱 시작 시 한 번만 부른다.
 * 배너는 초기화 전에 마운트돼도 SDK 가 큐에 넣었다가 내보내므로 await 할 필요는 없다.
 * 실패해도 앱 기능과 무관하니 삼킨다.
 */
export function initialize(): Promise<void> {
  return mobileAds()
    .initialize()
    .then(() => undefined)
    .catch(() => undefined);
}
