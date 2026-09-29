/**
 * backupStore — 로그인(Google·Apple)·세션 발급·조회, 복원, 삭제·해제, 재인증 전파.
 *
 * 제공자 모듈(auth/google·auth/apple)·api·snapshot 은 목(에러 클래스는 실물), auth/index·session 은
 * 실물(세션 저장·만료·재발급 규칙을 그대로 확인한다). AsyncStorage 는 루트 인메모리 목.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../services/auth/google', () => ({
  configure: jest.fn(),
  signIn: jest.fn(),
  getIdToken: jest.fn(async () => 'fresh-token'),
  signOut: jest.fn(async () => {}),
}));

jest.mock('../../services/auth/apple', () => ({
  isAvailable: jest.fn(async () => true),
  signIn: jest.fn(async () => null),
  isCredentialRevoked: jest.fn(async () => false),
}));

jest.mock('../../services/backup/api', () => ({
  ...jest.requireActual('../../services/backup/api'),
  fetchBackup: jest.fn(async () => null),
  uploadBackup: jest.fn(async () => ({ updatedAt: 5000 })),
  deleteBackup: jest.fn(async () => {}),
  createSession: jest.fn(),
}));

// 실물 snapshot 을 requireActual 하면 스토어를 거쳐 expo-notifications 까지 로드된다 — 네이티브 경고 차단
jest.mock('../../services/notifications', () => ({}));

jest.mock('../../services/backup/snapshot', () => {
  const actual = jest.requireActual('../../services/backup/snapshot');
  return {
    SNAPSHOT_SCHEMA_VERSION: 1,
    validateSnapshot: actual.validateSnapshot,
    summarize: actual.summarize,
    buildSnapshot: jest.fn(async () => ({ schemaVersion: 1 })),
    applySnapshot: jest.fn(async () => {}),
    isApplyingSnapshot: jest.fn(() => false),
  };
});

import { backupStore } from '../backupStore';
import * as googleAuth from '../../services/auth/google';
import * as appleAuth from '../../services/auth/apple';
import { AuthError, SESSION_REFRESH_BEFORE_MS } from '../../services/auth';
import * as api from '../../services/backup/api';
import { BackupApiError } from '../../services/backup/api';
import * as snapshot from '../../services/backup/snapshot';
import * as scheduler from '../../services/backup/scheduler';

const signIn = googleAuth.signIn as jest.Mock;
const getIdToken = googleAuth.getIdToken as jest.Mock;
const signOut = googleAuth.signOut as jest.Mock;
const appleSignIn = appleAuth.signIn as jest.Mock;
const appleRevoked = appleAuth.isCredentialRevoked as jest.Mock;
const fetchBackup = api.fetchBackup as jest.Mock;
const uploadBackup = api.uploadBackup as jest.Mock;
const deleteBackup = api.deleteBackup as jest.Mock;
const createSession = api.createSession as jest.Mock;
const applySnapshot = snapshot.applySnapshot as jest.Mock;

const ACCOUNT = { sub: 'sub-1', email: 'a@example.com', provider: 'google' as const };
const SIGNED_IN = { ...ACCOUNT, idToken: 'signin-token' };
const APPLE_ACCOUNT = { sub: 'apple-sub', email: 'x@privaterelay.appleid.com', provider: 'apple' as const };
const APPLE_SIGNED_IN = { ...APPLE_ACCOUNT, idToken: 'apple-identity-token' };

const DAY = 24 * 60 * 60 * 1000;
/** 서버 세션 기본 수명(테스트용) — 30일 */
const SESSION_TTL = 30 * DAY;

/** 세션 발급 목 — 발급 순번을 토큰에 넣어 어떤 세션이 쓰였는지 구분한다 */
let sessionSeq = 0;
function defaultCreateSession(provider: 'google' | 'apple', idToken: string) {
  sessionSeq += 1;
  // 실제 Worker 처럼 사용자 키를 돌려준다 — Apple 은 `apple:` 접두사. 이걸 원본 sub 로 흉내 내면
  // 클라이언트의 sub 비교 버그(실기기에서 Apple 로그인이 늘 실패하던 원인)를 못 잡는다
  const sub = provider === 'apple' ? `apple:${APPLE_ACCOUNT.sub}` : ACCOUNT.sub;
  return Promise.resolve({
    sessionToken: `session-${provider}-${sessionSeq}`,
    expiresAt: Date.now() + SESSION_TTL,
    sub,
    email: null,
    provider,
    // 어떤 ID 토큰으로 발급했는지 확인용(실제 응답에는 없다)
    _from: idToken,
  });
}

