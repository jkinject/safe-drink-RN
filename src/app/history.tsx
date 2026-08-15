import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppColors, cardShadowSm } from '@/constants/colors';
import { CharacterImage } from '@/components/character-image';
import { confirm } from '@/components/dialog';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { i18n } from '@/i18n';
import { localeStore } from '@/state/localeStore';
import { sessionStore } from '@/state/sessionStore';
import { getBacBadge } from '@/core/sessionUtils';
import { DrinkRecord, DrinkSession } from '@/core/types';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

/**
 * 지난 술자리 기록 화면.
 *
 * 카드를 누르면 그때서야 해당 세션의 잔 목록을 DB 에서 읽는다.
 * 세션이 쌓일수록 전체를 미리 불러오면 첫 화면이 느려지므로 펼칠 때만 조회한다.
 */

// ── 표시용 포맷 ────────────────────────────────────────────────────────────────

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(epochMs: number, locale: string): string {
  return new Date(epochMs).toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/**
 * ms → 「N시간 M분」. 하루를 넘기면 「N일 N시간」으로 넘긴다.
 *
 * consumedAt 을 손으로 과거 시각으로 잡을 수 있어 24시간 초과가 실제로 나온다.
 * 그 자리에서 분까지 쓰면 세 단위가 되어 타일 폭을 넘기므로 일·시간만 쓴다.
 */
function formatDuration(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped >= DAY_MS) {
    return i18n.t('historyDurationDays', {
      days: Math.floor(clamped / DAY_MS),
      hours: Math.floor((clamped % DAY_MS) / HOUR_MS),
    });
  }
  return i18n.t('historyDuration', {
    hours: Math.floor(clamped / HOUR_MS),
    minutes: Math.floor((clamped % HOUR_MS) / 60000),
  });
}

/**
 * 해독 소요 시간 표시.
 *
 * estimatedSoberAt 은 firstFinishedAt 기준이라(bacCalculator.ts:148)
 * 천천히 오래 마신 자리에서는 soberAt 이 lastFinishedAt 보다 앞설 수 있다.
 * 그 경우 「0시간 0분」은 고장으로 보이므로 별도 문구를 쓴다.
 */
function formatSoberDuration(ms: number): string {
  if (ms <= 0) return i18n.t('historySoberImmediate');
  return formatDuration(ms);
}

// ── 지표 타일 ─────────────────────────────────────────────────────────────────

interface MetricProps {
  icon: IconName;
  label: string;
  value: string;
  badge?: { label: string; color: string; bg: string } | null;
}

