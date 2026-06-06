import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { pitchesApi, matchesApi } from '@/lib/api';
import { useAppStore } from '@/store/app.store';

type MapMode = 'pitches' | 'matches';

// Tashkent districts with approximate coordinates for display
const DISTRICT_DOTS = [
  { name: 'Mirzo Ulugbek', x: 0.62, y: 0.32 },
  { name: 'Yunusabad', x: 0.52, y: 0.22 },
  { name: 'Chilanzar', x: 0.28, y: 0.54 },
  { name: 'Sergeli', x: 0.40, y: 0.72 },
  { name: 'Uchtepa', x: 0.18, y: 0.44 },
  { name: 'Yakkasaray', x: 0.48, y: 0.50 },
  { name: 'Shayhontohur', x: 0.38, y: 0.38 },
  { name: 'Almazar', x: 0.30, y: 0.24 },
  { name: 'Olmazor', x: 0.20, y: 0.32 },
  { name: 'Yashnobod', x: 0.60, y: 0.58 },
  { name: 'Bektemir', x: 0.72, y: 0.60 },
  { name: 'Uskur', x: 0.55, y: 0.72 },
];

export default function MapScreen() {
  const router = useRouter();
  const { city } = useAppStore();
  const [mode, setMode] = useState<MapMode>('pitches');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const { data: pitchesRes, isLoading: pitchesLoading } = useQuery({
    queryKey: ['pitches', city],
    queryFn: () => pitchesApi.list({ city }),
    select: (r) => r.data,
    enabled: mode === 'pitches',
  });

  const { data: matchesRes, isLoading: matchesLoading } = useQuery({
    queryKey: ['matches-map', city],
    queryFn: () => matchesApi.list({ city }),
    select: (r) => r.data?.data ?? r.data,
    enabled: mode === 'matches',
  });

  const pitches = pitchesRes?.data ?? pitchesRes ?? [];
  const matches = matchesRes ?? [];
  const isLoading = pitchesLoading || matchesLoading;

  // Map pitch/match to district dots (simplified — uses pitch.district)
  const enrichedDots = DISTRICT_DOTS.map((dot) => {
    if (mode === 'pitches') {
      const districtPitches = pitches.filter((p: any) =>
        p.district?.toLowerCase().includes(dot.name.toLowerCase().split(' ')[0].toLowerCase())
      );
      return { ...dot, count: districtPitches.length, items: districtPitches };
    } else {
      const districtMatches = matches.filter((m: any) =>
        m.pitch?.district?.toLowerCase().includes(dot.name.toLowerCase().split(' ')[0].toLowerCase())
      );
      return { ...dot, count: districtMatches.length, items: districtMatches };
    }
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📍 {city}</Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'pitches' && styles.modeBtnActive]}
            onPress={() => { setMode('pitches'); setSelectedItem(null); }}
          >
            <Text style={[styles.modeBtnText, mode === 'pitches' && styles.modeBtnTextActive]}>🏟 Pitches</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'matches' && styles.modeBtnActive]}
            onPress={() => { setMode('matches'); setSelectedItem(null); }}
          >
            <Text style={[styles.modeBtnText, mode === 'matches' && styles.modeBtnTextActive]}>⚽ Games</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Schematic map */}
      <View style={styles.mapContainer}>
        <View style={styles.mapBg}>
          <Text style={styles.mapLabel}>Tashkent</Text>

          {/* District dots */}
          {enrichedDots.map((dot) => (
            <TouchableOpacity
              key={dot.name}
              style={[
                styles.dotWrap,
                {
                  left: `${dot.x * 100}%` as any,
                  top: `${dot.y * 100}%` as any,
                },
              ]}
              onPress={() => setSelectedItem(dot.items[0] ?? null)}
            >
              <View style={[styles.dot, dot.count > 0 ? styles.dotActive : styles.dotInactive]}>
                {dot.count > 0 && (
                  <Text style={styles.dotCount}>{dot.count}</Text>
                )}
              </View>
              <Text style={styles.dotLabel} numberOfLines={1}>{dot.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Selected item card */}
      {selectedItem && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedTitle} numberOfLines={1}>
              {selectedItem.name ?? selectedItem.title ?? 'Details'}
            </Text>
            <TouchableOpacity onPress={() => setSelectedItem(null)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedMeta}>
            {selectedItem.district ?? selectedItem.pitch?.district ?? ''} · {selectedItem.city ?? selectedItem.pitch?.city ?? city}
          </Text>
          {selectedItem.hourlyRate && (
            <Text style={styles.selectedRate}>{Number(selectedItem.hourlyRate).toLocaleString()} UZS/hr</Text>
          )}
          {selectedItem.pricePerPlayer && (
            <Text style={styles.selectedRate}>{Number(selectedItem.pricePerPlayer).toLocaleString()} UZS/player</Text>
          )}
          <TouchableOpacity
            style={styles.selectedBtn}
            onPress={() => {
              setSelectedItem(null);
              if (mode === 'pitches') router.push(`/pitches/${selectedItem.id}` as any);
              else router.push(`/matches/${selectedItem.id}` as any);
            }}
          >
            <Text style={styles.selectedBtnText}>View Details →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List below map */}
      {isLoading ? (
        <ActivityIndicator style={{ margin: 20 }} color="#00C853" />
      ) : (
        <ScrollView style={styles.listArea} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <Text style={styles.listSectionTitle}>
            {mode === 'pitches' ? `${pitches.length} Pitches in ${city}` : `${matches.length} Open Games`}
          </Text>
          {(mode === 'pitches' ? pitches : matches).map((item: any) => (
            <TouchableOpacity
              key={item.id}
              style={styles.listItem}
              onPress={() => {
                if (mode === 'pitches') router.push(`/pitches/${item.id}` as any);
                else router.push(`/matches/${item.id}` as any);
              }}
            >
              <View style={styles.listItemLeft}>
                <Text style={styles.listItemIcon}>{mode === 'pitches' ? '🏟' : '⚽'}</Text>
                <View>
                  <Text style={styles.listItemName} numberOfLines={1}>
                    {item.name ?? item.title}
                  </Text>
                  <Text style={styles.listItemMeta}>
                    {item.district ?? item.pitch?.district ?? ''} · {mode === 'pitches' ? `${Number(item.hourlyRate).toLocaleString()} UZS/hr` : `${Number(item.pricePerPlayer).toLocaleString()} UZS`}
                  </Text>
                </View>
              </View>
              <Text style={styles.listItemArrow}>›</Text>
            </TouchableOpacity>
          ))}
          {(mode === 'pitches' ? pitches : matches).length === 0 && (
            <View style={styles.emptyList}>
              <Text style={styles.emptyListEmoji}>{mode === 'pitches' ? '🏟' : '⚽'}</Text>
              <Text style={styles.emptyListText}>No {mode === 'pitches' ? 'pitches' : 'games'} found in {city}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  modeToggle: { flexDirection: 'row', backgroundColor: '#1F2937', borderRadius: 10, padding: 2, gap: 2 },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  modeBtnActive: { backgroundColor: '#00C853' },
  modeBtnText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  modeBtnTextActive: { color: '#fff', fontWeight: '600' },
  mapContainer: { height: 260, margin: 12, borderRadius: 16, overflow: 'hidden' },
  mapBg: { flex: 1, backgroundColor: '#0A1F15', borderRadius: 16, borderWidth: 1, borderColor: '#1A3A2E', position: 'relative' },
  mapLabel: { position: 'absolute', top: 8, left: 12, color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  dotWrap: { position: 'absolute', alignItems: 'center', transform: [{ translateX: -16 }, { translateY: -16 }] },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: '#00C853' },
  dotInactive: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151' },
  dotCount: { color: '#fff', fontSize: 11, fontWeight: '800' },
  dotLabel: { fontSize: 9, color: '#6B7280', marginTop: 2, maxWidth: 50, textAlign: 'center' },
  selectedCard: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E2D3D' },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  selectedTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  closeBtn: { color: '#6B7280', fontSize: 18, paddingLeft: 12 },
  selectedMeta: { fontSize: 13, color: '#9CA3AF', marginBottom: 4 },
  selectedRate: { fontSize: 14, fontWeight: '600', color: '#00C853', marginBottom: 8 },
  selectedBtn: { backgroundColor: '#00C853', borderRadius: 10, padding: 10, alignItems: 'center' },
  selectedBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listArea: { flex: 1 },
  listSectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, padding: 14, marginBottom: 8 },
  listItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  listItemIcon: { fontSize: 24 },
  listItemName: { fontSize: 15, color: '#FFFFFF', fontWeight: '600', marginBottom: 2 },
  listItemMeta: { fontSize: 12, color: '#6B7280' },
  listItemArrow: { color: '#374151', fontSize: 20 },
  emptyList: { alignItems: 'center', padding: 32, gap: 12 },
  emptyListEmoji: { fontSize: 40 },
  emptyListText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
