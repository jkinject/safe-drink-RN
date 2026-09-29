import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppColors, StatusColors } from '@/constants/colors';
import { Font, IconSize, Space, Weight } from '@/constants/tokens';
import { BACKUP_SUPPORTED } from '@/config/backup';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { SettingsRow, SettingsSection } from '@/components/settings-list';
import { GoogleSignInButton } from '@/components/google-signin-button';
import { AppleSignInButton, useAppleSignInAvailable } from '@/components/apple-signin-button';
import { ProviderSignInButtons } from '@/components/provider-signin-buttons';
import { actionSheet, alert, confirm } from '@/components/dialog';
import { backupStore, type RemoteBackupInfo } from '@/state/backupStore';
import type { BackupAccount } from '@/storage/backupStorage';
import type { AuthProvider } from '@/services/auth';
import { formatAbsolute, formatLastBackup } from '@/services/backup/format';
import { i18n } from '@/i18n';

/**
 * 설정 탭 "백업" 섹션 (시안 .omc/design/backup/04·05, 확인창 06·07).
 *
 * 미연동이면 설명 + 제공자 버튼(Android: Google / iOS: Apple 위·Google 아래),
 * 연동되면 계정·상태 블록 + 동작 행 3개.
 * 모든 네트워크 동작은 backupStore 액션이 맡고(예외 없음, 결과값으로 알림),
 * 여기서는 결과에 맞는 확인창·알림만 띄운다.
 */

/** "N분 전" 이 멈춰 보이지 않도록 다시 그리는 주기 */
const RELATIVE_TICK_MS = 30_000;

/**
 * 아이콘 원 지름 — 아이콘(lg) 둘레에 md 여백.
 * 아이콘 크기 규칙(PRD: IconSize.md)의 예외 두 가지:
 *  - 원형 배경 안 머리 아이콘은 섹션 헤더 역할이라 lg (md 면 원 안에서 작아 보인다)
 *  - 상태 줄 글자 옆 체크·경고는 "본문 옆 작은 아이콘" 토큰 sm (DESIGN-NOTES "작은 outline 아이콘")
 * 그 밖에 새로 넣는 아이콘은 md 를 쓴다.
 */
const ICON_CIRCLE = IconSize.lg + Space.md * 2;

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

/**
 * 계정 표시 문구 — 이메일이 있으면 이메일, Apple 이 이메일을 주지 않았으면(가리기·미제공) "Apple 계정".
 * Google 은 이메일이 없으면 빈 값(상태 줄이 맨 위로 올라온다).
 */
function accountLabel(account: Pick<BackupAccount, 'email' | 'provider'> | null | undefined): string | null {
  if (!account) return null;
  if (account.email) return account.email;
  return account.provider === 'apple' ? t('backupAppleAccount') : null;
}

function ok(message: string) {
  return alert({ message, confirmLabel: t('dialogOk') });
}

/**
 * 로그인·조회 실패 안내 — 네트워크면 연결 확인, 그 외는 일반 실패.
 * 조회 실패는 lastActionError, 로그인·재연결 실패는 lastError 에 남는다(각 액션이 시작할 때 둘 다 비운다).
 */
function alertCheckFailed() {
  const { lastActionError, lastError } = backupStore.getState();
  const code = lastActionError ?? lastError;
  return ok(t(code === 'network' ? 'backupNetworkError' : 'backupSignInFailed'));
}

/** 찾은 백업 요약 줄들 — 해석 못 한 백업(개수 null)은 개수 줄을 뺀다 */
function remoteLines(remote: RemoteBackupInfo, fallbackEmail: string | null | undefined): string[] {
  const lines: string[] = [];
  const email = remote.email ?? fallbackEmail;
  if (email) lines.push(email);
  lines.push(t('backupFoundLastAt', { date: formatAbsolute(remote.updatedAt, i18n.locale) }));
  if (remote.recordCount != null && remote.customPresetCount != null) {
    lines.push(
      t('backupFoundCounts', {
        records: remote.recordCount,
        presets: remote.customPresetCount,
      }),
    );
  }
  return lines;
}

async function showRestoreResult(result: 'restored' | 'incompatible' | 'error') {
  const key =
    result === 'restored'
      ? 'backupRestored'
      : result === 'incompatible'
        ? 'backupNewerSchema'
        : 'backupRestoreFailed';
  await ok(t(key));
}

/**
 * 미연동 → 제공자(Google·Apple) 연결.
 * 서버에 이미 백업이 있으면 덮어쓰기 전에 반드시 고르게 한다(복원 / 이 기기로 교체 / 취소).
 * 취소하면 연동하지 않은 상태로 돌아간다 — 어느 쪽도 고르지 않았는데 자동 업로드가
 * 서버 백업을 지우면 안 되기 때문이다.
 */
