import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pitchBookingsApi } from '@/lib/api';
import { PitchBookingStatus, PitchBookingType } from '@expouz/shared';

function getStatusColor(status: PitchBookingStatus) {
  switch (status) {
    case PitchBookingStatus.CONFIRMED: return '#22C55E';
    case PitchBookingStatus.PENDING_PAYMENT: return '#f59e0b';
    case PitchBookingStatus.IN_PROGRESS: return '#3b82f6';
    case PitchBookingStatus.COMPLETED: return '#6366f1';
    case PitchBookingStatus.CANCELLED_REFUND:
    case PitchBookingStatus.CANCELLED_PENALTY:
    case PitchBookingStatus.NO_SHOW: return '#ef4444';
    default: return '#888';
  }
}

function getStatusLabel(status: PitchBookingStatus) {
  switch (status) {
    case PitchBookingStatus.PENDING_PAYMENT: return 'Awaiting Payment';
    case PitchBookingStatus.CONFIRMED: return 'Confirmed';
    case PitchBookingStatus.IN_PROGRESS: return 'In Progress';
    case PitchBookingStatus.COMPLETED: return 'Completed';
    case PitchBookingStatus.CANCELLED_REFUND: return 'Cancelled (Refunded)';
    case PitchBookingStatus.CANCELLED_PENALTY: return 'Cancelled (50% Fee)';
    case PitchBookingStatus.NO_SHOW: return 'No Show';
    default: return status;
  }
}

