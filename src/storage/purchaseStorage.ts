import AsyncStorage from '@react-native-async-storage/async-storage';

const ADS_REMOVED_KEY = 'ads_removed';

/**
 * "광고 제거" 구매 여부 캐시.
 *
 * 진짜 근거는 스토어의 구매 내역이지만, 앱 시작 직후 스토어 연결을 기다리는 동안
 * 배너가 잠깐 떴다 사라지는 걸 막으려고 마지막 확인 결과를 저장해 둔다.
 * 스토어 조회가 끝나면 그 결과로 덮어쓴다.
 */
export async function loadAdsRemoved(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ADS_REMOVED_KEY);
  return v === 'true';
}

export async function saveAdsRemoved(removed: boolean): Promise<void> {
  await AsyncStorage.setItem(ADS_REMOVED_KEY, removed ? 'true' : 'false');
}
