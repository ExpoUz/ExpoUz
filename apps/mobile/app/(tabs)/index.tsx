import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { matchesApi } from '../../lib/api';

function MatchCard({ match, onPress }: { match: any; onPress: () => void }) {
  const spotsLeft = match.maxPlayers - match.currentPlayers;
  return (
    <TouchableOpacity onPress={onPress}
      style={{ backgroundColor: '#111a14', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e2e21' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <Text style={{ color: '#F0FFF4', fontSize: 15, fontWeight: '700', flex: 1 }}>{match.title}</Text>
        <View style={{ backgroundColor: spotsLeft > 0 ? '#00C85320' : '#FF525220', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: spotsLeft > 0 ? '#00C853' : '#FF5252', fontSize: 11, fontWeight: '600' }}>
            {spotsLeft > 0 ? `${spotsLeft} spots` : 'Full'}
          </Text>
        </View>
      </View>
      <Text style={{ color: '#7a9a80', fontSize: 12, marginBottom: 4 }}>
        📍 {match.pitch?.name} · {match.pitch?.district}
      </Text>
      <Text style={{ color: '#7a9a80', fontSize: 12, marginBottom: 8 }}>
        ⏰ {dayjs(match.startTime).format('ddd, D MMM · HH:mm')}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700' }}>
          {new Intl.NumberFormat('uz-UZ').format(Number(match.pricePerPlayer))} UZS
        </Text>
        <Text style={{ color: '#7a9a80', fontSize: 11 }}>{match.format} · {match.sport}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: matches, isLoading, refetch } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesApi.getAll(),
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#090E0C' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Text style={{ color: '#F0FFF4', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>ExpoUz</Text>
        <Text style={{ color: '#7a9a80', fontSize: 13 }}>Football matches near you</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#00C853" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={matches || []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatchCard match={item} onPress={() => router.push(`/match/${item.id}`)} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#00C853" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ color: '#7a9a80', fontSize: 14 }}>No matches available</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
