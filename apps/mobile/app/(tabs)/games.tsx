import React, { useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { matchesApi } from '@/lib/api';
import { useAppStore } from '@/store/app.store';
import { MatchCard } from '@/components/ui/MatchCard';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { Sport, MatchStatus } from '@fubles-uz/shared';

const SPORTS = [Sport.FOOTBALL, Sport.FUTSAL, Sport.BASKETBALL, Sport.VOLLEYBALL];
const FILTERS = ['All', 'Today', 'Tomorrow', 'This Weekend', 'Open Only'];

export default function GamesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { sport, setSport, city } = useAppStore();
  const [filter, setFilter] = useState('All');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['matches', sport, city, filter],
    queryFn: () => matchesApi.list({ sport, city, status: filter === 'Open Only' ? MatchStatus.OPEN : undefined }),
  });

  const matches = data?.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>FUBLES UZ</Text>
        <TouchableOpacity style={styles.cityBtn} onPress={() => router.push('/settings/city')}>
          <Text style={styles.cityText}>📍 {city}</Text>
        </TouchableOpacity>
      </View>

      {/* Sport selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportScroll} contentContainerStyle={styles.sportRow}>
        {SPORTS.map((s) => (
          <TouchableOpacity key={s} onPress={() => setSport(s)} style={[styles.sportChip, sport === s && styles.sportActive]}>
            <Text style={[styles.sportText, sport === s && styles.sportTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filter bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
  cityBtn: { backgroundColor: '#1A3A2E', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  cityText: { color: '#00C853', fontSize: 13, fontWeight: '600' },
  sportScroll: { maxHeight: 50 },
  sportRow: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  sportChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#374151' },
  sportActive: { backgroundColor: '#1A3A2E', borderColor: '#00C853' },
  sportText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  sportTextActive: { color: '#00C853' },
  filterScroll: { maxHeight: 46 },
  filterRow: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1A1A1A' },
  filterActive: { backgroundColor: '#2D5A3F' },
  filterText: { color: '#6B7280', fontSize: 12 },
  filterTextActive: { color: '#FFF', fontWeight: '600' },
  empty: { alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#6B7280', fontSize: 14, marginBottom: 24 },
  ctaBtn: { backgroundColor: '#00C853', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  ctaText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#00C853', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, elevation: 8, shadowColor: '#00C853', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  fabText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
