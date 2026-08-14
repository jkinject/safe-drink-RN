import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { AppColors } from '@/constants/colors';
import { i18n } from '@/i18n';

const CHART_WIDTH = 300;
const CHART_HEIGHT = 140;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const INNER_W = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_H = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

const BAC_REVOCATION = 0.08;
const BAC_SUSPENSION = 0.03;

interface Props {
  curve: Array<[number, number]>;  // [epochMs, bac%]
  nowMs: number;
  firstMs: number;
  soberMs: number;
}

function toX(t: number, firstMs: number, soberMs: number): number {
  if (soberMs <= firstMs) return PAD_LEFT;
  return PAD_LEFT + ((t - firstMs) / (soberMs - firstMs)) * INNER_W;
}

function toY(bac: number, maxBac: number): number {
  if (maxBac <= 0) return PAD_TOP + INNER_H;
  const ratio = Math.min(bac / maxBac, 1);
  return PAD_TOP + INNER_H - ratio * INNER_H;
}

function buildPath(
  points: Array<[number, number]>,
  firstMs: number,
  soberMs: number,
  maxBac: number,
): string {
  if (points.length === 0) return '';
  const [t0, b0] = points[0];
  let d = `M ${toX(t0, firstMs, soberMs).toFixed(1)},${toY(b0, maxBac).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [t, b] = points[i];
    d += ` L ${toX(t, firstMs, soberMs).toFixed(1)},${toY(b, maxBac).toFixed(1)}`;
  }
  return d;
}

export function BacGraph({ curve, nowMs, firstMs, soberMs }: Props) {
  const maxBac = useMemo(() => {
    if (curve.length === 0) return 0.1;
    return Math.max(...curve.map(([, b]) => b), BAC_REVOCATION * 1.1);
  }, [curve]);

  const pathD = useMemo(
    () => buildPath(curve, firstMs, soberMs, maxBac),
    [curve, firstMs, soberMs, maxBac],
  );

  const nowX = toX(nowMs, firstMs, soberMs);
  const clampedNowX = Math.max(PAD_LEFT, Math.min(PAD_LEFT + INNER_W, nowX));
  const yRevocation = toY(BAC_REVOCATION, maxBac);
  const ySuspension = toY(BAC_SUSPENSION, maxBac);
  const yBase = PAD_TOP + INNER_H;

  // Fill area under curve
  const fillD = pathD
    ? `${pathD} L ${(PAD_LEFT + INNER_W).toFixed(1)},${yBase.toFixed(1)} L ${PAD_LEFT},${yBase.toFixed(1)} Z`
    : '';

  const nowBac = useMemo(() => {
    if (curve.length === 0) return 0;
    // Find closest point to nowMs
    let closest: [number, number] = curve[0];
    let minDiff = Math.abs(curve[0][0] - nowMs);
    for (const p of curve) {
      const diff = Math.abs(p[0] - nowMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }
    return closest[1];
  }, [curve, nowMs]);

  const nowY = toY(nowBac, maxBac);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{i18n.t('bacChartTitle')}</Text>
      <Svg
        width="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        style={styles.svg}
      >
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={AppColors.accent} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={AppColors.accent} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={INNER_W}
          height={INNER_H}
          fill={AppColors.bg}
          rx={4}
        />

        {/* Reference zone: revocation (red tint) */}
        <Rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={INNER_W}
          height={Math.max(0, yRevocation - PAD_TOP)}
          fill="rgba(255,59,48,0.06)"
        />
        {/* Reference zone: suspension (orange tint) */}
        <Rect
          x={PAD_LEFT}
          y={yRevocation}
          width={INNER_W}
          height={Math.max(0, ySuspension - yRevocation)}
          fill="rgba(255,149,0,0.06)"
        />

        {/* Reference line: revocation 0.08% */}
        <Line
          x1={PAD_LEFT}
          y1={yRevocation}
          x2={PAD_LEFT + INNER_W}
          y2={yRevocation}
          stroke="rgba(255,59,48,0.6)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        {/* Label */}
        <SvgText
          x={PAD_LEFT + 4}
          y={yRevocation - 3}
          fontSize="8"
          fill="rgba(255,59,48,0.8)"
        >
          {i18n.t('bacChartDrivingLimitLabel')}
        </SvgText>

        {/* Reference line: suspension 0.03% */}
        <Line
          x1={PAD_LEFT}
          y1={ySuspension}
          x2={PAD_LEFT + INNER_W}
          y2={ySuspension}
          stroke="rgba(255,149,0,0.6)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <SvgText
          x={PAD_LEFT + 4}
          y={ySuspension - 3}
          fontSize="8"
          fill="rgba(255,149,0,0.8)"
        >
          {i18n.t('bacChartCautionLimitLabel')}
        </SvgText>

        {/* Area fill */}
        {fillD ? (
          <Path d={fillD} fill="url(#areaGrad)" />
        ) : null}

        {/* Curve */}
        {pathD ? (
          <Path
            d={pathD}
            stroke={AppColors.accent}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Now vertical line */}
        {nowMs >= firstMs && nowMs <= soberMs && (
          <>
            <Line
              x1={clampedNowX}
              y1={PAD_TOP}
              x2={clampedNowX}
              y2={PAD_TOP + INNER_H}
              stroke={AppColors.navy}
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
            <Circle cx={clampedNowX} cy={nowY} r="4" fill={AppColors.navy} />
            <SvgText
              x={Math.min(clampedNowX, PAD_LEFT + INNER_W - 20)}
              y={PAD_TOP + INNER_H + 16}
              fontSize="9"
              fill={AppColors.navy}
              textAnchor="middle"
            >
              {i18n.t('bacChartNowLabel')}
            </SvgText>
          </>
        )}

        {/* First drink label */}
        <SvgText
          x={PAD_LEFT}
          y={PAD_TOP + INNER_H + 16}
          fontSize="9"
          fill={AppColors.sub}
          textAnchor="start"
        >
          {i18n.t('bacChartFirstDrinkLabel')}
        </SvgText>

        {/* Sober label */}
        <SvgText
          x={PAD_LEFT + INNER_W}
          y={PAD_TOP + INNER_H + 16}
          fontSize="9"
          fill={AppColors.sub}
          textAnchor="end"
        >
          {i18n.t('bacChartSoberLabel')}
        </SvgText>
      </Svg>
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
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.navy,
    marginBottom: 8,
  },
  svg: {
    width: '100%',
  },
});
