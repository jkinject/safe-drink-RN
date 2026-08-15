/**
 * SessionStore 세션 생명주기 테스트
 *
 * 목(mock) 전략: jest.mock('../../storage/db') — 모든 DB 함수를 제어된 값으로 대체.
 * profileStore, localeStore, notificationService 도 모두 목 처리.
 * 이를 통해 스토어 로직을 순수하게 테스트한다.
 */

import { DrinkRecord, DrinkSession, UserProfile } from '../../core/types';
import { currentBac } from '../../core/bacCalculator';
import { computePeakBac } from '../../core/sessionUtils';

// ── mock 변수 (jest.mock 호이스팅 허용 — 'mock' 접두사 필수) ───────────────

let mockProfile: UserProfile | null;

// ── 모듈 mock ─────────────────────────────────────────────────────────────

jest.mock('../../storage/db', () => ({
  getOpenSessionRecords: jest.fn(async () => []),
  getAllSessions: jest.fn(async () => []),
  insertRecord: jest.fn(async () => 1),
  updateRecord: jest.fn(async () => {}),
  deleteRecord: jest.fn(async () => {}),
  closeSession: jest.fn(async () => 1),
  deleteSession: jest.fn(async () => {}),
  deleteAllData: jest.fn(async () => {}),
  getSessionRecords: jest.fn(async () => []),
}));

jest.mock('../../services/notifications', () => ({
  cancelAll: jest.fn(async () => {}),
  scheduleSoberNotification: jest.fn(async () => {}),
  initialize: jest.fn(async () => {}),
}));

jest.mock('../profileStore', () => ({
  profileStore: {
    getState: () => ({ profile: mockProfile }),
  },
}));

jest.mock('../localeStore', () => ({
  localeStore: {
    getState: () => ({ locale: 'ko' }),
  },
}));

// ── import (mock 설정 이후) ───────────────────────────────────────────────

import { sessionStore } from '../sessionStore';
import * as db from '../../storage/db';

const mockDb = db as jest.Mocked<typeof db>;

// ── 픽스처 ───────────────────────────────────────────────────────────────

const maleProfile: UserProfile = { heightCm: 175, weightKg: 70, sex: 'male' };

const t0 = new Date(2026, 0, 1, 18, 0, 0).getTime();
const t1 = t0 + 3_600_000; // t0 + 1h

/** 24시간 전에 완료된 기록 → BAC 확실히 0 */
const staleRecord: DrinkRecord = {
  id: 1,
  consumedAt: t0 - 24 * 3_600_000,
  abvPercent: 4.5,
  volumeMl: 500,
  finishedAt: t0 - 24 * 3_600_000,
};

/** 방금 완료된 기록 → BAC > 0 */
const freshRecord: DrinkRecord = {
  id: 2,
  consumedAt: Date.now(),
  abvPercent: 4.5,
  volumeMl: 500,
  finishedAt: Date.now(),
};

/** 마시는중 기록 (finishedAt == null) */
const drinkingRecord: DrinkRecord = {
  id: 3,
  consumedAt: t0,
  abvPercent: 4.5,
  volumeMl: 500,
};

const closedSession: DrinkSession = {
  id: 10,
  startedAt: t0 - 24 * 3_600_000,
  lastFinishedAt: t0 - 22 * 3_600_000,
  soberAt: t0 - 20 * 3_600_000,
  totalAlcoholG: 18,
  peakBac: 0.034,
  drinkCount: 1,
};

// ── 공통 setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  mockProfile = maleProfile;
  // 스토어 상태 초기화
  sessionStore.setState({ records: [], sessions: [], isLoading: false });
  // mock 반환값 초기화
  mockDb.getOpenSessionRecords.mockResolvedValue([]);
  mockDb.getAllSessions.mockResolvedValue([]);
  mockDb.closeSession.mockResolvedValue(1);
  mockDb.deleteSession.mockResolvedValue(undefined);
  mockDb.deleteAllData.mockResolvedValue(undefined);
  mockDb.getSessionRecords.mockResolvedValue([]);
  jest.clearAllMocks();
  // clearAllMocks 후 재설정 (clearAllMocks 가 구현을 지우지 않지만 호출 기록은 지움)
  mockDb.getOpenSessionRecords.mockResolvedValue([]);
  mockDb.getAllSessions.mockResolvedValue([]);
  mockDb.closeSession.mockResolvedValue(1);
});

