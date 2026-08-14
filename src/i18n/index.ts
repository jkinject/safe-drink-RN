import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import ko from './ko';
import en from './en';

export const i18n = new I18n({ ko, en });

i18n.enableFallback = true;
i18n.defaultLocale = 'en';

/** 기기 로케일 기반 초기 locale 설정 (ko → ko, 그 외 → en) */
const systemLang = Localization.getLocales()[0]?.languageCode ?? 'en';
i18n.locale = systemLang === 'ko' ? 'ko' : 'en';