function Metric({ icon, label, value, badge }: MetricProps) {
  return (
    <View style={metricStyles.item}>
      <View style={metricStyles.labelRow}>
        <Icon name={icon} size={IconSize.sm} color={AppColors.sub} strokeWidth={2.1} />
        <Text style={metricStyles.label}>{label}</Text>
      </View>
      <View style={metricStyles.valueRow}>
        <Text style={metricStyles.value}>{value}</Text>
        {!!badge && (
          <View style={[metricStyles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[metricStyles.badgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  item: { flex: 1, gap: Space.xxs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  label: { fontSize: Font.caption, color: AppColors.sub },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, flexWrap: 'wrap' },
  value: { fontSize: Font.body, fontWeight: Weight.semibold, color: AppColors.navy },
  badge: {
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xxs,
    borderRadius: Radius.sm,
  },
  badgeText: { fontSize: Font.micro, fontWeight: Weight.bold },
});

// ── 세션 카드 ─────────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: DrinkSession;
  locale: string;
  onDelete: () => void;
}

function SessionCard({ session, locale, onDelete }: SessionCardProps) {
  const getSessionRecords = sessionStore(s => s.getSessionRecords);
  const [expanded, setExpanded] = useState(false);
  const [records, setRecords] = useState<DrinkRecord[] | null>(null);

  const toggle = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    // 한 번 읽어온 세션은 다시 조회하지 않는다 — 닫힌 세션은 변하지 않는다
    if (records != null) {
      setExpanded(true);
      return;
    }
    // 조회에 실패하면 반쯤 펼쳐진 빈 목록을 남기지 말고 접힌 채로 둔다.
    // onPress 에 async 함수를 직접 물리면 여기서 unhandled rejection 이 된다
    getSessionRecords(session.id)
      .then(loaded => {
        setRecords(loaded);
        setExpanded(true);
      })
      .catch(() => setExpanded(false));
  }, [expanded, records, getSessionRecords, session.id]);

  const badge = getBacBadge(session.peakBac);

  return (
    <View style={cardStyles.card}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={cardStyles.body}>
        {/* 헤더: 날짜 + 시간대 + 삭제 */}
        <View style={cardStyles.header}>
          <View style={cardStyles.headerText}>
            <Text style={cardStyles.date}>{formatDate(session.startedAt, locale)}</Text>
            <Text style={cardStyles.range}>
              {`${formatTime(session.startedAt)} ~ ${formatTime(session.lastFinishedAt)} · ${i18n.t('historyDrinkCount', { n: session.drinkCount })}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: Space.sm, bottom: Space.sm, left: Space.sm, right: Space.sm }}
          >
            <Icon name="delete" size={IconSize.md} color={AppColors.sub} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* 2x2 지표 */}
        <View style={cardStyles.metricRow}>
          <Metric
            icon="clock"
            label={i18n.t('historySoberDuration')}
            value={formatSoberDuration(session.soberAt - session.lastFinishedAt)}
          />
          <Metric
            icon="water"
            label={i18n.t('bacSummaryAlcoholLabel')}
            value={i18n.t('bacAlcoholGramsValue', { g: session.totalAlcoholG.toFixed(1) })}
          />
        </View>
        <View style={cardStyles.metricRow}>
          <Metric
            icon={badge ? 'danger' : 'safe'}
            label={i18n.t('historyPeakBac')}
            value={`${session.peakBac.toFixed(3)}%`}
            badge={badge && { label: i18n.t(badge.labelKey), color: badge.color, bg: badge.bg }}
          />
          <Metric
            icon="timer"
            label={i18n.t('historySessionDuration')}
            value={formatDuration(session.lastFinishedAt - session.startedAt)}
          />
        </View>
      </TouchableOpacity>

      {/* 펼친 상태: 잔 목록 */}
      {expanded && (
        <View style={cardStyles.drinkList}>
          <Text style={cardStyles.drinkListTitle}>{i18n.t('historyDrinkList')}</Text>
          {(records ?? []).map((record, index) => (
            <DrinkRow key={record.id ?? index} record={record} />
          ))}
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    ...cardShadowSm,
  },
  body: { padding: Space.xl, gap: Space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm },
  headerText: { flex: 1, gap: Space.xxs },
  date: { fontSize: Font.h4, fontWeight: Weight.bold, color: AppColors.navy },
  range: { fontSize: Font.caption, color: AppColors.sub },
  metricRow: { flexDirection: 'row', gap: Space.md },
  drinkList: {
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    gap: Space.sm,
  },
  drinkListTitle: {
    fontSize: Font.caption,
    fontWeight: Weight.semibold,
    color: AppColors.sub,
  },
});

// ── 잔 한 줄 ──────────────────────────────────────────────────────────────────

function DrinkRow({ record }: { record: DrinkRecord }) {
  const abvStr = record.abvPercent % 1 === 0
    ? record.abvPercent.toString()
    : record.abvPercent.toFixed(1);
  const volumeStr = record.volumeMl.toFixed(0);
  const abvVolume = i18n.t('recordAbvVolumeLabel', { abv: abvStr, volume: volumeStr });
  // 직접 입력 기록은 이름 자체가 도수·용량이라, 오른쪽에 같은 값을 또 쓰지 않는다
  const title = record.presetLabel ?? abvVolume;

  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.time}>{formatTime(record.consumedAt)}</Text>
      <Text style={rowStyles.title} numberOfLines={1}>{title}</Text>
      {record.presetLabel != null && (
        <Text style={rowStyles.detail}>{abvVolume}</Text>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  time: { fontSize: Font.caption, color: AppColors.sub },
  title: { flex: 1, fontSize: Font.bodySm, color: AppColors.navy },
  detail: { fontSize: Font.caption, color: AppColors.sub },
});

// ── 화면 ──────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  const sessions = sessionStore(s => s.sessions);
  const deleteSession = sessionStore(s => s.deleteSession);

  const handleDelete = useCallback(
    async (sessionId: number) => {
      const ok = await confirm({
        title: i18n.t('historyDeleteTitle'),
        message: i18n.t('historyDeleteConfirm'),
        confirmLabel: i18n.t('settingsDelete'),
        cancelLabel: i18n.t('settingsCancel'),
        destructive: true,
      });
      if (ok) await deleteSession(sessionId);
    },
    [deleteSession],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* AppBar — 좌우 폭이 같아야 가운데 타이틀이 실제로 가운데 온다 */}
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.appBarSide}
          onPress={() => router.back()}
          hitSlop={{ top: Space.sm, bottom: Space.sm, left: Space.sm, right: Space.sm }}
        >
          <Icon name="close" size={IconSize.lg} color={AppColors.sub} />
        </TouchableOpacity>
        <Text style={styles.appTitle}>{i18n.t('historyScreenTitle')}</Text>
        <View style={styles.appBarSide} />
      </View>

      <FlatList
        data={sessions}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            locale={locale}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          sessions.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <CharacterImage state="greeting" />
            <Text style={styles.emptyTitle}>{i18n.t('historyEmpty')}</Text>
            <Text style={styles.emptyDesc}>{i18n.t('historyEmptyDesc')}</Text>
          </View>
        }
      />
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
  appBarSide: { width: Space.xxxl, alignItems: 'flex-start' },
  appTitle: {
    fontSize: Font.h3,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    flex: 1,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xs,
    paddingBottom: Space.xxxl,
    gap: Space.lg,
  },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: Space.sm },
  emptyTitle: { fontSize: Font.h4, fontWeight: Weight.bold, color: AppColors.navy },
  emptyDesc: { fontSize: Font.body, color: AppColors.sub, textAlign: 'center' },
});
