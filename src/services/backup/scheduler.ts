/**
 * 자동 백업 스케줄러 — 변경 신호를 모아 30초 뒤 한 번 올리고, 앱이 백그라운드로 가면 즉시 올린다.
 *
 * - markDirty(): 연동 계정이 없으면 아무것도 안 한다(네트워크 0). 복원(applySnapshot) 중
 *   스토어 재로드가 부르는 신호도 무시한다 — 방금 받은 스냅샷을 곧바로 다시 올리지 않도록.
 * - 업로드·복원·삭제는 runExclusive 한 줄(Promise 체인)로 직렬화한다. 삭제 직후 진행 중이던
 *   업로드가 백업을 되살리거나, 복원 도중 반쯤 바뀐 로컬이 올라가는 일을 막는다.
 * - 실패는 삼킨다(dirty 유지 + lastError). 다음 markDirty·포그라운드 복귀 때 다시 시도한다.
 *
 * 상태는 backupStore 에 둔다. backupStore 가 이 모듈을 import 하므로 반대 방향은
 * 호출 시점에 require 로 가져온다(로드 시점 순환 방지).
 */
import { AppState, type AppStateStatus } from 'react-native';
import { getIdToken, GoogleAuthError } from '../googleAuth';
import * as backupStorage from '../../storage/backupStorage';
import { BackupApiError, uploadBackup } from './api';
import { buildSnapshot, isApplyingSnapshot, validateSnapshot } from './snapshot';
import type { BackupErrorCode } from '../../state/backupStore';

/** 마지막 변경 후 이만큼 조용하면 올린다 */
export const DEBOUNCE_MS = 30_000;

type TimerHandle = ReturnType<typeof setTimeout>;

/** 테스트에서 바꿔 끼우는 외부 의존성 */
export type SchedulerDeps = {
  setTimeout: (fn: () => void, ms: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
  appState: {
    addEventListener: (
      type: 'change',
      listener: (state: AppStateStatus) => void,
    ) => { remove: () => void };
  };
};

const defaultDeps: SchedulerDeps = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: handle => clearTimeout(handle),
  appState: AppState,
};

let deps: SchedulerDeps = defaultDeps;

/** 테스트 전용 — 인자 없이 부르면 기본값으로 되돌린다 */
export function setSchedulerDeps(override?: Partial<SchedulerDeps>): void {
  deps = { ...defaultDeps, ...override };
}

function store() {
  return (require('../../state/backupStore') as typeof import('../../state/backupStore'))
    .backupStore;
}

// ── 직렬화 뮤텍스 ──────────────────────────────────────────────────────────────

let _pending: Promise<unknown> = Promise.resolve();

/** 업로드·복원·삭제를 한 줄로 세운다. fn 의 결과·예외는 그대로 호출부에 돌려준다 */
export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = _pending.then(() => fn());
  _pending = next.catch(() => {
    // 에러가 나도 체인이 끊기지 않도록
  });
  return next;
}

// ── 디바운스 ───────────────────────────────────────────────────────────────────

let timer: TimerHandle | null = null;
/**
 * 변경 일련번호. 업로드는 스냅샷을 만들기 직전 값을 기억해 두고, 끝났을 때 값이 그대로면
 * dirty 를 내린다 — 업로드 도중 들어온 변경을 "올렸다" 로 지워 버리지 않기 위해.
 */
let changeSeq = 0;

export function cancelPending(): void {
  if (timer != null) {
    deps.clearTimeout(timer);
    timer = null;
  }
}

function schedule(): void {
  cancelPending();
  timer = deps.setTimeout(() => {
    timer = null;
    void upload();
  }, DEBOUNCE_MS);
}

