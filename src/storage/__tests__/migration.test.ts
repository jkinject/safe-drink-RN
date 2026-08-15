/**
 * v2 → v3 마이그레이션 흐름 테스트
 *
 * 커버 범위: 마이그레이션 FLOW (버전 게이트, 컬럼 존재 확인, 멱등성)
 *
 * 커버하지 않는 것 (의도적 공백):
 *   - 실제 SQLite ALTER TABLE 의미론 (컬럼 타입 강제, 제약 조건)
 *   - PRAGMA user_version 의 프로세스 재시작 후 지속성
 *   - WHERE 절 행 매칭의 SQL 정확성 (UPDATE/DELETE)
 *   - 트랜잭션 롤백 동작
 *
 * 위 항목은 .omc/plans/drink-history-plan-v2.md Section 5 의
 * 수동 기기 사전-OTA 체크리스트에서 다룬다.
 */

// ── 인메모리 mock 상태 ─────────────────────────────────────────────────────
// 변수명이 'mock' 로 시작해야 jest.mock() 팩토리 호이스팅에서 참조 가능하다.

let mockUserVersion: number;
let mockTables: Map<string, string[]>;   // 테이블명 → 컬럼명 목록
let mockRows: Map<string, any[]>;        // 테이블명 → 행 목록
let mockAlterCount: number;              // ALTER TABLE 호출 횟수

// ── expo-sqlite mock ──────────────────────────────────────────────────────

jest.mock('expo-sqlite', () => {
  /**
   * CREATE TABLE SQL 에서 컬럼명 목록을 추출한다.
   * "id INTEGER PRIMARY KEY AUTOINCREMENT, ..." → ['id', ...]
   */
  function parseColumns(sql: string): string[] {
    const open = sql.indexOf('(');
    const close = sql.lastIndexOf(')');
    if (open === -1 || close === -1) return [];
    return sql
      .substring(open + 1, close)
      .split(',')
      .map(col => col.trim().split(/\s+/)[0])
      .filter(name => !!name && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK)$/i.test(name));
  }

  const mockExecAsync = jest.fn(async (sql: string) => {
    // 공백 정규화
    const s = sql.trim().replace(/\s+/g, ' ');

    // PRAGMA user_version = N
    const versionSet = s.match(/PRAGMA user_version = (\d+)/);
    if (versionSet) {
      mockUserVersion = parseInt(versionSet[1], 10);
      return;
    }

    // ALTER TABLE tableName ADD COLUMN colName
    // 실제 SQLite 와 동일하게: 컬럼이 이미 존재하면 throw 한다.
    // 이 제약 덕분에 column-existence guard 가 실제로 ALTER 를 막는지 검증할 수 있다.
    const alter = s.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/);
    if (alter) {
      mockAlterCount += 1;
      const tableName = alter[1];
      const colName = alter[2];
      const cols = mockTables.get(tableName) ?? [];
      if (cols.includes(colName)) {
        throw new Error(`duplicate column name: ${colName}`);
      }
      mockTables.set(tableName, [...cols, colName]);
      return;
    }

    // CREATE TABLE IF NOT EXISTS tableName (...)
    const create = s.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    if (create) {
      const tableName = create[1];
      if (!mockTables.has(tableName)) {
        mockTables.set(tableName, parseColumns(s));
        mockRows.set(tableName, []);
      }
      return;
    }

    // DELETE FROM tableName
    const del = s.match(/DELETE FROM (\w+)/);
    if (del) {
      mockRows.set(del[1], []);
    }
  });

  const mockGetFirstAsync = jest.fn(async (sql: string) => {
    if (sql.trim() === 'PRAGMA user_version') {
      return { user_version: mockUserVersion };
    }
    return null;
  });

  const mockGetAllAsync = jest.fn(async (sql: string) => {
    const s = sql.trim();

    // PRAGMA table_info(tableName)
    const tableInfo = s.match(/PRAGMA table_info\((\w+)\)/);
    if (tableInfo) {
      const cols = mockTables.get(tableInfo[1]) ?? [];
      return cols.map(name => ({ name }));
    }

    // getOpenSessionRecords: WHERE session_id IS NULL
    if (s.includes('drink_records') && s.includes('session_id IS NULL')) {
      const rows = mockRows.get('drink_records') ?? [];
      return rows.filter((r: any) => r.session_id == null);
    }

    return [];
  });

  const mockRunAsync = jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 }));

  const mockWithExclusiveTransactionAsync = jest.fn(
    async (cb: (txn: any) => Promise<void>) => {
      await cb({ runAsync: mockRunAsync });
    },
  );

  const mockDbInstance = {
    execAsync: mockExecAsync,
    getFirstAsync: mockGetFirstAsync,
    getAllAsync: mockGetAllAsync,
    runAsync: mockRunAsync,
    withExclusiveTransactionAsync: mockWithExclusiveTransactionAsync,
    closeAsync: jest.fn(async () => {}),
  };

  return {
    openDatabaseAsync: jest.fn(async () => mockDbInstance),
  };
});

