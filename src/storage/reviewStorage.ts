import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'review_prompt_state';

export type ReviewStatus = 'pending' | 'later' | 'done' | 'never';

export interface ReviewState {
  status: ReviewStatus;
  /** 마지막으로 물어본 시각 (없으면 0) */
  lastPromptAt: number;
}

const DEFAULT: ReviewState = { status: 'pending', lastPromptAt: 0 };

export async function loadReviewState(): Promise<ReviewState> {
  try {
    const json = await AsyncStorage.getItem(KEY);
    if (!json) return DEFAULT;
    const parsed = JSON.parse(json) as Partial<ReviewState>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export async function saveReviewState(state: ReviewState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}
