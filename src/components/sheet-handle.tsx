import { StyleSheet, View } from 'react-native';
import { AppColors } from '@/constants/colors';
import { Radius, Space } from '@/constants/tokens';

/** 바텀시트 맨 위 손잡이 (40×4). 시트마다 따로 그리던 것을 하나로 모았다 */
export function SheetHandle() {
  return <View style={styles.handle} />;
}

const styles = StyleSheet.create({
  handle: {
    alignSelf: 'center',
    width: Space.xxxl + Space.sm,
    height: Space.xs,
    borderRadius: Radius.xxs,
    backgroundColor: AppColors.border,
    marginBottom: Space.lg,
  },
});
