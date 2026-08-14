/**
 * 음주 세션 Zustand 스토어
 *
 * - 변이 연산은 Promise 체인으로 직렬화 (Flutter 뮤텍스 방식과 동일)
 * - finishRecord: finishedAt = now 설정
 * - checkAutoClose: BAC 0 이고 마시는중 기록 없으면 세션 자동 종료
 *   (알림은 취소하지 않음 — "분해 완료" 알림이 알림 센터에 남아야 함)
 */
import { create } from 'zustand';
import { DrinkRecord } from '../core/types';
import { currentBac, estimatedSoberAt } from '../core/bacCalculator';
import * as db from '../storage/db';
import * as notificationService from '../services/notifications';
import { profileStore } from './profileStore';
import { localeStore } from './localeStore';

interface SessionState {
  records: DrinkRecord[];
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
  /** 모든 기록 삭제 + 알림 취소 */
  clearAll: () => Promise<void>;
  /**
   * 타이머 틱마다 호출: BAC 가 0 이고 마시는중 기록이 없으면 세션 자동 종료.
   * 마시는중 기록이 하나라도 있으면 세션 유지.
   */
  checkAutoClose: () => Promise<void>;
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
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const records = await db.getAllRecords();
      set({ records, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addRecord: (record) =>
    serialize(async () => {
      await db.insertRecord(record);
      const updated = await db.getAllRecords();
      set({ records: updated });
      await rescheduleNotification(updated);
    }),

  updateRecord: (record) =>
    serialize(async () => {
      await db.updateRecord(record);
      const updated = await db.getAllRecords();
      set({ records: updated });
      await rescheduleNotification(updated);
    }),

  deleteRecord: (id) =>
    serialize(async () => {
      await db.deleteRecord(id);
      const updated = await db.getAllRecords();
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
      const updated = await db.getAllRecords();
      set({ records: updated });
      await rescheduleNotification(updated);
    }),

  clearAll: () =>
    serialize(async () => {
      await db.deleteAllRecords();
      await notificationService.cancelAll();
      set({ records: [] });
    }),

  checkAutoClose: async () => {
    const profile = profileStore.getState().profile;
    if (!profile) return;

    const { records } = get();
    if (records.length === 0) return;

    // 마시는중 기록이 있으면 세션 유지 (BAC 가 0 이어도)
    if (records.some(r => r.finishedAt === undefined)) return;

    const bac = currentBac(records, profile, Date.now());
    if (bac > 0) return;

    // 뮤텍스 진입 후 재검사 (다른 변이와의 경합 방지)
    return serialize(async () => {
      const innerProfile = profileStore.getState().profile;
      if (!innerProfile) return;

      const { records: innerRecords } = get();
      if (innerRecords.length === 0) return;
      if (innerRecords.some(r => r.finishedAt === undefined)) return;

      const innerBac = currentBac(innerRecords, innerProfile, Date.now());
      if (innerBac <= 0) {
        await db.deleteAllRecords();
        // 알림은 취소하지 않음 — "분해 완료" 알림이 알림 센터에 남아야 함
        set({ records: [] });
      }
    });
  },
}));
