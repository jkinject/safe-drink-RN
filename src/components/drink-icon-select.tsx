import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { Text } from '@/components/typography';
import { i18n } from '@/i18n';
import { DrinkIcon, DrinkIconName } from './drink-icon';
import { DrinkIconPicker } from './drink-icon-picker';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

/**
 * 술 아이콘 선택 — 평소에는 한 줄, 누르면 시트에서 고른다.
 *
 * 아이콘 12개를 폼에 항상 펼쳐 두면 두 줄을 차지해서, 정작 자주 고치는
 * 도수·용량이 화면 아래로 밀린다. 고르는 빈도에 비해 자리를 너무 많이 썼다.
 * 그리드 자체는 DrinkIconPicker 를 그대로 재사용한다 — 프리셋 다이얼로그와
 * 선택 표시·칸 크기가 어긋나지 않게.
 */
interface Props {
  value: DrinkIconName;
  onChange: (name: DrinkIconName) => void;
}

export function DrinkIconSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('addDrinkIconLabel')}
      >
        <DrinkIcon name={value} size={IconSize.drink} />
        <View style={styles.spacer} />
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
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Space.xl + insets.bottom }]}
            onPress={() => {}}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{i18n.t('addDrinkIconLabel')}</Text>
            <DrinkIconPicker
              value={value}
              onChange={name => {
                onChange(name);
                setOpen(false);
              }}
            />
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
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    backgroundColor: AppColors.bg,
    borderWidth: 1,
    borderColor: AppColors.border,
    minHeight: 52,
  },
  spacer: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: AppColors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Space.md,
    paddingHorizontal: Space.xl,
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
    marginBottom: Space.lg,
  },
});
