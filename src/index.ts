// ── 타입 ─────────────────────────────────────────────────────────────────────
export type {
  Sex,
  UserProfile,
  DrinkRecord,
  DrinkSession,
  DrinkPreset,
  PlanResult,
} from './core/types';

// ── BAC 계산기 (순수 함수) ────────────────────────────────────────────────────
export {
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
  remainingHoursWithConstantR,
  bacCurve,
} from './core/bacCalculator';

// ── 계획 계산기 (역계산) ──────────────────────────────────────────────────────
export { calculate as planCalculate } from './core/planCalculator';

// ── 저장소 ────────────────────────────────────────────────────────────────────
export {
  insertRecord,
  getOpenSessionRecords,
  getAllSessions,
  getSessionRecords,
  updateRecord,
  deleteRecord,
  closeSession,
  deleteSession,
  deleteAllData,
  closeDb,
} from './storage/db';

export {
  saveProfile,
  loadProfile,
  clearProfile,
} from './storage/profileStorage';

export {
  DEFAULT_PRESETS,
  loadPresets,
  savePresets,
  updatePresetAt,
  seedIfNeeded,
  restoreDefaults,
  clearPresets,
} from './storage/presetStorage';

export {
  saveLocale,
  loadLocale,
  clearLocale,
} from './storage/localeStorage';
export type { LocalePreference } from './storage/localeStorage';

// ── 알림 서비스 ───────────────────────────────────────────────────────────────
export * as notificationService from './services/notifications';

// ── Zustand 스토어 ────────────────────────────────────────────────────────────
export { profileStore } from './state/profileStore';
export { sessionStore } from './state/sessionStore';
export { presetsStore } from './state/presetsStore';
export { localeStore } from './state/localeStore';
export type { LocaleCode } from './state/localeStore';

// ── i18n ──────────────────────────────────────────────────────────────────────
export { i18n } from './i18n';
