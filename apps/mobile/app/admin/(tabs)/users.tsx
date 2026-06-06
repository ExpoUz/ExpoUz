import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { superAdminApi } from '@/lib/api';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const loadUsers = useCallback(async (q?: string) => {
    try {
      const params: Record<string, any> = {};
      if (q) params.search = q;
      const { data } = await superAdminApi.getUsers(params);
      setUsers(data.data ?? data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => loadUsers(text.trim() || undefined), 400);
    setSearchTimeout(t);
  };

  const getInitials = (u: any) =>
    `${(u.firstName ?? '?')[0]}${(u.lastName ?? '?')[0]}`.toUpperCase();

  const reliabilityColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
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
      <View className="px-5 pt-12 pb-4">
        <Text className="text-white text-2xl font-bold mb-4">👥 Players</Text>

        {/* Search bar */}
        <View className="flex-row items-center bg-gray-900 rounded-xl px-4 py-2">
          <Text className="text-gray-400 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-white text-base"
            placeholder="Search by name or phone…"
            placeholderTextColor="#6B7280"
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Text className="text-gray-500 text-lg">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsers(search || undefined); }} tintColor="#3B82F6" />
        }
      >
        {users.length === 0 ? (
          <View className="bg-gray-900 rounded-2xl p-8 items-center mt-2">
            <Text className="text-3xl mb-2">👥</Text>
            <Text className="text-gray-400">
              {search ? 'No players match your search' : 'No players yet'}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {users.map((u) => (
              <TouchableOpacity
                key={u.id}
                onPress={() => router.push(`/admin/users/${u.id}`)}
                className="bg-gray-900 rounded-2xl p-4 flex-row items-center gap-3"
              >
                {/* Avatar */}
                <View className="w-12 h-12 rounded-full bg-blue-700 items-center justify-center flex-shrink-0">
                  <Text className="text-white font-bold text-base">{getInitials(u)}</Text>
                </View>

                {/* Info */}
                <View className="flex-1">
                  <Text className="text-white font-bold">
                    {u.firstName} {u.lastName}
                  </Text>
                  <Text className="text-gray-400 text-sm">{u.phone}</Text>
                  <View className="flex-row gap-3 mt-1">
                    <Text className="text-gray-500 text-xs">
                      ⚡ ELO {u.eloRating ?? '-'}
                    </Text>
                    <Text className={`text-xs ${reliabilityColor(u.reliabilityScore ?? 100)}`}>
                      ✓ {u.reliabilityScore ?? 100}% reliability
                    </Text>
                    {(u._count?.bookings ?? 0) > 0 && (
                      <Text className="text-gray-500 text-xs">
                        🎫 {u._count.bookings} bookings
                      </Text>
                    )}
                  </View>
                </View>

                {u.isBanned && (
                  <View className="bg-red-900/50 border border-red-700 rounded-full px-2 py-0.5">
                    <Text className="text-red-400 text-xs">Banned</Text>
                  </View>
                )}

                <Text className="text-gray-500">›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
