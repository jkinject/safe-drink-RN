import { formatAbsolute, formatLastBackup, type TranslateFn } from '../format';

/** 키와 옵션을 그대로 드러내는 가짜 번역 — 어떤 키가 쓰였는지 검증한다 */
const t: TranslateFn = (key, options) => {
  if (key === 'backupLastAt') return `last:${String(options?.when)}`;
  if (key === 'backupMinutesAgo') return `${String(options?.n)}m`;
  if (key === 'backupHoursAgo') return `${String(options?.n)}h`;
  return key;
};

const NOW = Date.UTC(2026, 8, 28, 3, 0, 0);
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

describe('formatLastBackup', () => {
  it('성공 이력이 없으면 backupNever', () => {
    expect(formatLastBackup(null, NOW, t)).toBe('backupNever');
  });

  it('1분 미만은 방금', () => {
    expect(formatLastBackup(NOW, NOW, t)).toBe('last:backupJustNow');
    expect(formatLastBackup(NOW - 59 * SEC, NOW, t)).toBe('last:backupJustNow');
  });

  it('기기 시계가 뒤로 가도 음수가 아니라 방금', () => {
    expect(formatLastBackup(NOW + 5 * MIN, NOW, t)).toBe('last:backupJustNow');
  });

  it('1시간 미만은 분 단위(내림)', () => {
    expect(formatLastBackup(NOW - 60 * SEC, NOW, t)).toBe('last:1m');
    expect(formatLastBackup(NOW - (3 * MIN + 40 * SEC), NOW, t)).toBe('last:3m');
    expect(formatLastBackup(NOW - (59 * MIN + 59 * SEC), NOW, t)).toBe('last:59m');
  });

  it('하루 미만은 시간 단위(내림)', () => {
    expect(formatLastBackup(NOW - HOUR, NOW, t)).toBe('last:1h');
    expect(formatLastBackup(NOW - (23 * HOUR + 59 * MIN), NOW, t)).toBe('last:23h');
  });

  it('하루 이상은 절대 일시', () => {
    const at = NOW - 24 * HOUR;
    expect(formatLastBackup(at, NOW, t, 'en')).toBe(`last:${formatAbsolute(at, 'en')}`);
    expect(formatLastBackup(at, NOW, t, 'ko')).toBe(`last:${formatAbsolute(at, 'ko')}`);
  });
});

describe('formatAbsolute', () => {
  it('연도가 들어간 날짜와 시각을 만든다', () => {
    const s = formatAbsolute(NOW, 'en');
    expect(s).toContain('2026');
    expect(s).toMatch(/\d{1,2}:\d{2}/);
  });

  it('로케일에 따라 모양이 달라진다', () => {
    expect(formatAbsolute(NOW, 'ko')).not.toBe(formatAbsolute(NOW, 'en'));
  });
});
