import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors, cardShadow, cardShadowSm } from '@/constants/colors';
import { Icon, IconName } from '@/components/icon';
import { alert, confirm } from '@/components/dialog';
import { Text } from '@/components/typography';
import { settingsStore } from '@/state/settingsStore';
import { i18n } from '@/i18n';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { profileStore } from '@/state/profileStore';
import { presetsStore } from '@/state/presetsStore';
import { sessionStore } from '@/state/sessionStore';
import { localeStore } from '@/state/localeStore';
import { Sex } from '@/core/types';
import { CharacterImage } from '@/components/character-image';
import type { LocalePreference } from '@/storage/localeStorage';
import { SelectField, SelectOption } from '@/components/select-field';
import { appVersionLabel, updateLabel } from '@/constants/appInfo';
import { Space, Radius, Font, Weight } from '@/constants/tokens';

// ── Section card ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: IconName;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}

function SectionCard({ icon, title, iconColor, children }: SectionCardProps) {
  const color = iconColor ?? AppColors.accent;
  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.header}>
        <View style={[sectionStyles.iconCircle, { backgroundColor: color + '22' }]}>
          <Icon name={icon} size={18} color={color} strokeWidth={2.1} />
        </View>
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.lg,
    ...cardShadowSm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md, marginBottom: Space.lg },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: Font.h3 },
  title: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.navy, flex: 1 },
  body: {},
});

/**
 * 언어 선택지.
 *
 * 라벨은 i18n 을 거치지 않고 해당 언어 그대로 쓴다 — 앱이 영어일 때
 * "한국어" 항목이 "Korean" 으로 보이면 그 언어를 찾는 사람이 못 알아본다.
 * (시스템 기본만 현재 언어를 따른다.)
 */
const LANGUAGE_OPTIONS: SelectOption<LocalePreference>[] = [
  { label: i18n.t('languageSystem'), value: 'system' },
  { label: '한국어', value: 'ko' },
  { label: 'English', value: 'en' },
];

// ── Profile form ──────────────────────────────────────────────────────────────

interface ProfileErrors {
  height?: string;
  weight?: string;
  birthYear?: string;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const locale = localeStore(s => s.locale);
  const timerNotificationEnabled = settingsStore(s => s.timerNotificationEnabled);
  const setTimerNotificationEnabled = settingsStore(s => s.setTimerNotificationEnabled);
  const refreshNotifications = sessionStore(s => s.refreshNotifications);

  /**
   * 토글 후 알림을 즉시 반영한다.
   * 끄면 떠 있던 카운트다운이 내려가고, 켜면 진행 중인 세션이 있을 때 바로 뜬다.
   * 계산은 sessionStore 가 이미 하므로 여기서 중복하지 않는다.
   */
  async function handleTimerNotificationToggle(next: boolean) {
    await setTimerNotificationEnabled(next);
    await refreshNotifications();
  }
  const setLocale = localeStore(s => s.setLocale);
  void locale;

  const profile = profileStore(s => s.profile);
  const saveProfile = profileStore(s => s.save);
  const restorePresets = presetsStore(s => s.restoreDefaults);
  const clearAll = sessionStore(s => s.clearAll);

  // Profile form state
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

  // Initialize from profile (only once)
  useEffect(() => {
    if (profile && !initialized) {
      setHeight(String(profile.heightCm));
      setWeight(String(profile.weightKg));
      setBirthYear(profile.birthYear ? String(profile.birthYear) : '');
      setSex(profile.sex);
      setInitialized(true);
    }
  }, [profile, initialized]);

