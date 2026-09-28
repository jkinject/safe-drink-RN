/**
 * 백업 스냅샷 코어 — 로컬 데이터 전체를 JSON 한 덩어리로 만들고(build),
 * 받은 덩어리를 검증하고(validate), 로컬을 통째로 교체한다(apply).
 *
 * 스냅샷 방식이라 병합은 없다 — 복원은 항상 "전부 지우고 스냅샷으로 교체"다.
 * 네트워크·UI 는 여기 없다(api.ts·backupStore 가 담당).
 *
 * 포함하지 않는 것: ads_removed(스토어 보유 조회가 원본), live_activity_id(기기 로컬
 * 활동 핸들), 리뷰 요청 상태(기기별 노출 이력). 다른 기기로 옮기면 틀린 값이 된다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { DrinkPreset, DrinkRecord, DrinkSession, UserProfile } from '../../core/types';
import * as db from '../../storage/db';
import * as profileStorage from '../../storage/profileStorage';
import * as presetStorage from '../../storage/presetStorage';
import * as localeStorage from '../../storage/localeStorage';
import type { LocalePreference } from '../../storage/localeStorage';
import * as settingsStorage from '../../storage/settingsStorage';
import { settingsStore } from '../../state/settingsStore';
import { profileStore } from '../../state/profileStore';
import { presetsStore } from '../../state/presetsStore';
import { localeStore } from '../../state/localeStore';
import { sessionStore } from '../../state/sessionStore';

/**
 * 스냅샷 형식 버전. 필드 의미가 바뀌면 올리고 migrateToCurrent 에 단계를 추가한다.
 * 서버는 payload 를 해석하지 않으므로 호환성은 전부 이 파일이 책임진다.
 */
export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface BackupSnapshot {
  schemaVersion: number;
  createdAt: number;
  appVersion: string;
  profile: UserProfile | null;
  /** presetStorage.loadPresets() 원본 그대로 (기본 + 커스텀, 사용자 순서 유지) */
  presets: DrinkPreset[];
  /**
   * 기본 프리셋 시드 여부. 빼먹으면 복원 직후 presetsStore.load() 가 시드를 다시 돌려
   * 사용자가 지운 기본 프리셋 8종이 되살아난다.
   */
  presetsSeeded: boolean;
  locale: LocalePreference | null;
  timerNotificationEnabled: boolean;
  /** 열린 세션 + 닫힌 세션 기록 전부 (id·sessionId 포함) */
  drinkRecords: DrinkRecord[];
  drinkSessions: DrinkSession[];
}

export type ValidationResult =
  | { ok: true; snapshot: BackupSnapshot }
  | { ok: false; reason: 'newer-schema' | 'invalid'; detail?: string };

// ── apply 진행 플래그 ───────────────────────────────────────────────────────
//
// 스토어 변경 시 markDirty() 로 자동 백업을 거는데, 복원 중의 재로드까지 변경으로
// 잡히면 방금 받은 스냅샷을 곧바로 다시 업로드한다. apply 동안에는 true 라서
// markDirty 쪽이 이 값을 보고 무시할 수 있다. 가변 export 대신 함수로 노출하는 건
// import 한 쪽이 값을 복사해 가 stale 해지는 일을 막기 위해서다.
let _applying = false;

export function isApplyingSnapshot(): boolean {
  return _applying;
}

// ── build ──────────────────────────────────────────────────────────────────

export async function buildSnapshot(): Promise<BackupSnapshot> {
  const [profile, presets, presetsSeeded, locale, timerNotificationEnabled, all] =
    await Promise.all([
      profileStorage.loadProfile(),
      presetStorage.loadPresets(),
      presetStorage.loadPresetsSeeded(),
      localeStorage.loadLocale(),
      settingsStorage.loadTimerNotificationEnabled(),
      db.exportAll(),
    ]);
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: Date.now(),
    appVersion: Constants.expoConfig?.version ?? '-',
    profile,
    presets,
    presetsSeeded,
    locale,
    timerNotificationEnabled,
    drinkRecords: all.records,
    drinkSessions: all.sessions,
  };
}

// ── validate ───────────────────────────────────────────────────────────────

