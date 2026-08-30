'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { pitchAdminApi } from '../../../lib/api';

const CITIES = ['Toshkent', 'Samarqand', 'Buxoro', 'Namangan', 'Andijon'];
const DISTRICTS: Record<string, string[]> = {
  Toshkent: ['Yunusobod', 'Mirzo Ulugbek', 'Chilonzor', 'Yakkasaroy', 'Shayxontohur', 'Uchtepa', 'Olmazar'],
};
const AMENITIES: { label: string; value: string }[] = [
  { label: 'Parking', value: 'PARKING' },
  { label: 'Cafe', value: 'CAFE' },
  { label: 'Changing Room', value: 'CHANGING_ROOM' },
  { label: 'Bathroom', value: 'BATHROOM' },
  { label: 'Water Fountain', value: 'WATER_FOUNTAIN' },
  { label: 'Security', value: 'SECURITY' },
  { label: 'Lighting', value: 'LIGHTS' },
];

export default function NewPitchPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', city: 'Toshkent', district: '', address: '', lat: '', lng: '',
    isIndoor: false, surfaceType: 'ARTIFICIAL', sport: 'PADEL',
    hourlyRate: '', description: '',
    amenities: [] as string[], photos: [] as string[],
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => pitchAdminApi.createPitch({ ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), hourlyRate: parseInt(form.hourlyRate) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['host-pitches'] }); router.push('/pitches'); },
  });

  function toggleAmenity(a: string) {
    const arr = form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a];
    setForm({ ...form, amenities: arr });
  }

  return (
    <div className="min-h-screen bg-[#090E0C] pb-32">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => router.back()}><ArrowLeft size={20} color="#7a9a80" /></button>
        <h1 className="font-display text-2xl font-extrabold text-[#F0FFF4]">Add New Pitch</h1>
      </div>
      <div className="px-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Pitch Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Mirzo Sport Arena" className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] focus:border-[#00C853] focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a9a80]">City</label>
            <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4]">
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a9a80]">District</label>
            <input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
              placeholder="District" className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] focus:border-[#00C853] focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Full address" className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] focus:border-[#00C853] focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Latitude</label>
            <input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })}
              placeholder="41.2995" className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] focus:border-[#00C853] focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Longitude</label>
            <input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })}
              placeholder="69.2401" className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] focus:border-[#00C853] focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Hourly Rate (UZS)</label>
          <input type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
            placeholder="500000" className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] focus:border-[#00C853] focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Sport</label>
          <div className="flex gap-2">
            {['PADEL', 'FOOTBALL', 'TENNIS'].map((s) => (
              <button key={s} onClick={() => setForm({ ...form, sport: s })}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${form.sport === s ? 'bg-[#00C853] text-white' : 'border border-[#1e2e21] text-[#7a9a80]'}`}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Surface Type</label>
          <div className="flex gap-2">
            {['ARTIFICIAL', 'NATURAL', 'FUTSAL', 'INDOOR_TURF'].map((s) => (
              <button key={s} onClick={() => setForm({ ...form, surfaceType: s })}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${form.surfaceType === s ? 'bg-[#00C853] text-white' : 'border border-[#1e2e21] text-[#7a9a80]'}`}>
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3">
          <span className="text-sm text-[#F0FFF4]">Indoor Facility</span>
          <button onClick={() => setForm({ ...form, isIndoor: !form.isIndoor })}
            className={`relative h-6 w-11 rounded-full transition-colors ${form.isIndoor ? 'bg-[#00C853]' : 'bg-[#1e2e21]'}`}>
            <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isIndoor ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-[#7a9a80]">Amenities</label>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map(({ label, value }) => (
              <button key={value} onClick={() => toggleAmenity(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${form.amenities.includes(value) ? 'bg-[#00C853] text-white' : 'border border-[#1e2e21] text-[#7a9a80]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Tell players about your facility..." rows={3}
            className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] resize-none focus:border-[#00C853] focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#7a9a80]">Photo URLs (one per line)</label>
          <textarea
            value={form.photos.join('\n')} onChange={(e) => setForm({ ...form, photos: e.target.value.split('\n').filter(Boolean) })}
            placeholder="https://..." rows={3}
            className="w-full rounded-xl border border-[#1e2e21] bg-[#111a14] px-4 py-3 text-sm text-[#F0FFF4] resize-none focus:border-[#00C853] focus:outline-none" />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#1e2e21] bg-[#090E0C] p-4">
        <button onClick={() => mutate()} disabled={isPending || !form.name || !form.hourlyRate}
          className="w-full rounded-2xl bg-[#00C853] py-4 font-display text-xl font-bold text-white disabled:opacity-40">
          {isPending ? 'Submitting...' : '🏟️ Submit for Approval'}
        </button>
      </div>
    </div>
  );
}
