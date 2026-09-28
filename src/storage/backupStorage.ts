import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNT_KEY = 'backup_account';
const LAST_AT_KEY = 'backup_last_at';
const DIRTY_KEY = 'backup_dirty';

/** 연동된 Google 계정. sub 가 서버 백업 행의 키, email 은 표시용 */
export type BackupAccount = { sub: string; email: string | null };

export type StoredBackupState = {
  account: BackupAccount | null;
  /** 마지막으로 서버가 200 을 준 업로드(또는 복원한 백업)의 서버 시각 */
  lastBackupAt: number | null;
  /** 아직 올리지 못한 변경이 있는지 */
  dirty: boolean;
};

/**
 * 백업 연동 상태.
 *
 * 연동하지 않은 사용자에게는 아무 키도 만들지 않는다 — 쓰기 함수는 계정이 있을 때만
 * 부르는 것이 전제다(backupStore·scheduler 가 확인). 읽을 때도 계정이 없으면 나머지
 * 키를 무시해, 해제 도중 남은 찌꺼기가 다음 연동에 섞이지 않게 한다.
 */
export async function loadBackupState(): Promise<StoredBackupState> {
  const entries = await AsyncStorage.multiGet([ACCOUNT_KEY, LAST_AT_KEY, DIRTY_KEY]);
  const raw = Object.fromEntries(entries) as Record<string, string | null>;
  const account = parseAccount(raw[ACCOUNT_KEY]);
  if (!account) return { account: null, lastBackupAt: null, dirty: false };
  const last = raw[LAST_AT_KEY] == null ? NaN : Number(raw[LAST_AT_KEY]);
  return {
    account,
    lastBackupAt: Number.isFinite(last) ? last : null,
    dirty: raw[DIRTY_KEY] === 'true',
  };
}

function parseAccount(v: string | null | undefined): BackupAccount | null {
  if (!v) return null;
  try {
    const o = JSON.parse(v) as { sub?: unknown; email?: unknown };
    if (typeof o.sub !== 'string' || o.sub === '') return null;
    return { sub: o.sub, email: typeof o.email === 'string' ? o.email : null };
  } catch {
    return null;
  }
}

export async function saveAccount(account: BackupAccount): Promise<void> {
  await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify({ sub: account.sub, email: account.email }));
}

export async function saveLastBackupAt(at: number): Promise<void> {
  await AsyncStorage.setItem(LAST_AT_KEY, String(at));
}

/** false 는 키를 지운다 — 없음 = 깨끗함 */
export async function saveDirty(dirty: boolean): Promise<void> {
  if (dirty) await AsyncStorage.setItem(DIRTY_KEY, 'true');
  else await AsyncStorage.removeItem(DIRTY_KEY);
}

/** 연동 해제 — 세 키를 모두 지운다 */
export async function clearBackupState(): Promise<void> {
  await AsyncStorage.multiRemove([ACCOUNT_KEY, LAST_AT_KEY, DIRTY_KEY]);
}
