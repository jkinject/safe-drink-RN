/**
 * expo-sqlite 기반 음주 기록 저장소 (v3 스키마 — session_id + drink_sessions 포함)
 *
 * 세션 규약: drink_records.session_id IS NULL = 현재 열린 세션.
 * 세션이 닫히면 요약 1행이 drink_sessions 에 들어가고 해당 기록들에 id 가 찍힌다.
 */
import * as SQLite from 'expo-sqlite';
import { DrinkRecord, DrinkSession } from '../core/types';

const DB_NAME = 'safedrink.db';
const SCHEMA_VERSION = 3;

interface DrinkRecordRow {
  id: number;
  consumed_at: number;
  abv_percent: number;
  volume_ml: number;
  preset_label: string | null;
  finished_at: number | null;
  session_id: number | null;
}

interface DrinkSessionRow {
  id: number;
  started_at: number;
  last_finished_at: number;
  sober_at: number;
  total_alcohol_g: number;
  peak_bac: number;
  drink_count: number;
}

let _db: SQLite.SQLiteDatabase | null = null;
/**
 * 진행 중인 open/마이그레이션 작업.
 *
 * `_db` 캐시만으로는 부족하다 — 앱 시작 시 _layout.tsx 가
 * loadSession()/loadSessions() 를 한 Promise.all 로 동시에 await 하므로,
 * 둘 다 `_db === null` 을 보고 마이그레이션 블록에 진입한다.
 * 그러면 양쪽이 ALTER 전에 PRAGMA table_info 를 읽어 둘 다 컬럼이 없다고 판단하고
 * ALTER 를 두 번 실행 → 두 번째가 "duplicate column name" 으로 터진다
 * (기존 데이터가 있는 v2 기기에서만 발생). 첫 호출의 프라미스를 공유해서 막는다.
 */
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  // CREATE 이전 컬럼 구성 — 테이블이 없으면 빈 배열(= 신규 설치)
  const existingColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(drink_records)',
  );
  const isFreshInstall = existingColumns.length === 0;

  // 신규 설치: 전체 스키마로 생성
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS drink_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumed_at INTEGER NOT NULL,
      abv_percent REAL NOT NULL,
      volume_ml REAL NOT NULL,
      preset_label TEXT,
      finished_at INTEGER,
      session_id INTEGER
    )
  `);

  // 버전 게이트 마이그레이션.
  // user_version 은 지금까지 쓰인 적이 없어 기존 기기는 전부 0 (= 배포된 v2 스키마).
  const versionResult = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = versionResult?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) return;

  // v2 → v3: session_id 컬럼 추가.
  // ALTER 후 PRAGMA 전에 앱이 죽어도 재실행이 안전하도록 컬럼 존재 여부를 먼저 확인한다
  // (없으면 "duplicate column name" 으로 매 실행마다 터진다).
  // 로그는 실제로 컬럼을 추가할 때만 — 신규 설치에서 "Migrating" 이 찍히면
  // 사전-OTA 기기 체크리스트에서 마이그레이션 실행 여부를 오판하게 된다.
  if (!isFreshInstall && !existingColumns.some(c => c.name === 'session_id')) {
    console.warn(
      `[DB] Migrating v${currentVersion} → v${SCHEMA_VERSION}: drink_records.session_id 추가`,
    );
    await db.execAsync(
      'ALTER TABLE drink_records ADD COLUMN session_id INTEGER',
    );
  }

  // 세션 요약 테이블 (IF NOT EXISTS 라 그 자체로 멱등)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS drink_sessions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at        INTEGER NOT NULL,
      last_finished_at  INTEGER NOT NULL,
      sober_at          INTEGER NOT NULL,
      total_alcohol_g   REAL    NOT NULL,
      peak_bac          REAL    NOT NULL,
      drink_count       INTEGER NOT NULL
    )
  `);

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      _db = db;
      return db;
    })().catch(e => {
      _dbPromise = null; // 실패했으면 다음 호출이 다시 시도할 수 있게 해제
      throw e;
    });
  }
  return _dbPromise;
}

function rowToRecord(row: DrinkRecordRow): DrinkRecord {
  return {
    id: row.id,
    consumedAt: row.consumed_at,
    abvPercent: row.abv_percent,
    volumeMl: row.volume_ml,
    presetLabel: row.preset_label ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    sessionId: row.session_id ?? undefined,
  };
}

function rowToSession(row: DrinkSessionRow): DrinkSession {
  return {
    id: row.id,
    startedAt: row.started_at,
    lastFinishedAt: row.last_finished_at,
    soberAt: row.sober_at,
    totalAlcoholG: row.total_alcohol_g,
    peakBac: row.peak_bac,
    drinkCount: row.drink_count,
  };
}

