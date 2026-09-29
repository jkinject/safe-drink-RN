import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Sex } from '@/core/types';
import { profileStore } from '@/state/profileStore';
import { localeStore } from '@/state/localeStore';
import { i18n } from '@/i18n';
import { AppColors, cardShadowSm } from '@/constants/colors';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { OnboardingRestoreCard } from '@/components/onboarding-restore-card';
import { backupStore } from '@/state/backupStore';
import { Text } from '@/components/typography';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileField, ProfileFieldErrors, ProfileFields, SexSelector } from '@/components/profile-form';
import { Space, Radius, Font, LineHeight, Weight } from '@/constants/tokens';

export default function OnboardingScreen() {
  const locale = localeStore(s => s.locale);
  const save = profileStore(s => s.save);
  const router = useRouter();

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const setters: Record<ProfileField, (v: string) => void> = {
    height: setHeight,
    weight: setWeight,
    birthYear: setBirthYear,
  };
  // 백업 로그인·조회·복원 중에는 저장을 막는다 — 복원이 프로필을 통째로 바꾸므로 섞이면 안 된다
  const backupBusy = backupStore(s => s.status !== 'idle');

  // Keep locale subscription alive so re-render happens on locale change
  void locale;

  function validate(): boolean {
    const errs: ProfileFieldErrors = {};
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
          <ProfileFields
            values={{ height, weight, birthYear }}
            onChange={(field, v) => setters[field](v)}
            errors={errors}
          />

          {/* 기존 백업 복원 — 백업이 꺼진 빌드에서는 렌더하지 않는다 */}
          <OnboardingRestoreCard />
        </ScrollView>

        {/* Fixed bottom: gender + disclaimer + save */}
        <View style={styles.bottom}>
          {/* Gender */}
          <SexSelector value={sex} onChange={setSex} />

          <DisclaimerBanner />

          <View style={styles.saveRow}>
            <PrimaryButton
              label={i18n.t('onboardingSave')}
              onPress={handleSave}
              loading={saving}
              disabled={backupBusy}
              style={styles.saveBtn}
            />
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
    lineHeight: LineHeight.bodySm,
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
    ...cardShadowSm,
  },
  tipText: {
    fontSize: Font.bodySm,
    color: AppColors.navy,
    fontWeight: Weight.regular,
    lineHeight: LineHeight.bodySm,
  },
  bottom: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xs,
    gap: Space.sm,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.sm,
  },
  // 오른쪽 방패 캐릭터와 한 줄이라 남는 폭만 차지한다
  saveBtn: { flex: 1 },
  shieldChar: { width: 54, height: 54, marginLeft: Space.sm },
  privacyNote: {
    fontSize: Font.micro,
    color: AppColors.sub,
    textAlign: 'center',
    marginBottom: Space.xs,
  },
});