async function storedSession() {
  const v = await AsyncStorage.getItem('backup_session');
  return v ? (JSON.parse(v) as { token: string; expiresAt: number; sub: string }) : null;
}

const validPayload = {
  schemaVersion: 1,
  createdAt: 1,
  appVersion: '1.3.0',
  profile: { heightCm: 175, weightKg: 70, sex: 'male' },
  presets: [
    { label: '소주', abvPercent: 16.5, volumeMl: 50 },
    { label: '내 술', abvPercent: 7, volumeMl: 300, isCustom: true },
  ],
  presetsSeeded: true,
  locale: 'ko',
  timerNotificationEnabled: true,
  drinkRecords: [
    { id: 1, consumedAt: 10, abvPercent: 4.5, volumeMl: 500, finishedAt: 20 },
    { id: 2, consumedAt: 30, abvPercent: 4.5, volumeMl: 500, finishedAt: null },
  ],
  drinkSessions: [],
};

function reset() {
  backupStore.setState({
    account: null,
    status: 'idle',
    lastBackupAt: null,
    dirty: false,
    lastError: null,
    lastActionError: null,
    remote: null,
    remoteIncompatible: false,
    awaitingDecision: false,
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  scheduler.stop();
  await AsyncStorage.clear();
  reset();
  signIn.mockResolvedValue(SIGNED_IN);
  getIdToken.mockResolvedValue('fresh-token');
  appleSignIn.mockResolvedValue(null);
  appleRevoked.mockResolvedValue(false);
  sessionSeq = 0;
  createSession.mockImplementation(defaultCreateSession);
  fetchBackup.mockResolvedValue(null);
  uploadBackup.mockResolvedValue({ updatedAt: 5000 });
  deleteBackup.mockResolvedValue(undefined);
  // 스케줄러가 올리기 전에 검증하므로 업로드 경로는 유효한 스냅샷을 만들어야 한다
  (snapshot.buildSnapshot as jest.Mock).mockResolvedValue(validPayload);
});

afterEach(() => scheduler.stop());

async function linkedState() {
  backupStore.setState({ account: ACCOUNT, lastBackupAt: 1234 });
  await AsyncStorage.multiSet([
    ['backup_account', JSON.stringify(ACCOUNT)],
    ['backup_last_at', '1234'],
  ]);
}

describe('load', () => {
  it('저장된 연동 상태를 읽는다', async () => {
    await AsyncStorage.multiSet([
      ['backup_account', JSON.stringify(ACCOUNT)],
      ['backup_last_at', '777'],
      ['backup_dirty', 'true'],
    ]);
    await backupStore.getState().load();
    expect(backupStore.getState()).toMatchObject({
      account: ACCOUNT,
      lastBackupAt: 777,
      dirty: true,
    });
  });

  it('계정이 없으면 남은 키가 있어도 미연동이다', async () => {
    await AsyncStorage.multiSet([
      ['backup_last_at', '777'],
      ['backup_dirty', 'true'],
    ]);
    await backupStore.getState().load();
    expect(backupStore.getState()).toMatchObject({
      account: null,
      lastBackupAt: null,
      dirty: false,
    });
  });
});

describe('signInAndCheck', () => {
  it('found — remote 에 일시·개수를 채우고 선택 대기로 두며 계정은 아직 저장하지 않는다', async () => {
    fetchBackup.mockResolvedValue({
      schemaVersion: 1,
      updatedAt: 9000,
      email: 'a@example.com',
      payload: validPayload,
    });
    await expect(backupStore.getState().signInAndCheck()).resolves.toBe('found');

    // 로그인 직후 받은 ID 토큰을 세션으로 바꿔 그 세션으로 조회한다
    expect(createSession).toHaveBeenCalledWith('google', 'signin-token');
    expect(fetchBackup).toHaveBeenCalledWith('session-google-1');
    const s = backupStore.getState();
    expect(s.account).toEqual(ACCOUNT);
    expect(s.awaitingDecision).toBe(true);
    expect(s.remoteIncompatible).toBe(false);
    expect(s.status).toBe('idle');
    expect(s.remote).toMatchObject({
      updatedAt: 9000,
      email: 'a@example.com',
      recordCount: 2,
      customPresetCount: 1,
    });
    expect(s.remote?.snapshot).not.toBeNull();
    expect(uploadBackup).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('backup_account')).toBeNull();
    // 세션도 계정과 함께 확정 때 저장한다
    expect(await storedSession()).toBeNull();
  });

  it('found — 새 스키마 백업이면 remoteIncompatible 이고 복원은 incompatible', async () => {
    fetchBackup.mockResolvedValue({
      schemaVersion: 2,
      updatedAt: 9000,
      email: null,
      payload: { ...validPayload, schemaVersion: 2 },
    });
    await expect(backupStore.getState().signInAndCheck()).resolves.toBe('found');
    expect(backupStore.getState().remoteIncompatible).toBe(true);
    expect(backupStore.getState().remote?.snapshot).toBeNull();
    await expect(backupStore.getState().restoreFromRemote()).resolves.toBe('incompatible');
    expect(applySnapshot).not.toHaveBeenCalled();
  });

  it('none — 계정을 저장하고 연동을 마친다(업로드는 하지 않는다)', async () => {
    await expect(backupStore.getState().signInAndCheck()).resolves.toBe('none');
    expect(backupStore.getState()).toMatchObject({
      account: ACCOUNT,
      awaitingDecision: false,
      remote: null,
      status: 'idle',
    });
    expect(JSON.parse((await AsyncStorage.getItem('backup_account'))!)).toEqual(ACCOUNT);
    expect(await storedSession()).toMatchObject({ token: 'session-google-1', sub: ACCOUNT.sub });
    expect(uploadBackup).not.toHaveBeenCalled();
  });

  it('cancelled — 아무것도 바뀌지 않는다', async () => {
    signIn.mockResolvedValue(null);
    await expect(backupStore.getState().signInAndCheck()).resolves.toBe('cancelled');
    expect(backupStore.getState()).toMatchObject({ account: null, status: 'idle', lastError: null });
    expect(fetchBackup).not.toHaveBeenCalled();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('조회 실패 — 연동하지 않고 lastError 를 남긴다', async () => {
    fetchBackup.mockRejectedValue(new BackupApiError('network'));
    await expect(backupStore.getState().signInAndCheck()).resolves.toBe('error');
    expect(backupStore.getState()).toMatchObject({
      account: null,
      lastError: 'network',
      status: 'idle',
    });
    expect(signOut).toHaveBeenCalled();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('로그인 실패(네트워크) — lastError=network', async () => {
    signIn.mockRejectedValue(new AuthError('network'));
    await expect(backupStore.getState().signInAndCheck()).resolves.toBe('error');
    expect(backupStore.getState().lastError).toBe('network');
  });
});

describe('선택 확정', () => {
  beforeEach(() => {
    fetchBackup.mockResolvedValue({
      schemaVersion: 1,
      updatedAt: 9000,
      email: 'a@example.com',
      payload: validPayload,
    });
  });

  it('restoreFromRemote — 스냅샷을 적용하고 lastBackupAt=서버 시각, dirty=false, 계정 저장', async () => {
    await backupStore.getState().signInAndCheck();
    backupStore.setState({ dirty: true });
    await expect(backupStore.getState().restoreFromRemote()).resolves.toBe('restored');
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(backupStore.getState()).toMatchObject({
      lastBackupAt: 9000,
      dirty: false,
      awaitingDecision: false,
      status: 'idle',
    });
    expect(JSON.parse((await AsyncStorage.getItem('backup_account'))!)).toEqual(ACCOUNT);
    expect(await AsyncStorage.getItem('backup_last_at')).toBe('9000');
  });

  // 스토어는 선택 대기를 그대로 둔다 — 정리(unlinkLocal)는 실패 알림을 띄운 화면이 맡는다
  // (설정 backup-section·온보딩 restore-card 모두 'restored' 가 아니면 unlinkLocal)
  it('restoreFromRemote 실패 — 선택 대기와 lastBackupAt 을 그대로 두고, 실패는 lastActionError 에만 남긴다', async () => {
    await backupStore.getState().signInAndCheck();
    applySnapshot.mockRejectedValueOnce(new Error('disk I/O error'));
    await expect(backupStore.getState().restoreFromRemote()).resolves.toBe('error');
    expect(backupStore.getState()).toMatchObject({
      lastBackupAt: null,
      awaitingDecision: true,
      status: 'idle',
      lastError: null,
      lastActionError: 'server',
    });
    expect(await AsyncStorage.getItem('backup_account')).toBeNull();
  });

  it('backupNow — 이 기기 데이터로 교체: 계정 저장 후 업로드', async () => {
    await backupStore.getState().signInAndCheck();
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(uploadBackup).toHaveBeenCalledTimes(1);
    // 로그인 때 받은 세션이 계정과 함께 저장돼 업로드에 쓰인다(재발급 없음)
    expect(uploadBackup.mock.calls[0][0]).toBe('session-google-1');
    expect(getIdToken).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({
      lastBackupAt: 5000,
      awaitingDecision: false,
    });
    expect(await AsyncStorage.getItem('backup_account')).not.toBeNull();
    expect(await storedSession()).toMatchObject({ token: 'session-google-1' });
  });

  it('unlinkLocal — 서버 호출 없이 로컬 연동만 해제한다', async () => {
    await backupStore.getState().signInAndCheck();
    jest.clearAllMocks();
    await backupStore.getState().unlinkLocal();
    expect(deleteBackup).not.toHaveBeenCalled();
    expect(uploadBackup).not.toHaveBeenCalled();
    expect(fetchBackup).not.toHaveBeenCalled();
    expect(getIdToken).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(backupStore.getState()).toMatchObject({
      account: null,
      remote: null,
      awaitingDecision: false,
    });
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});

describe('deleteAndUnlink', () => {
  it('서버 삭제 성공 후에만 로컬 연동을 해제한다', async () => {
    await linkedState();
    await expect(backupStore.getState().deleteAndUnlink()).resolves.toBe(true);
    // 저장된 세션이 없으면(1.3.0 초기 연동) 조용히 받은 ID 토큰으로 세션을 발급받아 쓴다
    expect(createSession).toHaveBeenCalledWith('google', 'fresh-token');
    expect(deleteBackup).toHaveBeenCalledWith('session-google-1');
    expect(signOut).toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({
      account: null,
      lastBackupAt: null,
      status: 'idle',
    });
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('서버 실패 시 계정·마지막 백업 시각을 유지한다', async () => {
    await linkedState();
    deleteBackup.mockRejectedValue(new BackupApiError('server', 'x', 503));
    await expect(backupStore.getState().deleteAndUnlink()).resolves.toBe(false);
    expect(backupStore.getState()).toMatchObject({
      account: ACCOUNT,
      lastBackupAt: 1234,
      lastError: null,
      lastActionError: 'server',
      status: 'idle',
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('backup_account')).not.toBeNull();
  });
});

describe('재인증 전파', () => {
  it('backupNow — getIdToken 이 reauth 면 lastError=reauth, dirty 유지', async () => {
    await linkedState();
    backupStore.setState({ dirty: true });
    getIdToken.mockRejectedValue(new AuthError('reauth'));
    await expect(backupStore.getState().backupNow()).resolves.toBe(false);
    expect(uploadBackup).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({ lastError: 'reauth', dirty: true, lastBackupAt: 1234 });
  });

  it('deleteAndUnlink — reauth 면 연동 유지', async () => {
    await linkedState();
    getIdToken.mockRejectedValue(new AuthError('reauth'));
    await expect(backupStore.getState().deleteAndUnlink()).resolves.toBe(false);
    expect(deleteBackup).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({ account: ACCOUNT, lastError: 'reauth' });
  });

  it('checkRemote — 401 은 reauth', async () => {
    await linkedState();
    fetchBackup.mockRejectedValue(new BackupApiError('reauth', 'x', 401));
    await expect(backupStore.getState().checkRemote()).resolves.toBe('error');
    expect(backupStore.getState().lastError).toBe('reauth');
    expect(backupStore.getState().lastActionError).toBe('reauth');
  });

  it('checkRemote — 네트워크 실패는 상태 줄(lastError)을 바꾸지 않는다', async () => {
    await linkedState();
    fetchBackup.mockRejectedValue(new BackupApiError('network'));
    await expect(backupStore.getState().checkRemote()).resolves.toBe('error');
    expect(backupStore.getState()).toMatchObject({ lastError: null, lastActionError: 'network' });
  });

  it('reconnect — 같은 계정으로 다시 로그인하면 lastError 를 지우고 대기 변경을 올린다', async () => {
    await linkedState();
    backupStore.setState({ lastError: 'reauth', dirty: true });
    await expect(backupStore.getState().reconnect()).resolves.toBe('reconnected');
    expect(backupStore.getState().lastError).toBeNull();
    await new Promise(r => setTimeout(r, 0));
    expect(uploadBackup).toHaveBeenCalledTimes(1);
  });

  it('reconnect — 다른 계정을 고르면 mismatch, 연동은 그대로', async () => {
    await linkedState();
    backupStore.setState({ lastError: 'reauth' });
    signIn.mockResolvedValue({ sub: 'other', email: 'b@example.com', idToken: 't' });
    await expect(backupStore.getState().reconnect()).resolves.toBe('mismatch');
    expect(backupStore.getState()).toMatchObject({ account: ACCOUNT, lastError: 'reauth' });
    expect(signOut).toHaveBeenCalled();
  });
});

describe('저장값 마이그레이션', () => {
  it('provider 가 없는 1.3.0 초기 계정은 google 로 읽는다', async () => {
    await AsyncStorage.setItem('backup_account', JSON.stringify({ sub: 'old', email: 'o@example.com' }));
    await backupStore.getState().load();
    expect(backupStore.getState().account).toEqual({
      sub: 'old',
      email: 'o@example.com',
      provider: 'google',
    });
  });

  it('세션 없이 연동된 google 계정은 첫 업로드 때 조용히 세션을 발급받아 저장한다', async () => {
    await linkedState();
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(uploadBackup.mock.calls[0][0]).toBe('session-google-1');
    expect(await storedSession()).toMatchObject({ token: 'session-google-1', sub: ACCOUNT.sub });
  });
});

describe('Apple 로그인', () => {
  beforeEach(() => {
    appleSignIn.mockResolvedValue(APPLE_SIGNED_IN);
  });

  it('none — identity token 을 세션으로 바꿔 조회하고 계정(provider=apple)·세션을 저장한다', async () => {
    await expect(backupStore.getState().signInAndCheck('apple')).resolves.toBe('none');
    expect(signIn).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith('apple', 'apple-identity-token');
    expect(fetchBackup).toHaveBeenCalledWith('session-apple-1');
    expect(backupStore.getState()).toMatchObject({ account: APPLE_ACCOUNT, awaitingDecision: false });
    expect(JSON.parse((await AsyncStorage.getItem('backup_account'))!)).toEqual(APPLE_ACCOUNT);
    expect(await storedSession()).toMatchObject({ token: 'session-apple-1', sub: `apple:${APPLE_ACCOUNT.sub}` });
  });

  it('found — 선택 대기 동안 계정·세션을 저장하지 않고, 교체(backupNow) 때 함께 저장해 그 세션으로 올린다', async () => {
    fetchBackup.mockResolvedValue({
      schemaVersion: 1,
      updatedAt: 9000,
      email: APPLE_ACCOUNT.email,
      payload: validPayload,
    });
    await expect(backupStore.getState().signInAndCheck('apple')).resolves.toBe('found');
    expect(backupStore.getState()).toMatchObject({ account: APPLE_ACCOUNT, awaitingDecision: true });
    expect(await AsyncStorage.getItem('backup_account')).toBeNull();
    expect(await storedSession()).toBeNull();

    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(uploadBackup.mock.calls[0][0]).toBe('session-apple-1');
    expect(await storedSession()).toMatchObject({ token: 'session-apple-1' });
    expect(JSON.parse((await AsyncStorage.getItem('backup_account'))!)).toEqual(APPLE_ACCOUNT);
  });

  it('cancelled — 아무것도 바뀌지 않는다', async () => {
    appleSignIn.mockResolvedValue(null);
    await expect(backupStore.getState().signInAndCheck('apple')).resolves.toBe('cancelled');
    expect(createSession).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({ account: null, lastError: null, status: 'idle' });
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('세션 발급 401 — 연동하지 않고 reauth', async () => {
    createSession.mockRejectedValue(new api.BackupApiError('reauth', 'x', 401));
    await expect(backupStore.getState().signInAndCheck('apple')).resolves.toBe('error');
    expect(fetchBackup).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({ account: null, lastError: 'reauth' });
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('세션 발급 503 — Apple 은 대안 토큰이 없어 실패(server)', async () => {
    createSession.mockRejectedValue(new api.BackupApiError('server', 'x', 503));
    await expect(backupStore.getState().signInAndCheck('apple')).resolves.toBe('error');
    expect(fetchBackup).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({ account: null, lastError: 'server' });
  });

  it('서버 세션의 sub 가 로그인한 계정과 다르면 연동하지 않는다', async () => {
    createSession.mockImplementation(async (provider: 'apple', t: string) => ({
      ...(await defaultCreateSession(provider, t)),
      sub: 'someone-else',
    }));
    await expect(backupStore.getState().signInAndCheck('apple')).resolves.toBe('error');
    expect(fetchBackup).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({ account: null, lastError: 'reauth' });
  });

  it('reconnect — 같은 Apple 계정으로 다시 로그인하면 새 세션을 저장하고 lastError 를 지운다', async () => {
    await linkedApple({ expiresAt: Date.now() - 1000 });
    backupStore.setState({ lastError: 'reauth' });
    await expect(backupStore.getState().reconnect()).resolves.toBe('reconnected');
    expect(appleSignIn).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
    expect(backupStore.getState().lastError).toBeNull();
    expect(await storedSession()).toMatchObject({ token: 'session-apple-1' });
  });

  it('load — 설정에서 Apple ID 사용을 중단했으면(REVOKED) 세션을 버리고 reauth', async () => {
    await linkedApple({ expiresAt: Date.now() + SESSION_TTL });
    backupStore.setState({ account: null });
    appleRevoked.mockResolvedValue(true);
    await backupStore.getState().load();
    await new Promise(r => setTimeout(r, 0));
    expect(appleRevoked).toHaveBeenCalledWith(APPLE_ACCOUNT.sub);
    expect(backupStore.getState()).toMatchObject({ account: APPLE_ACCOUNT, lastError: 'reauth' });
    expect(await storedSession()).toBeNull();
  });

  it('load — google 계정은 Apple 자격 상태를 조회하지 않는다', async () => {
    await linkedState();
    await backupStore.getState().load();
    await new Promise(r => setTimeout(r, 0));
    expect(appleRevoked).not.toHaveBeenCalled();
  });
});

/** Apple 계정 연동 + 저장된 세션 */
async function linkedApple(session: { expiresAt: number; token?: string }) {
  backupStore.setState({ account: APPLE_ACCOUNT, lastBackupAt: 1234 });
  await AsyncStorage.multiSet([
    ['backup_account', JSON.stringify(APPLE_ACCOUNT)],
    ['backup_last_at', '1234'],
    [
      'backup_session',
      JSON.stringify({
        token: session.token ?? 'stored-apple-session',
        expiresAt: session.expiresAt,
        // 저장된 세션의 sub 는 서버 사용자 키(apple: 접두사)
        sub: `apple:${APPLE_ACCOUNT.sub}`,
      }),
    ],
  ]);
}

async function saveGoogleSession(expiresAt: number, token = 'stored-google-session') {
  await AsyncStorage.setItem(
    'backup_session',
    JSON.stringify({ token, expiresAt, sub: ACCOUNT.sub }),
  );
}

describe('세션 만료·재발급', () => {
  it('google — 만료까지 7일 이상 남은 세션은 그대로 쓴다(ID 토큰 요청 없음)', async () => {
    await linkedState();
    await saveGoogleSession(Date.now() + SESSION_REFRESH_BEFORE_MS + DAY);
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(getIdToken).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    expect(uploadBackup.mock.calls[0][0]).toBe('stored-google-session');
  });

  it('google — 만료 임박(7일 미만)이면 조용히 새 세션을 받아 저장하고 그걸로 올린다', async () => {
    await linkedState();
    await saveGoogleSession(Date.now() + 2 * DAY);
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith('google', 'fresh-token');
    expect(uploadBackup.mock.calls[0][0]).toBe('session-google-1');
    expect(await storedSession()).toMatchObject({ token: 'session-google-1' });
    expect(backupStore.getState().lastError).toBeNull();
  });

  it('google — 만료된 세션도 조용히 재발급한다', async () => {
    await linkedState();
    await saveGoogleSession(Date.now() - DAY);
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(uploadBackup.mock.calls[0][0]).toBe('session-google-1');
  });

  it('google — 임박한 세션의 재발급이 오프라인으로 실패하면 아직 유효한 세션으로 올린다', async () => {
    await linkedState();
    await saveGoogleSession(Date.now() + 2 * DAY);
    getIdToken.mockRejectedValue(new AuthError('network'));
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(uploadBackup.mock.calls[0][0]).toBe('stored-google-session');
  });

  it('google — 세션 발급이 서버 사정(503)이면 Google ID 토큰으로 직접 올린다', async () => {
    await linkedState();
    createSession.mockRejectedValue(new api.BackupApiError('server', 'x', 503));
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(uploadBackup.mock.calls[0][0]).toBe('fresh-token');
    expect(await storedSession()).toBeNull();
  });

  it('google — 다른 계정의 세션이 남아 있으면 쓰지 않는다', async () => {
    await linkedState();
    await AsyncStorage.setItem(
      'backup_session',
      JSON.stringify({ token: 'other', expiresAt: Date.now() + SESSION_TTL, sub: 'other-sub' }),
    );
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(uploadBackup.mock.calls[0][0]).toBe('session-google-1');
  });

  it('google — 서버가 세션을 401 로 거부하면 새 세션으로 한 번 더 시도한다', async () => {
    await linkedState();
    await saveGoogleSession(Date.now() + SESSION_TTL);
    uploadBackup.mockRejectedValueOnce(new api.BackupApiError('reauth', 'x', 401));
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(uploadBackup.mock.calls.map(c => c[0])).toEqual([
      'stored-google-session',
      'session-google-1',
    ]);
    expect(backupStore.getState().lastError).toBeNull();
  });

  it('apple — 만료된 세션이면 업로드하지 않고 reauth (ID 토큰 조용한 갱신 없음)', async () => {
    await linkedApple({ expiresAt: Date.now() - 1000 });
    backupStore.setState({ dirty: true });
    await expect(backupStore.getState().backupNow()).resolves.toBe(false);
    expect(uploadBackup).not.toHaveBeenCalled();
    expect(getIdToken).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({ lastError: 'reauth', dirty: true });
  });

  it('apple — 세션이 없으면 reauth', async () => {
    await linkedApple({ expiresAt: Date.now() + SESSION_TTL });
    await AsyncStorage.removeItem('backup_session');
    await expect(backupStore.getState().backupNow()).resolves.toBe(false);
    expect(backupStore.getState().lastError).toBe('reauth');
  });

  it('apple — 만료가 임박했어도 아직 유효하면 만료 전까지 그대로 쓴다', async () => {
    await linkedApple({ expiresAt: Date.now() + 2 * DAY });
    await expect(backupStore.getState().backupNow()).resolves.toBe(true);
    expect(uploadBackup.mock.calls[0][0]).toBe('stored-apple-session');
  });

  it('apple — 서버가 세션을 401 로 거부하면 세션을 지우고 reauth (재시도 없음)', async () => {
    await linkedApple({ expiresAt: Date.now() + SESSION_TTL });
    uploadBackup.mockRejectedValueOnce(new api.BackupApiError('reauth', 'x', 401));
    await expect(backupStore.getState().backupNow()).resolves.toBe(false);
    expect(uploadBackup).toHaveBeenCalledTimes(1);
    expect(backupStore.getState().lastError).toBe('reauth');
    expect(await storedSession()).toBeNull();
  });

  it('deleteAndUnlink — 세션까지 지운다', async () => {
    await linkedApple({ expiresAt: Date.now() + SESSION_TTL });
    await expect(backupStore.getState().deleteAndUnlink()).resolves.toBe(true);
    expect(deleteBackup).toHaveBeenCalledWith('stored-apple-session');
    // Apple 은 앱 쪽 로그아웃이 없다 — Google signOut 을 부르지 않는다
    expect(signOut).not.toHaveBeenCalled();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('다른 계정 로그인이 조회 실패로 되돌려지면 이전 계정의 세션을 그대로 둔다', async () => {
    await linkedState();
    await saveGoogleSession(Date.now() + SESSION_TTL);
    appleSignIn.mockResolvedValue(APPLE_SIGNED_IN);
    fetchBackup.mockRejectedValue(new api.BackupApiError('network'));
    await expect(backupStore.getState().signInAndCheck('apple')).resolves.toBe('error');
    expect(backupStore.getState().account).toEqual(ACCOUNT);
    expect(await storedSession()).toMatchObject({ token: 'stored-google-session', sub: ACCOUNT.sub });
  });
});
