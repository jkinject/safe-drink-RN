/**
 * BAC 계산 엔진 — Widmark–Watson 공식 + 단순(총량) 분해 모델
 *
 * 분해 모델: 순차 섭취 + 단일 β 소거 (accumulateUntil 참고).
 * 잔을 비울 때마다 그 기여분이 더해지고, 잔 사이·이후 구간은 β 로 깎인다.
 * β = 0.015 %/h (영차 반응, 간의 알코올 대사) — 구간이 몇 개든 β 항은 하나뿐이다.
 *
 * 잔 사이에 BAC 가 0 을 찍지 않는 보통의 술자리에서는
 * Σbac_i − β × (now − firstFinishedAt) 과 수치가 완전히 같다.
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

/** 한 기록의 BAC 기여를 구하는 함수 (개인 맞춤 r / 표준 상수 r 두 경로가 공유) */
type Contribution = (record: FinishedRecord) => number;

/**
 * 순차 섭취 누산 — 시간순으로 훑으며 잔이 들어오면 더하고, 잔 사이 구간은 β 로 깎는다.
 *
 * 왜 "총량 일괄"(Σbac_i − β(t − 첫잔))이 아닌가:
 *  1. 그래프가 틀린다. t 가 두 번째 잔보다 앞이어도 그 잔을 이미 마신 것으로 쳐서,
 *     첫 잔 시점부터 전체 합에서 시작하는 직선이 그려진다. 실제로는 잔을 비울 때마다
 *     계단처럼 올라갔다가 내려와야 한다.
 *  2. 잔 사이에 BAC 가 0 을 찍고 한참 뒤 다시 마시면 그 공백까지 총량에서 깎아
 *     "마시자마자 이미 0" 이 나온다. 세션 자동 종료는 앱이 떠 있을 때만 돌기 때문에
 *     (checkAutoClose) 앱을 안 켜고 저녁·새벽에 나눠 마시면 실제로 재현된다.
 *
 * 금지된 개별 분해(Σ max(0, bac_i − β·t_i))와는 다르다 — 어느 구간에서든 β 항이
 * 하나뿐이라 소거 속도가 N×β 가 되지 않는다. 잔이 겹치는 구간(0 을 찍지 않는 보통의
 * 술자리)에서는 총량 일괄과 수치가 완전히 같다. 바뀌는 건 그래프 중간 모양과
 * 0 을 찍고 다시 마시는 경우뿐이다.
 *
 * @returns untilMs 까지 반영한 마지막 잔의 시각과 그 직후 BAC. 반영할 잔이 없으면 null.
 */
function accumulateUntil(
  finished: FinishedRecord[],
  contribution: Contribution,
  untilMs: number,
): { bac: number; atMs: number } | null {
  const sorted = [...finished].sort((a, b) => a.finishedAt - b.finishedAt);
  let bac = 0;
  let atMs = 0;
  let started = false;

  for (const record of sorted) {
    if (record.finishedAt > untilMs) break;
    if (started) {
      const decayed = bac - BETA * ((record.finishedAt - atMs) / 3_600_000);
      bac = decayed > 0 ? decayed : 0;
    }
    bac += contribution(record);
    atMs = record.finishedAt;
    started = true;
  }

  return started ? { bac, atMs } : null;
}

/**
 * "지금" BAC 용 시각 보정.
 *
 * 그래프는 과거 시각을 그대로 물어봐야 한다 — 아직 안 마신 잔은 0 이어야
 * 계단이 그려지니까. 반면 "지금 내 BAC" 는 다르다: 기록이 존재한다는 건 이미
 * 마셨다는 뜻이므로, nowMs 가 완료 시각보다 앞서면(기기 시계 역행, 미래로 찍힌
 * 기록) 그 술을 안 마신 걸로 쳐선 안 된다. 0 을 돌려주면 취한 사람에게
 * "지금 안전" 이라고 말하게 된다 — 이 앱에서 가장 위험한 오답이다.
 *
 * 그래서 조회 시각을 마지막 완료 시각까지 앞으로 당긴다. 분해는 그만큼
 * 덜 하므로(경과 0) 보수적인 쪽으로만 틀린다.
 */
