/**
 * 계정 연동 백업 상태 스토어 — Google(Android·iOS)·Sign in with Apple(iOS).
 *
 * - 연동 계정·마지막 백업 시각·대기 변경(dirty)은 backupStorage 에 영속된다.
 * - 네트워크 동작(업로드·복원·삭제)은 scheduler.runExclusive 로 직렬화된다.
 * - 액션은 예외를 던지지 않고 결과값 + lastError 로 알린다 — 화면은 try/catch 없이 쓴다.
 *
 * 기존 백업이 있는 계정을 연결하면(signInAndCheck → 'found') 사용자가 복원/교체/취소를
 * 고를 때까지 awaitingDecision=true 로 자동 업로드를 막는다. 이 동안에는 계정도 저장하지
 * 않는다 — 고르기 전에 앱이 죽어도 다음 실행에서 빈 로컬이 서버 백업을 덮어쓰지 않도록.
 * 로그인 직후 받은 서버 세션도 같은 이유로 계정을 저장할 때 함께 저장한다(pendingSession).
 */
import { create } from 'zustand';
import * as auth from '../services/auth';
import type { AuthProvider } from '../services/auth';
import * as backupStorage from '../storage/backupStorage';
import type { BackupAccount, StoredSession } from '../storage/backupStorage';
import { deleteBackup, fetchBackup, type RemoteBackup } from '../services/backup/api';
import {
  applySnapshot,
  summarize,
  validateSnapshot,
  type BackupSnapshot,
} from '../services/backup/snapshot';
import * as scheduler from '../services/backup/scheduler';

export type BackupStatus =
  | 'idle'
  | 'signingIn'
  | 'checking'
  | 'backingUp'
  | 'restoring'
  | 'deleting';

export type BackupErrorCode = 'network' | 'reauth' | 'server' | 'invalid';

/** 마지막으로 조회한 서버 백업 — 확인창에 이메일·일시·개수를 보여주는 용도 */
export type RemoteBackupInfo = {
  updatedAt: number;
  email: string | null;
  /** 해석할 수 없는 백업(새 스키마·손상)이면 null */
  recordCount: number | null;
  customPresetCount: number | null;
  /** 검증을 통과한 스냅샷. 새 스키마·손상이면 null (복원 불가) */
  snapshot: BackupSnapshot | null;
};

interface BackupState {
  account: BackupAccount | null;
  status: BackupStatus;
  lastBackupAt: number | null;
  dirty: boolean;
  /** 자동·수동 백업(업로드) 실패와 재인증 필요. 설정 상태 줄의 "백업하지 못했어요" 가 이것만 본다 */
  lastError: BackupErrorCode | null;
  /**
   * 조회(checkRemote)·복원(restoreFromRemote) 실패 코드 — 화면이 실패 알림 문구를 고르는 용도.
   * 이 실패들은 백업이 안 된 게 아니므로 lastError 에 두지 않는다(상태 줄이 "백업하지 못했어요"
   * 로 바뀌면 안 된다). 단 reauth 는 자동 백업도 막으므로 lastError 에도 남긴다.
   */
  lastActionError: BackupErrorCode | null;
  remote: RemoteBackupInfo | null;
  /** remote 가 이 앱보다 새 스키마로 만들어졌다 → "앱을 업데이트한 뒤 다시 복원" */
  remoteIncompatible: boolean;
  /** 기존 백업을 찾아 복원/교체 선택을 기다리는 중 (자동 업로드 보류, 계정 미저장) */
  awaitingDecision: boolean;

