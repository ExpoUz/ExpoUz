import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import dayjs from 'dayjs';
import { matchesApi } from '../../lib/api';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'FULL', label: 'Full' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data: matches } = useQuery({
    queryKey: ['matches-explore', status],
    queryFn: () => matchesApi.getAll(status ? { status } : {}),
  });

  const filtered = (matches || []).filter((m: any) =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.pitch?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#090E0C' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 }}>
        <Text style={{ color: '#F0FFF4', fontSize: 24, fontWeight: '900', marginBottom: 12 }}>Explore</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111a14', borderRadius: 12, borderWidth: 1, borderColor: '#1e2e21', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 }}>
          <Search size={16} color="#7a9a80" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search matches or pitches..."
            placeholderTextColor="#7a9a80"
            style={{ flex: 1, color: '#F0FFF4', fontSize: 14, marginLeft: 8 }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f.key} onPress={() => setStatus(f.key)}
              style={{ backgroundColor: status === f.key ? '#00C853' : '#111a14', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: status === f.key ? '#00C853' : '#1e2e21' }}>
              <Text style={{ color: status === f.key ? '#fff' : '#7a9a80', fontSize: 12, fontWeight: '600' }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/match/${item.id}`)}
            style={{ backgroundColor: '#111a14', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e2e21' }}>
            <Text style={{ color: '#F0FFF4', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>{item.title}</Text>
            <Text style={{ color: '#7a9a80', fontSize: 12 }}>{item.pitch?.name} · {dayjs(item.startTime).format('D MMM HH:mm')}</Text>
            <Text style={{ color: '#00C853', fontSize: 13, fontWeight: '700', marginTop: 4 }}>{new Intl.NumberFormat('uz-UZ').format(Number(item.pricePerPlayer))} UZS</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}
