import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppColors, cardShadowSm } from '@/constants/colors';
import { CharacterImage } from '@/components/character-image';
import { confirm } from '@/components/dialog';
import { DrinkIcon, DrinkIconName, resolveDrinkIcon } from '@/components/drink-icon';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { i18n } from '@/i18n';
import { localeStore } from '@/state/localeStore';
import { presetsStore } from '@/state/presetsStore';
import { sessionStore } from '@/state/sessionStore';
import { getBacBadge } from '@/core/sessionUtils';
import { DrinkRecord, DrinkSession } from '@/core/types';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

/**
 * 지난 술자리 기록 화면.
 *
 * 상세 기록(잔 목록)은 접지 않고 항상 펼쳐 둔다.
 * 대신 각 카드가 마운트될 때 자기 몫만 읽어, 세션이 쌓여도 첫 화면에서
 * 전체를 한꺼번에 긁지 않는다 (FlatList 가 보이는 행만 마운트한다).
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

const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/** 술 아이콘을 감싸는 원 — 홈의 기록 타일과 같은 40 */
const ICON_CIRCLE = Space.xxxl + Space.sm;

/**
 * 이 화면의 유일한 기간 포맷 — 지표 타일과 잔 목록이 같은 함수를 쓴다.
 *
 * 세 단계: 1시간 미만은 분만, 하루 미만은 시간+분, 그 이상은 일+시간.
 * 타일과 행이 서로 다른 포맷을 쓰면 같은 화면에서 1분짜리가 한쪽은
 * 「1분」, 다른 쪽은 「0시간 1분」으로 찍힌다. 분기를 늘리지 말고 여기만 고칠 것.
 * (24시간 초과는 consumedAt 을 손으로 과거로 잡을 수 있어 실제로 도달한다.
 *  그 자리에서 분까지 쓰면 세 단위가 되어 타일 폭을 넘기므로 일·시간만 쓴다.)
 */
function formatDuration(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped >= DAY_MS) {
    return i18n.t('historyDurationDays', {
      days: Math.floor(clamped / DAY_MS),
      hours: Math.floor((clamped % DAY_MS) / HOUR_MS),
    });
  }
  if (clamped >= HOUR_MS) {
    return i18n.t('historyDuration', {
      hours: Math.floor(clamped / HOUR_MS),
      minutes: Math.floor((clamped % HOUR_MS) / MINUTE_MS),
    });
  }
  return i18n.t('historyDurationMinutes', {
    minutes: Math.floor(clamped / MINUTE_MS),
  });
}

/**
 * 해독 소요 시간 표시.
 *
 * estimatedSoberAt 은 firstFinishedAt 기준이라(bacCalculator.ts:148)
 * soberAt 이 lastFinishedAt 보다 앞서거나(한 잔이면 아주 조금 뒤에) 놓인다.
 * 분 단위로 0이 되는 값은 음수든 양수든 사용자에게는 같은 사실 —
 * 마지막 잔을 비웠을 때 이미 깬 상태 — 이므로 한 문구로 묶는다.
 * `<= 0` 으로만 잡으면 1잔짜리 세션이 「0분」으로 새어 나간다.
 */
function formatSoberDuration(ms: number): string {
  if (ms < MINUTE_MS) return i18n.t('historySoberImmediate');
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
  // 라벨이 길어 한쪽만 두 줄이 되면 값의 높이가 서로 어긋난다.
  // 행이 stretch 라 두 타일 높이는 같으므로, 라벨은 위·값은 아래로 붙여
  // 줄 수와 무관하게 값끼리 같은 선에 놓이게 한다
  item: { flex: 1, gap: Space.xxs, justifyContent: 'space-between' },
  // 두 줄로 접힐 때 아이콘이 가운데 뜨지 않고 첫 줄에 맞도록
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.xs },
  // flex 가 없으면 행 안에서 줄바꿈되지 않고 타일 밖으로 밀린다
  label: { flex: 1, fontSize: Font.caption, color: AppColors.sub },
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
  iconFor: (label?: string) => DrinkIconName;
  onDelete: () => void;
}

