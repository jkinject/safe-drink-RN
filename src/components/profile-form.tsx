import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Sex } from '@/core/types';
import { i18n } from '@/i18n';
import { AppColors, StatusColors, cardShadowSm } from '@/constants/colors';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { Space, Radius, Font, IconSize, Weight } from '@/constants/tokens';

/**
 * 신체 정보 입력 폼 — 온보딩과 프로필 수정이 같은 모양을 쓴다(플랫폼·화면 예외 없음).
 *
 * - `ProfileFields`: 키·몸무게·출생연도 세 줄을 한 카드에. 값이 비면 힌트(예) 175)가 placeholder 로 보인다.
 * - `SexSelector`: "성별" 라벨 + 남/여 세로형 카드 두 개.
 *
 * 검증·저장은 화면이 한다 — 여기는 값과 에러 문구를 받아 그리기만 한다.
 */

export type ProfileField = 'height' | 'weight' | 'birthYear';
export type ProfileFieldValues = Record<ProfileField, string>;
export type ProfileFieldErrors = Partial<Record<ProfileField, string>>;

interface ProfileFieldsProps {
  values: ProfileFieldValues;
  onChange: (field: ProfileField, value: string) => void;
  errors?: ProfileFieldErrors;
}

export function ProfileFields({ values, onChange, errors = {} }: ProfileFieldsProps) {
  return (
    <View style={styles.inputCard}>
      {/* Height */}
      <FieldRow
        icon="height"
        label={i18n.t('onboardingFieldHeight')}
        hint={i18n.t('onboardingHeightHint')}
        unit={i18n.t('unitCm')}
        keyboardType="number-pad"
        value={values.height}
        onChangeText={v => onChange('height', v)}
        error={errors.height}
      />
      <View style={styles.divider} />
      {/* Weight */}
      <FieldRow
        icon="weight"
        label={i18n.t('onboardingFieldWeight')}
        hint={i18n.t('onboardingWeightHint')}
        unit={i18n.t('unitKg')}
        keyboardType="decimal-pad"
        value={values.weight}
        onChangeText={v => onChange('weight', v)}
        error={errors.weight}
      />
      <View style={styles.divider} />
      {/* Birth Year */}
      <FieldRow
        icon="birthYear"
        label={i18n.t('onboardingFieldBirthYear')}
        hint={i18n.t('onboardingBirthYearHint')}
        unit={i18n.t('unitYear')}
        keyboardType="number-pad"
        value={values.birthYear}
        onChangeText={v => onChange('birthYear', v)}
        error={errors.birthYear}
      />
    </View>
  );
}

interface SexSelectorProps {
  value: Sex;
  onChange: (sex: Sex) => void;
}

export function SexSelector({ value, onChange }: SexSelectorProps) {
  return (
    <View style={styles.sexSection}>
      <Text style={styles.sexLabel}>{i18n.t('settingsSex')}</Text>
      <View style={styles.sexRow}>
        <GenderCard
          icon="male"
          label={i18n.t('settingsMale')}
          selected={value === 'male'}
          onPress={() => onChange('male')}
        />
        <GenderCard
          icon="female"
          label={i18n.t('settingsFemale')}
          selected={value === 'female'}
          onPress={() => onChange('female')}
        />
      </View>
    </View>
  );
}

interface FieldRowProps {
  icon: IconName;
  label: string;
  hint: string;
  unit: string;
  /** 정수만 받는 칸은 number-pad, 소수가 가능한 칸은 decimal-pad (iOS 에서 numeric 은 문장부호 쿼티가 뜬다) */
  keyboardType: 'number-pad' | 'decimal-pad';
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
}

function FieldRow({ icon, label, hint, unit, keyboardType, value, onChangeText, error }: FieldRowProps) {
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
            keyboardType={keyboardType}
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
        size={IconSize.lg}
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
  // 라벨 아래 xs + 섹션 gap sm = 라벨과 카드 사이 12 (온보딩 원래 간격)
  sexSection: { gap: Space.sm },
  sexLabel: {
    fontSize: Font.body,
    fontWeight: Weight.semibold,
    color: AppColors.navy,
    marginBottom: Space.xs,
  },
  sexRow: { flexDirection: 'row', gap: Space.md },
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
  errorText: { fontSize: Font.micro, color: StatusColors.danger, marginTop: Space.xxs },
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
