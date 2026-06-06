import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/app.store';

const CITIES = ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Nukus'];

export default function CityPickerScreen() {
  const router = useRouter();
  const { city, setCity } = useAppStore();

  const handleSelect = (c: string) => {
    setCity(c);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose City</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView>
        {CITIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.row, city === c && styles.rowActive]}
            onPress={() => handleSelect(c)}
          >
            <Text style={[styles.rowText, city === c && styles.rowTextActive]}>{c}</Text>
            {city === c && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back: { color: '#22C55E', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  row: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1F2937', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowActive: { backgroundColor: '#1A3A2E' },
  rowText: { color: '#fff', fontSize: 16 },
  rowTextActive: { color: '#22C55E', fontWeight: '700' },
  check: { color: '#22C55E', fontSize: 18 },
});
