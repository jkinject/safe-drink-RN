import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/icon';
import { confirm } from '@/components/dialog';
import {
  DrinkIcon,
  DrinkIconName,
  isDrinkIconName,
  resolveDrinkIcon,
} from '@/components/drink-icon';
import { Text } from '@/components/typography';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppColors, cardShadow, cardShadowSm } from '@/constants/colors';
import { i18n } from '@/i18n';
import { sessionStore } from '@/state/sessionStore';
import { profileStore } from '@/state/profileStore';
import { localeStore } from '@/state/localeStore';
import { presetsStore } from '@/state/presetsStore';
import {
  bacCurve,
  currentBac,
  currentBacWithConstantR,
  estimatedSoberAt,
  estimatedSoberAtWithConstantR,
  remainingHours,
} from '@/core/bacCalculator';
import { getBacBadge } from '@/core/sessionUtils';
import { DrinkRecord } from '@/core/types';
import { LastSessionCard } from '@/components/last-session-card';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { CharacterImage, CharacterState } from '@/components/character-image';
import { BacGraph } from '@/components/bac-graph';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

// ── Animated character ───────────────────────────────────────────────────────

interface AnimatedCharProps {
  sex: 'male' | 'female' | null | undefined;
  charState: CharacterState;
  size?: number;
  onPress?: () => void;
}

function AnimatedCharacter({ sex, charState, size = 150, onPress }: AnimatedCharProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const prevState = useRef(charState);

  // Breathing loop
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade on state change
  useEffect(() => {
    if (prevState.current !== charState) {
      prevState.current = charState;
      opacity.value = withSequence(
        withTiming(0, { duration: 180 }),
        withTiming(1, { duration: 220 }),
      );
    }
  }, [charState, opacity]);

  const jump = useCallback(() => {
    cancelAnimation(translateY);
    translateY.value = withSequence(
      withTiming(-22, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable onPress={() => { onPress?.(); jump(); }}>
      <Animated.View style={animStyle}>
        <CharacterImage sex={sex} state={charState} size={size} />
      </Animated.View>
    </Pressable>
  );
}

// ── Speech bubble ─────────────────────────────────────────────────────────────

function SpeechBubble({ message }: { message: string }) {
  return (
    <View style={bubbleStyles.container}>
      <Text style={bubbleStyles.text}>{message}</Text>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    alignSelf: 'center',
    maxWidth: '85%',
    ...cardShadowSm,
  },
  text: {
    color: AppColors.navy,
    fontWeight: Weight.regular,
    fontSize: Font.body,
    textAlign: 'center',
  },
});

// ── Countdown card ────────────────────────────────────────────────────────────

function formatDuration(hours: number): string {
  const totalSeconds = Math.ceil(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function CountdownCard({
  remainingHrs,
  progress,
}: {
  remainingHrs: number;
  progress: number;
}) {
  return (
    <View style={countdownStyles.card}>
      <Text style={countdownStyles.label}>{i18n.t('soberAt')}</Text>
      <Text style={countdownStyles.time}>{formatDuration(remainingHrs)}</Text>
      <View style={countdownStyles.progressBg}>
        <View
          style={[
            countdownStyles.progressFill,
            { width: `${Math.min(progress * 100, 100)}%` },
          ]}
        />
      </View>
      <Text style={countdownStyles.subLabel}>{i18n.t('timerRemainingLabel')}</Text>
    </View>
  );
}

const countdownStyles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.lg,
    alignItems: 'center',
    ...cardShadowSm,
  },
  label: { fontSize: Font.caption, color: AppColors.sub, fontWeight: Weight.regular },
  time: {
    fontSize: Font.display,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    letterSpacing: 2,
    marginVertical: Space.sm,
    fontVariant: ['tabular-nums'],
  },
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#E8E6FF',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: AppColors.accent,
    borderRadius: Radius.pill,
  },
  subLabel: { fontSize: Font.micro, color: AppColors.sub, marginTop: Space.sm },
});

// ── Record tile ───────────────────────────────────────────────────────────────

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface RecordTileProps {
  record: DrinkRecord;
  presetIcon: DrinkIconName;
  onEdit: () => void;
  onFinish: () => void;
  onDelete: () => void;
}

