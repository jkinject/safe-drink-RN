/**
 * iOS 카운트다운(Live Activity) 가드 테스트
 *
 * - 목표 시각만 넘긴다 (남은 시간 문자열 금지 — Android 크로노미터와 같은 원칙)
 * - 시작 전에 이전 활동을 끝낸다 (앱 재시작 후 잠금화면에 두 개 뜨는 것 방지)
 * - 활동 ID 는 AsyncStorage 에 보관하고 종료 시 지운다
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LiveActivity from 'expo-live-activity';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  dismissNotificationAsync: jest.fn(async () => {}),
  setNotificationChannelAsync: jest.fn(async () => {}),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 4, LOW: 2 },
  AndroidNotificationPriority: { LOW: 'low' },
}));

import * as Notifications from 'expo-notifications';
import { showTimerNotification, dismissTimerNotification } from '../notifications';

const TEXT = { title: '술 깨기까지', subtitle: '22:13 예정' };

describe('iOS 카운트다운 (Live Activity)', () => {
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    Object.defineProperty(Platform, 'Version', { get: () => '18.0' });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('미래 시각이면 목표 시각(epoch ms)을 실어 Live Activity 를 시작하고 ID 를 보관한다', async () => {
    const soberAt = Date.now() + 60 * 60 * 1000;
    await showTimerNotification(soberAt, TEXT);

    expect(LiveActivity.startActivity).toHaveBeenCalledTimes(1);
    const [state] = (LiveActivity.startActivity as jest.Mock).mock.calls[0];
    expect(state).toEqual({
      ...TEXT,
      progressBar: { date: soberAt },
      // 캐릭터 미지정이면 남성 캐릭터, 다이내믹 아일랜드는 앱 아이콘
      imageName: 'la_male_dizzy',
      dynamicIslandImageName: 'la_icon',
    });
    expect(await AsyncStorage.getItem('live_activity_id')).toBe('activity-1');
    // Android 알림 경로는 타지 않는다
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('프로필이 여성이면 여성 캐릭터를 쓴다', async () => {
    await showTimerNotification(Date.now() + 60_000, { ...TEXT, character: 'female' });
    const [state] = (LiveActivity.startActivity as jest.Mock).mock.calls[0];
    expect(state.imageName).toBe('la_female_dizzy');
  });

  it('이미 떠 있던 활동은 먼저 끝내고 새로 시작한다', async () => {
    await AsyncStorage.setItem('live_activity_id', 'old-activity');
    await showTimerNotification(Date.now() + 60_000, TEXT);

    expect(LiveActivity.stopActivity).toHaveBeenCalledWith('old-activity', expect.anything());
    expect(LiveActivity.startActivity).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('live_activity_id')).toBe('activity-1');
  });

  it('이미 지난 시각이면 시작하지 않고 떠 있던 활동을 내린다', async () => {
    await AsyncStorage.setItem('live_activity_id', 'old-activity');
    await showTimerNotification(Date.now() - 1000, TEXT);

    expect(LiveActivity.startActivity).not.toHaveBeenCalled();
    expect(LiveActivity.stopActivity).toHaveBeenCalledWith('old-activity', expect.anything());
    expect(await AsyncStorage.getItem('live_activity_id')).toBeNull();
  });

  it('시스템이 이미 끝낸 활동(ActivityNotFound)은 조용히 넘기고 ID 를 지운다', async () => {
    await AsyncStorage.setItem('live_activity_id', 'gone');
    (LiveActivity.stopActivity as jest.Mock).mockImplementationOnce(() => {
      throw new Error('ActivityNotFound');
    });
    await expect(dismissTimerNotification()).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem('live_activity_id')).toBeNull();
  });

  it('시작 실패(Live Activity 꺼짐)는 예외로 번지지 않는다', async () => {
    (LiveActivity.startActivity as jest.Mock).mockImplementationOnce(() => {
      throw new Error('LiveActivitiesNotEnabled');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(showTimerNotification(Date.now() + 60_000, TEXT)).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem('live_activity_id')).toBeNull();
    warn.mockRestore();
  });
});