  /** 저장된 연동 상태를 읽는다. 앱 시작 시 한 번 */
  load: () => Promise<void>;
  /**
   * 로그인(provider, 기본 'google') → 서버 세션 발급 → 서버 백업 조회. 조회만 하고 업로드는 하지 않는다.
   * - 'found': remote 가 채워지고 awaitingDecision=true. 화면이 restoreFromRemote /
   *   backupNow(이 기기 데이터로 교체) / unlinkLocal(취소) 중 하나를 부른다.
   * - 'none': 연동 완료(계정 저장). 설정 화면이면 이어서 backupNow() 로 첫 백업.
   * - 'cancelled': 계정 선택(로그인) 창을 닫음. 아무것도 바뀌지 않는다.
   * - 'error': 로그인·세션 발급·조회 실패(lastError). 연동하지 않은 상태로 돌아간다.
   */
  signInAndCheck: (provider?: AuthProvider) => Promise<'found' | 'none' | 'cancelled' | 'error'>;
  /**
   * 재인증(lastError='reauth') 해소용 — 연동된 계정으로 다시 로그인해 새 세션을 받는다. 백업
   * 조회·복원 흐름은 타지 않는다. provider 를 생략하면 연동 계정의 제공자.
   * 다른 계정을 고르면 'mismatch'(연동은 그대로, 새 로그인은 되돌림).
   */
  reconnect: (provider?: AuthProvider) => Promise<'reconnected' | 'cancelled' | 'mismatch' | 'error'>;
  /** 이미 연동된 상태에서 서버 백업을 다시 조회한다(설정 → 백업에서 복원 확인창용) */
  checkRemote: () => Promise<'found' | 'none' | 'error'>;
  /** 지금 올린다. 복원/교체 선택 중이면 "이 기기 데이터로 교체" 로 확정된다. 성공하면 true */
  backupNow: () => Promise<boolean>;
  /** remote.snapshot 으로 로컬 전체를 교체한다 */
  restoreFromRemote: () => Promise<'restored' | 'incompatible' | 'error'>;
  /** 서버 백업 삭제(204 확인) 뒤에만 로컬 연동을 해제한다. 성공하면 true */
  deleteAndUnlink: () => Promise<boolean>;
  /** 서버는 그대로 두고 이 기기의 연동만 해제한다(복원/교체 선택 취소용) */
  unlinkLocal: () => Promise<void>;
  /** 백업 대상 데이터가 바뀌었다(scheduler.markDirty 위임) */
  markDirty: () => void;
}

const UNLINKED = {
  account: null,
  lastBackupAt: null,
  dirty: false,
  remote: null,
  remoteIncompatible: false,
  awaitingDecision: false,
} as const;

/** 서버 응답을 확인창용 정보로 바꾼다 */
function toRemoteInfo(remote: RemoteBackup): {
  info: RemoteBackupInfo;
  incompatible: boolean;
} {
  const result = validateSnapshot(remote.payload);
  if (result.ok) {
    return {
      info: {
        updatedAt: remote.updatedAt,
        email: remote.email,
        ...summarize(result.snapshot),
        snapshot: result.snapshot,
      },
      incompatible: false,
    };
  }
  return {
    info: {
      updatedAt: remote.updatedAt,
      email: remote.email,
      recordCount: null,
      customPresetCount: null,
      snapshot: null,
    },
    incompatible: result.reason === 'newer-schema',
  };
}

