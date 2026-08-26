/**
 * SessionUtils 단위 테스트 — 순수 함수, 목(mock) 없음.
 *
 * src/core/__tests__/bacCalculator.test.ts 스타일을 따른다.
 */
import { computePeakBac, computeSessionSummary, getBacBadge } from '../sessionUtils';
import { bacAt, currentBac, estimatedSoberAt, totalAlcoholGrams } from '../bacCalculator';
import { DrinkRecord, UserProfile } from '../types';

/** Flutter의 closeTo(expected, delta) 와 동일한 허용 범위 검사 */
function expectCloseTo(received: number, expected: number, delta: number): void {
  expect(Math.abs(received - expected)).toBeLessThanOrEqual(delta);
}

describe('sessionUtils', () => {
  // bacCalculator.test.ts 와 동일한 픽스처 — 수치 검증 공유
  const maleProfile: UserProfile = { heightCm: 175, weightKg: 70, sex: 'male' };

  // 기준 시각: Flutter DateTime(2026, 1, 1, 18, 0, 0) 와 동일
  const t0 = new Date(2026, 0, 1, 18, 0, 0).getTime();
  const t1 = t0 + 3_600_000; // t0 + 1h

  const beerRecord: DrinkRecord = {
    consumedAt: t0,
    abvPercent: 4.5,
    volumeMl: 500,
    finishedAt: t0,
  };

  const sojuRecord: DrinkRecord = {
    consumedAt: t1,
    abvPercent: 16.5,
    volumeMl: 50,
    finishedAt: t1,
  };

  // ── computePeakBac ────────────────────────────────────────────────────────

  describe('computePeakBac', () => {
    test('완료 기록 0개 → 0', () => {
      expect(computePeakBac([], maleProfile)).toBe(0);
    });

    test('마시는중 기록만 있음 → 0 (finishedAt == null 은 무시)', () => {
      const drinking: DrinkRecord = { consumedAt: t0, abvPercent: 4.5, volumeMl: 500 };
      expect(computePeakBac([drinking], maleProfile)).toBe(0);
    });

    test('기록 1개 → currentBac(t=finishedAt) 와 일치 (≈0.03388)', () => {
      const peak = computePeakBac([beerRecord], maleProfile);
      // 단순 총량 분해 모델에서 t=finishedAt 일 때 BAC = Σbac_i (분해 없음)
      const expected = currentBac([beerRecord], maleProfile, t0);
      expectCloseTo(peak, expected, 1e-10);
      expectCloseTo(peak, 0.03388, 0.001);
    });

    test('2 기록 spread → 최고 BAC 은 앞쪽 잔 시점 (F1 회귀 방지)', () => {
      // 이 테스트가 실패하면 computePeakBac 이 lastFinishedAt 한 번만 평가하는
      // 잘못된 "최적화"로 변경된 것이다 — 그래프 최고점과 불일치가 발생한다.
      //
      // 맥주(t0) 뒤 1시간 지나 작은 소주(t1) 를 마시면, 그 사이 분해량이
      // 소주 기여분보다 커서 곡선의 최고점은 t0 에 남는다.
      const records = [beerRecord, sojuRecord];
      const peak = computePeakBac(records, maleProfile);

      // bacAt 으로 물어야 한다 — currentBac 은 시계 역행 대비 보정 때문에
      // 과거 시점을 물으면 전부 마지막 잔 값으로 뭉개진다
      const atFirst = bacAt(records, maleProfile, t0);
      const atLast = bacAt(records, maleProfile, t1);

      expectCloseTo(peak, atFirst, 1e-10);
      // "lastFinishedAt 만 평가" 최적화 시 peak ≈ atLast < atFirst → 이 단언이 실패한다
      expect(peak).toBeGreaterThan(atLast);
    });

    test('촘촘히 마시면 최고점은 마지막 잔 시점 (앞쪽 고정 금지)', () => {
      // 위 테스트만 있으면 "첫 잔 시점만 평가" 로 잘못 단순화해도 통과한다.
      const sojuSoon: DrinkRecord = {
        consumedAt: t0 + 60_000,
        abvPercent: 16.5,
        volumeMl: 50,
        finishedAt: t0 + 60_000, // 1분 뒤 — 분해량이 기여분보다 작다
      };
      const records = [beerRecord, sojuSoon];
      const peak = computePeakBac(records, maleProfile);

      expectCloseTo(peak, bacAt(records, maleProfile, t0 + 60_000), 1e-10);
      expect(peak).toBeGreaterThan(bacAt(records, maleProfile, t0));
    });

    test('마시는중 + 완료 혼합 → 완료 기록만으로 계산', () => {
      const drinking: DrinkRecord = { consumedAt: t1, abvPercent: 16.5, volumeMl: 50 };
      const peak = computePeakBac([beerRecord, drinking], maleProfile);
      const expectedPeakWithFinishedOnly = computePeakBac([beerRecord], maleProfile);
      expectCloseTo(peak, expectedPeakWithFinishedOnly, 1e-10);
    });
  });

  // ── computeSessionSummary ─────────────────────────────────────────────────

  describe('computeSessionSummary', () => {
    test('완료된 기록 없음 → null (±Infinity 아님)', () => {
      const drinking: DrinkRecord = { consumedAt: t0, abvPercent: 4.5, volumeMl: 500 };
      const result = computeSessionSummary([drinking], maleProfile);
      expect(result).toBeNull();
    });

    test('빈 배열 → null', () => {
      expect(computeSessionSummary([], maleProfile)).toBeNull();
    });

    test('단일 기록 → 6개 필드 모두 올바름', () => {
      const summary = computeSessionSummary([beerRecord], maleProfile);
      expect(summary).not.toBeNull();

      // startedAt = min(consumedAt)
      expect(summary!.startedAt).toBe(t0);
      // lastFinishedAt = max(finishedAt)
      expect(summary!.lastFinishedAt).toBe(t0);
      // drinkCount = 완료된 기록 수
      expect(summary!.drinkCount).toBe(1);
      // totalAlcoholG
      expectCloseTo(summary!.totalAlcoholG, totalAlcoholGrams([beerRecord]), 1e-6);
      // peakBac
      expectCloseTo(summary!.peakBac, computePeakBac([beerRecord], maleProfile), 1e-10);
      // soberAt = estimatedSoberAt (BAC > 0 이므로 null 이 아님)
      const soberAt = estimatedSoberAt([beerRecord], maleProfile);
      expect(soberAt).not.toBeNull();
      expect(summary!.soberAt).toBe(soberAt!);
    });

    test('복수 기록 → startedAt/lastFinishedAt/drinkCount 경계값 올바름', () => {
      const records = [beerRecord, sojuRecord];
      const summary = computeSessionSummary(records, maleProfile);
      expect(summary).not.toBeNull();

      expect(summary!.startedAt).toBe(t0);   // min(consumedAt)
      expect(summary!.lastFinishedAt).toBe(t1); // max(finishedAt)
      expect(summary!.drinkCount).toBe(2);
    });
  });

  // ── getBacBadge ───────────────────────────────────────────────────────────

  describe('getBacBadge', () => {
    test('0.08 → 면허 취소 (bacStatusRevocation)', () => {
      const badge = getBacBadge(0.08);
      expect(badge).not.toBeNull();
      expect(badge!.labelKey).toBe('bacStatusRevocation');
    });

    test('0.1 → 면허 취소', () => {
      expect(getBacBadge(0.1)!.labelKey).toBe('bacStatusRevocation');
    });

    test('0.03 → 면허 정지 (bacStatusSuspension, 경계값)', () => {
      const badge = getBacBadge(0.03);
      expect(badge).not.toBeNull();
      expect(badge!.labelKey).toBe('bacStatusSuspension');
    });

    test('0.05 → 면허 정지', () => {
      expect(getBacBadge(0.05)!.labelKey).toBe('bacStatusSuspension');
    });

    test('0.029 → null (0.03 미만)', () => {
      expect(getBacBadge(0.029)).toBeNull();
    });

    test('0.02 → null', () => {
      expect(getBacBadge(0.02)).toBeNull();
    });

    test('0.0 → null', () => {
      expect(getBacBadge(0.0)).toBeNull();
    });

    test('뱃지 color/bg 색상 값이 정의됨', () => {
      const revocation = getBacBadge(0.1)!;
      expect(revocation.color).toBeTruthy();
      expect(revocation.bg).toBeTruthy();

      const suspension = getBacBadge(0.05)!;
      expect(suspension.color).toBeTruthy();
      expect(suspension.bg).toBeTruthy();
    });
  });
});
