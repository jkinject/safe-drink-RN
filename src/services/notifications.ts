/**
 * expo-notifications 래핑 — BAC 0 도달 알림 예약/취소
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const SOBER_NOTIFICATION_ID = 'safedrink_sober';
const CHANNEL_ID = 'safedrink_sober';
const CHANNEL_NAME = '음주 분해 알림';
const CHANNEL_DESCRIPTION = 'BAC 0 도달 예정 시각 알림';

/** 진행 중 카운트다운 알림 — 분해 완료 알림과 별개 */
const TIMER_NOTIFICATION_ID = 'safedrink_timer';
const TIMER_CHANNEL_ID = 'safedrink_timer';
const TIMER_CHANNEL_NAME = '술 깨는 시간 타이머';
const TIMER_CHANNEL_DESCRIPTION = '남은 시간을 알림창에 계속 표시';

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

    // 카운트다운은 계속 떠 있는 정보성 알림이라 소리·헤드업 없이 조용해야 한다.
    // 분해 완료 알림과 채널을 나눠야 사용자가 한쪽만 끌 수도 있다.
    await Notifications.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
      name: TIMER_CHANNEL_NAME,
      description: TIMER_CHANNEL_DESCRIPTION,
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0],
      showBadge: false,
    });
  }
}

/**
 * 진행 중 카운트다운 알림을 띄운다 (Android 전용).
 *
 * 남은 시간을 문자열로 굽지 않고 목표 시각만 넘긴다 — 네이티브 패치가
 * setChronometerCountDown 으로 붙여 두면 시스템이 1초씩 직접 깎으므로
 * 앱 프로세스가 죽어도 알림의 숫자가 계속 정확하다.
 * (patches/expo-notifications+*.patch, data.chronometerAtMs)
 *
 * 이미 같은 식별자로 떠 있으면 교체된다.
 */
export async function showTimerNotification(
  soberAtMs: number,
  { title, subtitle }: { title: string; subtitle: string },
): Promise<void> {
  if (Platform.OS !== 'android') return;
  // 이미 지난 시각이면 띄우지 않고 떠 있던 것도 내린다 —
  // 네이티브 크로노미터는 0 을 지나면 음수로 계속 세기 때문에
  // 지난 목표로 띄우면 처음부터 "-00:01" 로 보인다
  if (soberAtMs <= Date.now()) {
    await dismissTimerNotification();
    return;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: TIMER_NOTIFICATION_ID,
    content: {
      title,
      sticky: true,        // 스와이프로 지워지지 않음
      autoDismiss: false,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      // 보조 문구도 data 로 넘긴다 — content.body(=JS body) 는 네이티브
      // 커스텀 뷰까지 오지 않는 경우가 있어 확실한 경로로 통일한다
      data: { chronometerAtMs: soberAtMs, subtitle },
    },
    // channelId 를 실어야 한다 — trigger: null 로 두면 expo 가 fallback 채널로 보내
    // LOW 중요도(무음) 설정이 통째로 무시된다
    trigger: { channelId: TIMER_CHANNEL_ID },
  });
}

/** 카운트다운 알림 내리기 — 분해 완료 알림은 건드리지 않는다 */
export async function dismissTimerNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.dismissNotificationAsync(TIMER_NOTIFICATION_ID);
  } catch {
    // 떠 있지 않으면 무시
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