// ── 실제 DB 모듈 import (mock 설정 이후) ─────────────────────────────────

import * as SQLite from 'expo-sqlite';
import { closeDb, getAllSessions, getOpenSessionRecords } from '../db';

// ── v2 기기에 있던 컬럼 목록 (session_id 없음) ─────────────────────────────
const V2_COLUMNS = ['id', 'consumed_at', 'abv_percent', 'volume_ml', 'preset_label', 'finished_at'];
// v3 가 됐을 때 기대하는 컬럼 목록
const V3_COLUMNS = [...V2_COLUMNS, 'session_id'];

describe('DB v2 → v3 마이그레이션 흐름', () => {
  beforeEach(() => {
    mockUserVersion = 0;
    mockTables = new Map();
    mockRows = new Map();
    mockAlterCount = 0;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // _db 캐시 초기화 — 다음 테스트가 openDatabaseAsync 를 새로 호출하도록
    await closeDb();
  });

  // ── 신규 설치 ──────────────────────────────────────────────────────────────

  test('신규 설치 → 두 테이블 생성, session_id 포함, user_version = 3', async () => {
    // 사전 상태: 테이블 없음, version 0
    await getOpenSessionRecords();

    expect(mockTables.has('drink_records')).toBe(true);
    expect(mockTables.has('drink_sessions')).toBe(true);
    expect(mockTables.get('drink_records')).toContain('session_id');
    expect(mockUserVersion).toBe(3);
    // 신규 설치 시 CREATE TABLE 에 session_id 가 포함되므로 ALTER 는 불필요
    expect(mockAlterCount).toBe(0);
  });

  // ── v2 → v3 업그레이드 ────────────────────────────────────────────────────

  test('v2 DB (session_id 없음, version 0) → ALTER 실행, drink_sessions 생성, version = 3', async () => {
    // 사전 상태: v2 배포 기기 — session_id 컬럼 없음, version 0
    mockTables.set('drink_records', [...V2_COLUMNS]);
    mockRows.set('drink_records', []);

    await getOpenSessionRecords();

    // session_id 가 추가됐는지 확인
    expect(mockTables.get('drink_records')).toEqual(V3_COLUMNS);
    expect(mockAlterCount).toBe(1);
    expect(mockTables.has('drink_sessions')).toBe(true);
    expect(mockUserVersion).toBe(3);
  });

  test('v2 DB 의 기존 기록이 session_id IS NULL (열린 세션) 으로 유지됨', async () => {
    // 사전 상태: 기존 기록이 있는 v2 기기
    const t0 = new Date(2026, 0, 1, 18, 0, 0).getTime();
    mockTables.set('drink_records', [...V2_COLUMNS]);
    mockRows.set('drink_records', [
      {
        id: 1,
        consumed_at: t0,
        abv_percent: 4.5,
        volume_ml: 500,
        preset_label: null,
        finished_at: t0,
        session_id: null,  // v2 기록 — session_id 는 기본값 NULL
      },
    ]);

    const records = await getOpenSessionRecords();

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(1);
    expect(records[0].sessionId).toBeUndefined(); // null → undefined (rowToRecord 변환)
    expect(mockUserVersion).toBe(3);
  });

  // ── 이미 v3 — 마이그레이션 건너뜀 ────────────────────────────────────────

  test('user_version = 3 → 마이그레이션 블록 완전 생략, ALTER 없음', async () => {
    // 사전 상태: 이미 마이그레이션된 기기
    mockUserVersion = 3;
    mockTables.set('drink_records', [...V3_COLUMNS]);
    mockTables.set('drink_sessions', ['id', 'started_at', 'last_finished_at', 'sober_at', 'total_alcohol_g', 'peak_bac', 'drink_count']);

    await getOpenSessionRecords();

    expect(mockAlterCount).toBe(0);
    expect(mockUserVersion).toBe(3); // 변화 없음
  });

  // ── 중단된 마이그레이션 (인터럽트 시나리오) ──────────────────────────────

  test('중단 시나리오: session_id 컬럼 있음 + version 0 → ALTER 생략, 재실행 안전', async () => {
    // ALTER 이후 PRAGMA 전에 앱이 죽은 상황
    // session_id 컬럼은 이미 있지만 version 은 아직 0
    mockTables.set('drink_records', [...V3_COLUMNS]); // session_id 이미 있음
    // drink_sessions 없음 (CREATE TABLE 전에 죽음)
    mockUserVersion = 0;

    // 재시작 후 마이그레이션 재실행 — 오류 없이 완료되어야 함
    await expect(getOpenSessionRecords()).resolves.not.toThrow();

    // ALTER 는 건너뜀 ("duplicate column name" 방지)
    expect(mockAlterCount).toBe(0);
    // drink_sessions 는 생성됨 (CREATE TABLE IF NOT EXISTS — 멱등)
    expect(mockTables.has('drink_sessions')).toBe(true);
    // version 은 3 으로 설정됨
    expect(mockUserVersion).toBe(3);
  });

  // ── 마시는중 기록 포함 세션 유지 ──────────────────────────────────────────

  test('마시는중 + 완료 혼합 기록 → 마이그레이션 후 모두 열린 세션으로 유지', async () => {
    const t0 = new Date(2026, 0, 1, 18, 0, 0).getTime();
    const t1 = t0 + 3_600_000;

    mockTables.set('drink_records', [...V2_COLUMNS]);
    mockRows.set('drink_records', [
      {
        id: 1, consumed_at: t0, abv_percent: 4.5, volume_ml: 500,
        preset_label: null, finished_at: t0, session_id: null,   // 완료
      },
      {
        id: 2, consumed_at: t1, abv_percent: 4.5, volume_ml: 500,
        preset_label: null, finished_at: null, session_id: null,  // 마시는중
      },
    ]);

    const records = await getOpenSessionRecords();

    // 두 기록 모두 session_id IS NULL → 열린 세션으로 반환
    expect(records).toHaveLength(2);
    expect(mockUserVersion).toBe(3);
  });

  // ── 동시 진입 (C1 회귀 방지) ───────────────────────────────────────────────

  /**
   * openDb() 에 in-flight 가드가 없으면 마이그레이션이 두 번 실행된다.
   *
   * 앱 시작 시 _layout.tsx 가 loadSession() 과 loadSessions() 를 한 Promise.all
   * 로 묶으면서 DB 진입점이 둘로 늘었다. 가드가 없으면 둘 다 _db === null 을
   * 보고 각자 마이그레이션에 진입하고, await 마다 양보하므로 둘 다
   * PRAGMA table_info 에서 "session_id 없음" 을 읽은 뒤 둘 다 ALTER 를 실행한다.
   * 두 번째가 "duplicate column name" 으로 던진다.
   *
   * 신규 설치는 CREATE TABLE 에 session_id 가 이미 있어 무사하고,
   * v2 DB + 실데이터를 가진 기존 사용자만 정확히 맞는다.
   *
   * 주의: alterCount 단독 assertion 으로는 이 회귀를 잡지 못할 수 있다.
   * 위 mock 은 중복 검사보다 mockAlterCount 증가가 먼저라 회귀 시 2 가 되지만,
   * 순서가 반대인 구현에서는 회귀 상황에서도 1 로 남는다.
   * 그래서 "두 프라미스 모두 fulfilled" 를 주 단언으로 둔다.
   */
  test('동시에 두 경로가 진입해도 마이그레이션은 한 번만 실행된다', async () => {
    // 사전 상태: v2 배포 기기 — session_id 없음, version 0
    mockTables.set('drink_records', [...V2_COLUMNS]);
    mockRows.set('drink_records', []);

    // _layout.tsx 의 Promise.all 과 같은 모양 — 두 진입점이 동시에 openDb() 를 부른다
    const results = await Promise.allSettled([
      getOpenSessionRecords(),
      getAllSessions(),
    ]);

    // 주 단언: 어느 쪽도 "duplicate column name" 으로 죽지 않는다
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled']);

    // 마이그레이션은 정확히 한 번만
    expect(mockAlterCount).toBe(1);
    expect(mockTables.get('drink_records')).toEqual(V3_COLUMNS);
    expect(mockUserVersion).toBe(3);

    // DB 는 한 번만 열린다 — 가드가 프라미스를 공유하고 있다는 증거
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});
