import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { matchesApi } from '@/lib/api';
import { useAppStore } from '@/store/app.store';
import { MatchCard } from '@/components/ui/MatchCard';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { Sport, MatchStatus } from '@playwithus/shared';

const SPORT_ICONS: Record<string, string> = {
  FOOTBALL: '⚽', PADEL: '🏓', TENNIS: '🎾',
};
const SPORTS = [Sport.FOOTBALL, Sport.PADEL, Sport.TENNIS];
const DATE_FILTERS = ['All', 'Today', 'Tomorrow', 'This Weekend', 'Open Only'];

export default function GamesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { sport, setSport, city } = useAppStore();
  const [dateFilter, setDateFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const isFiltered = sport !== Sport.FOOTBALL || dateFilter !== 'All';

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['matches', sport, city, dateFilter],
    queryFn: () => matchesApi.list({ sport, city, status: dateFilter === 'Open Only' ? MatchStatus.OPEN : undefined }),
  });

  const matches = data?.data?.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>FUBLES UZ</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.filterToggleBtn, isFiltered && styles.filterToggleBtnActive]}
            onPress={() => setShowFilters((v) => !v)}
          >
            <Text style={[styles.filterToggleText, isFiltered && styles.filterToggleTextActive]}>
              {SPORT_ICONS[sport]} {sport}{dateFilter !== 'All' ? ` · ${dateFilter}` : ''}
            </Text>
            <Text style={[styles.filterArrow, isFiltered && styles.filterToggleTextActive]}>
              {showFilters ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cityBtn} onPress={() => router.push('/settings/city')}>
            <Text style={styles.cityText}>📍 {city}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterSectionLabel}>SPORT</Text>
          <View style={styles.filterChipRow}>
            {SPORTS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSport(s)}
                style={[styles.filterChip, sport === s && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, sport === s && styles.filterChipTextActive]}>
                  {SPORT_ICONS[s]} {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterSectionLabel, { marginTop: 12 }]}>DATE</Text>
          <View style={styles.filterChipRow}>
            {DATE_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setDateFilter(f)}
                style={[styles.filterChip, dateFilter === f && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, dateFilter === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => setShowFilters(false)}
          >
            <Text style={styles.applyBtnText}>Apply Filters ✓</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Match list */}
      {isLoading ? (
        <SkeletonLoader variant="card" count={4} />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MatchCard match={item} onPress={() => router.push(`/matches/${item.id}`)} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00C853" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>⚽</Text>
              <Text style={styles.emptyTitle}>{t('games.noGamesFound')}</Text>
              <Text style={styles.emptyBody}>Be the first to host a game!</Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/matches/create')}>
                <Text style={styles.ctaText}>+ Host a Game</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/matches/create')}>
        <Text style={styles.fabText}>＋ Host</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  appName: { color: '#00C853', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cityBtn: { backgroundColor: '#1A3A2E', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  cityText: { color: '#00C853', fontSize: 12, fontWeight: '600' },
  filterToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#374151' },
  filterToggleBtnActive: { backgroundColor: '#1A3A2E', borderColor: '#00C853' },
  filterToggleText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  filterToggleTextActive: { color: '#00C853' },
  filterArrow: { color: '#9CA3AF', fontSize: 10 },
  filterPanel: { backgroundColor: '#111827', marginHorizontal: 12, marginBottom: 8, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1E2D3D' },
  filterSectionLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 8 },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#374151' },
  filterChipActive: { backgroundColor: '#1A3A2E', borderColor: '#00C853' },
  filterChipText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#00C853' },
  applyBtn: { marginTop: 12, backgroundColor: '#00C853', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#6B7280', fontSize: 14, marginBottom: 24 },
  ctaBtn: { backgroundColor: '#00C853', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  ctaText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#00C853', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, elevation: 8, shadowColor: '#00C853', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  fabText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
