"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import {
  getLocations,
  createLocation,
  deleteLocation,
} from "@/lib/api";
import { useState } from "react";

export default function LocationsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", city: "Tashkent", district: "" });
  const [formError, setFormError] = useState("");

  const { data: locations, isLoading } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: getLocations,
  });

  const createMutation = useMutation({
    mutationFn: () => createLocation(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
      setShowForm(false);
      setForm({ name: "", city: "Tashkent", district: "" });
    },
    onError: (err: any) =>
      setFormError(err?.response?.data?.message ?? "Failed to create location"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-locations"] }),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-gray-500 text-sm mt-1">
            City zones and districts used when creating pitches.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors"
        >
          + Add Location
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Location</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Chilanzar"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">City</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Tashkent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">District (optional)</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                placeholder="Chilanzar district"
              />
            </div>
          </div>
          {formError && <p className="text-red-500 text-xs mb-3">{formError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name}
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            All Locations ({(locations ?? []).length})
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(locations ?? []).map((loc: any) => (
              <div key={loc.id} className="px-6 py-3 flex items-center gap-4">
                <MapPin size={20} className="text-gray-400 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">{loc.name}</div>
                  <div className="text-xs text-gray-500">
                    {loc.city}{loc.district ? ` · ${loc.district}` : ""}
                    {" · "}{loc._count?.pitches ?? 0} pitches
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${loc.name}"?`))
                      deleteMutation.mutate(loc.id);
                  }}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
            {(locations ?? []).length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">No locations yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
