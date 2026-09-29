/**
 * 백업 로그인 제공자 버튼 묶음 — 설정 백업 섹션·온보딩 복원 카드에서 같이 쓴다.
 *
 * - iOS + Apple 로그인 가능: [Apple] 위, [Google] 아래 (Space.sm 간격)
 * - Android, 또는 Apple 을 쓸 수 없는 iOS: [Google] 하나
 *
 * App Store 심사 4.8 / Apple HIG: Apple 버튼은 다른 제공자 버튼보다 작거나 덜 눈에 띄면 안 된다 —
 * 두 버튼 모두 부모 폭을 꽉 채우고 높이 SIGN_IN_BUTTON_HEIGHT(iOS 44 / Android 48) 로 같다. Apple 가능 여부를 확인하는 동안(첫 렌더 한 틱)은
 * Google 만 보이다가 Apple 이 위에 붙는다.
 *
 * 한 제공자를 누르면 끝날 때까지(onSignIn 이 돌려준 Promise) 그 버튼에만 스피너, 다른 버튼은 비활성.
 */
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Space } from '@/constants/tokens';
import type { AuthProvider } from '@/services/auth';
import { AppleSignInButton, useAppleSignInAvailable } from '@/components/apple-signin-button';
import { GoogleSignInButton } from '@/components/google-signin-button';
import { i18n } from '@/i18n';

interface Props {
  /** 로그인·조회·결정 대기 등 진행 중. 누른 제공자(없으면 첫 버튼)에 스피너 */
  loading?: boolean;
  /** 백업 동작 중 등 — 두 버튼 모두 비활성 */
  disabled?: boolean;
  /** Promise 를 돌려주면 끝날 때까지 중복 탭을 막는다 */
  onSignIn: (provider: AuthProvider) => void | Promise<unknown>;
}

export function ProviderSignInButtons({ loading, disabled, onSignIn }: Props) {
  const appleAvailable = useAppleSignInAvailable() === true;
  const [pending, setPending] = useState<AuthProvider | null>(null);
  const pendingRef = useRef<AuthProvider | null>(null);

  function press(provider: AuthProvider) {
    if (pendingRef.current || loading || disabled) return;
    const result = onSignIn(provider);
    if (result && typeof (result as Promise<unknown>).finally === 'function') {
      pendingRef.current = provider;
      setPending(provider);
      void (result as Promise<unknown>).finally(() => {
        pendingRef.current = null;
        setPending(null);
      });
    }
  }

  // 스피너를 그릴 버튼 — 방금 누른 쪽. 바깥 사정으로 loading 인 경우(누른 기록 없음)는 맨 위 버튼
  const busy = !!loading || pending != null;
  const spinning: AuthProvider | null = !busy
    ? null
    : (pending ?? (appleAvailable ? 'apple' : 'google'));

  return (
    <View style={styles.stack}>
      {appleAvailable && (
        <AppleSignInButton
          loading={spinning === 'apple'}
          disabled={!!disabled || (busy && spinning !== 'apple')}
          onPress={() => press('apple')}
        />
      )}
      <GoogleSignInButton
        label={i18n.t('googleContinue')}
        loading={spinning === 'google'}
        disabled={!!disabled || (busy && spinning !== 'google')}
        onPress={() => press('google')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignSelf: 'stretch', gap: Space.sm },
});
