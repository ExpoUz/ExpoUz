"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingPitches, verifyPitch, getAllPitches } from "@/lib/api";
import { useState } from "react";
import dayjs from "dayjs";

export default function PitchesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ["admin-pitches-pending"],
    queryFn: getPendingPitches,
    enabled: tab === "pending",
  });

  const { data: allPitches, isLoading: allLoading } = useQuery({
    queryKey: ["admin-pitches-all"],
    queryFn: getAllPitches,
    enabled: tab === "all",
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      verifyPitch(id, approved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pitches-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-pitches-all"] });
    },
  });

  const items = tab === "pending" ? pending ?? [] : allPitches ?? [];
  const isLoading = tab === "pending" ? pendingLoading : allLoading;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pitches</h1>
        <p className="text-gray-500 text-sm mt-1">Review and manage football pitches</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {(["pending", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? "bg-primary text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t === "pending" ? "⏳ Pending Review" : "🏟 All Pitches"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading &&
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-32 animate-pulse" />
          ))}

        {!isLoading && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-gray-500">
              {tab === "pending" ? "No pitches pending review" : "No pitches found"}
            </div>
          </div>
        )}

        {!isLoading &&
          items.map((p: any) => (
            <PitchCard
              key={p.id}
              pitch={p}
              showActions={tab === "pending" || !p.isVerified}
              onVerify={(v) => verifyMutation.mutate({ id: p.id, approved: v })}
              isPending={verifyMutation.isPending}
            />
          ))}
      </div>
    </div>
  );
}

function PitchCard({
  pitch,
  showActions,
  onVerify,
  isPending,
}: {
  pitch: any;
  showActions: boolean;
  onVerify: (v: boolean) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Main Info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">
              🏟
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 text-base">{pitch.name}</span>
                {pitch.isVerified ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified</span>
                ) : (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
                )}
              </div>
              <div className="text-sm text-gray-500">{pitch.address}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {pitch.city} · Owner: {pitch.owner?.firstName ?? "—"} {pitch.owner?.lastName ?? ""}
              </div>

              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span>⚽ {pitch.sport ?? "FOOTBALL"}</span>
                <span>👥 Capacity: {pitch.capacity ?? "?"}</span>
                <span>🕐 {pitch.openTime ?? "—"} – {pitch.closeTime ?? "—"}</span>
                <span>💰 {pitch.pricePerHour?.toLocaleString() ?? "?"} UZS/hr</span>
              </div>

              {pitch.amenities && pitch.amenities.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {pitch.amenities.slice(0, 5).map((a: any) => (
                    <span key={a.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {a.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            {showActions && (
              <>
                <button
                  onClick={() => onVerify(true)}
                  disabled={isPending}
                  className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => onVerify(false)}
                  disabled={isPending}
                  className="px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  ✕ Reject
                </button>
              </>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {expanded ? "Hide details ▲" : "View details ▼"}
            </button>
          </div>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600 space-y-1">
            <div><span className="font-medium">Description:</span> {pitch.description ?? "—"}</div>
            <div><span className="font-medium">Lat/Lon:</span> {pitch.latitude ?? "—"} / {pitch.longitude ?? "—"}</div>
            <div><span className="font-medium">Submitted:</span> {dayjs(pitch.createdAt).format("MMMM D, YYYY HH:mm")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
