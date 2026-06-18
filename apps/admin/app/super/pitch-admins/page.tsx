"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPitchAdmins,
  createPitchAdmin,
  deletePitchAdmin,
} from "@/lib/api";
import { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function PitchAdminsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ phone: "", firstName: "", lastName: "" });
  const [formError, setFormError] = useState("");

  const { data: pitchAdmins, isLoading } = useQuery({
    queryKey: ["pitch-admins"],
    queryFn: getPitchAdmins,
  });

  const createMutation = useMutation({
    mutationFn: () => createPitchAdmin({ ...form, phone: `+998${form.phone}` }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitch-admins"] });
      setShowForm(false);
      setForm({ phone: "", firstName: "", lastName: "" });
    },
    onError: (err: any) =>
      setFormError(err?.response?.data?.message ?? "Failed to create pitch owner"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePitchAdmin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pitch-admins"] }),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pitch Owners</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage pitch owner accounts and their facilities.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors"
        >
          + Add Pitch Owner
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Pitch Owner</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">First Name</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Ahmad"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Last Name</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Karimov"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone (without +998)</label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary/30">
                <span className="text-gray-500 text-sm px-3 py-2.5 bg-gray-50 border-r border-gray-200">+998</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  className="flex-1 px-3 py-2.5 text-sm outline-none"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
                  placeholder="90 000 00 00"
                />
              </div>
            </div>
          </div>
          {formError && <p className="text-red-500 text-xs mb-3">{formError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.firstName || form.phone.length < 9}
              className="bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(""); }}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            All Pitch Owners ({(pitchAdmins ?? []).length})
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(pitchAdmins ?? []).map((pa: any) => (
              <div key={pa.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">
                  {pa.firstName?.[0] ?? "P"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {pa.firstName} {pa.lastName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {pa.phone} · {pa._count?.pitches ?? 0} pitches ·{" "}
                    {pa.isOnline ? (
                      <span className="text-green-600">Online</span>
                    ) : (
                      <span>Last seen {dayjs(pa.lastSeen).fromNow()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full font-medium">
                    PITCH OWNER
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${pa.firstName}?`))
                        deleteMutation.mutate(pa.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {(pitchAdmins ?? []).length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">
                No pitch owners yet. Add one above.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
