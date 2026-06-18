import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from '@/lib/storage';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Gender, MatchPosition } from '@expouz/shared';
import { UZBEKISTAN_CITIES } from '@expouz/shared';

const POSITIONS = ['GK','LB','CB','RB','CM','CDM','CAM','LW','RW','ST'];

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [city, setCity] = useState('Tashkent');
  const [positions, setPositions] = useState<MatchPosition[]>([]);
  const [referral, setReferral] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const ageValid = () => {
    const d = new Date(dob);
    return !isNaN(d.getTime()) && (new Date().getFullYear() - d.getFullYear()) >= 16;
  };

  const canSubmit = name.trim() && username.trim() && ageValid();

  const mutation = useMutation({
    mutationFn: () => {
      const parts = name.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || parts[0];
      return authApi.register({ firstName, lastName, dateOfBirth: dob || undefined, gender, city, referralCode: referral || undefined });
    },
    onSuccess: async ({ data }) => {
      await SecureStore.setItemAsync('accessToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace('/(tabs)/games');
    },
    onError: () => Alert.alert('Error', 'Registration failed. Please try again.'),
  });

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!res.canceled) setAvatarUri(res.assets[0].uri);
  };

  const togglePos = (p: string) => {
    const pos = p as MatchPosition;
    setPositions((prev) => prev.includes(pos) ? prev.filter((x) => x !== pos) : [...prev, pos]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.createProfile')}</Text>

        <TouchableOpacity onPress={pickAvatar} style={styles.avatarBtn}>
          <View style={[styles.avatarCircle, avatarUri && { borderColor: '#00C853' }]}>
            <Text style={{ fontSize: 40 }}>{avatarUri ? '✅' : '📷'}</Text>
          </View>
          <Text style={styles.avatarHint}>Tap to upload photo</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#6B7280" />

        <Text style={styles.label}>Username *</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="@username" placeholderTextColor="#6B7280" autoCapitalize="none" />

        <Text style={styles.label}>Date of Birth * (YYYY-MM-DD)</Text>
        <TextInput style={[styles.input, dob && !ageValid() && styles.inputError]} value={dob} onChangeText={setDob} placeholder="2000-01-15" placeholderTextColor="#6B7280" />
        {dob && !ageValid() && <Text style={styles.errorText}>Must be 16 or older</Text>}

        <Text style={styles.label}>Gender</Text>
        <View style={styles.row}>
          {[Gender.MALE, Gender.FEMALE].map((g) => (
            <TouchableOpacity key={g} onPress={() => setGender(g)} style={[styles.chip, gender === g && styles.chipActive]}>
              <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>City</Text>
        <View style={styles.row}>
          {UZBEKISTAN_CITIES.slice(0, 5).map((c) => (
            <TouchableOpacity key={c.name} onPress={() => setCity(c.name)} style={[styles.chip, city === c.name && styles.chipActive]}>
              <Text style={[styles.chipText, city === c.name && styles.chipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Preferred Positions</Text>
        <View style={styles.row}>
          {POSITIONS.map((p) => (
            <TouchableOpacity key={p} onPress={() => togglePos(p)} style={[styles.chip, positions.includes(p as MatchPosition) && styles.chipActive]}>
              <Text style={[styles.chipText, positions.includes(p as MatchPosition) && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Referral Code (optional)</Text>
        <TextInput style={styles.input} value={referral} onChangeText={setReferral} placeholder="Enter code" placeholderTextColor="#6B7280" autoCapitalize="characters" />

        <View style={{ height: 24 }} />
        <Button title={t('auth.register')} onPress={() => mutation.mutate()} loading={mutation.isPending} disabled={!canSubmit} />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { padding: 24 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '800', marginBottom: 24 },
  avatarBtn: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#374151', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarHint: { color: '#6B7280', fontSize: 12 },
  label: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#374151' },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 11, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#374151' },
  chipActive: { backgroundColor: 'rgba(0,200,83,0.15)', borderColor: '#00C853' },
  chipText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#00C853' },
});
