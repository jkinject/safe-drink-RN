/**
 * "Apple로 로그인" 표준 버튼 — iOS 백업 연동(설정 백업 섹션·온보딩 복원 카드)에서 Google 버튼과 나란히 쓴다.
 *
 * ⚠️ 브랜딩 예외: 이 버튼은 expo-apple-authentication 의 네이티브 `ASAuthorizationAppleIDButton` 을
 * 그대로 쓴다. Apple HIG(Sign in with Apple)가 승인된 문구·로고·색·비율을 강제하므로 앱 토큰으로
 * 색·글꼴·문구를 바꾸지 않는다(검은 BLACK 스타일 + 시스템 현지화 문구 "Apple로 로그인").
 * 앱 규칙에서 가져오는 것은 모서리(Radius.md)와 높이(SIGN_IN_BUTTON_HEIGHT — 44, Google 버튼과 같은 높이)뿐이다.
 * `style` 로 backgroundColor·borderRadius 를 주면 심사 가이드 위반이라 넣지 않는다.
 *
 * Android 이거나 이 기기에서 Apple 로그인을 쓸 수 없으면(iOS 13 미만 등) 아무것도 그리지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AppColors } from '@/constants/colors';
import { Radius, Space } from '@/constants/tokens';
import { apple } from '@/services/auth';
import { i18n } from '@/i18n';

/**
 * 로그인 버튼 높이 — Apple·Google 버튼이 같이 쓴다(HIG: 다른 제공자 버튼보다 작게 만들지 않는다).
 * Apple HIG 기본 44pt — 네이티브 버튼은 높이에 비례해 시스템 라벨을 키우므로 48 이면 글자가 커 보인다
 * (44 에서 라벨 ≈ 18.9pt). 플랫폼별 예외 없이 동일 UI 로 가기로 해 Android(Google 버튼)도 44 로 맞춘다.
 */
export const SIGN_IN_BUTTON_HEIGHT = 44;

/**
 * isAvailable() 결과는 기기가 바뀌지 않는 한 그대로라 앱 수명 동안 한 번만 묻는다.
 * Android 는 네이티브 호출 없이 바로 false.
 */
let availability: Promise<boolean> | null = null;
function queryAvailability(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  availability ??= apple.isAvailable().catch(() => false);
  return availability;
}

/**
 * 이 기기에서 Apple 로그인 버튼을 보여 줄 수 있는지.
 * 확인 전(null)에는 버튼을 그리지 않는다 — false 로 확정되면 Google 버튼만 남는다.
 */
export function useAppleSignInAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(
    Platform.OS === 'ios' ? null : false,
  );
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void queryAvailability().then(ok => {
      if (alive) setAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

interface Props {
  /** 로그인·조회 진행 중 — 버튼 위에 스피너를 겹치고 터치를 막는다 */
  loading?: boolean;
  /** 다른 제공자가 진행 중이거나 백업 동작 중 — 옅게 + 터치 막음 */
  disabled?: boolean;
  /** Promise 를 돌려주면 끝날 때까지 중복 탭을 막는다 */
  onPress: () => void | Promise<unknown>;
}

export function AppleSignInButton({ loading, disabled, onPress }: Props) {
  const available = useAppleSignInAvailable();
  const inactive = !!loading || !!disabled;

  // 네이티브 버튼은 disabled prop 이 없다. 부모의 loading 이 다시 그려지기 전의 빠른 연타도 막도록
  // onPress 가 돌려준 Promise 가 끝날 때까지 다음 탭을 버린다.
  const firedRef = useRef(false);

  if (!available) return null;

  function handlePress() {
    if (inactive || firedRef.current) return;
    const result = onPress();
    if (result && typeof (result as Promise<unknown>).finally === 'function') {
      firedRef.current = true;
      void (result as Promise<unknown>).finally(() => {
        firedRef.current = false;
      });
    }
  }

  return (
    <View
      style={[styles.wrap, disabled && !loading && styles.disabled]}
      // 네이티브 버튼 자체의 접근성 라벨은 시스템 문구 — 여기선 상태만 알린다
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      // 진행·비활성 중에는 네이티브 버튼까지 터치가 내려가지 않게 한다
      pointerEvents={inactive ? 'none' : 'auto'}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={Radius.md}
        style={styles.button}
        onPress={handlePress}
        accessibilityLabel={i18n.t('appleContinue')}
      />
      {loading && (
        // 버튼 색을 덮지 않는다(반투명 흰 막 금지) — 오른쪽 끝에 스피너만 겹친다.
        // 검은 버튼 위라 흰 스피너. 가운데 로고·문구와 겹치지 않는 자리.
        <View style={styles.spinnerSlot} pointerEvents="none">
          <ActivityIndicator size="small" color={AppColors.white} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  // 폭은 부모를 꽉 채운다 — Google 버튼(alignSelf stretch)과 같은 폭
  button: { width: '100%', height: SIGN_IN_BUTTON_HEIGHT },
  spinnerSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: Space.lg,
    justifyContent: 'center',
  },
  // Google 버튼의 disabled 와 같은 값
  disabled: { opacity: 0.5 },
});