function SessionCard({ session, locale, iconFor, onDelete }: SessionCardProps) {
  const getSessionRecords = sessionStore(s => s.getSessionRecords);
  const [records, setRecords] = useState<DrinkRecord[] | null>(null);

  // 마운트될 때 그 카드 몫만 읽는다. FlatList 가 보이는 행만 그리므로
  // 화면 전체 세션을 미리 긁지 않고도 실질적으로 지연 로딩이 된다
  useEffect(() => {
    let alive = true;
    getSessionRecords(session.id)
      .then(loaded => {
        if (alive) setRecords(loaded);
      })
      // 조회에 실패하면 상세 기록 없이 카드만 보여준다 (조용한 degradation)
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [getSessionRecords, session.id]);

  const badge = getBacBadge(session.peakBac);

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.body}>
        {/* 헤더: 날짜 + 시간대 + 삭제 */}
        <View style={cardStyles.header}>
          <View style={cardStyles.headerText}>
            <Text style={cardStyles.date}>{formatDate(session.startedAt, locale)}</Text>
            <Text style={cardStyles.range}>
              {`${i18n.t('historyTimeRange', {
                start: formatTime(session.startedAt),
                end: formatTime(session.lastFinishedAt),
              })} · ${i18n.t('historyDrinkCount', { n: session.drinkCount })}`}
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
      </View>

      {/* 상세 기록 — 항상 펼쳐진 상태.
          구분선·제목까지 묶어서 기다렸다가 한 번에 넣는다. 제목만 먼저 띄우면
          스크롤할 때마다 카드가 두 번 자라 보인다 */}
      {records != null && records.length > 0 && (
        <View style={cardStyles.drinkList}>
          <Text style={cardStyles.drinkListTitle}>{i18n.t('historyDrinkList')}</Text>
          {records.map((record, index) => (
            <DrinkRow
              key={record.id ?? index}
              record={record}
              icon={iconFor(record.presetLabel)}
            />
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
    // 행이 아이콘·2줄 텍스트·칩으로 커져서 sm 로는 서로 붙어 보인다
    gap: Space.md,
  },
  drinkListTitle: {
    fontSize: Font.caption,
    fontWeight: Weight.semibold,
    color: AppColors.sub,
  },
});

// ── 잔 한 줄 ──────────────────────────────────────────────────────────────────

/**
 * 잔 한 줄 — 홈의 「오늘의 음주 기록」 타일과 같은 생김새로 맞춘다.
 * 좌측 원형 틴트 안 술 아이콘 / 이름 · 시간대 · 소요 시간 / 도수·용량 칩.
 */
function DrinkRow({ record, icon }: { record: DrinkRecord; icon: DrinkIconName }) {
  const abvStr = record.abvPercent % 1 === 0
    ? record.abvPercent.toString()
    : record.abvPercent.toFixed(1);
  const volumeStr = record.volumeMl.toFixed(0);
  const abvVolume = i18n.t('recordAbvVolumeLabel', { abv: abvStr, volume: volumeStr });
  // 이름 자리에 도수·용량을 넣으면 아래 칩과 같은 값이 두 번 보인다.
  // 이름이 없는 기록은 「수동입력」로 표시하고 숫자는 칩에만 맡긴다
  const title = record.presetLabel ?? i18n.t('recordManualEntry');

  // 닫힌 세션이라 finishedAt 은 항상 있지만, DB 재로드 시 null 이 되는 필드라
  // 단언하지 않고 규약대로 != null 로 확인한다
  const finishedAt = record.finishedAt;
  const timeLine = finishedAt != null
    ? `${i18n.t('historyTimeRange', {
        start: formatTime(record.consumedAt),
        end: formatTime(finishedAt),
      })} · ${formatDuration(finishedAt - record.consumedAt)}`
    : formatTime(record.consumedAt);

  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.iconCircle}>
        <DrinkIcon name={icon} size={IconSize.lg} />
      </View>
      <View style={rowStyles.textCol}>
        {/* 높이는 자유롭게 써도 된다는 요청이라, 긴 이름은 잘라내지 않고 접는다 */}
        <Text style={rowStyles.title}>{title}</Text>
        <Text style={rowStyles.time}>{timeLine}</Text>
        <View style={rowStyles.abvChip}>
          <Text style={rowStyles.abvChipText}>{abvVolume}</Text>
        </View>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  iconCircle: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: Radius.xl,
    backgroundColor: AppColors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0, gap: Space.xxs, alignItems: 'flex-start' },
  title: { fontSize: Font.body, fontWeight: Weight.semibold, color: AppColors.navy },
  time: { fontSize: Font.caption, color: AppColors.sub },
  abvChip: {
    backgroundColor: AppColors.chipBg,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xxs,
  },
  abvChipText: { fontSize: Font.micro, color: AppColors.accent },
});

// ── 화면 ──────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  const sessions = sessionStore(s => s.sessions);
  const deleteSession = sessionStore(s => s.deleteSession);
  const presets = presetsStore(s => s.presets);

  // 기록에는 라벨만 남아 있어 프리셋을 되짚어 아이콘을 찾는다.
  // 홈 화면(index.tsx)의 iconFor 와 같은 경로 — 직접 입력 기록은 기본 컵
  const iconFor = useCallback(
    (label?: string): DrinkIconName => {
      const preset = presets.find(p => p.label === label);
      return preset ? resolveDrinkIcon(preset) : 'cup';
    },
    [presets],
  );

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
            iconFor={iconFor}
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
