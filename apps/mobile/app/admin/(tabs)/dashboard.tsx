import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { pitchAdminApi } from '@/lib/api';

interface DashboardStats {
  totalPitches: number;
  matchesThisMonth: number;
  totalRevenue: number;
  uniquePlayers: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <View className="flex-1 bg-gray-900 rounded-2xl p-4 mx-1">
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text className="text-white text-2xl font-bold mt-2">{value}</Text>
      <Text className="text-gray-400 text-xs mt-1">{label}</Text>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { clearAuth } = useAuthStore();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const { data } = await pitchAdminApi.getDashboard();
      setStats(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const handleSignOut = async () => {
    clearAuth();
    router.replace('/admin/login');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} tintColor="#3B82F6" />}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6 mt-10">
        <View>
          <Text className="text-white text-2xl font-bold">
            {isSuperAdmin ? '⚙️ Super Admin' : '🏟️ Admin Panel'}
          </Text>
          <Text className="text-gray-400 text-sm">
            {user?.firstName} {user?.lastName} · {user?.role}
          </Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} className="bg-gray-800 rounded-xl px-4 py-2">
          <Text className="text-gray-300 text-sm">Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats grid */}
      <View className="flex-row mb-3">
        <StatCard label="My Pitches" value={stats?.totalPitches ?? 0} icon="🏟️" color="#3B82F6" />
        <StatCard label="Matches This Month" value={stats?.matchesThisMonth ?? 0} icon="⚽" color="#10B981" />
      </View>
      <View className="flex-row mb-6">
        <StatCard label="Revenue" value={`${(Number(stats?.totalRevenue ?? 0)).toLocaleString()} UZS`} icon="💰" color="#F59E0B" />
        <StatCard label="Unique Players" value={stats?.uniquePlayers ?? 0} icon="👥" color="#8B5CF6" />
      </View>

      {/* Quick actions */}
      <Text className="text-white text-base font-semibold mb-3">Quick Actions</Text>
      <View className="gap-3">
        <TouchableOpacity
          onPress={() => router.push('/admin/(tabs)/pitches')}
          className="bg-gray-900 rounded-2xl p-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-2xl">🏟️</Text>
            <View>
              <Text className="text-white font-semibold">Manage Pitches</Text>
              <Text className="text-gray-400 text-xs">View status, toggle availability</Text>
            </View>
          </View>
          <Text className="text-gray-500">›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin/(tabs)/bookings')}
          className="bg-gray-900 rounded-2xl p-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-2xl">📋</Text>
            <View>
              <Text className="text-white font-semibold">All Bookings</Text>
              <Text className="text-gray-400 text-xs">Match & pitch-hire bookings</Text>
            </View>
          </View>
          <Text className="text-gray-500">›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin/(tabs)/events')}
          className="bg-gray-900 rounded-2xl p-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-2xl">⚽</Text>
            <View>
              <Text className="text-white font-semibold">Upcoming Events</Text>
              <Text className="text-gray-400 text-xs">Matches on your pitches</Text>
            </View>
          </View>
          <Text className="text-gray-500">›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin/(tabs)/users')}
          className="bg-gray-900 rounded-2xl p-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-2xl">👥</Text>
            <View>
              <Text className="text-white font-semibold">Player Directory</Text>
              <Text className="text-gray-400 text-xs">Players who booked your pitches</Text>
            </View>
          </View>
          <Text className="text-gray-500">›</Text>
        </TouchableOpacity>

        {isSuperAdmin && (
          <TouchableOpacity
            onPress={() => router.push('/admin/(tabs)/super')}
            className="bg-blue-900/40 border border-blue-700 rounded-2xl p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl">⚙️</Text>
              <View>
                <Text className="text-white font-semibold">Super Admin Controls</Text>
                <Text className="text-blue-400 text-xs">Manage all admins, pitches, locations</Text>
              </View>
            </View>
            <Text className="text-gray-500">›</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
