import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { Text } from '@/components/typography';
import { SheetHandle } from '@/components/sheet-handle';
import { Font, Radius, Space, Weight } from '@/constants/tokens';

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface SheetProps<T extends string> {
  /** 시트 상단에 뜨는 제목 */
  title: string;
  visible: boolean;
  onClose: () => void;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}

/**
 * 선택지 시트만 따로 쓰고 싶을 때 (설정 목록의 행처럼 트리거를 직접 그리는 경우).
 */
export function SelectSheet<T extends string>({
  title,
  visible,
  onClose,
  value,
  options,
  onChange,
}: SheetProps<T>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* 바깥을 누르면 닫힌다 — 시트 안쪽 탭은 여기까지 올라오지 않는다 */}
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Space.xl + insets.bottom }]}
          // 시트를 눌렀을 때 오버레이의 닫기가 실행되지 않도록 흡수만 한다
          onPress={() => {}}
        >
          <SheetHandle />
          <Text style={styles.sheetTitle}>{title}</Text>
          {options.map(option => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => {
                  onChange(option.value);
                  onClose();
                }}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
                {selected && (
                  <Icon name="check" size={16} color={AppColors.accent} strokeWidth={2.4} />
                )}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: AppColors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: AppColors.cardBg,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingTop: Space.md,
    paddingHorizontal: Space.xl,
    gap: Space.xs,
  },
  sheetTitle: {
    fontSize: Font.h4,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    marginBottom: Space.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    backgroundColor: AppColors.bg,
  },
  optionSelected: {
    backgroundColor: AppColors.selectedBg,
    borderWidth: 1,
    borderColor: AppColors.accent,
  },
  optionLabel: { fontSize: Font.body, color: AppColors.navy },
  optionLabelSelected: { color: AppColors.accent, fontWeight: Weight.bold },
});
