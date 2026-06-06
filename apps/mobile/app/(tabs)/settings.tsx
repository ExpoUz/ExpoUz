import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { useMutation } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';

type Language = 'uz' | 'ru' | 'en';

const CITIES = ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Nukus'];

const LANGUAGE_LABELS: Record<Language, string> = {
  uz: '🇺🇿 O\'zbek',
  ru: '🇷🇺 Русский',
  en: '🇬🇧 English',
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { language, setLanguage, city, setCity } = useAppStore();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.deleteAccount(),
    onSuccess: () => {
      clearAuth();
      router.replace('/');
    },
  });

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          clearAuth();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>

        {/* Account */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <SettingsRow
              label="Edit Profile"
              value={`${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`}
              onPress={() => router.push('/settings/edit-profile' as any)}
              showArrow
            />
            <SettingsRow
              label="Phone"
              value={(user as any).phone ?? ''}
              onPress={() => {}}
            />
          </View>
        )}

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          {/* Language picker */}
          <SettingsRow
            label="Language"
            value={LANGUAGE_LABELS[language]}
            onPress={() => setShowLangPicker((v) => !v)}
            showArrow
          />
          {showLangPicker && (
            <View style={styles.pickerList}>
              {(Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.pickerItem, language === l && styles.pickerItemActive]}
                  onPress={() => { setLanguage(l); setShowLangPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, language === l && styles.pickerItemTextActive]}>
                    {LANGUAGE_LABELS[l]}
                  </Text>
                  {language === l && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* City picker */}
          <SettingsRow
            label="City"
            value={`📍 ${city}`}
            onPress={() => setShowCityPicker((v) => !v)}
            showArrow
          />
          {showCityPicker && (
            <View style={styles.pickerList}>
              {CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pickerItem, city === c && styles.pickerItemActive]}
                  onPress={() => { setCity(c); setShowCityPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, city === c && styles.pickerItemTextActive]}>{c}</Text>
                  {city === c && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <SettingsToggle
            label="Push Notifications"
            sublabel="Game reminders, match updates"
            value={pushEnabled}
            onChange={setPushEnabled}
          />
          <SettingsToggle
            label="SMS Alerts"
            sublabel="Critical updates via SMS"
            value={smsEnabled}
            onChange={setSmsEnabled}
          />
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <SettingsRow label="Version" value="1.0.0" onPress={() => {}} />
          <SettingsRow label="Privacy Policy" onPress={() => {}} showArrow />
          <SettingsRow label="Terms of Service" onPress={() => {}} showArrow />
          <SettingsRow label="Contact Support" onPress={() => {}} showArrow />
        </View>

        {/* Danger Zone */}
        {user && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Account</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsRow({
  label,
  value,
  onPress,
  showArrow,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  showArrow?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {showArrow ? <Text style={styles.rowArrow}>›</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function SettingsToggle({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#374151', true: '#00C853' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { paddingBottom: 120 },
  pageHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6B7280', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  rowLabel: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '400' },
  rowSublabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '50%' },
  rowValue: { fontSize: 14, color: '#6B7280', textAlign: 'right' },
  rowArrow: { color: '#374151', fontSize: 20 },
  pickerList: { backgroundColor: '#0D1117', borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  pickerItemActive: { backgroundColor: '#0A1A0F' },
  pickerItemText: { fontSize: 15, color: '#9CA3AF' },
  pickerItemTextActive: { color: '#00C853', fontWeight: '600' },
  checkmark: { color: '#00C853', fontSize: 16, fontWeight: '700' },
  logoutBtn: { marginHorizontal: 16, marginTop: 8, padding: 16, backgroundColor: '#1C1C1E', borderRadius: 14, borderWidth: 1, borderColor: '#2D2D2D', alignItems: 'center' },
  logoutText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  deleteBtn: { marginHorizontal: 16, marginTop: 8, padding: 16, backgroundColor: '#1A0A0A', borderRadius: 14, borderWidth: 1, borderColor: '#3D1515', alignItems: 'center' },
  deleteText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
});
