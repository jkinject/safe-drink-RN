import { forwardRef, useCallback, useMemo, useRef } from 'react';
import { Image } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { AppColors, bacBadgeColors } from '@/constants/colors';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';
import { Text } from '@/components/typography';
import { CharacterImage, CharacterState } from '@/components/character-image';
import { BacGraph } from '@/components/bac-graph';
import { DrinkIcon, isDrinkIconName, resolveDrinkIcon } from '@/components/drink-icon';
import { presetsStore } from '@/state/presetsStore';
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

/**
 * 최고 혈중알코올농도로 캐릭터 표정을 정한다. 법령 뱃지와 같은 구간 —
 * 0.03% 미만은 멀쩡(greeting), 면허 정지 구간은 취기(drinking), 면허 취소 구간은 어지러움(dizzy).
 * 홈 화면은 "지금" 수치로 같은 표정을 고르지만, 카드는 지난 술자리라 정점을 쓴다.
 */
function characterForPeak(peakBac: number): CharacterState {
  if (peakBac >= 0.08) return 'dizzy';
  if (peakBac >= 0.03) return 'drinking';
  return 'greeting';
}

// 1254px 원본은 Android 에서 디코딩이 느려 캡처에 빠질 수 있어 96px 축소본을 쓴다
const APP_ICON = require('../../assets/images/app_icon_96.png');

/** 이미지가 무한정 길어지지 않게 마신 술은 이만큼만 */
const MAX_ROWS = 8;

function abvVolume(r: DrinkRecord): string {
  const abv = r.abvPercent % 1 === 0 ? r.abvPercent.toString() : r.abvPercent.toFixed(1);
  return i18n.t('recordAbvVolumeLabel', { abv, volume: r.volumeMl.toFixed(0) });
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
  /** 카드 안 이미지(캐릭터·앱 아이콘·술 아이콘)가 전부 디코딩되면 한 번 호출 */
  onReady?: () => void;
}

/**
 * 공유용 술자리 요약 카드. 화면에는 안 보이고 view-shot 으로만 찍힌다.
 * 기록 화면의 세션 카드와 같은 정보 + 앱 이름·스토어 주소 푸터.
 * 색·간격·글자는 전부 토큰 — 이 이미지가 밖에서 앱을 대표한다.
 */
