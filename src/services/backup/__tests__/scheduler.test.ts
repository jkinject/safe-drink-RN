/**
 * 자동 백업 스케줄러 — 디바운스·백그라운드 flush·재시도·직렬화.
 *
 * 목(mock) 전략:
 *   - auth/google: getIdToken/signIn/signOut 만 대체(auth/index·session 은 실물 — 세션 발급 경로 포함)
 *   - api: BackupApiError 는 실물, 네트워크 함수(세션 발급 포함)만 대체
 *   - snapshot: build/apply 를 대체 (실제 스토어·DB 를 끌어오지 않도록)
 *   - AsyncStorage: 루트 __mocks__ 인메모리 구현 (backupStorage 는 실물)
 *   - 타이머: jest fake timers, AppState: 주입한 가짜 이미터
 * backupStore 는 실물 — 스케줄러가 읽고 쓰는 상태를 그대로 확인한다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockApplying = false;

jest.mock('../../auth/google', () => ({
  configure: jest.fn(),
  getIdToken: jest.fn(async () => 'id-token'),
  signIn: jest.fn(async () => null),
  signOut: jest.fn(async () => {}),
}));

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchBackup: jest.fn(async () => null),
  uploadBackup: jest.fn(async () => ({ updatedAt: 1000 })),
  deleteBackup: jest.fn(async () => {}),
  createSession: jest.fn(async () => ({
    sessionToken: 'session-token',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    sub: 'sub-1',
    email: null,
    provider: 'google',
  })),
}));

jest.mock('../snapshot', () => ({
  SNAPSHOT_SCHEMA_VERSION: 1,
  buildSnapshot: jest.fn(async () => ({ schemaVersion: 1, fake: true })),
  isApplyingSnapshot: jest.fn(() => mockApplying),
  validateSnapshot: jest.fn((s: unknown) => ({ ok: true, snapshot: s })),
  applySnapshot: jest.fn(async () => {}),
  summarize: jest.fn(() => ({ recordCount: 0, customPresetCount: 0 })),
}));

import * as scheduler from '../scheduler';
import { DEBOUNCE_MS } from '../scheduler';
import * as api from '../api';
import { BackupApiError } from '../api';
import * as snapshot from '../snapshot';
import { backupStore } from '../../../state/backupStore';
import * as backupStorage from '../../../storage/backupStorage';

const uploadMock = api.uploadBackup as jest.Mock;
const applyMock = snapshot.applySnapshot as jest.Mock;

// ── 가짜 AppState ─────────────────────────────────────────────────────────────

let appStateListener: ((s: string) => void) | null = null;
const fakeAppState = {
  addEventListener: jest.fn((_type: 'change', fn: (s: any) => void) => {
    appStateListener = fn;
    return {
      remove: () => {
        appStateListener = null;
      },
    };
  }),
};
const emitAppState = (s: string) => appStateListener?.(s);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const ACCOUNT = { sub: 'sub-1', email: 'a@example.com', provider: 'google' as const };

function resetStore(linked: boolean) {
  backupStore.setState({
    account: linked ? ACCOUNT : null,
    status: 'idle',
    lastBackupAt: null,
    dirty: false,
    lastError: null,
    remote: null,
    remoteIncompatible: false,
    awaitingDecision: false,
  });
}

beforeEach(async () => {
  jest.useFakeTimers();
  scheduler.stop();
  scheduler.setSchedulerDeps({ appState: fakeAppState });
  mockApplying = false;
  jest.clearAllMocks();
  uploadMock.mockImplementation(async () => ({ updatedAt: 1000 }));
  await AsyncStorage.clear();
  resetStore(true);
  await backupStorage.saveAccount(ACCOUNT);
  scheduler.start();
});

afterEach(() => {
  scheduler.stop();
  jest.useRealTimers();
});

describe('디바운스', () => {
  it('markDirty 후 30초가 지나야 1회 업로드한다', async () => {
    scheduler.markDirty();
    expect(backupStore.getState().dirty).toBe(true);

    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    expect(uploadMock).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(backupStore.getState()).toMatchObject({
      dirty: false,
      lastBackupAt: 1000,
      lastError: null,
      status: 'idle',
    });
    expect(await AsyncStorage.getItem('backup_last_at')).toBe('1000');
    expect(await AsyncStorage.getItem('backup_dirty')).toBeNull();
  });

  it('연속 markDirty 3회는 1회 업로드로 병합된다', async () => {
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(10_000);
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(10_000);
    scheduler.markDirty();

    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(uploadMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 3);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it('업로드 도중 들어온 변경은 dirty 로 남아 다시 올라간다', async () => {
    const d = deferred<{ updatedAt: number }>();
    uploadMock.mockImplementationOnce(() => d.promise);
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(uploadMock).toHaveBeenCalledTimes(1);

    scheduler.markDirty(); // 업로드 진행 중 변경
    d.resolve({ updatedAt: 1000 });
    await jest.advanceTimersByTimeAsync(0);
    expect(backupStore.getState().dirty).toBe(true);

    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(backupStore.getState().dirty).toBe(false);
  });
});

describe('AppState', () => {
  it('background 로 가면 대기 중인 변경을 즉시 올린다', async () => {
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(1_000);
    emitAppState('background');
    await jest.advanceTimersByTimeAsync(0);
    expect(uploadMock).toHaveBeenCalledTimes(1);

    // 타이머는 취소됐으므로 30초 뒤 다시 올리지 않는다
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it('inactive 도 flush 한다', async () => {
    scheduler.markDirty();
    emitAppState('inactive');
    await jest.advanceTimersByTimeAsync(0);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it('대기 중인 변경이 없으면 background 에서 아무것도 하지 않는다', async () => {
    emitAppState('background');
    await jest.advanceTimersByTimeAsync(0);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe('실패와 재시도', () => {
  it('실패하면 dirty 를 유지하고 lastError 를 기록하며 lastBackupAt 은 그대로다', async () => {
    backupStore.setState({ lastBackupAt: 500 });
    uploadMock.mockRejectedValueOnce(new BackupApiError('network'));
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(backupStore.getState()).toMatchObject({
      dirty: true,
      lastError: 'network',
      lastBackupAt: 500,
      status: 'idle',
    });
    expect(await AsyncStorage.getItem('backup_dirty')).toBe('true');
  });

  it('실패 후 다음 markDirty 에서 다시 시도한다', async () => {
    uploadMock.mockRejectedValueOnce(new BackupApiError('server'));
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(backupStore.getState().lastError).toBe('server');

    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(backupStore.getState()).toMatchObject({ dirty: false, lastError: null });
  });

  it('실패 후 포그라운드 복귀 시 다시 시도한다', async () => {
    uploadMock.mockRejectedValueOnce(new BackupApiError('network'));
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(backupStore.getState().dirty).toBe(true);

    emitAppState('active');
    await jest.advanceTimersByTimeAsync(0);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(backupStore.getState().dirty).toBe(false);
  });

  it('401 은 reauth 로 기록된다', async () => {
    uploadMock.mockRejectedValueOnce(new BackupApiError('reauth', 'x', 401));
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(backupStore.getState().lastError).toBe('reauth');
  });

  it('검증을 통과하지 못한 스냅샷은 올리지 않고 invalid 로 남기며 dirty 를 유지한다', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (snapshot.validateSnapshot as jest.Mock).mockReturnValueOnce({
      ok: false,
      reason: 'invalid',
      detail: 'profile.heightCm 범위 밖',
    });
    backupStore.setState({ lastBackupAt: 500 });
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(uploadMock).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({
      dirty: true,
      lastError: 'invalid',
      lastBackupAt: 500,
      status: 'idle',
    });
    expect(await AsyncStorage.getItem('backup_dirty')).toBe('true');
    warn.mockRestore();
  });

  it('지난 실행에서 남은 dirty 는 start() 후 디바운스 뒤 올린다', async () => {
    scheduler.stop();
    backupStore.setState({ dirty: true });
    scheduler.start();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });
});

describe('가드', () => {
  it('계정이 없으면 업로드도 네트워크도 없고 아무것도 저장하지 않는다', async () => {
    const fetchSpy = jest.fn();
    const g = globalThis as { fetch?: unknown };
    const prevFetch = g.fetch;
    g.fetch = fetchSpy;
    try {
      await AsyncStorage.clear();
      resetStore(false);
      scheduler.markDirty();
      emitAppState('background');
      emitAppState('active');
      await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);

      expect(uploadMock).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(backupStore.getState().dirty).toBe(false);
      expect(await AsyncStorage.getAllKeys()).toEqual([]);
    } finally {
      g.fetch = prevFetch;
    }
  });

  it('스냅샷 적용(복원) 중의 markDirty 는 무시한다', async () => {
    mockApplying = true;
    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(backupStore.getState().dirty).toBe(false);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('기존 백업 복원/교체 선택 중에는 dirty 만 기억하고 올리지 않는다', async () => {
    backupStore.setState({ awaitingDecision: true });
    scheduler.markDirty();
    emitAppState('background');
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(backupStore.getState().dirty).toBe(true);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe('직렬화', () => {
  it('업로드 진행 중 복원 요청은 업로드가 끝난 뒤 실행된다', async () => {
    const d = deferred<{ updatedAt: number }>();
    uploadMock.mockImplementationOnce(() => d.promise);
    backupStore.setState({
      remote: {
        updatedAt: 2000,
        email: ACCOUNT.email,
        recordCount: 0,
        customPresetCount: 0,
        snapshot: { schemaVersion: 1 } as any,
      },
    });

    scheduler.markDirty();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(backupStore.getState().status).toBe('backingUp');

    const restoring = backupStore.getState().restoreFromRemote();
    await jest.advanceTimersByTimeAsync(0);
    expect(applyMock).not.toHaveBeenCalled();

    d.resolve({ updatedAt: 1000 });
    await expect(restoring).resolves.toBe('restored');
    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(uploadMock.mock.invocationCallOrder[0]).toBeLessThan(
      applyMock.mock.invocationCallOrder[0],
    );
    // 복원한 백업의 서버 시각으로 맞춰진다
    expect(backupStore.getState()).toMatchObject({
      lastBackupAt: 2000,
      dirty: false,
      status: 'idle',
    });
  });

  it('삭제 진행 중에는 대기하던 업로드가 끼어들지 않고, 삭제 뒤에는 올리지 않는다', async () => {
    const d = deferred<void>();
    (api.deleteBackup as jest.Mock).mockImplementationOnce(() => d.promise);
    scheduler.markDirty();

    const deleting = backupStore.getState().deleteAndUnlink();
    await jest.advanceTimersByTimeAsync(0);
    expect(backupStore.getState().status).toBe('deleting');

    // 삭제 중 백그라운드 전환·수동 업로드 요청
    emitAppState('background');
    const manual = scheduler.upload();
    d.resolve();
    await expect(deleting).resolves.toBe(true);
    await expect(manual).resolves.toBe(false);
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(uploadMock).not.toHaveBeenCalled();
    expect(backupStore.getState().account).toBeNull();
  });
});
