/**
 * 온보딩 "이전에 쓰던 기록이 있나요?" 카드 — Google 계정으로 기존 백업을 찾아 복원한다.
 *
 * 입력 검증 없이 바로 진입한다. 흐름:
 * - 백업 있음 → 확인창(이메일·일시·개수) → 복원. 프로필이 생기면 루트 레이아웃의
 *   리다이렉트가 /(tabs) 로 보낸다. 취소하면 로컬 연동만 해제(서버 백업은 그대로).
 * - 백업 없음 → 안내만 하고 로그인·온보딩 입력은 유지. 이후 "저장하고 시작" 이
 *   profileStore.save → notifyBackupChange 로 첫 자동 백업을 건다.
 *
 * 복원/취소를 고르기 전까지는 backupStore.awaitingDecision 이 켜져 있어 업로드가 막힌다.
 */
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { backupStore } from '@/state/backupStore';
import { localeStore } from '@/state/localeStore';
import { i18n } from '@/i18n';
import { AppColors, cardShadowSm } from '@/constants/colors';
import { Space, Radius, Font, Weight } from '@/constants/tokens';
import { BACKUP_SUPPORTED } from '@/config/backup';
import { formatAbsolute } from '@/services/backup/format';
import { alert, confirm } from '@/components/dialog';
import { GoogleSignInButton } from '@/components/google-signin-button';
import { Text } from '@/components/typography';

export function OnboardingRestoreCard() {
  const status = backupStore(s => s.status);
  // 로케일이 바뀌면 문구를 다시 그린다
  const locale = localeStore(s => s.locale);
  // 로그인 → 조회 → 확인창 → 복원까지 한 흐름으로 묶어 중복 탭을 막는다.
  // 확인창이 떠 있는 동안은 status 가 idle 이라 스토어 상태만으로는 막을 수 없다.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  if (!BACKUP_SUPPORTED) return null;

  const loading =
    busy || status === 'signingIn' || status === 'checking' || status === 'restoring';

  async function handlePress() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await runRestoreFlow(locale);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{i18n.t('onboardingRestoreTitle')}</Text>
      <Text style={styles.subtitle}>{i18n.t('onboardingRestoreSubtitle')}</Text>
      <View style={styles.buttonWrap}>
        <GoogleSignInButton
          label={i18n.t('googleContinue')}
          loading={loading}
          onPress={handlePress}
        />
      </View>
    </View>
  );
}

/** 로그인 → 백업 조회 → 결과별 안내/복원. 스토어 액션은 throw 하지 않는다 */
async function runRestoreFlow(locale: string): Promise<void> {
  const store = backupStore.getState();
  const result = await store.signInAndCheck();

  if (result === 'cancelled') return;

  if (result === 'error') {
    const code = backupStore.getState().lastError;
    await alert({
      message: i18n.t(code === 'network' ? 'backupNetworkError' : 'backupSignInFailed'),
      confirmLabel: i18n.t('dialogOk'),
    });
    return;
  }

  if (result === 'none') {
    // 연동은 유지된다 — 입력을 마치고 저장하면 그때부터 자동 백업
    const { remote, account } = backupStore.getState();
    const email = remote?.email ?? account?.email ?? '';
    await alert({
      title: i18n.t('backupNoneTitle'),
      message: [email, i18n.t('backupNoneDesc'), i18n.t('backupNoneLinked')]
        .filter(Boolean)
        .join('\n\n'),
      confirmLabel: i18n.t('dialogOk'),
    });
    return;
  }

  // 'found'
  const { remote, remoteIncompatible, account } = backupStore.getState();
  if (remoteIncompatible || !remote) {
    // 이 앱보다 새 버전이 만든 백업 — 복원할 수 없으니 연동을 풀고 온보딩을 계속한다
    await alert({
      message: i18n.t('backupNewerSchema'),
      confirmLabel: i18n.t('dialogOk'),
    });
    await backupStore.getState().unlinkLocal();
    return;
  }

  if (!remote.snapshot) {
    // 해석할 수 없는(손상된) 백업 — 온보딩엔 아직 교체할 로컬 데이터가 없으니 복원 선택지
    // 없이 그냥 새로 시작하게 한다(새 스키마 안내가 아니라 복원 실패 안내)
    await alert({
      message: i18n.t('backupRestoreFailed'),
      confirmLabel: i18n.t('dialogOk'),
    });
    await backupStore.getState().unlinkLocal();
    return;
  }

  const email = remote.email ?? account?.email ?? '';
  const summary = [
    email,
    i18n.t('backupFoundLastAt', { date: formatAbsolute(remote.updatedAt, locale) }),
    i18n.t('backupFoundCounts', {
      records: remote.recordCount ?? 0,
      presets: remote.customPresetCount ?? 0,
    }),
  ]
    .filter(Boolean)
    .join('\n');

  const ok = await confirm({
    title: i18n.t('backupFoundTitle'),
    message: `${summary}\n\n${i18n.t('backupFoundIncludes')}`,
    confirmLabel: i18n.t('backupRestoreAction'),
    cancelLabel: i18n.t('settingsCancel'),
  });

  if (!ok) {
    // 서버 백업은 그대로 두고 이 기기 연동만 해제 — 온보딩 입력값은 건드리지 않는다
    await backupStore.getState().unlinkLocal();
    return;
  }

  const restored = await backupStore.getState().restoreFromRemote();
  // 'restored' 는 별도 안내 없이 끝낸다 — 복원된 프로필을 보고 루트 레이아웃이 /(tabs) 로 보낸다
  if (restored === 'incompatible') {
    await alert({ message: i18n.t('backupNewerSchema'), confirmLabel: i18n.t('dialogOk') });
    await backupStore.getState().unlinkLocal();
  } else if (restored === 'error') {
    await alert({ message: i18n.t('backupRestoreFailed'), confirmLabel: i18n.t('dialogOk') });
    // 결정 대기 상태(계정 미저장)로 두면 그대로 "저장하고 시작" 을 눌렀을 때 백업이 영영 안 올라간다.
    // 깨끗하게 미연동으로 되돌리고, 다시 시도하려면 버튼을 한 번 더 누르게 한다.
    await backupStore.getState().unlinkLocal();
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xl,
    ...cardShadowSm,
  },
  title: {
    fontSize: Font.h4,
    fontWeight: Weight.bold,
    color: AppColors.navy,
  },
  subtitle: {
    fontSize: Font.bodySm,
    color: AppColors.sub,
    marginTop: Space.xxs,
  },
  buttonWrap: { marginTop: Space.md },
});
