import { Linking, Platform } from 'react-native';
import { actionSheet } from '@/components/dialog';
import { i18n } from '@/i18n';
import { PLAY_MARKET_URL, PLAY_STORE_URL } from '@/constants/appInfo';
import * as reviewStorage from '@/storage/reviewStorage';
import type { ReviewState } from '@/storage/reviewStorage';

/**
 * 스토어 평가 요청.
 *
 * 묻는 시점: 술자리가 끝나 "지금 안전" 화면으로 돌아왔을 때 — 앱이 약속을 지킨 직후라
 * 만족도가 가장 높다. 그 화면이 뜰 때마다가 아니라, 닫힌 술자리가 MIN_SESSIONS 개 이상
 * 쌓였을 때 한 번, "나중에" 를 고르면 LATER_INTERVAL 뒤에 다시, "다시 묻지 않기"·평가 완료
 * 뒤에는 영원히 묻지 않는다. 앱 실행 한 번에 한 번만 시도한다.
 *
 * Google 의 인앱 리뷰 API(expo-store-review) 는 네이티브 모듈이라 새 바이너리가 필요해서
 * 지금은 Play 스토어 페이지를 여는 방식이다. 바이너리를 낼 때 openStore 만 바꾸면 된다.
 */

export const MIN_SESSIONS = 2;
export const LATER_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

let promptedThisLaunch = false;

/** 지금 물어봐도 되는지 — 순수 판단이라 테스트한다 */
export function shouldPrompt(
  state: ReviewState,
  closedSessions: number,
  nowMs: number,
  platform: string = Platform.OS,
): boolean {
  if (platform !== 'android') return false; // 아직 Play 에만 있다
  if (closedSessions < MIN_SESSIONS) return false;
  if (state.status === 'done' || state.status === 'never') return false;
  if (state.status === 'later') return nowMs - state.lastPromptAt >= LATER_INTERVAL_MS;
  return true;
}

export async function openStore(): Promise<void> {
  try {
    await Linking.openURL(PLAY_MARKET_URL);
  } catch {
    await Linking.openURL(PLAY_STORE_URL).catch(() => {});
  }
}

/**
 * 조건이 맞으면 평가 요청 시트를 띄운다. 조용히 실패한다 — 평가 요청이 앱을 방해하면 안 된다.
 * @returns 실제로 시트를 띄웠는지
 */
export async function maybePromptReview(closedSessions: number, nowMs = Date.now()): Promise<boolean> {
  if (promptedThisLaunch) return false;
  const state = await reviewStorage.loadReviewState();
  if (!shouldPrompt(state, closedSessions, nowMs)) return false;
  promptedThisLaunch = true;

  const choice = await actionSheet({
    title: i18n.t('reviewPromptTitle'),
    actions: [
      { label: i18n.t('reviewPromptRate') },
      { label: i18n.t('reviewPromptLater') },
      { label: i18n.t('reviewPromptNever') },
    ],
    cancelLabel: i18n.t('settingsCancel'),
  });

  const next: ReviewState =
    choice === 0
      ? { status: 'done', lastPromptAt: nowMs }
      : choice === 2
        ? { status: 'never', lastPromptAt: nowMs }
        : { status: 'later', lastPromptAt: nowMs }; // 나중에·닫기 모두 다음 기회에
  await reviewStorage.saveReviewState(next).catch(() => {});
  if (choice === 0) await openStore();
  return true;
}

/** 테스트용 */
export function _resetForTests() {
  promptedThisLaunch = false;
}
