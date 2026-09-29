import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppColors } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { alert } from '@/components/dialog';
import { Text } from '@/components/typography';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileField, ProfileFieldErrors, ProfileFields, SexSelector } from '@/components/profile-form';
import { CharacterImage } from '@/components/character-image';
import { profileStore } from '@/state/profileStore';
import { localeStore } from '@/state/localeStore';
import { Sex } from '@/core/types';
import { i18n } from '@/i18n';
import { FORM_BOTTOM_GAP, Font, IconSize, Space, Weight } from '@/constants/tokens';

/**
 * 프로필 수정 화면.
 *
 * 설정 탭에서 분리했다 — 입력 필드 4개 + 성별 + 저장 버튼이 설정 목록 안에
 * 인라인으로 있으면 그것만으로 화면 절반을 차지해, 정작 자주 보는 토글·언어가
 * 스크롤 아래로 밀린다. 설정에는 값만 읽기 전용으로 보여주고 편집은 여기서 한다.
 */

export default function ProfileScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  void locale; // 언어를 바꾸면 이 화면도 다시 그려야 한다

  const profile = profileStore(s => s.profile);
  const saveProfile = profileStore(s => s.save);

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [saving, setSaving] = useState(false);

  // 저장된 값으로 한 번만 채운다 (입력 중 프로필이 갱신돼도 덮어쓰지 않게)
  useEffect(() => {
    if (profile && !initialized) {
      setHeight(String(profile.heightCm));
      setWeight(String(profile.weightKg));
      setBirthYear(profile.birthYear ? String(profile.birthYear) : '');
      setSex(profile.sex);
      setInitialized(true);
    }
  }, [profile, initialized]);

  const setters: Record<ProfileField, (v: string) => void> = {
    height: setHeight,
    weight: setWeight,
    birthYear: setBirthYear,
  };

  // 고친 칸의 에러는 바로 지운다
  function handleFieldChange(field: ProfileField, v: string) {
    setters[field](v);
    setErrors(e => ({ ...e, [field]: undefined }));
  }

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

    if (birthYear.trim() !== '') {
      if (isNaN(by)) errs.birthYear = i18n.t('settingsNumberError');
      else if (by < currentYear - 100 || by > currentYear - 19)
        errs.birthYear = i18n.t('settingsBirthYearRangeError');
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
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
      // 저장하면 설정으로 돌아간다 — 바뀐 값이 목록에 바로 반영된다
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.appBarSide}
          onPress={() => router.back()}
          hitSlop={{ top: Space.sm, bottom: Space.sm, left: Space.sm, right: Space.sm }}
        >
          <Icon name="close" size={IconSize.lg} color={AppColors.sub} />
        </TouchableOpacity>
        <Text style={styles.appTitle}>{i18n.t('settingsProfileEdit')}</Text>
        <View style={styles.appBarSide} />
      </View>

      {/* Android edge-to-edge 에선 adjustResize 로 창이 줄지 않아 두 플랫폼 모두 padding 이 필요하다 */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <CharacterImage sex={sex} state="greeting" size={96} />
            <Text style={styles.heroDesc}>{i18n.t('settingsProfileDesc')}</Text>
          </View>

          <ProfileFields
            values={{ height, weight, birthYear }}
            onChange={handleFieldChange}
            errors={errors}
          />

          <SexSelector value={sex} onChange={setSex} />

          <PrimaryButton label={i18n.t('settingsSave')} onPress={handleSave} loading={saving} />

          <View style={{ height: FORM_BOTTOM_GAP }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  flex: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    justifyContent: 'space-between',
  },
  appBarSide: { width: Space.xxxl, alignItems: 'flex-start' },
  appTitle: { fontSize: Font.h3, fontWeight: Weight.bold, color: AppColors.navy, flex: 1, textAlign: 'center' },
  scrollContent: { padding: Space.lg, gap: Space.lg },
  hero: { alignItems: 'center', gap: Space.sm },
  heroDesc: {
    fontSize: Font.bodySm,
    color: AppColors.sub,
    textAlign: 'center',
    paddingHorizontal: Space.lg,
  },
});
