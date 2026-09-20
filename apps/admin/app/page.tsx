"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  Building2,
  Activity,
  Clock,
  Phone,
  CalendarClock,
  Wallet,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { StatCard, PageHeader, EmptyState, StatusPill } from "@expouz/ui";
import { getDashboard, getMatches, getUsers } from "@/lib/api";
import dayjs from "dayjs";

export default function DashboardPage() {
  const { data: dashboard, isLoading: dbLoading, isError } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getDashboard,
  });

  const { data: recentMatches } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: () => getMatches(),
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getUsers(),
  });

  const topMatches = (recentMatches ?? []).slice(0, 8);
  const recentUsers = (users ?? []).slice(0, 8);

  return (
    <div className="p-8">
      <PageHeader
        title="Dashboard"
        subtitle={`${dayjs().format("dddd, MMMM D, YYYY")} · Platform overview`}
      />

      {isError ? (
        <EmptyState
          title="Couldn't load the dashboard"
          hint="Check your connection and try again."
        />
      ) : dbLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={<Users size={18} />}
            label="Total users"
            value={(dashboard?.totalUsers ?? 0).toLocaleString()}
            accent="#2563EB"
          />
          <StatCard
            icon={<Building2 size={18} />}
            label="Verified pitches"
            value={dashboard?.activePitches ?? dashboard?.totalPitches ?? 0}
            accent="#00C853"
          />
          <StatCard
            icon={<Activity size={18} />}
            label="Active matches"
            value={dashboard?.activeMatches ?? dashboard?.totalMatches ?? 0}
            accent="#7C3AED"
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Pending pitches"
            value={dashboard?.pendingPitches ?? 0}
            accent="#F59E0B"
            delta={
              (dashboard?.pendingPitches ?? 0) > 0
                ? `+${dashboard?.pendingPitches} review`
                : undefined
            }
          />
          <StatCard
            icon={<Phone size={18} />}
            label="Unverified phones"
            value={(dashboard?.unverifiedPhoneUsers ?? 0).toLocaleString()}
            accent="#00B0FF"
          />
          <StatCard
            icon={<CalendarClock size={18} />}
            label="Venues missing hours"
            value={`${dashboard?.venuesMissingHours ?? 0}${dashboard?.activeVenues != null ? ` / ${dashboard.activeVenues}` : ""}`}
            accent="#EF4444"
            hint={
              (dashboard?.venuesMissingHours ?? 0) > 0
                ? "no free-slot data"
                : "all set"
            }
          />
        </div>
      )}

      {/* Revenue row */}
      {(dashboard?.revenueToday || dashboard?.revenueMonth) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={<Wallet size={18} />}
            label="Revenue today"
            value={`${Number(dashboard?.revenueToday ?? 0).toLocaleString()} UZS`}
            accent="#00C853"
          />
          <StatCard
            icon={<TrendingUp size={18} />}
            label="Revenue this month"
            value={`${Number(dashboard?.revenueMonth ?? 0).toLocaleString()} UZS`}
            accent="#7C3AED"
          />
          <StatCard
            icon={<AlertTriangle size={18} />}
            label="Failed transactions"
            value={dashboard?.failedTransactions ?? 0}
            accent="#EF4444"
          />
        </div>
      )}

      {/* Sport breakdown */}
      {dashboard?.sportBreakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <SportBreakdownCard
            title="Football"
            color="#00C853"
            rows={[
              { label: "Matches", value: dashboard.sportBreakdown.football?.matches ?? 0 },
              { label: "Pitches", value: dashboard.sportBreakdown.football?.pitches ?? 0 },
            ]}
          />
          <SportBreakdownCard
            title="Padel"
            color="#00B0FF"
            rows={[
              { label: "Matches", value: dashboard.sportBreakdown.padel?.matches ?? 0 },
              { label: "Courts", value: dashboard.sportBreakdown.padel?.pitches ?? 0 },
              { label: "Rated players", value: dashboard.sportBreakdown.padel?.assessedPlayers ?? 0 },
            ]}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent matches */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="font-semibold text-[#0D1117]">Recent matches</h2>
            <Link href="/matches" className="inline-flex items-center gap-0.5 text-xs text-[#00875A] font-medium hover:underline">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {topMatches.length === 0 && (
              <div className="px-6 py-8 text-center text-[#6B7280] text-sm">No matches yet</div>
            )}
            {topMatches.map((m: any) => (
              <div key={m.id} className="px-6 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#0D1117] truncate">{m.title}</div>
                  <div className="text-xs text-[#6B7280]">
                    {m.pitch?.name ?? ""} · {dayjs(m.startTime).format("MMM D, HH:mm")}
                  </div>
                </div>
                <StatusPill status={m.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent users */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="font-semibold text-[#0D1117]">Recent users</h2>
            <Link href="/users" className="inline-flex items-center gap-0.5 text-xs text-[#00875A] font-medium hover:underline">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {recentUsers.length === 0 && (
              <div className="px-6 py-8 text-center text-[#6B7280] text-sm">No users yet</div>
            )}
            {recentUsers.map((u: any) => (
              <div key={u.id} className="px-6 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00C853]/15 flex items-center justify-center text-sm font-bold text-[#00875A]">
                  {u.firstName?.[0] ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#0D1117]">
                    {u.firstName} {u.lastName}
                  </div>
                  <div className="text-xs text-[#6B7280]">{u.phone}</div>
                </div>
                <RoleBadge role={u.role} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SportBreakdownCard({
  title,
  color,
  rows,
}: {
  title: string;
  color: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E5E7EB]">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="font-semibold text-[#0D1117]">{title}</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div className="text-2xl font-extrabold" style={{ color }}>
              {r.value.toLocaleString()}
            </div>
            <div className="text-xs text-[#6B7280]">{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    SUPER_ADMIN: "bg-[#EF4444]/15 text-[#B91C1C]",
    ADMIN: "bg-[#F59E0B]/15 text-[#B45309]",
    PITCH_OWNER: "bg-[#8B5CF6]/15 text-[#6D28D9]",
    PLAYER: "bg-[#00C853]/15 text-[#00875A]",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[role] ?? "bg-[#6B7280]/15 text-[#374151]"}`}>
      {role.replace("_", " ")}
    </span>
  );
}
