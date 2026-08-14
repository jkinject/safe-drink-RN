import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors, cardShadow, cardShadowSm } from '@/constants/colors';
import { i18n } from '@/i18n';
import { profileStore } from '@/state/profileStore';
import { presetsStore } from '@/state/presetsStore';
import { sessionStore } from '@/state/sessionStore';
import { localeStore } from '@/state/localeStore';
import { Sex } from '@/core/types';
import { CharacterImage } from '@/components/character-image';
import type { LocalePreference } from '@/storage/localeStorage';

// ── Section card ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: string;
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
          <Text style={[sectionStyles.iconText, { color }]}>{icon}</Text>
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
    borderRadius: 20,
    padding: 16,
    ...cardShadowSm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  title: { fontSize: 14, fontWeight: '700', color: AppColors.navy, flex: 1 },
  body: {},
});

// ── Language selector ─────────────────────────────────────────────────────────

interface LangOptionProps {
  label: string;
  value: LocalePreference;
  current: string | null;
  onSelect: (v: LocalePreference) => void;
}

function LangOption({ label, value, current, onSelect }: LangOptionProps) {
  const selected = current === value || (current === null && value === 'system');
  return (
    <TouchableOpacity
      style={[langStyles.option, selected && langStyles.optionSelected]}
      onPress={() => onSelect(value)}
      activeOpacity={0.8}
    >
      <Text style={[langStyles.label, selected && langStyles.labelSelected]}>{label}</Text>
      {selected && <Text style={langStyles.check}>✓</Text>}
    </TouchableOpacity>
  );
}

const langStyles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: AppColors.bg,
  },
  optionSelected: { backgroundColor: '#EAE8FF', borderWidth: 1, borderColor: AppColors.accent },
  label: { fontSize: 14, color: AppColors.navy, fontWeight: '500' },
  labelSelected: { color: AppColors.accent, fontWeight: '700' },
  check: { color: AppColors.accent, fontWeight: '700', fontSize: 16 },
});

// ── Profile form ──────────────────────────────────────────────────────────────

