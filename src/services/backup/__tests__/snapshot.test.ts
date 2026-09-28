/**
 * 백업 스냅샷 build → validate → apply 테스트
 *
 * 목(mock) 전략:
 *   - storage/db: exportAll/importAll 과 스토어가 부르는 조회 함수를 인메모리 배열로 대체.
 *     SQL 의미론(트랜잭션 롤백 등)은 여기서 다루지 않는다 — importAll 실패는 throw 로 흉내.
 *     저장은 실제 DB 처럼 `?? null`, 조회는 rowToRecord 처럼 null → undefined 로 되돌린다.
 *   - AsyncStorage: 루트 __mocks__ 의 인메모리 구현 (실제 storage 모듈을 그대로 탄다)
 *   - notifications: 네이티브 호출 차단
 * 스토어(zustand)는 실물을 쓴다 — apply 후 재로드 결과까지 확인하기 위해.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrinkPreset, DrinkRecord, DrinkSession, UserProfile } from '../../../core/types';

// ── 인메모리 DB (jest.mock 호이스팅 — 'mock' 접두사 필수) ─────────────────────

type StoredRecord = Omit<DrinkRecord, 'finishedAt' | 'sessionId'> & {
  finishedAt: number | null;
  sessionId: number | null;
};

let mockRecords: StoredRecord[] = [];
let mockSessions: DrinkSession[] = [];
let mockImportShouldFail = false;
let mockApplyingDuringImport: boolean | null = null;

jest.mock('../../../storage/db', () => {
  const toRecord = (r: any) => ({
    ...r,
    finishedAt: r.finishedAt ?? undefined,
    sessionId: r.sessionId ?? undefined,
  });
  return {
    exportAll: jest.fn(async () => ({
      records: mockRecords.map(toRecord),
      sessions: mockSessions.map(s => ({ ...s })),
    })),
    importAll: jest.fn(async (data: { records: any[]; sessions: any[] }) => {
      // apply 도중인지 기록 — 자동 백업 재트리거 방지 플래그 확인용
      const { isApplyingSnapshot } = require('../snapshot');
      mockApplyingDuringImport = isApplyingSnapshot();
      if (mockImportShouldFail) throw new Error('disk I/O error');
      mockRecords = data.records.map((r: any) => ({
        ...r,
        finishedAt: r.finishedAt ?? null,
        sessionId: r.sessionId ?? null,
      }));
      mockSessions = data.sessions.map((s: any) => ({ ...s }));
    }),
    getOpenSessionRecords: jest.fn(async () =>
      mockRecords
        .filter(r => r.sessionId == null)
        .sort((a, b) => a.consumedAt - b.consumedAt)
        .map(toRecord),
    ),
    getAllSessions: jest.fn(async () =>
      [...mockSessions].sort((a, b) => b.startedAt - a.startedAt),
    ),
    closeSession: jest.fn(async () => 999),
    deleteAllData: jest.fn(async () => {}),
  };
});

jest.mock('../../notifications', () => ({
  cancelAll: jest.fn(async () => {}),
  scheduleSoberNotification: jest.fn(async () => {}),
  showTimerNotification: jest.fn(async () => {}),
  dismissTimerNotification: jest.fn(async () => {}),
  initialize: jest.fn(async () => {}),
}));

// ── import (mock 설정 이후) ───────────────────────────────────────────────

import {
  applySnapshot,
  buildSnapshot,
  BackupSnapshot,
  isApplyingSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  summarize,
  validateSnapshot,
} from '../snapshot';
import * as profileStorage from '../../../storage/profileStorage';
import * as presetStorage from '../../../storage/presetStorage';
import * as localeStorage from '../../../storage/localeStorage';
import * as settingsStorage from '../../../storage/settingsStorage';
import { DEFAULT_PRESETS_KO } from '../../../storage/presetStorage';
import { profileStore } from '../../../state/profileStore';
import { presetsStore } from '../../../state/presetsStore';
import { localeStore } from '../../../state/localeStore';
import { settingsStore } from '../../../state/settingsStore';
import { sessionStore } from '../../../state/sessionStore';

// ── 픽스처 ───────────────────────────────────────────────────────────────

const profile: UserProfile = { heightCm: 175, weightKg: 70, sex: 'male', birthYear: 1990 };

const customPresets: DrinkPreset[] = [
  { label: '수제맥주', icon: 'beerMug', abvPercent: 6.5, volumeMl: 400, isCustom: true },
  { label: '사케 1잔', icon: 'sojuGlass', abvPercent: 15, volumeMl: 90, isCustom: true },
];

const now = Date.now();
const h = 3_600_000;

const closedSession: DrinkSession = {
  id: 1,
  startedAt: now - 72 * h,
  lastFinishedAt: now - 71 * h,
  soberAt: now - 68 * h,
  totalAlcoholG: 17.75,
  peakBac: 0.03388,
  drinkCount: 1,
};

/** 닫힌 세션 1건(완료) + 열린 세션 2건(완료 1, 마시는중 1) */
const seedRecords: StoredRecord[] = [
  {
    id: 1, consumedAt: now - 72 * h, abvPercent: 4.5, volumeMl: 500,
    presetLabel: '맥주 500cc', icon: 'beerMug', finishedAt: now - 71 * h, sessionId: 1,
  },
  {
    id: 5, consumedAt: now - 1 * h, abvPercent: 16.5, volumeMl: 50,
    presetLabel: '소주 1잔', icon: 'sojuGlass', finishedAt: now - 0.5 * h, sessionId: null,
  },
  {
    id: 6, consumedAt: now - 0.25 * h, abvPercent: 4.5, volumeMl: 355,
    presetLabel: undefined, icon: undefined, finishedAt: null, sessionId: null, // 마시는중
  },
];

