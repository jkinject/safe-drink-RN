import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { actionSheet } from '@/components/dialog';
import { i18n } from '@/i18n';
import { PLAY_MARKET_URL, PLAY_STORE_URL } from '@/constants/appInfo';
import * as reviewStorage from '@/storage/reviewStorage';
import type { ReviewState } from '@/storage/reviewStorage';

/**
 * 스토어 평가 요청 — "칭찬하기 / 나중에 하기" 두 선택지.
 *
 * 묻는 시점: 술자리가 끝나 "지금 안전" 화면으로 돌아왔을 때 — 앱이 약속을 지킨 직후라
 * 만족도가 가장 높다. 닫힌 술자리가 MIN_SESSIONS 개 이상 쌓였을 때 한 번, "나중에" 를
 * 고르면 LATER_INTERVAL 뒤에 다시, 칭찬하기를 누른 뒤에는 다시 묻지 않는다.
 * 앱 실행 한 번에 한 번만 시도한다. 대놓고 "리뷰 써 달라" 고 하지 않는 게 방침이라
 * 문구는 칭찬을 청하는 톤으로 두고, 실제 창은 Google 인앱 리뷰(별점 시트)가 뜬다.
 *
 * 인앱 리뷰 API 는 Google 이 노출 빈도를 제한하므로 안 뜰 수도 있다 — 그때는 Play
 * 스토어 페이지로 보낸다. 사용자가 별점 창에서 뭘 했는지는 API 가 알려주지 않으므로
 * 칭찬하기를 누른 것 자체를 done 으로 기록한다.
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

/** 인앱 리뷰 시트를 띄우고, 못 띄우면 스토어 페이지를 연다 */
export async function openReview(): Promise<void> {
  try {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // 아래 폴백
  }
  try {
    await Linking.openURL(PLAY_MARKET_URL);
  } catch {
    await Linking.openURL(PLAY_STORE_URL).catch(() => {});
  }
}

/**
 * 조건이 맞으면 요청 시트를 띄운다. 조용히 실패한다 — 평가 요청이 앱을 방해하면 안 된다.
 * @returns 실제로 시트를 띄웠는지
 */
export async function maybePromptReview(closedSessions: number, nowMs = Date.now()): Promise<boolean> {
  if (promptedThisLaunch) return false;
  const state = await reviewStorage.loadReviewState();
  if (!shouldPrompt(state, closedSessions, nowMs)) return false;
  promptedThisLaunch = true;

  const choice = await actionSheet({
    title: i18n.t('reviewPromptTitle'),
    actions: [{ label: i18n.t('reviewPromptRate') }],
    cancelLabel: i18n.t('reviewPromptLater'),
  });

  const next: ReviewState =
    choice === 0 ? { status: 'done', lastPromptAt: nowMs } : { status: 'later', lastPromptAt: nowMs };
  await reviewStorage.saveReviewState(next).catch(() => {});
  if (choice === 0) await openReview();
  return true;
}

/** 테스트용 */
export function _resetForTests() {
  promptedThisLaunch = false;
}
