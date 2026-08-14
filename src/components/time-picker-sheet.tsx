import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppColors, cardShadow } from '@/constants/colors';
import { i18n } from '@/i18n';
import { Text } from '@/components/typography';

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
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{i18n.t('settingsCancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(value.getHours(), value.getMinutes())}
              style={styles.confirmBtn}
            >
              <Text style={styles.confirmText}>{i18n.t('settingsSave')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '82%',
    backgroundColor: AppColors.cardBg,
    borderRadius: 20,
    padding: 20,
    ...cardShadow,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.navy,
    textAlign: 'center',
    marginBottom: 4,
  },
  spinner: { alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: AppColors.sub, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: AppColors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '700' },
});
