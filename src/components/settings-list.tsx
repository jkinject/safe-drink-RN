import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { AppColors, StatusColors, cardShadowSm } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { Text } from '@/components/typography';
import { SectionTitle } from '@/components/section-title';
import { Font, IconSize, LineHeight, Radius, Space, Weight } from '@/constants/tokens';

/**
 * 설정 화면용 그룹 리스트.
 *
 * 항목마다 흰 카드를 두면 "빠른 선택 기본 프리셋 복원" 처럼 카드 제목과 버튼
 * 라벨이 같은 말을 두 번 하게 되고, 카드 껍데기·아이콘 원이 세로 공간을 먹는다.
 * 섹션 제목 + 행 목록으로 평평하게 편다.
 */


interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

interface RowProps {
  label: string;
  /** 우측에 표시할 값 (읽기 전용 행) */
  value?: string;
  /** 라벨 아래 회색 설명 — 토글 행처럼 부연이 필요할 때 */
  description?: string;
  onPress?: () => void;
  /** 눌러서 다음 화면으로 가는 행에만 붙인다 */
  chevron?: boolean;
  /** 기록 삭제처럼 되돌릴 수 없는 동작 */
  danger?: boolean;
  /** "지금 백업" 처럼 섹션의 주 동작 — 라벨만 accent 색 */
  accent?: boolean;
  /** 진행 중이라 지금은 누를 수 없는 행 — 옅게 그리고 터치를 막는다 */
  disabled?: boolean;
  /** 우측에 스위치를 두는 행 */
  toggle?: { value: boolean; onValueChange: (v: boolean) => void };
  /** 섹션의 마지막 행은 구분선을 그리지 않는다 */
  last?: boolean;
}

export function SettingsRow({
  label,
  value,
  description,
  onPress,
  chevron,
  danger,
  accent,
  disabled,
  toggle,
  last,
}: RowProps) {
  const body = (
    <View style={[styles.row, last && styles.rowLast, disabled && styles.disabled]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, accent && styles.labelAccent, danger && styles.labelDanger]}>
          {label}
        </Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>

      {!!value && <Text style={styles.value}>{value}</Text>}

      {!!toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ false: AppColors.border, true: AppColors.accent }}
          thumbColor={AppColors.white}
        />
      )}

      {chevron && (
        <Icon
          name="chevronRight"
          size={IconSize.sm}
          color={danger ? StatusColors.danger : AppColors.sub}
          strokeWidth={2.2}
        />
      )}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={disabled ? { disabled: true } : undefined}
      // 눌린 동안만 옅게 — 리스트에서 어느 행을 눌렀는지 보이게 한다
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      accessibilityRole="button"
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Space.xl },
  // 다른 화면의 섹션 카드와 같은 규칙(Radius.xl + cardShadowSm).
  // overflow: 'hidden' 은 iOS 에서 그림자를 잘라 버려 빼고, 행 배경은 투명이라 모서리 밖으로 새지 않는다
  rows: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    paddingHorizontal: Space.lg,
    ...cardShadowSm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    minHeight: 56,
    paddingVertical: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, gap: Space.xxs },
  label: { fontSize: Font.body, color: AppColors.navy, fontWeight: Weight.semibold },
  labelAccent: { color: AppColors.accent },
  labelDanger: { color: StatusColors.danger },
  description: { fontSize: Font.caption, color: AppColors.sub, lineHeight: LineHeight.caption },
  // 값은 라벨보다 한 톤 약하게 — 레퍼런스처럼 "라벨 좌 / 값 우"
  value: { fontSize: Font.body, color: AppColors.sub },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.5 },
});