function RecordTile({ record, presetIcon, onEdit, onFinish, onDelete }: RecordTileProps) {
  const isDrinking = record.finishedAt == null;
  const abvStr = record.abvPercent % 1 === 0
    ? record.abvPercent.toString()
    : record.abvPercent.toFixed(1);
  const volumeStr = record.volumeMl.toFixed(0);
  // 술 이름: 프리셋 라벨, 없으면 「수동입력」.
  // 여기에 도수·용량을 넣으면 아래 뱃지와 같은 값이 한 카드에 두 번 나온다
  const title = record.presetLabel ?? i18n.t('recordManualEntry');

  return (
    <TouchableOpacity
      style={tileStyles.container}
      onPress={onEdit}
      activeOpacity={0.8}
    >
      {/* Row 1: 이모지 + 이름/시각 + 삭제 */}
      <View style={tileStyles.row}>
        <View style={tileStyles.iconCircle}>
          <DrinkIcon name={presetIcon} size={24} />
        </View>
        <View style={tileStyles.titleCol}>
          <View style={tileStyles.titleRow}>
            <Text style={tileStyles.titleText} numberOfLines={1}>{title}</Text>
            {isDrinking && (
              <View style={tileStyles.drinkingBadge}>
                <Text style={tileStyles.drinkingBadgeText}>{i18n.t('drinkingBadge')}</Text>
              </View>
            )}
          </View>
          <Text style={tileStyles.finishedText}>
            {isDrinking
              ? i18n.t('recordTimeSuffix', { time: formatTime(record.consumedAt) })
              : i18n.t('recordFinishedAtSuffix', { time: formatTime(record.finishedAt!) })}
          </Text>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="delete" size={20} color={AppColors.sub} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>
      {/* Row 2: 도수·용량 뱃지 (+ 다마심) */}
      <View style={[tileStyles.row, { marginTop: Space.sm }]}>
        <View style={tileStyles.abvBadge}>
          <Text style={tileStyles.badgeText}>
            {i18n.t('recordAbvVolumeLabel', { abv: abvStr, volume: volumeStr })}
          </Text>
        </View>
        <View style={tileStyles.spacer} />
        {isDrinking && (
          <TouchableOpacity
            style={tileStyles.finishBtn}
            onPress={onFinish}
            activeOpacity={0.8}
          >
            <Text style={tileStyles.finishBtnText}>{i18n.t('finishedButton')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const tileStyles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.lg,
    padding: Space.md,
    ...cardShadowSm,
  },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Space.sm },
  iconCircle: {
    width: 40, height: 40, borderRadius: Radius.xl,
    backgroundColor: '#EEEDF8', alignItems: 'center', justifyContent: 'center',
  },
  titleCol: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  titleText: { fontSize: Font.body, fontWeight: Weight.semibold, color: '#2D2B52', flexShrink: 1 },
  spacer: { flex: 1 },
  drinkingBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: Radius.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
    borderWidth: 1,
    borderColor: '#FFD97D',
  },
  drinkingBadgeText: { fontSize: Font.micro, fontWeight: Weight.semibold, color: '#B07B00' },
  abvBadge: {
    backgroundColor: AppColors.chipBg,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
  },
  badgeText: { fontSize: Font.micro, color: AppColors.accent, fontWeight: Weight.regular },
  finishedText: { fontSize: Font.caption, color: AppColors.sub, fontWeight: Weight.regular, flex: 1 },
  recordedTime: { fontSize: Font.micro, color: AppColors.sub },
  finishBtn: {
    backgroundColor: AppColors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  finishBtnText: { color: '#fff', fontWeight: Weight.semibold, fontSize: Font.caption },
});

// ── BAC comparison card ───────────────────────────────────────────────────────

function BacComparisonCard({
  bacWatson,
  bacWidmark,
  soberWatsonMs,
  soberWidmarkMs,
}: {
  bacWatson: number;
  bacWidmark: number;
  soberWatsonMs: number | null;
  soberWidmarkMs: number | null;
}) {
  const statusBadge = getBacBadge(bacWatson);
  // 회복이 더 늦은 쪽이 "보수적" (시각이 없으면 BAC 비교로 fallback)
  const widmarkConservative =
    soberWatsonMs != null && soberWidmarkMs != null
      ? soberWidmarkMs > soberWatsonMs
      : bacWidmark > bacWatson;

  return (
    <View style={compStyles.card}>
      {/* 헤더: 제목 + 상태 뱃지 */}
      <View style={compStyles.headerRow}>
        <Text style={compStyles.title}>{i18n.t('bacComparisonTitle')}</Text>
        {statusBadge && (
          <View style={[compStyles.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <Text style={[compStyles.statusBadgeText, { color: statusBadge.color }]}>
              {i18n.t(statusBadge.labelKey)}
            </Text>
          </View>
        )}
      </View>

      {/* 2열 파스텔 패널 */}
      <View style={compStyles.panels}>
        <MethodPanel
          label={i18n.t('bacComparisonWatsonLabel')}
          desc={i18n.t('bacComparisonWatsonDesc')}
          bac={bacWatson}
          soberMs={soberWatsonMs}
          conservative={!widmarkConservative}
        />
        <MethodPanel
          label={i18n.t('bacComparisonWidmarkLabel')}
          desc={i18n.t('bacComparisonWidmarkDesc')}
          bac={bacWidmark}
          soberMs={soberWidmarkMs}
          conservative={widmarkConservative}
        />
      </View>

      <Text style={compStyles.footnote}>{i18n.t('bacComparisonFootnote')}</Text>
    </View>
  );
}

function MethodPanel({
  label,
  desc,
  bac,
  soberMs,
  conservative,
}: {
  label: string;
  desc: string;
  bac: number;
  soberMs: number | null;
  conservative: boolean;
}) {
  return (
    <View style={[compStyles.panel, conservative && compStyles.panelConservative]}>
      <View style={compStyles.panelLabelRow}>
        <Text style={compStyles.methodLabel} numberOfLines={1}>{label}</Text>
        {conservative && (
          <View style={compStyles.consBadge}>
            <Text style={compStyles.consBadgeText}>
              {i18n.t('bacComparisonConservativeLabel')}
            </Text>
          </View>
        )}
      </View>
      <Text style={compStyles.methodDesc}>{desc}</Text>
      <View style={compStyles.bacRow}>
        <Text style={compStyles.bigBac}>{bac.toFixed(3)}</Text>
        <Text style={compStyles.bigBacUnit}>%</Text>
      </View>
      <View style={compStyles.timeRow}>
        <Icon name="clock" size={13} color={AppColors.sub} strokeWidth={2} />
        <Text style={compStyles.timeText}>
          {soberMs != null ? formatTime(soberMs) : '--:--'}
        </Text>
      </View>
    </View>
  );
}

const compStyles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.lg,
    ...cardShadowSm,
    gap: Space.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.navy },
  statusBadge: { borderRadius: Radius.xl, paddingHorizontal: Space.md, paddingVertical: Space.xs },
  statusBadgeText: { fontSize: Font.caption, fontWeight: Weight.bold },
  panels: { flexDirection: 'row', gap: Space.md },
  panel: {
    flex: 1,
    backgroundColor: '#F4F3FC',
    borderRadius: Radius.lg,
    padding: Space.md,
  },
  panelConservative: {
    borderWidth: 1.2,
    borderColor: '#B3C7F7',
  },
  panelLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  methodLabel: { fontSize: Font.caption, fontWeight: Weight.bold, color: AppColors.navy, flexShrink: 1 },
  consBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: Radius.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xxs,
  },
  consBadgeText: { fontSize: Font.micro, fontWeight: Weight.semibold, color: '#1565C0' },
  methodDesc: { fontSize: Font.micro, color: AppColors.sub, marginTop: Space.xxs, minHeight: 26 },
  bacRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: Space.sm },
  bigBac: { fontSize: Font.h2, fontWeight: Weight.bold, color: AppColors.accent, letterSpacing: -0.5 },
  bigBacUnit: { fontSize: Font.bodySm, fontWeight: Weight.semibold, color: AppColors.accent, marginLeft: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, marginTop: Space.xs },
  timeIcon: { fontSize: Font.micro },
  timeText: { fontSize: Font.bodySm, fontWeight: Weight.semibold, color: AppColors.navy },
  footnote: { fontSize: Font.micro, color: AppColors.sub, lineHeight: 16 },
});

