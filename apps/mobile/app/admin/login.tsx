import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from '@/lib/storage';
import { useAuthStore } from '@/store/auth.store';
import { authApi, usersApi } from '@/lib/api';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ALLOWED_ROLES = ['PITCH_OWNER', 'ADMIN', 'SUPER_ADMIN'];

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 9) {
      setError('Enter a valid 9-digit Uzbekistan number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.sendOtp(`+998${digits}`);
      setStep('otp');
    } catch {
      setError('Failed to send OTP. Check the phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const digits = phone.replace(/\D/g, '');
      const { data } = await authApi.verifyOtp(`+998${digits}`, otp);

      if (data.isNewUser) {
        Alert.alert('Access denied', 'This account is not registered as an admin.');
        setLoading(false);
        return;
      }

      // Check role
      const { data: user } = await usersApi.getMe();
      if (!ALLOWED_ROLES.includes(user.role)) {
        Alert.alert('Access denied', 'Your account does not have admin privileges.');
        setLoading(false);
        return;
      }

      setAuth(user, data.accessToken, data.refreshToken);
      await SecureStore.setItemAsync('accessToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);

      router.replace('/admin/(tabs)/dashboard');
    } catch {
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / header */}
        <View className="items-center mb-10">
          <Text className="text-4xl mb-2">🏟️</Text>
          <Text className="text-white text-2xl font-bold">Admin Panel</Text>
          <Text className="text-gray-400 text-sm mt-1">ExpoUz · Pitch Management</Text>
        </View>

        <View className="bg-gray-900 rounded-2xl p-6">
          {step === 'phone' ? (
            <>
              <Text className="text-white text-lg font-semibold mb-4">Sign in with phone</Text>

              {/* Phone input */}
              <View className="flex-row items-center bg-gray-800 rounded-xl overflow-hidden mb-4">
                <View className="px-4 py-3 bg-gray-700 flex-row items-center gap-2">
                  <Text className="text-white font-bold text-sm">UZ +998</Text>
                </View>
                <TextInput
                  className="flex-1 text-white px-4 py-3 text-base"
                  placeholder="XX XXX XX XX"
                  placeholderTextColor="#6B7280"
                  keyboardType="phone-pad"
                  value={phone.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4')}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 9))}
                  maxLength={11}
                />
              </View>

              {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={loading}
                className="bg-blue-600 rounded-xl py-4 items-center"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); setError(''); }} className="mb-4">
                <Text className="text-blue-400 text-sm">← Change number</Text>
              </TouchableOpacity>

              <Text className="text-white text-lg font-semibold mb-1">Enter OTP</Text>
              <Text className="text-gray-400 text-sm mb-4">
                Sent to +998 {phone.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4')}
              </Text>

              <TextInput
                className="bg-gray-800 text-white text-center text-2xl tracking-widest rounded-xl px-4 py-4 mb-4"
                placeholder="• • • • • •"
                placeholderTextColor="#4B5563"
                keyboardType="number-pad"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />

              {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

              <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className={`rounded-xl py-4 items-center ${otp.length === 6 ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">Verify & Sign in</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendOtp} className="mt-4 items-center">
                <Text className="text-gray-400 text-sm">Resend code</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity onPress={() => router.replace('/')} className="mt-6 items-center">
          <Text className="text-gray-500 text-sm">← Back to player app</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
