import { ActivityIndicator, StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { AppColors, StatusColors } from '@/constants/colors';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

/**
 * 앱 공통 버튼 — 화면에서 버튼 스타일을 직접 만들지 말고 이걸 쓴다.
 * 예외는 Google·Apple 로그인 버튼뿐이다(각 사의 브랜딩 가이드가 모양을 정한다).
 *
 * size
 *  - `cta`(기본): 화면·카드의 주 동작. 전체 폭, 최소 높이 48, h4 bold.
 *  - `row`: 다이얼로그·시트 안에서 나란히 놓는 줄 버튼. body bold.
 *    나란히 둘 때는 `style={{ flex: 1 }}` 로 나눈다.
 *
 * variant
 *  - `filled`: accent 채움 + 흰 글자 (확인·저장)
 *  - `outline`: 흰 바탕 + 진한 연보라 테두리 + 네이비 글자 (취소·보조 동작)
 *  - `danger`: 빨강 채움 + 흰 글자 (삭제처럼 되돌릴 수 없는 확인)
 *
 * loading 중에는 라벨 자리에 스피너를 두고 탭을 막는다(중복 저장 방지).
 */

type Variant = 'filled' | 'outline' | 'danger';
type Size = 'cta' | 'row';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  /** 라벨 앞 아이콘 */
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'filled',
  size = 'cta',
  loading = false,
  disabled = false,
  icon,
  style,
  accessibilityLabel,
}: PrimaryButtonProps) {
  const fg = variant === 'outline' ? AppColors.navy : AppColors.white;
  const spinnerColor = variant === 'outline' ? AppColors.accent : AppColors.white;
  const blocked = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        size === 'cta' ? styles.cta : styles.row,
        variantStyles[variant],
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={blocked}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : (
        <>
          {!!icon && <Icon name={icon} size={IconSize.md} color={fg} strokeWidth={2} />}
          <Text style={[size === 'cta' ? styles.ctaText : styles.rowText, { color: fg }]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    borderRadius: Radius.md,
  },
  // 부모가 alignItems: 'center' 여도 전체 폭을 차지하게 stretch 를 명시한다
  cta: { alignSelf: 'stretch', minHeight: 48, paddingHorizontal: Space.lg },
  row: { paddingVertical: Space.md, paddingHorizontal: Space.md },
  ctaText: { fontSize: Font.h4, fontWeight: Weight.bold },
  rowText: { fontSize: Font.body, fontWeight: Weight.bold },
  disabled: { opacity: 0.5 },
});

const variantStyles = StyleSheet.create({
  filled: { backgroundColor: AppColors.accent },
  outline: {
    backgroundColor: AppColors.cardBg,
    borderWidth: 1,
    borderColor: AppColors.borderStrong,
  },
  danger: { backgroundColor: StatusColors.danger },
});
