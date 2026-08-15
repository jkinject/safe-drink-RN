/**
 * 음주 세션 Zustand 스토어
 *
 * - 변이 연산은 Promise 체인으로 직렬화 (Flutter 뮤텍스 방식과 동일)
 * - finishRecord: finishedAt = now 설정
 * - checkAutoClose: BAC 0 이고 마시는중 기록 없으면 세션 자동 종료
 *   (알림은 취소하지 않음 — "분해 완료" 알림이 알림 센터에 남아야 함)
 * - records 는 열린 세션의 기록만 포함한다. 닫힌 세션은 sessions 에서 읽는다.
 */
import { create } from 'zustand';
import { DrinkRecord, DrinkSession } from '../core/types';
import { currentBac, estimatedSoberAt } from '../core/bacCalculator';
import { computeSessionSummary } from '../core/sessionUtils';
import * as db from '../storage/db';
import * as notificationService from '../services/notifications';
import { profileStore } from './profileStore';
import { localeStore } from './localeStore';

interface SessionState {
  records: DrinkRecord[];      // 열린 세션의 기록만 (session_id IS NULL)
  sessions: DrinkSession[];    // 닫힌 세션 요약 목록
  isLoading: boolean;
  /** DB 에서 기록 로드 */
  load: () => Promise<void>;
  /** 음주 기록 추가 */
  addRecord: (record: Omit<DrinkRecord, 'id'>) => Promise<void>;
  /** 음주 기록 수정 */
  updateRecord: (record: DrinkRecord) => Promise<void>;
  /** 음주 기록 삭제 */
  deleteRecord: (id: number) => Promise<void>;
  /** 마시는중 → 완료 처리 (finishedAt = now) */
  finishRecord: (id: number) => Promise<void>;
  /** 모든 기록·세션 삭제 + 알림 취소 */
  clearAll: () => Promise<void>;
  /**
   * 타이머 틱마다 호출: BAC 가 0 이고 마시는중 기록이 없으면 세션 자동 종료.
   * 마시는중 기록이 하나라도 있으면 세션 유지.
   */
  checkAutoClose: () => Promise<void>;
  /** 닫힌 세션 목록 로드 */
  loadSessions: () => Promise<void>;
  /** 세션 1건 삭제 */
  deleteSession: (sessionId: number) => Promise<void>;
  /** 세션 1건의 기록 조회 */
  getSessionRecords: (sessionId: number) => Promise<DrinkRecord[]>;
}

// ── 직렬화 뮤텍스 ──────────────────────────────────────────────────────────────

let _pending: Promise<void> = Promise.resolve();

function serialize(fn: () => Promise<void>): Promise<void> {
  const next = _pending.then(() => fn());
  _pending = next.catch(() => {
    // 에러가 발생해도 _pending 체인이 끊기지 않도록 보호
  });
  return next;
}

// ── 알림 재예약 ────────────────────────────────────────────────────────────────

async function rescheduleNotification(records: DrinkRecord[]): Promise<void> {
  try {
    await notificationService.cancelAll();
    const profile = profileStore.getState().profile;
    if (records.length === 0 || !profile) return;

    const soberAtMs = estimatedSoberAt(records, profile);
    if (soberAtMs !== null && soberAtMs > Date.now()) {
      const { locale } = localeStore.getState();
      const isKo = locale === 'ko';
      await notificationService.scheduleSoberNotification(soberAtMs, {
        title: isKo ? '이제 안전해요! 🎉' : "You're safe now! 🎉",
        body: isKo
          ? '알코올이 모두 분해되었어요. 그래도 컨디션을 한 번 확인해 주세요 😊'
          : 'All alcohol has been metabolized. Still, check how you feel first 😊',
      });
    }
  } catch (e) {
    console.warn('[Notification] 알림 예약 실패:', e);
  }
}

// ── 스토어 ─────────────────────────────────────────────────────────────────────

export const sessionStore = create<SessionState>((set, get) => ({
  records: [],
  sessions: [],
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const records = await db.getOpenSessionRecords();
      set({ records, isLoading: false });
      // 앱이 꺼져 있는 동안 BAC 가 0 이 된 세션을 닫는다 (B3 load-time check).
      // closeSessionIfSober 는 checkAutoClose 에 모든 가드가 있으므로 그대로 위임한다.
      await get().checkAutoClose();
    } catch {
      set({ isLoading: false });
    }
  },

  addRecord: (record) =>
    serialize(async () => {
      await db.insertRecord(record);
      const updated = await db.getOpenSessionRecords();
      set({ records: updated });
      await rescheduleNotification(updated);
    }),

  updateRecord: (record) =>
    serialize(async () => {
      await db.updateRecord(record);
      const updated = await db.getOpenSessionRecords();
      set({ records: updated });
      await rescheduleNotification(updated);
    }),

  deleteRecord: (id) =>
    serialize(async () => {
      await db.deleteRecord(id);
      const updated = await db.getOpenSessionRecords();
      set({ records: updated });
      await rescheduleNotification(updated);
    }),

  finishRecord: (id) =>
    serialize(async () => {
      const { records } = get();
      const record = records.find(r => r.id === id);
      if (!record) return;
      const finished: DrinkRecord = { ...record, finishedAt: Date.now() };
      await db.updateRecord(finished);
      const updated = await db.getOpenSessionRecords();
      set({ records: updated });
      await rescheduleNotification(updated);
    }),

  clearAll: () =>
    serialize(async () => {
      await db.deleteAllData();
      await notificationService.cancelAll();
      set({ records: [], sessions: [] });
    }),

  checkAutoClose: async () => {
    const profile = profileStore.getState().profile;
    if (!profile) return;

    const { records } = get();
    if (records.length === 0) return;

    // 마시는중 기록이 있으면 세션 유지 (BAC 가 0 이어도)
    if (records.some(r => r.finishedAt == null)) return;

    const bac = currentBac(records, profile, Date.now());
    if (bac > 0) return;

    // 뮤텍스 진입 후 재검사 (다른 변이와의 경합 방지)
    return serialize(async () => {
      const innerProfile = profileStore.getState().profile;
      if (!innerProfile) return;

      const { records: innerRecords } = get();
      if (innerRecords.length === 0) return;
      if (innerRecords.some(r => r.finishedAt == null)) return;

      const innerBac = currentBac(innerRecords, innerProfile, Date.now());
      if (innerBac <= 0) {
        // 요약 계산은 전부 computeSessionSummary 안에 있다 — 여기서 다시 쓰지 말 것.
        // (빈 배열 방어 가드와 Math.min/max 도 그 안에 포함)
        const summary = computeSessionSummary(innerRecords, innerProfile);
        if (summary == null) return;

        const sessionId = await db.closeSession(summary);
        console.warn(
          `[Session] Closed session #${sessionId}, ${summary.drinkCount} records, peak BAC ${summary.peakBac.toFixed(5)}`,
        );

        // 알림은 취소하지 않음 — "분해 완료" 알림이 알림 센터에 남아야 함
        set({ records: [] });
        const sessions = await db.getAllSessions();
        set({ sessions });
      }
    });
  },

  loadSessions: async () => {
    try {
      const sessions = await db.getAllSessions();
      set({ sessions });
    } catch {
      // 세션 목록 로드 실패가 앱 시작을 막아서는 안 된다 — BAC 타이머가 안전 핵심 기능
    }
  },

  deleteSession: (sessionId) =>
    serialize(async () => {
      await db.deleteSession(sessionId);
      const sessions = await db.getAllSessions();
      set({ sessions });
    }),

  getSessionRecords: (sessionId) => db.getSessionRecords(sessionId),
}));
