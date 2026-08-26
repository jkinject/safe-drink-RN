import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
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
  const refreshNotifications = sessionStore(s => s.refreshNotifications);
  const checkAutoClose = sessionStore(s => s.checkAutoClose);
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
      // 진행 중인 세션이 있으면 카운트다운을 다시 띄운다.
      // 앱 업데이트·재부팅·사용자가 알림을 밀어서 지운 경우 알림이 사라진 채로
      // 남는데, load() 는 알림을 건드리지 않아 다음 기록 변경까지 복구되지 않는다.
      // Promise.all 뒤에 두는 이유: 프로필·로케일·설정이 모두 채워져야 한다.
      .then(() => refreshNotifications())
      .catch(() => {})
      .finally(() => setInitialized(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 백그라운드에 있는 동안 술이 깼을 수 있다. 포그라운드로 돌아올 때마다
  // 세션 종료 여부를 다시 판정하고 카운트다운을 현재 시각 기준으로 다시 건다.
  // 네이티브 setTimeoutAfter 가 목표 시각에 알림을 내리지만, 제조사 펌웨어가
  // 이를 무시하는 경우까지 대비한 앱 쪽 안전망이다.
  useEffect(() => {
    if (!initialized) return;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      checkAutoClose()
        .then(() => refreshNotifications())
        .catch(() => {});
    });
    return () => sub.remove();
  }, [initialized, checkAutoClose, refreshNotifications]);

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
        {/* 설정 → 프로필은 depth 로 들어가는 흐름이라 모달이 아니라 오른쪽 슬라이드 */}
        <Stack.Screen
          name="profile"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
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
