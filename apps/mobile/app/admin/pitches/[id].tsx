import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { pitchAdminApi } from '@/lib/api';

interface PitchDetail {
  id: string;
  name: string;
  city: string;
  district: string;
  hourlyRate: number;
  isActive: boolean;
  isVerified: boolean;
  amenities: string[];
  description?: string;
  location?: { name: string };
  owner?: { firstName: string; lastName: string; phone: string };
  _count: { matches: number; pitchBookings: number; followers: number };
  todaySchedule?: { matches: any[]; pitchBookings: any[] };
}

export default function PitchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [pitch, setPitch] = useState<PitchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const loadPitch = async () => {
    try {
      const { data } = await pitchAdminApi.getPitchDetail(id);
      setPitch(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadPitch(); }, [id]);

  const handleToggle = async () => {
    if (!pitch) return;
    const newState = !pitch.isActive;
    Alert.alert(
      newState ? 'Activate Pitch' : 'Deactivate Pitch',
      `${newState ? 'Activate' : 'Deactivate'} "${pitch.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: newState ? 'default' : 'destructive',
          onPress: async () => {
            setToggling(true);
            try {
              await pitchAdminApi.updateAvailability(pitch.id, newState);
              setPitch((prev) => prev ? { ...prev, isActive: newState } : prev);
            } catch {
              Alert.alert('Error', 'Could not update availability.');
            } finally {
              setToggling(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!pitch) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Pitch Not Found' }} />
        <Text className="text-gray-400">Could not load pitch details.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-400">← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPitch(); }} tintColor="#3B82F6" />
      }
    >
      <Stack.Screen options={{ title: pitch.name }} />

      {/* Header */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1 mr-3">
          <Text className="text-white text-2xl font-bold">{pitch.name}</Text>
          <Text className="text-gray-400 text-sm mt-1">
            {pitch.location?.name ?? `${pitch.district}, ${pitch.city}`}
          </Text>
          {pitch.owner && (
            <Text className="text-gray-500 text-xs mt-0.5">
              Owner: {pitch.owner.firstName} {pitch.owner.lastName} · {pitch.owner.phone}
            </Text>
          )}
        </View>

        <View className={`rounded-full px-3 py-1.5 border ${
          pitch.isActive ? 'bg-green-900/30 border-green-700' : 'bg-gray-800 border-gray-600'
        }`}>
          <Text className={`text-xs font-bold ${pitch.isActive ? 'text-green-400' : 'text-gray-400'}`}>
            {pitch.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-3 mb-5">
        {[
          { label: 'Matches', value: pitch._count.matches, icon: '⚽' },
          { label: 'Hirings', value: pitch._count.pitchBookings, icon: '📋' },
          { label: 'Followers', value: pitch._count.followers, icon: '❤️' },
        ].map((s) => (
          <View key={s.label} className="flex-1 bg-gray-900 rounded-2xl p-3 items-center">
            <Text className="text-base">{s.icon}</Text>
            <Text className="text-white font-bold text-lg mt-1">{s.value}</Text>
            <Text className="text-gray-500 text-xs">{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Hourly rate */}
      <View className="bg-gray-900 rounded-2xl p-4 mb-4 flex-row items-center justify-between">
        <Text className="text-gray-400">Hourly Rate</Text>
        <Text className="text-white font-bold">
          {Number(pitch.hourlyRate).toLocaleString()} UZS/hr
        </Text>
      </View>

      {/* Amenities */}
      {pitch.amenities?.length > 0 && (
        <View className="bg-gray-900 rounded-2xl p-4 mb-4">
          <Text className="text-white font-semibold mb-2">Amenities</Text>
          <View className="flex-row flex-wrap gap-2">
            {pitch.amenities.map((a) => (
              <View key={a} className="bg-gray-800 rounded-full px-3 py-1">
                <Text className="text-gray-300 text-xs">{a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Availability toggle */}
      <View className="bg-gray-900 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
        <View>
          <Text className="text-white font-semibold">Available for booking</Text>
          <Text className="text-gray-400 text-xs mt-0.5">
            {pitch.isActive ? 'Players can book this pitch' : 'Pitch is currently hidden from players'}
          </Text>
        </View>
        {toggling ? (
          <ActivityIndicator size="small" color="#3B82F6" />
        ) : (
          <Switch
            value={pitch.isActive}
            onValueChange={handleToggle}
            trackColor={{ false: '#374151', true: '#1D4ED8' }}
            thumbColor={pitch.isActive ? '#3B82F6' : '#6B7280'}
          />
        )}
      </View>

      {/* Today's schedule */}
      {pitch.todaySchedule && (
        <>
          <Text className="text-white text-base font-semibold mb-3">Today's Schedule</Text>

          {/* Matches today */}
          {pitch.todaySchedule.matches?.length > 0 && (
            <View className="mb-4">
              <Text className="text-gray-400 text-sm mb-2">Matches</Text>
              <View className="gap-2">
                {pitch.todaySchedule.matches.map((m: any) => (
                  <View key={m.id} className="bg-gray-900 rounded-xl p-3 flex-row items-center justify-between">
                    <View>
                      <Text className="text-white font-semibold text-sm">{m.title}</Text>
                      <Text className="text-gray-400 text-xs">
                        {new Date(m.startTime).toLocaleTimeString('en-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text className="text-gray-500 text-xs">{m.status}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Pitch bookings today */}
          {pitch.todaySchedule.pitchBookings?.length > 0 && (
            <View>
              <Text className="text-gray-400 text-sm mb-2">Pitch Hirings</Text>
              <View className="gap-2">
                {pitch.todaySchedule.pitchBookings.map((b: any) => (
                  <View key={b.id} className="bg-gray-900 rounded-xl p-3 flex-row items-center justify-between">
                    <View>
                      <Text className="text-white font-semibold text-sm">{b.title}</Text>
                      <Text className="text-gray-400 text-xs">
                        {new Date(b.startTime).toLocaleTimeString('en-UZ', { hour: '2-digit', minute: '2-digit' })} · {b.durationHours}h
                      </Text>
                    </View>
                    <Text className="text-gray-500 text-xs">{b.status}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {pitch.todaySchedule.matches?.length === 0 && pitch.todaySchedule.pitchBookings?.length === 0 && (
            <View className="bg-gray-900 rounded-2xl p-5 items-center">
              <Text className="text-gray-400">Nothing scheduled for today</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