/** 검증 실패를 한 곳에서 던지고 validateSnapshot 에서 결과로 바꾼다 */
class InvalidSnapshot extends Error {}

function fail(detail: string): never {
  throw new InvalidSnapshot(detail);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);

/** 선택 문자열 — JSON 을 거치면 undefined 가 null 로 올 수 있어 둘 다 "없음"으로 본다 */
function optString(v: unknown, path: string): string | undefined {
  if (v == null) return undefined;
  if (typeof v !== 'string') fail(`${path} 가 문자열이 아님`);
  return v;
}

function checkAbvVolume(o: Record<string, unknown>, path: string): void {
  if (!isFiniteNum(o.abvPercent) || o.abvPercent <= 0 || o.abvPercent > 100) {
    fail(`${path}.abvPercent 범위 밖`);
  }
  if (!isFiniteNum(o.volumeMl) || o.volumeMl <= 0) {
    fail(`${path}.volumeMl 범위 밖`);
  }
}

function parseProfile(v: unknown): UserProfile | null {
  if (v == null) return null;
  if (!isObject(v)) fail('profile 이 객체가 아님');
  if (!isFiniteNum(v.heightCm) || v.heightCm < 100 || v.heightCm > 250) {
    fail('profile.heightCm 범위 밖');
  }
  if (!isFiniteNum(v.weightKg) || v.weightKg < 30 || v.weightKg > 300) {
    fail('profile.weightKg 범위 밖');
  }
  if (v.sex !== 'male' && v.sex !== 'female') fail('profile.sex 값이 잘못됨');
  if (v.birthYear != null && !isInt(v.birthYear)) fail('profile.birthYear 가 정수가 아님');
  const profile: UserProfile = { heightCm: v.heightCm, weightKg: v.weightKg, sex: v.sex };
  if (v.birthYear != null) profile.birthYear = v.birthYear as number;
  return profile;
}

function parsePreset(v: unknown, i: number): DrinkPreset {
  const path = `presets[${i}]`;
  if (!isObject(v)) fail(`${path} 가 객체가 아님`);
  if (typeof v.label !== 'string') fail(`${path}.label 이 문자열이 아님`);
  checkAbvVolume(v, path);
  if (v.isCustom != null && typeof v.isCustom !== 'boolean') {
    fail(`${path}.isCustom 이 불리언이 아님`);
  }
  const preset: DrinkPreset = {
    label: v.label,
    abvPercent: v.abvPercent as number,
    volumeMl: v.volumeMl as number,
  };
  // 없는 키는 아예 만들지 않는다 — 저장본 JSON 모양을 원본과 같게 유지
  const icon = optString(v.icon, `${path}.icon`);
  const emoji = optString(v.emoji, `${path}.emoji`);
  if (icon !== undefined) preset.icon = icon;
  if (emoji !== undefined) preset.emoji = emoji;
  if (v.isCustom != null) preset.isCustom = v.isCustom as boolean;
  return preset;
}

function parseRecord(v: unknown, i: number): DrinkRecord {
  const path = `drinkRecords[${i}]`;
  if (!isObject(v)) fail(`${path} 가 객체가 아님`);
  // id 필수 — 기록↔세션 연결과 이후 수정·삭제가 전부 id 로 이뤄진다
  if (!isInt(v.id)) fail(`${path}.id 가 정수가 아님`);
  if (!isFiniteNum(v.consumedAt)) fail(`${path}.consumedAt 이 숫자가 아님`);
  checkAbvVolume(v, path);
  if (v.finishedAt != null && !isFiniteNum(v.finishedAt)) {
    fail(`${path}.finishedAt 이 숫자가 아님`);
  }
  if (v.sessionId != null && !isInt(v.sessionId)) fail(`${path}.sessionId 가 정수가 아님`);
  // null(JSON) 은 undefined 로 정규화한다 — 메모리 쪽 DrinkRecord 는 undefined 가 "마시는중"
  // 이고, 판정은 어디서나 `== null` 이라 두 표현 모두 같게 동작한다.
  return {
    id: v.id as number,
    consumedAt: v.consumedAt,
    abvPercent: v.abvPercent as number,
    volumeMl: v.volumeMl as number,
    presetLabel: optString(v.presetLabel, `${path}.presetLabel`),
    icon: optString(v.icon, `${path}.icon`),
    finishedAt: v.finishedAt == null ? undefined : (v.finishedAt as number),
    sessionId: v.sessionId == null ? undefined : (v.sessionId as number),
  };
}

