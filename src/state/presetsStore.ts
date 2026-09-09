import { create } from 'zustand';
import { DrinkPreset } from '../core/types';
import * as presetStorage from '../storage/presetStorage';
import { localeStore, type LocaleCode } from './localeStore';

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
  /** 언어 변경 시 손대지 않은 기본 프리셋을 새 언어 기본으로 교체 (localeStore 가 부른다) */
  swapDefaultsForLocale: (from: LocaleCode, to: LocaleCode) => Promise<void>;
}

export const presetsStore = create<PresetsState>((set, get) => ({
  presets: [],
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const locale = localeStore.getState().locale;
      const presets = await presetStorage.seedIfNeeded(locale);
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

  swapDefaultsForLocale: async (from, to) => {
    const swapped = await presetStorage.swapDefaultsForLocale(from, to);
    if (swapped) set({ presets: swapped });
  },

  restoreDefaults: async () => {
    const locale = localeStore.getState().locale;
    const restored = await presetStorage.restoreDefaults(locale);
    set({ presets: restored });
  },
}));
