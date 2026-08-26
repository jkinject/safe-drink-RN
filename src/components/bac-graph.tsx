import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { AppColors } from '@/constants/colors';
import { i18n } from '@/i18n';
import { Text } from '@/components/typography';
import { Space, Radius, Font, Weight } from '@/constants/tokens';

const CHART_HEIGHT = 170;
const PAD_LEFT = 4;
const PAD_RIGHT = 78; // 우측 기준선 라벨 영역 (Flutter판과 동일하게 우측 배치)
const PAD_TOP = 14;
const PAD_BOTTOM = 6;

const BAC_REVOCATION = 0.08;
const BAC_SUSPENSION = 0.03;

interface Props {
  curve: Array<[number, number]>; // [epochMs, bac%]
  /** 지금 마커 위치. null 이면 마커를 그리지 않는다 (지난 술자리) */
  nowMs: number | null;
  firstMs: number;
  soberMs: number;
  /** 차트 높이 (기본 170). 히스토리 카드처럼 좁은 자리는 낮춰 쓴다 */
  height?: number;
  /**
   * 'card' = 흰 카드 + 제목 (홈).
   * 'bare' = 배경·제목 없이 그래프만 (이미 카드 안에 들어가는 히스토리).
   */
  variant?: 'card' | 'bare';
  /** 우측 하단 시각 라벨 문구 전체를 대체 (자정 넘김 표기 등) */
  soberLabel?: string;
  /** 잔을 비운 시각들 — 계단 꼭대기에 점을 찍는다 */
  markMs?: number[];
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function BacGraph({
  curve,
  nowMs,
  firstMs,
  soberMs,
  height = CHART_HEIGHT,
  variant = 'card',
  soberLabel,
  markMs,
}: Props) {
  // 실제 렌더 폭을 측정해 픽셀 좌표로 그린다 (viewBox 스케일링 왜곡 방지)
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const innerW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const INNER_H = height - PAD_TOP - PAD_BOTTOM;

  const maxBac = useMemo(() => {
    if (curve.length === 0) return 0.09;
    return Math.max(...curve.map(([, b]) => b), 0.09);
  }, [curve]);

  const toX = (t: number) =>
    soberMs <= firstMs
      ? PAD_LEFT
      : PAD_LEFT + ((t - firstMs) / (soberMs - firstMs)) * innerW;
  const toY = (bac: number) =>
    maxBac <= 0
      ? PAD_TOP + INNER_H
      : PAD_TOP + INNER_H - Math.min(bac / maxBac, 1) * INNER_H;

  const pathD = useMemo(() => {
    if (width === 0 || curve.length === 0) return '';
    const [t0, b0] = curve[0];
    let d = `M ${toX(t0).toFixed(1)},${toY(b0).toFixed(1)}`;
    for (let i = 1; i < curve.length; i++) {
      d += ` L ${toX(curve[i][0]).toFixed(1)},${toY(curve[i][1]).toFixed(1)}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, width, maxBac, firstMs, soberMs, height]);

  const yBase = PAD_TOP + INNER_H;
  const fillD = pathD
    ? `${pathD} L ${(PAD_LEFT + innerW).toFixed(1)},${yBase} L ${PAD_LEFT},${yBase} Z`
    : '';

  const yRev = toY(BAC_REVOCATION);
  const ySus = toY(BAC_SUSPENSION);

  const clampedNowX =
    nowMs == null
      ? PAD_LEFT
      : Math.max(PAD_LEFT, Math.min(PAD_LEFT + innerW, toX(nowMs)));
  const nowBac = useMemo(() => {
    if (curve.length === 0 || nowMs == null) return 0;
    let closest = curve[0];
    for (const p of curve) {
      if (Math.abs(p[0] - nowMs) < Math.abs(closest[0] - nowMs)) closest = p;
    }
    return closest[1];
  }, [curve, nowMs]);

  // 계단 꼭대기 — 그 시각의 곡선 값 중 가장 높은 표본(= 잔이 들어간 직후)
  const marks = useMemo(() => {
    if (!markMs || curve.length === 0) return [];
    return markMs
      .filter(t => t > firstMs && t < soberMs)
      .map(t => {
        let best = curve[0];
        for (const p of curve) {
          if (p[0] === t) best = p;
        }
        return [t, best[1]] as [number, number];
      });
  }, [markMs, curve, firstMs, soberMs]);

  return (
    <View style={variant === 'card' ? styles.wrapper : undefined}>
      {variant === 'card' && (
        <Text style={styles.title}>{i18n.t('bacChartTitle')}</Text>
      )}
      <View onLayout={onLayout}>
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={AppColors.accent} stopOpacity="0.25" />
                <Stop offset="100%" stopColor={AppColors.accent} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {/* 기준선: 면허 취소 0.08% (빨강 점선) + 우측 라벨 */}
            <Line
              x1={PAD_LEFT}
              y1={yRev}
              x2={PAD_LEFT + innerW}
              y2={yRev}
              stroke="rgba(255,59,48,0.6)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <SvgText
              x={PAD_LEFT + innerW + 6}
              y={yRev + 3}
              fontSize="10"
              fill="rgba(230,50,40,0.9)"
            >
              {i18n.t('bacChartDrivingLimitLabel')}
            </SvgText>

            {/* 기준선: 면허 정지 0.03% (주황 점선) + 우측 라벨 */}
            <Line
              x1={PAD_LEFT}
              y1={ySus}
              x2={PAD_LEFT + innerW}
              y2={ySus}
              stroke="rgba(255,149,0,0.6)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <SvgText
              x={PAD_LEFT + innerW + 6}
              y={ySus + 3}
              fontSize="10"
              fill="rgba(220,130,0,0.95)"
            >
              {i18n.t('bacChartCautionLimitLabel')}
            </SvgText>

            {/* 곡선 아래 영역 */}
            {fillD ? <Path d={fillD} fill="url(#areaGrad)" /> : null}

            {/* BAC 곡선 */}
            {pathD ? (
              <Path
                d={pathD}
                stroke={AppColors.accent}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {/* 잔을 비운 지점 */}
            {marks.map(([t, bac]) => (
              <Circle
                key={t}
                cx={toX(t)}
                cy={toY(bac)}
                r="3"
                fill={AppColors.accent}
              />
            ))}

            {/* 지금 마커 */}
            {nowMs != null && nowMs >= firstMs && nowMs <= soberMs && (
              <>
                <Line
                  x1={clampedNowX}
                  y1={PAD_TOP - 2}
                  x2={clampedNowX}
                  y2={yBase}
                  stroke={AppColors.sub}
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
                <Circle
                  cx={clampedNowX}
                  cy={toY(nowBac)}
                  r="4.5"
                  fill={AppColors.cardBg}
                  stroke={AppColors.accent}
                  strokeWidth="2.5"
                />
                <SvgText
                  x={Math.max(PAD_LEFT + 14, Math.min(clampedNowX, PAD_LEFT + innerW - 14))}
                  y={PAD_TOP - 3}
                  fontSize="10"
                  fontWeight="600"
                  fill={AppColors.navy}
                  textAnchor="middle"
                >
                  {i18n.t('bacChartNowLabel')}
                </SvgText>
              </>
            )}
          </Svg>
        )}
      </View>
      {/* 하단 시각 라벨 (그래프 영역 폭에 맞춤) */}
      <View style={[styles.bottomLabels, { paddingRight: PAD_RIGHT - 4 }]}>
        <Text style={styles.bottomLabel}>
          {i18n.t('bacChartFirstDrinkLabel')} {formatTime(firstMs)}
        </Text>
        <Text style={[styles.bottomLabel, !!soberLabel && styles.bottomLabelStrong]}>
          {soberLabel ?? `${i18n.t('bacChartSoberLabel')} ${formatTime(soberMs)}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.lg,
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: Font.body,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    marginBottom: Space.md,
  },
  bottomLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Space.xs,
  },
  bottomLabel: { fontSize: Font.micro, color: AppColors.sub },
  // 히스토리에서는 "몇 시에 깼는지" 가 카드에서 가장 중요한 값이라 눌러쓰지 않는다
  bottomLabelStrong: { color: AppColors.navy, fontWeight: Weight.semibold },
});
