import { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppColors, StatusColors, bacBadgeColors } from '@/constants/colors';
import { Font, Radius, Space, Weight } from '@/constants/tokens';
import { Text } from '@/components/typography';
import { CharacterImage } from '@/components/character-image';
import { BacGraph } from '@/components/bac-graph';
import { Icon } from '@/components/icon';
import { i18n } from '@/i18n';
import { bacCurve } from '@/core/bacCalculator';
import { getBacBadge } from '@/core/sessionUtils';
import type { DrinkRecord, DrinkSession, UserProfile } from '@/core/types';

/** 공유 이미지 폭(pt). 캡처는 pixelRatio 3 → 1080px */
export const SHARE_CARD_WIDTH = 360;

function hm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function duration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return i18n.t('historyDurationMinutes', { minutes });
  return i18n.t('historyDuration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

interface Props {
  session: DrinkSession;
  records: DrinkRecord[];
  profile: UserProfile;
  locale: string;
}

/**
 * 공유용 술자리 요약 카드. 화면에는 안 보이고 view-shot 으로만 찍힌다.
 * 기록 화면의 세션 카드와 같은 정보 + 앱 이름·스토어 주소 푸터.
 * 색·간격·글자는 전부 토큰 — 이 이미지가 밖에서 앱을 대표한다.
 */
export const SessionShareCard = forwardRef<View, Props>(function SessionShareCard(
  { session, records, profile, locale },
  ref,
) {
  const curve = useMemo(() => bacCurve(records, profile), [records, profile]);
  const markMs = useMemo(
    () => records.filter(r => r.finishedAt != null).map(r => r.finishedAt as number),
    [records],
  );
  const badge = getBacBadge(session.peakBac);
  const badgeColors = badge ? bacBadgeColors(badge.level) : null;
  const date = new Date(session.startedAt).toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.header}>
        <CharacterImage sex={profile.sex} state="greeting" size={56} />
        <View style={styles.headerText}>
          <Text style={styles.date}>{date}</Text>
          <Text style={styles.range}>
            {`${i18n.t('historyTimeRange', { start: hm(session.startedAt), end: hm(session.lastFinishedAt) })} · ${i18n.t('historyDrinkCount', { n: session.drinkCount })}`}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{i18n.t('historySoberAt')}</Text>
          <Text style={styles.metricValue}>{hm(session.soberAt)}</Text>
          <Text style={styles.metricSub}>
            {session.soberAt - session.lastFinishedAt < 60000
              ? i18n.t('historySoberTookImmediate')
              : i18n.t('historySoberTook', { duration: duration(session.soberAt - session.lastFinishedAt) })}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{i18n.t('historyPeakBac')}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.metricValue}>{`${session.peakBac.toFixed(3)}%`}</Text>
            {badge && badgeColors && (
              <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
                <Text style={[styles.badgeText, { color: badgeColors.color }]}>{i18n.t(badge.labelKey)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.metricSub}>{i18n.t('bacAlcoholGramsValue', { g: session.totalAlcoholG.toFixed(1) })} · {duration(session.lastFinishedAt - session.startedAt)}</Text>
        </View>
      </View>

      {curve.length > 1 && (
        <BacGraph
          curve={curve}
          nowMs={null}
          firstMs={session.startedAt}
          soberMs={session.soberAt}
          height={150}
          variant="bare"
          markMs={markMs}
          soberLabel={`${i18n.t('historyChartSoberPrefix')} ${hm(session.soberAt)}`}
        />
      )}

      <View style={styles.footer}>
        <Icon name="timer" size={16} color={AppColors.accent} strokeWidth={2.2} />
        <Text style={styles.footerBrand}>safedrink</Text>
      </View>
      <Text style={styles.disclaimer}>{i18n.t('disclaimerText')}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xl,
    gap: Space.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  headerText: { flex: 1, gap: Space.xxs },
  date: { fontSize: Font.h3, fontWeight: Weight.bold, color: AppColors.navy },
  range: { fontSize: Font.caption, color: AppColors.sub },
  metrics: { flexDirection: 'row', gap: Space.md },
  metric: { flex: 1, backgroundColor: AppColors.panel, borderRadius: Radius.lg, padding: Space.md, gap: Space.xxs },
  metricLabel: { fontSize: Font.caption, color: AppColors.sub },
  metricValue: { fontSize: Font.h3, fontWeight: Weight.bold, color: AppColors.navy },
  metricSub: { fontSize: Font.micro, color: AppColors.sub },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, flexWrap: 'wrap' },
  badge: { paddingHorizontal: Space.sm, paddingVertical: Space.xxs, borderRadius: Radius.sm },
  badgeText: { fontSize: Font.micro, fontWeight: Weight.bold },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Space.md,
  },
  footerBrand: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.navy, letterSpacing: -0.3 },
  disclaimer: { fontSize: Font.micro, color: StatusColors.warningText, textAlign: 'center' },
});
