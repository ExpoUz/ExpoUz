import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from '@/lib/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { initI18n } from '@/lib/i18n';
import { usersApi, authApi } from '@/lib/api';
import { isTelegramMiniApp, getTelegramInitData, telegramReady, telegramExpand } from '@/lib/telegram';

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
        // ── Telegram Mini App auto-auth ──────────────────────
        if (Platform.OS === 'web' && isTelegramMiniApp()) {
          telegramReady();
          telegramExpand();
          const initData = getTelegramInitData();
          if (initData) {
            const { data } = await authApi.telegramAuth(initData);
            await SecureStore.setItemAsync('accessToken', data.accessToken);
            await SecureStore.setItemAsync('refreshToken', data.refreshToken);
            setAuth(data.user, data.accessToken, data.refreshToken);
            return;
          }
        }

        // ── Normal stored-token auth ──────────────────────────
        const accessToken = await SecureStore.getItemAsync('accessToken');
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (accessToken && refreshToken) {
          // Set tokens in store BEFORE calling getMe so the request interceptor has them
          useAuthStore.setState({ accessToken, refreshToken });
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
  const isLoading = useAuthStore((s) => s.isLoading);

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
              <Stack.Screen name="admin" options={{ headerShown: false }} />
              <Stack.Screen name="matches/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="matches/[id]/join" options={{ presentation: 'modal' }} />
              <Stack.Screen name="matches/[id]/formation" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="matches/create" options={{ presentation: 'modal' }} />
              <Stack.Screen name="create-match" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings/city" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings/edit-profile" options={{ presentation: 'modal' }} />
            </Stack>
          {isLoading && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
              <ActivityIndicator size="large" color="#22C55E" />
            </View>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
