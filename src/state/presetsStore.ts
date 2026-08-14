import { create } from 'zustand';
import { DrinkPreset } from '../core/types';
import * as presetStorage from '../storage/presetStorage';

interface PresetsState {
  presets: DrinkPreset[];
  isLoading: boolean;
  /** 첫 실행 시드 포함 로드 */
  load: () => Promise<void>;
  /** 전체 프리셋 저장 */
  save: (presets: DrinkPreset[]) => Promise<void>;
  /** 특정 인덱스의 프리셋 수정 */
  updateAt: (index: number, preset: DrinkPreset) => Promise<void>;
  /** 누락된 기본 프리셋 복원 */
  restoreDefaults: () => Promise<void>;
}

export const presetsStore = create<PresetsState>((set, get) => ({
  presets: [],
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const presets = await presetStorage.seedIfNeeded();
      set({ presets, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  save: async (presets: DrinkPreset[]) => {
    await presetStorage.savePresets(presets);
    set({ presets });
  },

  updateAt: async (index: number, preset: DrinkPreset) => {
    await presetStorage.updatePresetAt(index, preset);
    const updated = get().presets.map((p, i) => (i === index ? preset : p));
    set({ presets: updated });
  },

  restoreDefaults: async () => {
    const restored = await presetStorage.restoreDefaults();
    set({ presets: restored });
  },
}));
