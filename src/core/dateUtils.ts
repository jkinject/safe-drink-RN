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

/**
 * 화면에 찍히는 "분" 기준의 차이.
 *
 * 경과 밀리초를 60000 으로 나누면 00:48:50 → 00:49:30 (40초) 이 0분이 되어,
 * 시각은 00:48 ~ 00:49 로 달라 보이는데 "0분" 이라는 모순이 생긴다.
 * 표시가 분 단위이므로 비교도 분 단위로 자른 뒤에 해야 한다.
 *
 * 시간대 오프셋은 분 단위라 epoch 분으로 잘라도 로컬 표시와 경계가 어긋나지 않는다.
 */
export function displayedMinuteDiff(fromMs: number, toMs: number): number {
  return Math.floor(toMs / 60_000) - Math.floor(fromMs / 60_000);
}
