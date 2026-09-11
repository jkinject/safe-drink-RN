import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { captureRef } from 'react-native-view-shot';
import { File, Paths } from 'expo-file-system';
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

/**
 * view-shot 은 UUID 파일명으로 저장하고 iOS 는 fileName 옵션을 무시한다.
 * 공유 시트에 "safedrink-20260911.png" 처럼 보이도록 캐시로 옮겨 이름을 바꾼다.
 * 옮기기에 실패하면 원래 파일로 공유한다 — 파일명은 부가 정보일 뿐이다.
 */
async function nameShareFile(uri: string, startedAt: number): Promise<string> {
  try {
    const d = new Date(startedAt);
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const dest = new File(Paths.cache, `safedrink-${stamp}.png`);
    await new File(uri).move(dest, { overwrite: true });
    return dest.uri;
  } catch {
    return uri;
  }
}

/** 이미지가 전부 로드됐다는 신호 뒤에도 SVG 그래프가 그려질 한 프레임 여유 */
const SETTLE_MS = 120;
/** onLoad 가 끝내 안 오더라도(드문 디코딩 실패) 이 시간 뒤엔 그냥 찍는다 */
const MAX_WAIT_MS = 2500;

export function ShareCardHost() {
  const request = shareCardStore(s => s.request);
  const clear = shareCardStore(s => s.clear);
  const ref = useRef<View>(null);

  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  // 요청이 바뀌면 준비 상태부터 초기화
  useEffect(() => {
    setReady(false);
  }, [request]);

  // 이미지가 다 로드되면(ready) 바로, 아니면 MAX_WAIT_MS 뒤에 찍는다
  useEffect(() => {
    if (!request) return;
    const delay = ready ? SETTLE_MS : MAX_WAIT_MS;
    const timer = setTimeout(() => {
      captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' })
        .then(uri => nameShareFile(uri, request.session.startedAt))
        .then(uri => request.resolve(uri))
        .catch(e => request.reject(e))
        .finally(clear);
    }, delay);
    return () => clearTimeout(timer);
  }, [request, ready, clear]);

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
          onReady={handleReady}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -10000, top: 0 },
  frame: { backgroundColor: AppColors.bg, padding: Space.lg, width: SHARE_CARD_WIDTH + Space.lg * 2 },
});