// ── Safe status display ───────────────────────────────────────────────────────

function SafeStatusDisplay({
  sex,
  onInfoPress,
}: {
  sex?: 'male' | 'female' | null;
  onInfoPress: () => void;
}) {
  return (
    <View style={safeStyles.container}>
      <CharacterImage sex={sex} state="greeting" size={160} />
      <Text style={safeStyles.title}>{i18n.t('safeStatus')}</Text>
      <Text style={safeStyles.subtitle}>{i18n.t('safeStatusSubtitle')}</Text>
      <TouchableOpacity style={safeStyles.infoBtn} onPress={onInfoPress} activeOpacity={0.8}>
        <Icon name="guide" size={15} color={AppColors.accent} strokeWidth={2} />
        <Text style={safeStyles.infoBtnText}>{i18n.t('infoScreenTitle')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const safeStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: Space.md, paddingVertical: Space.xxl },
  title: { fontSize: Font.h2, fontWeight: Weight.bold, color: AppColors.navy },
  subtitle: { fontSize: Font.bodySm, color: AppColors.sub, textAlign: 'center' },
  infoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderColor: '#C9C4F0',
    borderRadius: Radius.xxl,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
  },
  infoBtnText: { color: AppColors.accent, fontWeight: Weight.semibold, fontSize: Font.bodySm },
});

