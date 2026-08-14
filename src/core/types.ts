export type Sex = 'male' | 'female';

/** 사용자 프로필 — heightCm: 100~250, weightKg: 30~300 */
export interface UserProfile {
  heightCm: number;
  weightKg: number;
  sex: Sex;
  birthYear?: number;
}

/** 음주 기록 — finishedAt == null 이면 마시는중 */
export interface DrinkRecord {
  id?: number;
  consumedAt: number;    // epoch ms
  abvPercent: number;    // 0 < abvPercent <= 100
  volumeMl: number;      // > 0
  presetLabel?: string;
  finishedAt?: number;   // epoch ms; undefined = 마시는중
}

/** 음주 프리셋 */
export interface DrinkPreset {
  label: string;
  emoji: string;
  abvPercent: number;
  volumeMl: number;
  isCustom?: boolean;
}

/** 역계산 결과 */
export interface PlanResult {
  maxVolumeMl: number;
  maxAlcoholGrams: number;
  availableHours: number;
}
