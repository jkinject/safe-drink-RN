import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '@/constants/colors';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { i18n } from '@/i18n';
import { localeStore } from '@/state/localeStore';
import { Space, Font, Weight } from '@/constants/tokens';

function TabIcon({ focused, icon, label }: { focused: boolean; icon: IconName; label: string }) {
  return (
    <View style={tabIconStyles.container}>
      {/* 선택 상태는 색과 선 굵기로 표현한다 (이모지로는 불가능했던 부분) */}
      <Icon
        name={icon}
        size={22}
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
        tabBarStyle: [
          styles.tabBar,
          { height: 64 + insets.bottom, paddingBottom: insets.bottom },
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
  container: { alignItems: 'center', paddingTop: Space.sm },
  label: { fontSize: Font.micro, color: AppColors.sub, marginTop: Space.xxs },
  labelFocused: { color: AppColors.accent, fontWeight: Weight.semibold },
});

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
});
