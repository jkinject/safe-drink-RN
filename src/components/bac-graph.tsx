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

const CHART_HEIGHT = 170;
const PAD_LEFT = 4;
const PAD_RIGHT = 78; // 우측 기준선 라벨 영역 (Flutter판과 동일하게 우측 배치)
const PAD_TOP = 14;
const PAD_BOTTOM = 6;
const INNER_H = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

const BAC_REVOCATION = 0.08;
const BAC_SUSPENSION = 0.03;

interface Props {
  curve: Array<[number, number]>; // [epochMs, bac%]
  nowMs: number;
  firstMs: number;
  soberMs: number;
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function BacGraph({ curve, nowMs, firstMs, soberMs }: Props) {
  // 실제 렌더 폭을 측정해 픽셀 좌표로 그린다 (viewBox 스케일링 왜곡 방지)
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const innerW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);

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
  }, [curve, width, maxBac, firstMs, soberMs]);

  const yBase = PAD_TOP + INNER_H;
  const fillD = pathD
    ? `${pathD} L ${(PAD_LEFT + innerW).toFixed(1)},${yBase} L ${PAD_LEFT},${yBase} Z`
    : '';

  const yRev = toY(BAC_REVOCATION);
  const ySus = toY(BAC_SUSPENSION);

  const clampedNowX = Math.max(PAD_LEFT, Math.min(PAD_LEFT + innerW, toX(nowMs)));
  const nowBac = useMemo(() => {
    if (curve.length === 0) return 0;
    let closest = curve[0];
    for (const p of curve) {
      if (Math.abs(p[0] - nowMs) < Math.abs(closest[0] - nowMs)) closest = p;
    }
    return closest[1];
  }, [curve, nowMs]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{i18n.t('bacChartTitle')}</Text>
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

            {/* 지금 마커 */}
            {nowMs >= firstMs && nowMs <= soberMs && (
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
        <Text style={styles.bottomLabel}>
          {i18n.t('bacChartSoberLabel')} {formatTime(soberMs)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.navy,
    marginBottom: 10,
  },
  bottomLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  bottomLabel: { fontSize: 10, color: AppColors.sub },
});
