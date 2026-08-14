import { View, ActivityIndicator } from 'react-native';
import { AppColors } from '@/constants/colors';

// 루트 / 경로 — _layout.tsx 의 useEffect 가 profile 로드 후
// /onboarding 또는 /(tabs) 로 리다이렉트함. 그 전까지 로딩 스피너 표시.
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: AppColors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={AppColors.accent} size="large" />
    </View>
  );
}
