import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { pitchesApi, matchesApi } from '../../lib/api';

export default function CreateScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    pitchId: '', startTime: '', durationMinutes: '60',
    maxPlayers: '14', pricePerPlayer: '', format: '7v7', formation: '3-3-1',
    skillFilter: '', description: '',
  });

  const { data: pitches } = useQuery({ queryKey: ['pitches'], queryFn: () => pitchesApi.getAll() });

  const { mutate, isPending } = useMutation({
    mutationFn: () => matchesApi.create({
      ...form,
      durationMinutes: parseInt(form.durationMinutes),
      maxPlayers: parseInt(form.maxPlayers),
      pricePerPlayer: parseFloat(form.pricePerPlayer),
    }),
    onSuccess: (data) => {
      router.replace(`/match/${data.id}`);
    },
    onError: () => Alert.alert('Error', 'Failed to create match'),
  });

  if (step === 0) return (
    <View style={{ flex: 1, backgroundColor: '#090E0C' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Text style={{ color: '#F0FFF4', fontSize: 24, fontWeight: '900' }}>Create Match</Text>
        <Text style={{ color: '#7a9a80', fontSize: 13 }}>Select a pitch</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {(pitches || []).map((p: any) => (
          <TouchableOpacity key={p.id} onPress={() => { setForm({ ...form, pitchId: p.id }); setStep(1); }}
            style={{ backgroundColor: form.pitchId === p.id ? '#00C85320' : '#111a14', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: form.pitchId === p.id ? '#00C853' : '#1e2e21' }}>
            <Text style={{ color: '#F0FFF4', fontSize: 14, fontWeight: '700' }}>{p.name}</Text>
            <Text style={{ color: '#7a9a80', fontSize: 12, marginTop: 2 }}>{p.district}, {p.city}</Text>
            <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700', marginTop: 4 }}>{new Intl.NumberFormat('uz-UZ').format(Number(p.hourlyRate))} UZS/hr</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (step === 1) return (
    <View style={{ flex: 1, backgroundColor: '#090E0C' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => setStep(0)}>
          <Text style={{ color: '#00C853', fontSize: 14, marginBottom: 8 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#F0FFF4', fontSize: 24, fontWeight: '900' }}>Match Details</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {[
          { key: 'startTime', label: 'Start Time (ISO)', placeholder: '2025-12-01T18:00:00' },
          { key: 'durationMinutes', label: 'Duration (minutes)', placeholder: '60' },
          { key: 'maxPlayers', label: 'Max Players', placeholder: '14' },
          { key: 'pricePerPlayer', label: 'Price Per Player (UZS)', placeholder: '100000' },
          { key: 'description', label: 'Description (optional)', placeholder: 'Describe your match...' },
        ].map(({ key, label, placeholder }) => (
          <View key={key} style={{ marginBottom: 14 }}>
            <Text style={{ color: '#7a9a80', fontSize: 12, marginBottom: 6 }}>{label}</Text>
            <TextInput
              value={(form as any)[key]}
              onChangeText={(v) => setForm({ ...form, [key]: v })}
              placeholder={placeholder}
              placeholderTextColor="#7a9a80"
              style={{ backgroundColor: '#111a14', borderRadius: 12, borderWidth: 1, borderColor: '#1e2e21', paddingHorizontal: 14, paddingVertical: 12, color: '#F0FFF4', fontSize: 14 }}
            />
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {['3-3-1', '4-3-3', '4-4-2'].map((f) => (
            <TouchableOpacity key={f} onPress={() => setForm({ ...form, formation: f })}
              style={{ flex: 1, backgroundColor: form.formation === f ? '#00C853' : '#111a14', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: form.formation === f ? '#00C853' : '#1e2e21' }}>
              <Text style={{ color: form.formation === f ? '#fff' : '#7a9a80', fontSize: 13, fontWeight: '600' }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => mutate()} disabled={isPending || !form.pricePerPlayer || !form.startTime}
          style={{ backgroundColor: isPending ? '#1e2e21' : '#00C853', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{isPending ? 'Creating...' : '⚽ Create Match'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return null;
}
