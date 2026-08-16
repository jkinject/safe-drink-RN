import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppColors } from '@/constants/colors';
import { IconSize, Radius, Space } from '@/constants/tokens';

import { DRINK_ICON_NAMES, DrinkIcon, DrinkIconName } from './drink-icon';

/**
 * 술 아이콘 선택 그리드.
 *
 * 기록 추가 폼과 "나만의 술" 프리셋 다이얼로그가 같이 쓴다 —
 * 두 곳이 각자 그리면 선택 표시나 칸 크기가 서로 어긋난다.
 */
interface DrinkIconPickerProps {
  value: DrinkIconName;
  onChange: (name: DrinkIconName) => void;
}

export function DrinkIconPicker({ value, onChange }: DrinkIconPickerProps) {
  return (
    <View style={styles.grid}>
      {DRINK_ICON_NAMES.map(name => (
        <TouchableOpacity
          key={name}
          style={[styles.cell, value === name && styles.cellSelected]}
          onPress={() => onChange(name)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === name }}
        >
          {/* 아이콘 자체가 컬러라 선택 상태는 테두리로만 표시한다 */}
          <DrinkIcon name={name} size={IconSize.drink} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  cell: {
    width: 44,
    height: 44,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellSelected: {
    borderColor: AppColors.accent,
    backgroundColor: AppColors.bg,
  },
});
