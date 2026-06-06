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
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { superAdminApi } from '@/lib/api';

interface OnlineStatus {
  totalOnline: number;
  byRole: Record<string, number>;
}

export default function AdminSuperScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus | null>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const loadData = async () => {
    try {
      const [statusRes, logRes] = await Promise.all([
        superAdminApi.getOnlineStatus(),
        superAdminApi.getActivityLog({ limit: 20 }),
      ]);
      setOnlineStatus(statusRes.data);
      setActivityLog(logRes.data.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) loadData();
    else setLoading(false);
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center px-8">
        <Text className="text-4xl mb-4">🔒</Text>
        <Text className="text-white text-xl font-bold text-center">Super Admin Only</Text>
        <Text className="text-gray-400 text-sm text-center mt-2">
          This section requires SUPER_ADMIN privileges.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const ROLE_ICONS: Record<string, string> = {
    PLAYER: '👤',
    PITCH_OWNER: '🏟️',
    ADMIN: '🛡️',
    SUPER_ADMIN: '⚙️',
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#3B82F6" />
      }
    >
      <Text className="text-white text-2xl font-bold mt-10 mb-6">⚙️ Super Admin</Text>

      {/* Online status */}
      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center gap-2 mb-3">
          <View className="w-2 h-2 rounded-full bg-green-500" />
          <Text className="text-white font-semibold">Online Now</Text>
          <Text className="text-green-400 font-bold ml-auto">{onlineStatus?.totalOnline ?? 0}</Text>
        </View>
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          {Object.entries(onlineStatus?.byRole ?? {}).map(([role, count]) => (
            <View key={role} className="flex-row items-center gap-1">
              <Text>{ROLE_ICONS[role] ?? '👤'}</Text>
              <Text className="text-gray-300 text-sm">{role}: </Text>
              <Text className="text-white font-bold text-sm">{count as number}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Management shortcuts */}
      <Text className="text-white text-base font-semibold mb-3">Management</Text>
      <View className="gap-3 mb-6">
        {[
          { icon: '🏟️', label: 'Pitch Admins', sub: 'Manage pitch owners', path: '/admin/super/pitch-admins' },
          { icon: '📍', label: 'Locations', sub: 'Manage locations', path: '/admin/super/locations' },
          { icon: '🏟️', label: 'All Pitches', sub: 'View & manage pitches', path: '/admin/super/pitches' },
          { icon: '👥', label: 'All Users', sub: 'Manage players & admins', path: '/admin/super/users' },
        ].map((item) => (
          <TouchableOpacity
            key={item.path}
            onPress={() => router.push(item.path as any)}
            className="bg-gray-900 rounded-2xl p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl">{item.icon}</Text>
              <View>
                <Text className="text-white font-semibold">{item.label}</Text>
                <Text className="text-gray-400 text-xs">{item.sub}</Text>
              </View>
            </View>
            <Text className="text-gray-500">›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity log */}
      <Text className="text-white text-base font-semibold mb-3">Recent Activity</Text>
      {activityLog.length === 0 ? (
        <View className="bg-gray-900 rounded-2xl p-6 items-center">
          <Text className="text-gray-400 text-sm">No activity logs yet</Text>
        </View>
      ) : (
        <View className="gap-2">
          {activityLog.map((entry) => (
            <View key={entry.id} className="bg-gray-900 rounded-xl p-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-2">
                  <Text className="text-white text-sm font-semibold">{entry.action}</Text>
                  {entry.entityType && (
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {entry.entityType} · {entry.entityId?.slice(0, 8)}
                    </Text>
                  )}
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {entry.user?.firstName} {entry.user?.lastName} ({entry.user?.role})
                  </Text>
                </View>
                <Text className="text-gray-600 text-xs">
                  {new Date(entry.createdAt).toLocaleTimeString('en-UZ', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
