import { create } from 'zustand';

interface AdState {
  /**
   * 탭바 위 배너가 실제로 차지하는 높이(pt). 광고가 로드되기 전·실패 시 0.
   * 탭 화면들은 탭바 높이에 이 값을 더해 하단 여백·FAB 위치를 잡는다.
   */
  bottomBannerHeight: number;
  setBottomBannerHeight: (height: number) => void;
}

export const adStore = create<AdState>((set) => ({
  bottomBannerHeight: 0,
  setBottomBannerHeight: (height) => set({ bottomBannerHeight: height }),
}));

/** 탭 화면에서 하단 여백 계산용 */
export const useBottomBannerHeight = () => adStore((s) => s.bottomBannerHeight);
