import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AppColors, cardShadowSm } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { alert, confirm } from '@/components/dialog';
import { Text } from '@/components/typography';
import { SettingsRow, SettingsSection } from '@/components/settings-list';
import { SelectOption, SelectSheet } from '@/components/select-field';
import { CharacterImage } from '@/components/character-image';
import { settingsStore } from '@/state/settingsStore';
import { profileStore } from '@/state/profileStore';
import { presetsStore } from '@/state/presetsStore';
import { sessionStore } from '@/state/sessionStore';
import { localeStore } from '@/state/localeStore';
import type { LocalePreference } from '@/storage/localeStorage';
import { appVersionLabel, PRIVACY_POLICY_URL, updateLabel } from '@/constants/appInfo';
import { i18n } from '@/i18n';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

/**
 * 언어 선택지.
 *
 * 라벨은 i18n 을 거치지 않고 해당 언어 그대로 쓴다 — 앱이 영어일 때
 * "한국어" 항목이 "Korean" 으로 보이면 그 언어를 찾는 사람이 못 알아본다.
 * "시스템 기본"만 현재 언어를 따른다.
 *
 * ⚠️ 모듈 최상위 상수로 만들지 말 것. i18n.t() 가 모듈 로드 시점에 한 번만
 * 평가되어, 언어를 바꿔도 "시스템 기본" 이 예전 언어로 얼어붙는다.
 * 렌더마다 다시 만들어야 한다.
 */
function languageOptions(): SelectOption<LocalePreference>[] {
  return [
    { label: i18n.t('languageSystem'), value: 'system' },
    { label: '한국어', value: 'ko' },
    { label: 'English', value: 'en' },
  ];
}