async function handleSignIn(provider: AuthProvider) {
  const store = backupStore.getState();
  const result = await store.signInAndCheck(provider);

  if (result === 'cancelled') return;
  if (result === 'error') {
    await alertCheckFailed();
    return;
  }
  if (result === 'none') {
    // 새 계정 — 바로 첫 백업. 실패하면 상태 줄이 알려 준다(팝업으로 막지 않음)
    await backupStore.getState().backupNow();
    return;
  }

  const { remote, remoteIncompatible, account } = backupStore.getState();
  if (!remote || remoteIncompatible) {
    await ok(t('backupNewerSchema'));
    await backupStore.getState().unlinkLocal();
    return;
  }

  if (!remote.snapshot) {
    // 해석할 수 없는(손상된) 백업 — 복원은 선택지에서 뺀다. 이 기기 데이터로 덮거나 취소만.
    // 내용을 복원하지 못하니 "프로필·언어도 복원해요" 안내는 뺀다(이메일+일시만)
    const overwrite = await confirm({
      title: t('backupFoundTitle'),
      message: remoteLines(remote, accountLabel(account)).join('\n'),
      confirmLabel: t('backupOverwriteRemote'),
      cancelLabel: t('settingsCancel'),
      destructive: true,
    });
    if (overwrite) await backupStore.getState().backupNow();
    else await backupStore.getState().unlinkLocal();
    return;
  }

  const choice = await actionSheet({
    title: t('backupFoundTitle'),
    message: [...remoteLines(remote, accountLabel(account)), t('backupFoundIncludes')].join('\n'),
    actions: [
      { label: t('backupRestoreAction') },
      // 서버 백업을 이 기기 데이터로 덮는다 — 되돌릴 수 없으니 빨갛게
      { label: t('backupOverwriteRemote'), destructive: true },
    ],
    cancelLabel: t('settingsCancel'),
  });

  if (choice === 0) {
    // 설정 탭까지 온 기기에는 로컬 데이터가 있다 — 06 확인창을 한 번 더 거친다
    if (!(await confirmReplace(remote, accountLabel(account)))) {
      await backupStore.getState().unlinkLocal();
      return;
    }
    const result = await backupStore.getState().restoreFromRemote();
    await showRestoreResult(result);
    // 실패하면 선택 대기(awaitingDecision)가 남아 섹션이 스피너로 굳는다 — 미연동으로 되돌린다.
    // 다시 시도하려면 로그인 버튼을 한 번 더 누르면 된다(온보딩 카드와 같은 처리)
    if (result !== 'restored') await backupStore.getState().unlinkLocal();
  } else if (choice === 1) {
    await backupStore.getState().backupNow();
  } else {
    await backupStore.getState().unlinkLocal();
  }
}

/** 06 확인창 — 이 기기 데이터를 서버 백업으로 전부 바꿀지 묻는다 */
function confirmReplace(
  remote: RemoteBackupInfo,
  fallbackEmail: string | null | undefined,
): Promise<boolean> {
  return confirm({
    title: t('backupReplaceTitle'),
    message: [
      t('backupReplaceBody'),
      t('backupReplaceScope'),
      remoteLines(remote, fallbackEmail).join('\n'),
    ].join('\n\n'),
    confirmLabel: t('backupReplaceAction'),
    cancelLabel: t('settingsCancel'),
    destructive: true,
  });
}

/** 06 — 서버 백업으로 로컬 전체 교체 */
async function handleRestore() {
  const result = await backupStore.getState().checkRemote();
  if (result === 'error') {
    await alertCheckFailed();
    return;
  }
  if (result === 'none') {
    await ok(t('backupNoneTitle'));
    return;
  }

  const { remote, remoteIncompatible, account } = backupStore.getState();
  if (!remote || remoteIncompatible) {
    await ok(t('backupNewerSchema'));
    return;
  }

  if (!(await confirmReplace(remote, accountLabel(account)))) return;
  await showRestoreResult(await backupStore.getState().restoreFromRemote());
}

/** 07 — 서버 백업 삭제 + 연동 해제. 서버 삭제가 확인돼야만 해제된다 */
async function handleDelete() {
  const { account } = backupStore.getState();
  const confirmed = await confirm({
    title: t('backupDeleteTitle'),
    message: [accountLabel(account) ?? '', t('backupDeleteBody'), t('backupDeleteResult')]
      .filter(Boolean)
      .join('\n\n'),
    confirmLabel: t('backupDeleteAction'),
    cancelLabel: t('settingsCancel'),
    destructive: true,
  });
  if (!confirmed) return;
  const deleted = await backupStore.getState().deleteAndUnlink();
  await ok(t(deleted ? 'backupDeleted' : 'backupDeleteFailed'));
}

