import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppColors, dialogShadow } from '@/constants/colors';
import { i18n } from '@/i18n';
import { Text } from '@/components/typography';
import { PrimaryButton } from '@/components/primary-button';
import { Space, Radius, Font, Weight } from '@/constants/tokens';

interface TimePickerModalProps {
  visible: boolean;
  title?: string;
  initialHour: number;
  initialMinute: number;
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
}

function toDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * 네이티브 휠(스피너) 기반 시간 선택 모달.
 * iOS: 스피너 + 취소/저장 버튼, Android: 시스템 시계 다이얼로그.
 */
export function TimePickerModal({
  visible,
  title,
  initialHour,
  initialMinute,
  onConfirm,
  onCancel,
}: TimePickerModalProps) {
  const [value, setValue] = useState(() => toDate(initialHour, initialMinute));

  // 모달이 열릴 때마다 초기값 동기화
  useEffect(() => {
    if (visible) setValue(toDate(initialHour, initialMinute));
  }, [visible, initialHour, initialMinute]);

  if (!visible) return null;

  // Android: 시스템 다이얼로그가 자체 확인/취소를 제공
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value}
        mode="time"
        display="default"
        onValueChange={(_event, date) => {
          if (date) onConfirm(date.getHours(), date.getMinutes());
        }}
        onDismiss={onCancel}
      />
    );
  }

  // iOS: 스피너를 담은 커스텀 모달
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          <DateTimePicker
            value={value}
            mode="time"
            display="spinner"
            themeVariant="light"
            textColor={AppColors.navy as unknown as string}
            onValueChange={(_e, date) => date && setValue(date)}
            style={styles.spinner}
          />
          <View style={styles.actions}>
            <PrimaryButton
              size="row"
              variant="outline"
              label={i18n.t('settingsCancel')}
              onPress={onCancel}
              style={styles.actionItem}
            />
            <PrimaryButton
              size="row"
              label={i18n.t('settingsSave')}
              onPress={() => onConfirm(value.getHours(), value.getMinutes())}
              style={styles.actionItem}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: AppColors.overlay,
    justifyContent: 'center',
    padding: Space.xxl,
  },
  container: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xxl,
    ...dialogShadow,
  },
  title: {
    fontSize: Font.h4,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    textAlign: 'center',
    marginBottom: Space.xs,
  },
  spinner: { alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: Space.md, marginTop: Space.sm },
  actionItem: { flex: 1 },
});
