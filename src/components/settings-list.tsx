import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { AppColors } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { Text } from '@/components/typography';
import { Font, IconSize, Space, Weight } from '@/constants/tokens';

/**
 * 설정 화면용 그룹 리스트.
 *
 * 항목마다 흰 카드를 두면 "빠른 선택 기본 프리셋 복원" 처럼 카드 제목과 버튼
 * 라벨이 같은 말을 두 번 하게 되고, 카드 껍데기·아이콘 원이 세로 공간을 먹는다.
 * 섹션 제목 + 행 목록으로 평평하게 편다.
 */

const DANGER = '#FF3B30';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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
  toggle,
  last,
}: RowProps) {
  const body = (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>

      {!!value && <Text style={styles.value}>{value}</Text>}

      {!!toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ false: AppColors.border, true: AppColors.accent }}
          thumbColor="#fff"
        />
      )}

      {chevron && (
        <Icon
          name="chevronRight"
          size={IconSize.sm}
          color={danger ? DANGER : AppColors.sub}
          strokeWidth={2.2}
        />
      )}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
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
  sectionTitle: {
    fontSize: Font.caption,
    fontWeight: Weight.bold,
    color: AppColors.sub,
    marginBottom: Space.xs,
    marginLeft: Space.xs,
  },
  rows: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 16,
    paddingHorizontal: Space.lg,
    overflow: 'hidden',
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
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: Font.body, color: AppColors.navy, fontWeight: Weight.semibold },
  labelDanger: { color: DANGER },
  description: { fontSize: Font.caption, color: AppColors.sub, lineHeight: 18 },
  // 값은 라벨보다 한 톤 약하게 — 레퍼런스처럼 "라벨 좌 / 값 우"
  value: { fontSize: Font.body, color: AppColors.sub },
  pressed: { opacity: 0.55 },
});
