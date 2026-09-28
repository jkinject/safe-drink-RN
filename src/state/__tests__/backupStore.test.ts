/**
 * backupStore — 로그인·조회, 복원, 삭제·해제, 재인증 전파.
 *
 * googleAuth·api·snapshot 은 목(에러 클래스는 실물), AsyncStorage 는 루트 인메모리 목.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../services/googleAuth', () => ({
  ...jest.requireActual('../../services/googleAuth'),
  configure: jest.fn(),
  signIn: jest.fn(),
  getIdToken: jest.fn(async () => 'fresh-token'),
  signOut: jest.fn(async () => {}),
}));

jest.mock('../../services/backup/api', () => ({
  ...jest.requireActual('../../services/backup/api'),
  fetchBackup: jest.fn(async () => null),
  uploadBackup: jest.fn(async () => ({ updatedAt: 5000 })),
  deleteBackup: jest.fn(async () => {}),
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
import * as googleAuth from '../../services/googleAuth';
import { GoogleAuthError } from '../../services/googleAuth';
import * as api from '../../services/backup/api';
import { BackupApiError } from '../../services/backup/api';
import * as snapshot from '../../services/backup/snapshot';
import * as scheduler from '../../services/backup/scheduler';

const signIn = googleAuth.signIn as jest.Mock;
const getIdToken = googleAuth.getIdToken as jest.Mock;
const signOut = googleAuth.signOut as jest.Mock;
const fetchBackup = api.fetchBackup as jest.Mock;
const uploadBackup = api.uploadBackup as jest.Mock;
const deleteBackup = api.deleteBackup as jest.Mock;
const applySnapshot = snapshot.applySnapshot as jest.Mock;

const ACCOUNT = { sub: 'sub-1', email: 'a@example.com' };
const SIGNED_IN = { ...ACCOUNT, idToken: 'signin-token' };

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

    // 로그인 직후 받은 토큰으로 조회한다
    expect(fetchBackup).toHaveBeenCalledWith('signin-token');
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
    signIn.mockRejectedValue(new GoogleAuthError('network'));
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
    expect(backupStore.getState()).toMatchObject({
      lastBackupAt: 5000,
      awaitingDecision: false,
    });
    expect(await AsyncStorage.getItem('backup_account')).not.toBeNull();
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
    expect(deleteBackup).toHaveBeenCalledWith('fresh-token');
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
    getIdToken.mockRejectedValue(new GoogleAuthError('reauth'));
    await expect(backupStore.getState().backupNow()).resolves.toBe(false);
    expect(uploadBackup).not.toHaveBeenCalled();
    expect(backupStore.getState()).toMatchObject({ lastError: 'reauth', dirty: true, lastBackupAt: 1234 });
  });

  it('deleteAndUnlink — reauth 면 연동 유지', async () => {
    await linkedState();
    getIdToken.mockRejectedValue(new GoogleAuthError('reauth'));
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
