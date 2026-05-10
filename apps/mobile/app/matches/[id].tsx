import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { Badge } from '@/components/ui/Badge';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { formatUZS } from '@fubles-uz/shared';

const { width } = Dimensions.get('window');

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerSheetVisible, setPlayerSheetVisible] = useState(false);

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.matches.getOne(id!),
    enabled: !!id,
  });

  const joinMutation = useMutation({
    mutationFn: () => router.push(`/matches/${id}/join` as any),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.matches.leave(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      Alert.alert(t('common.success'), t('games.leftGame'));
    },
  });

  const myBooking = match?.bookings?.find((b: any) => b.userId === user?.id);
  const isHost = match?.hostId === user?.id;
  const isFull = match?.status === 'FULL' || match?.currentPlayers >= match?.maxPlayers;
  const isCancelled = match?.status === 'CANCELLED';
  const isJoined = !!myBooking && myBooking.status === 'CONFIRMED';

  const handleCTA = () => {
    if (isJoined) {
      Alert.alert(t('games.leaveGame'), t('games.leaveConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('games.leave'), style: 'destructive', onPress: () => leaveMutation.mutate() },
      ]);
    } else if (!isFull && !isCancelled) {
      router.push(`/matches/${id}/join` as any);
    }
  };

  const formatDateTime = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50">
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="list" />
      </View>
    );
  }

  if (!match) return null;

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Hero */}
        <View style={{ height: 220, backgroundColor: '#1A3A2E' }}>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
          />
          <View className="absolute bottom-4 left-4 right-4">
            <Text className="text-white text-xl font-bold">{match.title}</Text>
            <Text className="text-gray-300 text-sm mt-1">{formatDateTime(match.startTime)}</Text>
          </View>
        </View>

        {/* Info Block */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm">
          <View className="flex-row flex-wrap gap-2 mb-3">
            <Badge label={match.format} variant="custom" />
            {match.isIndoor && <Badge label={t('games.indoor')} variant="indoor" />}
            <Badge label={match.skillFilter || t('games.allLevels')} variant="skill" />
            {isFull && <Badge label={t('games.full')} variant="full" />}
          </View>

          <View className="flex-row items-center mb-2">
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text className="text-gray-600 ml-2">{match.durationMinutes} min</Text>
          </View>
          <View className="flex-row items-center mb-2">
            <Ionicons name="cash-outline" size={16} color="#6B7280" />
            <Text className="text-gray-600 ml-2">{formatUZS(Number(match.pricePerPlayer))} / player</Text>
          </View>
          <View className="flex-row items-center mb-2">
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <Text className="text-gray-600 ml-2">
              {match.currentPlayers}/{match.maxPlayers} {t('games.players')}
            </Text>
          </View>

          {match.description ? (
            <Text className="text-gray-600 text-sm mt-2">{match.description}</Text>
          ) : null}
          <Text className="text-gray-400 text-xs mt-2">
            {t('games.cancellationPolicy', { hours: match.cancellationDeadlineHours })}
          </Text>
        </View>

        {/* Who's Playing */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm">
          <Text className="text-gray-900 font-bold text-base mb-3">
            {t('games.whoIsPlaying')} ({match.currentPlayers}/{match.maxPlayers})
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {match.bookings
              ?.filter((b: any) => b.status === 'CONFIRMED')
              .map((b: any) => (
                <TouchableOpacity
                  key={b.id}
                  className="items-center w-16"
                  onPress={() => {
                    setSelectedPlayer(b.user);
                    setPlayerSheetVisible(true);
                  }}
                >
                  <PlayerAvatar user={b.user} size="md" showCrown={b.userId === match.hostId} />
                  <Text className="text-xs text-gray-700 mt-1 text-center" numberOfLines={1}>
                    {b.user?.firstName}
                  </Text>
                </TouchableOpacity>
              ))}
            {Array.from({ length: Math.max(0, match.maxPlayers - match.currentPlayers) }).map((_, i) => (
              <TouchableOpacity
                key={`empty-${i}`}
                className="items-center w-16"
                onPress={() => router.push(`/matches/${id}/join` as any)}
              >
                <View className="w-12 h-12 rounded-full border-2 border-dashed border-primary items-center justify-center">
                  <Ionicons name="add" size={20} color="#00C853" />
                </View>
                <Text className="text-xs text-primary mt-1">{t('games.available')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Formation */}
        {match.formation && (
          <TouchableOpacity
            className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm flex-row items-center justify-between"
            onPress={() => router.push(`/matches/${id}/formation` as any)}
          >
            <View>
              <Text className="font-bold text-gray-900">{t('formation.viewFormation')}</Text>
              <Text className="text-gray-500 text-sm">{match.formation} formation</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#00C853" />
          </TouchableOpacity>
        )}

        {/* Where */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm">
          <Text className="font-bold text-gray-900 mb-3">{t('games.whereYouPlay')}</Text>
          <Text className="font-semibold text-gray-800">{match.pitch?.name}</Text>
          <Text className="text-gray-500 text-sm">{match.pitch?.addressLine}</Text>
          {match.pitch?.noMetalStuds && (
            <Text className="text-error text-sm mt-2">🚫 {t('games.noMetalStuds')}</Text>
          )}
          <View className="flex-row mt-3 gap-4">
            {match.pitch?.amenities?.map((a: any) => (
              <Text key={a.id} className="text-gray-500 text-xs">
                {a.type === 'BATHROOM' ? '🚽' : a.type === 'PARKING' ? '🚗' : a.type === 'WATER_FOUNTAIN' ? '💧' : a.type === 'SECURITY' ? '🔒' : a.type === 'LIGHTS' ? '💡' : '✓'}
              </Text>
            ))}
          </View>
        </View>

        {/* Host */}
        <View className="bg-white mx-4 mt-4 mb-32 rounded-2xl p-4 shadow-sm">
          <Text className="font-bold text-gray-900 mb-3">{t('games.yourHost')}</Text>
          <View className="flex-row items-center">
            <PlayerAvatar user={match.host} size="lg" showCrown />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-gray-900">
                {match.host?.firstName} {match.host?.lastName}
              </Text>
              <Text className="text-gray-500 text-sm">ELO {match.host?.eloRating}</Text>
            </View>
            <TouchableOpacity
              className="bg-primary px-3 py-2 rounded-xl"
              onPress={() => router.push(`/messages/direct/${match.hostId}` as any)}
            >
              <Text className="text-white text-sm font-semibold">{t('games.contactHost')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-4">
        <TouchableOpacity
          onPress={handleCTA}
          disabled={isCancelled || (isFull && !isJoined)}
          className={`rounded-xl py-4 items-center ${
            isCancelled ? 'bg-gray-300' : isJoined ? 'border-2 border-primary bg-white' : isFull ? 'bg-warning' : 'bg-accent'
          }`}
        >
          {leaveMutation.isPending ? (
            <ActivityIndicator color={isJoined ? '#00C853' : '#fff'} />
          ) : (
            <Text
              className={`font-bold text-base ${isJoined ? 'text-primary' : 'text-white'}`}
            >
              {isCancelled
                ? t('games.gameCancelled')
                : isJoined
                ? `✓ ${t('games.youreIn')} — ${t('games.leave')}`
                : isFull
                ? `🔔 ${t('games.joinWaitlist')}`
                : t('games.join')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Player Profile Sheet */}
      <BottomSheet
        visible={playerSheetVisible}
        onClose={() => setPlayerSheetVisible(false)}
        snapPoints={['40%']}
      >
        {selectedPlayer && (
          <View className="p-6 items-center">
            <PlayerAvatar user={selectedPlayer} size="lg" showElo />
            <Text className="text-xl font-bold mt-3">
              {selectedPlayer.firstName} {selectedPlayer.lastName}
            </Text>
            <Text className="text-gray-500">ELO {selectedPlayer.eloRating}</Text>
            <View className="flex-row mt-4 gap-6">
              <View className="items-center">
                <Text className="font-bold text-gray-900">{selectedPlayer.reliabilityScore?.toFixed(0)}%</Text>
                <Text className="text-xs text-gray-500">{t('profile.reliability')}</Text>
              </View>
              <View className="items-center">
                <Text className="font-bold text-gray-900">{selectedPlayer.skillLevel}</Text>
                <Text className="text-xs text-gray-500">{t('profile.skill')}</Text>
              </View>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}