function parseSession(v: unknown, i: number): DrinkSession {
  const path = `drinkSessions[${i}]`;
  if (!isObject(v)) fail(`${path} 가 객체가 아님`);
  if (!isInt(v.id)) fail(`${path}.id 가 정수가 아님`);
  const nums = [
    'startedAt',
    'lastFinishedAt',
    'soberAt',
    'totalAlcoholG',
    'peakBac',
    'drinkCount',
  ] as const;
  for (const k of nums) {
    if (!isFiniteNum(v[k])) fail(`${path}.${k} 가 숫자가 아님`);
  }
  return {
    id: v.id as number,
    startedAt: v.startedAt as number,
    lastFinishedAt: v.lastFinishedAt as number,
    soberAt: v.soberAt as number,
    totalAlcoholG: v.totalAlcoholG as number,
    peakBac: v.peakBac as number,
    drinkCount: v.drinkCount as number,
  };
}

function parseArray<T>(
  v: unknown,
  name: string,
  parse: (x: unknown, i: number) => T,
): T[] {
  if (!Array.isArray(v)) fail(`${name} 가 배열이 아님`);
  return v.map(parse);
}

/**
 * 구 스키마 → 현재 스키마. v1 이 첫 버전이라 지금은 변환할 것이 없다.
 * 버전을 올릴 때 `if (version < 2) raw = { ...raw, 새필드: 기본값 }` 식으로 단계를 쌓는다
 * (검증은 변환 뒤 현재 스키마 기준으로 한 번만 한다).
 */
function migrateToCurrent(
  raw: Record<string, unknown>,
  _version: number,
): Record<string, unknown> {
  return raw;
}

export function validateSnapshot(input: unknown): ValidationResult {
  try {
    if (!isObject(input)) fail('스냅샷이 객체가 아님');
    const version = input.schemaVersion;
    if (!isInt(version) || version < 1) fail('schemaVersion 이 잘못됨');
    // 새 앱이 만든 백업을 구 앱이 풀면 모르는 필드를 버린 채 덮어쓰게 된다 — 거부하고
    // 앱 업데이트를 안내한다
    if (version > SNAPSHOT_SCHEMA_VERSION) {
      return { ok: false, reason: 'newer-schema', detail: `schemaVersion ${version}` };
    }
    const raw = migrateToCurrent(input, version);

    if (!isFiniteNum(raw.createdAt)) fail('createdAt 이 숫자가 아님');
    if (typeof raw.appVersion !== 'string') fail('appVersion 이 문자열이 아님');
    if (typeof raw.presetsSeeded !== 'boolean') fail('presetsSeeded 가 불리언이 아님');
    if (typeof raw.timerNotificationEnabled !== 'boolean') {
      fail('timerNotificationEnabled 가 불리언이 아님');
    }
    const locale = raw.locale ?? null;
    if (locale !== null && locale !== 'ko' && locale !== 'en' && locale !== 'system') {
      fail('locale 값이 잘못됨');
    }

    const snapshot: BackupSnapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      createdAt: raw.createdAt,
      appVersion: raw.appVersion,
      profile: parseProfile(raw.profile),
      presets: parseArray(raw.presets, 'presets', parsePreset),
      presetsSeeded: raw.presetsSeeded,
      locale: locale as LocalePreference | null,
      timerNotificationEnabled: raw.timerNotificationEnabled,
      drinkRecords: parseArray(raw.drinkRecords, 'drinkRecords', parseRecord),
      drinkSessions: parseArray(raw.drinkSessions, 'drinkSessions', parseSession),
    };
    return { ok: true, snapshot };
  } catch (e) {
    if (e instanceof InvalidSnapshot) {
      return { ok: false, reason: 'invalid', detail: e.message };
    }
    throw e;
  }
}

// ── apply ──────────────────────────────────────────────────────────────────

/** [키, 값] — 값 null 은 "키 없음" (multiRemove 대상) */
type StorageEntry = [string, string | null];

