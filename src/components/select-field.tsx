import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { Text } from '@/components/typography';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  /** 시트 상단에 뜨는 제목 */
  title: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}

/**
 * 값 하나를 고르는 선택 필드.
 *
 * 선택지를 카드에 전부 나열하면 항목이 늘어날수록 설정 화면이 계속 길어진다.
 * 평소에는 현재 값 한 줄만 보여주고, 누르면 시트에서 고르게 한다.
 *
 * 시트를 쓰는 이유: RN 에는 웹의 <select> 같은 기본 위젯이 없고,
 * Picker 계열은 iOS/Android 생김새가 크게 달라 이 앱의 카드 디자인과 겉돈다.
 */
export function SelectField<T extends string>({
  title,
  value,
  options,
  onChange,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find(o => o.value === value);

  return (
    <>
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current?.label ?? ''}`}
      >
        <Text style={styles.fieldValue}>{current?.label ?? ''}</Text>
        <Icon
          name="chevronDown"
          size={IconSize.sm}
          color={AppColors.sub}
          strokeWidth={2.2}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        {/* 바깥을 누르면 닫힌다 — 시트 안쪽 탭은 여기까지 올라오지 않는다 */}
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Space.xl + insets.bottom }]}
            // 시트를 눌렀을 때 오버레이의 닫기가 실행되지 않도록 흡수만 한다
            onPress={() => {}}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            {options.map(option => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
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
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    backgroundColor: AppColors.bg,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  fieldValue: { fontSize: Font.body, color: AppColors.navy, fontWeight: Weight.semibold },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: AppColors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Space.md,
    paddingHorizontal: Space.xl,
    gap: Space.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.border,
    marginBottom: Space.lg,
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
    backgroundColor: '#EAE8FF',
    borderWidth: 1,
    borderColor: AppColors.accent,
  },
  optionLabel: { fontSize: Font.body, color: AppColors.navy },
  optionLabelSelected: { color: AppColors.accent, fontWeight: Weight.bold },
});
