import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pitchesApi, matchesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { Sport } from '@expouz/shared';

const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '2-2', '2-1-2'];
const DURATIONS = [45, 60, 75, 90];
const FORMATS = [
  { label: '5v5', maxPlayers: 10, min: 8 },
  { label: '7v7', maxPlayers: 14, min: 10 },
  { label: '11v11', maxPlayers: 22, min: 16 },
];

type Step = 1 | 2 | 3;

export default function CreateMatchScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { city } = useAppStore();

  const [step, setStep] = useState<Step>(1);
  const [pitchId, setPitchId] = useState('');
  const [format, setFormat] = useState(FORMATS[1]);
  const [formation, setFormation] = useState('4-3-3');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [pricePerPlayer, setPricePerPlayer] = useState('');
  const [description, setDescription] = useState('');


  const { data: pitchesRes, isLoading: pitchesLoading } = useQuery({
    queryKey: ['pitches', city],
    queryFn: () => pitchesApi.list({ city }),
    select: (r) => r.data,
  });

  const pitches = pitchesRes?.data ?? pitchesRes ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      const startTimeDate = new Date(`${date}T${time}:00`);
      return matchesApi.create({
        pitchId,
        sport: Sport.FOOTBALL,
        format: format.label,
        formation,
        maxPlayers: format.maxPlayers,
        minPlayers: format.min,
        startTime: startTimeDate.toISOString(),
        durationMinutes,
        pricePerPlayer: Number(pricePerPlayer),
        description,
      });
    },
    onSuccess: (res) => {
      Alert.alert('Match Created! ⚽', 'Your game is live. Players can now join.', [
        { text: 'View Match', onPress: () => router.push(`/matches/${(res.data as any).id}` as any) },
      ]);
    },
    onError: () => Alert.alert('Error', 'Failed to create match. Please check all fields.'),
  });

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.authRequired}>
          <Text style={styles.authEmoji}>🔒</Text>
          <Text style={styles.authTitle}>Sign in required</Text>
          <TouchableOpacity style={styles.authBtn} onPress={() => router.push('/auth/phone')}>
            <Text style={styles.authBtnText}>Sign In →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canProceed = (): boolean => {
    if (step === 1) return !!pitchId;
    if (step === 2) return !!date && !!time && !!pricePerPlayer && Number(pricePerPlayer) > 0;
    return true;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (step > 1) setStep((s) => (s - 1) as Step); else router.back(); }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host a Game</Text>
        <Text style={styles.stepIndicator}>{step}/3</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` as any }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ─── Step 1: Pick Pitch ─── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Choose a Pitch</Text>
              <Text style={styles.stepSubtitle}>Where will the game be played?</Text>

              {pitchesLoading ? (
                <ActivityIndicator color="#00C853" style={{ marginTop: 32 }} />
              ) : pitches.length === 0 ? (
                <View style={styles.emptyPitches}>
                  <Text style={styles.emptyPitchesText}>No verified pitches in {city} yet</Text>
                </View>
              ) : (
                pitches.map((p: any) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pitchCard, pitchId === p.id && styles.pitchCardSelected]}
                    onPress={() => setPitchId(p.id)}
                  >
                    <View style={styles.pitchInfo}>
                      <Text style={styles.pitchName}>{p.name}</Text>
                      <Text style={styles.pitchMeta}>{p.district} · {Number(p.hourlyRate).toLocaleString()} UZS/hr</Text>
                      <Text style={styles.pitchSize}>
                        {p.isIndoor ? '🏠 Indoor' : '🌿 Outdoor'} · {p.surfaceType}
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, pitchId === p.id && styles.radioSelected]}>
                      {pitchId === p.id && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ─── Step 2: Match Details ─── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Match Details</Text>
              <Text style={styles.stepSubtitle}>When and how?</Text>

              {/* Format */}
              <Text style={styles.fieldLabel}>Format</Text>
              <View style={styles.chipRow}>
                {FORMATS.map((f) => (
                  <TouchableOpacity
                    key={f.label}
                    style={[styles.chip, format.label === f.label && styles.chipActive]}
                    onPress={() => { setFormat(f); if (f.label === '5v5') setFormation('2-2'); else if (f.label === '11v11') setFormation('4-4-2'); }}
                  >
                    <Text style={[styles.chipText, format.label === f.label && styles.chipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date */}
              <Text style={styles.fieldLabel}>Date</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.input}>
                  {React.createElement('input', {
                    type: 'date',
                    value: date,
                    onChange: (e: any) => setDate(e.target.value),
                    min: new Date().toISOString().split('T')[0],
                    style: {
                      background: 'transparent',
                      border: 'none',
                      color: date ? '#fff' : '#6B7280',
                      fontSize: 15,
                      width: '100%',
                      outline: 'none',
                      colorScheme: 'dark',
                      padding: 0,
                    },
                  })}
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6B7280"
                  keyboardType="numbers-and-punctuation"
                />
              )}

              {/* Time */}
              <Text style={styles.fieldLabel}>Start Time</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM (24-hr)"
                placeholderTextColor="#6B7280"
                keyboardType="numbers-and-punctuation"
              />

              {/* Duration */}
              <Text style={styles.fieldLabel}>Duration</Text>
              <View style={styles.chipRow}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, durationMinutes === d && styles.chipActive]}
                    onPress={() => setDurationMinutes(d)}
                  >
                    <Text style={[styles.chipText, durationMinutes === d && styles.chipTextActive]}>{d}min</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Price */}
              <Text style={styles.fieldLabel}>Price per Player (UZS)</Text>
              <TextInput
                style={styles.input}
                value={pricePerPlayer}
                onChangeText={setPricePerPlayer}
                placeholder="e.g. 9000"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />
              {pricePerPlayer ? (
                <Text style={styles.fieldHint}>
                  Total collection: {(Number(pricePerPlayer) * format.maxPlayers).toLocaleString()} UZS
                </Text>
              ) : null}
            </View>
          )}

          {/* ─── Step 3: Formation & Rules ─── */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Formation & Rules</Text>
              <Text style={styles.stepSubtitle}>Set the lineup and restrictions</Text>

              {/* Formation */}
              <Text style={styles.fieldLabel}>Formation</Text>
              <View style={styles.chipRow}>
                {FORMATIONS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, formation === f && styles.chipActive]}
                    onPress={() => setFormation(f)}
                  >
                    <Text style={[styles.chipText, formation === f && styles.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Tell players about the game..."
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={4}
                maxLength={300}
              />

              {/* Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Match Summary</Text>
                <SummaryRow label="Pitch" value={pitches.find((p: any) => p.id === pitchId)?.name ?? ''} />
                <SummaryRow label="Format" value={`${format.label} · ${durationMinutes}min`} />
                <SummaryRow label="Date & Time" value={`${date} at ${time}`} />
                <SummaryRow label="Price/Player" value={`${Number(pricePerPlayer).toLocaleString()} UZS`} />
                <SummaryRow label="Formation" value={formation} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.ctaBtn, (!canProceed() || createMutation.isPending) && styles.ctaBtnDisabled]}
            disabled={!canProceed() || createMutation.isPending}
            onPress={() => {
              if (step < 3) setStep((s) => (s + 1) as Step);
              else createMutation.mutate();
            }}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaBtnText}>{step < 3 ? 'Continue →' : '⚽ Create Match'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText: { color: '#00C853', fontSize: 22 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  stepIndicator: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  progressBar: { height: 3, backgroundColor: '#1F2937', marginHorizontal: 16, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: '#00C853', borderRadius: 2 },
  scroll: { padding: 16, paddingBottom: 100 },
  stepContent: { gap: 4 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
  pitchCard: { backgroundColor: '#111827', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#1E2D3D' },
  pitchCardSelected: { borderColor: '#00C853', backgroundColor: '#0A1F15' },
  pitchInfo: { flex: 1 },
  pitchName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  pitchMeta: { fontSize: 13, color: '#9CA3AF' },
  pitchSize: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#00C853' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#00C853' },
  emptyPitches: { padding: 32, alignItems: 'center' },
  emptyPitchesText: { color: '#6B7280', fontSize: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151' },
  chipActive: { backgroundColor: '#0A1F15', borderColor: '#00C853' },
  chipText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  chipTextActive: { color: '#00C853', fontWeight: '600' },
  input: { backgroundColor: '#111827', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: '#1E2D3D' },
  textArea: { height: 96, textAlignVertical: 'top' },
  summaryCard: { backgroundColor: '#111827', borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: '#1E2D3D' },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  summaryLabel: { fontSize: 13, color: '#6B7280' },
  summaryValue: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', textAlign: 'right', flex: 1, paddingLeft: 8 },
  bottomBar: { padding: 16, borderTopWidth: 1, borderTopColor: '#1E1E1E', backgroundColor: '#0D0D0D' },
  ctaBtn: { backgroundColor: '#00C853', borderRadius: 14, padding: 16, alignItems: 'center' },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  authRequired: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  authEmoji: { fontSize: 48 },
  authTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  authBtn: { backgroundColor: '#00C853', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  authBtnText: { color: '#fff', fontWeight: '700' },
});
