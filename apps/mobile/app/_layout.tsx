import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { initI18n } from '@/lib/i18n';
import { usersApi } from '@/lib/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

function AuthLoader() {
  const { setAuth, clearAuth, setLoading } = useAuthStore();
  const language = useAppStore((s) => s.language);

  useEffect(() => {
    initI18n(language);
  }, [language]);

  useEffect(() => {
    (async () => {
      try {
        const accessToken = await SecureStore.getItemAsync('accessToken');
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (accessToken && refreshToken) {
          const { data: user } = await usersApi.getMe();
          setAuth(user, accessToken, refreshToken);
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
      }
    })();
  }, [setAuth, clearAuth, setLoading]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthLoader />
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0D0D' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth/phone" />
            <Stack.Screen name="auth/otp" />
            <Stack.Screen name="auth/register" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="matches/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="matches/[id]/join" options={{ presentation: 'modal' }} />
            <Stack.Screen name="matches/[id]/formation" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="matches/create" options={{ presentation: 'modal' }} />
            <Stack.Screen name="map" />
            <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
            <Stack.Screen name="settings/city" options={{ presentation: 'modal' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
