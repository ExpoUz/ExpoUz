'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, MapPin, Star, Wifi, Car, Coffee } from 'lucide-react';
import { pitchAdminApi } from '../../lib/api';
import BottomNav from '../../components/BottomNav';

const AMENITY_ICONS: Record<string, any> = { wifi: Wifi, parking: Car, cafe: Coffee };

export default function PitchesPage() {
  const router = useRouter();
  const { data: pitches, isLoading } = useQuery({ queryKey: ['host-pitches'], queryFn: pitchAdminApi.getPitches });

  return (
    <div className="min-h-screen bg-[#090E0C] pb-24">
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-[#F0FFF4]">My Pitches</h1>
        <button onClick={() => router.push('/pitches/new')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853] text-white">
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 space-y-4">
        {isLoading && <p className="text-[#7a9a80] text-sm text-center py-8">Loading pitches...</p>}
        {(pitches || []).map((pitch: any) => (
          <button key={pitch.id} onClick={() => router.push(`/pitches/${pitch.id}`)} className="w-full rounded-2xl overflow-hidden border border-[#1e2e21] bg-[#111a14] text-left">
            <div className="relative h-36">
              <img src={pitch.photos?.[0]} className="h-full w-full object-cover" alt={pitch.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <p className="font-display text-lg font-extrabold text-white">{pitch.name}</p>
              </div>
              {!pitch.isApproved && (
                <div className="absolute top-3 right-3 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">Pending Approval</div>
              )}
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#7a9a80]">
                <MapPin size={12} />
                <span>{pitch.address}, {pitch.district}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-[#FFD700]" fill="#FFD700" />
                  <span className="text-xs font-semibold text-[#F0FFF4]">{pitch.averageRating?.toFixed(1) || '—'}</span>
                  <span className="text-xs text-[#7a9a80]">({pitch.reviewCount || 0})</span>
                </div>
                <span className="font-mono text-sm font-bold text-[#00C853]">
                  {new Intl.NumberFormat('uz-UZ').format(Number(pitch.hourlyRate))} UZS/hr
                </span>
              </div>
              <div className="flex gap-2">
                {(pitch.amenities || []).slice(0, 4).map((a: string) => (
                  <span key={a} className="rounded-full border border-[#1e2e21] px-2 py-0.5 text-[10px] text-[#7a9a80]">{a}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
