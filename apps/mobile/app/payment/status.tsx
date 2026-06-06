import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { paymentsApi } from '@/lib/api';

type Status = 'PENDING' | 'HELD' | 'RELEASED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

const PAID_STATES: Status[] = ['HELD', 'RELEASED', 'PARTIALLY_REFUNDED'];
const FAILED_STATES: Status[] = ['FAILED', 'REFUNDED'];
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // ~2 minutes

export default function PaymentStatusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ transactionId: string; autoSuccess?: string }>();
  const transactionId = params.transactionId;

  const [status, setStatus] = useState<Status>('PENDING');
  const [data, setData] = useState<any>(null);
  const [pollCount, setPollCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const fetchStatus = async () => {
    if (!transactionId) return;
    try {
      const { data: result } = await paymentsApi.getStatus(transactionId);
      setData(result);
      setStatus(result.status as Status);

      if (PAID_STATES.includes(result.status as Status) || FAILED_STATES.includes(result.status as Status)) {
        stopPolling();
      }
    } catch {
      // ignore transient errors, keep polling
    }
  };

  useEffect(() => {
    fetchStatus();

    intervalRef.current = setInterval(() => {
      setPollCount((prev) => {
        const next = prev + 1;
        if (next >= MAX_POLLS) {
          stopPolling();
          setTimedOut(true);
        }
        return next;
      });
      fetchStatus();
    }, POLL_INTERVAL_MS);

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  const isPaid = PAID_STATES.includes(status);
  const isFailed = FAILED_STATES.includes(status);
  const isPending = !isPaid && !isFailed && !timedOut;

  const handleGoToBooking = () => {
    if (!data) return router.replace('/');
    if (data.bookingType === 'PITCH' && data.pitchBooking?.id) {
      router.replace(`/pitch-bookings/${data.pitchBooking.id}`);
    } else if (data.bookingType === 'MATCH' && data.booking?.matchId) {
      router.replace(`/matches/${data.booking.matchId}`);
    } else {
      router.replace('/');
    }
  };

  const handleRetry = () => {
    setTimedOut(false);
    setPollCount(0);
    setStatus('PENDING');
    fetchStatus();
    intervalRef.current = setInterval(() => {
      setPollCount((prev) => {
        const next = prev + 1;
        if (next >= MAX_POLLS) {
          stopPolling();
          setTimedOut(true);
        }
        return next;
      });
      fetchStatus();
    }, POLL_INTERVAL_MS);
  };

  return (
    <View className="flex-1 bg-gray-950 items-center justify-center px-8">
      {/* Pending / loading */}
      {isPending && (
        <>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-white text-xl font-bold mt-6">Confirming payment…</Text>
          <Text className="text-gray-400 text-sm mt-2 text-center">
            This may take a few seconds. Please don't close this screen.
          </Text>
          {pollCount > 5 && (
            <Text className="text-gray-500 text-xs mt-4">
              Still waiting… ({Math.round((pollCount * POLL_INTERVAL_MS) / 1000)}s elapsed)
            </Text>
          )}
        </>
      )}

      {/* Success */}
      {isPaid && (
        <>
          <Text className="text-5xl mb-4">✅</Text>
          <Text className="text-white text-2xl font-bold">Payment confirmed!</Text>
          {data?.amount && (
            <Text className="text-gray-400 text-base mt-2">
              {Number(data.amount).toLocaleString()} UZS via {data.gateway?.replace('_', ' ')}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleGoToBooking}
            className="mt-10 bg-blue-600 rounded-2xl px-8 py-4"
          >
            <Text className="text-white font-bold text-base">View booking</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/')} className="mt-4">
            <Text className="text-gray-500 text-sm">Go to home</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Failed */}
      {isFailed && (
        <>
          <Text className="text-5xl mb-4">❌</Text>
          <Text className="text-white text-2xl font-bold">Payment failed</Text>
          <Text className="text-gray-400 text-sm mt-2 text-center">
            Your payment was not completed. No funds have been charged.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-10 bg-blue-600 rounded-2xl px-8 py-4"
          >
            <Text className="text-white font-bold text-base">Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/')} className="mt-4">
            <Text className="text-gray-500 text-sm">Cancel</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Timed out */}
      {timedOut && !isPaid && !isFailed && (
        <>
          <Text className="text-5xl mb-4">⏳</Text>
          <Text className="text-white text-2xl font-bold">Still processing…</Text>
          <Text className="text-gray-400 text-sm mt-2 text-center">
            The payment gateway hasn't confirmed yet. You can check back later in your bookings.
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            className="mt-8 bg-blue-600 rounded-2xl px-8 py-4"
          >
            <Text className="text-white font-bold text-base">Check again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleGoToBooking} className="mt-4">
            <Text className="text-gray-400 text-sm">View booking anyway</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/')} className="mt-2">
            <Text className="text-gray-500 text-sm">Go to home</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