/** 기기 로컬 데이터 전체를 fixture 상태로 채운다 */
async function seedLocal(): Promise<void> {
  mockRecords = seedRecords.map(r => ({ ...r }));
  mockSessions = [{ ...closedSession }];
  await profileStorage.saveProfile(profile);
  await presetStorage.savePresets([...DEFAULT_PRESETS_KO, ...customPresets]);
  await presetStorage.savePresetsSeeded(true);
  await localeStorage.saveLocale('en');
  await settingsStorage.saveTimerNotificationEnabled(false);
  // 백업에서 빠져야 하는 기기 로컬 키
  await AsyncStorage.setItem('ads_removed', 'true');
  await AsyncStorage.setItem('live_activity_id', 'abc');
}

/** 재설치 직후처럼 전부 비운다 */
async function wipeLocal(): Promise<void> {
  mockRecords = [];
  mockSessions = [];
  await AsyncStorage.clear();
}

/** 서버를 한 번 다녀온 것처럼 JSON 으로 직렬화했다가 되읽는다 */
const viaJson = (s: BackupSnapshot): unknown => JSON.parse(JSON.stringify(s));

async function dumpAsyncStorage(): Promise<readonly [string, string | null][]> {
  const keys = [...(await AsyncStorage.getAllKeys())].sort();
  return AsyncStorage.multiGet(keys);
}

const withoutCreatedAt = ({ createdAt: _c, ...rest }: BackupSnapshot) => rest;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockRecords = [];
  mockSessions = [];
  mockImportShouldFail = false;
  mockApplyingDuringImport = null;
  jest.clearAllMocks();
});

// ── 테스트 ───────────────────────────────────────────────────────────────

