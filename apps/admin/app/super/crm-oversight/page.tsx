"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  getCrmUsage,
  getContactRevealLog,
  getBroadcastLog,
  getVenueReports,
  resolveVenueReport,
  setOwnerCrmFlags,
} from "@/lib/api";

dayjs.extend(relativeTime);

type Tab = "usage" | "reveals" | "broadcasts" | "reports";
const TABS: { key: Tab; label: string }[] = [
  { key: "usage", label: "Owner Usage" },
  { key: "reveals", label: "Contact Reveals" },
  { key: "broadcasts", label: "Broadcasts" },
  { key: "reports", label: "Player Reports" },
];

export default function CrmOversightPage() {
  const [tab, setTab] = useState<Tab>("usage");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Venue CRM Oversight</h1>
        <p className="text-gray-500 text-sm mt-1">
          How venue owners use the customer CRM — reveals, broadcasts, reports, and kill switches.
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-100">
        {TABS.map((tt) => (
          <button
            key={tt.key}
            onClick={() => setTab(tt.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === tt.key ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tt.label}
          </button>
        ))}
      </div>

      {tab === "usage" && <UsageTab />}
      {tab === "reveals" && <RevealsTab />}
      {tab === "broadcasts" && <BroadcastsTab />}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">{children}</div>;
}

function UsageTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["crm-usage"], queryFn: getCrmUsage });

  const flagMut = useMutation({
    mutationFn: ({ ownerId, flags }: { ownerId: string; flags: any }) => setOwnerCrmFlags(ownerId, flags),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-usage"] }),
  });

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100">
            <th className="px-5 py-3">Owner</th>
            <th className="px-5 py-3">Reveals</th>
            <th className="px-5 py-3">Broadcasts</th>
            <th className="px-5 py-3">Recipients</th>
            <th className="px-5 py-3">Open reports</th>
            <th className="px-5 py-3">CRM</th>
            <th className="px-5 py-3">Broadcast</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {(data ?? []).map((o: any) => (
            <tr key={o.ownerId} className={o.openReports > 0 ? "bg-red-50/40" : ""}>
              <td className="px-5 py-3 font-medium text-gray-900">{o.name}</td>
              <td className="px-5 py-3 text-gray-600">{o.reveals}</td>
              <td className="px-5 py-3 text-gray-600">{o.broadcasts}</td>
              <td className="px-5 py-3 text-gray-600">{o.broadcastRecipients}</td>
              <td className="px-5 py-3">
                {o.openReports > 0 ? <span className="text-red-600 font-semibold">{o.openReports}</span> : <span className="text-gray-400">0</span>}
              </td>
              <td className="px-5 py-3">
                <Toggle
                  on={!o.crmDisabled}
                  onLabel="Enabled"
                  offLabel="Disabled"
                  onChange={() => flagMut.mutate({ ownerId: o.ownerId, flags: { crmDisabled: !o.crmDisabled } })}
                />
              </td>
              <td className="px-5 py-3">
                <Toggle
                  on={!o.broadcastDisabled}
                  onLabel="Enabled"
                  offLabel="Disabled"
                  onChange={() => flagMut.mutate({ ownerId: o.ownerId, flags: { broadcastDisabled: !o.broadcastDisabled } })}
                />
              </td>
            </tr>
          ))}
          {(data ?? []).length === 0 && (
            <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No pitch owners yet.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function Toggle({ on, onLabel, offLabel, onChange }: { on: boolean; onLabel: string; offLabel: string; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
        on ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-red-50 text-red-700 hover:bg-red-100"
      }`}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

function RevealsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["crm-reveals"], queryFn: getContactRevealLog });
  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100">
            <th className="px-5 py-3">When</th>
            <th className="px-5 py-3">Owner</th>
            <th className="px-5 py-3">Player</th>
            <th className="px-5 py-3">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {(data ?? []).map((r: any) => (
            <tr key={r.id}>
              <td className="px-5 py-3 text-gray-500">{dayjs(r.createdAt).fromNow()}</td>
              <td className="px-5 py-3 font-medium text-gray-900">{r.ownerName}</td>
              <td className="px-5 py-3 text-gray-700">{r.playerName}</td>
              <td className="px-5 py-3 text-gray-500">{r.reason}</td>
            </tr>
          ))}
          {(data ?? []).length === 0 && (
            <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No contact reveals yet.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function BroadcastsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["crm-broadcasts"], queryFn: getBroadcastLog });
  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100">
            <th className="px-5 py-3">When</th>
            <th className="px-5 py-3">Owner</th>
            <th className="px-5 py-3">Segment</th>
            <th className="px-5 py-3">Recipients</th>
            <th className="px-5 py-3">Message</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {(data ?? []).map((b: any) => (
            <tr key={b.id}>
              <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{dayjs(b.createdAt).fromNow()}</td>
              <td className="px-5 py-3 font-medium text-gray-900">{b.ownerName}</td>
              <td className="px-5 py-3 text-gray-700">{b.segment}</td>
              <td className="px-5 py-3 text-gray-600">{b.recipientCount}</td>
              <td className="px-5 py-3 text-gray-500 max-w-md truncate">{b.message}</td>
            </tr>
          ))}
          {(data ?? []).length === 0 && (
            <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No broadcasts yet.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function ReportsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["crm-reports"], queryFn: () => getVenueReports(true) });
  const resolveMut = useMutation({
    mutationFn: (id: string) => resolveVenueReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-reports"] }),
  });
  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;
  return (
    <Card>
      <div className="divide-y divide-gray-50">
        {(data ?? []).map((r: any) => (
          <div key={r.id} className={`px-5 py-4 flex items-start gap-4 ${r.resolved ? "opacity-50" : ""}`}>
            <div className="flex-1">
              <div className="text-sm text-gray-900">
                <span className="font-medium">{r.playerName}</span> reported <span className="font-medium">{r.ownerName}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">{r.reason}</div>
              <div className="text-xs text-gray-400 mt-1">{dayjs(r.createdAt).fromNow()}</div>
            </div>
            {r.resolved ? (
              <span className="text-xs text-gray-400 font-semibold">Resolved</span>
            ) : (
              <button
                onClick={() => resolveMut.mutate(r.id)}
                disabled={resolveMut.isPending}
                className="text-xs font-semibold text-green-700 border border-green-100 px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50"
              >
                Mark resolved
              </button>
            )}
          </div>
        ))}
        {(data ?? []).length === 0 && (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">No player reports.</div>
        )}
      </div>
    </Card>
  );
}
