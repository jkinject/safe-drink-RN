import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppColors, cardShadow, cardShadowSm } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { Text } from '@/components/typography';
import { i18n } from '@/i18n';
import { TimePickerModal } from '@/components/time-picker-sheet';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { profileStore } from '@/state/profileStore';
import { sessionStore } from '@/state/sessionStore';
import { localeStore } from '@/state/localeStore';
import { calculate as planCalculate } from '@/core/planCalculator';
import { PlanResult } from '@/core/types';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

// ── Simple time picker modal ──────────────────────────────────────────────────


const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xxl,
    width: 280,
    gap: Space.lg,
    ...cardShadow,
  },
  title: { fontSize: Font.h4, fontWeight: Weight.bold, color: AppColors.navy, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.sm },
  input: {
    width: 72,
    height: 52,
    borderWidth: 2,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    textAlign: 'center',
    fontSize: Font.h2,
    fontWeight: Weight.bold,
    color: AppColors.navy,
  },
  colon: { fontSize: Font.h1, fontWeight: Weight.bold, color: AppColors.navy },
  actions: { flexDirection: 'row', gap: Space.md },
  cancelBtn: {
    flex: 1,
    paddingVertical: Space.md,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cancelText: { color: AppColors.sub, fontWeight: Weight.semibold },
  confirmBtn: {
    flex: 1,
    paddingVertical: Space.md,
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: AppColors.accent,
  },
  confirmText: { color: '#fff', fontWeight: Weight.bold },
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
          <Icon name="info" size={IconSize.lg} color={AppColors.sub} strokeWidth={2} />
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
            <Icon name="warning" size={16} color="#B7791F" strokeWidth={2.1} />
            <Text style={styles.warningText}>{i18n.t('planHasRecordsWarning')}</Text>
          </View>
        )}

        {/* Input card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{i18n.t('planTargetTime')}</Text>
          <TouchableOpacity style={styles.timeBtn} onPress={openPicker} activeOpacity={0.8}>
            <Icon name="clock" size={18} color={AppColors.accent} strokeWidth={2} />
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
        title={i18n.t('planTargetTime')}
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
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    justifyContent: 'space-between',
  },
  appTitle: { fontSize: Font.h2, fontWeight: Weight.bold, color: AppColors.navy, letterSpacing: -0.3 },
  scrollContent: { padding: Space.lg, gap: Space.lg },
  warningBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: '#FFE08A',
    padding: Space.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
  },
  warningText: { flex: 1, fontSize: Font.bodySm, color: '#7A6000', lineHeight: 18 },
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xl,
    ...cardShadowSm,
  },
  fieldLabel: { fontSize: Font.body, fontWeight: Weight.semibold, color: AppColors.navy, marginBottom: Space.sm },
  fieldGap: { height: 16 },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderColor: AppColors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  timeBtnIcon: { fontSize: Font.h3 },
  timeBtnText: { fontSize: Font.body, fontWeight: Weight.semibold, color: AppColors.navy },
  textInput: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    fontSize: Font.body,
    color: AppColors.navy,
    fontWeight: Weight.regular,
  },
  textInputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: Font.micro, color: '#FF3B30', marginTop: Space.xs },
  calcBtn: {
    backgroundColor: AppColors.accent,
    borderRadius: Radius.md,
    paddingVertical: Space.lg,
    alignItems: 'center',
  },
  calcBtnDisabled: { opacity: 0.5 },
  calcBtnText: { color: '#fff', fontWeight: Weight.bold, fontSize: Font.body },
  errorCard: {
    backgroundColor: '#FFF0EF',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: '#FFBCB8',
    padding: Space.lg,
  },
  errorCardText: { fontSize: Font.bodySm, color: '#CC2020', textAlign: 'center' },
  resultCard: {
    backgroundColor: AppColors.accent,
    borderRadius: Radius.xl,
    padding: Space.xxl,
    alignItems: 'center',
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 6,
    gap: Space.xs,
  },
  resultLabel: { fontSize: Font.bodySm, fontWeight: Weight.regular, color: 'rgba(255,255,255,0.75)' },
  resultValue: { fontSize: Font.h1, fontWeight: Weight.bold, color: '#fff' },
  resultSub: { fontSize: Font.bodySm, color: 'rgba(255,255,255,0.75)' },
});
