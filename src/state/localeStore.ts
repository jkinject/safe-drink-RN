import { create } from 'zustand';
import * as Localization from 'expo-localization';
import { i18n } from '../i18n';
import * as localeStorage from '../storage/localeStorage';
import type { LocalePreference } from '../storage/localeStorage';

export type LocaleCode = 'ko' | 'en';

interface LocaleState {
  locale: LocaleCode;
  /** AsyncStorage 에서 저장된 선택 로드 및 적용 */
  load: () => Promise<void>;
  /** 로케일 수동 변경 및 저장 */
  setLocale: (pref: LocalePreference) => Promise<void>;
}

function resolveSystemLocale(): LocaleCode {
  const lang = Localization.getLocales()[0]?.languageCode ?? 'en';
  return lang === 'ko' ? 'ko' : 'en';
}

const initialLocale = resolveSystemLocale();
i18n.locale = initialLocale;

export const localeStore = create<LocaleState>((set, get) => ({
  locale: initialLocale,

  load: async () => {
    const saved = await localeStorage.loadLocale();
    const resolved: LocaleCode =
      saved == null || saved === 'system' ? resolveSystemLocale() : saved;
    i18n.locale = resolved;
    set({ locale: resolved });
  },

  setLocale: async (pref: LocalePreference) => {
    const prev = get().locale;
    await localeStorage.saveLocale(pref);
    const resolved: LocaleCode =
      pref === 'system' ? resolveSystemLocale() : pref;
    i18n.locale = resolved;
    set({ locale: resolved });
    // 손대지 않은 기본 프리셋은 새 언어 기본으로 바꿔 준다.
    // presetsStore 가 이 파일을 import 하므로 순환을 피해 동적으로 가져온다.
    // 실패해도 언어 변경 자체는 이미 끝났으니 삼킨다.
    if (prev !== resolved) {
      try {
        const { presetsStore } = await import('./presetsStore');
        await presetsStore.getState().swapDefaultsForLocale(prev, resolved);
      } catch {
        // noop
      }
    }
  },
}));
