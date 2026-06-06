import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi, bookingsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

const STAT_LABELS: Record<string, string> = {
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  allTime: 'All Time',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [statPeriod, setStatPeriod] = useState<'thisWeek' | 'thisMonth' | 'allTime'>('thisMonth');

  const { data: profile, isLoading: profileLoading, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: () => usersApi.getMe(),
    select: (res) => res.data,
    enabled: !!user,
  });

  const { data: bookingsRes, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingsApi.getMyBookings({ limit: 5 }),
    select: (res) => res.data,
    enabled: !!user,
  });

  const recentBookings = bookingsRes?.data ?? [];

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
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

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.guestContainer}>
          <Text style={styles.guestEmoji}>👤</Text>
          <Text style={styles.guestTitle}>Not Signed In</Text>
          <Text style={styles.guestSubtitle}>Sign in to track your games, stats, and more</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/auth/phone')}>
            <Text style={styles.signInBtnText}>Sign In with Phone 📱</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <SkeletonLoader variant="card" />
      </SafeAreaView>
    );
  }

  const p = profile ?? user;
  const eloColor = (p as any).eloRating >= 1300 ? '#EF4444' : (p as any).eloRating >= 1100 ? '#F59E0B' : '#22C55E';
  const skillLabel = (p as any).skillLevel ?? 'AMATEUR';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={profileLoading} onRefresh={refetch} tintColor="#00C853" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            {(p as any).avatarUrl ? (
              <Image source={{ uri: (p as any).avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {((p as any).firstName?.[0] ?? '?')}{((p as any).lastName?.[0] ?? '')}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarBtn} onPress={() => router.push('/settings/edit-profile' as any)}>
              <Text style={styles.editAvatarIcon}>✏️</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.displayName}>{(p as any).firstName} {(p as any).lastName}</Text>
          <Text style={styles.phone}>{(p as any).phone}</Text>

          <View style={styles.badgesRow}>
            <View style={[styles.skillBadge, { backgroundColor: skillLabel === 'PRO' ? '#FEF2F2' : skillLabel === 'BEGINNER' ? '#F0FDF4' : '#FFFBEB' }]}>
              <Text style={[styles.skillText, { color: skillLabel === 'PRO' ? '#EF4444' : skillLabel === 'BEGINNER' ? '#22C55E' : '#F59E0B' }]}>
                {skillLabel === 'PRO' ? '🔴' : skillLabel === 'BEGINNER' ? '🟢' : '🟡'} {skillLabel}
              </Text>
            </View>
            {(p as any).isVerified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ Verified</Text>
              </View>
            )}
          </View>

          {(p as any).bio ? (
            <Text style={styles.bio}>{(p as any).bio}</Text>
          ) : null}

          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/settings/edit-profile' as any)}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statsPeriodRow}>
            {(['thisWeek', 'thisMonth', 'allTime'] as const).map((p2) => (
              <TouchableOpacity
                key={p2}
                style={[styles.periodBtn, statPeriod === p2 && styles.periodBtnActive]}
                onPress={() => setStatPeriod(p2)}
              >
                <Text style={[styles.periodBtnText, statPeriod === p2 && styles.periodBtnTextActive]}>
                  {STAT_LABELS[p2]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: eloColor }]}>{(p as any).eloRating ?? 1000}</Text>
              <Text style={styles.statLabel}>ELO Rating</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{Math.round((p as any).reliabilityScore ?? 100)}%</Text>
              <Text style={styles.statLabel}>Reliability</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{(p as any).city ?? 'Tashkent'}</Text>
              <Text style={styles.statLabel}>City</Text>
            </View>
          </View>
        </View>

        {/* Recent Games */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Games</Text>
          {bookingsLoading ? (
            <SkeletonLoader variant="list" />
          ) : recentBookings.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyEmoji}>⚽</Text>
              <Text style={styles.emptyText}>No games yet</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/games' as any)}>
                <Text style={styles.emptyLink}>Find a game →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentBookings.map((b: any) => (
              <TouchableOpacity
                key={b.id}
                style={styles.bookingRow}
                onPress={() => router.push(`/matches/${b.matchId}` as any)}
              >
                <View style={styles.bookingLeft}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>{b.match?.title ?? 'Match'}</Text>
                  <Text style={styles.bookingMeta}>
                    {b.match?.pitch?.name ?? ''} · {b.status}
                  </Text>
                </View>
                <Text style={styles.bookingArrow}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { paddingBottom: 120 },
  guestContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  guestEmoji: { fontSize: 64 },
  guestTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  guestSubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  signInBtn: { backgroundColor: '#00C853', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  signInBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  header: { backgroundColor: '#111827', padding: 24, alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#00C853' },
  avatarFallback: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1A3A2E', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#00C853' },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: '#00C853' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1F2937', borderRadius: 12, padding: 4 },
  editAvatarIcon: { fontSize: 14 },
  displayName: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  phone: { fontSize: 14, color: '#9CA3AF' },
  badgesRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  skillBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  skillText: { fontSize: 12, fontWeight: '600' },
  verifiedBadge: { backgroundColor: '#1A3A2E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  verifiedText: { fontSize: 12, fontWeight: '600', color: '#00C853' },
  bio: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 4, paddingHorizontal: 16 },
  editBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#374151' },
  editBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
  statsCard: { margin: 16, backgroundColor: '#111827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E2D3D' },
  statsPeriodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1F2937', alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#00C853' },
  periodBtnText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  emptySection: { backgroundColor: '#111827', borderRadius: 12, padding: 24, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 32 },
  emptyText: { fontSize: 14, color: '#6B7280' },
  emptyLink: { fontSize: 14, color: '#00C853', fontWeight: '600' },
  bookingRow: { backgroundColor: '#111827', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bookingLeft: { flex: 1, gap: 2 },
  bookingTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  bookingMeta: { fontSize: 12, color: '#6B7280' },
  bookingArrow: { color: '#374151', fontSize: 20 },
  logoutBtn: { margin: 16, padding: 16, backgroundColor: '#1F1212', borderRadius: 14, borderWidth: 1, borderColor: '#3D1515', alignItems: 'center' },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
});
