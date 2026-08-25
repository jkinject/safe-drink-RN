import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMER_NOTIFICATION_KEY = 'timer_notification_enabled';

/**
 * 알림창 카운트다운 표시 여부.
 *
 * 기본값은 ON — 저장된 값이 없으면(신규 설치·기존 사용자) 켜진 것으로 본다.
 * 'false' 문자열이 명시적으로 저장된 경우에만 끈다.
 */
export async function loadTimerNotificationEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(TIMER_NOTIFICATION_KEY);
  return v !== 'false';
}

export async function saveTimerNotificationEnabled(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(TIMER_NOTIFICATION_KEY, enabled ? 'true' : 'false');
}