export const SessionShareCard = forwardRef<View, Props>(function SessionShareCard(
  { session, records, profile, locale, onReady },
  ref,
) {
  const curve = useMemo(() => bacCurve(records, profile), [records, profile]);
  const markMs = useMemo(
    () => records.filter(r => r.finishedAt != null).map(r => r.finishedAt as number),
    [records],
  );
  const presets = presetsStore(s => s.presets);
  // 기록에 박힌 아이콘 우선, v4 이전 기록은 프리셋 라벨로 되짚는다 (history.tsx 와 같은 경로)
  const iconFor = (r: DrinkRecord) => {
    if (r.icon && isDrinkIconName(r.icon)) return r.icon;
    const preset = presets.find(p => p.label === r.presetLabel);
    return preset ? resolveDrinkIcon(preset) : 'cup';
  };
  const sorted = useMemo(() => [...records].sort((a, b) => a.consumedAt - b.consumedAt), [records]);
  const shownRecords = sorted.slice(0, MAX_ROWS);
  const hiddenCount = sorted.length - shownRecords.length;
  // 이미지가 덜 그려진 채 찍히면 아이콘 자리가 비거나 이전 아이콘이 남는다(Android 에서 실제로 겪음).
  // 캐릭터 + 앱 아이콘 + 술 아이콘 수만큼 onLoad 를 세어 전부 오면 onReady.
  const expectedImages = 2 + shownRecords.length;
  const loadedRef = useRef(0);
  const handleImageLoad = useCallback(() => {
    loadedRef.current += 1;
    if (loadedRef.current === expectedImages) onReady?.();
  }, [expectedImages, onReady]);
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
        <CharacterImage sex={profile.sex} state={characterForPeak(session.peakBac)} size={56} onLoad={handleImageLoad} />
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
        <View style={styles.metricDivider} />
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
          <Text style={styles.metricSub}>{i18n.t('bacAlcoholGramsValue', { g: session.totalAlcoholG.toFixed(1) })}</Text>
        </View>
      </View>

      {/* 마신 술 — 무엇을 얼마나. 너무 많으면 앞 MAX_ROWS 잔만 보이고 나머지는 잔 수로 */}
      <View style={styles.drinks}>
        <Text style={styles.sectionTitle}>{i18n.t('shareCardDrinksTitle')}</Text>
        {shownRecords.map((r, i) => (
          <View key={r.id ?? i} style={styles.drinkRow}>
            <View style={styles.drinkIcon}>
              <DrinkIcon name={iconFor(r)} size={IconSize.md} onLoad={handleImageLoad} />
            </View>
            <Text style={styles.drinkName} numberOfLines={1}>
              {r.presetLabel ?? i18n.t('recordManualEntry')}
            </Text>
            <Text style={styles.drinkSpec}>{abvVolume(r)}</Text>
          </View>
        ))}
        {hiddenCount > 0 && (
          <Text style={styles.drinkMore}>{i18n.t('shareCardMoreDrinks', { n: hiddenCount })}</Text>
        )}
      </View>

      {curve.length > 1 && (
        <View style={styles.chart}>
          <Text style={styles.sectionTitle}>{i18n.t('shareCardChartTitle')}</Text>
          <BacGraph
            curve={curve}
            nowMs={null}
            firstMs={session.startedAt}
            soberMs={session.soberAt}
            height={130}
            variant="bare"
            markMs={markMs}
            soberLabel={`${i18n.t('historyChartSoberPrefix')} ${hm(session.soberAt)}`}
          />
        </View>
      )}

      <View style={styles.footer}>
        <Image source={APP_ICON} style={styles.footerIcon} onLoad={handleImageLoad} />
        <Text style={styles.footerBrand}>safedrink</Text>
        <Text style={styles.footerTagline}>{i18n.t('shareCardTagline')}</Text>
      </View>
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
  metrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: AppColors.panel,
    borderRadius: Radius.lg,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
  },
  metric: { flex: 1, minWidth: 0, gap: Space.xxs },
  metricDivider: { width: 1, backgroundColor: AppColors.border, marginHorizontal: Space.md },
  metricLabel: { fontSize: Font.micro, color: AppColors.sub },
  metricValue: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.navy },
  metricSub: { fontSize: Font.micro, color: AppColors.sub },
  // 영어 뱃지("License suspension")는 한 줄에 안 들어가므로 값 아래로 접히게 둔다
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, flexWrap: 'wrap' },
  badge: { paddingHorizontal: Space.xs, paddingVertical: Space.xxs, borderRadius: Radius.sm, flexShrink: 1 },
  badgeText: { fontSize: Font.micro, fontWeight: Weight.bold },
  sectionTitle: { fontSize: Font.micro, fontWeight: Weight.semibold, color: AppColors.sub, letterSpacing: 0.2 },
  drinks: { gap: Space.sm },
  chart: { gap: Space.xs },
  drinkRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  drinkIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: AppColors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drinkName: { flex: 1, fontSize: Font.caption, fontWeight: Weight.semibold, color: AppColors.navy },
  drinkSpec: { fontSize: Font.micro, color: AppColors.sub },
  drinkMore: { fontSize: Font.micro, color: AppColors.sub, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Space.md,
  },
  footerIcon: { width: 24, height: 24, borderRadius: Radius.sm },
  footerBrand: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.navy, letterSpacing: -0.3 },
  footerTagline: { flex: 1, fontSize: Font.caption, color: AppColors.sub, textAlign: 'right' },
});
