/**
 * 백업 시각 표시용 포맷 — 순수 함수(UI·스토어 의존 없음).
 *
 * 번역 함수 t 와 로케일을 인자로 받는다. i18n 모듈을 직접 import 하면 테스트가
 * expo-localization 을 끌어오고, 현재 언어가 모듈 로드 시점에 얼어붙을 수 있다.
 */

export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 기기 시간대·로케일 기준 절대 일시 — 예) ko "2026. 9. 28. 오전 9:38", en "Sep 28, 2026, 9:38 AM" */
export function formatAbsolute(ms: number, locale: string): string {
  return new Date(ms).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * 설정 백업 카드의 "마지막 백업: …" 줄.
 * - 한 번도 성공하지 않았으면 backupNever
 * - 1분 미만 "방금", 1시간 미만 "N분 전", 하루 미만 "N시간 전"
 * - 그 이상은 절대 일시 (며칠 전이 쌓이면 상대 표현보다 날짜가 읽기 쉽다)
 *
 * 기기 시계가 뒤로 가 now < lastBackupAt 이면 "방금" 으로 둔다 — 음수 "−3분 전" 방지.
 */
export function formatLastBackup(
  lastBackupAt: number | null,
  now: number,
  t: TranslateFn,
  locale = 'en',
): string {
  if (lastBackupAt == null) return t('backupNever');
  const diff = Math.max(0, now - lastBackupAt);
  let when: string;
  if (diff < MINUTE) {
    when = t('backupJustNow');
  } else if (diff < HOUR) {
    when = t('backupMinutesAgo', { n: Math.floor(diff / MINUTE) });
  } else if (diff < DAY) {
    when = t('backupHoursAgo', { n: Math.floor(diff / HOUR) });
  } else {
    when = formatAbsolute(lastBackupAt, locale);
  }
  return t('backupLastAt', { when });
}
