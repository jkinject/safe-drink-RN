/**
 * 달력 날짜 차이 — "술 깬 시각" 의 "다음날" 판정 근거.
 *
 * 이 앱은 자정을 넘기는 게 예외가 아니라 기본이라, 여기가 틀리면
 * 새벽 2시에 깬 걸 "같은 날 02:20" 으로 찍어 하루를 통째로 오해하게 만든다.
 */
import { calendarDayDiff, displayedMinuteDiff, startOfDayMs } from '../dateUtils';

function at(y: number, mo: number, d: number, h: number, mi = 0): number {
  return new Date(y, mo - 1, d, h, mi).getTime();
}

describe('calendarDayDiff', () => {
  test('같은 날이면 0 (아무리 멀어도)', () => {
    expect(calendarDayDiff(at(2026, 8, 25, 0, 1), at(2026, 8, 25, 23, 59))).toBe(0);
  });

  test('자정을 넘기면 1 — 4시간밖에 안 지나도', () => {
    // 21:00 → 다음날 01:00. 경과 시간을 24 로 나누면 0 이 나오는 함정.
    expect(calendarDayDiff(at(2026, 8, 25, 21), at(2026, 8, 26, 1))).toBe(1);
  });

  test('23시간이 지나도 자정을 안 넘겼으면 0', () => {
    // 09:00 → 같은 날 23:00. 반대 방향 함정.
    expect(calendarDayDiff(at(2026, 8, 25, 9), at(2026, 8, 25, 23))).toBe(0);
  });

  test('이틀 뒤는 2', () => {
    expect(calendarDayDiff(at(2026, 8, 25, 21), at(2026, 8, 27, 2))).toBe(2);
  });

  test('월·연 경계를 넘어도 센다', () => {
    expect(calendarDayDiff(at(2026, 8, 31, 22), at(2026, 9, 1, 3))).toBe(1);
    expect(calendarDayDiff(at(2026, 12, 31, 22), at(2027, 1, 1, 3))).toBe(1);
  });

  test('과거 방향이면 음수', () => {
    expect(calendarDayDiff(at(2026, 8, 26, 1), at(2026, 8, 25, 21))).toBe(-1);
  });
});

describe('startOfDayMs', () => {
  test('시·분·초·밀리초를 모두 0 으로 자른다', () => {
    const d = new Date(startOfDayMs(at(2026, 8, 25, 23, 59)));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0]);
    expect(d.getDate()).toBe(25);
  });
});

describe('displayedMinuteDiff', () => {
  function at(h: number, mi: number, sec = 0): number {
    return new Date(2026, 7, 30, h, mi, sec).getTime();
  }

  test('같은 분 안이면 0 (빠른 선택으로 즉시 기록)', () => {
    expect(displayedMinuteDiff(at(0, 48, 5), at(0, 48, 50))).toBe(0);
  });

  test('40초여도 분 표시가 바뀌면 1 — 경과 ms 로 재면 0 이 되는 함정', () => {
    // 00:48:50 → 00:49:30. 화면에는 00:48 ~ 00:49 로 찍히므로 "1분" 이어야 한다
    expect(displayedMinuteDiff(at(0, 48, 50), at(0, 49, 30))).toBe(1);
  });

  test('59초를 꽉 채워도 같은 분이면 0', () => {
    expect(displayedMinuteDiff(at(0, 48, 0), at(0, 48, 59))).toBe(0);
  });

  test('시간 경계를 넘어도 분으로 센다', () => {
    expect(displayedMinuteDiff(at(23, 58), at(0, 2))).toBe(-1436);
    expect(displayedMinuteDiff(at(11, 48), at(12, 49))).toBe(61);
  });
});
