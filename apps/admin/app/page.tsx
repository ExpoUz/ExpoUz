"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboard, getMatches, getUsers } from "@/lib/api";
import dayjs from "dayjs";

function StatCard({
  title,
  value,
  sub,
  color,
  icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className="text-2xl">{icon}</div>
        {sub && (
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              sub.startsWith("+")
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-500"
            }`}
          >
            {sub}
          </span>
        )}
      </div>
      <div
        className="text-3xl font-extrabold mb-1"
        style={{ color: color ?? "#0D1117" }}
      >
        {value}
      </div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: dashboard, isLoading: dbLoading } = useQuery({
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
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {dayjs().format("dddd, MMMM D, YYYY")} · Platform overview
        </p>
      </div>

      {/* Stat Cards */}
      {dbLoading ? (
        <div className="grid grid-cols-4 gap-5 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatCard
            icon="👥"
            title="Total Users"
            value={(dashboard?.totalUsers ?? 0).toLocaleString()}
            color="#2563EB"
          />
          <StatCard
            icon="🏟"
            title="Verified Pitches"
            value={dashboard?.activePitches ?? dashboard?.totalPitches ?? 0}
            color="#00C853"
          />
          <StatCard
            icon="⚽"
            title="Active Matches"
            value={dashboard?.activeMatches ?? dashboard?.totalMatches ?? 0}
            color="#7C3AED"
          />
          <StatCard
            icon="⏳"
            title="Pending Pitches"
            value={dashboard?.pendingPitches ?? 0}
            color="#F59E0B"
            sub={
              (dashboard?.pendingPitches ?? 0) > 0
                ? `+${dashboard?.pendingPitches} review`
                : undefined
            }
          />
          <StatCard
            icon="📱"
            title="Unverified Phones"
            value={(dashboard?.unverifiedPhoneUsers ?? 0).toLocaleString()}
            color="#00B0FF"
          />
          <StatCard
            icon="⏰"
            title="Venues Missing Hours"
            value={`${dashboard?.venuesMissingHours ?? 0}${dashboard?.activeVenues != null ? ` / ${dashboard.activeVenues}` : ""}`}
            color="#EF4444"
            sub={
              (dashboard?.venuesMissingHours ?? 0) > 0
                ? "no free-slot data"
                : "all set"
            }
          />
        </div>
      )}

      {/* Revenue Row */}
      {(dashboard?.revenueToday || dashboard?.revenueMonth) && (
        <div className="grid grid-cols-3 gap-5 mb-8">
          <StatCard
            icon="💰"
            title="Revenue Today"
            value={`${Number(dashboard?.revenueToday ?? 0).toLocaleString()} UZS`}
            color="#00C853"
          />
          <StatCard
            icon="📋"
            title="Revenue This Month"
            value={`${Number(dashboard?.revenueMonth ?? 0).toLocaleString()} UZS`}
            color="#7C3AED"
          />
          <StatCard
            icon="⚠️"
            title="Failed Transactions"
            value={dashboard?.failedTransactions ?? 0}
            color="#EF4444"
          />
        </div>
      )}

      {/* Sport breakdown */}
      {dashboard?.sportBreakdown && (
        <div className="grid grid-cols-2 gap-5 mb-8">
          <SportBreakdownCard
            icon="⚽"
            title="Football"
            color="#00C853"
            rows={[
              { label: "Matches", value: dashboard.sportBreakdown.football?.matches ?? 0 },
              { label: "Pitches", value: dashboard.sportBreakdown.football?.pitches ?? 0 },
            ]}
          />
          <SportBreakdownCard
            icon="🎾"
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

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Matches */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Matches</h2>
            <a href="/matches" className="text-xs text-primary font-medium hover:underline">
              View all →
            </a>
          </div>
          <div className="divide-y divide-gray-50">
            {topMatches.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No matches yet</div>
            )}
            {topMatches.map((m: any) => (
              <div key={m.id} className="px-6 py-3 flex items-center gap-3">
                <div className="text-xl">⚽</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{m.title}</div>
                  <div className="text-xs text-gray-500">
                    {m.pitch?.name ?? ""} · {dayjs(m.startTime).format("MMM D, HH:mm")}
                  </div>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Users</h2>
            <a href="/users" className="text-xs text-primary font-medium hover:underline">
              View all →
            </a>
          </div>
          <div className="divide-y divide-gray-50">
            {recentUsers.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No users yet</div>
            )}
            {recentUsers.map((u: any) => (
              <div key={u.id} className="px-6 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700">
                  {u.firstName?.[0] ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {u.firstName} {u.lastName}
                  </div>
                  <div className="text-xs text-gray-500">{u.phone}</div>
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
  icon,
  title,
  color,
  rows,
}: {
  icon: string;
  title: string;
  color: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{icon}</span>
        <span className="font-semibold text-gray-900">{title}</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div className="text-2xl font-extrabold" style={{ color }}>
              {r.value.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: "bg-green-100 text-green-700",
    FULL: "bg-red-100 text-red-600",
    CONFIRMED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-purple-100 text-purple-700",
    COMPLETED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-gray-100 text-gray-400 line-through",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    SUPER_ADMIN: "bg-red-100 text-red-700",
    ADMIN: "bg-orange-100 text-orange-700",
    PITCH_OWNER: "bg-purple-100 text-purple-700",
    PLAYER: "bg-green-100 text-green-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[role] ?? "bg-gray-100 text-gray-500"}`}>
      {role.replace("_", " ")}
    </span>
  );
}
