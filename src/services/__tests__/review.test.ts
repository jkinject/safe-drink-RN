/**
 * 평가 요청 판단 로직. 시트·스토어 열기는 목 처리하고 shouldPrompt 만 따진다.
 */
jest.mock('@/components/dialog', () => ({ actionSheet: jest.fn(async () => 1) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
}));
// appInfo 는 expo-constants/updates 를 끌어와 jest 에서 못 읽는다 — 링크만 고정값으로
jest.mock('@/constants/appInfo', () => ({
  PLAY_MARKET_URL: 'market://details?id=com.safedrink.app',
  PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.safedrink.app',
}));

import { LATER_INTERVAL_MS, MIN_SESSIONS, shouldPrompt } from '../review';

const DAY = 24 * 60 * 60 * 1000;

describe('shouldPrompt', () => {
  const now = 1_700_000_000_000;

  it('닫힌 술자리가 기준보다 적으면 묻지 않는다', () => {
    expect(shouldPrompt({ status: 'pending', lastPromptAt: 0 }, MIN_SESSIONS - 1, now, 'android')).toBe(false);
    expect(shouldPrompt({ status: 'pending', lastPromptAt: 0 }, MIN_SESSIONS, now, 'android')).toBe(true);
  });

  it('평가 완료·다시 묻지 않기는 영원히 묻지 않는다', () => {
    expect(shouldPrompt({ status: 'done', lastPromptAt: now - 100 * DAY }, 10, now, 'android')).toBe(false);
    expect(shouldPrompt({ status: 'never', lastPromptAt: now - 100 * DAY }, 10, now, 'android')).toBe(false);
  });

  it('나중에는 2주가 지나야 다시 묻는다', () => {
    expect(shouldPrompt({ status: 'later', lastPromptAt: now - DAY }, 5, now, 'android')).toBe(false);
    expect(shouldPrompt({ status: 'later', lastPromptAt: now - LATER_INTERVAL_MS }, 5, now, 'android')).toBe(true);
  });

  it('Play 에만 있으니 iOS 에서는 묻지 않는다', () => {
    expect(shouldPrompt({ status: 'pending', lastPromptAt: 0 }, 5, now, 'ios')).toBe(false);
  });
});
