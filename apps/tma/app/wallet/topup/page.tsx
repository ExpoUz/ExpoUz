'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { walletsApi } from '../../../lib/api';

const AMOUNTS = [50000, 100000, 200000, 500000];
const GATEWAYS = [
  { id: 'UZUM_PAY', label: 'Uzum Pay', emoji: '🟠' },
  { id: 'PAYME', label: 'Payme', emoji: '🔵' },
  { id: 'CLICK', label: 'Click', emoji: '🟢' },
];

function formatUZS(n: number) { return new Intl.NumberFormat('uz-UZ').format(n) + ' UZS'; }

export default function TopUpPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(100000);
  const [custom, setCustom] = useState('');
  const [gateway, setGateway] = useState('UZUM_PAY');

  const { mutate: topup, isPending } = useMutation({
    mutationFn: () => walletsApi.topup({ amount: custom ? parseInt(custom) : amount, gateway }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      // In production: window.open(data.paymentUrl)
      router.push('/settings');
    },
  });

  const finalAmount = custom ? parseInt(custom) || 0 : amount;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="flex items-center gap-3 bg-white px-4 py-4 border-b border-gray-100">
        <button onClick={() => router.back()}><ArrowLeft size={20} className="text-gray-500" /></button>
        <h1 className="font-display text-xl font-extrabold text-gray-900">Top Up Wallet</h1>
      </div>
      <div className="px-4 pt-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Select Amount</p>
          <div className="grid grid-cols-2 gap-3">
            {AMOUNTS.map((a) => (
              <button key={a} onClick={() => { setAmount(a); setCustom(''); }}
                className={`rounded-2xl py-3 text-sm font-bold transition-colors ${amount === a && !custom ? 'bg-[#00C853] text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
                {formatUZS(a)}
              </button>
            ))}
          </div>
          <input type="number" placeholder="Custom amount..." value={custom} onChange={(e) => setCustom(e.target.value)}
            className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
          <div className="space-y-2">
            {GATEWAYS.map((gw) => (
              <button key={gw.id} onClick={() => setGateway(gw.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 ${gateway === gw.id ? 'border-[#00C853] bg-green-50' : 'border-gray-100 bg-white'}`}>
                <span className="text-xl">{gw.emoji}</span>
                <span className="flex-1 text-left font-medium text-gray-800">{gw.label}</span>
                <div className={`h-4 w-4 rounded-full border-2 ${gateway === gw.id ? 'border-[#00C853] bg-[#00C853]' : 'border-gray-300'}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 p-4 border-t border-gray-100">
        <button onClick={() => topup()} disabled={isPending || finalAmount < 10000}
          className="w-full rounded-2xl bg-[#00C853] py-4 font-display text-xl font-bold text-white disabled:opacity-40">
          {isPending ? 'Redirecting...' : `Top Up ${formatUZS(finalAmount)}`}
        </button>
      </div>
    </div>
  );
}
