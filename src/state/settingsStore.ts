import { create } from 'zustand';
import * as settingsStorage from '../storage/settingsStorage';

interface SettingsState {
  /** 알림창 카운트다운 표시 (기본 ON) */
  timerNotificationEnabled: boolean;
  load: () => Promise<void>;
  setTimerNotificationEnabled: (enabled: boolean) => Promise<void>;
}

export const settingsStore = create<SettingsState>((set) => ({
  // 로드 전에도 ON 으로 시작한다 — 기본값이 ON 이라 깜빡임이 없다
  timerNotificationEnabled: true,

  load: async () => {
    try {
      const enabled = await settingsStorage.loadTimerNotificationEnabled();
      set({ timerNotificationEnabled: enabled });
    } catch {
      // 읽기 실패는 기본값(ON) 유지
    }
  },

  setTimerNotificationEnabled: async (enabled) => {
    set({ timerNotificationEnabled: enabled });
    try {
      await settingsStorage.saveTimerNotificationEnabled(enabled);
    } catch {
      // 저장 실패해도 이번 세션 동안은 선택을 존중한다
    }
  },
}));
