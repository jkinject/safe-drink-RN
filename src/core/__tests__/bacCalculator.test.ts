/**
 * BacCalculator TypeScript 포팅 — Flutter 검증 수치 그대로 이식
 *
 * 원본: safe-drink/test/services/bac_calculator_test.dart
 */
import {
  calcR,
  calcBacContribution,
  currentBac,
  estimatedSoberAt,
  remainingMinutesCeil,
  remainingHours,
  totalAlcoholGrams,
  totalBacContribution,
  constantR,
  calcBacContributionWithConstantR,
  currentBacWithConstantR,
  estimatedSoberAtWithConstantR,
  bacCurve,
} from '../bacCalculator';
import { DrinkRecord, UserProfile } from '../types';

/** Flutter의 closeTo(expected, delta) 와 동일한 허용 범위 검사 */
function expectCloseTo(received: number, expected: number, delta: number): void {
  expect(Math.abs(received - expected)).toBeLessThanOrEqual(delta);
}

describe('BacCalculator', () => {
  // 검증 1: 남성 70kg/175cm
  const maleProfile: UserProfile = { heightCm: 175, weightKg: 70, sex: 'male' };
  // 검증 3: 여성 55kg/162cm
  const femaleProfile: UserProfile = { heightCm: 162, weightKg: 55, sex: 'female' };

  // 기준 시각: Flutter DateTime(2026, 1, 1, 18, 0, 0)
  const t0 = new Date(2026, 0, 1, 18, 0, 0).getTime();

  // finishedAt = consumedAt → 완료 기록으로 처리
  const beerRecord: DrinkRecord = {
    consumedAt: t0,
    abvPercent: 4.5,
    volumeMl: 500,
    finishedAt: t0,
  };

  // ── 검증 1: 남 70kg/175cm 맥주 500ml 4.5% ──────────────────────────────────

  describe('검증 1: 남 70kg/175cm 맥주 500ml 4.5%', () => {
    test('BAC 0.03388% ± 0.0005 (즉시)', () => {
      const bac = currentBac([beerRecord], maleProfile, t0);
      expectCloseTo(bac, 0.03388, 0.0005);
    });

    test('분해 시간 2.259h ± 0.01', () => {
      const hours = remainingHours([beerRecord], maleProfile, t0);
      expectCloseTo(hours, 2.259, 0.01);
    });

    test('estimatedSoberAt: 약 2.259h 후', () => {
      const soberAt = estimatedSoberAt([beerRecord], maleProfile);
      expect(soberAt).not.toBeNull();
      // difference(t0).inSeconds / 60.0 == diffMinutes
      const diffMinutes = (soberAt! - t0) / 1000 / 60;
      expectCloseTo(diffMinutes, 2.259 * 60, 1.0);
    });
  });

  // ── 검증 2: 1시간 후 소주 50ml 16.5% 추가 (단순 모델) ────────────────────────

  describe('검증 2: 1시간 후 소주 50ml 16.5% 추가 (단순 모델)', () => {
    const t1 = t0 + 3_600_000; // t0 + 1h
    const sojuRecord: DrinkRecord = {
      consumedAt: t1,
      abvPercent: 16.5,
      volumeMl: 50,
      finishedAt: t1,
    };
    const twoRecords = [beerRecord, sojuRecord];

    test('t=1h (소주 추가 직후) BAC 0.03130% ± 0.001', () => {
      const bac = currentBac(twoRecords, maleProfile, t1);
      expectCloseTo(bac, 0.03130, 0.001);
    });

    test('t=1.5h BAC 0.02380% ± 0.001', () => {
      const t15 = t0 + 90 * 60 * 1000; // t0 + 90분
      const bac = currentBac(twoRecords, maleProfile, t15);
      expectCloseTo(bac, 0.02380, 0.001);
    });
  });

  // ── 검증 3: 여 55kg/162cm 맥주 500ml 4.5% ──────────────────────────────────

  describe('검증 3: 여 55kg/162cm 맥주 500ml 4.5%', () => {
    const femaleBeerRecord: DrinkRecord = {
      consumedAt: t0,
      abvPercent: 4.5,
      volumeMl: 500,
      finishedAt: t0,
    };

    test('BAC 0.04934% ± 0.0005 (즉시)', () => {
      const bac = currentBac([femaleBeerRecord], femaleProfile, t0);
      expectCloseTo(bac, 0.04934, 0.0005);
    });

    test('분해 시간 3.289h ± 0.01', () => {
      const hours = remainingHours([femaleBeerRecord], femaleProfile, t0);
      expectCloseTo(hours, 3.289, 0.01);
    });
  });

  // ── AC-2: 맥주 300ml 분해 1.0~1.5h ─────────────────────────────────────────

  describe('AC-2: 남 70kg/175cm 맥주 300ml 4.5% → 분해 1.0~1.5h 범위', () => {
    test('맥주 300ml 4.5% 분해 시간이 1.0~1.5h 범위', () => {
      const beer300: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 300,
        finishedAt: t0,
      };
      const hours = remainingHours([beer300], maleProfile, t0);
      expect(hours).toBeGreaterThanOrEqual(1.0);
      expect(hours).toBeLessThanOrEqual(1.5);
    });
  });

  // ── AC-3: 추가 음주 시 estimatedSoberAt 증가 ────────────────────────────────

  describe('AC-3: 추가 음주 시 estimatedSoberAt 증가', () => {
    test('기록 2건의 분해 시간 > 기록 1건만 있을 때', () => {
      const t1 = t0 + 3_600_000;
      const extra: DrinkRecord = {
        consumedAt: t1,
        abvPercent: 3.0,
        volumeMl: 100,
        finishedAt: t1,
      };
      const hoursOne = remainingHours([beerRecord], maleProfile, t1);
      const hoursTwo = remainingHours([beerRecord, extra], maleProfile, t1);
      expect(hoursTwo).toBeGreaterThan(hoursOne);
    });
  });

  // ── 빈 기록 ─────────────────────────────────────────────────────────────────

  describe('빈 기록', () => {
    test('기록 없으면 BAC = 0', () => {
      expect(currentBac([], maleProfile, t0)).toBe(0);
    });

    test('기록 없으면 estimatedSoberAt = null', () => {
      expect(estimatedSoberAt([], maleProfile)).toBeNull();
    });

    test('기록 없으면 remainingMinutesCeil = 0', () => {
      expect(remainingMinutesCeil([], maleProfile, t0)).toBe(0);
    });
  });

  // ── weightKg 경계값 ──────────────────────────────────────────────────────────

  describe('weightKg 경계값', () => {
    test('최소 몸무게 30kg', () => {
      const light: UserProfile = { heightCm: 150, weightKg: 30, sex: 'male' };
      const bac = currentBac([beerRecord], light, t0);
      expect(bac).toBeGreaterThan(0);
    });

    test('최대 몸무게 300kg', () => {
      const heavy: UserProfile = { heightCm: 200, weightKg: 300, sex: 'male' };
      const bac = currentBac([beerRecord], heavy, t0);
      expect(bac).toBeGreaterThan(0);
      expect(bac).toBeLessThan(0.03388); // 무거울수록 BAC 낮음
    });
  });

  // ── 기기 시간 역행 (음수 경과) 클램프 ────────────────────────────────────────

  describe('기기 시간 역행 (음수 경과) 클램프', () => {
    test('now가 firstFinishedAt보다 이전이면 BAC = totalContribution (분해 없음)', () => {
      const past = t0 - 3_600_000; // 1시간 전
      const bac = currentBac([beerRecord], maleProfile, past);
      const contribution = calcBacContribution(beerRecord, maleProfile,
        new Date(past).getFullYear());
      expectCloseTo(bac, contribution, 0.0001);
    });
  });

  // ── 마시는중 기록 제외 ────────────────────────────────────────────────────────

  describe('마시는중 기록 제외', () => {
    test('finishedAt == undefined 기록만 있으면 BAC = 0', () => {
      const drinking: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
        // finishedAt 없음 → 마시는중
      };
      expect(currentBac([drinking], maleProfile, t0)).toBe(0);
    });

    test('마시는중 + 완료 기록 혼합 시 완료 기록만 계산', () => {
      const drinking: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
      };
      const bac = currentBac([drinking, beerRecord], maleProfile, t0);
      const bacSingle = currentBac([beerRecord], maleProfile, t0);
      expectCloseTo(bac, bacSingle, 0.000001);
    });

    test('estimatedSoberAt: finishedAt == undefined 기록만 있으면 null', () => {
      const drinking: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
      };
      expect(estimatedSoberAt([drinking], maleProfile)).toBeNull();
    });

    test('totalBacContribution: 마시는중 기록 제외', () => {
      const drinking: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
      };
      expect(totalBacContribution([drinking], maleProfile)).toBe(0);
    });

    test('totalAlcoholGrams: 마시는중 기록 제외', () => {
      const drinking: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
      };
      expect(totalAlcoholGrams([drinking])).toBe(0);
    });
  });

  // ── finishedAt 기준 시각 ──────────────────────────────────────────────────────

  describe('finishedAt 기준 시각 — 30분 후 완료 처리 시 분해가 30분 밀림', () => {
    test('finishedAt = consumedAt + 30min → soberAt도 30분 더 늦음', () => {
      const soberAtImmediate = estimatedSoberAt([beerRecord], maleProfile);

      const t0plus30 = t0 + 30 * 60 * 1000;
      const beerDelayed: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
        finishedAt: t0plus30,
      };
      const soberAtDelayed = estimatedSoberAt([beerDelayed], maleProfile);

      expect(soberAtImmediate).not.toBeNull();
      expect(soberAtDelayed).not.toBeNull();
      const diffSeconds = (soberAtDelayed! - soberAtImmediate!) / 1000;
      expectCloseTo(diffSeconds, 30 * 60, 5); // ±5초 허용
    });

    test('finishedAt = consumedAt + 30min → currentBac는 now=t0 시점에서 더 높음', () => {
      const bacImmediate = currentBac([beerRecord], maleProfile, t0);
      const beerDelayed: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
        finishedAt: t0 + 30 * 60 * 1000,
      };
      const bacDelayed = currentBac([beerDelayed], maleProfile, t0);
      // 둘 다 elapsed <= 0 → clamp → 같은 BAC
      expectCloseTo(bacImmediate, bacDelayed, 0.000001);
    });
  });

  // ── totalAlcoholGrams ─────────────────────────────────────────────────────────

  describe('totalAlcoholGrams', () => {
    test('빈 기록이면 0', () => {
      expect(totalAlcoholGrams([])).toBe(0);
    });

    test('맥주 500ml 4.5% → 약 17.75g', () => {
      // 500 × 0.045 × 0.789 = 17.7525
      const g = totalAlcoholGrams([beerRecord]);
      expectCloseTo(g, 17.75, 0.05);
    });

    test('기록 2건 합산', () => {
      const r2: DrinkRecord = {
        consumedAt: t0 + 3_600_000,
        abvPercent: 16.5,
        volumeMl: 50,
        finishedAt: t0 + 3_600_000,
      };
      const g = totalAlcoholGrams([beerRecord, r2]);
      // 17.7525 + (50 × 0.165 × 0.789) = 17.7525 + 6.509
      expectCloseTo(g, 17.7525 + 6.509, 0.05);
    });
  });

  // ── totalBacContribution ──────────────────────────────────────────────────────

  describe('totalBacContribution', () => {
    test('빈 기록이면 0', () => {
      expect(totalBacContribution([], maleProfile)).toBe(0);
    });

    test('단일 기록: calcBacContribution과 동일', () => {
      const single = totalBacContribution([beerRecord], maleProfile);
      const direct = calcBacContribution(beerRecord, maleProfile);
      expectCloseTo(single, direct, 0.000001);
    });
  });

  // ── bacCurve 샘플링 ────────────────────────────────────────────────────────────

  describe('bacCurve 샘플링', () => {
    test('빈 기록이면 빈 배열 반환', () => {
      expect(bacCurve([], maleProfile)).toHaveLength(0);
    });

    test('samples < 2이면 빈 배열 반환', () => {
      expect(bacCurve([beerRecord], maleProfile, 1)).toHaveLength(0);
    });

    test('기본 60포인트 반환', () => {
      expect(bacCurve([beerRecord], maleProfile)).toHaveLength(60);
    });

    test('첫 포인트 시각 = firstFinishedAt', () => {
      const curve = bacCurve([beerRecord], maleProfile);
      expect(curve[0][0]).toBe(t0); // finishedAt = t0
    });

    test('마지막 포인트 BAC ≈ 0', () => {
      const curve = bacCurve([beerRecord], maleProfile);
      expectCloseTo(curve[curve.length - 1][1], 0.0, 0.0001);
    });

    test('곡선은 단조 감소 (BAC 모델 특성)', () => {
      const curve = bacCurve([beerRecord], maleProfile);
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i][1]).toBeLessThanOrEqual(curve[i - 1][1] + 0.00001);
      }
    });

    test('첫 포인트 BAC ≈ totalBacContribution', () => {
      const curve = bacCurve([beerRecord], maleProfile);
      const total = totalBacContribution([beerRecord], maleProfile,
        new Date(t0).getFullYear());
      expectCloseTo(curve[0][1], total, 0.0001);
    });

    test('샘플 수 커스텀 지정', () => {
      expect(bacCurve([beerRecord], maleProfile, 10)).toHaveLength(10);
    });

    test('마시는중 기록만 있으면 빈 배열', () => {
      const drinking: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
      };
      expect(bacCurve([drinking], maleProfile)).toHaveLength(0);
    });
  });

  // ── birthYear 반영 — Watson 남성 TBW 나이 변화 ────────────────────────────────

  describe('birthYear 반영 — Watson 남성 TBW 나이 변화', () => {
    // referenceYear=2026, birthYear=1976 → age=50
    // TBW = 2.447 − 0.09516×50 + 0.1074×175 + 0.3362×70
    //     = 2.447 − 4.758 + 18.795 + 23.534 = 40.018 L
    // r   = 40.018 / (70 × 0.8) = 40.018 / 56 ≈ 0.7146
    const maleAge50: UserProfile = {
      heightCm: 175,
      weightKg: 70,
      sex: 'male',
      birthYear: 1976,
    };

    test('calcR: birthYear=1976 (age 50, 기준연도 2026) → r ≈ 40.018/56', () => {
      const r = calcR(maleAge50, 2026);
      expectCloseTo(r, 40.018 / 56, 0.0001);
    });

    test('calcR: birthYear 미설정 → 기본 나이 30 그대로', () => {
      // TBW(age=30) = 2.447 − 0.09516×30 + 0.1074×175 + 0.3362×70 = 41.9212
      const r30 = calcR(maleProfile);
      expectCloseTo(r30, 41.9212 / 56, 0.0001);
    });

    test('calcBacContribution: age50 → BAC 0.035489% ± 0.0005', () => {
      // alcoholGrams = 500 × 0.045 × 0.789 = 17.7525g
      // BAC = 17.7525 / (70 × (40.018/56) × 10) ≈ 0.035489%
      const bac = calcBacContribution(beerRecord, maleAge50, 2026);
      expectCloseTo(bac, 0.035489, 0.0005);
    });

    test('currentBac: now.year=2026, birthYear=1976 → BAC 더 높음 (TBW 감소)', () => {
      const t2026 = new Date(2026, 0, 1, 18, 0, 0).getTime();
      const bacAge50 = currentBac([beerRecord], maleAge50, t2026);
      const bacAge30 = currentBac([beerRecord], maleProfile, t2026);
      expect(bacAge50).toBeGreaterThan(bacAge30);
    });
  });

  // ── birthYear 반영 — 여성은 나이 무관 ──────────────────────────────────────────

  describe('birthYear 반영 — 여성은 나이 무관 (Watson 여성 공식에 나이 항 없음)', () => {
    const femaleAge50: UserProfile = {
      heightCm: 162,
      weightKg: 55,
      sex: 'female',
      birthYear: 1976,
    };

    test('여성 calcR: birthYear=1976 과 birthYear null 이 동일', () => {
      const rWithBirth = calcR(femaleAge50, 2026);
      const rDefault = calcR(femaleProfile);
      expectCloseTo(rWithBirth, rDefault, 0.000001);
    });

    test('여성 calcBacContribution: birthYear 유무 무관 동일 결과', () => {
      const rec: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
        finishedAt: t0,
      };
      const bacWithBirth = calcBacContribution(rec, femaleAge50, 2026);
      const bacDefault = calcBacContribution(rec, femaleProfile);
      expectCloseTo(bacWithBirth, bacDefault, 0.000001);
    });
  });

  // ── 표준 Widmark (상수 r) 경로 ────────────────────────────────────────────────

  describe('constantR', () => {
    test('남성 → 0.68', () => {
      expectCloseTo(constantR(maleProfile), 0.68, 0.001);
    });

    test('여성 → 0.55', () => {
      expectCloseTo(constantR(femaleProfile), 0.55, 0.001);
    });
  });

  describe('calcBacContributionWithConstantR', () => {
    test('남 70kg 맥주 500ml 4.5% → BAC ≈ 0.03730% (± 0.0001)', () => {
      // alcohol = 500 × 0.045 × 0.789 = 17.7525g
      // BAC = 17.7525 / (70 × 0.68 × 10) = 17.7525 / 476 ≈ 0.037295%
      const contribution = calcBacContributionWithConstantR(beerRecord, maleProfile);
      expectCloseTo(contribution, 0.03730, 0.0001);
    });

    test('Watson 방식과 값이 다름 (키 반영 여부 차이)', () => {
      const watson = calcBacContribution(beerRecord, maleProfile);
      const widmark = calcBacContributionWithConstantR(beerRecord, maleProfile);
      // Watson r ≈ 0.748 (175cm/70kg), Widmark r = 0.68 → Widmark BAC 더 높음
      expect(Math.abs(widmark - watson)).toBeGreaterThan(0.0005);
      expect(widmark).toBeGreaterThan(watson);
    });
  });

  describe('currentBacWithConstantR', () => {
    test('즉시 음주 시 BAC = calcBacContributionWithConstantR', () => {
      const bac = currentBacWithConstantR([beerRecord], maleProfile, t0);
      const contribution = calcBacContributionWithConstantR(beerRecord, maleProfile);
      expectCloseTo(bac, contribution, 0.0001);
    });

    test('빈 기록이면 0', () => {
      expect(currentBacWithConstantR([], maleProfile, t0)).toBe(0);
    });

    test('마시는중 기록만 있으면 0', () => {
      const drinking: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
      };
      expect(currentBacWithConstantR([drinking], maleProfile, t0)).toBe(0);
    });
  });

  describe('estimatedSoberAtWithConstantR', () => {
    test('남 70kg 맥주 500ml 4.5% → 회복 2.487h ± 0.01', () => {
      const soberAt = estimatedSoberAtWithConstantR([beerRecord], maleProfile);
      expect(soberAt).not.toBeNull();
      const diffHours = (soberAt! - t0) / 1000 / 3600;
      expectCloseTo(diffHours, 2.487, 0.01);
    });

    test('Watson 회복 시각과 다름 (Widmark가 더 늦음)', () => {
      const watsonSober = estimatedSoberAt([beerRecord], maleProfile);
      const widmarkSober = estimatedSoberAtWithConstantR([beerRecord], maleProfile);
      expect(watsonSober).not.toBeNull();
      expect(widmarkSober).not.toBeNull();
      // Widmark(상수 r=0.68)가 Watson(r≈0.748)보다 BAC 높아 회복이 더 늦음
      expect(widmarkSober!).toBeGreaterThan(watsonSober!);
    });

    test('빈 기록이면 null', () => {
      expect(estimatedSoberAtWithConstantR([], maleProfile)).toBeNull();
    });

    test('마시는중 기록만 있으면 null', () => {
      const drinking: DrinkRecord = {
        consumedAt: t0,
        abvPercent: 4.5,
        volumeMl: 500,
      };
      expect(estimatedSoberAtWithConstantR([drinking], maleProfile)).toBeNull();
    });
  });
});