export const backupStore = create<BackupState>((set, get) => {
  /**
   * 선택 대기 중인 로그인의 서버 세션. 계정과 함께 commitAccount 에서 저장한다.
   * (Google 세션 발급이 서버 사정으로 실패해 ID 토큰으로 조회했으면 null — 이후 조용히 재발급)
   */
  let pendingSession: StoredSession | null = null;

  /** 계정(과 로그인 때 받은 세션)을 저장하고 선택 대기를 끝낸다 (복원·교체로 확정됐을 때) */
  async function commitAccount(): Promise<void> {
    const { account, awaitingDecision } = get();
    if (!account || !awaitingDecision) return;
    set({ awaitingDecision: false });
    const session = pendingSession;
    pendingSession = null;
    await backupStorage.saveAccount(account);
    // 새 세션이 없으면(ID 토큰 대체) 이전 계정 세션을 지운다 — getAccessToken 은 sub 가 다른
    // 세션을 무시하지만 굳이 남겨 둘 이유가 없다
    if (session) await backupStorage.saveSession(session);
    else await backupStorage.clearSession();
  }

  /** 조회·복원 실패 기록 — reauth 만 상태 줄(lastError)에도 올린다 */
  function setActionError(code: BackupErrorCode): void {
    set(code === 'reauth' ? { lastActionError: code, lastError: code } : { lastActionError: code });
  }

  /** 서버 조회 → remote 반영 */
  async function check(token: string): Promise<'found' | 'none'> {
    const remote = await fetchBackup(token);
    if (!remote) {
      set({ remote: null, remoteIncompatible: false });
      return 'none';
    }
    const { info, incompatible } = toRemoteInfo(remote);
    set({ remote: info, remoteIncompatible: incompatible });
    return 'found';
  }

  return {
    ...UNLINKED,
    status: 'idle',
    lastError: null,
    lastActionError: null,

    load: async () => {
      try {
        const saved = await backupStorage.loadBackupState();
        set({ ...saved });
      } catch {
        // 읽기 실패는 미연동으로 시작 — 다시 로그인하면 된다
        return;
      }
      // 설정 앱에서 이 앱의 Apple ID 사용을 중단했으면 세션을 버리고 다시 로그인하게 한다.
      // 로컬 조회라 빠르지만 시작을 막지 않도록 기다리지 않는다
      const account = get().account;
      if (account?.provider === 'apple') {
        void auth.apple.isCredentialRevoked(account.sub).then(async revoked => {
          if (!revoked || get().account?.sub !== account.sub) return;
          await backupStorage.clearSession().catch(() => {});
          set({ lastError: 'reauth' });
        });
      }
    },

    signInAndCheck: async (provider = 'google') => {
      if (get().status !== 'idle') return 'error';
      set({ status: 'signingIn', lastError: null, lastActionError: null });
      let signed: auth.ProviderSignIn | null;
      try {
        signed = await auth.signIn(provider);
      } catch (e) {
        set({ status: 'idle', lastError: scheduler.toBackupErrorCode(e) });
        return 'error';
      }
      if (!signed) {
        set({ status: 'idle' });
        return 'cancelled';
      }
      const prev = { account: get().account, lastBackupAt: get().lastBackupAt, dirty: get().dirty };
      const linked: BackupAccount = { sub: signed.sub, email: signed.email, provider };
      // 다른 계정으로 바꿔 연결하면 이전 계정의 시각·대기 변경은 의미가 없다
      const sameAccount =
        prev.account?.sub === linked.sub && prev.account?.provider === linked.provider;
      pendingSession = null;
      // 조회가 끝날 때까지는 "선택 대기" 로 둔다 — 그 사이 변경 신호가 업로드를 걸지 않도록
      set({
        account: linked,
        lastBackupAt: sameAccount ? prev.lastBackupAt : null,
        dirty: sameAccount ? prev.dirty : false,
        awaitingDecision: true,
        status: 'checking',
      });
      try {
        // 제공자 ID 토큰(Apple 은 10분짜리)을 서버 세션으로 바꾼다. 저장은 계정을 확정할 때
        const { accessToken, session } = await auth.openSession(signed);
        const result = await scheduler.runExclusive(() => check(accessToken));
        if (result === 'none') {
          if (!sameAccount) await backupStorage.clearBackupState();
          await backupStorage.saveAccount(linked);
          if (session) await backupStorage.saveSession(session);
          else await backupStorage.clearSession();
          set({ awaitingDecision: false });
        } else {
          pendingSession = session;
        }
        return result;
      } catch (e) {
        pendingSession = null;
        const lastError = scheduler.toBackupErrorCode(e);
        if (prev.account) {
          // 이미 연동돼 있던 상태면 그대로 되돌린다(저장소의 계정·세션은 건드리지 않았다)
          set({ ...prev, awaitingDecision: false, lastError });
        } else {
          // 서버에 백업이 있는지 모르는 채로 연동하면 덮어쓸 수 있다 — 연동하지 않는다
          await auth.signOut(provider);
          set({ ...UNLINKED, lastError });
        }
        return 'error';
      } finally {
        set({ status: 'idle' });
      }
    },

    reconnect: async provider => {
      const { account, status } = get();
      if (!account || status !== 'idle') return 'error';
      const p = provider ?? account.provider;
      set({ status: 'signingIn', lastActionError: null });
      try {
        const signed = await auth.signIn(p);
        if (!signed) return 'cancelled';
        if (p !== account.provider || signed.sub !== account.sub) {
          // 다른 계정의 백업을 덮어쓰지 않는다 — 원래 계정으로 다시 로그인해야 한다
          await auth.signOut(p);
          return 'mismatch';
        }
        // 새 세션을 받아 저장한다(Apple 은 이게 유일한 갱신 경로)
        const { session } = await auth.openSession(signed);
        if (session) await backupStorage.saveSession(session);
        else await backupStorage.clearSession();
        set({ lastError: null });
      } catch (e) {
        set({ lastError: scheduler.toBackupErrorCode(e) });
        return 'error';
      } finally {
        set({ status: 'idle' });
      }
      // 재인증 때문에 못 올린 변경을 바로 올린다
      if (get().dirty && !get().awaitingDecision) void scheduler.upload();
      return 'reconnected';
    },

    checkRemote: async () => {
      if (!get().account || get().status !== 'idle') return 'error';
      set({ status: 'checking', lastActionError: null });
      try {
        const account = get().account!;
        return await scheduler.runExclusive(() => auth.withAccessToken(account, check));
      } catch (e) {
        setActionError(scheduler.toBackupErrorCode(e));
        return 'error';
      } finally {
        set({ status: 'idle' });
      }
    },

    backupNow: async () => {
      if (!get().account) return false;
      try {
        await commitAccount();
      } catch {
        // 계정 저장 실패 — 이번 실행 동안은 메모리 계정으로 계속 간다
      }
      return scheduler.upload();
    },

    restoreFromRemote: async () => {
      const { account, remote, remoteIncompatible } = get();
      if (!account || !remote) return 'error';
      if (remoteIncompatible) return 'incompatible';
      set({ lastActionError: null });
      if (!remote.snapshot) {
        set({ lastActionError: 'invalid' });
        return 'error';
      }
      const snapshot = remote.snapshot;
      // 복원이 로컬을 통째로 바꾸므로 대기 중이던 변경은 의미가 없다
      scheduler.cancelPending();
      try {
        return await scheduler.runExclusive(async () => {
          set({ status: 'restoring' });
          // 네트워크는 필요 없다 — 조회 때 받아 둔 스냅샷을 적용한다
          await applySnapshot(snapshot);
          set({ dirty: false, lastBackupAt: remote.updatedAt, lastError: null });
          // applySnapshot 이 끝난 뒤라 로컬 데이터는 이미 바뀌었다 — 계정 저장 실패로
          // 'error' 를 돌려주면 "기기 데이터는 그대로예요" 라는 틀린 안내가 뜬다. 삼킨다.
          try {
            await commitAccount();
          } catch (e) {
            console.warn('[Backup] 복원 후 계정 저장 실패:', e);
          }
          await Promise.all([
            backupStorage.saveLastBackupAt(remote.updatedAt),
            backupStorage.saveDirty(false),
          ]).catch(() => {});
          return 'restored' as const;
        });
      } catch (e) {
        // applySnapshot 은 실패 시 원본을 그대로 둔다(AsyncStorage 되돌림 + DB 트랜잭션 롤백)
        setActionError(scheduler.toBackupErrorCode(e));
        return 'error';
      } finally {
        set({ status: 'idle' });
      }
    },

    deleteAndUnlink: async () => {
      const account = get().account;
      if (!account) return false;
      scheduler.cancelPending();
      try {
        return await scheduler.runExclusive(async () => {
          set({ status: 'deleting' });
          await auth.withAccessToken(account, deleteBackup);
          // 서버 삭제가 확인된 뒤에만 로컬 연동을 푼다(세션도 함께 지워진다)
          pendingSession = null;
          await backupStorage.clearBackupState().catch(() => {});
          await auth.signOut(account.provider);
          set({ ...UNLINKED, lastError: null, lastActionError: null });
          return true;
        });
      } catch (e) {
        setActionError(scheduler.toBackupErrorCode(e));
        return false;
      } finally {
        set({ status: 'idle' });
      }
    },

    unlinkLocal: async () => {
      scheduler.cancelPending();
      await scheduler.runExclusive(async () => {
        const provider = get().account?.provider ?? 'google';
        pendingSession = null;
        await backupStorage.clearBackupState().catch(() => {});
        await auth.signOut(provider);
        set({ ...UNLINKED, lastError: null, lastActionError: null });
      });
    },

    markDirty: () => scheduler.markDirty(),
  };
});
