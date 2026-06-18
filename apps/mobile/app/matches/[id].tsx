import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { formatUZS } from '@expouz/shared';

const SPORT_ICON: Record<string, string> = { FOOTBALL: '⚽', PADEL: '🏓', TENNIS: '🎾' };
const AMENITY_ICON: Record<string, string> = {
  BATHROOM: '🚽', PARKING: '🚗', WATER_FOUNTAIN: '💧', SECURITY: '🔒', LIGHTS: '💡',
};

function StatPill({ icon, value, sub }: { icon: any; value: string; sub?: string }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={18} color="#00C853" />
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => { const r = await matchesApi.getById(id!); return r.data; },
    enabled: !!id,
  });

  const leaveMutation = useMutation({
    mutationFn: () => matchesApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      Alert.alert('Done', 'You have left the game.');
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="list" />
      </View>
    );
  }

  if (!match) return null;

  const confirmedBookings = match.bookings?.filter((b: any) => b.status === 'CONFIRMED') ?? [];
  const emptySlots = Math.max(0, match.maxPlayers - confirmedBookings.length);
  const fillRatio = match.maxPlayers > 0 ? confirmedBookings.length / match.maxPlayers : 0;

  const myBooking = confirmedBookings.find((b: any) => b.userId === user?.id);
  const isJoined = !!myBooking;
  const isFull = match.status === 'FULL' || confirmedBookings.length >= match.maxPlayers;
  const isCancelled = match.status === 'CANCELLED';

  const handleCTA = () => {
    if (isJoined) {
      Alert.alert('Leave Game?', 'You will lose your spot and a refund will go to your wallet.', [
        { text: 'Keep My Spot', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
      ]);
    } else if (!isFull && !isCancelled) {
      router.push(`/matches/${id}/join` as any);
    }
  };

  const d = new Date(match.startTime);
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Image
            source={{
              uri:
                match.pitch?.imageUrl ??
                `https://placehold.co/800x560/1A3A2E/3B7A57?text=${encodeURIComponent(SPORT_ICON[match.sport] ?? '⚽')}`,
            }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.65)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Back */}
          <TouchableOpacity
            style={[styles.heroBack, { top: insets.top + 12 }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Status badge */}
          {isCancelled && (
            <View style={[styles.heroBadge, styles.heroBadgeCancelled, { top: insets.top + 14 }]}>
              <Text style={styles.heroBadgeText}>CANCELLED</Text>
            </View>
          )}
          {isFull && !isCancelled && (
            <View style={[styles.heroBadge, styles.heroBadgeFull, { top: insets.top + 14 }]}>
              <Text style={styles.heroBadgeText}>FULL</Text>
            </View>
          )}

          {/* Title overlay */}
          <View style={styles.heroBottom}>
            <View style={styles.sportChip}>
              <Text style={styles.sportChipText}>
                {SPORT_ICON[match.sport] ?? '⚽'}{'  '}{match.sport}
              </Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>{match.title}</Text>
            <Text style={styles.heroDate}>{dateStr} · {timeStr}</Text>
          </View>
        </View>

        {/* ── Quick Stats ── */}
        <View style={styles.statsCard}>
          <StatPill icon="time-outline" value={`${match.durationMinutes} min`} />
          <View style={styles.statsDivider} />
          <StatPill icon="cash-outline" value={formatUZS(Number(match.pricePerPlayer))} sub="/ player" />
          <View style={styles.statsDivider} />
          <StatPill
            icon="people-outline"
            value={`${confirmedBookings.length}/${match.maxPlayers}`}
            sub="players"
          />
          <View style={styles.statsDivider} />
          <StatPill
            icon={match.isIndoor ? 'home-outline' : 'sunny-outline'}
            value={match.isIndoor ? 'Indoor' : 'Outdoor'}
          />
        </View>

        {/* ── Tags ── */}
        {(match.format || match.skillFilter) && (
          <View style={[styles.row, { paddingHorizontal: 16, gap: 8, marginTop: 10 }]}>
            {match.format && (
              <View style={styles.tag}><Text style={styles.tagText}>{match.format}</Text></View>
            )}
            {match.skillFilter && (
              <View style={styles.tag}><Text style={styles.tagText}>{match.skillFilter}</Text></View>
            )}
          </View>
        )}

        {/* ── Players ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Who's Playing</Text>
            <View style={styles.fillPill}>
              <Text style={styles.fillPillText}>{confirmedBookings.length}/{match.maxPlayers} joined</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.fillBarBg}>
            <View
              style={[
                styles.fillBarFg,
                {
                  width: `${Math.min(fillRatio * 100, 100)}%` as any,
                  backgroundColor: fillRatio >= 0.8 ? '#F59E0B' : '#00C853',
                },
              ]}
            />
          </View>

          {/* Avatars */}
          <View style={styles.avatarGrid}>
            {confirmedBookings.map((b: any) => (
              <TouchableOpacity
                key={b.id}
                style={styles.avatarItem}
                onPress={() => { setSelectedPlayer(b.user); setSheetVisible(true); }}
              >
                <PlayerAvatar user={b.user} size="md" showCrown={b.userId === match.hostId} />
                <Text style={styles.avatarName} numberOfLines={1}>{b.user?.firstName}</Text>
              </TouchableOpacity>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <TouchableOpacity
                key={`empty-${i}`}
                style={styles.avatarItem}
                onPress={() => !isFull && !isCancelled && router.push(`/matches/${id}/join` as any)}
              >
                <View style={styles.emptySlot}>
                  <Ionicons name="add" size={18} color="#CBD5E1" />
                </View>
                <Text style={styles.avatarNameEmpty}>Open</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Formation ── */}
        {match.formation && (
          <TouchableOpacity
            style={[styles.card, styles.row, { justifyContent: 'space-between' }]}
            onPress={() => router.push(`/matches/${id}/formation` as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.row, { gap: 12 }]}>
              <View style={styles.iconBox}>
                <Ionicons name="grid-outline" size={18} color="#00C853" />
              </View>
              <View>
                <Text style={styles.cardValue}>Formation</Text>
                <Text style={styles.cardMeta}>{match.formation}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}

        {/* ── Venue ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Where You Play</Text>
          <View style={[styles.row, { gap: 12, marginTop: 12 }]}>
            <View style={[styles.iconBox, { width: 44, height: 44, borderRadius: 14 }]}>
              <Ionicons name="location" size={20} color="#00C853" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardValue}>{match.pitch?.name ?? '—'}</Text>
              <Text style={styles.cardMeta}>{match.pitch?.addressLine ?? ''}</Text>
            </View>
          </View>
          {match.pitch?.amenities?.length > 0 && (
            <View style={[styles.row, { flexWrap: 'wrap', gap: 8, marginTop: 12 }]}>
              {match.pitch.amenities.map((a: any) => (
                <View key={a.id} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>
                    {AMENITY_ICON[a.type] ?? '✓'} {a.type.replace(/_/g, ' ')}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {match.pitch?.noMetalStuds && (
            <View style={[styles.row, { gap: 6, marginTop: 10 }]}>
              <Ionicons name="warning-outline" size={14} color="#EF4444" />
              <Text style={styles.warnText}>No metal studs allowed</Text>
            </View>
          )}
        </View>

        {/* ── Host ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Host</Text>
          <View style={[styles.row, { marginTop: 12, justifyContent: 'space-between' }]}>
            <View style={[styles.row, { gap: 12 }]}>
              <PlayerAvatar user={match.host} size="lg" showCrown />
              <View>
                <Text style={styles.cardValue}>
                  {match.host?.firstName} {match.host?.lastName}
                </Text>
                <Text style={styles.cardMeta}>
                  ELO {match.host?.eloRating ?? '—'}
                  {match.host?.skillLevel ? ` · ${match.host.skillLevel}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => router.push(`/messages/direct/${match.hostId}` as any)}
            >
              <Ionicons name="chatbubble-outline" size={14} color="#00C853" />
              <Text style={styles.chatBtnText}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Policy ── */}
        <View style={[styles.card, styles.policyCard]}>
          <Ionicons name="information-circle-outline" size={16} color="#16A34A" />
          <Text style={styles.policyText}>
            Free cancellation up to {match.cancellationDeadlineHours}h before kick-off. Full refund to wallet.
          </Text>
        </View>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          onPress={handleCTA}
          disabled={isCancelled || (isFull && !isJoined)}
          activeOpacity={0.85}
          style={[
            styles.ctaBtn,
            isCancelled && styles.ctaDisabled,
            isJoined && styles.ctaLeave,
            !isJoined && !isCancelled && !isFull && styles.ctaJoin,
            isFull && !isJoined && styles.ctaFull,
          ]}
        >
          {leaveMutation.isPending ? (
            <ActivityIndicator color={isJoined ? '#EF4444' : '#fff'} />
          ) : (
            <Text style={[styles.ctaBtnText, isJoined && { color: '#EF4444' }]}>
              {isCancelled
                ? 'Game Cancelled'
                : isJoined
                ? "✓ You're In — Tap to Leave"
                : isFull
                ? '🔔 Join Waitlist'
                : `Join  ·  ${formatUZS(Number(match.pricePerPlayer))}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Player sheet ── */}
      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} snapPoints={['40%']}>
        {selectedPlayer && (
          <View style={styles.sheetInner}>
            <PlayerAvatar user={selectedPlayer} size="lg" showElo />
            <Text style={styles.sheetName}>
              {selectedPlayer.firstName} {selectedPlayer.lastName}
            </Text>
            <Text style={styles.sheetElo}>ELO {selectedPlayer.eloRating}</Text>
            <View style={[styles.row, { gap: 40, marginTop: 20 }]}>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.sheetStatVal}>{selectedPlayer.reliabilityScore?.toFixed(0)}%</Text>
                <Text style={styles.sheetStatLbl}>Reliability</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.sheetStatVal}>{selectedPlayer.skillLevel ?? '—'}</Text>
                <Text style={styles.sheetStatLbl}>Skill Level</Text>
              </View>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },
  row: { flexDirection: 'row', alignItems: 'center' },

  hero: { height: 300, backgroundColor: '#1A3A2E' },
  heroBack: {
    position: 'absolute', left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBadge: { position: 'absolute', right: 16, zIndex: 10, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  heroBadgeCancelled: { backgroundColor: '#EF4444' },
  heroBadgeFull: { backgroundColor: '#F59E0B' },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  sportChip: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(0,200,83,0.22)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  sportChipText: { color: '#00C853', fontSize: 11, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  heroDate: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 5 },

  statsCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statPill: { flex: 1, alignItems: 'center', gap: 3 },
  statsDivider: { width: 1, height: 36, backgroundColor: '#F0F4F8' },
  statValue: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  statSub: { fontSize: 10, color: '#94A3B8' },

  tag: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '600', color: '#64748B' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  fillPill: { backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  fillPillText: { color: '#16A34A', fontSize: 11, fontWeight: '700' },
  fillBarBg: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, marginBottom: 14 },
  fillBarFg: { height: 5, borderRadius: 3 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarItem: { alignItems: 'center', width: 54 },
  avatarName: { fontSize: 10, color: '#475569', marginTop: 4, textAlign: 'center' },
  avatarNameEmpty: { fontSize: 10, color: '#CBD5E1', marginTop: 4 },
  emptySlot: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },

  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  cardValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  amenityChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFB', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#E8ECEF',
  },
  amenityText: { fontSize: 11, color: '#64748B' },
  warnText: { fontSize: 12, color: '#EF4444' },

  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#00C853', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chatBtnText: { fontSize: 12, fontWeight: '600', color: '#00C853' },

  policyCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#F0FDF4' },
  policyText: { flex: 1, fontSize: 12, color: '#16A34A', lineHeight: 18 },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F0F4F8',
  },
  ctaBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  ctaJoin: { backgroundColor: '#00C853' },
  ctaLeave: { backgroundColor: '#FFF5F5', borderWidth: 1.5, borderColor: '#EF4444' },
  ctaFull: { backgroundColor: '#FEF3C7' },
  ctaDisabled: { backgroundColor: '#E2E8F0' },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  sheetInner: { padding: 24, alignItems: 'center' },
  sheetName: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 12 },
  sheetElo: { fontSize: 13, color: '#94A3B8', marginTop: 3 },
  sheetStatVal: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sheetStatLbl: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
});
