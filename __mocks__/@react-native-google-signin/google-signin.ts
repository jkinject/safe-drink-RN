/**
 * @react-native-google-signin/google-signin 목 — 네이티브 모듈이 없는 jest 환경용.
 * 루트 __mocks__ 에 두면 node_modules 모듈은 jest.mock 호출 없이 자동 대체된다.
 * 기본 응답은 "로그인 안 됨"(signIn 취소, signInSilently 저장된 로그인 없음).
 * 테스트에서 mockResolvedValueOnce 등으로 바꿔 쓴다.
 */

// Android 네이티브 상수와 같은 값
export const statusCodes = Object.freeze({
  SIGN_IN_CANCELLED: '12501',
  IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: '4',
  NULL_PRESENTER: 'NULL_PRESENTER' as const,
});

export const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(async () => true),
  signIn: jest.fn(async () => ({ type: 'cancelled' as const, data: null })),
  signInSilently: jest.fn(async () => ({ type: 'noSavedCredentialFound' as const, data: null })),
  getTokens: jest.fn(async () => ({ idToken: '', accessToken: '' })),
  signOut: jest.fn(async () => null),
  revokeAccess: jest.fn(async () => null),
  hasPreviousSignIn: jest.fn(() => false),
  getCurrentUser: jest.fn(() => null),
  addScopes: jest.fn(async () => null),
  clearCachedAccessToken: jest.fn(async () => null),
};

export const isErrorWithCode = (error: unknown): error is Error & { code: string } =>
  typeof error === 'object' && error != null && 'code' in error;

export const isSuccessResponse = (r: { type: string }) => r.type === 'success';
export const isCancelledResponse = (r: { type: string }) => r.type === 'cancelled';
export const isNoSavedCredentialFoundResponse = (r: { type: string }) =>
  r.type === 'noSavedCredentialFound';

export const GoogleSigninButton = () => null;
