'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import dayjs from 'dayjs';
import { pitchAdminApi } from '../../lib/api';
import BottomNav from '../../components/BottomNav';

const RANGES = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '3m', label: '3 Months' },
];

function formatUZS(n: number) { return new Intl.NumberFormat('uz-UZ').format(n); }

export default function RevenuePage() {
  const [range, setRange] = useState('30d');
  const [selectedPitchId, setSelectedPitchId] = useState<string | null>(null);

  const { data: pitches } = useQuery({ queryKey: ['host-pitches'], queryFn: pitchAdminApi.getPitches });
  const pitchId = selectedPitchId || pitches?.[0]?.id;

  const { data: revenue } = useQuery({
    queryKey: ['revenue', pitchId, range],
    queryFn: () => pitchAdminApi.getRevenue(pitchId!, range),
    enabled: !!pitchId,
  });

  const chartData = revenue?.daily || [];
  const totalGross = revenue?.totalGross || 0;
  const totalNet = revenue?.totalNet || 0;
  const avgPerMatch = revenue?.avgPerMatch || 0;

  return (
    <div className="min-h-screen bg-[#090E0C] pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-[#F0FFF4]">Revenue</h1>
      </div>

      {/* Pitch selector */}
      {pitches && pitches.length > 1 && (
        <div className="px-4 mb-3 flex gap-2 overflow-x-auto">
          {pitches.map((p: any) => (
            <button key={p.id} onClick={() => setSelectedPitchId(p.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold ${pitchId === p.id ? 'bg-[#00C853] text-white' : 'border border-[#1e2e21] text-[#7a9a80]'}`}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Range selector */}
      <div className="px-4 mb-4 flex gap-2">
        {RANGES.map((r) => (
          <button key={r.id} onClick={() => setRange(r.id)}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold ${range === r.id ? 'bg-[#111a14] text-[#00C853] border border-[#00C853]' : 'border border-[#1e2e21] text-[#7a9a80]'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-4">
        {[
          { label: 'Gross', value: `${formatUZS(totalGross)} UZS`, color: '#F0FFF4' },
          { label: 'Net (90%)', value: `${formatUZS(totalNet)} UZS`, color: '#00C853' },
          { label: 'Per Match', value: `${formatUZS(avgPerMatch)} UZS`, color: '#FFD700' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#1e2e21] bg-[#111a14] p-3">
            <p className="text-[10px] text-[#7a9a80] mb-0.5">{k.label}</p>
            <p className="font-mono text-xs font-bold leading-tight" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Area chart */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl border border-[#1e2e21] bg-[#111a14] p-4">
          <p className="text-xs text-[#7a9a80] mb-3">Daily Revenue (Net)</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C853" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#7a9a80' }} tickFormatter={(v) => dayjs(v).format('DD')} />
              <YAxis tick={{ fontSize: 9, fill: '#7a9a80' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: any) => [`${formatUZS(v)} UZS`, 'Net']} labelFormatter={(l) => dayjs(l).format('D MMM')}
                contentStyle={{ background: '#111a14', border: '1px solid #1e2e21', borderRadius: 8, fontSize: 11, color: '#F0FFF4' }} />
              <Area type="monotone" dataKey="net" stroke="#00C853" fill="url(#green)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown by day of week */}
      {revenue?.byDayOfWeek && (
        <div className="px-4">
          <div className="rounded-2xl border border-[#1e2e21] bg-[#111a14] p-4">
            <p className="text-xs text-[#7a9a80] mb-3">Busiest Days</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={revenue.byDayOfWeek} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#7a9a80' }} />
                <YAxis tick={{ fontSize: 9, fill: '#7a9a80' }} tickFormatter={(v) => `${v}`} />
                <Tooltip contentStyle={{ background: '#111a14', border: '1px solid #1e2e21', borderRadius: 8, fontSize: 11, color: '#F0FFF4' }} />
                <Bar dataKey="matches" fill="#00C853" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
