/**
 * BAC 계산 엔진 — Widmark–Watson 공식 + 단순(총량) 분해 모델
 *
 * 분해 모델: currentBac = Σbac_i − β × (now − firstFinishedAt), 0 클램프
 * β = 0.015 %/h (영차 반응, 간의 알코올 대사)
 *
 * 중요: finishedAt == undefined 인 기록(마시는중)은 모든 계산에서 제외된다.
 * 계산의 기준 시각은 consumedAt 이 아닌 finishedAt 을 사용한다.
 */
import { DrinkRecord, UserProfile } from './types';

const BETA = 0.015;              // 분해율 (%/h)
const BLOOD_WATER_FRACTION = 0.8; // 혈액 중 수분 비율
const DENSITY_ETHANOL = 0.789;   // 에탄올 밀도 (g/ml)
const DEFAULT_AGE = 30;          // 나이 기본값 (birthYear 미설정 시)

type FinishedRecord = DrinkRecord & { finishedAt: number };

function isFinished(r: DrinkRecord): r is FinishedRecord {
  return r.finishedAt != null;
}

/** 완료된 기록만 반환 (finishedAt != undefined) */
function finishedOnly(records: DrinkRecord[]): FinishedRecord[] {
  return records.filter(isFinished);
}

/** 완료 기록 중 가장 이른 finishedAt (epoch ms) */
function firstFinishedAtMs(finished: FinishedRecord[]): number {
  return Math.min(...finished.map(r => r.finishedAt));
}

/**
 * birthYear 로부터 나이 계산.
 * referenceYear 가 없으면 현재 연도 사용.
 * birthYear 가 null 이면 DEFAULT_AGE(30) 반환.
 */
function resolveAge(profile: UserProfile, referenceYear?: number): number {
  if (profile.birthYear == null) return DEFAULT_AGE;
  const year = referenceYear ?? new Date().getFullYear();
  return year - profile.birthYear;
}

/**
 * Watson TBW (총체수분량, 리터) 계산
 * 남성 공식만 나이 항이 있음 (여성 공식은 나이 무관).
 */
function calcTbw(profile: UserProfile, age: number): number {
  if (profile.sex === 'male') {
    return (
      2.447 -
      0.09516 * age +
      0.1074 * profile.heightCm +
      0.3362 * profile.weightKg
    );
  }
  return -2.097 + 0.1069 * profile.heightCm + 0.2466 * profile.weightKg;
}

/**
 * Widmark 분포계수 r 계산
 * r 이 0.4~0.9 범위 밖이면 성별 상수(남 0.68, 여 0.55)로 fallback.
 *
 * @param referenceYear 나이 계산 기준 연도. null 이면 현재 연도 사용 (birthYear 설정 시).
 */
export function calcR(profile: UserProfile, referenceYear?: number): number {
  const age = resolveAge(profile, referenceYear);
  const tbw = calcTbw(profile, age);
  const r = tbw / (profile.weightKg * BLOOD_WATER_FRACTION);
  if (r < 0.4 || r > 0.9) {
    return profile.sex === 'male' ? 0.68 : 0.55;
  }
  return r;
}

/**
 * 단일 기록의 BAC 기여 계산 (%)
 *
 * @param referenceYear 나이 계산 기준 연도 (테스트 주입용). null 이면 자동 계산.
 */
export function calcBacContribution(
  record: DrinkRecord,
  profile: UserProfile,
  referenceYear?: number,
): number {
  const alcoholGrams =
    record.volumeMl * (record.abvPercent / 100) * DENSITY_ETHANOL;
  const r = calcR(profile, referenceYear);
  return alcoholGrams / (profile.weightKg * r * 10);
}

/**
 * 현재 BAC 계산 (%) — 단순(총량) 분해 모델
 *
 * finishedAt == undefined 인 기록은 제외한다.
 * 분해 시작 기준 시각은 완료 기록 중 가장 이른 finishedAt.
 *
 * @param nowMs 현재 시각 (epoch ms). nowMs.year 를 나이 기준으로 사용.
 */
export function currentBac(
  records: DrinkRecord[],
  profile: UserProfile,
  nowMs: number,
): number {
  const finished = finishedOnly(records);
  if (finished.length === 0) return 0;

  const nowYear = new Date(nowMs).getFullYear();
  const totalContribution = finished.reduce(
    (sum, r) => sum + calcBacContribution(r, profile, nowYear),
    0,
  );

  const firstMs = firstFinishedAtMs(finished);
  const elapsedMs = nowMs - firstMs;
  const elapsedHours = elapsedMs > 0 ? elapsedMs / 3_600_000 : 0;

  const bac = totalContribution - BETA * elapsedHours;
  return bac < 0 ? 0 : bac;
}

/**
 * BAC 가 0 이 되는 예상 시각 (epoch ms) 계산
 *
 * finishedAt == undefined 인 기록은 제외한다.
 * BAC 이 이미 0 이면 null 반환.
 *
 * @param referenceYear 나이 계산 기준 연도 (테스트 주입용). null 이면 자동 계산.
 */
export function estimatedSoberAt(
  records: DrinkRecord[],
  profile: UserProfile,
  referenceYear?: number,
): number | null {
  const finished = finishedOnly(records);
  if (finished.length === 0) return null;

  const totalContribution = finished.reduce(
    (sum, r) => sum + calcBacContribution(r, profile, referenceYear),
    0,
  );

  if (totalContribution <= 0) return null;

  const firstMs = firstFinishedAtMs(finished);
  const soberHours = totalContribution / BETA;
  const soberMs = Math.round(soberHours * 3_600_000);
  return firstMs + soberMs;
}

