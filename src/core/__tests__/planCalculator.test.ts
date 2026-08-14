/**
 * PlanCalculator TypeScript 포팅 — 역계산 검증
 *
 * 검증: 4h / 16.5% → 241.5ml ± 1 · 과거 시각 오류
 */
import { calculate } from '../planCalculator';
import { UserProfile } from '../types';

function expectCloseTo(received: number, expected: number, delta: number): void {
  expect(Math.abs(received - expected)).toBeLessThanOrEqual(delta);
}

describe('PlanCalculator', () => {
  const maleProfile: UserProfile = { heightCm: 175, weightKg: 70, sex: 'male' };
  const nowMs = new Date(2026, 0, 1, 18, 0, 0).getTime();

  describe('역계산: 4h / 16.5%', () => {
    test('4시간 후 안전, 소주 16.5% → 최대 약 241.5ml ± 1', () => {
      // r = calcR(maleProfile) ≈ 41.9212/56 ≈ 0.74859
      // maxAlcohol = 0.015 × 4 × 70 × 0.74859 × 10 ≈ 31.44g
      // maxVolume = 31.44 / (16.5/100) / 0.789 ≈ 241.5ml
      const result = calculate({
        targetTime: nowMs + 4 * 3_600_000,
        nowMs,
        abvPercent: 16.5,
        profile: maleProfile,
      });
      expectCloseTo(result.maxVolumeMl, 241.5, 1.0);
    });

    test('availableHours = 4.0', () => {
      const result = calculate({
        targetTime: nowMs + 4 * 3_600_000,
        nowMs,
        abvPercent: 16.5,
        profile: maleProfile,
      });
      expectCloseTo(result.availableHours, 4.0, 0.001);
    });

    test('maxAlcoholGrams > 0', () => {
      const result = calculate({
        targetTime: nowMs + 4 * 3_600_000,
        nowMs,
        abvPercent: 16.5,
        profile: maleProfile,
      });
      expect(result.maxAlcoholGrams).toBeGreaterThan(0);
    });
  });

  describe('오류 케이스', () => {
    test('과거 시각 → 오류', () => {
      expect(() =>
        calculate({
          targetTime: nowMs - 1000, // 이미 지난 시각
          nowMs,
          abvPercent: 16.5,
          profile: maleProfile,
        }),
      ).toThrow();
    });

    test('abvPercent = 0 → 오류', () => {
      expect(() =>
        calculate({
          targetTime: nowMs + 3_600_000,
          nowMs,
          abvPercent: 0,
          profile: maleProfile,
        }),
      ).toThrow();
    });

    test('abvPercent > 100 → 오류', () => {
      expect(() =>
        calculate({
          targetTime: nowMs + 3_600_000,
          nowMs,
          abvPercent: 101,
          profile: maleProfile,
        }),
      ).toThrow();
    });
  });

  describe('비례 검증', () => {
    test('가용 시간이 길수록 최대 음주량 증가', () => {
      const r2h = calculate({ targetTime: nowMs + 2 * 3_600_000, nowMs, abvPercent: 4.5, profile: maleProfile });
      const r4h = calculate({ targetTime: nowMs + 4 * 3_600_000, nowMs, abvPercent: 4.5, profile: maleProfile });
      expect(r4h.maxVolumeMl).toBeGreaterThan(r2h.maxVolumeMl);
    });

    test('도수가 높을수록 최대 용량 감소', () => {
      const lowAbv = calculate({ targetTime: nowMs + 3_600_000, nowMs, abvPercent: 4.5, profile: maleProfile });
      const highAbv = calculate({ targetTime: nowMs + 3_600_000, nowMs, abvPercent: 16.5, profile: maleProfile });
      expect(highAbv.maxVolumeMl).toBeLessThan(lowAbv.maxVolumeMl);
    });
  });
});
