import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { captureRef } from 'react-native-view-shot';
import { SessionShareCard, SHARE_CARD_WIDTH } from '@/components/session-share-card';
import { AppColors } from '@/constants/colors';
import { Space } from '@/constants/tokens';
import type { DrinkRecord, DrinkSession, UserProfile } from '@/core/types';

/**
 * 공유 이미지를 만들기 위해 카드를 화면 밖에 잠깐 그려 두고 찍는 자리.
 * 루트 레이아웃에 한 번만 놓는다 (DialogHost 와 같은 방식).
 *
 * 왜 화면 밖에 그리나: view-shot 은 실제 레이아웃된 뷰만 찍을 수 있다. opacity 0 은
 * Android 에서 투명 이미지가 나올 수 있어, 위치만 화면 밖(-10000)으로 보낸다.
 */

interface ShareRequest {
  session: DrinkSession;
  records: DrinkRecord[];
  profile: UserProfile;
  locale: string;
  resolve: (uri: string) => void;
  reject: (e: unknown) => void;
}

interface ShareCardState {
  request: ShareRequest | null;
  capture: (req: Omit<ShareRequest, 'resolve' | 'reject'>) => Promise<string>;
  clear: () => void;
}

export const shareCardStore = create<ShareCardState>((set) => ({
  request: null,
  capture: (req) =>
    new Promise<string>((resolve, reject) => {
      set({ request: { ...req, resolve, reject } });
    }),
  clear: () => set({ request: null }),
}));

/** 그래프(SVG)·이미지가 그려질 시간을 준 뒤 찍는다 */
const SETTLE_MS = 350;

export function ShareCardHost() {
  const request = shareCardStore(s => s.request);
  const clear = shareCardStore(s => s.clear);
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!request) return;
    const timer = setTimeout(() => {
      captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' })
        .then(uri => request.resolve(uri))
        .catch(e => request.reject(e))
        .finally(clear);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [request, clear]);

  if (!request) return null;
  return (
    <View style={styles.offscreen} pointerEvents="none">
      {/* 카드 뒤에 앱 배경색을 깔아 모서리 밖이 투명하지 않게 한다 */}
      <View ref={ref} collapsable={false} style={styles.frame}>
        <SessionShareCard
          session={request.session}
          records={request.records}
          profile={request.profile}
          locale={request.locale}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -10000, top: 0 },
  frame: { backgroundColor: AppColors.bg, padding: Space.lg, width: SHARE_CARD_WIDTH + Space.lg * 2 },
});