function clampNowMs(finished: FinishedRecord[], nowMs: number): number {
  const lastMs = Math.max(...finished.map(r => r.finishedAt));
  return nowMs > lastMs ? nowMs : lastMs;
}

/** 임의 시각의 BAC (%) — 누산 결과에서 남은 구간만 마저 깎는다 */
function bacAtMs(
  finished: FinishedRecord[],
  contribution: Contribution,
  atMs: number,
): number {
  const acc = accumulateUntil(finished, contribution, atMs);
  if (acc == null) return 0;
  const elapsedMs = atMs - acc.atMs;
  const elapsedHours = elapsedMs > 0 ? elapsedMs / 3_600_000 : 0;
  const bac = acc.bac - BETA * elapsedHours;
  return bac > 0 ? bac : 0;
}

/**
 * BAC 가 0 이 되는 시각 (epoch ms). 마실 게 없으면 null.
 *
 * 마지막 잔 직후 BAC 는 항상 그 잔의 기여분 이상이라, 결과는 반드시
 * 마지막 잔보다 뒤에 놓인다 — "마지막 잔보다 먼저 깼다"가 나오지 않는다.
 */
function soberAtMsOf(
  finished: FinishedRecord[],
  contribution: Contribution,
): number | null {
  const acc = accumulateUntil(finished, contribution, Infinity);
  if (acc == null || acc.bac <= 0) return null;
  return acc.atMs + Math.round((acc.bac / BETA) * 3_600_000);
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
  return bacAtMs(
    finished,
    r => calcBacContribution(r, profile, nowYear),
    clampNowMs(finished, nowMs),
  );
}

/**
 * 과거 임의 시각의 BAC (%) — 그래프·최고점 계산 전용.
 *
 * currentBac 과의 차이는 딱 하나: 그 시각에 아직 안 마신 잔은 0 으로 본다.
 * (currentBac 은 시계 역행 대비로 조회 시각을 앞당기므로 과거를 물으면
 *  전부 마지막 잔 시점 값이 나온다 — 그래프가 평평해진다.)
 *
 * "지금 안전한가"를 판정하는 자리에는 쓰지 말 것. 그건 currentBac 이다.
 */
export function bacAt(
  records: DrinkRecord[],
  profile: UserProfile,
  atMs: number,
): number {
  const finished = finishedOnly(records);
  if (finished.length === 0) return 0;
  const year = new Date(atMs).getFullYear();
  return bacAtMs(finished, r => calcBacContribution(r, profile, year), atMs);
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

  return soberAtMsOf(finished, r =>
    calcBacContribution(r, profile, referenceYear),
  );
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

  return bacAtMs(
    finished,
    r => calcBacContributionWithConstantR(r, profile),
    clampNowMs(finished, nowMs),
  );
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

  return soberAtMsOf(finished, r =>
    calcBacContributionWithConstantR(r, profile),
  );
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

  const contribution: Contribution = r =>
    calcBacContribution(r, profile, firstYear);

  const stepMs = totalMs / (samples - 1);
  const points: Array<[number, number]> = Array.from(
    { length: samples },
    (_, i) => {
      const t = firstMs + Math.round(stepMs * i);
      return [t, bacAtMs(finished, contribution, t)];
    },
  );

  // 잔을 비운 시각마다 "직전" 값을 한 점 더 끼운다.
  // 균일 격자만 쓰면 계단이 두 표본에 걸쳐 비스듬한 선으로 뭉개진다 —
  // 사용자가 보고 싶은 건 마실 때 팍 튀어오르는 수직 상승이다.
  // 1ms 앞 값을 쓰므로 오차는 4e-9 %p (표시 정밀도 0.001% 보다 6자리 아래),
  // x 가 겹치지 않아 렌더러에서도 안전하다.
  for (const record of finished) {
    const t = record.finishedAt;
    if (t <= firstMs || t >= soberAtMs) continue;
    points.push([t - 1, bacAtMs(finished, contribution, t - 1)]);
    points.push([t, bacAtMs(finished, contribution, t)]);
  }

  points.sort((a, b) => a[0] - b[0]);
  return points;
}
