import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
import { DrinkRecord } from '@/core/types';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { CharacterImage, CharacterState } from '@/components/character-image';
import { BacGraph } from '@/components/bac-graph';

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
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
    maxWidth: '85%',
    ...cardShadowSm,
  },
  text: {
    color: AppColors.navy,
    fontWeight: '500',
    fontSize: 14,
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
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    ...cardShadow,
  },
  label: { fontSize: 12, color: AppColors.sub, fontWeight: '500' },
  time: {
    fontSize: 44,
    fontWeight: '800',
    color: AppColors.navy,
    letterSpacing: 2,
    marginVertical: 8,
    fontVariant: ['tabular-nums'],
  },
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#E8E6FF',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: AppColors.accent,
    borderRadius: 3,
  },
  subLabel: { fontSize: 11, color: AppColors.sub, marginTop: 6 },
});

// ── Record tile ───────────────────────────────────────────────────────────────

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface RecordTileProps {
  record: DrinkRecord;
  presetEmoji: string;
  onEdit: () => void;
  onFinish: () => void;
  onDelete: () => void;
}

function RecordTile({ record, presetEmoji, onEdit, onFinish, onDelete }: RecordTileProps) {
  const isDrinking = record.finishedAt == null;
  const abvStr = record.abvPercent % 1 === 0
    ? record.abvPercent.toString()
    : record.abvPercent.toFixed(1);
  const volumeStr = record.volumeMl.toFixed(0);
  // 술 이름: 프리셋 라벨, 없으면(직접 입력) 도수·용량 라벨
  const title = record.presetLabel
    ?? i18n.t('recordAbvVolumeLabel', { abv: abvStr, volume: volumeStr });

  return (
    <TouchableOpacity
      style={tileStyles.container}
      onPress={onEdit}
      activeOpacity={0.8}
    >
      {/* Row 1: 이모지 + 이름/시각 + 삭제 */}
      <View style={tileStyles.row}>
        <View style={tileStyles.emojiCircle}>
          <Text style={tileStyles.emojiText}>{presetEmoji}</Text>
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
          <Text style={tileStyles.deleteText}>🗑</Text>
        </TouchableOpacity>
      </View>
      {/* Row 2: 도수·용량 뱃지 (+ 다마심) */}
      <View style={[tileStyles.row, { marginTop: 8 }]}>
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
    borderRadius: 16,
    padding: 12,
    ...cardShadowSm,
  },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  emojiCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EEEDF8', alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 20 },
  titleCol: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { fontSize: 14, fontWeight: '600', color: '#2D2B52', flexShrink: 1 },
  spacer: { flex: 1 },
  drinkingBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FFD97D',
  },
  drinkingBadgeText: { fontSize: 11, fontWeight: '600', color: '#B07B00' },
  abvBadge: {
    backgroundColor: '#F0EEFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, color: AppColors.accent, fontWeight: '500' },
  finishedText: { fontSize: 12, color: AppColors.sub, fontWeight: '500', flex: 1 },
  deleteText: { fontSize: 18 },
  recordedTime: { fontSize: 11, color: AppColors.sub },
  finishBtn: {
    backgroundColor: AppColors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  finishBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});

// ── BAC comparison card ───────────────────────────────────────────────────────

function getBacBadge(bac: number): { label: string; color: string; bg: string } | null {
  if (bac >= 0.08) return { label: i18n.t('bacStatusRevocation'), color: '#FF3B30', bg: '#FFF0EF' };
  if (bac >= 0.03) return { label: i18n.t('bacStatusSuspension'), color: '#FF9500', bg: '#FFF8F0' };
  return null;
}

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
              {statusBadge.label}
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
        <Text style={compStyles.timeIcon}>🕐</Text>
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
    borderRadius: 20,
    padding: 16,
    ...cardShadow,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '700', color: AppColors.navy },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  panels: { flexDirection: 'row', gap: 10 },
  panel: {
    flex: 1,
    backgroundColor: '#F4F3FC',
    borderRadius: 14,
    padding: 12,
  },
  panelConservative: {
    borderWidth: 1.2,
    borderColor: '#B3C7F7',
  },
  panelLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  methodLabel: { fontSize: 12, fontWeight: '700', color: AppColors.navy, flexShrink: 1 },
  consBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  consBadgeText: { fontSize: 9, fontWeight: '600', color: '#1565C0' },
  methodDesc: { fontSize: 10, color: AppColors.sub, marginTop: 2, minHeight: 26 },
  bacRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  bigBac: { fontSize: 22, fontWeight: '800', color: AppColors.accent, letterSpacing: -0.5 },
  bigBacUnit: { fontSize: 13, fontWeight: '600', color: AppColors.accent, marginLeft: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  timeIcon: { fontSize: 10 },
  timeText: { fontSize: 13, fontWeight: '600', color: AppColors.navy },
  footnote: { fontSize: 11, color: AppColors.sub, lineHeight: 16 },
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
        <Text style={safeStyles.infoBtnText}>📖 {i18n.t('infoScreenTitle')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const safeStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  title: { fontSize: 22, fontWeight: '800', color: AppColors.navy },
  subtitle: { fontSize: 13, color: AppColors.sub, textAlign: 'center' },
  infoBtn: {
    borderWidth: 1,
    borderColor: '#C9C4F0',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  infoBtnText: { color: AppColors.accent, fontWeight: '600', fontSize: 13 },
});

// ── Tip banner ────────────────────────────────────────────────────────────────

function TipBanner() {
  return (
    <View style={tipStyles.container}>
      <Text style={{ fontSize: 26 }}>💧</Text>
      <Text style={tipStyles.text}>{i18n.t('tipBannerText')}</Text>
    </View>
  );
}

const tipStyles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5D2F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: { flex: 1, fontSize: 13, color: AppColors.accent, fontWeight: '500' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TimerScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  void locale;

  const records = sessionStore(s => s.records);
  const finishRecord = sessionStore(s => s.finishRecord);
  const deleteRecord = sessionStore(s => s.deleteRecord);
  const checkAutoClose = sessionStore(s => s.checkAutoClose);
  const profile = profileStore(s => s.profile);
  const presets = presetsStore(s => s.presets);
  const emojiFor = useCallback(
    (label?: string) =>
      presets.find(p => p.label === label)?.emoji ?? '🍹',
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

  function handleDeleteRecord(record: DrinkRecord) {
    Alert.alert(i18n.t('deleteRecordTitle'), i18n.t('deleteRecordConfirm'), [
      { text: i18n.t('settingsCancel'), style: 'cancel' },
      {
        text: i18n.t('settingsDelete'),
        style: 'destructive',
        onPress: () => { if (record.id != null) deleteRecord(record.id).catch(() => {}); },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <Text style={styles.appTitle}>{i18n.t('appTitle').toLowerCase()}</Text>
        <TouchableOpacity onPress={() => router.push('/info')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.infoIcon}>ℹ️</Text>
        </TouchableOpacity>
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
                presetEmoji={emojiFor(record.presetLabel)}
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
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.navy,
    letterSpacing: -0.5,
  },
  infoIcon: { fontSize: 22 },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    paddingBottom: 100,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  charWrapper: { alignItems: 'center' },
  drinkingOnlyBadge: {
    alignSelf: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FFD97D',
  },
  drinkingOnlyText: { fontSize: 13, fontWeight: '600', color: '#B07B00' },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: AppColors.navy },
  addBtn: { fontSize: 13, fontWeight: '600', color: AppColors.accent },
  fab: {
    position: 'absolute',
    bottom: 84,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
