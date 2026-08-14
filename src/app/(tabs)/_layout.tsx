import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '@/constants/colors';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { i18n } from '@/i18n';
import { localeStore } from '@/state/localeStore';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

/** 아이콘 + 라벨 한 줄의 높이 (탭바 높이를 여기에 맞춘다) */
const TAB_CONTENT_HEIGHT = IconSize.lg + Space.xxs + Font.micro + 4;

function TabIcon({ focused, icon, label }: { focused: boolean; icon: IconName; label: string }) {
  return (
    <View style={tabIconStyles.container}>
      {/* 선택 상태는 색과 선 굵기로 표현한다 (이모지로는 불가능했던 부분) */}
      <Icon
        name={icon}
        size={IconSize.lg}
        color={focused ? AppColors.accent : AppColors.sub}
        strokeWidth={focused ? 2.3 : 1.8}
      />
      <Text style={[tabIconStyles.label, focused && tabIconStyles.labelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  // Subscribe to locale changes to re-render tab labels
  const locale = localeStore(s => s.locale);
  void locale;
  // Android edge-to-edge: 시스템 네비게이션 바 높이만큼 하단 여백 확보
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // 아이콘 슬롯은 상단 정렬이라 컨테이너에 flex 를 줘도 가운데로 오지 않는다.
        // 탭바 높이를 콘텐츠(아이콘+라벨)에 맞추고 상하 여백을 같게 줘서 맞춘다.
        tabBarStyle: [
          styles.tabBar,
          {
            height: TAB_CONTENT_HEIGHT + Space.md * 2 + insets.bottom,
            paddingTop: Space.md,
            paddingBottom: Space.md + insets.bottom,
          },
        ],
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="timer" label={i18n.t('navTimer')} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="plan" label={i18n.t('navPlan')} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="settings" label={i18n.t('navSettings')} />
          ),
        }}
      />
    </Tabs>
  );
}

const tabIconStyles = StyleSheet.create({
  // 탭 아이템 높이를 다 쓰고 그 안에서 가운데 정렬해야 아이콘이 위로 붙지 않는다
  container: { alignItems: 'center', justifyContent: 'center', gap: Space.xxs },
  label: { fontSize: Font.micro, color: AppColors.sub },
  labelFocused: { color: AppColors.accent, fontWeight: Weight.semibold },
});

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    position: 'absolute',
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
});
