import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { MapPin, Clock, Users, Trophy, ChevronLeft } from 'lucide-react-native';
import { matchesApi, bookingsApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

function InfoRow({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Icon size={16} color="#7a9a80" />
      <Text style={{ color: '#7a9a80', fontSize: 13 }}>{text}</Text>
    </View>
  );
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchesApi.getOne(id),
  });

  const { mutate: join, isPending } = useMutation({
    mutationFn: () => bookingsApi.create({ matchId: id, gateway: 'WALLET' }),
    onSuccess: (data) => {
      Alert.alert('🎉 Booking Created!', `Match booked. Amount: ${new Intl.NumberFormat('uz-UZ').format(data.amount)} UZS`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to join'),
  });

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: '#090E0C', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#00C853" />
    </View>
  );

  if (!match) return null;

  const spotsLeft = match.maxPlayers - match.currentPlayers;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#090E0C' }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <ChevronLeft size={24} color="#F0FFF4" />
        </TouchableOpacity>
        <Text style={{ color: '#F0FFF4', fontSize: 22, fontWeight: '900', marginBottom: 4 }}>{match.title}</Text>
        <View style={{ backgroundColor: spotsLeft > 0 ? '#00C85320' : '#FF525220', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 16 }}>
          <Text style={{ color: spotsLeft > 0 ? '#00C853' : '#FF5252', fontSize: 12, fontWeight: '600' }}>
            {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
          </Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#111a14', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e2e21' }}>
        <InfoRow icon={MapPin} text={`${match.pitch?.name} · ${match.pitch?.district}, ${match.pitch?.city}`} />
        <InfoRow icon={Clock} text={dayjs(match.startTime).format('ddd D MMM, HH:mm')} />
        <InfoRow icon={Users} text={`${match.currentPlayers}/${match.maxPlayers} players · ${match.format}`} />
        <InfoRow icon={Trophy} text={`${match.skillFilter || 'Any level'} · ${match.sport}`} />
      </View>

      <View style={{ backgroundColor: '#111a14', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e2e21' }}>
        <Text style={{ color: '#7a9a80', fontSize: 12, marginBottom: 4 }}>Price per player</Text>
        <Text style={{ color: '#FFD700', fontSize: 28, fontWeight: '900' }}>
          {new Intl.NumberFormat('uz-UZ').format(Number(match.pricePerPlayer))} UZS
        </Text>
        <Text style={{ color: '#7a9a80', fontSize: 11, marginTop: 4 }}>+5% platform fee on checkout</Text>
      </View>

      {match.description && (
        <View style={{ backgroundColor: '#111a14', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e2e21' }}>
          <Text style={{ color: '#7a9a80', fontSize: 12, marginBottom: 6 }}>About this match</Text>
          <Text style={{ color: '#F0FFF4', fontSize: 14, lineHeight: 20 }}>{match.description}</Text>
        </View>
      )}

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#090E0C', borderTopWidth: 1, borderTopColor: '#1e2e21' }}>
        {!token ? (
          <TouchableOpacity onPress={() => router.push('/auth/phone')}
            style={{ backgroundColor: '#00C853', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Sign in to Join</Text>
          </TouchableOpacity>
        ) : spotsLeft > 0 ? (
          <TouchableOpacity onPress={() => join()} disabled={isPending}
            style={{ backgroundColor: isPending ? '#1e2e21' : '#00C853', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{isPending ? 'Booking...' : '⚽ Join Match'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ backgroundColor: '#1e2e21', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#7a9a80', fontSize: 17, fontWeight: '800' }}>Match Full</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
