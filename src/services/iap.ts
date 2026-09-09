import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Product,
  type Purchase,
} from 'expo-iap';
import type { PurchaseError } from 'expo-iap/build/utils/errorMapping';
import { REMOVE_ADS_PRODUCT_ID } from '@/config/iap';

/**
 * expo-iap 래퍼. 스토어 연결·상품 조회·구매·복원을 "광고 제거" 하나에 맞춰 단순화한다.
 *
 * 구매 결과는 requestPurchase 의 반환값이 아니라 purchaseUpdatedListener 로 온다.
 * 앱 밖에서 끝난 결제(승인 대기 후 완료, 재설치 후 미완료 트랜잭션 재생 등)도
 * 같은 리스너로 들어오므로, 리스너는 앱이 살아 있는 동안 계속 붙여 둔다.
 */

let connected = false;

/** 스토어 연결. 여러 번 불러도 한 번만 연결한다. */
export async function connect(): Promise<void> {
  if (connected) return;
  await initConnection();
  connected = true;
}

/** "광고 제거" 상품 정보 (가격 표시용). 스토어에 없으면 null. */
export async function fetchRemoveAdsProduct(): Promise<Product | null> {
  const products = await fetchProducts({ skus: [REMOVE_ADS_PRODUCT_ID], type: 'in-app' });
  return (products as Product[]).find(p => p.id === REMOVE_ADS_PRODUCT_ID) ?? null;
}

function isRemoveAds(purchase: Purchase): boolean {
  return (
    purchase.productId === REMOVE_ADS_PRODUCT_ID ||
    (purchase.ids?.includes(REMOVE_ADS_PRODUCT_ID) ?? false)
  );
}

/**
 * 구매를 마무리한다. Android 는 3일 안에 acknowledge 하지 않으면 자동 환불되고,
 * iOS 는 finish 하지 않은 트랜잭션이 앱을 켤 때마다 다시 재생된다.
 */
async function finishRemoveAds(purchase: Purchase): Promise<void> {
  await finishTransaction({ purchase, isConsumable: false });
}

/**
 * 스토어가 보유 중이라고 알려주는 "광고 제거" 구매가 있는지.
 * Android 에서 아직 acknowledge 안 된 것이 있으면 여기서 마무리한다.
 */
export async function checkOwnership(): Promise<boolean> {
  const purchases = await getAvailablePurchases();
  const owned = purchases.filter(p => isRemoveAds(p) && p.purchaseState !== 'pending');
  await Promise.all(
    owned
      .filter(p => 'isAcknowledgedAndroid' in p && p.isAcknowledgedAndroid === false)
      .map(p => finishRemoveAds(p).catch(() => undefined)),
  );
  return owned.length > 0;
}

/** 구매 시트를 띄운다. 결과는 subscribe 로 받는다. */
export async function purchaseRemoveAds(): Promise<void> {
  await requestPurchase({
    request: {
      apple: { sku: REMOVE_ADS_PRODUCT_ID },
      google: { skus: [REMOVE_ADS_PRODUCT_ID] },
    },
    type: 'in-app',
  });
}

/** 구매 복원. iOS 는 스토어와 동기화, Android 는 보유 목록 재조회. */
export async function restore(): Promise<boolean> {
  await restorePurchases();
  return checkOwnership();
}

export function isUserCancelled(error: PurchaseError): boolean {
  return error.code === ErrorCode.UserCancelled;
}

/**
 * 구매 이벤트 구독. "광고 제거" 가 완료되면 트랜잭션을 마무리하고 onOwned 를 부른다.
 * 다른 상품·대기 중 상태는 무시한다.
 */
export function subscribe(handlers: {
  onOwned: () => void;
  onError: (error: PurchaseError) => void;
}): () => void {
  const updated = purchaseUpdatedListener(purchase => {
    if (!isRemoveAds(purchase) || purchase.purchaseState === 'pending') return;
    finishRemoveAds(purchase)
      .catch(() => undefined)
      // finish 가 실패해도 구매 자체는 됐으므로 사용자에게는 적용해 준다.
      // 다음 실행 때 checkOwnership 이 다시 마무리를 시도한다.
      .finally(() => handlers.onOwned());
  });
  const failed = purchaseErrorListener(handlers.onError);
  return () => {
    updated.remove();
    failed.remove();
  };
}
