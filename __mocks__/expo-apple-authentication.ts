/**
 * expo-apple-authentication 목 — 네이티브 모듈이 없는 jest 환경용.
 * 루트 __mocks__ 에 두면 node_modules 모듈은 jest.mock 호출 없이 자동 대체된다.
 * 기본 응답: 사용 가능, signInAsync 는 사용자 취소(ERR_REQUEST_CANCELED), 자격 상태 AUTHORIZED.
 * 테스트에서 mockResolvedValueOnce 등으로 바꿔 쓴다.
 */

export enum AppleAuthenticationScope {
  FULL_NAME = 0,
  EMAIL = 1,
}

export enum AppleAuthenticationCredentialState {
  REVOKED = 0,
  AUTHORIZED = 1,
  NOT_FOUND = 2,
  TRANSFERRED = 3,
}

export enum AppleAuthenticationButtonType {
  SIGN_IN = 0,
  CONTINUE = 1,
  SIGN_UP = 2,
}

export enum AppleAuthenticationButtonStyle {
  WHITE = 0,
  WHITE_OUTLINE = 1,
  BLACK = 2,
}

function canceled(): Error & { code: string } {
  return Object.assign(new Error('The user canceled the authorization attempt'), {
    code: 'ERR_REQUEST_CANCELED',
  });
}

export const isAvailableAsync = jest.fn(async () => true);
export const signInAsync = jest.fn(async (_options?: unknown): Promise<unknown> => {
  throw canceled();
});
export const refreshAsync = jest.fn(async (_options?: unknown): Promise<unknown> => {
  throw canceled();
});
export const signOutAsync = jest.fn(async (_options?: unknown): Promise<unknown> => {
  throw canceled();
});
export const getCredentialStateAsync = jest.fn(
  async (_user: string) => AppleAuthenticationCredentialState.AUTHORIZED,
);
export const addRevokeListener = jest.fn(() => ({ remove: jest.fn() }));
export const formatFullName = jest.fn(() => '');

export const AppleAuthenticationButton = () => null;
