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
  /**
   * 종료된 세션의 ID. null/undefined = 현재 열린 세션.
   *
   * finishedAt 과 같은 null/undefined 이중성 주의:
   * DB 에서 로드하면 null, 메모리에서 신규 생성하면 undefined.
   * 필터링은 SQL 수준(WHERE session_id IS NULL)에서만 수행하며,
   * TS 코드에서 sessionId 를 직접 비교하지 않는다.
   */
  sessionId?: number;
}

/** 종료된 술자리 요약 스냅샷 */
export interface DrinkSession {
  id: number;
  startedAt: number;        // 첫 잔 consumedAt
  lastFinishedAt: number;   // 마지막 잔 finishedAt
  soberAt: number;          // BAC 0 도달 시각 (계산값)
  totalAlcoholG: number;
  peakBac: number;
  /**
   * 세션 내 기록(잔) 수. 세션이 닫히는 시점에는 모든 기록이
   * finishedAt != null 이므로, 이 값은 해당 세션의 전체 기록 수와 같다.
   * UI 라벨 「3잔」= 3개의 개별 음주 기록(용량 무관).
   */
  drinkCount: number;
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
