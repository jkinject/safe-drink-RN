import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { profileStore } from '@/state/profileStore';
import { presetsStore } from '@/state/presetsStore';
import { localeStore } from '@/state/localeStore';
import { sessionStore } from '@/state/sessionStore';
import * as notificationService from '@/services/notifications';
import { useOtaUpdates } from '@/hooks/useOtaUpdates';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);
  useOtaUpdates();
  const profile = profileStore(s => s.profile);
  const loadProfile = profileStore(s => s.load);
  const loadPresets = presetsStore(s => s.load);
  const loadLocale = localeStore(s => s.load);
  const loadSession = sessionStore(s => s.load);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    Promise.all([
      loadProfile(),
      loadPresets(),
      loadLocale(),
      loadSession(),
      notificationService.initialize(),
    ])
      .catch(() => {})
      .finally(() => {
        setInitialized(true);
        SplashScreen.hideAsync().catch(() => {});
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    </Stack>
  );
}
