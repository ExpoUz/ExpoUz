import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from '@/lib/storage';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';

WebBrowser.maybeCompleteAuthSession();

export default function PhoneScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
  });

  const googleMutation = useMutation({
    mutationFn: (credential: string) => authApi.googleAuth(credential),
    onSuccess: async ({ data }) => {
      await SecureStore.setItemAsync('accessToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      setAuth(data.user, data.accessToken, data.refreshToken);
      if (data.isNewUser) router.replace('/auth/register');
      else router.replace('/(tabs)/games');
    },
    onError: () => Alert.alert('Error', 'Google sign-in failed. Please try again.'),
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      googleMutation.mutate(id_token);
    }
  }, [response]);

  const mutation = useMutation({
    mutationFn: () => authApi.sendOtp(`+998${phone}`),
    onSuccess: () => router.push({ pathname: '/auth/otp', params: { phone: `+998${phone}` } }),
    onError: () => setError('Failed to send OTP. Please try again.'),
  });

  const handleSend = () => {
    if (phone.replace(/\D/g, '').length !== 9) { setError(t('auth.invalidPhone')); return; }
    setError('');
    mutation.mutate();
  };

  const formatted = phone.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <View style={styles.card}>
          <Text style={styles.title}>{t('auth.verifyPhone')}</Text>
          <Text style={styles.subtitle}>Enter your Uzbekistan phone number</Text>
          <View style={styles.inputRow}>
            <View style={styles.prefix}>
              <View style={styles.flagBadge}><Text style={styles.flagCode}>UZ</Text></View>
              <Text style={styles.prefixText}>+998</Text>
            </View>
            <TextInput
              style={styles.input}
              value={formatted}
              onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 9))}
              keyboardType="phone-pad"
              placeholder="XX XXX XX XX"
              placeholderTextColor="#6B7280"
              maxLength={11}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ height: 24 }} />
          <Button title={t('auth.verifyPhone')} onPress={handleSend} loading={mutation.isPending} disabled={phone.length !== 9} />

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google sign-in */}
          <TouchableOpacity
            style={[styles.googleBtn, (!request || googleMutation.isPending) && { opacity: 0.6 }]}
            onPress={() => promptAsync()}
            disabled={!request || googleMutation.isPending}
          >
            <Text style={styles.googleBtnText}>
              {googleMutation.isPending ? '...' : '🔵  Continue with Google'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.terms}>{t('auth.termsAgreement')}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  flex: { flex: 1, justifyContent: 'center', padding: 24 },
  back: { position: 'absolute', top: 16, left: 16 },
  backText: { color: '#00C853', fontSize: 14 },
  card: { backgroundColor: '#1A1A1A', borderRadius: 24, padding: 24 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#9CA3AF', fontSize: 14, marginBottom: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#374151', borderRadius: 12, overflow: 'hidden' },
  prefix: { backgroundColor: '#1E1E1E', paddingHorizontal: 14, paddingVertical: 16, borderRightWidth: 1, borderRightColor: '#374151', flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagBadge: { backgroundColor: '#22C55E', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  flagCode: { color: '#000', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  prefixText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  input: { flex: 1, color: '#FFF', fontSize: 18, letterSpacing: 2, paddingHorizontal: 14, paddingVertical: 16 },
  error: { color: '#EF4444', fontSize: 12, marginTop: 8 },
  terms: { color: '#6B7280', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#374151' },
  dividerText: { color: '#6B7280', fontSize: 12 },
  googleBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  googleBtnText: { color: '#111827', fontWeight: '700', fontSize: 15 },
});