  function validate(): boolean {
    const errs: ProfileErrors = {};
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const by = parseInt(birthYear, 10);
    const currentYear = new Date().getFullYear();

    if (isNaN(h)) errs.height = i18n.t('settingsNumberError');
    else if (h < 100 || h > 250) errs.height = i18n.t('settingsHeightRangeError');

    if (isNaN(w)) errs.weight = i18n.t('settingsNumberError');
    else if (w < 30 || w > 300) errs.weight = i18n.t('settingsWeightRangeError');

    if (birthYear.trim() !== '') {
      if (isNaN(by)) errs.birthYear = i18n.t('settingsNumberError');
      else if (by < currentYear - 100 || by > currentYear - 19)
        errs.birthYear = i18n.t('settingsBirthYearRangeError');
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSaveProfile() {
    if (!validate()) return;
    setSaving(true);
    try {
      await saveProfile({
        heightCm: parseFloat(height),
        weightKg: parseFloat(weight),
        sex,
        birthYear: birthYear.trim() ? parseInt(birthYear, 10) : undefined,
      });
      await alert({ message: i18n.t('settingsSaved'), confirmLabel: i18n.t('dialogOk') });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestorePresets() {
    const ok = await confirm({
      title: i18n.t('settingsRestorePresetsTitle'),
      message: i18n.t('settingsRestorePresetsConfirm'),
      confirmLabel: i18n.t('settingsRestorePresets'),
      cancelLabel: i18n.t('settingsCancel'),
    });
    if (!ok) return;
    await restorePresets();
    await alert({ message: i18n.t('settingsRestored'), confirmLabel: i18n.t('dialogOk') });
  }

  async function handleDeleteAll() {
    const ok = await confirm({
      title: i18n.t('settingsDeleteAllTitle'),
      message: i18n.t('settingsDeleteAllConfirm'),
      confirmLabel: i18n.t('settingsDelete'),
      cancelLabel: i18n.t('settingsCancel'),
      destructive: true,
    });
    if (!ok) return;
    await clearAll();
    await alert({ message: i18n.t('settingsDeletedAll'), confirmLabel: i18n.t('dialogOk') });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <Text style={styles.appTitle}>{i18n.t('settingsTitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Greeting card */}
        <View style={styles.greetingCard}>
          <CharacterImage sex={profile?.sex} state="greeting" size={72} />
          <View style={styles.greetingText}>
            <Text style={styles.greetingTitle}>{i18n.t('settingsGreeting')}</Text>
            <Text style={styles.greetingSubtitle}>{i18n.t('settingsProfileEdit')}</Text>
          </View>
        </View>

        {/* Profile edit card */}
        <SectionCard icon="profile" title={i18n.t('settingsProfileEdit')}>
          {/* Height */}
          <FloatingLabelInput
            label={i18n.t('settingsHeightLabel')}
            value={height}
            onChangeText={v => { setHeight(v); setErrors(e => ({ ...e, height: undefined })); }}
            keyboardType="numeric"
            error={errors.height ?? null}
          />

          <View style={fieldStyles.gap} />

          {/* Weight */}
          <FloatingLabelInput
            label={i18n.t('settingsWeightLabel')}
            value={weight}
            onChangeText={v => { setWeight(v); setErrors(e => ({ ...e, weight: undefined })); }}
            keyboardType="numeric"
            error={errors.weight ?? null}
          />

          <View style={fieldStyles.gap} />

          {/* Birth year */}
          <FloatingLabelInput
            label={i18n.t('settingsBirthYearLabel')}
            value={birthYear}
            onChangeText={v => { setBirthYear(v); setErrors(e => ({ ...e, birthYear: undefined })); }}
            keyboardType="numeric"
            error={errors.birthYear ?? null}
          />

          <View style={fieldStyles.gap} />

          {/* Sex */}
          <Text style={fieldStyles.label}>{i18n.t('settingsSex')}</Text>
          <View style={fieldStyles.sexRow}>
            <TouchableOpacity
              style={[fieldStyles.sexBtn, sex === 'male' && fieldStyles.sexBtnActive]}
              onPress={() => setSex('male')}
              activeOpacity={0.8}
            >
              <Icon
                name="male"
                size={16}
                color={sex === 'male' ? AppColors.accent : AppColors.sub}
                strokeWidth={2.1}
              />
              <Text style={[fieldStyles.sexLabel, sex === 'male' && fieldStyles.sexLabelActive]}>
                {i18n.t('settingsMale')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[fieldStyles.sexBtn, sex === 'female' && fieldStyles.sexBtnActive]}
              onPress={() => setSex('female')}
              activeOpacity={0.8}
            >
              <Icon
                name="female"
                size={16}
                color={sex === 'female' ? AppColors.accent : AppColors.sub}
                strokeWidth={2.1}
              />
              <Text style={[fieldStyles.sexLabel, sex === 'female' && fieldStyles.sexLabelActive]}>
                {i18n.t('settingsFemale')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={fieldStyles.gap} />

          <TouchableOpacity
            style={[fieldStyles.saveBtn, saving && fieldStyles.saveBtnDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={fieldStyles.saveBtnText}>{i18n.t('settingsSave')}</Text>
            )}
          </TouchableOpacity>
        </SectionCard>

        {/* 알림창 카운트다운 토글 — Android 전용 기능이라 iOS 에서는 숨긴다 */}
        {Platform.OS === 'android' && (
          <SectionCard icon="clock" title={i18n.t('settingsTimerNotification')}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleDesc}>
                {i18n.t('settingsTimerNotificationDesc')}
              </Text>
              <Switch
                value={timerNotificationEnabled}
                onValueChange={handleTimerNotificationToggle}
                trackColor={{ false: AppColors.border, true: AppColors.accent }}
                thumbColor="#fff"
              />
            </View>
          </SectionCard>
        )}

        {/* Language card */}
        <SectionCard icon="language" title={i18n.t('languageTitle')}>
          <SelectField
            title={i18n.t('languageTitle')}
            // locale 이 null 이면 "시스템 기본" — 저장값이 없다는 뜻이다
            value={locale ?? 'system'}
            options={LANGUAGE_OPTIONS}
            onChange={v => setLocale(v).catch(() => {})}
          />
        </SectionCard>

        {/* Restore presets */}
        <SectionCard icon="restore" title={i18n.t('settingsRestorePresets')}>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={handleRestorePresets}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineBtnText}>{i18n.t('settingsRestorePresets')}</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Delete all records */}
        <SectionCard icon="delete" title={i18n.t('settingsDeleteAll')} iconColor="#FF3B30">
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleDeleteAll}
            activeOpacity={0.8}
          >
            <Text style={styles.dangerBtnText}>{i18n.t('settingsDeleteAll')}</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* 버전 정보 — 문의·버그 제보 때 어떤 빌드인지 확인할 수 있어야 한다.
            OTA 로 JS 만 바뀌는 구조라 앱 버전만으로는 부족해서 업데이트 ID 도 함께 보여준다. */}
        <View style={styles.versionBox}>
          <Text style={styles.versionText}>{appVersionLabel}</Text>
          {!!updateLabel && <Text style={styles.versionSub}>{updateLabel}</Text>}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  appBar: { paddingHorizontal: Space.lg, paddingVertical: Space.md },
  appTitle: { fontSize: Font.h2, fontWeight: Weight.bold, color: AppColors.navy, letterSpacing: -0.3 },
  scrollContent: { padding: Space.lg, gap: Space.lg },
  versionBox: { alignItems: 'center', gap: Space.xxs, marginTop: Space.xs },
  versionText: { fontSize: Font.caption, color: AppColors.sub },
  versionSub: { fontSize: Font.micro, color: AppColors.sub, opacity: 0.7 },
  greetingCard: {
    backgroundColor: AppColors.accent,
    borderRadius: Radius.xl,
    padding: Space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    ...cardShadowSm,
    shadowColor: '#6C63E0',
    shadowOpacity: 0.25,
  },
  greetingText: { flex: 1 },
  greetingTitle: { color: '#fff', fontSize: Font.h2, fontWeight: Weight.bold },
  greetingSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: Font.bodySm, marginTop: Space.xxs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  // 설명이 스위치를 밀어내지 않도록 남는 폭만 차지한다
  toggleDesc: { flex: 1, fontSize: Font.bodySm, color: AppColors.sub },
  outlineBtn: {
    borderWidth: 1,
    borderColor: AppColors.accent,
    borderRadius: Radius.pill,
    paddingVertical: Space.md,
    alignItems: 'center',
  },
  outlineBtnText: { color: AppColors.accent, fontWeight: Weight.semibold, fontSize: Font.body },
  dangerBtn: {
    borderWidth: 1,
    borderColor: '#FF8A84',
    borderRadius: Radius.pill,
    paddingVertical: Space.md,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#FF3B30', fontWeight: Weight.semibold, fontSize: Font.body },
});

const fieldStyles = StyleSheet.create({
  label: { fontSize: Font.bodySm, color: AppColors.sub, fontWeight: Weight.regular, marginBottom: Space.sm },
  input: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    fontSize: Font.body,
    color: AppColors.navy,
    fontWeight: Weight.regular,
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: Font.micro, color: '#FF3B30', marginTop: Space.xs },
  gap: { height: 12 },
  sexRow: { flexDirection: 'row', gap: Space.md },
  sexBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingVertical: Space.md,
    alignItems: 'center',
    backgroundColor: AppColors.bg,
  },
  sexBtnActive: {
    borderColor: AppColors.accent,
    borderWidth: 2,
    backgroundColor: '#EAE8FF',
  },
  sexLabel: { fontSize: Font.body, fontWeight: Weight.regular, color: AppColors.navy },
  sexLabelActive: { color: AppColors.accent, fontWeight: Weight.bold },
  saveBtn: {
    backgroundColor: AppColors.accent,
    borderRadius: Radius.md,
    paddingVertical: Space.lg,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: Weight.bold, fontSize: Font.body },
});
