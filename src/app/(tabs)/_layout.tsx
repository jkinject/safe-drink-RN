import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppColors } from '@/constants/colors';
import { i18n } from '@/i18n';
import { localeStore } from '@/state/localeStore';

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={tabIconStyles.container}>
      <Text style={[tabIconStyles.icon, focused && tabIconStyles.iconFocused]}>{icon}</Text>
      <Text style={[tabIconStyles.label, focused && tabIconStyles.labelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  // Subscribe to locale changes to re-render tab labels
  const locale = localeStore(s => s.locale);
  void locale;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="⏱" label={i18n.t('navTimer')} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="📊" label={i18n.t('navPlan')} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="⚙️" label={i18n.t('navSettings')} />
          ),
        }}
      />
    </Tabs>
  );
}

const tabIconStyles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 6 },
  icon: { fontSize: 22, opacity: 0.5 },
  iconFocused: { opacity: 1 },
  label: { fontSize: 10, color: AppColors.sub, marginTop: 2 },
  labelFocused: { color: AppColors.accent, fontWeight: '600' },
});

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    height: 70,
    shadowColor: '#6C63E0',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
});