export default function SettingsScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  const setLocale = localeStore(s => s.setLocale);
  const profile = profileStore(s => s.profile);
  const timerNotificationEnabled = settingsStore(s => s.timerNotificationEnabled);
  const setTimerNotificationEnabled = settingsStore(s => s.setTimerNotificationEnabled);
  const refreshNotifications = sessionStore(s => s.refreshNotifications);
  const restorePresets = presetsStore(s => s.restoreDefaults);
  const clearAll = sessionStore(s => s.clearAll);

  /**
   * 토글 후 알림을 즉시 반영한다.
   * 끄면 떠 있던 카운트다운이 내려가고, 켜면 진행 중인 세션이 있을 때 바로 뜬다.
   * 계산은 sessionStore 가 이미 하므로 여기서 중복하지 않는다.
   */
  async function handleTimerNotificationToggle(next: boolean) {
    await setTimerNotificationEnabled(next);
    await refreshNotifications();
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

  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  // locale 이 null 이면 "시스템 기본" — 저장값이 없다는 뜻이다
  const localeValue: LocalePreference = locale ?? 'system';
  const currentLanguageLabel =
    languageOptions().find(o => o.value === localeValue)?.label ?? '';

  const sexLabel = profile
    ? i18n.t(profile.sex === 'male' ? 'settingsMale' : 'settingsFemale')
    : '-';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <Text style={styles.appTitle}>{i18n.t('settingsTitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 프로필 수정으로 들어가는 유일한 입구.
            아래 "내 정보" 행에 chevron 을 달지 않는 이유 — 진입점이 두 군데로
            보이면 어디를 눌러야 할지 헷갈린다. 편집은 여기 하나로 모은다. */}
        <Pressable
          style={({ pressed }) => [styles.greetingCard, pressed && styles.pressed]}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
        >
          <CharacterImage sex={profile?.sex} state="greeting" size={72} />
          <View style={styles.greetingText}>
            <Text style={styles.greetingTitle}>{i18n.t('settingsGreeting')}</Text>
            <Text style={styles.greetingSubtitle}>{i18n.t('settingsProfileEdit')}</Text>
          </View>
          <Icon name="chevronRight" size={IconSize.md} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
        </Pressable>

        {/* 내 정보 — 읽기 전용. 값만 확인하고, 고치려면 위 카드로 들어간다 */}
        <SettingsSection title={i18n.t('settingsMyInfo')}>
          <SettingsRow
            label={i18n.t('settingsHeightShort')}
            value={profile ? `${profile.heightCm} cm` : '-'}
          />
          <SettingsRow
            label={i18n.t('settingsWeightShort')}
            value={profile ? `${profile.weightKg} kg` : '-'}
          />
          <SettingsRow label={i18n.t('settingsSex')} value={sexLabel} />
          <SettingsRow
            label={i18n.t('settingsBirthYearLabel')}
            value={profile?.birthYear ? String(profile.birthYear) : '-'}
            last
          />
        </SettingsSection>

        {/* 알림창 카운트다운은 Android 전용이라 iOS 에서는 섹션째 숨긴다 */}
        {Platform.OS === 'android' && (
          <SettingsSection title={i18n.t('settingsNotificationSection')}>
            <SettingsRow
              label={i18n.t('settingsTimerNotification')}
              description={i18n.t('settingsTimerNotificationDesc')}
              toggle={{
                value: timerNotificationEnabled,
                onValueChange: handleTimerNotificationToggle,
              }}
              last
            />
          </SettingsSection>
        )}

        <SettingsSection title={i18n.t('settingsGeneralSection')}>
          {/* 다른 행과 같은 "라벨 좌 / 값 우 + chevron" 모양을 쓰고,
              시트만 SelectSheet 로 띄운다. 행 안에 또 네모 필드를 넣으면
              목록의 리듬이 그 줄에서만 끊긴다. */}
          <SettingsRow
            label={i18n.t('languageTitle')}
            value={currentLanguageLabel}
            onPress={() => setLanguageSheetOpen(true)}
            chevron
            last
          />
        </SettingsSection>

        <SettingsSection title={i18n.t('settingsDataSection')}>
          <SettingsRow
            label={i18n.t('settingsRestorePresets')}
            onPress={handleRestorePresets}
            chevron
          />
          <SettingsRow
            label={i18n.t('settingsDeleteAll')}
            onPress={handleDeleteAll}
            chevron
            danger
            last
          />
        </SettingsSection>

        <SettingsSection title={i18n.t('settingsInfoSection')}>
          <SettingsRow
            label={i18n.t('infoScreenTitle')}
            onPress={() => router.push('/info')}
            chevron
          />
          <SettingsRow
            label={i18n.t('settingsPrivacyPolicy')}
            // 앱 안 브라우저로 연다 — 외부 브라우저로 튕기면 돌아오기 번거롭다
            onPress={() => {
              WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch(() => {});
            }}
            chevron
          />
          <SettingsRow
            label={i18n.t('settingsOpenSource')}
            onPress={() => router.push('/licenses')}
            chevron
            last
          />
        </SettingsSection>

        {/* 버전 정보 — 문의·버그 제보 때 어떤 빌드인지 확인할 수 있어야 한다.
            OTA 로 JS 만 바뀌는 구조라 앱 버전만으로는 부족해서 업데이트 ID 도 함께 보여준다. */}
        <View style={styles.versionBox}>
          <Text style={styles.versionText}>{appVersionLabel}</Text>
          {!!updateLabel && <Text style={styles.versionSub}>{updateLabel}</Text>}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      <SelectSheet
        title={i18n.t('languageTitle')}
        visible={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        value={localeValue}
        options={languageOptions()}
        onChange={v => setLocale(v).catch(() => {})}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  appBar: { paddingHorizontal: Space.lg, paddingVertical: Space.md },
  appTitle: { fontSize: Font.h2, fontWeight: Weight.bold, color: AppColors.navy, letterSpacing: -0.3 },
  scrollContent: { padding: Space.lg },
  greetingCard: {
    backgroundColor: AppColors.accent,
    borderRadius: Radius.xl,
    padding: Space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    marginBottom: Space.xl,
    ...cardShadowSm,
    shadowColor: '#6C63E0',
    shadowOpacity: 0.25,
  },
  pressed: { opacity: 0.85 },
  greetingText: { flex: 1 },
  greetingTitle: { color: '#fff', fontSize: Font.h2, fontWeight: Weight.bold },
  greetingSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: Font.bodySm, marginTop: Space.xxs },
  versionBox: { alignItems: 'center', gap: Space.xxs, marginTop: Space.sm },
  versionText: { fontSize: Font.caption, color: AppColors.sub },
  versionSub: { fontSize: Font.micro, color: AppColors.sub, opacity: 0.7 },
});
