import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { matchesApi, bookingsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { FormationPitch } from '@/components/ui/FormationPitch';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { TeamSide } from '@expouz/shared';

const { width: SCREEN_W } = Dimensions.get('window');

export default function FormationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamSide>(TeamSide.HOME);

  const { data: matchRes, isLoading: matchLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchesApi.getById(id!),
    select: (r) => r.data,
    enabled: !!id,
  });

  const { data: formationRes, isLoading: formationLoading } = useQuery({
    queryKey: ['match-formation', id],
    queryFn: () => matchesApi.getFormation(id!),
    select: (r) => r.data,
    enabled: !!id,
  });

  const match = matchRes;
  const formation = formationRes;

  const joinMutation = useMutation({
    mutationFn: () =>
      bookingsApi.create({
        matchId: id!,
        positionId: selectedPosition?.id,
        teamSide: selectedTeam as any,
        gateway: 'UZUM' as any,
      }),
    onSuccess: () => {
      Alert.alert('Joined! 🎉', 'Your spot is confirmed. See you on the pitch!', [
        { text: 'OK', onPress: () => { queryClient.invalidateQueries({ queryKey: ['match-formation', id] }); setSelectedPosition(null); } },
      ]);
    },
    onError: () => Alert.alert('Error', 'Failed to join. Please try again.'),
  });

  const allPositions = [
    ...(formation?.home ?? []),
    ...(formation?.away ?? []),
  ];

  const homePositions = allPositions.filter((p: any) => p.team === TeamSide.HOME);
  const awayPositions = allPositions.filter((p: any) => p.team === TeamSide.AWAY);
  const visiblePositions = selectedTeam === TeamSide.HOME ? homePositions : awayPositions;

  const isFull = match?.status === 'FULL';
  const isJoined = match?.userBooking != null;

  if (matchLoading || formationLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} color="#00C853" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Formation</Text>
          <Text style={styles.headerSubtitle}>{match?.formation ?? '4-3-3'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Team Toggle */}
        <View style={styles.teamToggle}>
          <TouchableOpacity
            style={[styles.teamBtn, selectedTeam === TeamSide.HOME && styles.teamBtnHome]}
            onPress={() => setSelectedTeam(TeamSide.HOME)}
          >
            <View style={[styles.teamDot, { backgroundColor: '#E63946' }]} />
            <Text style={[styles.teamBtnText, selectedTeam === TeamSide.HOME && styles.teamBtnTextActive]}>
              HOME ({homePositions.filter((p: any) => p.player).length}/{homePositions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.teamBtn, selectedTeam === TeamSide.AWAY && styles.teamBtnAway]}
            onPress={() => setSelectedTeam(TeamSide.AWAY)}
          >
            <View style={[styles.teamDot, { backgroundColor: '#1D3557' }]} />
            <Text style={[styles.teamBtnText, selectedTeam === TeamSide.AWAY && styles.teamBtnTextActive]}>
              AWAY ({awayPositions.filter((p: any) => p.player).length}/{awayPositions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Formation Pitch SVG */}
        {formation ? (
          <FormationPitch
            formation={match?.formation ?? '4-3-3'}
            positions={visiblePositions}
            onPositionPress={(pos) => {
              if (pos.player) return; // occupied
              if (!user) { router.push('/auth/phone'); return; }
              if (isJoined || isFull) return;
              setSelectedPosition(pos);
            }}
            currentUserId={user?.id}
          />
        ) : (
          <View style={styles.noFormation}>
            <Text style={styles.noFormationText}>Formation not available</Text>
          </View>
        )}

        {/* Position legend */}
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#00C853' }]} />
            <Text style={styles.legendText}>Vacant — tap to claim</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#374151' }]} />
            <Text style={styles.legendText}>Occupied</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Your spot</Text>
          </View>
        </View>

        {/* Players list */}
        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>Players ({visiblePositions.filter((p: any) => p.player).length})</Text>
          {visiblePositions.filter((p: any) => p.player).map((pos: any) => (
            <View key={pos.id ?? pos.position} style={styles.playerRow}>
              <PlayerAvatar user={pos.player} size={40} />
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {pos.player.firstName} {pos.player.lastName}
                </Text>
                <Text style={styles.playerPos}>{pos.position}</Text>
              </View>
              <View style={[styles.eloChip, { backgroundColor: pos.player.eloRating >= 1300 ? '#FEF2F2' : pos.player.eloRating >= 1100 ? '#FFFBEB' : '#F0FDF4' }]}>
                <Text style={[styles.eloText, { color: pos.player.eloRating >= 1300 ? '#EF4444' : pos.player.eloRating >= 1100 ? '#F59E0B' : '#22C55E' }]}>
                  {pos.player.eloRating ?? '1000'}
                </Text>
              </View>
            </View>
          ))}
          {visiblePositions.filter((p: any) => p.player).length === 0 && (
            <Text style={styles.emptyPlayers}>No players on this team yet</Text>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      {selectedPosition && (
        <View style={styles.ctaBar}>
          <View style={styles.ctaInfo}>
            <Text style={styles.ctaPos}>📍 {selectedPosition.position}</Text>
            <Text style={styles.ctaTeam}>{selectedTeam} team</Text>
          </View>
          <TouchableOpacity
            style={[styles.ctaBtn, joinMutation.isPending && styles.ctaBtnDisabled]}
            onPress={() => {
              Alert.alert(
                'Confirm Spot',
                `Join as ${selectedPosition.position} on ${selectedTeam} team?\nPrice: ${Number(match?.pricePerPlayer ?? 0).toLocaleString()} UZS`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Confirm →', onPress: () => joinMutation.mutate() },
                ],
              );
            }}
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.ctaBtnText}>Claim Spot →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!selectedPosition && !isJoined && !isFull && user && (
        <View style={styles.ctaHint}>
          <Text style={styles.ctaHintText}>Tap a green spot on the pitch to claim your position</Text>
        </View>
      )}

      {isJoined && (
        <View style={styles.joinedBar}>
          <Text style={styles.joinedText}>✓ You're in this game!</Text>
        </View>
      )}

      {isFull && !isJoined && (
        <View style={styles.fullBar}>
          <Text style={styles.fullText}>This game is full</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#00C853', fontSize: 22 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, color: '#6B7280' },
  teamToggle: { flexDirection: 'row', margin: 16, gap: 8 },
  teamBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151' },
  teamBtnHome: { backgroundColor: '#1A0A0A', borderColor: '#E63946' },
  teamBtnAway: { backgroundColor: '#0A0F1A', borderColor: '#1D3557' },
  teamDot: { width: 10, height: 10, borderRadius: 5 },
  teamBtnText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  teamBtnTextActive: { color: '#FFFFFF' },
  noFormation: { height: 300, alignItems: 'center', justifyContent: 'center' },
  noFormationText: { color: '#6B7280' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1A1A1A' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#9CA3AF' },
  playersSection: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  playerPos: { fontSize: 12, color: '#6B7280' },
  eloChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  eloText: { fontSize: 12, fontWeight: '700' },
  emptyPlayers: { color: '#6B7280', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1E2D3D', gap: 12 },
  ctaInfo: { flex: 1 },
  ctaPos: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  ctaTeam: { fontSize: 12, color: '#6B7280' },
  ctaBtn: { backgroundColor: '#00C853', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12 },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaHint: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(17,24,39,0.95)', borderTopWidth: 1, borderTopColor: '#1E2D3D', alignItems: 'center' },
  ctaHintText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },
  joinedBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#0A1F15', borderTopWidth: 1, borderTopColor: '#1A3A2E', alignItems: 'center' },
  joinedText: { color: '#00C853', fontWeight: '700', fontSize: 16 },
  fullBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#1A0A0A', borderTopWidth: 1, borderTopColor: '#3D1515', alignItems: 'center' },
  fullText: { color: '#EF4444', fontWeight: '700', fontSize: 16 },
});