// ── load ──────────────────────────────────────────────────────────────────

describe('load', () => {
  test('getOpenSessionRecords 에서 열린 세션 기록만 로드', async () => {
    const singleRecord: DrinkRecord = { ...freshRecord };
    mockDb.getOpenSessionRecords.mockResolvedValue([singleRecord]);

    await sessionStore.getState().load();

    expect(sessionStore.getState().records).toHaveLength(1);
    expect(sessionStore.getState().records[0].id).toBe(singleRecord.id);
  });

  test('로드 후 isLoading = false', async () => {
    await sessionStore.getState().load();
    expect(sessionStore.getState().isLoading).toBe(false);
  });

  test('records 없으면 checkAutoClose 는 아무것도 안 함', async () => {
    mockDb.getOpenSessionRecords.mockResolvedValue([]);
    await sessionStore.getState().load();

    expect(mockDb.closeSession).not.toHaveBeenCalled();
    expect(sessionStore.getState().records).toHaveLength(0);
  });
});

// ── checkAutoClose ────────────────────────────────────────────────────────

describe('checkAutoClose', () => {
  test('기록 없음 → 세션 닫기 없음', async () => {
    sessionStore.setState({ records: [] });
    await sessionStore.getState().checkAutoClose();
    expect(mockDb.closeSession).not.toHaveBeenCalled();
  });

  test('profile 없음 → 세션 닫기 없음', async () => {
    mockProfile = null;
    sessionStore.setState({ records: [staleRecord] });
    await sessionStore.getState().checkAutoClose();
    expect(mockDb.closeSession).not.toHaveBeenCalled();
  });

  test('마시는중 기록 있음 → 세션 유지 (BAC 0 이어도)', async () => {
    sessionStore.setState({ records: [staleRecord, drinkingRecord] });
    await sessionStore.getState().checkAutoClose();
    expect(mockDb.closeSession).not.toHaveBeenCalled();
  });

  test('BAC > 0 → 세션 유지', async () => {
    // freshRecord: finishedAt = now → BAC > 0
    sessionStore.setState({ records: [freshRecord] });
    await sessionStore.getState().checkAutoClose();
    expect(mockDb.closeSession).not.toHaveBeenCalled();
  });

  test('BAC = 0 + 모두 완료 → 세션 닫기 + records 초기화', async () => {
    // staleRecord: 24시간 전 완료 → BAC 확실히 0
    mockDb.getAllSessions.mockResolvedValue([closedSession]);
    sessionStore.setState({ records: [staleRecord] });

    await sessionStore.getState().checkAutoClose();

    expect(mockDb.closeSession).toHaveBeenCalledTimes(1);
    expect(sessionStore.getState().records).toHaveLength(0);
    expect(sessionStore.getState().sessions).toHaveLength(1);
  });

  test('BAC = 0 → closeSession 에 올바른 summary 전달', async () => {
    sessionStore.setState({ records: [staleRecord] });
    await sessionStore.getState().checkAutoClose();

    const [summary] = mockDb.closeSession.mock.calls[0];
    expect(summary.drinkCount).toBe(1);
    expect(typeof summary.peakBac).toBe('number');
    expect(summary.peakBac).toBeGreaterThan(0);
    expect(typeof summary.startedAt).toBe('number');
    expect(typeof summary.soberAt).toBe('number');
  });
});

// ── BAC 격리 (핵심 회귀 방지) ──────────────────────────────────────────────

