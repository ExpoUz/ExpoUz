'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Lock } from 'lucide-react';
import { matchesApi, bookingsApi } from '../../../../lib/api';
import { useTMAAuth } from '../../../../lib/auth';

function formatUZS(n: number) { return new Intl.NumberFormat('uz-UZ').format(n) + ' UZS'; }

const STEPS = ['Team', 'Position', 'Payment'];
const GATEWAYS = [
  { id: 'UZUM_PAY', label: 'Uzum Pay', emoji: '🟠', recommended: true },
  { id: 'PAYME', label: 'Payme', emoji: '🔵', recommended: false },
  { id: 'CLICK', label: 'Click', emoji: '🟢', recommended: false },
  { id: 'WALLET', label: 'In-App Wallet', emoji: '💳', recommended: false },
];

export default function JoinPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useTMAAuth();

  const [step, setStep] = useState(0);
  const [team, setTeam] = useState<'HOME' | 'AWAY' | null>(null);
  const [gateway, setGateway] = useState('UZUM_PAY');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<any>(null);

  const { data: match } = useQuery({ queryKey: ['match', id], queryFn: () => matchesApi.getOne(id) });

  const pricePerPlayer = Number(match?.pricePerPlayer || 0);
  const platformFee = Math.round(pricePerPlayer * 0.05);
  const total = pricePerPlayer + platformFee;

  async function handlePay() {
    if (!user) { router.push('/profile'); return; }
    setLoading(true);
    try {
      const res = await bookingsApi.create({ matchId: id, teamSide: team, gateway });
      // Immediately confirm for WALLET, else redirect
      if (gateway === 'WALLET') {
        setConfirmed(res.booking);
      } else {
        setConfirmed(res.booking);
        // In a real app: window.open(res.paymentUrl)
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.5 }}
          className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#00C853] text-5xl mb-6">
          ✅
        </motion.div>
        <h1 className="font-display text-3xl font-extrabold text-gray-900">You&apos;re In!</h1>
        <p className="mt-1 text-gray-500 text-center">{match?.title}</p>
        <div className="mt-6 w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
          <p className="text-xs text-gray-400 mb-2">Booking ID</p>
          <p className="font-mono text-sm font-bold text-gray-700">{confirmed.id}</p>
          <p className="mt-3 text-xs text-gray-400">🔲 Show this QR code at the pitch entrance</p>
          <div className="mt-2 flex justify-center">
            <div className="h-28 w-28 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">QR Code</div>
          </div>
        </div>
        <button onClick={() => router.push('/')} className="mt-6 w-full rounded-2xl bg-[#00C853] py-4 font-display text-lg font-bold text-white">
          Browse More Games
        </button>
        <button onClick={() => router.push('/profile')} className="mt-3 w-full rounded-2xl border border-gray-200 py-4 font-display text-lg font-bold text-gray-700">
          My Bookings
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white px-4 py-4">
        <button onClick={step === 0 ? () => router.back() : () => setStep(step - 1)} className="text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i < step ? 'bg-[#00C853] text-white' : i === step ? 'border-2 border-[#00C853] text-[#00C853]' : 'bg-gray-100 text-gray-400'
              }`}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === step ? 'text-[#00C853]' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`h-px w-8 ${i < step ? 'bg-[#00C853]' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {/* ── Step 0: Team ── */}
          {step === 0 && (
            <motion.div key="team" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-1">Pick Your Side</h2>
              <p className="text-sm text-gray-400 mb-5">{match?.title}</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {(['HOME', 'AWAY'] as const).map((side) => {
                  const color = side === 'HOME' ? '#00C853' : '#FF5252';
                  const players = (match?.bookings || []).filter((b: any) => b.teamSide === side).length;
                  return (
                    <button key={side} onClick={() => setTeam(side)}
                      className={`rounded-2xl border-2 p-5 text-center transition-all ${team === side ? 'border-[color:var(--c)] shadow-md' : 'border-gray-200'}`}
                      style={{ '--c': color } as any}>
                      <div className="flex justify-center mb-2">
                        <div className="h-5 w-5 rounded-full" style={{ background: color }} />
                      </div>
                      <p className="font-display text-xl font-bold" style={{ color }}>{side}</p>
                      <p className="text-xs text-gray-400 mt-1">{players} players in</p>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setTeam(null)} className={`w-full rounded-2xl border-2 py-3 text-sm font-medium transition-colors ${team === null ? 'border-gray-400 bg-gray-50' : 'border-gray-100 text-gray-400'}`}>
                🎲 No preference — just assign me
              </button>
            </motion.div>
          )}

          {/* ── Step 1: Position ── */}
          {step === 1 && (
            <motion.div key="pos" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-1">Pick a Position</h2>
              <p className="text-sm text-gray-400 mb-5">Tap an open slot or skip to let us assign you</p>
              <div className="h-72 rounded-2xl overflow-hidden bg-[#0d2b0d] flex items-center justify-center mb-4">
                <span className="text-white/40 text-sm">Formation pitch preview</span>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Payment ── */}
          {step === 2 && (
            <motion.div key="pay" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-4">Complete Payment</h2>
              {/* Summary */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4 mb-4 space-y-3">
                <p className="font-semibold text-gray-800 text-sm">{match?.title}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Entry fee</span>
                  <span className="font-mono font-medium">{formatUZS(pricePerPlayer)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Platform fee (5%)</span>
                  <span className="font-mono font-medium">{formatUZS(platformFee)}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-800">Total</span>
                  <span className="font-display text-lg font-bold text-[#00C853]">{formatUZS(total)}</span>
                </div>
              </div>
              {/* Gateways */}
              <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
              <div className="space-y-2 mb-4">
                {GATEWAYS.map((gw) => (
                  <button key={gw.id} onClick={() => setGateway(gw.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${gateway === gw.id ? 'border-[#00C853] bg-green-50' : 'border-gray-100 bg-white'}`}>
                    <span className="text-xl">{gw.emoji}</span>
                    <span className="flex-1 text-left font-medium text-gray-800">{gw.label}</span>
                    {gw.recommended && <span className="rounded-full bg-[#00C853] px-2 py-0.5 text-xs font-bold text-white">Best</span>}
                    <div className={`h-4 w-4 rounded-full border-2 ${gateway === gw.id ? 'border-[#00C853] bg-[#00C853]' : 'border-gray-300'}`} />
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-gray-400">🔒 Funds held in escrow until the game starts</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 p-4 backdrop-blur-md border-t border-gray-100">
        {step < 2 ? (
          <button onClick={() => setStep(step + 1)} className="w-full rounded-2xl bg-[#00C853] py-4 font-display text-xl font-bold text-white">
            Continue →
          </button>
        ) : (
          <button onClick={handlePay} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00C853] py-4 font-display text-xl font-bold text-white disabled:opacity-60">
            <Lock size={18} />
            {loading ? 'Processing...' : `Pay ${formatUZS(total)}`}
          </button>
        )}
      </div>
    </div>
  );
}
