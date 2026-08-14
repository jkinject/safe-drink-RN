/**
 * expo-notifications 래핑 — BAC 0 도달 알림 예약/취소
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const SOBER_NOTIFICATION_ID = 'safedrink_sober';
const CHANNEL_ID = 'safedrink_sober';
const CHANNEL_NAME = '음주 분해 알림';
const CHANNEL_DESCRIPTION = 'BAC 0 도달 예정 시각 알림';

/** 초기화 — Android 채널 생성 + 핸들러 설정 */
export async function initialize(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: CHANNEL_NAME,
      description: CHANNEL_DESCRIPTION,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#208AEF',
    });
  }
}

/** iOS/Android 알림 권한 요청 */
export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

/**
 * BAC 0 도달 예정 시각에 알림 예약
 *
 * @param soberAtMs 회복 예정 시각 (epoch ms)
 * @param title 알림 제목 (로케일에 맞는 문자열)
 * @param body 알림 본문 (로케일에 맞는 문자열)
 */
export async function scheduleSoberNotification(
  soberAtMs: number,
  { title, body }: { title: string; body: string },
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: SOBER_NOTIFICATION_ID,
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(soberAtMs),
    },
  });
}

/** 예약된 모든 알림 취소 */
export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