/** 백업 대상 데이터가 바뀌었다. 저장 성공 직후 부른다 */
export function markDirty(): void {
  const s = store().getState();
  if (!s.account || isApplyingSnapshot()) return;
  changeSeq += 1;
  if (!s.dirty) {
    store().setState({ dirty: true });
    // 기존 백업 복원/교체를 고르는 중에는 계정이 아직 저장 전이라 아무것도 쓰지 않는다
    if (!s.awaitingDecision) backupStorage.saveDirty(true).catch(() => {});
  }
  // 고르는 중에는 올리지 않는다 — 빈 로컬이 서버 백업을 덮어쓰면 안 된다
  if (s.awaitingDecision) return;
  schedule();
}

/** 대기 중인 업로드가 있으면 지금 올린다 */
export function flush(): void {
  if (timer != null) void upload();
}

// ── 업로드 ─────────────────────────────────────────────────────────────────────

/** 예외를 lastError 코드로 바꾼다 */
export function toBackupErrorCode(e: unknown): BackupErrorCode {
  if (e instanceof BackupApiError) return e.code;
  if (e instanceof GoogleAuthError) {
    // 네트워크 외 로그인 실패(권한 회수·Play 서비스·설정 오류)는 다시 로그인이 해법이다
    return e.code === 'network' ? 'network' : 'reauth';
  }
  return 'server';
}

/**
 * 지금 스냅샷을 올린다. 성공하면 true. 예외는 던지지 않는다.
 * 대기 타이머는 취소한다 — 이 업로드가 그 변경까지 싣는다(스냅샷은 차례가 왔을 때 만든다).
 */
export function upload(): Promise<boolean> {
  cancelPending();
  return runExclusive(async () => {
    const st = store();
    const s = st.getState();
    // 차례를 기다리는 동안 연동이 해제됐거나 복원/교체 선택을 기다리는 중
    if (!s.account || s.awaitingDecision) return false;
    st.setState({ status: 'backingUp' });
    try {
      const idToken = await getIdToken();
      const seq = changeSeq;
      const snapshot = await buildSnapshot();
      // 복원할 때 거부될 스냅샷은 올리지 않는다 — 서버의 정상 백업을 못 푸는 백업으로 덮게 된다.
      // dirty 는 그대로 두어, 로컬 값이 고쳐진 뒤 다음 변경·포그라운드 복귀 때 다시 시도한다
      const checked = validateSnapshot(snapshot);
      if (!checked.ok) {
        console.warn('[Backup] 스냅샷 검증 실패로 업로드 보류:', checked.detail);
        st.setState({ lastError: 'invalid' });
        return false;
      }
      const { updatedAt } = await uploadBackup(idToken, snapshot);
      // lastBackupAt 은 서버 200 뒤에만 바뀐다
      const dirty = seq !== changeSeq;
      st.setState({ lastBackupAt: updatedAt, dirty, lastError: null });
      await Promise.all([
        backupStorage.saveLastBackupAt(updatedAt),
        backupStorage.saveDirty(dirty),
      ]).catch(() => {});
      return true;
    } catch (e) {
      st.setState({ lastError: toBackupErrorCode(e) });
      return false;
    } finally {
      st.setState({ status: 'idle' });
    }
  });
}

// ── AppState ───────────────────────────────────────────────────────────────────

let subscription: { remove: () => void } | null = null;

function onAppStateChange(state: AppStateStatus): void {
  if (state === 'background' || state === 'inactive') {
    flush();
    return;
  }
  if (state === 'active') {
    // 실패로 남은 변경을 다시 시도. 타이머가 이미 있으면 그 차례를 기다린다
    const s = store().getState();
    if (s.account && s.dirty && !s.awaitingDecision && timer == null) void upload();
  }
}

/**
 * AppState 구독을 시작한다. 앱 시작 시 backupStore.load() 뒤에 한 번 부른다.
 * 지난 실행에서 못 올린 변경이 있으면 디바운스 뒤에 다시 올린다.
 */
export function start(): void {
  if (subscription) return;
  subscription = deps.appState.addEventListener('change', onAppStateChange);
  const s = store().getState();
  if (s.account && s.dirty && !s.awaitingDecision) schedule();
}

export function stop(): void {
  subscription?.remove();
  subscription = null;
  cancelPending();
}
