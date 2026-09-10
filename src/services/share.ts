import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { i18n } from '@/i18n';
import { PLAY_STORE_URL } from '@/constants/appInfo';
import { shareCardStore } from '@/components/share-card-host';
import { sessionStore } from '@/state/sessionStore';
import { profileStore } from '@/state/profileStore';
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

/** 텍스트 공유 — 이미지를 못 만들 때의 폴백 */
export async function shareSessionText(session: DrinkSession, locale: string): Promise<void> {
  try {
    await Share.share({ message: sessionShareText(session, locale) });
  } catch {
    // 사용자가 시트를 닫았거나 공유 대상이 없음 — 조용히 넘긴다
  }
}

/**
 * 술자리 요약 카드를 이미지로 만들어 OS 공유 시트로 보낸다.
 * 그래프가 들어간 이미지가 단톡방·SNS 에서 훨씬 눈에 띄므로 이미지가 기본이고,
 * 기록을 못 읽거나 캡처가 실패하면 텍스트 공유로 내려간다.
 * Android 공유 시트는 이미지와 문구를 같이 못 보내므로 앱 이름·주소는 이미지 푸터에 있다.
 */
export async function shareSession(session: DrinkSession, locale: string): Promise<void> {
  const profile = profileStore.getState().profile;
  try {
    if (!profile || !(await Sharing.isAvailableAsync())) throw new Error('image share unavailable');
    const records = await sessionStore.getState().getSessionRecords(session.id);
    if (records.length === 0) throw new Error('no records');
    const uri = await shareCardStore.getState().capture({ session, records, profile, locale });
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: i18n.t('shareSession'),
    });
  } catch {
    await shareSessionText(session, locale);
  }
}
