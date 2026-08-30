'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserCheck, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import { pitchAdminApi } from '../../../lib/api';

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: players } = useQuery({ queryKey: ['match-players', id], queryFn: () => pitchAdminApi.getPlayers(id), refetchInterval: 10000 });

  const { mutate: checkin } = useMutation({
    mutationFn: (bookingId: string) => pitchAdminApi.checkin(id, bookingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['match-players', id] }),
  });

  const { mutate: complete, isPending: completing } = useMutation({
    mutationFn: () => pitchAdminApi.completeMatch(id),
    onSuccess: () => router.push('/schedule'),
  });

  const checkedIn = (players || []).filter((p: any) => p.checkedInAt).length;
  const total = players?.length || 0;

  return (
    <div className="min-h-screen bg-[#090E0C] pb-24">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => router.back()}><ArrowLeft size={20} color="#7a9a80" /></button>
        <h1 className="font-display text-2xl font-extrabold text-[#F0FFF4]">Check-In</h1>
      </div>

      <div className="px-4 mb-4">
        <div className="rounded-2xl bg-[#111a14] border border-[#1e2e21] p-4">
          <div className="flex justify-between items-center">
            <p className="text-[#7a9a80] text-xs">Checked In</p>
            <div className="rounded-full bg-[#00C853]/20 px-3 py-1">
              <span className="font-mono text-sm font-bold text-[#00C853]">{checkedIn}/{total}</span>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#1e2e21]">
            <div className="h-2 rounded-full bg-[#00C853] transition-all" style={{ width: total ? `${(checkedIn / total) * 100}%` : '0%' }} />
          </div>
        </div>
      </div>

      <div className="px-4 space-y-2">
        {(players || []).map((booking: any) => {
          const user = booking.user;
          const isIn = !!booking.checkedInAt;
          return (
            <div key={booking.id} className="flex items-center gap-3 rounded-2xl border border-[#1e2e21] bg-[#111a14] p-3">
              <img src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.firstName}&background=1e2e21&color=00C853`}
                className="h-11 w-11 rounded-full" alt="" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-[#F0FFF4]">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-[#7a9a80]">
                  {booking.teamSide} · {booking.position || 'Any position'}
                  {isIn && <span className="ml-2 text-[#00C853]">· {dayjs(booking.checkedInAt).format('HH:mm')}</span>}
                </p>
              </div>
              {isIn ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853]/20">
                  <UserCheck size={18} color="#00C853" />
                </div>
              ) : (
                <button onClick={() => checkin(booking.id)} className="rounded-xl bg-[#00C853] px-3 py-1.5 text-xs font-bold text-white">
                  Check In
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-[#1e2e21] bg-[#090E0C] p-4">
        <button onClick={() => complete()} disabled={completing}
          className="w-full rounded-2xl bg-[#FFD700] py-4 font-display text-xl font-bold text-[#090E0C] disabled:opacity-60">
          {completing ? 'Completing...' : '🏁 Complete Match & Release Escrow'}
        </button>
      </div>
    </div>
  );
}