// ── Tip banner ────────────────────────────────────────────────────────────────

function TipBanner() {
  return (
    <View style={tipStyles.container}>
      <Icon name="water" size={24} color={AppColors.accent} strokeWidth={1.9} />
      <Text style={tipStyles.text}>{i18n.t('tipBannerText')}</Text>
    </View>
  );
}

const tipStyles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.bg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#D5D2F5',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  text: { flex: 1, fontSize: Font.bodySm, color: AppColors.accent, fontWeight: Weight.regular },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TimerScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  void locale;

  const records = sessionStore(s => s.records);
  const sessions = sessionStore(s => s.sessions);
  const finishRecord = sessionStore(s => s.finishRecord);
  const deleteRecord = sessionStore(s => s.deleteRecord);
  const checkAutoClose = sessionStore(s => s.checkAutoClose);
  const profile = profileStore(s => s.profile);
  const presets = presetsStore(s => s.presets);
  const insets = useSafeAreaInsets();
  // 기록에 저장된 아이콘이 우선. v4 이전 기록은 icon 이 없으므로
  // 예전처럼 프리셋 라벨로 되짚는다 (과거 데이터는 소급 채우지 않기로 했다).
  const iconFor = useCallback(
    (record: DrinkRecord): DrinkIconName => {
      if (record.icon && isDrinkIconName(record.icon)) return record.icon;
      const preset = presets.find(p => p.label === record.presetLabel);
      return preset ? resolveDrinkIcon(preset) : 'cup';
    },
    [presets],
  );

  const [nowMs, setNowMs] = useState(() => Date.now());

  // 1-second ticker
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-close check on each tick
  useEffect(() => {
    if (records.length > 0) {
      checkAutoClose().catch(() => {});
    }
  }, [nowMs, records.length, checkAutoClose]);

  const hasRecords = records.length > 0;
  const finishedRecords = records.filter(r => r.finishedAt != null);
  const hasFinishedRecords = finishedRecords.length > 0;
  const drinkingCount = records.filter(r => r.finishedAt == null).length;
  const hasOnlyDrinking = hasRecords && drinkingCount === records.length;

  // BAC values (only computed when profile exists)
  const bacWatson = profile
    ? currentBac(records, profile, nowMs)
    : 0;
  const bacWidmark = profile
    ? currentBacWithConstantR(records, profile, nowMs)
    : 0;
  const remHours = profile ? remainingHours(records, profile, nowMs) : 0;
  const soberAtMs = profile ? estimatedSoberAt(records, profile) : null;
  const soberWidmarkMs = profile
    ? estimatedSoberAtWithConstantR(records, profile)
    : null;

  // Progress: elapsed / total
  let progress = 0;
  if (hasFinishedRecords && soberAtMs != null && profile) {
    const firstMs = Math.min(...finishedRecords.map(r => r.finishedAt!));
    const total = soberAtMs - firstMs;
    if (total > 0) progress = Math.max(0, Math.min((nowMs - firstMs) / total, 1));
  }

  // BAC curve for graph
  const curve = profile && hasFinishedRecords
    ? bacCurve(records, profile)
    : [];
  const firstMs = hasFinishedRecords
    ? Math.min(...finishedRecords.map(r => r.finishedAt!))
    : nowMs;

  // Character state
  const charState: CharacterState =
    bacWatson <= 0 ? 'greeting' : bacWatson < 0.08 ? 'drinking' : 'dizzy';

  const statusMsg =
    charState === 'greeting'
      ? i18n.t('statusSafeMessage')
      : charState === 'drinking'
        ? i18n.t('statusDrinkingMessage')
        : i18n.t('statusDizzyMessage');

  function handleEditRecord(record: DrinkRecord) {
    router.push({ pathname: '/add-drink', params: { recordId: String(record.id) } });
  }

  function handleFinishRecord(record: DrinkRecord) {
    if (record.id != null) finishRecord(record.id).catch(() => {});
  }

  async function handleDeleteRecord(record: DrinkRecord) {
    const ok = await confirm({
      title: i18n.t('deleteRecordTitle'),
      message: i18n.t('deleteRecordConfirm'),
      confirmLabel: i18n.t('settingsDelete'),
      cancelLabel: i18n.t('settingsCancel'),
      destructive: true,
    });
    if (ok && record.id != null) deleteRecord(record.id).catch(() => {});
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <Text style={styles.appTitle}>{i18n.t('appTitle').toLowerCase()}</Text>
        <View style={styles.appBarActions}>
          <TouchableOpacity
            onPress={() => router.push('/history')}
            hitSlop={{ top: Space.sm, bottom: Space.sm, left: Space.sm, right: Space.sm }}
          >
            <Icon name="history" size={IconSize.lg} color={AppColors.sub} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/info')}
            hitSlop={{ top: Space.sm, bottom: Space.sm, left: Space.sm, right: Space.sm }}
          >
            <Icon name="info" size={IconSize.lg} color={AppColors.sub} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <DisclaimerBanner />

      {!hasRecords || !profile ? (
        /* No records — safe status */
        <ScrollView
          contentContainerStyle={styles.emptyContent}
          showsVerticalScrollIndicator={false}
        >
          <SafeStatusDisplay
            sex={profile?.sex}
            onInfoPress={() => router.push('/info')}
          />
          {/* 지난 술자리가 있을 때만 — 없으면 빈 자리 표시 없이 그대로 둔다 */}
          {sessions.length > 0 && (
            <View style={styles.lastSessionWrap}>
              <LastSessionCard
                session={sessions[0]}
                onPress={() => router.push('/history')}
              />
            </View>
          )}
        </ScrollView>
      ) : (
        /* Has records */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Character section */}
          <SpeechBubble message={statusMsg} />
          <View style={styles.charWrapper}>
            <AnimatedCharacter
              sex={profile?.sex}
              charState={charState}
              size={150}
            />
          </View>

          {/* Drinking-only badge */}
          {hasOnlyDrinking && (
            <View style={styles.drinkingOnlyBadge}>
              <Text style={styles.drinkingOnlyText}>
                {i18n.t('drinkingOnlyBadge', { n: drinkingCount })}
              </Text>
            </View>
          )}

          {/* Countdown card (only when finished records exist) */}
          {hasFinishedRecords && (
            <CountdownCard remainingHrs={remHours} progress={progress} />
          )}

          {/* Records section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{i18n.t('todayRecordsTitle')}</Text>
              <TouchableOpacity onPress={() => router.push('/add-drink')}>
                <Text style={styles.addBtn}>{i18n.t('addRecordButton')}</Text>
              </TouchableOpacity>
            </View>
            {records.map(record => (
              <RecordTile
                key={record.id}
                record={record}
                presetIcon={iconFor(record)}
                onEdit={() => handleEditRecord(record)}
                onFinish={() => handleFinishRecord(record)}
                onDelete={() => handleDeleteRecord(record)}
              />
            ))}
          </View>

          {/* BAC comparison (only when finished records exist) */}
          {hasFinishedRecords && (
            <BacComparisonCard
              bacWatson={bacWatson}
              bacWidmark={bacWidmark}
              soberWatsonMs={soberAtMs}
              soberWidmarkMs={soberWidmarkMs}
            />
          )}

          {/* BAC Graph (only when finished records exist and curve has data) */}
          {hasFinishedRecords && curve.length > 1 && soberAtMs != null && (
            <BacGraph
              curve={curve}
              nowMs={nowMs}
              firstMs={firstMs}
              soberMs={soberAtMs}
            />
          )}

          {/* Tip banner */}
          <TipBanner />

          {/* Bottom padding for tab bar */}
          <View style={{ height: 90 + insets.bottom }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 84 + insets.bottom }]}
        onPress={() => router.push('/add-drink')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  appBarActions: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  appTitle: {
    fontSize: Font.h2,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    letterSpacing: -0.5,
  },
  lastSessionWrap: { marginTop: Space.xxl },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Space.xxxl,
    paddingVertical: Space.xxl,
    paddingBottom: 100,
  },
  scrollContent: {
    padding: Space.lg,
    gap: Space.md,
  },
  charWrapper: { alignItems: 'center' },
  drinkingOnlyBadge: {
    alignSelf: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderWidth: 1,
    borderColor: '#FFD97D',
  },
  drinkingOnlyText: { fontSize: Font.bodySm, fontWeight: Weight.semibold, color: '#B07B00' },
  section: { gap: Space.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.navy },
  addBtn: { fontSize: Font.bodySm, fontWeight: Weight.semibold, color: AppColors.accent },
  fab: {
    position: 'absolute',
    bottom: 84,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: Radius.xxl,
    backgroundColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: Font.h1, fontWeight: Weight.regular, lineHeight: 32 },
});
