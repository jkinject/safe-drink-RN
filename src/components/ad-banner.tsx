import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BannerAd } from 'react-native-google-mobile-ads';
import { BOTTOM_BANNER_SIZE, BOTTOM_BANNER_UNIT_ID } from '@/config/ads';
import { adStore } from '@/state/adStore';
import { AppColors } from '@/constants/colors';

/** 로드 실패 후 다시 시도하기까지 (ms). 너무 짧으면 무필 상태에서 요청만 쌓인다. */
const RETRY_DELAY_MS = 60_000;

/**
 * 탭바 바로 위에 붙는 하단 배너.
 *
 * 로드되기 전에는 높이 0 이라 공간을 차지하지 않고, 로드되면 실측 높이를
 * `adStore` 에 실어 탭 화면들이 하단 여백을 그만큼 늘리게 한다.
 * 실패하면 접고(0) 잠시 뒤 다시 마운트해 재요청한다 — BannerAd 는 스스로
 * 재시도하지 않는다.
 */
export function BottomAdBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const setHeight = adStore((s) => s.setBottomBannerHeight);
  // 재시도는 key 를 바꿔 BannerAd 를 새로 마운트하는 방식
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLoaded = useCallback(
    ({ height }: { height: number }) => setHeight(Math.ceil(height)),
    [setHeight],
  );

  const onFailed = useCallback(() => {
    setHeight(0);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => setAttempt((n) => n + 1), RETRY_DELAY_MS);
  }, [setHeight]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      setHeight(0);
    },
    [setHeight],
  );

  return (
    <View style={[styles.container, style]} pointerEvents="box-none">
      <BannerAd
        key={attempt}
        unitId={BOTTOM_BANNER_UNIT_ID}
        size={BOTTOM_BANNER_SIZE}
        onAdLoaded={onLoaded}
        onSizeChange={onLoaded}
        onAdFailedToLoad={onFailed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // 광고 폭이 화면보다 좁을 때(태블릿 등) 가운데로
  container: { alignItems: 'center', backgroundColor: AppColors.bg },
});
