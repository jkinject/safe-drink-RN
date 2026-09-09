import { create } from 'zustand';
import type { Product } from 'expo-iap';
import * as iap from '@/services/iap';
import * as purchaseStorage from '@/storage/purchaseStorage';

export type PurchaseStatus = 'idle' | 'purchasing' | 'restoring';

interface PurchaseState {
  /** 광고 제거 구매 여부. 캐시로 먼저 채우고 스토어 조회 결과로 덮어쓴다. */
  adsRemoved: boolean;
  /** 스토어에서 받은 상품 (가격 표시). 연결 실패·상품 미등록이면 null. */
  product: Product | null;
  /** 스토어 연결·상품 조회가 끝났는지. 끝났는데 product 가 null 이면 구매 불가 상태. */
  storeReady: boolean;
  status: PurchaseStatus;

  /** 캐시만 읽는다. 앱 시작 시 다른 설정과 함께 부른다. */
  load: () => Promise<void>;
  /**
   * 스토어에 연결해 상품과 보유 여부를 확인하고 구매 이벤트를 구독한다.
   * 네트워크가 없어도 앱은 떠야 하므로 실패는 삼킨다. 구독 해제 함수를 돌려준다.
   */
  initialize: () => Promise<() => void>;
  /** 구매 시트를 띄운다. 결과는 'owned' | 'cancelled' | 'error'. */
  purchase: () => Promise<'owned' | 'cancelled' | 'error'>;
  /** 구매 복원. 결과는 'restored' | 'nothing' | 'error'. */
  restore: () => Promise<'restored' | 'nothing' | 'error'>;
}

async function applyOwnership(set: (s: Partial<PurchaseState>) => void, owned: boolean) {
  set({ adsRemoved: owned });
  try {
    await purchaseStorage.saveAdsRemoved(owned);
  } catch {
    // 캐시 저장 실패는 다음 실행 때 스토어 조회로 복구된다
  }
}

export const purchaseStore = create<PurchaseState>((set, get) => {
  /**
   * 진행 중인 purchase() 호출이 리스너 결과를 기다리는 자리.
   * requestPurchase 는 시트만 띄우고 돌아오고, 실제 결과는 리스너로 오기 때문에
   * 둘을 여기서 이어 붙인다.
   */
  let pending: { resolve: (r: 'owned' | 'cancelled' | 'error') => void } | null = null;

  return {
    adsRemoved: false,
    product: null,
    storeReady: false,
    status: 'idle',

    load: async () => {
      try {
        set({ adsRemoved: await purchaseStorage.loadAdsRemoved() });
      } catch {
        // 읽기 실패는 기본값(광고 표시) 유지
      }
    },

    initialize: async () => {
      const unsubscribe = iap.subscribe({
        onOwned: () => {
          void applyOwnership(set, true);
          pending?.resolve('owned');
          pending = null;
        },
        onError: error => {
          pending?.resolve(iap.isUserCancelled(error) ? 'cancelled' : 'error');
          pending = null;
        },
      });
      try {
        await iap.connect();
        const [product, owned] = await Promise.all([
          iap.fetchRemoveAdsProduct().catch(() => null),
          iap.checkOwnership(),
        ]);
        // 스토어에 상품이 아직 없을 때 가격이 빈 껍데기가 오는 경우가 있다(Play, 등록 전).
        // 그대로 두면 가격 없는 행을 눌러 결제 시도 → 실패로 이어지니 "구매 불가" 로 다룬다.
        set({ product: product?.displayPrice ? product : null });
        // 스토어가 "없다" 고 하면 캐시가 true 여도 내린다 — 환불·계정 전환 대응
        if (owned !== get().adsRemoved) await applyOwnership(set, owned);
      } catch {
        // 오프라인 등. 캐시 값으로 계속 간다.
      } finally {
        set({ storeReady: true });
      }
      return unsubscribe;
    },

    purchase: async () => {
      if (get().status !== 'idle') return 'error';
      set({ status: 'purchasing' });
      try {
        const result = await new Promise<'owned' | 'cancelled' | 'error'>(resolve => {
          pending = { resolve };
          iap.purchaseRemoveAds().catch(() => {
            pending = null;
            resolve('error');
          });
        });
        return result;
      } finally {
        set({ status: 'idle' });
      }
    },

    restore: async () => {
      if (get().status !== 'idle') return 'error';
      set({ status: 'restoring' });
      try {
        const owned = await iap.restore();
        await applyOwnership(set, owned);
        return owned ? 'restored' : 'nothing';
      } catch {
        return 'error';
      } finally {
        set({ status: 'idle' });
      }
    },
  };
});

/** 배너 표시 여부 판단용 */
export const useAdsRemoved = () => purchaseStore(s => s.adsRemoved);