export default function PitchBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['pitchBooking', id],
    queryFn: () => pitchBookingsApi.getById(id).then((r) => r.data),
    enabled: !!id,
  });

  const joinMutation = useMutation({
    mutationFn: () => pitchBookingsApi.join(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pitchBooking', id] });
      Alert.alert('Joined!', 'You have joined the booking.');
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not join'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => pitchBookingsApi.cancel(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pitchBooking', id] });
      const { refundAmount, feeCharged } = res.data;
      const msg = feeCharged
        ? `Cancelled. Refund: ${refundAmount?.toLocaleString()} UZS. Fee charged: ${feeCharged.toLocaleString()} UZS.`
        : refundAmount
        ? `Cancelled. Full refund of ${refundAmount.toLocaleString()} UZS processed.`
        : 'Booking cancelled. No refund (match already started).';
      Alert.alert('Cancelled', msg);
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel'),
  });

  const handleCancel = () => {
    if (!booking) return;
    const start = new Date(booking.startTime);
    const hoursUntil = (start.getTime() - Date.now()) / 3_600_000;

    const msg =
      hoursUntil > 5
        ? 'Cancel this booking? You will receive a full refund.'
        : hoursUntil > 0
        ? `Cancel now? Only 50% refund applies (less than 5 hours before start).`
        : 'The booking has already started. No refund will be issued.';

    Alert.alert('Cancel Booking', msg, [
      { text: 'Keep Booking', style: 'cancel' },
      {
        text: 'Cancel', style: 'destructive',
        onPress: () => cancelMutation.mutate(),
      },
    ]);
  };

  const handleOpenChat = () => {
    if (booking?.conversationId) {
      router.push(`/messages/${booking.conversationId}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>Booking not found</Text>
      </View>
    );
  }

  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const hoursUntil = (start.getTime() - Date.now()) / 3_600_000;
  const canJoin =
    booking.type === PitchBookingType.OPEN_JOIN &&
    booking.status === PitchBookingStatus.CONFIRMED &&
    hoursUntil > 0;

  const canCancel =
    booking.status === PitchBookingStatus.CONFIRMED ||
    booking.status === PitchBookingStatus.PENDING_PAYMENT;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: booking.title }} />

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '22' }]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
        <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
          {getStatusLabel(booking.status)}
        </Text>
      </View>

      {/* Pitch info */}
      {booking.pitch && (
        <View style={styles.card}>
          <Text style={styles.pitchName}>{booking.pitch.name}</Text>
          <Text style={styles.pitchAddr}>{(booking.pitch as any).addressLine}</Text>
        </View>
      )}

      {/* Booking details */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Details</Text>
        <DetailRow label="Type" value={booking.type === PitchBookingType.GROUP_HIRE ? 'Group Hire' : 'Open Join'} />
        <DetailRow
          label="Start"
          value={start.toLocaleString('en-UZ', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        />
        <DetailRow
          label="End"
          value={end.toLocaleString('en-UZ', { hour: '2-digit', minute: '2-digit' })}
        />
        <DetailRow label="Duration" value={`${booking.durationHours} hour${booking.durationHours > 1 ? 's' : ''}`} />
        <DetailRow label="Total" value={`${Number(booking.totalPrice).toLocaleString()} UZS`} highlight />
        {booking.maxParticipants && (
          <DetailRow
            label="Participants"
            value={`${booking.currentParticipants} / ${booking.maxParticipants}`}
          />
        )}
      </View>

      {/* Cancellation policy */}
      {canCancel && (
        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Cancellation Policy</Text>
          <Text style={styles.policyText}>
            Free cancellation up to <Text style={styles.policyHighlight}>5 hours</Text> before start.
            A <Text style={styles.policyHighlight}>50% fee</Text> applies if cancelled within 5 hours of the event.
          </Text>
          {hoursUntil > 0 && (
            <Text style={styles.policyCountdown}>
              {hoursUntil > 5
                ? `✓ ${Math.floor(hoursUntil)}h ${Math.floor((hoursUntil % 1) * 60)}m until deadline — free cancellation`
                : `⚠ Only ${Math.floor(hoursUntil)}h ${Math.floor((hoursUntil % 1) * 60)}m left — 50% fee applies`}
            </Text>
          )}
        </View>
      )}

      {/* Participants */}
      {booking.participants && booking.participants.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Participants</Text>
          {booking.participants.map((p) => (
            <View key={p.id} style={styles.participantRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {p.user?.firstName?.[0]}{p.user?.lastName?.[0]}
                </Text>
              </View>
              <Text style={styles.participantName}>
                {p.user?.firstName} {p.user?.lastName}
              </Text>
              <Text style={[styles.participantStatus, { color: p.status === 'CONFIRMED' ? '#22C55E' : '#888' }]}>
                {p.status}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Notes */}
      {booking.notes && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{booking.notes}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {booking.conversationId && (
          <TouchableOpacity style={styles.chatBtn} onPress={handleOpenChat}>
            <Text style={styles.chatBtnText}>Open Group Chat</Text>
          </TouchableOpacity>
        )}

        {canJoin && (
          <TouchableOpacity
            style={[styles.joinBtn, joinMutation.isPending && styles.btnDisabled]}
            onPress={() => joinMutation.mutate()}
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending ? <ActivityIndicator color="#000" /> : <Text style={styles.joinBtnText}>Join This Booking</Text>}
          </TouchableOpacity>
        )}

        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancelMutation.isPending && styles.btnDisabled]}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? <ActivityIndicator color="#ef4444" /> : <Text style={styles.cancelBtnText}>Cancel Booking</Text>}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={[detailStyles.value, highlight && detailStyles.highlight]}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: '#888', fontSize: 14 },
  value: { color: '#ccc', fontSize: 14, fontWeight: '500' },
  highlight: { color: '#22C55E', fontWeight: '700', fontSize: 16 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  content: { padding: 20, paddingBottom: 60, gap: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f13' },
  errorText: { color: '#888' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#1a1a22', borderRadius: 14, padding: 16 },
  pitchName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  pitchAddr: { color: '#888', fontSize: 13, marginTop: 2 },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 8 },
  policyCard: { backgroundColor: '#1a1310', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#3d2800' },
  policyTitle: { color: '#f59e0b', fontWeight: '700', marginBottom: 6 },
  policyText: { color: '#aaa', fontSize: 13, lineHeight: 20 },
  policyHighlight: { color: '#f59e0b', fontWeight: '700' },
  policyCountdown: { marginTop: 10, fontSize: 13, color: '#ccc', fontWeight: '500' },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2a2a35', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  participantName: { flex: 1, color: '#ccc', fontSize: 14 },
  participantStatus: { fontSize: 12, fontWeight: '600' },
  notes: { color: '#aaa', fontSize: 14, lineHeight: 20 },
  actions: { gap: 10, marginTop: 8 },
  chatBtn: {
    backgroundColor: '#1e40af', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  chatBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  joinBtn: {
    backgroundColor: '#22C55E', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  joinBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  cancelBtn: {
    borderRadius: 12, borderWidth: 1.5, borderColor: '#ef4444',
    paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
});
