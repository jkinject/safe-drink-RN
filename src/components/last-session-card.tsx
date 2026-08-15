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

const MINUTE_MS = 60000;
const HOUR_MS = 3600000;

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
  // 분 단위로 0이 되는 값은 음수든 양수든 같은 사실이라 한 문구로 묶는다.
  // `<= 0` 으로만 잡으면 1잔짜리 세션이 「0시간 0분」으로 새어 나간다.
  // 1시간 미만은 분만 쓴다 — 「술 깨는 데 0시간 40분」도 같은 종류의 흠이다
  const soberMs = session.soberAt - session.lastFinishedAt;
  const soberText = soberMs < MINUTE_MS
    ? i18n.t('historySoberImmediate')
    : soberMs < HOUR_MS
      ? i18n.t('historySoberTimeMinutes', {
          minutes: Math.floor(soberMs / MINUTE_MS),
        })
      : i18n.t('historySoberTime', {
          hours: Math.floor(soberMs / HOUR_MS),
          minutes: Math.floor((soberMs % HOUR_MS) / MINUTE_MS),
        });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Icon name="history" size={IconSize.md} color={AppColors.accent} strokeWidth={2.1} />
        <Text style={styles.label}>{i18n.t('historyLastSession')}</Text>
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

      {/* 눌러서 넘어간다는 걸 보이게 하는 알약 버튼.
          카드 전체가 이미 눌리는 영역이라 여기에 별도 터치 대상을 겹치지 않고
          보이기만 하는 View 로 둔다 — 중첩 터치는 눌림 반응이 어긋난다 */}
      <View style={styles.cta} pointerEvents="none">
        <Text style={styles.ctaText}>{i18n.t('historyViewAll')}</Text>
        {/* 아이콘 세트에 오른쪽 화살표가 없어 아래 화살표를 돌려 쓴다.
            Icon 은 style 을 받지 않으므로 회전은 감싼 View 에 건다 */}
        <View style={styles.ctaChevron}>
          <Icon
            name="chevronDown"
            size={IconSize.sm}
            color={AppColors.accent}
            strokeWidth={2.4}
          />
        </View>
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
  date: { fontSize: Font.body, fontWeight: Weight.semibold, color: AppColors.navy },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  metric: { fontSize: Font.bodySm, color: AppColors.sub },
  dot: {
    width: Space.xs,
    height: Space.xs,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.border,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    backgroundColor: AppColors.bg,
    borderRadius: Radius.pill,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    marginTop: Space.xs,
  },
  ctaText: { fontSize: Font.body, fontWeight: Weight.semibold, color: AppColors.accent },
  ctaChevron: { transform: [{ rotate: '-90deg' }] },
});
