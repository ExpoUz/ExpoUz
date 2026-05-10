import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export default function PhoneScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

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
            <View style={styles.prefix}><Text style={styles.prefixText}>��🇿 +998</Text></View>
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
  prefix: { backgroundColor: '#1E1E1E', paddingHorizontal: 14, paddingVertical: 16, borderRightWidth: 1, borderRightColor: '#374151' },
  prefixText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  input: { flex: 1, color: '#FFF', fontSize: 18, letterSpacing: 2, paddingHorizontal: 14, paddingVertical: 16 },
  error: { color: '#EF4444', fontSize: 12, marginTop: 8 },
  terms: { color: '#6B7280', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
