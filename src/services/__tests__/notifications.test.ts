/**
 * 카운트다운 알림 가드 테스트
 *
 * 배경: 네이티브 Chronometer 는 목표 시각을 지나도 멈추지 않고 음수로 계속 센다
 * ("-30:28"). 시스템 취소(setTimeoutAfter)는 네이티브 패치에서 걸지만,
 * JS 쪽에서도 이미 지난 시각으로는 아예 띄우지 않아야 한다.
 */
import { Platform } from 'react-native';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  dismissNotificationAsync: jest.fn(async () => {}),
  setNotificationChannelAsync: jest.fn(async () => {}),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 4, LOW: 2 },
  AndroidNotificationPriority: { LOW: 'low' },
}));

import * as Notifications from 'expo-notifications';
import {
  showTimerNotification,
  dismissTimerNotification,
} from '../notifications';

const TEXT = { title: '술 깨기까지', subtitle: '22:13 예정' };

describe('showTimerNotification', () => {
  beforeAll(() => {
    // jest-expo 의 기본 플랫폼은 ios — 카운트다운은 Android 전용이라 바꿔준다
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
  });

  beforeEach(() => jest.clearAllMocks());

  it('미래 시각이면 chronometerAtMs 를 실어 알림을 띄운다', async () => {
    const soberAt = Date.now() + 60 * 60 * 1000;
    await showTimerNotification(soberAt, TEXT);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(arg.content.data.chronometerAtMs).toBe(soberAt);
  });

  it('이미 지난 시각이면 띄우지 않고 떠 있던 알림을 내린다', async () => {
    await showTimerNotification(Date.now() - 1000, TEXT);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
      'safedrink_timer',
    );
  });

  it('정확히 현재 시각도 띄우지 않는다 (경계)', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await showTimerNotification(now, TEXT);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    (Date.now as jest.Mock).mockRestore();
  });

  it('dismissTimerNotification 은 타이머 식별자만 내린다', async () => {
    await dismissTimerNotification();
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
      'safedrink_timer',
    );
  });
});
