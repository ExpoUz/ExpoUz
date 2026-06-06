import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { pitchAdminApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'text-green-400',
  FULL: 'text-blue-400',
  CONFIRMED: 'text-blue-400',
  IN_PROGRESS: 'text-purple-400',
  COMPLETED: 'text-gray-400',
  CANCELLED: 'text-red-400',
};

export default function AdminEventsScreen() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = async () => {
    try {
      const { data } = await pitchAdminApi.getMatches({ page: 1, limit: 50 });
      setMatches(data.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadMatches(); }, []);

  const handleCancel = (id: string, title: string) => {
    Alert.alert('Cancel match event', `Cancel "${title}"?`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await pitchAdminApi.cancelMatch(id);
            setMatches((prev) =>
              prev.map((m) => (m.id === id ? { ...m, status: 'CANCELLED' } : m)),
            );
          } catch {
            Alert.alert('Error', 'Could not cancel this match.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMatches(); }} tintColor="#3B82F6" />
      }
    >
      <Text className="text-white text-2xl font-bold mt-10 mb-6">⚽ Match Events</Text>

      {matches.length === 0 ? (
        <View className="bg-gray-900 rounded-2xl p-8 items-center">
          <Text className="text-3xl mb-2">⚽</Text>
          <Text className="text-white font-semibold">No match events</Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Matches hosted on your pitches will appear here.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {matches.map((m) => {
            const start = new Date(m.startTime);
            const isUpcoming = start > new Date();
            const canCancel = ['OPEN', 'FULL', 'CONFIRMED'].includes(m.status);

            return (
              <View key={m.id} className="bg-gray-900 rounded-2xl p-4">
                {/* Header */}
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-white font-bold text-base">{m.title}</Text>
                    <Text className="text-gray-400 text-sm">{m.pitch?.name}</Text>
                  </View>
                  <View
                    className={`rounded-full px-2 py-0.5 border ${
                      canCancel
                        ? 'border-green-700 bg-green-900/30'
                        : m.status === 'CANCELLED'
                        ? 'border-red-700 bg-red-900/30'
                        : 'border-gray-600 bg-gray-800'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${STATUS_COLORS[m.status] ?? 'text-gray-400'}`}>
                      {m.status}
                    </Text>
                  </View>
                </View>

                {/* Details row */}
                <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-3">
                  <Text className="text-gray-400 text-xs">
                    🕐 {start.toLocaleString('en-UZ', { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    👤 Host: {m.host?.firstName} {m.host?.lastName}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    🎫 {m._count?.bookings ?? 0}/{m.maxPlayers} players
                  </Text>
                  {isUpcoming && (
                    <View className="bg-green-900/40 border border-green-700 rounded-full px-2 py-0.5">
                      <Text className="text-green-400 text-xs">Upcoming</Text>
                    </View>
                  )}
                </View>

                {canCancel && (
                  <TouchableOpacity
                    onPress={() => handleCancel(m.id, m.title)}
                    className="self-start bg-red-900/30 border border-red-800 rounded-xl px-4 py-2"
                  >
                    <Text className="text-red-400 text-sm font-semibold">Cancel Event</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
