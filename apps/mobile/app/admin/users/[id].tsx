import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { superAdminApi } from '@/lib/api';

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState(false);

  const loadUser = async () => {
    try {
      const { data } = await superAdminApi.getUserById(id);
      setUser(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadUser(); }, [id]);

  const handleBanToggle = () => {
    if (!user) return;
    const newBan = !user.isBanned;
    Alert.alert(
      newBan ? 'Ban User' : 'Unban User',
      `${newBan ? 'Ban' : 'Unban'} ${user.firstName} ${user.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newBan ? 'Ban' : 'Unban',
          style: newBan ? 'destructive' : 'default',
          onPress: async () => {
            setActioning(true);
            try {
              await superAdminApi.updateUser(id, { isBanned: newBan });
              setUser((prev: any) => ({ ...prev, isBanned: newBan }));
            } catch {
              Alert.alert('Error', 'Failed to update ban status.');
            } finally {
              setActioning(false);
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!user) return;
    Alert.alert(
      'Delete User',
      `Permanently delete ${user.firstName} ${user.lastName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActioning(true);
            try {
              await superAdminApi.deleteUser(id);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete user.');
            } finally {
              setActioning(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'User Profile' }} />
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <Stack.Screen options={{ title: 'Not Found' }} />
        <Text className="text-gray-400">User not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-400">← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = `${(user.firstName ?? '?')[0]}${(user.lastName ?? '?')[0]}`.toUpperCase();

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUser(); }} tintColor="#3B82F6" />
      }
    >
      <Stack.Screen options={{ title: `${user.firstName} ${user.lastName}` }} />

      {/* Profile header */}
      <View className="items-center mb-6">
        <View className="w-20 h-20 rounded-full bg-blue-700 items-center justify-center mb-3">
          <Text className="text-white text-3xl font-bold">{initials}</Text>
        </View>
        <Text className="text-white text-xl font-bold">{user.firstName} {user.lastName}</Text>
        <Text className="text-gray-400">{user.phone}</Text>
        <View className="flex-row gap-2 mt-2">
          <View className="bg-gray-800 rounded-full px-3 py-1">
            <Text className="text-gray-300 text-xs font-semibold">{user.role}</Text>
          </View>
          {user.isBanned && (
            <View className="bg-red-900/50 border border-red-700 rounded-full px-3 py-1">
              <Text className="text-red-400 text-xs font-semibold">BANNED</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats row */}
      <View className="flex-row gap-3 mb-5">
        {[
          { label: 'ELO', value: user.eloRating ?? '-', icon: '⚡' },
          { label: 'Reliability', value: `${user.reliabilityScore ?? 100}%`, icon: '✓' },
          { label: 'Bookings', value: user._count?.bookings ?? 0, icon: '🎫' },
          { label: 'Matches', value: user._count?.matches ?? 0, icon: '⚽' },
        ].map((s) => (
          <View key={s.label} className="flex-1 bg-gray-900 rounded-2xl p-3 items-center">
            <Text className="text-base">{s.icon}</Text>
            <Text className="text-white font-bold text-sm mt-1">{s.value}</Text>
            <Text className="text-gray-500 text-xs">{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Account info */}
      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <Text className="text-white font-semibold mb-3">Account Details</Text>
        {[
          { label: 'Full Name', value: `${user.firstName} ${user.lastName}` },
          { label: 'Phone', value: user.phone },
          { label: 'Role', value: user.role },
          { label: 'City', value: user.city ?? '-' },
          { label: 'Position', value: user.position ?? '-' },
          { label: 'Member since', value: new Date(user.createdAt).toLocaleDateString() },
        ].map(({ label, value }) => (
          <View key={label} className="flex-row justify-between py-2 border-b border-gray-800 last:border-0">
            <Text className="text-gray-400 text-sm">{label}</Text>
            <Text className="text-white text-sm font-medium">{value}</Text>
          </View>
        ))}
      </View>

      {/* Wallet */}
      <View className="bg-gray-900 rounded-2xl p-4 mb-4 flex-row items-center justify-between">
        <Text className="text-gray-400">Wallet Balance</Text>
        <Text className="text-white font-bold">
          {Number(user.walletBalance ?? 0).toLocaleString()} UZS
        </Text>
      </View>

      {/* Recent bookings */}
      {user.bookings?.length > 0 && (
        <View className="mb-5">
          <Text className="text-white text-base font-semibold mb-3">Recent Bookings</Text>
          <View className="gap-2">
            {user.bookings.slice(0, 5).map((b: any) => (
              <View key={b.id} className="bg-gray-900 rounded-xl p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-sm font-semibold">{b.match?.title ?? b.id.slice(0, 8)}</Text>
                  <Text className="text-gray-400 text-xs">{b.status}</Text>
                </View>
                <Text className="text-gray-500 text-xs mt-0.5">
                  {new Date(b.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Admin actions */}
      {isSuperAdmin && (
        <View className="gap-3">
          <Text className="text-white text-base font-semibold">Admin Actions</Text>

          <TouchableOpacity
            onPress={handleBanToggle}
            disabled={actioning}
            className={`rounded-2xl py-4 items-center ${user.isBanned ? 'bg-green-700' : 'bg-yellow-700'}`}
          >
            {actioning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">
                {user.isBanned ? '✓ Unban User' : '🚫 Ban User'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            disabled={actioning}
            className="bg-red-800 rounded-2xl py-4 items-center"
          >
            <Text className="text-white font-bold">🗑️ Delete Account</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