describe('BAC 격리 — ghost BAC 회귀 방지', () => {
  test('3개 닫힌 세션 + 열린 기록 1개 → records.length === 1', async () => {
    const openRecord: DrinkRecord = {
      id: 99,
      consumedAt: Date.now(),
      abvPercent: 4.5,
      volumeMl: 300,
      finishedAt: Date.now(),
    };

    mockDb.getOpenSessionRecords.mockResolvedValue([openRecord]);
    mockDb.getAllSessions.mockResolvedValue([
      { ...closedSession, id: 11 },
      { ...closedSession, id: 12 },
      { ...closedSession, id: 13 },
    ]);

    await sessionStore.getState().load();
    await sessionStore.getState().loadSessions();

    // records 에는 열린 세션 기록만 있어야 함
    expect(sessionStore.getState().records).toHaveLength(1);
    expect(sessionStore.getState().records[0].id).toBe(99);

    // sessions 에는 닫힌 세션 3개
    expect(sessionStore.getState().sessions).toHaveLength(3);
  });

  test('3개 닫힌 세션이 있어도 currentBac 은 열린 기록 1개만으로 계산됨', async () => {
    // finishedAt = now → BAC > 0 → checkAutoClose 가 세션을 닫지 않음
    const now = Date.now();
    const openRecord: DrinkRecord = {
      id: 99,
      consumedAt: now,
      abvPercent: 4.5,
      volumeMl: 500,
      finishedAt: now,
    };

    mockDb.getOpenSessionRecords.mockResolvedValue([openRecord]);

    await sessionStore.getState().load();

    const { records } = sessionStore.getState();
    // 스토어의 records 는 열린 기록 1개뿐
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(99);
    // 이 records 로 계산한 BAC 는 단일 음주 기준값과 일치해야 함
    const bac = currentBac(records, maleProfile, now);
    const expectedBac = currentBac([openRecord], maleProfile, now);
    expect(bac).toBeCloseTo(expectedBac, 10);
    expect(bac).toBeGreaterThan(0);
  });
});

// ── clearAll ──────────────────────────────────────────────────────────────

describe('clearAll', () => {
  test('deleteAllData 호출 + records/sessions 모두 초기화', async () => {
    sessionStore.setState({
      records: [freshRecord],
      sessions: [closedSession],
    });

    await sessionStore.getState().clearAll();

    expect(mockDb.deleteAllData).toHaveBeenCalledTimes(1);
    expect(sessionStore.getState().records).toHaveLength(0);
    expect(sessionStore.getState().sessions).toHaveLength(0);
  });
});

// ── loadSessions / deleteSession ───────────────────────────────────────────

describe('loadSessions', () => {
  test('getAllSessions 결과가 sessions 상태에 반영됨', async () => {
    mockDb.getAllSessions.mockResolvedValue([closedSession]);
    await sessionStore.getState().loadSessions();
    expect(sessionStore.getState().sessions).toHaveLength(1);
    expect(sessionStore.getState().sessions[0].id).toBe(closedSession.id);
  });
});

describe('deleteSession', () => {
  test('deleteSession(id) 호출 후 sessions 목록 갱신', async () => {
    sessionStore.setState({ sessions: [closedSession] });
    mockDb.getAllSessions.mockResolvedValue([]);

    await sessionStore.getState().deleteSession(closedSession.id);

    expect(mockDb.deleteSession).toHaveBeenCalledWith(closedSession.id);
    expect(sessionStore.getState().sessions).toHaveLength(0);
  });
});

// ── 스냅샷 불변성 ──────────────────────────────────────────────────────────

describe('스냅샷 불변성', () => {
  test('세션 종료 후 profile 변경해도 loadSessions 가 DB 저장값을 그대로 반환', async () => {
    // 1. 남성 프로필로 세션 종료 — closeSession 에 넘긴 summary 캡처
    mockProfile = maleProfile;
    sessionStore.setState({ records: [staleRecord] });
    await sessionStore.getState().checkAutoClose();

    const [summaryAtClose] = mockDb.closeSession.mock.calls[0];
    const maleComputedPeak = computePeakBac([staleRecord], maleProfile);

    // 2. 프로필을 여성으로 교체 — 분배계수(r) 차이로 BAC 가 달라짐
    const femaleProfile: UserProfile = { heightCm: 162, weightKg: 55, sex: 'female' };
    mockProfile = femaleProfile;
    const femaleRecomputedPeak = computePeakBac([staleRecord], femaleProfile);

    // 전제: 두 프로필의 peakBac 은 충분히 달라야 함 (이 전제가 깨지면 테스트 자체가 무의미)
    expect(Math.abs(maleComputedPeak - femaleRecomputedPeak)).toBeGreaterThan(0.001);

    // 3. DB 는 종료 시점의 summary 값 그대로 저장 — loadSessions 는 재계산하지 않음
    const storedSession: DrinkSession = {
      id: 1,
      startedAt: summaryAtClose.startedAt,
      lastFinishedAt: summaryAtClose.lastFinishedAt,
      soberAt: summaryAtClose.soberAt,
      totalAlcoholG: summaryAtClose.totalAlcoholG,
      peakBac: summaryAtClose.peakBac,   // 남성 프로필 기준 계산값
      drinkCount: summaryAtClose.drinkCount,
    };
    mockDb.getAllSessions.mockResolvedValue([storedSession]);

    // 4. 세션 목록 재로드
    await sessionStore.getState().loadSessions();

    const sessions = sessionStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    // 스토어가 노출하는 값 = DB 저장값 = 종료 시 남성 프로필로 계산된 값
    expect(sessions[0].peakBac).toBeCloseTo(maleComputedPeak, 10);
    // 여성 프로필로 재계산했다면 달랐을 값 — 이 단언이 실패하면 테스트 전제가 무너진 것
    expect(sessions[0].peakBac).not.toBeCloseTo(femaleRecomputedPeak, 3);
  });
});

