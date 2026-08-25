import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { FONTS } from '@/components/typography';
import { DialogHost } from '@/components/dialog';
import { profileStore } from '@/state/profileStore';
import { presetsStore } from '@/state/presetsStore';
import { localeStore } from '@/state/localeStore';
import { sessionStore } from '@/state/sessionStore';
import { settingsStore } from '@/state/settingsStore';
import * as notificationService from '@/services/notifications';
import { useOtaUpdates } from '@/hooks/useOtaUpdates';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    [FONTS.regular]: require('../../assets/fonts/Pretendard-Regular.ttf'),
    [FONTS.semiBold]: require('../../assets/fonts/Pretendard-SemiBold.ttf'),
    [FONTS.bold]: require('../../assets/fonts/Pretendard-Bold.ttf'),
  });
  useOtaUpdates();
  const profile = profileStore(s => s.profile);
  const loadProfile = profileStore(s => s.load);
  const loadPresets = presetsStore(s => s.load);
  const loadLocale = localeStore(s => s.load);
  const loadSession = sessionStore(s => s.load);
  const loadSessions = sessionStore(s => s.loadSessions);
  const loadSettings = settingsStore(s => s.load);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // 설정을 먼저 읽는다 — loadSession() 이 알림을 띄우므로, 설정보다 늦으면
    // 카운트다운을 꺼둔 사용자에게도 시작 직후 한 번 떴다 사라진다
    loadSettings()
      .then(() =>
        Promise.all([
          loadProfile(),
          loadPresets(),
          loadLocale(),
          loadSession(),
          loadSessions(),
          notificationService.initialize(),
        ]),
      )
      .catch(() => {})
      .finally(() => setInitialized(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 폰트가 준비되기 전에 스플래시를 내리면 시스템 폰트로 한 프레임 깜빡인다
  useEffect(() => {
    // 폰트 로드에 실패해도 앱은 시스템 폰트로 계속 뜬다
    if (initialized && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [initialized, fontsLoaded, fontError]);

  useEffect(() => {
    if (!initialized) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!profile) {
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
    } else {
      if (inOnboarding || !segments[0]) {
        router.replace('/(tabs)');
      }
    }
  }, [profile, initialized, segments, router]);

  return (
    <>
      <Stack>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-drink"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="info"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="history"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
      </Stack>
      {/* OS 기본 Alert 대신 쓰는 공통 다이얼로그 — 모든 화면 위에 뜬다 */}
      <DialogHost />
    </>
  );
}
