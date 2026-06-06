import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { pitchBookingsApi, pitchesApi } from '@/lib/api';
import { PitchBookingType, PaymentGateway } from '@playwithus/shared';
import { useQuery, useMutation } from '@tanstack/react-query';

const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6];
const GATEWAY_OPTIONS = [
  { key: PaymentGateway.PAYME, label: 'Payme' },
  { key: PaymentGateway.CLICK, label: 'Click' },
  { key: PaymentGateway.UZUM, label: 'Uzum' },
];

export default function NewPitchBookingScreen() {
  const router = useRouter();
  const { pitchId } = useLocalSearchParams<{ pitchId?: string }>();

  const [selectedPitchId, setSelectedPitchId] = useState(pitchId ?? '');
  const [type, setType] = useState<PitchBookingType>(PitchBookingType.GROUP_HIRE);
  const [duration, setDuration] = useState(1);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [notes, setNotes] = useState('');
  const [gateway, setGateway] = useState<PaymentGateway>(PaymentGateway.PAYME);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  });
  const [dateStr, setDateStr] = useState(() => startDate.toISOString().slice(0, 16));

  const { data: pitch } = useQuery({
    queryKey: ['pitch', selectedPitchId],
    queryFn: () => pitchesApi.getById(selectedPitchId).then((r) => r.data),
    enabled: !!selectedPitchId,
  });

  const totalPrice = pitch ? pitch.hourlyRate * duration : 0;

  const mutation = useMutation({
    mutationFn: () =>
      pitchBookingsApi.create({
        pitchId: selectedPitchId,
        title: pitch ? `${pitch.name} – ${duration}h hire` : 'Pitch hire',
        type,
        startTime: new Date(dateStr).toISOString(),
        durationHours: duration,
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : undefined,
        notes: notes || undefined,
        gateway,
      }),
    onSuccess: (res) => {
      router.replace(`/pitch-bookings/${res.data.id}`);
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message ?? 'Something went wrong');
    },
  });

  const handleBook = () => {
    if (!selectedPitchId) {
      Alert.alert('Select a pitch first');
      return;
    }
    mutation.mutate();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Book a Pitch</Text>

      {/* Type selector */}
      <Text style={styles.label}>Booking Type</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.optionBtn, type === PitchBookingType.GROUP_HIRE && styles.optionBtnActive]}
          onPress={() => setType(PitchBookingType.GROUP_HIRE)}
        >
          <Text style={[styles.optionText, type === PitchBookingType.GROUP_HIRE && styles.optionTextActive]}>
            Group Hire
          </Text>
          <Text style={styles.optionSub}>Reserve the full pitch</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.optionBtn, type === PitchBookingType.OPEN_JOIN && styles.optionBtnActive]}
          onPress={() => setType(PitchBookingType.OPEN_JOIN)}
        >
          <Text style={[styles.optionText, type === PitchBookingType.OPEN_JOIN && styles.optionTextActive]}>
            Open Join
          </Text>
          <Text style={styles.optionSub}>Others can join &amp; split cost</Text>
        </TouchableOpacity>
      </View>

      {/* Date & time */}
      <Text style={styles.label}>Start Time</Text>
      <TextInput
        style={styles.input}
        value={dateStr}
        onChangeText={setDateStr}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor="#888"
      />

      {/* Duration */}
      <Text style={styles.label}>Duration</Text>
      <View style={styles.row}>
        {DURATION_OPTIONS.map((h) => (
          <TouchableOpacity
            key={h}
            style={[styles.durationBtn, duration === h && styles.durationBtnActive]}
            onPress={() => setDuration(h)}
          >
            <Text style={[styles.durationText, duration === h && styles.durationTextActive]}>
              {h}h
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Max participants (OPEN_JOIN only) */}
      {type === PitchBookingType.OPEN_JOIN && (
        <>
          <Text style={styles.label}>Max Participants (optional)</Text>
          <TextInput
            style={styles.input}
            value={maxParticipants}
            onChangeText={setMaxParticipants}
            placeholder="e.g. 10"
            placeholderTextColor="#888"
            keyboardType="number-pad"
          />
        </>
      )}

      {/* Notes */}
      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any details for participants…"
        placeholderTextColor="#888"
        multiline
        numberOfLines={3}
      />

      {/* Payment gateway */}
      <Text style={styles.label}>Pay with</Text>
      <View style={styles.row}>
        {GATEWAY_OPTIONS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.gatewayBtn, gateway === g.key && styles.gatewayBtnActive]}
            onPress={() => setGateway(g.key)}
          >
            <Text style={[styles.gatewayText, gateway === g.key && styles.gatewayTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      {pitch && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{pitch.name}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{duration} hour{duration > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryTotal}>{totalPrice.toLocaleString()} UZS</Text>
          </View>
          <View style={styles.policyBox}>
            <Text style={styles.policyTitle}>Cancellation Policy</Text>
            <Text style={styles.policyText}>
              Free cancellation up to 5 hours before start time.
              A 50% fee applies if cancelled less than 5 hours before.
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.bookBtn, mutation.isPending && styles.bookBtnDisabled]}
        onPress={handleBook}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.bookBtnText}>Book Now</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  content: { padding: 20, paddingBottom: 60 },
  heading: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 24 },
  label: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionBtn: {
    flex: 1, minWidth: 130, borderRadius: 12, borderWidth: 1.5,
    borderColor: '#333', padding: 14, alignItems: 'center', gap: 4,
  },
  optionBtnActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)' },
  optionText: { color: '#ccc', fontWeight: '600', fontSize: 15 },
  optionTextActive: { color: '#22C55E' },
  optionSub: { color: '#666', fontSize: 11, textAlign: 'center' },
  input: {
    backgroundColor: '#1a1a22', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#333',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  durationBtn: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1.5,
    borderColor: '#333', alignItems: 'center', justifyContent: 'center',
  },
  durationBtnActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.1)' },
  durationText: { color: '#ccc', fontWeight: '600' },
  durationTextActive: { color: '#22C55E' },
  gatewayBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5,
    borderColor: '#333', alignItems: 'center',
  },
  gatewayBtnActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.1)' },
  gatewayText: { color: '#ccc', fontWeight: '600' },
  gatewayTextActive: { color: '#22C55E' },
  summary: {
    marginTop: 24, backgroundColor: '#1a1a22', borderRadius: 14,
    padding: 18, gap: 8,
  },
  summaryTitle: { color: '#fff', fontWeight: '700', fontSize: 17, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#888' },
  summaryValue: { color: '#ccc' },
  summaryTotal: { color: '#22C55E', fontWeight: '700', fontSize: 18 },
  policyBox: { marginTop: 12, backgroundColor: '#111', borderRadius: 8, padding: 12 },
  policyTitle: { color: '#f59e0b', fontWeight: '600', marginBottom: 4, fontSize: 13 },
  policyText: { color: '#888', fontSize: 12, lineHeight: 18 },
  bookBtn: {
    marginTop: 28, backgroundColor: '#22C55E', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  bookBtnDisabled: { opacity: 0.6 },
  bookBtnText: { color: '#000', fontWeight: '700', fontSize: 17 },
});
