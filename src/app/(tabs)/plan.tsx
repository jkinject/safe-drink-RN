import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppColors, cardShadow } from '@/constants/colors';
import { i18n } from '@/i18n';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { profileStore } from '@/state/profileStore';
import { sessionStore } from '@/state/sessionStore';
import { localeStore } from '@/state/localeStore';
import { calculate as planCalculate } from '@/core/planCalculator';
import { PlanResult } from '@/core/types';

// ── Simple time picker modal ──────────────────────────────────────────────────

interface TimePickerModalProps {
  visible: boolean;
  initialHour: number;
  initialMinute: number;
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
}

function TimePickerModal({
  visible,
  initialHour,
  initialMinute,
  onConfirm,
  onCancel,
}: TimePickerModalProps) {
  const [hour, setHour] = useState(String(initialHour).padStart(2, '0'));
  const [minute, setMinute] = useState(String(initialMinute).padStart(2, '0'));

  function confirm() {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      onConfirm(h, m);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.container}>
          <Text style={pickerStyles.title}>{i18n.t('planTargetTime')}</Text>
          <View style={pickerStyles.row}>
            <TextInput
              style={pickerStyles.input}
              value={hour}
              onChangeText={setHour}
              keyboardType="numeric"
              maxLength={2}
              placeholder="HH"
              placeholderTextColor={AppColors.sub}
            />
            <Text style={pickerStyles.colon}>:</Text>
            <TextInput
              style={pickerStyles.input}
              value={minute}
              onChangeText={setMinute}
              keyboardType="numeric"
              maxLength={2}
              placeholder="MM"
              placeholderTextColor={AppColors.sub}
            />
          </View>
          <View style={pickerStyles.actions}>
            <TouchableOpacity onPress={onCancel} style={pickerStyles.cancelBtn}>
              <Text style={pickerStyles.cancelText}>{i18n.t('settingsCancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} style={pickerStyles.confirmBtn}>
              <Text style={pickerStyles.confirmText}>{i18n.t('settingsSave')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 20,
    padding: 24,
    width: 280,
    gap: 16,
    ...cardShadow,
  },
  title: { fontSize: 16, fontWeight: '700', color: AppColors.navy, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  input: {
    width: 72,
    height: 52,
    borderWidth: 2,
    borderColor: AppColors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.navy,
  },
  colon: { fontSize: 28, fontWeight: '700', color: AppColors.navy },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cancelText: { color: AppColors.sub, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: AppColors.accent,
  },
  confirmText: { color: '#fff', fontWeight: '700' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  void locale;

  const profile = profileStore(s => s.profile);
  const records = sessionStore(s => s.records);
  const hasRecords = records.length > 0;

  const now = new Date();
  const [targetMs, setTargetMs] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(now.getHours());
  const [pickerMinute, setPickerMinute] = useState(now.getMinutes());
  const [abvText, setAbvText] = useState('');
  const [abvError, setAbvError] = useState('');
  const [result, setResult] = useState<PlanResult | null>(null);
  const [calcError, setCalcError] = useState('');

  function openPicker() {
    const d = targetMs ? new Date(targetMs) : new Date();
    setPickerHour(d.getHours());
    setPickerMinute(d.getMinutes());
    setShowPicker(true);
  }

  function handlePickerConfirm(h: number, m: number) {
    setShowPicker(false);
    const nowDate = new Date();
    let target = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
      h,
      m,
      0,
      0,
    );
    // If selected time is in the past, advance to next day
    if (target.getTime() <= Date.now()) {
      target = new Date(target.getTime() + 86400000);
    }
    setTargetMs(target.getTime());
    setResult(null);
    setCalcError('');
  }

  function formatTarget(): string {
    if (!targetMs) return i18n.t('planSelectTime');
    const d = new Date(targetMs);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function handleCalculate() {
    setAbvError('');
    setCalcError('');
    setResult(null);

    if (!profile) return;

    const abv = parseFloat(abvText);
    if (isNaN(abv) || abv <= 0 || abv > 100) {
      setAbvError(i18n.t('planAbvError'));
      return;
    }
    if (!targetMs) {
      setCalcError(i18n.t('planSelectTime'));
      return;
    }

    try {
      const res = planCalculate({
        targetTime: targetMs,
        nowMs: Date.now(),
        abvPercent: abv,
        profile,
      });
      setResult(res);
    } catch (e: unknown) {
      setCalcError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <Text style={styles.appTitle}>{i18n.t('planTitle')}</Text>
        <TouchableOpacity
          onPress={() => router.push('/info')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.infoIcon}>ℹ️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Has records warning */}
        {hasRecords && (
          <View style={styles.warningBanner}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={styles.warningText}>{i18n.t('planHasRecordsWarning')}</Text>
          </View>
        )}

        {/* Input card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{i18n.t('planTargetTime')}</Text>
          <TouchableOpacity style={styles.timeBtn} onPress={openPicker} activeOpacity={0.8}>
            <Text style={styles.timeBtnIcon}>🕐</Text>
            <Text style={[styles.timeBtnText, !targetMs && { color: AppColors.sub }]}>
              {formatTarget()}
            </Text>
          </TouchableOpacity>

          <View style={styles.fieldGap} />
          <FloatingLabelInput
            label={i18n.t('planAbvLabel')}
            value={abvText}
            onChangeText={v => { setAbvText(v); setAbvError(''); }}
            keyboardType="numeric"
            error={abvError || null}
          />

          <View style={styles.fieldGap} />
          <TouchableOpacity
            style={[styles.calcBtn, !profile && styles.calcBtnDisabled]}
            onPress={handleCalculate}
            disabled={!profile}
            activeOpacity={0.8}
          >
            <Text style={styles.calcBtnText}>{i18n.t('planCalculate')}</Text>
          </TouchableOpacity>
        </View>

        {/* Error message */}
        {calcError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorCardText}>{calcError}</Text>
          </View>
        ) : null}

        {/* Result card */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>{i18n.t('planMaxVolume')}</Text>
            <Text style={styles.resultValue}>
              {i18n.t('planMaxVolumeValue', { ml: result.maxVolumeMl.toFixed(0) })}
            </Text>
            <Text style={styles.resultSub}>
              {i18n.t('planAlcoholGrams', { g: result.maxAlcoholGrams.toFixed(1) })}
            </Text>
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      <TimePickerModal
        visible={showPicker}
        initialHour={pickerHour}
        initialMinute={pickerMinute}
        onConfirm={handlePickerConfirm}
        onCancel={() => setShowPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  appTitle: { fontSize: 20, fontWeight: '800', color: AppColors.navy, letterSpacing: -0.3 },
  infoIcon: { fontSize: 22 },
  scrollContent: { padding: 20, gap: 16 },
  warningBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFE08A',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: { flex: 1, fontSize: 13, color: '#7A6000', lineHeight: 18 },
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 20,
    padding: 20,
    ...cardShadow,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: AppColors.navy, marginBottom: 8 },
  fieldGap: { height: 16 },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AppColors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeBtnIcon: { fontSize: 18 },
  timeBtnText: { fontSize: 15, fontWeight: '600', color: AppColors.navy },
  textInput: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: AppColors.navy,
    fontWeight: '500',
  },
  textInputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: 11, color: '#FF3B30', marginTop: 4 },
  calcBtn: {
    backgroundColor: AppColors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  calcBtnDisabled: { opacity: 0.5 },
  calcBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorCard: {
    backgroundColor: '#FFF0EF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFBCB8',
    padding: 14,
  },
  errorCardText: { fontSize: 13, color: '#CC2020', textAlign: 'center' },
  resultCard: {
    backgroundColor: AppColors.accent,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 6,
    gap: 4,
  },
  resultLabel: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  resultValue: { fontSize: 36, fontWeight: '800', color: '#fff' },
  resultSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
});
