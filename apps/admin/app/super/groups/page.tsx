"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPublicGroups, createPublicGroup } from "@/lib/api";

const SPORTS = ["", "FOOTBALL", "PADEL"];

export default function GroupsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", city: "Tashkent", sport: "" });
  const [error, setError] = useState("");

  const { data: groups, isLoading } = useQuery({ queryKey: ["public-groups"], queryFn: getPublicGroups });

  const create = useMutation({
    mutationFn: () =>
      createPublicGroup({
        title: form.title.trim(),
        city: form.city.trim() || undefined,
        sport: form.sport || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-groups"] });
      setForm({ title: "", city: "Tashkent", sport: "" });
      setError("");
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Failed to create group"),
  });

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Chat Groups</h1>
        <p className="text-gray-500 text-sm mt-1">
          Public community groups shown in the player Chat tab. Admin-created only (city / sport based).
        </p>
      </div>

      {/* Create */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">New group</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Tashkent Padel"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">City</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Tashkent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sport</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
              value={form.sport}
              onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>{s || "Any"}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || !form.title.trim()}
          className="bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {create.isPending ? "Creating…" : "Create group"}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">All groups ({(groups ?? []).length})</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-400 text-sm">Loading…</div>
        ) : (groups ?? []).length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">No groups yet. Create one above.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {groups!.map((g: any) => (
              <div key={g.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">💬</div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{g.title}</div>
                  <div className="text-xs text-gray-500">
                    {[g.city, g.sport].filter(Boolean).join(" · ") || "Any"} · {g.memberCount} members
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
