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

type BookingTab = 'PITCH_HIRE' | 'MATCH';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'text-green-400',
  PENDING_PAYMENT: 'text-yellow-400',
  CANCELLED_REFUND: 'text-red-400',
  CANCELLED_PENALTY: 'text-red-400',
  COMPLETED: 'text-blue-400',
  IN_PROGRESS: 'text-purple-400',
};

export default function AdminBookingsScreen() {
  const [tab, setTab] = useState<BookingTab>('PITCH_HIRE');
  const [pitchBookings, setPitchBookings] = useState<any[]>([]);
  const [matchBookings, setMatchBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [pb, mb] = await Promise.all([
        pitchAdminApi.getPitchBookings().then((r) => r.data.data ?? []),
        pitchAdminApi.getMatches().then((r) => r.data.data ?? []),
      ]);
      setPitchBookings(pb);
      setMatchBookings(mb);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCancelPitchBooking = (id: string, title: string) => {
    Alert.alert('Cancel booking', `Cancel "${title}"?`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await pitchAdminApi.cancelPitchBooking(id);
            setPitchBookings((prev) =>
              prev.map((b) =>
                b.id === id ? { ...b, status: 'CANCELLED_REFUND' } : b,
              ),
            );
          } catch {
            Alert.alert('Error', 'Could not cancel booking.');
          }
        },
      },
    ]);
  };

  const handleCancelMatch = (id: string, title: string) => {
    Alert.alert('Cancel match', `Cancel "${title}"?`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel match',
        style: 'destructive',
        onPress: async () => {
          try {
            await pitchAdminApi.cancelMatch(id);
            setMatchBookings((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, status: 'CANCELLED' } : m,
              ),
            );
          } catch {
            Alert.alert('Error', 'Could not cancel match.');
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
    <View className="flex-1 bg-gray-950">
      <View className="px-5 pt-12 pb-3">
        <Text className="text-white text-2xl font-bold mb-4">📋 Bookings</Text>

        {/* Tab selector */}
        <View className="flex-row bg-gray-900 rounded-xl p-1">
          {(['PITCH_HIRE', 'MATCH'] as BookingTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg items-center ${tab === t ? 'bg-blue-600' : ''}`}
            >
              <Text className={`font-semibold text-sm ${tab === t ? 'text-white' : 'text-gray-400'}`}>
                {t === 'PITCH_HIRE' ? '🏟️ Pitch Hire' : '⚽ Match Bookings'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#3B82F6" />
        }
      >
        {tab === 'PITCH_HIRE' ? (
          <View className="gap-3">
            {pitchBookings.length === 0 ? (
              <View className="bg-gray-900 rounded-2xl p-8 items-center">
                <Text className="text-3xl mb-2">📋</Text>
                <Text className="text-gray-400">No pitch hire bookings</Text>
              </View>
            ) : pitchBookings.map((b) => (
              <View key={b.id} className="bg-gray-900 rounded-2xl p-4">
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-white font-bold">{b.title}</Text>
                    <Text className="text-gray-400 text-sm">{b.pitch?.name}</Text>
                  </View>
                  <Text className={`text-sm font-semibold ${STATUS_COLORS[b.status] ?? 'text-gray-400'}`}>
                    {b.status.replace(/_/g, ' ')}
                  </Text>
                </View>

                <View className="flex-row gap-4 mt-1 mb-3">
                  <Text className="text-gray-400 text-xs">
                    🕐 {new Date(b.startTime).toLocaleString('en-UZ', { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                  <Text className="text-gray-400 text-xs">⏱️ {b.durationHours}h</Text>
                  <Text className="text-gray-400 text-xs">
                    👤 {b.host?.firstName} {b.host?.lastName}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-white font-semibold">
                    {Number(b.totalPrice).toLocaleString()} UZS
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    {b.participants?.length ?? 0} participant{b.participants?.length !== 1 ? 's' : ''}
                  </Text>
                  {['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'].includes(b.status) && (
                    <TouchableOpacity
                      onPress={() => handleCancelPitchBooking(b.id, b.title)}
                      className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-1"
                    >
                      <Text className="text-red-400 text-xs font-semibold">Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="gap-3">
            {matchBookings.length === 0 ? (
              <View className="bg-gray-900 rounded-2xl p-8 items-center">
                <Text className="text-3xl mb-2">⚽</Text>
                <Text className="text-gray-400">No match bookings</Text>
              </View>
            ) : matchBookings.map((m) => (
              <View key={m.id} className="bg-gray-900 rounded-2xl p-4">
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-white font-bold">{m.title}</Text>
                    <Text className="text-gray-400 text-sm">{m.pitch?.name}</Text>
                  </View>
                  <Text className={`text-sm font-semibold ${STATUS_COLORS[m.status] ?? 'text-gray-400'}`}>
                    {m.status}
                  </Text>
                </View>

                <View className="flex-row gap-4 mt-1 mb-3">
                  <Text className="text-gray-400 text-xs">
                    🕐 {new Date(m.startTime).toLocaleString('en-UZ', { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    👤 {m.host?.firstName} {m.host?.lastName}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    🎫 {m._count?.bookings ?? 0}/{m.maxPlayers}
                  </Text>
                </View>

                {['OPEN', 'FULL', 'CONFIRMED'].includes(m.status) && (
                  <TouchableOpacity
                    onPress={() => handleCancelMatch(m.id, m.title)}
                    className="self-start bg-red-900/40 border border-red-700 rounded-lg px-3 py-1"
                  >
                    <Text className="text-red-400 text-xs font-semibold">Cancel match</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
