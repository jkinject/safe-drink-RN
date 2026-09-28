import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalePreference = 'ko' | 'en' | 'system';

const LOCALE_KEY = 'selected_locale';

/** 수동 선택 로케일 저장 */
export async function saveLocale(locale: LocalePreference): Promise<void> {
  await AsyncStorage.setItem(LOCALE_KEY, locale);
}

/** 저장된 로케일 로드. 없으면 null. */
export async function loadLocale(): Promise<LocalePreference | null> {
  const v = await AsyncStorage.getItem(LOCALE_KEY);
  if (v === 'ko' || v === 'en' || v === 'system') return v;
  return null;
}

/** 백업 복원용 [키, 저장 문자열] — null 이면 키를 지운다(profileStorage.profileEntry 참고) */
export function localeEntry(locale: LocalePreference | null): [string, string | null] {
  return [LOCALE_KEY, locale];
}

/** 저장된 로케일 삭제 */
export async function clearLocale(): Promise<void> {
  await AsyncStorage.removeItem(LOCALE_KEY);
}
