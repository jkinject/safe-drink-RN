jest.mock('@/constants/appInfo', () => ({
  PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.safedrink.app',
}));

import { sessionShareText } from '../share';
import { i18n } from '@/i18n';

describe('sessionShareText', () => {
  it('요약 한 줄에 시간·잔 수·최고 BAC·깬 시각·스토어 링크가 들어간다', () => {
    i18n.locale = 'ko';
    const base = new Date(2026, 7, 26, 14, 48).getTime();
    const text = sessionShareText(
      { id: 1, startedAt: base, lastFinishedAt: base + 61 * 60000, soberAt: base + 256 * 60000, totalAlcoholG: 33.1, peakBac: 0.049, drinkCount: 2 },
      'ko-KR',
    );
    expect(text).toContain('14:48~15:49');
    expect(text).toContain('2잔');
    expect(text).toContain('0.049%');
    expect(text).toContain('19:04');
    expect(text).toContain('play.google.com/store/apps/details?id=com.safedrink.app');
  });
});
