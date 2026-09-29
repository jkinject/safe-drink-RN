/**
 * "Google 계정으로 계속하기" 표준 버튼 — 설정 백업 섹션·온보딩 복원 영역에서 같이 쓴다.
 *
 * ⚠️ 이 파일의 G 로고 4색(#4285F4·#34A853·#FBBC05·#EA4335)은 앱 팔레트 규칙("화면에 hex
 * 리터럴 금지")의 유일한 예외다. Google 브랜딩 가이드라인
 * (https://developers.google.com/identity/branding-guidelines)이 공식 다색 G 를 그대로
 * 쓰고 재색칠하지 말라고 요구하므로 토큰으로 옮기지 않고 여기에만 둔다. 버튼 바탕·테두리·
 * 글자는 가이드의 "중립 흰 버튼" 규칙 안에서 앱 토큰(white/border/navy)을 쓴다.
 * 로고 크기(LOGO_SIZE 18) 도 같은 브랜딩 예외다 — 가이드의 로고 비율을 따르므로 IconSize 토큰을 쓰지 않는다.
 */
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppColors } from '@/constants/colors';
import { Text } from '@/components/typography';
import { Font, Radius, Space, Weight } from '@/constants/tokens';
import { SIGN_IN_BUTTON_HEIGHT } from '@/components/apple-signin-button';
import { i18n } from '@/i18n';

/** 로고 한 변(px) — 라벨(Font.h4) 과 눈높이를 맞춘 크기 */
const LOGO_SIZE = 18;

/** Google 공식 G 마크 (48×48 기준 경로, 가이드 배포 SVG 그대로) */
function GoogleLogo({ size = LOGO_SIZE }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

interface Props {
  /** 기본값 t('googleContinue') */
  label?: string;
  /** 로그인·조회 진행 중 — 로고 자리에 스피너, 터치 무시 */
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function GoogleSignInButton({ label, loading, disabled, onPress }: Props) {
  const text = label ?? i18n.t('googleContinue');
  const inactive = !!loading || !!disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      // settings-list 행과 같은 규칙 — 눌린 동안만 옅게
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      <View style={styles.logoSlot}>
        {loading ? (
          <ActivityIndicator size="small" color={AppColors.navy} />
        ) : (
          <GoogleLogo />
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    // Apple 버튼과 같은 높이 (iOS 44 / Android 48)
    minHeight: SIGN_IN_BUTTON_HEIGHT,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.white,
  },
  // 스피너와 로고가 바뀌어도 라벨이 흔들리지 않게 자리를 고정한다
  logoSlot: {
    width: LOGO_SIZE + Space.xs,
    height: LOGO_SIZE + Space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: Font.h4,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    flexShrink: 1,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.55 },
});