interface ProfileErrors {
  height?: string;
  weight?: string;
  birthYear?: string;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const locale = localeStore(s => s.locale);
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
      Alert.alert('', i18n.t('settingsSaved'));
    } finally {
      setSaving(false);
    }
  }

  function handleRestorePresets() {
    Alert.alert(
      i18n.t('settingsRestorePresetsTitle'),
      i18n.t('settingsRestorePresetsConfirm'),
      [
        { text: i18n.t('settingsCancel'), style: 'cancel' },
        {
          text: i18n.t('settingsRestorePresets'),
          onPress: async () => {
            await restorePresets();
            Alert.alert('', i18n.t('settingsRestored'));
          },
        },
      ],
    );
  }

  function handleDeleteAll() {
    Alert.alert(
      i18n.t('settingsDeleteAllTitle'),
      i18n.t('settingsDeleteAllConfirm'),
      [
        { text: i18n.t('settingsCancel'), style: 'cancel' },
        {
          text: i18n.t('settingsDelete'),
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            Alert.alert('', i18n.t('settingsDeletedAll'));
          },
        },
      ],
    );
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
        <SectionCard icon="👤" title={i18n.t('settingsProfileEdit')}>
          {/* Height */}
          <Text style={fieldStyles.label}>{i18n.t('settingsHeightLabel')}</Text>
          <TextInput
            style={[fieldStyles.input, errors.height ? fieldStyles.inputError : null]}
            value={height}
            onChangeText={v => { setHeight(v); setErrors(e => ({ ...e, height: undefined })); }}
            keyboardType="numeric"
            placeholder="e.g. 175"
            placeholderTextColor={AppColors.sub}
          />
          {errors.height ? <Text style={fieldStyles.errorText}>{errors.height}</Text> : null}

          <View style={fieldStyles.gap} />

          {/* Weight */}
          <Text style={fieldStyles.label}>{i18n.t('settingsWeightLabel')}</Text>
          <TextInput
            style={[fieldStyles.input, errors.weight ? fieldStyles.inputError : null]}
            value={weight}
            onChangeText={v => { setWeight(v); setErrors(e => ({ ...e, weight: undefined })); }}
            keyboardType="numeric"
            placeholder="e.g. 70"
            placeholderTextColor={AppColors.sub}
          />
          {errors.weight ? <Text style={fieldStyles.errorText}>{errors.weight}</Text> : null}

          <View style={fieldStyles.gap} />

          {/* Birth year */}
          <Text style={fieldStyles.label}>{i18n.t('settingsBirthYearLabel')}</Text>
          <TextInput
            style={[fieldStyles.input, errors.birthYear ? fieldStyles.inputError : null]}
            value={birthYear}
            onChangeText={v => { setBirthYear(v); setErrors(e => ({ ...e, birthYear: undefined })); }}
            keyboardType="numeric"
            placeholder="e.g. 1990"
            placeholderTextColor={AppColors.sub}
          />
          {errors.birthYear ? <Text style={fieldStyles.errorText}>{errors.birthYear}</Text> : null}

          <View style={fieldStyles.gap} />

          {/* Sex */}
          <Text style={fieldStyles.label}>{i18n.t('settingsSex')}</Text>
          <View style={fieldStyles.sexRow}>
            <TouchableOpacity
              style={[fieldStyles.sexBtn, sex === 'male' && fieldStyles.sexBtnActive]}
              onPress={() => setSex('male')}
              activeOpacity={0.8}
            >
              <Text style={[fieldStyles.sexLabel, sex === 'male' && fieldStyles.sexLabelActive]}>
                👦 {i18n.t('settingsMale')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[fieldStyles.sexBtn, sex === 'female' && fieldStyles.sexBtnActive]}
              onPress={() => setSex('female')}
              activeOpacity={0.8}
            >
              <Text style={[fieldStyles.sexLabel, sex === 'female' && fieldStyles.sexLabelActive]}>
                👧 {i18n.t('settingsFemale')}
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

        {/* Language card */}
        <SectionCard icon="🌐" title={i18n.t('languageTitle')}>
          <LangOption
            label={i18n.t('languageSystem')}
            value="system"
            current={locale}
            onSelect={v => setLocale(v).catch(() => {})}
          />
          <LangOption
            label={i18n.t('languageKorean')}
            value="ko"
            current={locale}
            onSelect={v => setLocale(v).catch(() => {})}
          />
          <LangOption
            label={i18n.t('languageEnglish')}
            value="en"
            current={locale}
            onSelect={v => setLocale(v).catch(() => {})}
          />
        </SectionCard>

        {/* Restore presets */}
        <SectionCard icon="🔄" title={i18n.t('settingsRestorePresets')}>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={handleRestorePresets}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineBtnText}>{i18n.t('settingsRestorePresets')}</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Delete all records */}
        <SectionCard icon="🗑" title={i18n.t('settingsDeleteAll')} iconColor="#FF3B30">
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleDeleteAll}
            activeOpacity={0.8}
          >
            <Text style={styles.dangerBtnText}>{i18n.t('settingsDeleteAll')}</Text>
          </TouchableOpacity>
        </SectionCard>

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  appBar: { paddingHorizontal: 16, paddingVertical: 12 },
  appTitle: { fontSize: 20, fontWeight: '800', color: AppColors.navy, letterSpacing: -0.3 },
  scrollContent: { padding: 16, gap: 16 },
  greetingCard: {
    backgroundColor: AppColors.accent,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    ...cardShadow,
    shadowColor: '#6C63E0',
    shadowOpacity: 0.25,
  },
  greetingText: { flex: 1 },
  greetingTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  greetingSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: AppColors.accent,
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineBtnText: { color: AppColors.accent, fontWeight: '600', fontSize: 14 },
  dangerBtn: {
    borderWidth: 1,
    borderColor: '#FF8A84',
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#FF3B30', fontWeight: '600', fontSize: 14 },
});

const fieldStyles = StyleSheet.create({
  label: { fontSize: 13, color: AppColors.sub, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: AppColors.navy,
    fontWeight: '500',
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: 11, color: '#FF3B30', marginTop: 3 },
  gap: { height: 12 },
  sexRow: { flexDirection: 'row', gap: 10 },
  sexBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: AppColors.bg,
  },
  sexBtnActive: {
    borderColor: AppColors.accent,
    borderWidth: 2,
    backgroundColor: '#EAE8FF',
  },
  sexLabel: { fontSize: 14, fontWeight: '500', color: AppColors.navy },
  sexLabelActive: { color: AppColors.accent, fontWeight: '700' },
  saveBtn: {
    backgroundColor: AppColors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
