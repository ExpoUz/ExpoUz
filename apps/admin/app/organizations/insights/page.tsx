"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getOrganizationsInsights } from "@/lib/api";

const STAGES = ["LEAD", "CONTACTED", "DEMO", "NEGOTIATING", "ACTIVE", "CHURNED"];
const FLAG_BADGE: Record<string, string> = {
  AT_RISK: "bg-red-100 text-red-600",
  DORMANT: "bg-gray-200 text-gray-600",
  RENEWAL_DUE: "bg-amber-100 text-amber-700",
};

function money(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n || 0));
}

function trend(t: string) {
  if (t === "up") return <span className="text-green-600">▲</span>;
  if (t === "down") return <span className="text-red-500">▼</span>;
  return <span className="text-gray-300">—</span>;
}

export default function OrganizationsInsightsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["org-insights"], queryFn: getOrganizationsInsights });

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!data) return <div className="p-8 text-gray-400">No data</div>;

  return (
    <div className="p-8">
      <Link href="/organizations" className="text-sm text-gray-500 hover:text-primary">
        ← Organizations
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-6">Portfolio insights</h1>

      {/* Onboarding funnel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <h3 className="font-bold text-gray-900 mb-3">Onboarding funnel</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {STAGES.map((s) => (
            <div key={s} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{data.onboardingFunnel[s] ?? 0}</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs attention */}
        <Panel title={`At risk (${data.atRisk.length})`}>
          {data.atRisk.length === 0 && <Empty>No partners are at risk.</Empty>}
          {data.atRisk.map((o: any) => (
            <OrgRow key={o.id} o={o}>
              <span className="text-xs text-red-500">bookings {o.bookingsPrev30}→{o.bookingsLast30}</span>
            </OrgRow>
          ))}
        </Panel>

        <Panel title={`Renewals due (${data.renewalsDue.length})`}>
          {data.renewalsDue.length === 0 && <Empty>No contracts renewing in the next 30 days.</Empty>}
          {data.renewalsDue.map((o: any) => (
            <OrgRow key={o.id} o={o}>
              <span className="text-xs text-amber-600">ends {dayjs(o.contractEndDate).format("MMM D")}</span>
            </OrgRow>
          ))}
        </Panel>

        <Panel title={`Dormant (${data.dormant.length})`}>
          {data.dormant.length === 0 && <Empty>Everyone's been active recently.</Empty>}
          {data.dormant.map((o: any) => (
            <OrgRow key={o.id} o={o}>
              <span className="text-xs text-gray-400">
                {o.lastActivityAt ? `last ${dayjs(o.lastActivityAt).format("MMM D")}` : "no activity"}
              </span>
            </OrgRow>
          ))}
        </Panel>

        {/* Revenue leaderboard */}
        <Panel title="Revenue (last 30 days)">
          {data.revenueByOrg.map((o: any) => (
            <OrgRow key={o.id} o={o}>
              <span className="text-sm font-semibold text-gray-900">
                {money(o.revenueLast30)} {trend(o.revenueTrend)}
              </span>
            </OrgRow>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 font-bold text-gray-900">{title}</div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-6 text-center text-sm text-gray-400">{children}</div>;
}

function OrgRow({ o, children }: { o: any; children: React.ReactNode }) {
  return (
    <Link href={`/organizations/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0 overflow-hidden">
        {o.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          o.name?.[0] ?? "?"
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{o.name}</div>
        <div className="flex gap-1 mt-0.5">
          {(o.flags ?? []).map((f: string) => (
            <span key={f} className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${FLAG_BADGE[f] ?? "bg-gray-100 text-gray-500"}`}>
              {f.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right flex-shrink-0">{children}</div>
    </Link>
  );
}
