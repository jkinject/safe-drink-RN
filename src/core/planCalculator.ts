/**
 * 역계산(계획 모드) — 목표 시각 + 도수% → 최대 ml 계산
 */
import { UserProfile, PlanResult } from './types';
import { calcR } from './bacCalculator';

const BETA = 0.015;            // 분해율 (%/h)
const DENSITY_ETHANOL = 0.789;

/**
 * 최대 음주 가능량 계산
 *
 * @param targetTime 음주를 마치고 안전해야 하는 목표 시각 (epoch ms)
 * @param nowMs 현재 시각 (epoch ms)
 * @param abvPercent 음료 도수 (%)
 * @param profile 사용자 프로필
 *
 * 목표 시각이 현재 이전이면 Error 예외 발생.
 * abvPercent 가 0 초과 100 이하가 아니면 Error 예외 발생.
 */
export function calculate({
  targetTime,
  nowMs,
  abvPercent,
  profile,
}: {
  targetTime: number;
  nowMs: number;
  abvPercent: number;
  profile: UserProfile;
}): PlanResult {
  if (abvPercent <= 0 || abvPercent > 100) {
    throw new Error('abvPercent 는 0 초과 100 이하여야 합니다');
  }
  const diffMs = targetTime - nowMs;
  if (diffMs <= 0) {
    throw new Error('목표 시각이 이미 지났습니다.');
  }

  const availableHours = diffMs / 3_600_000;
  const r = calcR(profile);

  const maxAlcoholGrams = BETA * availableHours * profile.weightKg * r * 10;
  const maxVolumeMl = maxAlcoholGrams / (abvPercent / 100) / DENSITY_ETHANOL;

  return { maxVolumeMl, maxAlcoholGrams, availableHours };
}
