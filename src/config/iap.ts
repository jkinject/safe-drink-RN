/**
 * 인앱결제 상품 ID.
 *
 * App Store Connect 와 Google Play Console 양쪽에 **같은 ID** 로 비소모성 상품을
 * 만들어야 한다. 스토어에 상품이 없으면 fetchProducts 가 빈 배열을 돌려주고
 * 설정 화면은 "지금은 구매할 수 없어요" 상태로 남는다.
 */
export const REMOVE_ADS_PRODUCT_ID = 'remove_ads';
