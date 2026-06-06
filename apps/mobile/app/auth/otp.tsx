import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import * as SecureStore from '@/lib/storage';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [seconds, setSeconds] = useState(120);
  const [error, setError] = useState('');
  const inputs = useRef<(TextInput | null)[]>([]);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(-12, { duration: 60 }), withTiming(12, { duration: 60 }),
      withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const verify = useMutation({
    mutationFn: () => authApi.verifyOtp(phone ?? '', otp.join('')),
    onSuccess: async ({ data }) => {
      if (data.accessToken && data.refreshToken) {
        await SecureStore.setItemAsync('accessToken', data.accessToken);
        await SecureStore.setItemAsync('refreshToken', data.refreshToken);
        setAuth(data.user, data.accessToken, data.refreshToken);
      }
      if (data.isNewUser) { router.replace('/auth/register'); return; }
      router.replace('/(tabs)/games');
    },
    onError: () => { setError(t('auth.invalidOtp')); shake(); setOtp(Array(OTP_LENGTH).fill('')); inputs.current[0]?.focus(); },
  });

  const resend = useMutation({ mutationFn: () => authApi.sendOtp(phone ?? ''), onSuccess: () => setSeconds(120) });

  const handleChange = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    setError('');
    if (val && idx < OTP_LENGTH - 1) inputs.current[idx + 1]?.focus();
    if (next.every(Boolean)) verify.mutate();
  };

  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <View style={styles.container}>
        <Text style={styles.title}>Verify Code</Text>
        <Text style={styles.subtitle}>{t('auth.otpSent', { phone })}</Text>
        <Animated.View style={[styles.cells, shakeStyle]}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              value={digit}
              onChangeText={(v) => handleChange(v, i)}
              onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) { inputs.current[i - 1]?.focus(); } }}
              keyboardType="number-pad"
              maxLength={1}
              style={[styles.cell, digit && styles.cellFilled, error && styles.cellError]}
            />
          ))}
        </Animated.View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: 32 }} />
        <Button title="Verify" onPress={() => verify.mutate()} loading={verify.isPending} disabled={otp.some((d) => !d)} />
        <View style={styles.resendRow}>
          {seconds > 0 ? (
            <Text style={styles.timerText}>{t('auth.resendIn', { seconds: fmt })}</Text>
          ) : (
            <TouchableOpacity onPress={() => resend.mutate()}>
              <Text style={styles.resendText}>{t('auth.resendOtp')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  back: { padding: 16 },
  backText: { color: '#00C853', fontSize: 14 },
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#9CA3AF', fontSize: 14, marginBottom: 40, textAlign: 'center' },
  cells: { flexDirection: 'row', gap: 12 },
  cell: { width: 48, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#374151', textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#FFF', backgroundColor: '#1A1A1A' },
  cellFilled: { borderColor: '#00C853', backgroundColor: 'rgba(0,200,83,0.1)' },
  cellError: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  error: { color: '#EF4444', fontSize: 12, marginTop: 12 },
  resendRow: { marginTop: 24 },
  timerText: { color: '#6B7280', fontSize: 13 },
  resendText: { color: '#00C853', fontSize: 13, fontWeight: '600' },
});
