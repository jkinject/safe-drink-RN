/**
 * purchaseStore — 광고 제거 구매·복원 흐름.
 *
 * services/iap 를 통째로 목 처리한다. requestPurchase 는 시트만 띄우고 결과는
 * 리스너로 오는 구조라, 목의 subscribe 가 넘겨받은 핸들러를 잡아 두고 테스트에서
 * 직접 호출해 "스토어가 결과를 보냈다" 를 흉내 낸다.
 */

let mockHandlers: { onOwned: () => void; onError: (e: unknown) => void } | null = null;
let mockCached = false;
let mockOwned = false;
let mockCancelledError = false;
const mockSaved: boolean[] = [];

jest.mock('../../services/iap', () => ({
  connect: jest.fn(async () => {}),
  fetchRemoveAdsProduct: jest.fn(async () => ({ id: 'remove_ads', displayPrice: '₩3,300' })),
  checkOwnership: jest.fn(async () => mockOwned),
  purchaseRemoveAds: jest.fn(async () => {}),
  restore: jest.fn(async () => mockOwned),
  isUserCancelled: jest.fn(() => mockCancelledError),
  subscribe: jest.fn((h: typeof mockHandlers) => {
    mockHandlers = h;
    return () => {
      mockHandlers = null;
    };
  }),
}));

jest.mock('../../storage/purchaseStorage', () => ({
  loadAdsRemoved: jest.fn(async () => mockCached),
  saveAdsRemoved: jest.fn(async (v: boolean) => {
    mockSaved.push(v);
  }),
}));

import { purchaseStore } from '../purchaseStore';
import * as iap from '../../services/iap';

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  mockHandlers = null;
  mockCached = false;
  mockOwned = false;
  mockCancelledError = false;
  mockSaved.length = 0;
  purchaseStore.setState({ adsRemoved: false, product: null, storeReady: false, status: 'idle' });
  jest.clearAllMocks();
});

describe('load / initialize', () => {
  it('캐시가 true 면 스토어 조회 전에도 광고를 숨긴다', async () => {
    mockCached = true;
    await purchaseStore.getState().load();
    expect(purchaseStore.getState().adsRemoved).toBe(true);
  });

  it('스토어 조회 결과가 캐시와 다르면 스토어를 따른다 (환불 대응)', async () => {
    mockCached = true;
    mockOwned = false;
    await purchaseStore.getState().load();
    const unsub = await purchaseStore.getState().initialize();
    expect(purchaseStore.getState().adsRemoved).toBe(false);
    expect(mockSaved).toEqual([false]);
    expect(purchaseStore.getState().storeReady).toBe(true);
    expect(purchaseStore.getState().product?.displayPrice).toBe('₩3,300');
    unsub();
    expect(mockHandlers).toBeNull();
  });

  it('스토어 연결에 실패해도 storeReady 는 true 가 되고 캐시 값은 유지된다', async () => {
    mockCached = true;
    (iap.connect as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await purchaseStore.getState().load();
    await purchaseStore.getState().initialize();
    expect(purchaseStore.getState().adsRemoved).toBe(true);
    expect(purchaseStore.getState().storeReady).toBe(true);
    expect(purchaseStore.getState().product).toBeNull();
  });
});

describe('purchase', () => {
  it('리스너로 완료가 오면 owned 를 돌려주고 캐시에 저장한다', async () => {
    await purchaseStore.getState().initialize();
    const p = purchaseStore.getState().purchase();
    await flush();
    expect(purchaseStore.getState().status).toBe('purchasing');
    mockHandlers!.onOwned();
    await expect(p).resolves.toBe('owned');
    expect(purchaseStore.getState().adsRemoved).toBe(true);
    expect(mockSaved).toContain(true);
    expect(purchaseStore.getState().status).toBe('idle');
  });

  it('사용자 취소는 cancelled, 그 외 오류는 error', async () => {
    await purchaseStore.getState().initialize();
    mockCancelledError = true;
    const p1 = purchaseStore.getState().purchase();
    await flush();
    mockHandlers!.onError({ code: 'user-cancelled' });
    await expect(p1).resolves.toBe('cancelled');

    mockCancelledError = false;
    const p2 = purchaseStore.getState().purchase();
    await flush();
    mockHandlers!.onError({ code: 'network-error' });
    await expect(p2).resolves.toBe('error');
    expect(purchaseStore.getState().adsRemoved).toBe(false);
  });

  it('requestPurchase 자체가 거부되면 error 로 끝나고 status 가 풀린다', async () => {
    await purchaseStore.getState().initialize();
    (iap.purchaseRemoveAds as jest.Mock).mockRejectedValueOnce(new Error('E_NOT_PREPARED'));
    await expect(purchaseStore.getState().purchase()).resolves.toBe('error');
    expect(purchaseStore.getState().status).toBe('idle');
  });

  it('앱 밖에서 끝난 결제(리스너만 도착)도 적용된다', async () => {
    await purchaseStore.getState().initialize();
    mockHandlers!.onOwned();
    await flush();
    expect(purchaseStore.getState().adsRemoved).toBe(true);
  });
});

describe('restore', () => {
  it('보유 중이면 restored + 적용, 없으면 nothing', async () => {
    mockOwned = true;
    await expect(purchaseStore.getState().restore()).resolves.toBe('restored');
    expect(purchaseStore.getState().adsRemoved).toBe(true);

    mockOwned = false;
    await expect(purchaseStore.getState().restore()).resolves.toBe('nothing');
    expect(purchaseStore.getState().adsRemoved).toBe(false);
  });

  it('스토어 오류면 error 를 돌려주고 상태는 건드리지 않는다', async () => {
    purchaseStore.setState({ adsRemoved: true });
    (iap.restore as jest.Mock).mockRejectedValueOnce(new Error('store'));
    await expect(purchaseStore.getState().restore()).resolves.toBe('error');
    expect(purchaseStore.getState().adsRemoved).toBe(true);
    expect(purchaseStore.getState().status).toBe('idle');
  });
});
