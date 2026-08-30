'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Users, TrendingUp, CalendarDays, CheckCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { pitchAdminApi } from '../lib/api';
import { useHostAuth } from '../lib/auth';
import BottomNav from '../components/BottomNav';

function formatUZS(n: number) { return new Intl.NumberFormat('uz-UZ').format(n); }

function KPICard({ label, value, sub, icon: Icon, color = '#00C853' }: any) {
  return (
    <div className="rounded-2xl border border-[#1e2e21] bg-[#111a14] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} color={color} />
        <span className="text-xs text-[#7a9a80]">{label}</span>
      </div>
      <p className="font-display text-2xl font-extrabold text-[#F0FFF4]">{value}</p>
      {sub && <p className="text-xs text-[#7a9a80] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useHostAuth();
  const router = useRouter();

  const { data: dashboard } = useQuery({ queryKey: ['host-dashboard'], queryFn: pitchAdminApi.getDashboard, enabled: !!user });
  const { data: matches } = useQuery({ queryKey: ['host-matches-today'], queryFn: () => pitchAdminApi.getMatches({ today: true }), enabled: !!user });

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#090E0C]"><span className="text-[#7a9a80] text-sm">Loading...</span></div>;
  if (!user) return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#090E0C] px-6">
      <span className="text-5xl mb-4">🏟️</span>
      <h1 className="font-display text-3xl font-extrabold text-[#F0FFF4] mb-2">ExpoUz Host</h1>
      <p className="text-[#7a9a80] text-center text-sm mb-6">Manage your pitch, schedule, and revenue from your Telegram.</p>
      <p className="text-[#7a9a80] text-xs">Open via @ExpoUzHostBot to log in</p>
    </div>
  );

  const todayMatches = matches || [];
  const liveMatch = todayMatches.find((m: any) => m.status === 'IN_PROGRESS');

  return (
    <div className="min-h-screen bg-[#090E0C] pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#7a9a80] text-xs">Good day,</p>
            <h1 className="font-display text-2xl font-extrabold text-[#F0FFF4]">
              {user.firstName} <span className="text-[#FFD700]">👑</span>
            </h1>
          </div>
          <img
            src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.firstName}&background=1e2e21&color=00C853&size=80`}
            className="h-12 w-12 rounded-full border-2 border-[#1e2e21]"
            alt="avatar"
          />
        </div>
      </div>

      {/* Live match banner */}
      {liveMatch && (
        <div className="mx-4 mb-4 rounded-2xl bg-gradient-to-r from-[#00C853] to-[#00A844] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70">🔴 LIVE NOW</p>
            <p className="font-display text-lg font-bold text-white">{liveMatch.title}</p>
            <p className="text-xs text-white/80">{liveMatch.currentPlayers}/{liveMatch.maxPlayers} players</p>
          </div>
          <button onClick={() => router.push(`/match/${liveMatch.id}/checkin`)} className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white">
            Check In →
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-4">
        <KPICard label="Today's Revenue" icon={TrendingUp} value={`${formatUZS(dashboard?.todayRevenue || 0)} UZS`} sub="Net after 10% fee" color="#FFD700" />
        <KPICard label="Today's Players" icon={Users} value={dashboard?.todayPlayers || 0} sub="Across all pitches" />
        <KPICard label="Matches Today" icon={CalendarDays} value={dashboard?.todayMatches || 0} sub={`${dashboard?.confirmedMatches || 0} confirmed`} />
        <KPICard label="Utilization" icon={CheckCircle} value={`${dashboard?.utilizationPct || 0}%`} sub="Pitch occupancy rate" color="#00C853" />
      </div>

      {/* Today's schedule */}
      <div className="px-4">
        <h2 className="font-display text-lg font-bold text-[#F0FFF4] mb-3">Today's Schedule</h2>
        {todayMatches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#1e2e21] py-10 text-center">
            <p className="text-[#7a9a80] text-sm">No matches today</p>
            <button onClick={() => router.push('/schedule')} className="mt-2 text-xs text-[#00C853]">+ Add Match</button>
          </div>
        )}
        {todayMatches.map((m: any) => {
          const statusColor = m.status === 'IN_PROGRESS' ? '#00C853' : m.status === 'CONFIRMED' ? '#FFD700' : '#7a9a80';
          return (
            <button key={m.id} onClick={() => router.push(`/match/${m.id}`)}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-[#1e2e21] bg-[#111a14] p-3 text-left">
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-[#0d1f10]">
                <p className="font-display text-lg font-extrabold" style={{ color: statusColor }}>{dayjs(m.startTime).format('HH')}</p>
                <p className="text-[10px] text-[#7a9a80]">{dayjs(m.startTime).format(':mm')}</p>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[#F0FFF4]">{m.title}</p>
                <p className="text-xs text-[#7a9a80]">{m.currentPlayers}/{m.maxPlayers} players · {m.pitch?.name}</p>
              </div>
              <div className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: statusColor, border: `1px solid ${statusColor}30`, background: `${statusColor}15` }}>
                {m.status}
              </div>
            </button>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
