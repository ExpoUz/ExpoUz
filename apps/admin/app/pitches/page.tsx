"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingPitches, verifyPitch, getAllPitches, createPitch, getPitchAdmins } from "@/lib/api";
import { useState } from "react";
import dayjs from "dayjs";

export default function PitchesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [showCreate, setShowCreate] = useState(false);

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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pitches</h1>
          <p className="text-gray-500 text-sm mt-1">Review and manage padel courts</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90"
        >
          + Add Pitch
        </button>
      </div>

      {showCreate && (
        <CreatePitchModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["admin-pitches-pending"] });
            qc.invalidateQueries({ queryKey: ["admin-pitches-all"] });
          }}
        />
      )}

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

function CreatePitchModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: owners } = useQuery({ queryKey: ["pitch-admins"], queryFn: getPitchAdmins });
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    ownerId: "",
    addressLine: "",
    district: "Mirzo-Ulugbek",
    city: "Tashkent",
    lat: 41.311,
    lng: 69.28,
    hourlyRate: 180000,
    description: "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () =>
      createPitch({
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng),
        hourlyRate: Number(form.hourlyRate),
      }),
    onSuccess: onCreated,
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? "Could not create the pitch."),
  });

  const valid =
    form.name.trim() && form.ownerId && form.addressLine.trim() && Number(form.hourlyRate) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Add Pitch</h2>
        <div className="space-y-3">
          <FormField label="Name *">
            <input className="inp" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Padel Club Name" />
          </FormField>
          <FormField label="Owner *">
            <select title="Owner" className="inp" value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
              <option value="">Select pitch owner…</option>
              {(owners ?? []).map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.firstName} {o.lastName} ({o.phone})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Address *">
            <input className="inp" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} placeholder="Street, building" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="District">
              <input title="District" className="inp" value={form.district} onChange={(e) => set("district", e.target.value)} />
            </FormField>
            <FormField label="City">
              <input title="City" className="inp" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Lat">
              <input title="Latitude" className="inp" type="number" step="0.0001" value={form.lat} onChange={(e) => set("lat", e.target.value)} />
            </FormField>
            <FormField label="Lng">
              <input title="Longitude" className="inp" type="number" step="0.0001" value={form.lng} onChange={(e) => set("lng", e.target.value)} />
            </FormField>
            <FormField label="Rate (UZS/hr) *">
              <input title="Hourly rate (UZS)" className="inp" type="number" step="10000" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea title="Description" className="inp" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </FormField>
          {(owners ?? []).length === 0 && (
            <p className="text-xs text-amber-600">
              No pitch owners yet — create one under Super → Pitch Owners first.
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || create.isPending}
            onClick={() => create.mutate()}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create Pitch"}
          </button>
        </div>
        <style jsx>{`
          .inp {
            width: 100%;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 8px 12px;
            font-size: 14px;
            outline: none;
          }
          .inp:focus {
            border-color: #00c853;
          }
        `}</style>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