/** 음주 기록 삽입. 자동 생성된 id 반환. */
export async function insertRecord(
  record: Omit<DrinkRecord, 'id'>,
): Promise<number> {
  const db = await openDb();
  const result = await db.runAsync(
    `INSERT INTO drink_records (consumed_at, abv_percent, volume_ml, preset_label, finished_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      record.consumedAt,
      record.abvPercent,
      record.volumeMl,
      record.presetLabel ?? null,
      record.finishedAt ?? null,
    ],
  );
  return result.lastInsertRowId;
}

/** 열린 세션의 기록만 조회 (session_id IS NULL, consumedAt 오름차순) */
export async function getOpenSessionRecords(): Promise<DrinkRecord[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<DrinkRecordRow>(
    'SELECT * FROM drink_records WHERE session_id IS NULL ORDER BY consumed_at ASC',
  );
  return rows.map(rowToRecord);
}

/**
 * 종료된 세션 목록 (최신순 — 홈 화면의 sessions[0] 가 직전 술자리).
 * started_at 이 같으면 id 로 tie-break — 없으면 sessions[0] 이 실행마다 달라진다.
 */
export async function getAllSessions(): Promise<DrinkSession[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<DrinkSessionRow>(
    'SELECT * FROM drink_sessions ORDER BY started_at DESC, id DESC',
  );
  return rows.map(rowToSession);
}

/** 세션 1건에 속한 기록 조회 (consumedAt 오름차순) */
export async function getSessionRecords(
  sessionId: number,
): Promise<DrinkRecord[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<DrinkRecordRow>(
    'SELECT * FROM drink_records WHERE session_id = ? ORDER BY consumed_at ASC',
    [sessionId],
  );
  return rows.map(rowToRecord);
}

/** id 기준 음주 기록 수정 */
export async function updateRecord(record: DrinkRecord): Promise<void> {
  if (record.id == null) throw new Error('수정할 기록의 id 가 없습니다');
  const db = await openDb();
  await db.runAsync(
    `UPDATE drink_records
     SET consumed_at = ?, abv_percent = ?, volume_ml = ?, preset_label = ?, finished_at = ?
     WHERE id = ?`,
    [
      record.consumedAt,
      record.abvPercent,
      record.volumeMl,
      record.presetLabel ?? null,
      record.finishedAt ?? null,
      record.id,
    ],
  );
}

/** id 기준 음주 기록 삭제 */
export async function deleteRecord(id: number): Promise<void> {
  const db = await openDb();
  await db.runAsync('DELETE FROM drink_records WHERE id = ?', [id]);
}

/**
 * 세션 닫기: drink_sessions INSERT + 열린 기록들의 session_id UPDATE.
 *
 * ⚠️ UPDATE 를 빼면 닫힌 기록이 계속 session_id IS NULL 로 남아
 * 다음 load() 에서 되살아난다 — 둘은 반드시 한 트랜잭션이다.
 * withExclusiveTransactionAsync 사용 — 다른 async 쿼리에 의한 인터럽트 방지.
 * 쿼리는 txn 파라미터로 실행한다 (exclusive transaction API 계약).
 */
export async function closeSession(
  params: Omit<DrinkSession, 'id'>,
): Promise<number> {
  const db = await openDb();
  let sessionId!: number;
  await db.withExclusiveTransactionAsync(async txn => {
    const result = await txn.runAsync(
      `INSERT INTO drink_sessions
         (started_at, last_finished_at, sober_at, total_alcohol_g, peak_bac, drink_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        params.startedAt,
        params.lastFinishedAt,
        params.soberAt,
        params.totalAlcoholG,
        params.peakBac,
        params.drinkCount,
      ],
    );
    sessionId = result.lastInsertRowId;
    await txn.runAsync(
      'UPDATE drink_records SET session_id = ? WHERE session_id IS NULL',
      [sessionId],
    );
  });
  return sessionId;
}

/**
 * 세션 1건 삭제 (기록 먼저, 요약 나중) — exclusive transaction.
 * 중간에 끊기면 session_id 는 있는데 매칭 세션이 없는 유령 기록이 남는다.
 */
export async function deleteSession(sessionId: number): Promise<void> {
  const db = await openDb();
  await db.withExclusiveTransactionAsync(async txn => {
    await txn.runAsync('DELETE FROM drink_records WHERE session_id = ?', [
      sessionId,
    ]);
    await txn.runAsync('DELETE FROM drink_sessions WHERE id = ?', [sessionId]);
  });
}

/** 모든 기록·세션 삭제 (설정의 "기록 전체 삭제") */
export async function deleteAllData(): Promise<void> {
  const db = await openDb();
  await db.execAsync('DELETE FROM drink_records');
  await db.execAsync('DELETE FROM drink_sessions');
}

/** DB 연결 닫기 (테스트/cleanup 용) */
export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
  // 진행 중 프라미스 캐시도 함께 해제 — 남겨두면 닫힌 핸들을 계속 돌려준다
  _dbPromise = null;
}
