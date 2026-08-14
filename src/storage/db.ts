/**
 * expo-sqlite 기반 음주 기록 저장소 (v2 스키마 — finished_at 포함)
 */
import * as SQLite from 'expo-sqlite';
import { DrinkRecord } from '../core/types';

const DB_NAME = 'safedrink.db';

interface DrinkRecordRow {
  id: number;
  consumed_at: number;
  abv_percent: number;
  volume_ml: number;
  preset_label: string | null;
  finished_at: number | null;
}

let _db: SQLite.SQLiteDatabase | null = null;

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS drink_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumed_at INTEGER NOT NULL,
      abv_percent REAL NOT NULL,
      volume_ml REAL NOT NULL,
      preset_label TEXT,
      finished_at INTEGER
    )
  `);
  _db = db;
  return db;
}

function rowToRecord(row: DrinkRecordRow): DrinkRecord {
  return {
    id: row.id,
    consumedAt: row.consumed_at,
    abvPercent: row.abv_percent,
    volumeMl: row.volume_ml,
    presetLabel: row.preset_label ?? undefined,
    finishedAt: row.finished_at ?? undefined,
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

/** 모든 음주 기록 조회 (consumedAt 오름차순) */
export async function getAllRecords(): Promise<DrinkRecord[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<DrinkRecordRow>(
    'SELECT * FROM drink_records ORDER BY consumed_at ASC',
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

/** 모든 음주 기록 삭제 */
export async function deleteAllRecords(): Promise<void> {
  const db = await openDb();
  await db.runAsync('DELETE FROM drink_records');
}

/** DB 연결 닫기 (테스트/cleanup 용) */
export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}
