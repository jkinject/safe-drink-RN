import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Sex } from '@/core/types';
import { profileStore } from '@/state/profileStore';
import { localeStore } from '@/state/localeStore';
import { i18n } from '@/i18n';
import { AppColors, cardShadow, cardShadowSm } from '@/constants/colors';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { Space, Radius, Font, Weight } from '@/constants/tokens';

interface FieldError {
  height?: string;
  weight?: string;
  birthYear?: string;
}

export default function OnboardingScreen() {
  const locale = localeStore(s => s.locale);
  const save = profileStore(s => s.save);
  const router = useRouter();

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [errors, setErrors] = useState<FieldError>({});
  const [saving, setSaving] = useState(false);

  // Keep locale subscription alive so re-render happens on locale change
  void locale;

  function validate(): boolean {
    const errs: FieldError = {};
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const by = parseInt(birthYear, 10);
    const currentYear = new Date().getFullYear();

    if (isNaN(h)) errs.height = i18n.t('settingsNumberError');
    else if (h < 100 || h > 250) errs.height = i18n.t('settingsHeightRangeError');

    if (isNaN(w)) errs.weight = i18n.t('settingsNumberError');
    else if (w < 30 || w > 300) errs.weight = i18n.t('settingsWeightRangeError');

    if (isNaN(by)) errs.birthYear = i18n.t('settingsNumberError');
    else if (by < currentYear - 100 || by > currentYear - 19)
      errs.birthYear = i18n.t('settingsBirthYearRangeError');

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await save({
        heightCm: parseFloat(height),
        weightKg: parseFloat(weight),
        sex,
        birthYear: parseInt(birthYear, 10),
      });
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Scrollable: header + tip + inputs */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.titleText}>{i18n.t('onboardingTitle')}</Text>
              <Text style={styles.subtitleText}>
                {i18n.t('onboardingWelcome')}
              </Text>
            </View>
            <Image
              source={require('../../assets/images/character/male_writing.png')}
              style={styles.headerChar}
              resizeMode="contain"
            />
          </View>

          {/* Tip bubble */}
          <View style={styles.tipRow}>
            <Image
              source={require('../../assets/images/character/mascot_water_tip.png')}
              style={styles.tipChar}
              resizeMode="contain"
            />
            <View style={styles.tipBubble}>
              <Text style={styles.tipText}>{i18n.t('onboardingTipText')}</Text>
            </View>
          </View>

          {/* Input card */}
          <View style={styles.inputCard}>
            {/* Height */}
            <FieldRow
              icon="height"
              label={i18n.t('onboardingFieldHeight')}
              hint={i18n.t('onboardingHeightHint')}
              unit={i18n.t('unitCm')}
              value={height}
              onChangeText={setHeight}
              error={errors.height}
            />
            <View style={styles.divider} />
            {/* Weight */}
            <FieldRow
              icon="weight"
              label={i18n.t('onboardingFieldWeight')}
              hint={i18n.t('onboardingWeightHint')}
              unit={i18n.t('unitKg')}
              value={weight}
              onChangeText={setWeight}
              error={errors.weight}
            />
            <View style={styles.divider} />
            {/* Birth Year */}
            <FieldRow
              icon="birthYear"
              label={i18n.t('onboardingFieldBirthYear')}
              hint={i18n.t('onboardingBirthYearHint')}
              unit={i18n.t('unitYear')}
              value={birthYear}
              onChangeText={setBirthYear}
              error={errors.birthYear}
            />
          </View>
        </ScrollView>

        {/* Fixed bottom: gender + disclaimer + save */}
        <View style={styles.bottom}>
          {/* Gender */}
          <Text style={styles.genderLabel}>{i18n.t('settingsSex')}</Text>
          <View style={styles.genderRow}>
            <GenderCard
              icon="male"
              label={i18n.t('settingsMale')}
              selected={sex === 'male'}
              onPress={() => setSex('male')}
            />
            <View style={{ width: 12 }} />
            <GenderCard
              icon="female"
              label={i18n.t('settingsFemale')}
              selected={sex === 'female'}
              onPress={() => setSex('female')}
            />
          </View>

          <DisclaimerBanner />

          <View style={styles.saveRow}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{i18n.t('onboardingSave')}</Text>
              )}
            </TouchableOpacity>
            <Image
              source={require('../../assets/images/character/mascot_water_shield.png')}
              style={styles.shieldChar}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.privacyNote}>
            {i18n.t('onboardingPrivacyNote')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldRowProps {
  icon: IconName;
  label: string;
  hint: string;
  unit: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
}

function FieldRow({ icon, label, hint, unit, value, onChangeText, error }: FieldRowProps) {
  return (
    <View style={fieldStyles.row}>
      <View style={fieldStyles.iconCircle}>
        <Icon name={icon} size={18} color={AppColors.accent} strokeWidth={2.1} />
      </View>
      <View style={fieldStyles.inputWrapper}>
        <Text style={fieldStyles.labelText}>{label}</Text>
        <View style={fieldStyles.inputRow}>
          <TextInput
            style={fieldStyles.input}
            placeholder={hint}
            placeholderTextColor={AppColors.sub}
            keyboardType="numeric"
            value={value}
            onChangeText={onChangeText}
          />
          <Text style={fieldStyles.unitText}>{unit}</Text>
        </View>
        {error ? <Text style={fieldStyles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

interface GenderCardProps {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
}

function GenderCard({ icon, label, selected, onPress }: GenderCardProps) {
  return (
    <TouchableOpacity
      style={[genderStyles.card, selected && genderStyles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Icon
        name={icon}
        size={24}
        color={selected ? AppColors.accent : AppColors.sub}
        strokeWidth={2}
      />
      <Text style={[genderStyles.label, selected && genderStyles.labelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.xxl,
    paddingBottom: Space.sm,
    gap: Space.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  titleText: {
    fontSize: Font.h1,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: Font.bodySm,
    color: AppColors.sub,
    lineHeight: 20,
    marginTop: Space.sm,
  },
  headerChar: { width: 120, height: 120, marginLeft: Space.md },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  tipChar: { width: 56, height: 56 },
  tipBubble: {
    flex: 1,
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    ...cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  tipText: {
    fontSize: Font.bodySm,
    color: AppColors.navy,
    fontWeight: Weight.regular,
    lineHeight: 18,
  },
  inputCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
    ...cardShadowSm,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
  },
  bottom: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xs,
    gap: Space.sm,
  },
  genderLabel: {
    fontSize: Font.body,
    fontWeight: Weight.semibold,
    color: AppColors.navy,
    marginBottom: Space.xs,
  },
  genderRow: { flexDirection: 'row' },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.sm,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: AppColors.accent,
    borderRadius: Radius.md,
    paddingVertical: Space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: Weight.bold, fontSize: Font.h4 },
  shieldChar: { width: 54, height: 54, marginLeft: Space.sm },
  privacyNote: {
    fontSize: Font.micro,
    color: AppColors.sub,
    textAlign: 'center',
    marginBottom: Space.xs,
  },
});

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Space.xs,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    backgroundColor: AppColors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.lg,
    marginRight: Space.md,
  },
  iconText: { fontSize: Font.h4 },
  inputWrapper: { flex: 1, paddingVertical: Space.xxs },
  labelText: { fontSize: Font.caption, color: AppColors.sub, fontWeight: Weight.regular, marginTop: Space.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    fontSize: Font.h4,
    fontWeight: Weight.semibold,
    color: AppColors.navy,
    paddingVertical: Space.xs,
  },
  unitText: { fontSize: Font.bodySm, color: AppColors.sub, marginLeft: Space.xs },
  errorText: { fontSize: Font.micro, color: '#FF3B30', marginTop: Space.xxs },
});

const genderStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingVertical: Space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  cardSelected: {
    backgroundColor: AppColors.bg,
    borderColor: AppColors.accent,
    borderWidth: 2,
  },
  label: { fontSize: Font.body, fontWeight: Weight.semibold, color: AppColors.navy },
  labelSelected: { color: AppColors.accent },
});
