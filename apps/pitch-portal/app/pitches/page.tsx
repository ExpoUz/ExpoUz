"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Users, CalendarDays, CheckCircle2, Clock, XCircle } from "lucide-react";
import { getPitches, setPitchAvailability, formatUZS } from "@/lib/api";
import { PageHeader, Spinner, EmptyState } from "@/components/ui";
import { OpeningHoursModal } from "@/components/OpeningHoursModal";

function hasHours(p: any): boolean {
  return !!p.openingHours && Object.keys(p.openingHours).length > 0;
}

function VerificationBadge({ pitch }: { pitch: any }) {
  if (pitch.isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00875A]">
        <CheckCircle2 size={14} /> Verified
      </span>
    );
  }
  if (pitch.rejectedReason) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C]" title={pitch.rejectedReason}>
        <XCircle size={14} /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309]">
      <Clock size={14} /> Pending review
    </span>
  );
}

export default function PitchesPage() {
  const qc = useQueryClient();
  const [hoursPitch, setHoursPitch] = useState<any | null>(null);
  const { data: pitches, isLoading } = useQuery({
    queryKey: ["portal-pitches"],
    queryFn: getPitches,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setPitchAvailability(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-pitches"] }),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader title="My Pitches" subtitle="Venues you manage on ExpoUz" />

      {isLoading ? (
        <Spinner />
      ) : (pitches ?? []).length === 0 ? (
        <EmptyState
          title="No pitches yet"
          hint="Contact ExpoUz to register your venue and start hosting matches."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(pitches ?? []).map((p: any) => {
            const photo = p.photos?.[0];
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col"
              >
                <div className="h-36 bg-[#0D1117] relative">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">🏟</div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.isActive
                          ? "bg-[#00C853] text-black"
                          : "bg-black/60 text-white"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-[#0D1117]">{p.name}</h3>
                  </div>
                  <div className="text-xs text-[#6B7280] flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {p.district ?? p.city ?? "—"}
                  </div>

                  <div className="mt-2"><VerificationBadge pitch={p} /></div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-[#6B7280]">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={13} /> {p._count?.matches ?? 0} matches
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} /> {p._count?.followers ?? 0} followers
                    </span>
                  </div>

                  <div className="mt-3 text-sm font-semibold text-[#0D1117]">
                    {formatUZS(p.pricePerHour ?? p.hourlyRate ?? 0)} / hr
                  </div>

                  {/* Opening-hours prompt — needed for the "free courts" filter */}
                  {!hasHours(p) && (
                    <button
                      onClick={() => setHoursPitch(p)}
                      className="mt-3 w-full py-2 rounded-xl text-xs font-semibold bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]"
                    >
                      ⏰ Add opening hours so players can find your free slots
                    </button>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setHoursPitch(p)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] inline-flex items-center justify-center gap-1"
                    >
                      <Clock size={14} /> {hasHours(p) ? "Edit hours" : "Set hours"}
                    </button>
                    <button
                      onClick={() => toggle.mutate({ id: p.id, isActive: !p.isActive })}
                      disabled={toggle.isPending}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                        p.isActive
                          ? "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"
                          : "bg-[#00C853] text-black hover:bg-[#00b34a]"
                      }`}
                    >
                      {p.isActive ? "Set inactive" : "Set active"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hoursPitch && <OpeningHoursModal pitch={hoursPitch} onClose={() => setHoursPitch(null)} />}
    </div>
  );
}
