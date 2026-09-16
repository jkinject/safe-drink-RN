/**
 * expo-live-activity 목 — 네이티브 모듈이 없는 jest 환경용.
 * 루트 __mocks__ 에 두면 node_modules 모듈은 jest.mock 호출 없이 자동 대체된다.
 */
export const startActivity = jest.fn((): string | undefined => 'activity-1');
export const updateActivity = jest.fn();
export const stopActivity = jest.fn();
export const addActivityUpdatesListener = jest.fn(() => ({ remove: jest.fn() }));
export const addActivityTokenListener = jest.fn(() => ({ remove: jest.fn() }));
export const addActivityPushToStartTokenListener = jest.fn(() => ({ remove: jest.fn() }));

export type LiveActivityState = {
  title: string;
  subtitle?: string;
  progressBar?: { date?: number; progress?: number };
  imageName?: string;
  dynamicIslandImageName?: string;
};
export type LiveActivityConfig = Record<string, unknown>;
