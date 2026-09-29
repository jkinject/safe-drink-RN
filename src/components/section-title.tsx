import { StyleSheet, View } from 'react-native';
import { AppColors } from '@/constants/colors';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { Font, IconSize, LineHeight, Space, Weight } from '@/constants/tokens';

/**
 * 섹션 제목 — 모든 화면에서 이 한 가지 모양만 쓴다 (h3 · bold · navy · 아래 Space.sm).
 *
 * 화면마다 caption·body·h4·h3 로 제각각 만들다 보니 같은 위계의 제목이 네 가지 크기로
 * 보였다. 탭 화면 제목(h2)·카드 안 제목(h4)은 다른 위계라 여기 해당하지 않는다.
 * 공유 카드(session-share-card)는 캡처용 소형 레이아웃이라 예외로 자체 스타일을 둔다.
 *
 * - `icon`: 제목 앞 아이콘 (IconSize.md · accent)
 * - `right`: 제목 줄 오른쪽 끝에 붙는 동작(예: 홈 "기록 추가 +")
 */
interface SectionTitleProps {
  children: string;
  icon?: IconName;
  right?: React.ReactNode;
}

export function SectionTitle({ children, icon, right }: SectionTitleProps) {
  return (
    <View style={styles.row}>
      {!!icon && (
        <Icon name={icon} size={IconSize.md} color={AppColors.accent} strokeWidth={2.1} />
      )}
      <Text style={styles.title} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    marginBottom: Space.sm,
  },
  title: {
    flex: 1,
    fontSize: Font.h3,
    lineHeight: LineHeight.h3,
    fontWeight: Weight.bold,
    color: AppColors.navy,
  },
});
