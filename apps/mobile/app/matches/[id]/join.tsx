import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchesApi, bookingsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { FormationPitch } from '@/components/ui/FormationPitch';
import { QRDisplay } from '@/components/ui/QRDisplay';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { formatUZS } from '@expouz/shared';

type Step = 1 | 2 | 3 | 4;
type TeamSide = 'HOME' | 'AWAY' | null;
type Gateway = 'UZUM_PAY' | 'PAYME' | 'CLICK' | 'WALLET';

const STEP_LABELS = ['Team', 'Position', 'Payment'];

const GATEWAYS: { key: Gateway; label: string; icon: string; recommended?: boolean }[] = [
  { key: 'UZUM_PAY', label: 'Uzum Pay', icon: '🟠', recommended: true },
  { key: 'PAYME', label: 'Payme', icon: '🔵' },
  { key: 'CLICK', label: 'Click', icon: '🟢' },
  { key: 'WALLET', label: 'In-App Wallet', icon: '💳' },
];

export default function JoinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>(1);
  const [teamSide, setTeamSide] = useState<TeamSide>(null);
  const [positionId, setPositionId] = useState<string | null>(null);
  const [gateway, setGateway] = useState<Gateway>('UZUM_PAY');
  const [booking, setBooking] = useState<any>(null);

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => { const r = await matchesApi.getById(id!); return r.data; },
    enabled: !!id,
  });

  const { data: formation } = useQuery({
    queryKey: ['match-formation', id],
    queryFn: async () => { const r = await matchesApi.getFormation(id!); return r.data; },
    enabled: !!id && step === 2,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      bookingsApi.create({
        matchId: id!,
        positionId: positionId ?? undefined,
        teamSide: (teamSide ?? 'HOME') as any,
        gateway: gateway as any,
      }),
    onSuccess: (res) => {
      setBooking(res.data);
      setStep(4);
    },
    onError: () => Alert.alert('Payment Failed', 'Please try again or choose a different method.'),
  });

  const pricePerPlayer = Number(match?.pricePerPlayer || 0);
  const platformFee = Math.round(pricePerPlayer * 0.05);
  const total = pricePerPlayer + platformFee;

  const goToPayment = () => {
    if (!(user as any)?.phone) {
      Alert.alert(
        'Phone Required',
        'Please add a phone number to your account before making payments.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Profile', onPress: () => { router.back(); router.push('/settings/edit-profile' as any); } },
        ],
      );
      return;
    }
    setStep(3);
  };

  const handleBack = () => {
    if (step === 4) { router.replace('/(tabs)/games'); return; }
    if (step === 1) { router.back(); return; }
    setStep((s) => (s - 1) as Step);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <SkeletonLoader variant="card" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header / Step indicator ── */}
      {step < 4 && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <Ionicons name={step === 1 ? 'close' : 'arrow-back'} size={22} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.stepTrack}>
            {STEP_LABELS.map((label, i) => {
              const s = (i + 1) as Step;
              const done = step > s;
              const active = step === s;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <View style={[styles.stepConnector, done && styles.stepConnectorDone]} />}
                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, done && styles.stepDone, active && styles.stepActive]}>
                      {done
                        ? <Ionicons name="checkmark" size={12} color="#fff" />
                        : <Text style={[styles.stepNum, active && { color: '#fff' }]}>{s}</Text>
                      }
                    </View>
                    <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          <View style={{ width: 38 }} />
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ══ Step 1: Team ══ */}
        {step === 1 && (
          <View>
            <Text style={styles.heading}>Pick Your Side</Text>
            <Text style={styles.subheading}>{match?.title}</Text>

            <View style={styles.teamRow}>
              {(['HOME', 'AWAY'] as const).map((side) => {
                const selected = teamSide === side;
                const color = side === 'HOME' ? '#E63946' : '#1D3557';
                const count = match?.positions?.filter((p: any) => p.teamSide === side && p.bookingId).length ?? 0;
                return (
                  <TouchableOpacity
                    key={side}
                    onPress={() => setTeamSide(side)}
                    activeOpacity={0.8}
                    style={[styles.teamCard, selected && { borderColor: color, borderWidth: 2 }]}
                  >
                    <View style={[styles.teamDot, { backgroundColor: color }]} />
                    <Text style={styles.teamName}>{side === 'HOME' ? 'Home' : 'Away'}</Text>
                    <Text style={styles.teamCount}>{count} players in</Text>
                    {selected && (
                      <View style={[styles.teamCheck, { backgroundColor: color }]}>
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setTeamSide(null)}
              activeOpacity={0.8}
              style={[styles.noPreferenceBtn, teamSide === null && styles.noPreferenceBtnActive]}
            >
              <Text style={[styles.noPreferenceText, teamSide === null && { color: '#00C853' }]}>
                🎲  No preference — just assign me
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ══ Step 2: Position ══ */}
        {step === 2 && (
          <View>
            <Text style={styles.heading}>Pick a Position</Text>
            <Text style={styles.subheading}>Tap an open slot or skip to let us assign you</Text>

            {formation ? (
              <View style={styles.pitchWrapper}>
                <FormationPitch
                  formation={match?.formation || '4-3-3'}
                  positions={[
                    ...(formation?.teams?.home?.positions ?? []),
                    ...(formation?.teams?.away?.positions ?? []),
                  ]}
                  onPositionPress={(pos: any) => {
                    if (pos.isVacant && !pos.isLocked) setPositionId(pos.id);
                  }}
                  currentUserId={user?.id}
                />
              </View>
            ) : (
              <SkeletonLoader variant="card" />
            )}

            {positionId && (
              <View style={styles.positionPicked}>
                <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                <Text style={styles.positionPickedText}>Position selected</Text>
              </View>
            )}

            <View style={styles.dualBtns}>
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => { setPositionId(null); goToPayment(); }}
              >
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, { flex: 1 }]}
                onPress={goToPayment}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══ Step 3: Payment ══ */}
        {step === 3 && (
          <View>
            <Text style={styles.heading}>Complete Payment</Text>

            {/* Order summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{match?.title}</Text>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Entry fee</Text>
                <Text style={styles.summaryAmt}>{formatUZS(pricePerPlayer)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Platform fee (5%)</Text>
                <Text style={styles.summaryAmt}>{formatUZS(platformFee)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalAmt}>{formatUZS(total)}</Text>
              </View>
            </View>

            {/* Payment methods */}
            <Text style={styles.sectionLabel}>Payment Method</Text>
            {GATEWAYS.map(({ key, label, icon, recommended }) => {
              const selected = gateway === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setGateway(key)}
                  activeOpacity={0.8}
                  style={[styles.gwRow, selected && styles.gwRowSelected]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.gwIcon}>{icon}</Text>
                  <Text style={[styles.gwLabel, selected && { color: '#0F172A' }]}>{label}</Text>
                  {recommended && (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>Best</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.payBtn, bookMutation.isPending && { opacity: 0.7 }]}
              onPress={() => bookMutation.mutate()}
              disabled={bookMutation.isPending}
              activeOpacity={0.85}
            >
              {bookMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={15} color="#fff" />
                  <Text style={styles.payBtnText}>Pay {formatUZS(total)}</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.escrowNote}>🔒 Funds held in escrow until the game starts</Text>
          </View>
        )}

        {/* ══ Step 4: Confirmed ══ */}
        {step === 4 && booking && (
          <View style={styles.confirmedWrapper}>
            <View style={styles.confirmedRing}>
              <Ionicons name="checkmark" size={52} color="#00C853" />
            </View>
            <Text style={styles.confirmedTitle}>You're In!</Text>
            <Text style={styles.confirmedSub}>{match?.title}</Text>

            <View style={styles.qrCard}>
              <QRDisplay value={booking?.booking?.id ?? booking?.id ?? booking?.qrCode ?? 'QR'} size={180} />
              <Text style={styles.qrHint}>Show this at the pitch entrance</Text>
            </View>

            <View style={styles.dualBtns}>
              <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(tabs)/profile')}>
                <Text style={styles.skipBtnText}>My Bookings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, { flex: 1 }]}
                onPress={() => router.replace('/(tabs)/games')}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>Browse Games</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F4F8',
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },

  // Step track
  stepTrack: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepConnector: { flex: 1, height: 2, backgroundColor: '#E8ECEF', marginHorizontal: 4 },
  stepConnectorDone: { backgroundColor: '#00C853' },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  stepActive: { backgroundColor: '#00C853', borderColor: '#00C853' },
  stepDone: { backgroundColor: '#00C853', borderColor: '#00C853' },
  stepNum: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  stepLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  stepLabelActive: { color: '#00C853', fontWeight: '700' },

  scrollContent: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#94A3B8', marginBottom: 24 },

  // Step 1 — Team
  teamRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  teamCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E8ECEF',
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  teamDot: { width: 44, height: 44, borderRadius: 22, marginBottom: 10 },
  teamName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  teamCount: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  teamCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  noPreferenceBtn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E8ECEF', marginBottom: 24,
  },
  noPreferenceBtnActive: { borderColor: '#00C853', backgroundColor: '#F0FDF4' },
  noPreferenceText: { fontSize: 14, fontWeight: '600', color: '#64748B' },

  // Step 2 — Position
  pitchWrapper: { height: 360, marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  positionPicked: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, marginBottom: 12,
  },
  positionPickedText: { color: '#16A34A', fontWeight: '600', fontSize: 13 },

  // Step 3 — Payment
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  summaryLabel: { fontSize: 13, color: '#64748B' },
  summaryAmt: { fontSize: 13, color: '#0F172A', fontWeight: '500' },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  summaryTotalAmt: { fontSize: 16, fontWeight: '800', color: '#00C853' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  gwRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#E8ECEF',
  },
  gwRowSelected: { borderColor: '#00C853', backgroundColor: '#F0FDF4' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#00C853' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00C853' },
  gwIcon: { fontSize: 20 },
  gwLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#64748B' },
  bestBadge: { backgroundColor: '#00C853', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  bestBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00C853', borderRadius: 14, paddingVertical: 16, marginTop: 8,
  },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  escrowNote: { textAlign: 'center', color: '#94A3B8', fontSize: 12, marginTop: 10 },

  // Step 4 — Confirmed
  confirmedWrapper: { alignItems: 'center', paddingVertical: 24 },
  confirmedRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 3, borderColor: '#00C853',
  },
  confirmedTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  confirmedSub: { fontSize: 14, color: '#94A3B8', marginBottom: 24 },
  qrCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    alignItems: 'center', width: '100%', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  qrHint: { fontSize: 12, color: '#94A3B8', marginTop: 10 },

  // Shared buttons
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00C853', borderRadius: 14, paddingVertical: 15,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipBtn: {
    borderRadius: 14, paddingVertical: 15, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtnText: { color: '#64748B', fontSize: 15, fontWeight: '600' },
  dualBtns: { flexDirection: 'row', gap: 12 },
});