// ── 닫힌 뒤 새 기록 추가 (D3) ─────────────────────────────────────────────

describe('닫힌 뒤 새 기록 추가', () => {
  test('새 기록 추가 → 새 세션 시작, 과거 세션 기록 부활 없음 (D3)', async () => {
    // 1. BAC = 0 → 세션 자동 종료
    mockDb.getAllSessions.mockResolvedValue([closedSession]);
    sessionStore.setState({ records: [staleRecord] });
    await sessionStore.getState().checkAutoClose();

    expect(mockDb.closeSession).toHaveBeenCalledTimes(1);
    expect(sessionStore.getState().records).toHaveLength(0);

    // 종료 시 저장된 summary 캡처 (이 값이 addRecord 이후에도 변하지 않아야 함)
    const [summaryAtClose] = mockDb.closeSession.mock.calls[0];

    // 2. 새 기록 추가 — getOpenSessionRecords 는 이 기록만 반환 (새 열린 세션)
    const newDrink: DrinkRecord = {
      id: 100,
      consumedAt: Date.now(),
      abvPercent: 5.0,
      volumeMl: 330,
      finishedAt: Date.now(),
    };
    mockDb.insertRecord.mockResolvedValue(100);
    mockDb.getOpenSessionRecords.mockResolvedValue([newDrink]);

    await sessionStore.getState().addRecord({
      consumedAt: newDrink.consumedAt!,
      abvPercent: newDrink.abvPercent,
      volumeMl: newDrink.volumeMl,
      finishedAt: newDrink.finishedAt,
    });

    // 3. records 에는 새 기록만 있어야 함 — 과거 세션 기록 부활 없음
    expect(sessionStore.getState().records).toHaveLength(1);
    expect(sessionStore.getState().records[0].id).toBe(100);

    // 4. addRecord 가 closeSession 을 추가 호출하지 않음 — 과거 summary 불변
    expect(mockDb.closeSession).toHaveBeenCalledTimes(1);
    // 종료 시 저장된 summary 수치가 새 기록 추가로 변경되지 않음
    expect(summaryAtClose.peakBac).toBeCloseTo(
      computePeakBac([staleRecord], maleProfile),
      10,
    );
  });
});

// ── load-time stale session 종료 (B3) ────────────────────────────────────

describe('load-time stale session closure (B3)', () => {
  test('load 시 BAC = 0 인 stale 기록 → 자동 종료', async () => {
    // 앱이 꺼져 있는 동안 BAC 가 0 이 된 세션
    mockDb.getOpenSessionRecords.mockResolvedValue([staleRecord]);
    mockDb.getAllSessions.mockResolvedValue([closedSession]);

    await sessionStore.getState().load();

    expect(mockDb.closeSession).toHaveBeenCalledTimes(1);
    expect(sessionStore.getState().records).toHaveLength(0);
  });

  test('load 시 BAC > 0 → 세션 유지', async () => {
    mockDb.getOpenSessionRecords.mockResolvedValue([freshRecord]);

    await sessionStore.getState().load();

    expect(mockDb.closeSession).not.toHaveBeenCalled();
    expect(sessionStore.getState().records).toHaveLength(1);
  });
});