/** 재인증 — 연동 계정의 제공자로 다시 로그인한다(스토어가 account.provider 를 쓴다) */
async function handleReconnect() {
  const result = await backupStore.getState().reconnect();
  if (result === 'mismatch') await ok(t('backupAccountMismatch'));
  else if (result === 'error') await alertCheckFailed();
}

export function BackupSection() {
  // 빌드에 백업 설정이 없으면 1.2.x 와 똑같이 섹션 자체가 없다
  if (!BACKUP_SUPPORTED) return null;
  return <BackupSectionBody />;
}

function BackupSectionBody() {
  const account = backupStore(s => s.account);
  const awaitingDecision = backupStore(s => s.awaitingDecision);
  const status = backupStore(s => s.status);
  // Apple 버튼이 함께 보일 때만 "두 백업은 별개" 각주를 단다
  const appleAvailable = useAppleSignInAvailable() === true;

  return (
    <SettingsSection title={t('backupSectionTitle')}>
      {/* 기존 백업을 찾아 선택을 기다리는 동안은 아직 연동 전이다 — 계정 블록을 미리 보이지 않는다 */}
      {account && !awaitingDecision ? (
        <LinkedCard account={account} />
      ) : (
        <View style={styles.introBlock}>
          <View style={styles.headRow}>
            <IconCircle name="cloud" />
            <View style={styles.headText}>
              <Text style={styles.introTitle}>{t('backupIntroTitle')}</Text>
              <Text style={styles.introDesc}>{t('backupIntroDesc')}</Text>
            </View>
          </View>
          <ProviderSignInButtons
            loading={status === 'signingIn' || status === 'checking' || awaitingDecision}
            onSignIn={handleSignIn}
          />
          <View style={styles.notes}>
            <Text style={styles.note}>{t('backupOptionalNote')}</Text>
            {appleAvailable && <Text style={styles.note}>{t('backupProviderNote')}</Text>}
          </View>
        </View>
      )}
    </SettingsSection>
  );
}

/**
 * email 은 제공자가 주지 않았을 수 있다(null). Apple 이면 "Apple 계정" 으로 대신 보이고,
 * Google 이면 상태 줄이 맨 위로 올라온다.
 */
function LinkedCard({ account }: { account: BackupAccount }) {
  const label = accountLabel(account);
  const status = backupStore(s => s.status);
  const lastBackupAt = backupStore(s => s.lastBackupAt);
  const lastError = backupStore(s => s.lastError);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), RELATIVE_TICK_MS);
    return () => clearInterval(id);
  }, []);
  // 방금 성공한 백업은 다음 틱을 기다리지 않고 "방금" 으로 보인다(format 이 음수 차이를 방금으로 둔다)

  const busy = status !== 'idle';

  return (
    <>
      <View style={styles.accountBlock}>
        <View style={styles.headRow}>
          <IconCircle name={lastError ? 'cloud' : 'cloudCheck'} />
          <View style={styles.headText}>
            {!!label && (
              <Text
                style={styles.email}
                numberOfLines={1}
                ellipsizeMode="middle"
                accessibilityLabel={label}
              >
                {label}
              </Text>
            )}
            <StatusLine provider={account.provider} />
            <Text style={styles.meta}>
              {formatLastBackup(lastBackupAt, now, t, i18n.locale)}
            </Text>
          </View>
        </View>
        <Text style={styles.meta}>{t('backupScope')}</Text>

        {/* 재연결은 연동 계정의 제공자 버튼 하나만 — 다른 제공자로는 같은 백업에 닿을 수 없다 */}
        {lastError === 'reauth' &&
          (account.provider === 'apple' ? (
            <AppleSignInButton
              loading={status === 'signingIn'}
              disabled={busy && status !== 'signingIn'}
              onPress={handleReconnect}
            />
          ) : (
            <GoogleSignInButton
              label={t('googleContinue')}
              loading={status === 'signingIn'}
              disabled={busy && status !== 'signingIn'}
              onPress={() => {
                void handleReconnect();
              }}
            />
          ))}
      </View>

      {/* 진행 중에는 세 동작을 모두 막는다 — 스토어도 idle 이 아니면 거절하므로
          눌러 봐야 "실패" 알림만 뜬다 */}
      <SettingsRow
        label={t('backupNow')}
        accent
        disabled={busy}
        onPress={() => {
          void backupStore.getState().backupNow();
        }}
      />
      <SettingsRow
        label={t('backupRestore')}
        chevron
        disabled={busy}
        onPress={() => {
          void handleRestore();
        }}
      />
      <SettingsRow
        label={t('backupDeleteUnlink')}
        chevron
        danger
        disabled={busy}
        onPress={() => {
          void handleDelete();
        }}
        last
      />
    </>
  );
}

