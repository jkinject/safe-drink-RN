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
  /** 아이콘 키 (components/drink-icon 의 이름). 구버전 기록에는 없을 수 있다 */
  icon?: string;
  /** @deprecated 구버전 저장 데이터 호환용 — 표시에는 icon 을 쓴다 */
  emoji?: string;
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
