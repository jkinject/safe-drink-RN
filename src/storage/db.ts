/**
 * expo-sqlite 기반 음주 기록 저장소 (v3 스키마 — session_id + drink_sessions 포함)
 *
 * 세션 규약: drink_records.session_id IS NULL = 현재 열린 세션.
 * 세션이 닫히면 요약 1행이 drink_sessions 에 들어가고 해당 기록들에 id 가 찍힌다.
 */
import * as SQLite from 'expo-sqlite';
import { DrinkRecord, DrinkSession } from '../core/types';

const DB_NAME = 'safedrink.db';
const SCHEMA_VERSION = 4;

interface DrinkRecordRow {
  id: number;
  consumed_at: number;
  abv_percent: number;
  volume_ml: number;
  preset_label: string | null;
  finished_at: number | null;
  session_id: number | null;
  icon: string | null;
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
  const columnsBefore = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(drink_records)',
  );
  const isFreshInstall = columnsBefore.length === 0;

  // 신규 설치: 최신 스키마로 한 번에 생성
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS drink_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumed_at INTEGER NOT NULL,
      abv_percent REAL NOT NULL,
      volume_ml REAL NOT NULL,
      preset_label TEXT,
      finished_at INTEGER,
      session_id INTEGER,
      icon TEXT
    )
  `);

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

  // ── 컬럼 보강 ────────────────────────────────────────────────────────────
  //
  // user_version 게이트 뒤에 두지 않는다. 버전만 올라가고 컬럼이 빠진 DB 가
  // 한 번 생기면(개발 중 중간 코드가 실행되는 등) 게이트에 걸려 영영 복구되지
  // 않고, 이후 모든 INSERT 가 "no such column" 으로 죽는다. 실제로 iOS
  // 시뮬레이터에서 그 상태가 나왔다.
  //
  // 검사 자체가 멱등하고 PRAGMA 한 번이라 매 실행 비용은 무시할 수 있다.
  // CREATE 직후의 실제 컬럼을 다시 읽으므로 신규 설치에서도 중복 ALTER 가 없다.
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(drink_records)',
  );
  const has = (name: string) => columns.some(c => c.name === name);

  // 로그는 실제로 컬럼을 추가할 때만 — 신규 설치에서 "Migrating" 이 찍히면
  // 사전-OTA 기기 체크리스트에서 마이그레이션 실행 여부를 오판하게 된다.
  if (!has('session_id')) {
    console.warn('[DB] drink_records.session_id 추가');
    await db.execAsync('ALTER TABLE drink_records ADD COLUMN session_id INTEGER');
  }
  if (!has('icon')) {
    console.warn('[DB] drink_records.icon 추가');
    await db.execAsync('ALTER TABLE drink_records ADD COLUMN icon TEXT');
  }

  const versionResult = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = versionResult?.user_version ?? 0;
  if (currentVersion < SCHEMA_VERSION) {
    if (!isFreshInstall) {
      console.warn(`[DB] Migrated v${currentVersion} → v${SCHEMA_VERSION}`);
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
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
    icon: row.icon ?? undefined,
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
    `INSERT INTO drink_records (consumed_at, abv_percent, volume_ml, preset_label, finished_at, icon)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.consumedAt,
      record.abvPercent,
      record.volumeMl,
      record.presetLabel ?? null,
      record.finishedAt ?? null,
      record.icon ?? null,
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
     SET consumed_at = ?, abv_percent = ?, volume_ml = ?, preset_label = ?, finished_at = ?, icon = ?
     WHERE id = ?`,
    [
      record.consumedAt,
      record.abvPercent,
      record.volumeMl,
      record.presetLabel ?? null,
      record.finishedAt ?? null,
      record.icon ?? null,
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

/**
 * 백업용 전체 덤프 — 열린 세션·닫힌 세션 가리지 않고 두 테이블을 통째로 읽는다.
 * id·sessionId 를 그대로 싣는 이유: 복원 후 기록↔세션 연결이 id 로만 이어지기 때문.
 * 정렬은 id 순 — 스냅샷이 매번 같은 순서여야 비교·디버깅이 쉽다.
 */
export async function exportAll(): Promise<{
  records: DrinkRecord[];
  sessions: DrinkSession[];
}> {
  const db = await openDb();
  let recordRows: DrinkRecordRow[] = [];
  let sessionRows: DrinkSessionRow[] = [];
  // 두 SELECT 를 한 읽기 트랜잭션으로 — 사이에 세션 닫기(closeSession)가 끼면 기록은 열린
  // 상태인데 세션은 이미 있는 식으로 서로 어긋난 스냅샷이 나온다
  await db.withTransactionAsync(async () => {
    recordRows = await db.getAllAsync<DrinkRecordRow>(
      'SELECT * FROM drink_records ORDER BY id ASC',
    );
    sessionRows = await db.getAllAsync<DrinkSessionRow>(
      'SELECT * FROM drink_sessions ORDER BY id ASC',
    );
  });
  return {
    records: recordRows.map(rowToRecord),
    sessions: sessionRows.map(rowToSession),
  };
}

/**
 * 백업 복원 — 두 테이블을 비우고 스냅샷 내용으로 통째로 교체한다.
 *
 * 한 exclusive 트랜잭션 안에서 DELETE → INSERT 를 모두 끝낸다. 중간에 하나라도
 * 던지면 롤백되어 원본이 그대로 남는다(반쯤 지워진 DB 는 복원 실패보다 나쁘다).
 *
 * id·session_id 를 명시해서 넣는다 — 새 id 를 받으면 기록이 가리키는 세션이
 * 엉뚱한 세션이 되거나 유령 기록이 된다. finishedAt/sessionId 는 메모리에선
 * undefined, JSON 을 거치면 null 이라 둘 다 `?? null` 로 저장한다
 * (null = 마시는중 / 열린 세션).
 */
export async function importAll(data: {
  records: DrinkRecord[];
  sessions: DrinkSession[];
}): Promise<void> {
  const db = await openDb();
  await db.withExclusiveTransactionAsync(async txn => {
    await txn.runAsync('DELETE FROM drink_records');
    await txn.runAsync('DELETE FROM drink_sessions');

    for (const s of data.sessions) {
      await txn.runAsync(
        `INSERT INTO drink_sessions
           (id, started_at, last_finished_at, sober_at, total_alcohol_g, peak_bac, drink_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.startedAt,
          s.lastFinishedAt,
          s.soberAt,
          s.totalAlcoholG,
          s.peakBac,
          s.drinkCount,
        ],
      );
    }

    for (const r of data.records) {
      await txn.runAsync(
        `INSERT INTO drink_records
           (id, consumed_at, abv_percent, volume_ml, preset_label, finished_at, session_id, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id ?? null,
          r.consumedAt,
          r.abvPercent,
          r.volumeMl,
          r.presetLabel ?? null,
          r.finishedAt ?? null,
          r.sessionId ?? null,
          r.icon ?? null,
        ],
      );
    }

    // AUTOINCREMENT 카운터를 복원한 최대 id 이상으로 맞춘다.
    // SQLite 는 명시 id 삽입 시 sqlite_sequence 를 올려 주지만, 그 동작에 기대지 않고
    // 여기서 한 번 더 보장한다 — 카운터가 복원 id 보다 작으면 다음 addRecord 가
    // UNIQUE 충돌로 죽는다. MAX(seq, …) 라 기존 카운터를 되돌리지는 않는다.
    // (한 번도 삽입된 적 없는 테이블은 행이 없어 UPDATE 가 무시되는데, 그땐 복원 행도
    // 없으므로 1 부터 시작해도 충돌이 없다.)
    for (const table of ['drink_records', 'drink_sessions']) {
      await txn.runAsync(
        `UPDATE sqlite_sequence
            SET seq = MAX(seq, (SELECT IFNULL(MAX(id), 0) FROM ${table}))
          WHERE name = ?`,
        [table],
      );
    }
  });
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