/** 현재 시점 기준 남은 분해 시간 (분, 올림). BAC 이 0 이면 0 반환. */
export function remainingMinutesCeil(
  records: DrinkRecord[],
  profile: UserProfile,
  nowMs: number,
): number {
  const bac = currentBac(records, profile, nowMs);
  if (bac <= 0) return 0;
  return Math.ceil((bac / BETA) * 60);
}

/** 남은 분해 시간 (시간 단위, double). BAC 이 0 이면 0.0 반환. */
export function remainingHours(
  records: DrinkRecord[],
  profile: UserProfile,
  nowMs: number,
): number {
  const bac = currentBac(records, profile, nowMs);
  if (bac <= 0) return 0;
  return bac / BETA;
}

/** 총 순수 알코올량 (g) — finishedAt != undefined 인 기록만 합산 */
export function totalAlcoholGrams(records: DrinkRecord[]): number {
  return finishedOnly(records).reduce(
    (sum, r) => sum + r.volumeMl * (r.abvPercent / 100) * DENSITY_ETHANOL,
    0,
  );
}

/**
 * 총 BAC 기여 합계 (최초 추정 BAC, %) — 분해 전 최대치
 *
 * finishedAt == undefined 인 기록은 제외한다.
 *
 * @param referenceYear 나이 계산 기준 연도 (테스트 주입용). null 이면 자동 계산.
 */
export function totalBacContribution(
  records: DrinkRecord[],
  profile: UserProfile,
  referenceYear?: number,
): number {
  return finishedOnly(records).reduce(
    (sum, r) => sum + calcBacContribution(r, profile, referenceYear),
    0,
  );
}

// ── 표준 Widmark (성별 상수 r) 경로 ─────────────────────────────────────────

/** 성별 상수 r — 표준 Widmark 방식 (남 0.68 / 여 0.55) */
export function constantR(profile: UserProfile): number {
  return profile.sex === 'male' ? 0.68 : 0.55;
}

/** 단일 기록의 BAC 기여 — 표준 Widmark 방식 (성별 상수 r 사용) */
export function calcBacContributionWithConstantR(
  record: DrinkRecord,
  profile: UserProfile,
): number {
  const alcoholGrams =
    record.volumeMl * (record.abvPercent / 100) * DENSITY_ETHANOL;
  const r = constantR(profile);
  return alcoholGrams / (profile.weightKg * r * 10);
}

/**
 * 현재 BAC — 표준 Widmark 방식 (성별 상수 r 사용)
 *
 * finishedAt == undefined 인 기록은 제외한다.
 */
export function currentBacWithConstantR(
  records: DrinkRecord[],
  profile: UserProfile,
  nowMs: number,
): number {
  const finished = finishedOnly(records);
  if (finished.length === 0) return 0;

  const totalBac = finished.reduce(
    (sum, r) => sum + calcBacContributionWithConstantR(r, profile),
    0,
  );

  const firstMs = firstFinishedAtMs(finished);
  const elapsedMs = nowMs - firstMs;
  const elapsedHours = elapsedMs > 0 ? elapsedMs / 3_600_000 : 0;
  const bac = totalBac - BETA * elapsedHours;
  return bac < 0 ? 0 : bac;
}

/**
 * BAC 가 0 이 되는 예상 시각 (epoch ms) — 표준 Widmark 방식 (성별 상수 r 사용)
 *
 * finishedAt == undefined 인 기록은 제외한다.
 */
export function estimatedSoberAtWithConstantR(
  records: DrinkRecord[],
  profile: UserProfile,
): number | null {
  const finished = finishedOnly(records);
  if (finished.length === 0) return null;

  const totalBac = finished.reduce(
    (sum, r) => sum + calcBacContributionWithConstantR(r, profile),
    0,
  );

  if (totalBac <= 0) return null;

  const firstMs = firstFinishedAtMs(finished);
  const soberHours = totalBac / BETA;
  const soberMs = Math.round(soberHours * 3_600_000);
  return firstMs + soberMs;
}

/** 남은 분해 시간 (시간 단위, double) — 표준 Widmark 방식 */
export function remainingHoursWithConstantR(
  records: DrinkRecord[],
  profile: UserProfile,
  nowMs: number,
): number {
  const bac = currentBacWithConstantR(records, profile, nowMs);
  if (bac <= 0) return 0;
  return bac / BETA;
}

// ── 시간축 샘플링 ─────────────────────────────────────────────────────────────

/**
 * BAC 시간축 샘플링 — [samples]개 포인트 (첫 완료 시각 → 회복 예상 시각)
 *
 * finishedAt == undefined 인 기록은 제외한다.
 * 반환: 각 시각(epoch ms)과 BAC(%) 쌍 배열.
 * 기록이 없거나 회복 예상 시각이 없으면 빈 배열 반환.
 */
export function bacCurve(
  records: DrinkRecord[],
  profile: UserProfile,
  samples = 60,
): Array<[number, number]> {
  const finished = finishedOnly(records);
  if (finished.length === 0 || samples < 2) return [];

  const firstMs = firstFinishedAtMs(finished);
  // 첫 완료 시각 연도를 기준으로 나이 계산 (Flutter와 동일)
  const firstYear = new Date(firstMs).getFullYear();
  const soberAtMs = estimatedSoberAt(finished, profile, firstYear);
  if (soberAtMs == null) return [];

  const totalMs = soberAtMs - firstMs;
  if (totalMs <= 0) return [];

  const stepMs = totalMs / (samples - 1);
  return Array.from({ length: samples }, (_, i) => {
    const t = firstMs + Math.round(stepMs * i);
    return [t, currentBac(finished, profile, t)] as [number, number];
  });
}
