import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { pitchAdminApi } from '@/lib/api';

interface Pitch {
  id: string;
  name: string;
  city: string;
  district: string;
  isActive: boolean;
  isVerified: boolean;
  hourlyRate: number;
  location?: { name: string };
  _count: { matches: number; pitchBookings: number; followers: number };
}

function StatusBadge({ isActive, isVerified }: { isActive: boolean; isVerified: boolean }) {
  if (!isVerified) return (
    <View className="bg-yellow-900/50 border border-yellow-700 rounded-full px-2 py-0.5">
      <Text className="text-yellow-400 text-xs">Pending verification</Text>
    </View>
  );
  if (!isActive) return (
    <View className="bg-gray-700 rounded-full px-2 py-0.5">
      <Text className="text-gray-400 text-xs">Inactive</Text>
    </View>
  );
  return (
    <View className="bg-green-900/50 border border-green-700 rounded-full px-2 py-0.5">
      <Text className="text-green-400 text-xs">Active</Text>
    </View>
  );
}

export default function AdminPitchesScreen() {
  const router = useRouter();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadPitches = async () => {
    try {
      const { data } = await pitchAdminApi.getPitches();
      setPitches(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadPitches(); }, []);

  const handleToggle = async (pitch: Pitch) => {
    const newState = !pitch.isActive;
    Alert.alert(
      `${newState ? 'Activate' : 'Deactivate'} pitch`,
      `Are you sure you want to ${newState ? 'activate' : 'deactivate'} "${pitch.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: newState ? 'default' : 'destructive',
          onPress: async () => {
            setTogglingId(pitch.id);
            try {
              await pitchAdminApi.updateAvailability(pitch.id, newState);
              setPitches((prev) =>
                prev.map((p) => (p.id === pitch.id ? { ...p, isActive: newState } : p)),
              );
            } catch {
              Alert.alert('Error', 'Could not update pitch availability.');
            } finally {
              setTogglingId(null);
            }
          },
        },
      ],
    );
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
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPitches(); }} tintColor="#3B82F6" />
      }
    >
      <Text className="text-white text-2xl font-bold mt-10 mb-6">🏟️ My Pitches</Text>

      {pitches.length === 0 ? (
        <View className="bg-gray-900 rounded-2xl p-8 items-center">
          <Text className="text-4xl mb-3">🏟️</Text>
          <Text className="text-white font-semibold">No pitches yet</Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Contact a super admin to get pitches assigned to your account.
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          {pitches.map((pitch) => (
            <TouchableOpacity
              key={pitch.id}
              onPress={() => router.push(`/admin/pitches/${pitch.id}`)}
              className="bg-gray-900 rounded-2xl p-4"
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 mr-3">
                  <Text className="text-white font-bold text-base">{pitch.name}</Text>
                  <Text className="text-gray-400 text-sm mt-0.5">
                    {pitch.location?.name ?? `${pitch.district}, ${pitch.city}`}
                  </Text>
                </View>
                <StatusBadge isActive={pitch.isActive} isVerified={pitch.isVerified} />
              </View>

              {/* Metrics */}
              <View className="flex-row gap-4 mt-3 mb-3">
                <View className="items-center">
                  <Text className="text-white font-bold">{pitch._count.matches}</Text>
                  <Text className="text-gray-500 text-xs">Matches</Text>
                </View>
                <View className="items-center">
                  <Text className="text-white font-bold">{pitch._count.pitchBookings}</Text>
                  <Text className="text-gray-500 text-xs">Hirings</Text>
                </View>
                <View className="items-center">
                  <Text className="text-white font-bold">{pitch._count.followers}</Text>
                  <Text className="text-gray-500 text-xs">Followers</Text>
                </View>
                <View className="items-center">
                  <Text className="text-white font-bold">
                    {Number(pitch.hourlyRate).toLocaleString()}
                  </Text>
                  <Text className="text-gray-500 text-xs">UZS/hr</Text>
                </View>
              </View>

              {/* Availability toggle */}
              <View className="flex-row items-center justify-between border-t border-gray-800 pt-3">
                <Text className="text-gray-400 text-sm">Available for booking</Text>
                {togglingId === pitch.id ? (
                  <ActivityIndicator size="small" color="#3B82F6" />
                ) : (
                  <Switch
                    value={pitch.isActive}
                    onValueChange={() => handleToggle(pitch)}
                    trackColor={{ false: '#374151', true: '#1D4ED8' }}
                    thumbColor={pitch.isActive ? '#3B82F6' : '#6B7280'}
                  />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
