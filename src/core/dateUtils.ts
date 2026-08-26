/**
 * 날짜 계산 유틸 — 순수 함수, UI/i18n 의존 없음.
 */

/** 그 시각이 속한 날의 자정 (로컬 시간대) */
export function startOfDayMs(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 달력 날짜 차이 (일). toMs 가 fromMs 보다 하루 뒤면 1.
 *
 * 경과 시간을 24로 나누면 안 된다 — 21:00 에서 다음날 01:00 은 4시간뿐이라
 * "같은 날" 로 잡히고, 반대로 09:00 에서 다음날 08:00 은 23시간이라 0 이 된다.
 * 이 앱은 자정을 넘기는 게 기본이라 그 오판이 그대로 "술 깬 시각" 표기에 나온다.
 *
 * 서머타임이 있는 지역에서 하루가 23/25시간이 되는 것도 자정 기준이라 영향받지 않는다.
 */
export function calendarDayDiff(fromMs: number, toMs: number): number {
  const DAY_MS = 86_400_000;
  return Math.round((startOfDayMs(toMs) - startOfDayMs(fromMs)) / DAY_MS);
}