/** 이메일 아래 한 줄 — 진행 > 재인증 > 실패 > 대기 > 정상 순으로 하나만 */
function StatusLine({ provider }: { provider: AuthProvider }) {
  const status = backupStore(s => s.status);
  const lastError = backupStore(s => s.lastError);
  const dirty = backupStore(s => s.dirty);
  const lastBackupAt = backupStore(s => s.lastBackupAt);

  const progressKey =
    status === 'backingUp'
      ? 'backupInProgress'
      : status === 'restoring'
        ? 'backupRestoring'
        : status === 'deleting'
          ? 'backupDeleting'
          : status === 'checking'
            ? 'backupChecking'
            : status === 'signingIn'
              ? 'backupSigningIn'
              : null;

  if (progressKey) {
    return (
      <View style={styles.statusRow} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={AppColors.accent} style={styles.spinner} />
        <Text style={[styles.status, styles.statusAccent]}>{t(progressKey)}</Text>
      </View>
    );
  }

  if (lastError === 'reauth') {
    return (
      <Text style={[styles.status, styles.statusNavy]}>
        {t(provider === 'apple' ? 'backupReauthApple' : 'backupReauth')}
      </Text>
    );
  }

  if (lastError) {
    // 실패는 작은 아이콘 + 네이비 본문 — 빨간 글자로 겁주지 않는다(기기 데이터는 안전)
    return (
      <View style={styles.failBlock}>
        <View style={styles.statusRow}>
          <Icon name="danger" size={IconSize.sm} color={StatusColors.danger} strokeWidth={2.2} />
          <Text style={[styles.status, styles.statusNavy]}>{t('backupFailed')}</Text>
        </View>
        <Text style={styles.meta}>{t('backupFailedDesc')}</Text>
      </View>
    );
  }

  if (dirty) {
    return <Text style={[styles.status, styles.statusSub]}>{t('backupPending')}</Text>;
  }

  if (lastBackupAt == null) {
    // 연동 직후 첫 업로드가 걸리기 전
    return <Text style={[styles.status, styles.statusSub]}>{t('backupPreparingFirst')}</Text>;
  }

  return (
    <View style={styles.statusRow}>
      <Icon name="check" size={IconSize.sm} color={AppColors.accent} strokeWidth={2.4} />
      <Text style={[styles.status, styles.statusAccent]}>{t('backupAutoOn')}</Text>
    </View>
  );
}

function IconCircle({ name }: { name: IconName }) {
  return (
    <View style={styles.iconCircle}>
      <Icon name={name} size={IconSize.lg} color={AppColors.accent} strokeWidth={1.9} />
    </View>
  );
}

// lineHeight 는 토큰이 없어 settings-list.tsx description(lineHeight 18) 과 같은 방식으로 숫자를 쓴다
const styles = StyleSheet.create({
  // SettingsSection 의 rows 카드가 좌우 여백(Space.lg)을 이미 준다 — 위아래만 더한다
  introBlock: { paddingVertical: Space.lg, gap: Space.md },
  accountBlock: {
    paddingVertical: Space.lg,
    gap: Space.md,
    // 아래 동작 행과 나누는 선 — 행 사이 구분선과 같은 굵기·색
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  headText: { flex: 1, gap: Space.xxs },
  iconCircle: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: ICON_CIRCLE / 2,
    backgroundColor: AppColors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontSize: Font.h4,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    lineHeight: 22,
  },
  introDesc: { fontSize: Font.bodySm, color: AppColors.sub, lineHeight: 18 },
  notes: { gap: Space.xxs },
  note: { fontSize: Font.caption, color: AppColors.sub, textAlign: 'center' },
  email: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.navy },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  // 기본 ActivityIndicator 는 20px — 글자 높이에 맞춰 줄인다
  spinner: { transform: [{ scale: 0.7 }], marginHorizontal: -Space.xs },
  status: { fontSize: Font.bodySm, flexShrink: 1 },
  statusAccent: { color: AppColors.accent, fontWeight: Weight.semibold },
  statusNavy: { color: AppColors.navy, fontWeight: Weight.semibold },
  statusSub: { color: AppColors.sub },
  failBlock: { gap: Space.xxs },
  meta: { fontSize: Font.caption, color: AppColors.sub, lineHeight: 18 },
});