describe('buildSnapshot', () => {
  test('로컬 전체를 담고, 기기 로컬 키(ads_removed·live_activity_id)는 뺀다', async () => {
    await seedLocal();
    const s = await buildSnapshot();

    expect(s.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(typeof s.appVersion).toBe('string');
    expect(s.profile).toEqual(profile);
    expect(s.presets).toHaveLength(10);
    expect(s.presetsSeeded).toBe(true);
    expect(s.locale).toBe('en');
    expect(s.timerNotificationEnabled).toBe(false);
    // 열린 세션 + 닫힌 세션 기록 전부
    expect(s.drinkRecords.map(r => r.id)).toEqual([1, 5, 6]);
    expect(s.drinkSessions).toEqual([closedSession]);
    const json = JSON.stringify(s);
    expect(json).not.toContain('ads_removed');
    expect(json).not.toContain('live_activity_id');
  });
});

describe('build → apply 왕복', () => {
  test('(a) 모든 필드가 그대로 돌아오고 스토어도 재로드된다', async () => {
    await seedLocal();
    const before = await buildSnapshot();

    await wipeLocal();
    await applySnapshot(viaJson(before) as BackupSnapshot);
    const after = await buildSnapshot();

    expect(withoutCreatedAt(after)).toEqual(withoutCreatedAt(before));

    // id·sessionId 가 그대로 보존됐는지 (기록↔세션 연결)
    expect(mockRecords.map(r => [r.id, r.sessionId])).toEqual([[1, 1], [5, null], [6, null]]);

    // 스토어 재로드
    expect(profileStore.getState().profile).toEqual(profile);
    expect(presetsStore.getState().presets).toHaveLength(10);
    expect(localeStore.getState().locale).toBe('en');
    expect(settingsStore.getState().timerNotificationEnabled).toBe(false);
    expect(sessionStore.getState().records.map(r => r.id)).toEqual([5, 6]);
    expect(sessionStore.getState().sessions).toEqual([closedSession]);

    // apply 중에만 플래그가 켜지고 끝나면 내려간다
    expect(mockApplyingDuringImport).toBe(true);
    expect(isApplyingSnapshot()).toBe(false);
  });

  test('(b) 마시는중 기록의 finishedAt 은 null 로 저장된다', async () => {
    await seedLocal();
    const before = await buildSnapshot();
    await wipeLocal();

    await applySnapshot(viaJson(before) as BackupSnapshot);

    const drinking = mockRecords.find(r => r.id === 6)!;
    expect(drinking.finishedAt).toBeNull();
    // 앱에서도 여전히 마시는중으로 읽힌다 (판정은 == null)
    const inStore = sessionStore.getState().records.find(r => r.id === 6)!;
    expect(inStore.finishedAt == null).toBe(true);
  });

  test('(e) 기록이 하나도 없는 스냅샷도 왕복된다', async () => {
    await profileStorage.saveProfile(profile);
    await presetStorage.savePresets([...DEFAULT_PRESETS_KO]);
    await presetStorage.savePresetsSeeded(true);
    const before = await buildSnapshot();
    expect(before.drinkRecords).toEqual([]);
    expect(before.drinkSessions).toEqual([]);
    expect(before.locale).toBeNull();

    // 복원 대상 기기에 옛 데이터가 있어도 통째로 교체된다
    mockRecords = seedRecords.map(r => ({ ...r }));
    mockSessions = [{ ...closedSession }];
    await localeStorage.saveLocale('ko');

    await applySnapshot(viaJson(before) as BackupSnapshot);
    const after = await buildSnapshot();

    expect(withoutCreatedAt(after)).toEqual(withoutCreatedAt(before));
    expect(mockRecords).toEqual([]);
    expect(mockSessions).toEqual([]);
    expect(await localeStorage.loadLocale()).toBeNull();
    expect(sessionStore.getState().records).toEqual([]);
  });

  test('(g) importAll 이 실패하면 AsyncStorage 는 그대로 두고 던진다', async () => {
    await seedLocal();
    const original = await buildSnapshot();
    const dumpBefore = await dumpAsyncStorage();

    // 다른 사람 데이터처럼 전부 다른 스냅샷
    const other: BackupSnapshot = {
      ...original,
      profile: { heightCm: 160, weightKg: 50, sex: 'female' },
      presets: [...DEFAULT_PRESETS_KO],
      presetsSeeded: false,
      locale: 'ko',
      timerNotificationEnabled: true,
      drinkRecords: [],
      drinkSessions: [],
    };
    mockImportShouldFail = true;

    await expect(applySnapshot(other)).rejects.toThrow('disk I/O error');

    expect(await dumpAsyncStorage()).toEqual(dumpBefore);
    expect(mockRecords.map(r => r.id)).toEqual([1, 5, 6]);
    expect(isApplyingSnapshot()).toBe(false);
  });

  /** 원본과 모든 AsyncStorage 필드가 다르고, locale=null 이라 multiRemove 도 타는 스냅샷 */
  async function otherSnapshot(): Promise<BackupSnapshot> {
    const original = await buildSnapshot();
    return {
      ...original,
      profile: { heightCm: 160, weightKg: 50, sex: 'female' },
      presets: [...DEFAULT_PRESETS_KO],
      presetsSeeded: false,
      locale: null,
      timerNotificationEnabled: true,
      drinkRecords: [],
      drinkSessions: [],
    };
  }

  test('(h) AsyncStorage.multiSet 이 실패하면 원본으로 되돌리고 DB 는 건드리지 않은 채 던진다', async () => {
    await seedLocal();
    const other = await otherSnapshot();
    const dumpBefore = await dumpAsyncStorage();
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(applySnapshot(other)).rejects.toThrow('quota exceeded');

    expect(await dumpAsyncStorage()).toEqual(dumpBefore);
    expect(mockRecords.map(r => r.id)).toEqual([1, 5, 6]);
    expect(isApplyingSnapshot()).toBe(false);
  });

  test('(i) multiSet 뒤 multiRemove 가 실패해도 이미 쓴 키까지 원본으로 되돌린다', async () => {
    await seedLocal();
    const other = await otherSnapshot();
    const dumpBefore = await dumpAsyncStorage();
    (AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(new Error('io error'));

    await expect(applySnapshot(other)).rejects.toThrow('io error');

    // 프로필·프리셋·타이머는 multiSet 으로 이미 바뀌었다가 되돌아와야 한다
    expect(await dumpAsyncStorage()).toEqual(dumpBefore);
    expect(await profileStorage.loadProfile()).toEqual(profile);
    expect(mockRecords.map(r => r.id)).toEqual([1, 5, 6]);
  });
});

describe('sessionStore.replaceAll', () => {
  test('DB 를 교체하고 records(열린 세션)·sessions 를 다시 읽는다', async () => {
    mockRecords = seedRecords.map(r => ({ ...r }));
    mockSessions = [{ ...closedSession }];
    await sessionStore.getState().replaceAll({ records: [], sessions: [] });
    expect(mockRecords).toEqual([]);
    expect(sessionStore.getState().records).toEqual([]);
    expect(sessionStore.getState().sessions).toEqual([]);

    const records = seedRecords.map(r => ({
      ...r,
      finishedAt: r.finishedAt ?? undefined,
      sessionId: r.sessionId ?? undefined,
    }));
    await sessionStore.getState().replaceAll({ records, sessions: [closedSession] });
    expect(sessionStore.getState().records.map(r => r.id)).toEqual([5, 6]);
    expect(sessionStore.getState().sessions).toEqual([closedSession]);
  });
});

describe('validateSnapshot', () => {
  async function validBase(): Promise<Record<string, any>> {
    await seedLocal();
    return viaJson(await buildSnapshot()) as Record<string, any>;
  }

  test('정상 스냅샷은 통과하고 JSON null 은 undefined 로 정규화된다', async () => {
    const base = await validBase();
    const r = validateSnapshot(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const drinking = r.snapshot.drinkRecords.find(x => x.id === 6)!;
    expect(drinking.finishedAt).toBeUndefined();
  });

  test('(c) abv 200 은 invalid', async () => {
    const base = await validBase();
    base.drinkRecords[0].abvPercent = 200;
    const r = validateSnapshot(base);
    expect(r).toMatchObject({ ok: false, reason: 'invalid' });
  });

  test('(c) profile 키 999 는 invalid', async () => {
    const base = await validBase();
    base.profile.heightCm = 999;
    expect(validateSnapshot(base)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  test('(c) 문자열 consumedAt 은 invalid', async () => {
    const base = await validBase();
    base.drinkRecords[1].consumedAt = '2026-09-28T12:00:00Z';
    expect(validateSnapshot(base)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  test('(c) 그 밖의 형식 오류도 invalid', async () => {
    expect(validateSnapshot(null)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(validateSnapshot('{}')).toMatchObject({ ok: false, reason: 'invalid' });

    const noId = await validBase();
    delete noId.drinkRecords[0].id;
    expect(validateSnapshot(noId)).toMatchObject({ ok: false, reason: 'invalid' });

    const badLocale = await validBase();
    badLocale.locale = 'ja';
    expect(validateSnapshot(badLocale)).toMatchObject({ ok: false, reason: 'invalid' });

    const badPreset = await validBase();
    badPreset.presets[0].volumeMl = 0;
    expect(validateSnapshot(badPreset)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  test('(c) 잘못된 스냅샷은 apply 가 throw 하고 아무것도 바꾸지 않는다', async () => {
    const base = await validBase();
    base.drinkRecords[0].abvPercent = 200;
    const dumpBefore = await dumpAsyncStorage();

    await expect(applySnapshot(base as BackupSnapshot)).rejects.toThrow('invalid');

    expect(await dumpAsyncStorage()).toEqual(dumpBefore);
    expect(mockRecords.map(r => r.id)).toEqual([1, 5, 6]);
  });

  test('(d) schemaVersion 2 는 newer-schema', async () => {
    const base = await validBase();
    base.schemaVersion = 2;
    expect(validateSnapshot(base)).toMatchObject({ ok: false, reason: 'newer-schema' });
  });

  test('알 수 없는 필드는 무시한다', async () => {
    const base = await validBase();
    base.futureField = { x: 1 };
    base.drinkRecords[0].mood = 'happy';
    const r = validateSnapshot(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect('futureField' in r.snapshot).toBe(false);
    expect('mood' in r.snapshot.drinkRecords[0]).toBe(false);
  });
});

describe('summarize', () => {
  test('(f) 커스텀 프리셋만 센다', async () => {
    await seedLocal();
    const s = await buildSnapshot();
    expect(summarize(s)).toEqual({ recordCount: 3, customPresetCount: 2 });
  });
});
