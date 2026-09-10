import { Share } from 'react-native';
import { i18n } from '@/i18n';
import { PLAY_STORE_URL } from '@/constants/appInfo';
import type { DrinkSession } from '@/core/types';

function hm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 공유 문구 — 술자리 요약 한 줄 + 스토어 링크. 순수 함수라 테스트한다 */
export function sessionShareText(session: DrinkSession, locale: string): string {
  const date = new Date(session.startedAt).toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  return i18n.t('shareSessionText', {
    date,
    start: hm(session.startedAt),
    end: hm(session.lastFinishedAt),
    n: session.drinkCount,
    peak: session.peakBac.toFixed(3),
    sober: hm(session.soberAt),
    url: PLAY_STORE_URL,
  });
}

/**
 * OS 공유 시트로 술자리 요약을 보낸다. 지금은 텍스트만 — 그래프 이미지까지 담으려면
 * view-shot 네이티브 모듈이 필요해 새 바이너리를 낼 때 붙인다.
 */
export async function shareSession(session: DrinkSession, locale: string): Promise<void> {
  try {
    await Share.share({ message: sessionShareText(session, locale) });
  } catch {
    // 사용자가 시트를 닫았거나 공유 대상이 없음 — 조용히 넘긴다
  }
}
