"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingPitches, verifyPitch, getAllPitches, createPitch, getPitchAdmins, getVenueAdmins, assignVenueAdmin, revokeVenueAdmin } from "@/lib/api";
import { useState } from "react";
import dayjs from "dayjs";
import {
  Building2,
  CheckCircle2,
  Check,
  X,
  Home,
  Sun,
  Sprout,
  Users,
  Wallet,
  ChevronDown,
  ChevronUp,
  UserCog,
} from "lucide-react";
import { useSportFilter, sportParam } from "@/lib/sport-store";

export default function PitchesPage() {
  const qc = useQueryClient();
  const sport = useSportFilter();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [showCreate, setShowCreate] = useState(false);

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ["admin-pitches-pending"],
    queryFn: getPendingPitches,
    enabled: tab === "pending",
  });

  const { data: allPitches, isLoading: allLoading } = useQuery({
    queryKey: ["admin-pitches-all", sport],
    queryFn: () => getAllPitches({ sport: sportParam(sport) }),
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
          <h1 className="text-2xl font-bold text-gray-900">
            {sport === "PADEL" ? "Padel Courts" : sport === "FOOTBALL" ? "Football Pitches" : "Pitches & Courts"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Review and manage football pitches and padel courts
          </p>
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
            {t === "pending" ? "Pending Review" : "All Pitches"}
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
            <div className="flex justify-center mb-3 text-green-500">
              <CheckCircle2 size={40} />
            </div>
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
  const [showAdmins, setShowAdmins] = useState(false);
  const isPadel = pitch.sport === "PADEL";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Main Info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 text-base">{pitch.name}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {isPadel ? "Padel" : "Football"}
                </span>
                {pitch.isVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><Check size={12} /> Verified</span>
                ) : (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
                )}
              </div>
              <div className="text-sm text-gray-500">{pitch.addressLine}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {pitch.district ? `${pitch.district}, ` : ""}{pitch.city} · Owner: {pitch.owner?.firstName ?? "—"} {pitch.owner?.lastName ?? ""}
              </div>

              <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                {isPadel ? (
                  <>
                    <span className="inline-flex items-center gap-1"><Sprout size={13} /> {pitch.courtType ?? "—"}</span>
                    <span className="inline-flex items-center gap-1">
                      {pitch.isCovered ? <><Home size={13} /> Covered</> : <><Sun size={13} /> Outdoor</>}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1"><Sprout size={13} /> {pitch.surfaceType ?? "—"}</span>
                    <span className="inline-flex items-center gap-1">
                      {pitch.isIndoor ? <><Home size={13} /> Indoor</> : <><Sun size={13} /> Outdoor</>}
                    </span>
                    <span className="inline-flex items-center gap-1"><Users size={13} /> {pitch.pitchSize ?? "—"}</span>
                  </>
                )}
                <span className="inline-flex items-center gap-1"><Wallet size={13} /> {Number(pitch.hourlyRate ?? 0).toLocaleString()} UZS/hr</span>
              </div>

              {pitch.amenities && pitch.amenities.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {pitch.amenities.slice(0, 5).map((a: any) => (
                    <span key={a.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {a.type}
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
                  className="inline-flex items-center gap-1 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <Check size={13} /> Approve
                </button>
                <button
                  onClick={() => onVerify(false)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <X size={13} /> Reject
                </button>
              </>
            )}
            <button
              onClick={() => setShowAdmins(true)}
              className="inline-flex items-center gap-1 px-4 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <UserCog size={13} /> Admins
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              {expanded ? <>Hide details <ChevronUp size={13} /></> : <>View details <ChevronDown size={13} /></>}
            </button>
          </div>
        </div>

        {showAdmins && (
          <ManageVenueAdminsModal pitch={pitch} onClose={() => setShowAdmins(false)} />
        )}

        {/* Expanded */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600 space-y-1">
            <div><span className="font-medium">Description:</span> {pitch.description ?? "—"}</div>
            <div><span className="font-medium">Lat/Lon:</span> {pitch.lat ?? "—"} / {pitch.lng ?? "—"}</div>
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
  const sportFilter = useSportFilter();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    ownerId: "",
    addressLine: "",
    district: "Mirzo-Ulugbek",
    city: "Tashkent",
    // Required on the API — default to the current sport filter when one is active,
    // otherwise PADEL. The admin must still see and confirm it below.
    sport: sportFilter === "FOOTBALL" ? "FOOTBALL" : "PADEL",
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
          <FormField label="Sport *">
            <div className="flex gap-2">
              {(["PADEL", "FOOTBALL", "TENNIS"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("sport", s)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    form.sport === s ? "bg-primary text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
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

// PART 3 — assign/revoke venue admins for a single venue. Users must already be
// members of the venue's organization (the API enforces this).
function ManageVenueAdminsModal({ pitch, onClose }: { pitch: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const { data: admins } = useQuery({
    queryKey: ["venue-admins", pitch.id],
    queryFn: () => getVenueAdmins(pitch.id),
  });
  const { data: candidates } = useQuery({ queryKey: ["pitch-admins"], queryFn: getPitchAdmins });

  const refresh = () => qc.invalidateQueries({ queryKey: ["venue-admins", pitch.id] });

  const assign = useMutation({
    mutationFn: (userId: string) => assignVenueAdmin(pitch.id, userId),
    onSuccess: () => { setError(""); refresh(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Could not assign."),
  });
  const revoke = useMutation({
    mutationFn: (assignmentId: string) => revokeVenueAdmin(assignmentId),
    onSuccess: refresh,
  });

  const assignedUserIds = new Set((admins ?? []).map((a: any) => a.user?.id));
  const filtered = (candidates ?? []).filter((u: any) => {
    if (assignedUserIds.has(u.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${u.firstName} ${u.lastName} ${u.phone}`.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Venue Admins</h2>
        <p className="text-xs text-gray-500 mb-4">{pitch.name}</p>

        <div className="mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Assigned</h3>
          {(admins ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No admins assigned — this venue is org-wide.</p>
          ) : (
            <div className="space-y-2">
              {(admins ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2">
                  <span className="text-sm text-gray-800">
                    {a.user?.firstName} {a.user?.lastName}
                    <span className="text-xs text-gray-400 ml-2">{a.user?.phone}</span>
                  </span>
                  <button
                    onClick={() => revoke.mutate(a.id)}
                    disabled={revoke.isPending}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Assign a user</h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pitch admins…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary mb-2"
          />
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400">No matching users.</p>
            ) : (
              filtered.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => assign.mutate(u.id)}
                  disabled={assign.isPending}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="text-sm text-gray-800">
                    {u.firstName} {u.lastName}
                    <span className="text-xs text-gray-400 ml-2">{u.phone}</span>
                  </span>
                  <span className="text-xs font-semibold text-primary">+ Assign</span>
                </button>
              ))
            )}
          </div>
        </div>

        <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          Done
        </button>
      </div>
    </div>
  );
}
