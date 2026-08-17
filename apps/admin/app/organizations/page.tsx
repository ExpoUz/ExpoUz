"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getOrganizations, createOrganization } from "@/lib/api";

const STATUSES = ["ALL", "ACTIVE", "PENDING", "SUSPENDED", "ARCHIVED"] as const;

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  SUSPENDED: "bg-red-100 text-red-600",
  ARCHIVED: "bg-gray-200 text-gray-500",
};

export default function OrganizationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [showCreate, setShowCreate] = useState(false);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["organizations", status],
    queryFn: () => getOrganizations({ status: status === "ALL" ? undefined : status }),
  });

  const filtered = (orgs ?? []).filter((o: any) => {
    const t = search.toLowerCase();
    return !t || o.name.toLowerCase().includes(t) || o.slug.toLowerCase().includes(t);
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-500 text-sm mt-1">
            {(orgs ?? []).length} partner {orgs?.length === 1 ? "organization" : "organizations"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
        >
          + New organization
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex gap-3 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-56 rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === s ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading &&
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
            No organizations yet. Create your first partner organization.
          </div>
        )}
        {!isLoading &&
          filtered.map((o: any) => (
            <Link
              key={o.id}
              href={`/organizations/${o.id}`}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary/40 hover:shadow transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0 overflow-hidden">
                  {o.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    o.name?.[0] ?? "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 truncate">{o.name}</h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        STATUS_BADGE[o.status] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {o.venues} {o.venues === 1 ? "venue" : "venues"} · {o.staff} staff · {o.players}{" "}
                    players
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-gray-900">{fmtMoney(o.monthRevenue)} UZS</div>
                  <div className="text-xs text-gray-400">this month</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {o.commissionPct}% commission
                    {o.commissionIsDefault && <span className="text-gray-300"> (default)</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
      </div>

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateOrgModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ name: "", slug: "", contactEmail: "", contactPhone: "", address: "", commissionRate: "", playerFeeRate: "", contractStartDate: "", contractEndDate: "", notes: "" });
  const [error, setError] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      createOrganization({
        ...form,
        commissionRate: form.commissionRate === "" ? null : Number(form.commissionRate),
        playerFeeRate: form.playerFeeRate === "" ? null : Number(form.playerFeeRate),
        contractStartDate: form.contractStartDate || undefined,
        contractEndDate: form.contractEndDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Failed to create organization"),
  });

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const input =
    "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  const label = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New organization</h2>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className={label}>Name *</label>
            <input className={input} value={form.name} onChange={set("name")} placeholder="Padel Tashkent Group" />
          </div>
          <div>
            <label className={label}>Slug (blank = from name)</label>
            <input className={input} value={form.slug} onChange={set("slug")} placeholder="padel-tashkent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Contact email</label>
              <input className={input} value={form.contactEmail} onChange={set("contactEmail")} />
            </div>
            <div>
              <label className={label}>Contact phone</label>
              <input className={input} value={form.contactPhone} onChange={set("contactPhone")} />
            </div>
          </div>
          <div>
            <label className={label}>Address</label>
            <input className={input} value={form.address} onChange={set("address")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Commission % (blank = platform default)</label>
              <input className={input} type="number" value={form.commissionRate} onChange={set("commissionRate")} placeholder="e.g. 12" />
            </div>
            <div>
              <label className={label}>Player fee % (blank = default)</label>
              <input className={input} type="number" value={form.playerFeeRate} onChange={set("playerFeeRate")} placeholder="e.g. 5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Contract start</label>
              <input className={input} type="date" value={form.contractStartDate} onChange={set("contractStartDate")} />
            </div>
            <div>
              <label className={label}>Contract end</label>
              <input className={input} type="date" value={form.contractEndDate} onChange={set("contractEndDate")} />
            </div>
          </div>
          <div>
            <label className={label}>Internal notes</label>
            <textarea className={input} rows={2} value={form.notes} onChange={set("notes")} />
          </div>
          <p className="text-xs text-gray-400">
            After creating, open the organization and add its first OWNER on the Staff tab.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => { setError(""); mutate(); }}
            disabled={isPending || !form.name.trim()}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
