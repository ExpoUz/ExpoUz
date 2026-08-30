'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { pitchAdminApi } from '../../lib/api';
import BottomNav from '../../components/BottomNav';
dayjs.extend(isoWeek);

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#00C853', FULL: '#FFD700', CONFIRMED: '#3b82f6', IN_PROGRESS: '#FF5252', COMPLETED: '#7a9a80', CANCELLED: '#374151',
};

export default function SchedulePage() {
  const router = useRouter();
  const [date, setDate] = useState(dayjs());
  const [selectedPitchId, setSelectedPitchId] = useState<string | null>(null);

  const { data: pitches } = useQuery({ queryKey: ['host-pitches'], queryFn: pitchAdminApi.getPitches });

  const pitchId = selectedPitchId || pitches?.[0]?.id;
  const { data: schedule } = useQuery({
    queryKey: ['schedule', pitchId, date.format('YYYY-MM-DD')],
    queryFn: () => pitchAdminApi.getSchedule(pitchId!, date.format('YYYY-MM-DD')),
    enabled: !!pitchId,
  });

  const hours = Array.from({ length: 16 }, (_, i) => 7 + i); // 7:00 - 22:00

  return (
    <div className="min-h-screen bg-[#090E0C] pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-[#F0FFF4]">Schedule</h1>
        <button onClick={() => router.push('/schedule/create')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853] text-white">
          <Plus size={18} />
        </button>
      </div>

      {/* Pitch selector */}
      {pitches && pitches.length > 1 && (
        <div className="px-4 mb-3 flex gap-2 overflow-x-auto pb-1">
          {pitches.map((p: any) => (
            <button key={p.id} onClick={() => setSelectedPitchId(p.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${pitchId === p.id ? 'bg-[#00C853] text-white' : 'border border-[#1e2e21] text-[#7a9a80]'}`}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Date navigation */}
      <div className="flex items-center gap-4 px-4 mb-4">
        <button onClick={() => setDate(date.subtract(1, 'day'))} className="text-[#7a9a80]"><ChevronLeft size={20} /></button>
        <div className="flex-1 text-center">
          <p className="font-display text-lg font-bold text-[#F0FFF4]">{date.format('dddd, D MMMM')}</p>
          {date.isToday() && <p className="text-xs text-[#00C853]">Today</p>}
        </div>
        <button onClick={() => setDate(date.add(1, 'day'))} className="text-[#7a9a80]"><ChevronRight size={20} /></button>
      </div>

      {/* Hour timeline */}
      <div className="px-4 space-y-1">
        {hours.map((hour) => {
          const match = (schedule || []).find((m: any) => dayjs(m.startTime).hour() === hour);
          const isNow = dayjs().hour() === hour && date.isToday();
          return (
            <div key={hour} className="flex gap-3">
              <span className="w-12 pt-2 text-right text-xs text-[#7a9a80] shrink-0">{hour}:00</span>
              <div className="flex-1">
                {match ? (
                  <button onClick={() => router.push(`/match/${match.id}`)}
                    className="w-full rounded-xl border-l-4 bg-[#111a14] p-3 text-left mb-1" style={{ borderColor: STATUS_COLORS[match.status] }}>
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-sm text-[#F0FFF4]">{match.title}</p>
                      <span className="text-[10px] font-bold" style={{ color: STATUS_COLORS[match.status] }}>{match.status}</span>
                    </div>
                    <p className="text-xs text-[#7a9a80]">{match.currentPlayers}/{match.maxPlayers} players · {dayjs(match.startTime).format('HH:mm')}–{dayjs(match.startTime).add(match.durationMinutes, 'minute').format('HH:mm')}</p>
                  </button>
                ) : (
                  <div className={`h-8 rounded-xl border-l-4 ${isNow ? 'border-[#00C853]/50 bg-[#00C853]/5' : 'border-[#1e2e21]'}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
