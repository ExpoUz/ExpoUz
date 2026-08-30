'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pitchAdminApi } from '../../lib/api';
import BottomNav from '../../components/BottomNav';

export default function PlayersPage() {
  const [search, setSearch] = useState('');
  const { data: matches } = useQuery({ queryKey: ['host-matches'], queryFn: () => pitchAdminApi.getMatches({ limit: 20 }) });

  // Collect all unique players across recent matches
  const allPlayers: any[] = [];
  (matches || []).forEach((m: any) => {
    (m.bookings || []).forEach((b: any) => {
      if (b.user && !allPlayers.find((p) => p.id === b.user.id)) {
        allPlayers.push({ ...b.user, lastMatch: m.title, lastMatchDate: m.startTime });
      }
    });
  });

  const filtered = allPlayers.filter((p) =>
    !search || `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#090E0C] pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-[#F0FFF4]">Players</h1>
        <p className="text-xs text-[#7a9a80]">{allPlayers.length} unique players across your pitches</p>
      </div>

      <div className="px-4 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players..."
          className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] placeholder-[#7a9a80] focus:border-[#00C853] focus:outline-none" />
      </div>

      <div className="px-4 space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-[#1e2e21] bg-[#111a14] p-3">
            <img src={p.avatarUrl || `https://ui-avatars.com/api/?name=${p.firstName}&background=1e2e21&color=00C853`}
              className="h-12 w-12 rounded-full" alt="" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-[#F0FFF4]">{p.firstName} {p.lastName}</p>
              <p className="text-xs text-[#7a9a80]">Last: {p.lastMatch}</p>
            </div>
            <div className="text-right">
              <span className="rounded-full border border-[#1e2e21] px-2 py-0.5 text-[10px] text-[#7a9a80]">
                {p.skillLevel || 'AMATEUR'}
              </span>
              <p className="text-xs text-[#FFD700] mt-0.5">⚡ {p.eloRating || 1000}</p>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-4xl mb-2">👥</p>
            <p className="text-[#7a9a80] text-sm">No players yet</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
