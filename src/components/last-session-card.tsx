import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppColors, cardShadowSm } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { Text } from '@/components/typography';
import { i18n } from '@/i18n';
import { localeStore } from '@/state/localeStore';
import { DrinkSession } from '@/core/types';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

/**
 * 홈 화면 대기 상태에 얹는 「직전 술자리」 요약 카드.
 *
 * 술을 안 마시고 있을 때 홈이 완전히 비어 보이지 않도록 마지막 세션만
 * 짧게 보여주고, 누르면 전체 기록 화면으로 넘긴다.
 */

/** 세션 요약에서 쓰는 짧은 날짜 — 「8월 14일 (목)」 */
function formatSessionDate(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

interface LastSessionCardProps {
  session: DrinkSession;
  onPress: () => void;
}

export function LastSessionCard({ session, onPress }: LastSessionCardProps) {
  const locale = localeStore(s => s.locale);

  // 해독에 걸린 시간 = BAC 0 도달 시각 − 마지막 잔을 비운 시각.
  // estimatedSoberAt 이 firstFinishedAt 기준이라(bacCalculator.ts:148) 천천히
  // 오래 마신 자리에서는 음수가 된다 — 그때는 「0시간 0분」 대신 별도 문구를 쓴다
  const soberMs = session.soberAt - session.lastFinishedAt;
  const soberText = soberMs <= 0
    ? i18n.t('historySoberImmediate')
    : i18n.t('historySoberTime', {
        hours: Math.floor(soberMs / 3600000),
        minutes: Math.floor((soberMs % 3600000) / 60000),
      });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <Icon name="history" size={IconSize.md} color={AppColors.accent} strokeWidth={2.1} />
        <Text style={styles.label}>{i18n.t('historyLastSession')}</Text>
        <Text style={styles.viewAll}>{i18n.t('historyViewAll')}</Text>
      </View>

      <Text style={styles.date}>
        {formatSessionDate(session.startedAt, locale)}
      </Text>

      <View style={styles.metrics}>
        <Text style={styles.metric}>
          {i18n.t('historyTotalAlcohol', { g: session.totalAlcoholG.toFixed(1) })}
        </Text>
        <View style={styles.dot} />
        <Text style={styles.metric}>
          {soberText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xl,
    gap: Space.sm,
    ...cardShadowSm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  label: {
    flex: 1,
    fontSize: Font.h4,
    fontWeight: Weight.bold,
    color: AppColors.navy,
  },
  viewAll: { fontSize: Font.caption, color: AppColors.sub },
  date: { fontSize: Font.body, fontWeight: Weight.semibold, color: AppColors.navy },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  metric: { fontSize: Font.bodySm, color: AppColors.sub },
  dot: {
    width: Space.xs,
    height: Space.xs,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.border,
  },
});
