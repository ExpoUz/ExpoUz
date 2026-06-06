import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useAuthStore } from '@/store/auth.store';

function TabIcon({ label, icon, focused }: { label: string; icon: string; focused: boolean }) {
  return (
    <View className="items-center justify-center pt-1">
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text
        className={`text-xs mt-0.5 ${focused ? 'text-blue-400 font-semibold' : 'text-gray-500'}`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function AdminTabLayout() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#1F2937',
          height: 65,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Dashboard" icon="📊" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Pitches" icon="🏟️" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Bookings" icon="📋" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Events" icon="⚽" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Users" icon="👥" focused={focused} />
          ),
        }}
      />
      {isSuperAdmin && (
        <Tabs.Screen
          name="super"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Super" icon="⚙️" focused={focused} />
            ),
          }}
        />
      )}
      <Tabs.Screen
        name="ai"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="AI" icon="✨" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