/** entries 를 한 번의 multiSet + 한 번의 multiRemove 로 쓴다 */
async function writeEntries(entries: StorageEntry[]): Promise<void> {
  const sets = entries.filter((e): e is [string, string] => e[1] !== null);
  const removes = entries.filter(e => e[1] === null).map(([k]) => k);
  if (sets.length > 0) await AsyncStorage.multiSet(sets);
  if (removes.length > 0) await AsyncStorage.multiRemove(removes);
}

/**
 * 스냅샷으로 로컬 전체를 교체한다.
 *
 * 순서: AsyncStorage 현재 값 캡처 → AsyncStorage 일괄 쓰기 → DB 교체(트랜잭션) → 스토어 재로드.
 * 쓰기나 DB 교체 중 하나라도 실패하면 캡처해 둔 원본으로 AsyncStorage 를 되돌린 뒤 던진다
 * (DB 는 트랜잭션 롤백으로 원본이 남는다). 프로필만 바뀌고 기록은 옛것인 반쪽 복원을 막기 위해서다.
 * 키 이름·저장 형식은 각 storage 모듈의 *Entry 헬퍼가 정한다(여기서 하드코딩하지 않는다).
 */
export async function applySnapshot(snapshot: BackupSnapshot): Promise<void> {
  const result = validateSnapshot(snapshot);
  if (!result.ok) throw new Error(result.reason);
  const s = result.snapshot;

  const entries: StorageEntry[] = [
    profileStorage.profileEntry(s.profile),
    presetStorage.presetsEntry(s.presets),
    presetStorage.presetsSeededEntry(s.presetsSeeded),
    localeStorage.localeEntry(s.locale),
    settingsStorage.timerNotificationEntry(s.timerNotificationEnabled),
  ];

  _applying = true;
  try {
    // 되돌릴 원본 — 읽기에 실패하면 아무것도 쓰지 않은 채 던진다
    const original = (await AsyncStorage.multiGet(entries.map(([k]) => k))).map(
      ([k, v]): StorageEntry => [k, v],
    );
    try {
      await writeEntries(entries);
      // 세션 스토어의 직렬화 체인 안에서 DB 교체 + records/sessions 재로드
      await sessionStore.getState().replaceAll({
        records: s.drinkRecords,
        sessions: s.drinkSessions,
      });
    } catch (e) {
      try {
        await writeEntries(original);
      } catch (rollbackError) {
        console.warn('[Backup] 복원 실패 후 AsyncStorage 되돌리기 실패:', rollbackError);
      }
      throw e;
    }

    // 여기부터는 DB 커밋이 끝난 뒤다 — 로컬 데이터는 이미 스냅샷으로 바뀌었으므로
    // 재로드·알림 재계산이 실패해도 되돌리지 않고 삼킨다(호출부는 'restored' 로 취급).
    try {
      // 스토어 재로드. locale 을 presets 보다 먼저 — seeded=false 스냅샷이면
      // presetsStore.load() 가 현재 locale 로 시드하므로 복원된 언어가 먼저 반영돼야 한다.
      // profile·settings 는 sessionStore.load() 앞 — checkAutoClose·알림 재계산이 둘을 읽는다.
      await settingsStore.getState().load();
      await profileStore.getState().load();
      await localeStore.getState().load();
      await presetsStore.getState().load();
      // records 는 replaceAll 이 이미 읽었다. load() 는 복원된 프로필로 자동 종료 판정을 다시 한다
      await sessionStore.getState().load();
      // 복원된 기록 기준으로 "이제 안전해요" 알림·카운트다운을 다시 건다
      await sessionStore.getState().refreshNotifications();
    } catch (e) {
      console.warn('[Backup] 복원 후 재로드·알림 재계산 실패 (데이터는 이미 교체됨):', e);
    }
  } finally {
    _applying = false;
  }
}

// ── summarize ──────────────────────────────────────────────────────────────

/** 복원 확인 화면용 요약 — 기본 프리셋은 누구나 있으니 커스텀만 센다 */
export function summarize(snapshot: BackupSnapshot): {
  recordCount: number;
  customPresetCount: number;
} {
  return {
    recordCount: snapshot.drinkRecords.length,
    customPresetCount: snapshot.presets.filter(p => p.isCustom === true).length,
  };
}
