/**
 * 세션 메트릭 계산 유틸리티 — 순수 함수, UI/DB 의존 없음.
 *
 * bacCalculator.ts 는 변경 금지 영역이므로 세션 전용 로직은 여기에 둔다.
 */
import { DrinkRecord, DrinkSession, UserProfile } from './types';
import { currentBac, estimatedSoberAt, totalAlcoholGrams } from './bacCalculator';
// i18n 을 import 하지 말 것 — getBacBadge 는 문자열이 아니라 labelKey 를 반환한다.
// src/core 는 UI 의존 금지 영역이므로 src/i18n 으로의 의존이 생기면 안 된다.

type FinishedRecord = DrinkRecord & { finishedAt: number };

/**
 * 세션의 최고 BAC (%) 계산.
 *
 * 이 앱의 단순(총량) 분해 모델에서 currentBac(records, profile, t) 는
 * Σbac_i − β × max(0, t − firstFinishedAt) 이므로,
 * t = firstFinishedAt 일 때 값이 Σbac_i 로 최대다 (경과 시간 0, 분해 없음).
 *
 * 이 값은 bacCurve() 의 첫 번째 샘플과 동일하며,
 * 사용자가 그래프에서 보는 최고점과 일치한다.
 *
 * 스펙의 정의("각 잔의 finishedAt 시점에서 평가한 currentBac() 중 최댓값")를
 * 그대로 구현하되, 위 동치성을 주석으로 남긴다.
 *
 * ⚠️ 이 함수를 "lastFinishedAt 한 번만 평가"로 "최적화"하면
 * 그래프 최고점보다 낮은 값이 저장되어 UI 불일치가 발생한다. 변경 금지.
 */
export function computePeakBac(
  records: DrinkRecord[],
  profile: UserProfile,
): number {
  const finished = records.filter(
    (r): r is FinishedRecord => r.finishedAt != null,
  );
  if (finished.length === 0) return 0;
  return Math.max(
    ...finished.map(r => currentBac(records, profile, r.finishedAt)),
  );
}

/**
 * 세션 종료 시 저장할 요약 스냅샷 계산.
 *
 * 완료된 기록이 없으면 null — 던지지 않는다.
 * 호출자(checkAutoClose)가 1초 타이머 위에서 도는 경로라 예외를 올리면
 * serialize 체인과 호출부 .catch 에 삼켜져 원인 추적이 어려워진다.
 */
export function computeSessionSummary(
  records: DrinkRecord[],
  profile: UserProfile,
): Omit<DrinkSession, 'id'> | null {
  const finished = records.filter(
    (r): r is FinishedRecord => r.finishedAt != null,
  );
  // 방어 가드: 호출부의 선행 검사가 비어있지 않음을 보장하지만,
  // 그 가드가 리팩터링으로 사라지면 Math.min/max 가 ±Infinity 를 낸다
  if (finished.length === 0) return null;

  const startedAt = Math.min(...finished.map(r => r.consumedAt));
  const lastFinishedAt = Math.max(...finished.map(r => r.finishedAt));
  const soberAt = estimatedSoberAt(records, profile) ?? Date.now();
  const totalAlcoholG = totalAlcoholGrams(records);
  const peakBac = computePeakBac(records, profile);
  const drinkCount = finished.length;

  return { startedAt, lastFinishedAt, soberAt, totalAlcoholG, peakBac, drinkCount };
}

/**
 * BAC 기준 법적 구간 뱃지.
 * 기존 index.tsx:337-341 에서 추출 — 히스토리 화면과 공유.
 *
 * 법령 기준: BAC >= 0.08 → 면허 취소, >= 0.03 → 면허 정지.
 */
export function getBacBadge(
  bac: number,
): { labelKey: string; color: string; bg: string } | null {
  if (bac >= 0.08) return { labelKey: 'bacStatusRevocation', color: '#FF3B30', bg: '#FFF0EF' };
  if (bac >= 0.03) return { labelKey: 'bacStatusSuspension', color: '#FF9500', bg: '#FFF8F0' };
  return null;
}
