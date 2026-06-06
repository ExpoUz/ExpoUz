import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { paymentsApi } from '@/lib/api';

const GATEWAYS = [
  { key: 'PAYME', label: 'Payme', color: '#1AABFF' },
  { key: 'CLICK', label: 'Click', color: '#0066CC' },
  { key: 'UZUM_PAY', label: 'Uzum Pay', color: '#8B5CF6' },
  { key: 'WALLET', label: 'Wallet', color: '#10B981' },
] as const;

type Gateway = (typeof GATEWAYS)[number]['key'];

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookingId?: string;
    pitchBookingId?: string;
    bookingType?: string;
    title?: string;
    amount?: string;
    gateway?: string;
  }>();

  const [gateway, setGateway] = useState<Gateway>((params.gateway as Gateway) ?? 'UZUM_PAY');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(true);

  const amount = parseFloat(params.amount ?? '0');
  const bookingType = params.bookingType ?? 'MATCH';

  useEffect(() => {
    paymentsApi
      .getWalletBalance()
      .then((r) => setWalletBalance(Number(r.data.balance)))
      .catch(() => setWalletBalance(0))
      .finally(() => setFetchingBalance(false));
  }, []);

  const handlePay = async () => {
    setLoading(true);
    try {
      const { data } = await paymentsApi.initiate({
        bookingId: params.bookingId,
        pitchBookingId: params.pitchBookingId,
        gateway,
      });

      if (gateway === 'WALLET') {
        // Inline wallet payment — no redirect needed
        const { data: result } = await paymentsApi.payWithWallet(data.transactionId);
        if (result.isPaid) {
          router.replace(
            `/payment/status?transactionId=${data.transactionId}&autoSuccess=true`,
          );
        } else {
          Alert.alert('Payment failed', 'Wallet payment could not be completed.');
        }
      } else {
        // Open gateway URL, then navigate to status polling screen
        await Linking.openURL(data.paymentUrl);
        router.replace(`/payment/status?transactionId=${data.transactionId}`);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Payment initiation failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedGw = GATEWAYS.find((g) => g.key === gateway)!;
  const walletInsufficient = gateway === 'WALLET' && walletBalance !== null && walletBalance < amount;

  return (
    <ScrollView className="flex-1 bg-gray-950" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {/* Header */}
      <Text className="text-white text-2xl font-bold mb-1">Payment</Text>
      {params.title ? (
        <Text className="text-gray-400 text-base mb-6">{params.title}</Text>
      ) : null}

      {/* Amount */}
      <View className="bg-gray-900 rounded-2xl p-5 mb-6 items-center">
        <Text className="text-gray-400 text-sm mb-1">Total amount</Text>
        <Text className="text-white text-4xl font-bold">
          {amount.toLocaleString()} UZS
        </Text>
        {bookingType === 'PITCH' && (
          <Text className="text-gray-500 text-xs mt-2">Includes 5% platform fee</Text>
        )}
      </View>

      {/* Gateway picker */}
      <Text className="text-gray-300 text-base font-semibold mb-3">Payment method</Text>
      <View className="gap-3 mb-6">
        {GATEWAYS.map((gw) => {
          const isSelected = gateway === gw.key;
          const isWalletOption = gw.key === 'WALLET';
          const balanceLabel =
            isWalletOption && walletBalance !== null
              ? ` · Balance: ${walletBalance.toLocaleString()} UZS`
              : '';

          return (
            <TouchableOpacity
              key={gw.key}
              onPress={() => setGateway(gw.key)}
              className={`flex-row items-center justify-between rounded-xl p-4 border ${
                isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-900'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <View
                  style={{ backgroundColor: gw.color }}
                  className="w-3 h-3 rounded-full"
                />
                <Text className="text-white font-medium">{gw.label}</Text>
                {balanceLabel ? (
                  <Text className="text-gray-500 text-sm">{balanceLabel}</Text>
                ) : null}
              </View>
              {isSelected && <Text className="text-blue-400 font-bold">✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Wallet insufficient warning */}
      {walletInsufficient && (
        <View className="bg-yellow-900/40 border border-yellow-700 rounded-xl p-4 mb-6">
          <Text className="text-yellow-300 text-sm">
            Insufficient wallet balance. Top up your wallet or choose a different payment method.
          </Text>
        </View>
      )}

      {/* Cancellation policy */}
      {bookingType === 'PITCH' && (
        <View className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
          <Text className="text-gray-300 text-sm font-semibold mb-1">Cancellation Policy</Text>
          <Text className="text-gray-400 text-sm">
            Free cancellation up to 5 hours before the booking starts. A 50% fee applies if
            cancelled within 5 hours of the start time.
          </Text>
        </View>
      )}

      {/* Pay button */}
      <TouchableOpacity
        onPress={handlePay}
        disabled={loading || fetchingBalance || walletInsufficient}
        style={{ backgroundColor: walletInsufficient ? '#374151' : selectedGw.color }}
        className="rounded-2xl py-4 items-center"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white text-lg font-bold">
            Pay {amount.toLocaleString()} UZS with {selectedGw.label}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
