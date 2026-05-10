import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { FormationPitch } from '@/components/ui/FormationPitch';
import { QRDisplay } from '@/components/ui/QRDisplay';
import { Button } from '@/components/ui/Button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { formatUZS } from '@fubles-uz/shared';

type Step = 1 | 2 | 3 | 4;
type TeamSide = 'HOME' | 'AWAY' | null;
type Gateway = 'UZUM_PAY' | 'PAYME' | 'CLICK' | 'WALLET';

export default function JoinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [teamSide, setTeamSide] = useState<TeamSide>(null);
  const [positionId, setPositionId] = useState<string | null>(null);
  const [gateway, setGateway] = useState<Gateway>('UZUM_PAY');
  const [booking, setBooking] = useState<any>(null);

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.matches.getOne(id!),
    enabled: !!id,
  });

  const { data: formation } = useQuery({
    queryKey: ['match-formation', id],
    queryFn: () => api.matches.getFormation(id!),
    enabled: !!id && step === 2,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      api.bookings.create({
        matchId: id!,
        positionId: positionId ?? undefined,
        teamSide: teamSide ?? undefined,
        paymentGateway: gateway,
      }),
    onSuccess: (data) => {
      setBooking(data);
      setStep(4);
    },
    onError: () => Alert.alert(t('common.error'), t('payment.failed')),
  });

  const pricePerPlayer = Number(match?.pricePerPlayer || 0);
  const platformFee = Math.round(pricePerPlayer * 0.05);
  const total = pricePerPlayer + platformFee;

  if (isLoading) return <SkeletonLoader variant="card" />;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Progress */}
      <View className="flex-row justify-center gap-2 py-4 bg-white border-b border-border">
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            className={`w-2 h-2 rounded-full ${step >= s ? 'bg-primary' : 'bg-gray-300'}`}
          />
        ))}
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Step 1: Team Side */}
        {step === 1 && (
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-6">{t('games.chooseTeam')}</Text>
            <View className="flex-row gap-4 mb-4">
              {(['HOME', 'AWAY'] as const).map((side) => (
                <TouchableOpacity
                  key={side}
                  onPress={() => setTeamSide(side)}
                  className={`flex-1 rounded-2xl p-6 items-center border-2 ${
                    teamSide === side ? 'border-primary bg-green-50' : 'border-border bg-white'
                  }`}
                >
                  <View
                    className="w-10 h-10 rounded-full mb-3"
                    style={{ backgroundColor: side === 'HOME' ? '#E63946' : '#1D3557' }}
                  />
                  <Text className="font-bold text-gray-900">{side === 'HOME' ? t('formation.home') : t('formation.away')}</Text>
                  <Text className="text-gray-500 text-sm mt-1">
                    {match?.positions?.filter((p: any) => p.teamSide === side && p.bookingId).length || 0} players
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setTeamSide(null)}
              className={`rounded-2xl p-4 border-2 items-center mb-8 ${
                teamSide === null ? 'border-primary bg-green-50' : 'border-border bg-white'
              }`}
            >
              <Text className="font-semibold text-gray-700">{t('games.noPreference')}</Text>
            </TouchableOpacity>
            <Button title={t('common.continue')} onPress={() => setStep(2)} variant="primary" />
          </View>
        )}

        {/* Step 2: Position */}
        {step === 2 && (
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-4">{t('games.choosePosition')}</Text>
            {formation ? (
              <View style={{ height: 400 }}>
                <FormationPitch
                  formation={match?.formation || '4-3-3'}
                  positions={formation?.teams?.home?.positions?.concat(formation?.teams?.away?.positions) || []}
                  onPositionPress={(pos: any) => {
                    if (pos.isVacant && !pos.isLocked) {
                      setPositionId(pos.id);
                    }
                  }}
                  currentUserId={user?.id}
                />
              </View>
            ) : (
              <SkeletonLoader variant="card" />
            )}
            <View className="flex-row gap-3 mt-4">
              <Button title={t('games.skipPosition')} onPress={() => { setPositionId(null); setStep(3); }} variant="ghost" />
              <Button title={t('common.continue')} onPress={() => setStep(3)} variant="primary" />
            </View>
          </View>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <View>
            <Text className="text-xl font-bold text-gray-900 mb-4">{t('payment.title')}</Text>

            {/* Summary */}
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <Text className="font-bold text-gray-900 mb-3">{match?.title}</Text>
              <View className="border-t border-border pt-3 gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-gray-600">{t('payment.base')}</Text>
                  <Text className="text-gray-900">{formatUZS(pricePerPlayer)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-600">{t('payment.platformFee')} (5%)</Text>
                  <Text className="text-gray-900">{formatUZS(platformFee)}</Text>
                </View>
                <View className="flex-row justify-between border-t border-border pt-2 mt-1">
                  <Text className="font-bold text-gray-900">{t('payment.total')}</Text>
                  <Text className="font-bold text-primary">{formatUZS(total)}</Text>
                </View>
              </View>
            </View>

            {/* Gateway */}
            <Text className="font-semibold text-gray-700 mb-3">{t('payment.selectMethod')}</Text>
            {(['UZUM_PAY', 'PAYME', 'CLICK', 'WALLET'] as Gateway[]).map((gw) => (
              <TouchableOpacity
                key={gw}
                onPress={() => setGateway(gw)}
                className={`flex-row items-center bg-white rounded-2xl p-4 mb-3 border-2 ${
                  gateway === gw ? 'border-primary' : 'border-border'
                }`}
              >
                <View className={`w-5 h-5 rounded-full border-2 mr-3 ${gateway === gw ? 'border-primary bg-primary' : 'border-gray-300'}`} />
                <Text className="font-semibold text-gray-800">{gw.replace('_', ' ')}</Text>
                {gw === 'UZUM_PAY' && (
                  <View className="ml-2 bg-green-100 px-2 py-0.5 rounded-full">
                    <Text className="text-green-700 text-xs font-semibold">Recommended</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <Button
              title={`${t('payment.pay')} ${formatUZS(total)}`}
              onPress={() => bookMutation.mutate()}
              variant="primary"
              loading={bookMutation.isPending}
            />
          </View>
        )}

        {/* Step 4: Confirmed */}
        {step === 4 && booking && (
          <View className="items-center py-8">
            <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-6">
              <Ionicons name="checkmark-circle" size={80} color="#00C853" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">{t('booking.confirmed')}</Text>
            <Text className="text-gray-500 text-center mb-8">{match?.title}</Text>

            <View className="bg-white rounded-2xl p-4 w-full mb-6 shadow-sm">
              <QRDisplay value={booking.bookingId || booking.id} size={200} />
            </View>

            <View className="flex-row gap-3 w-full">
              <Button
                title={t('booking.viewBooking')}
                onPress={() => router.replace('/(tabs)/profile')}
                variant="outline"
              />
              <Button
                title={t('booking.backToGames')}
                onPress={() => router.replace('/(tabs)/games')}
                variant="primary"
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
