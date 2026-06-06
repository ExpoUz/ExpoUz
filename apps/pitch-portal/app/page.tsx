"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Building2, CalendarDays, Users, Wallet } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getDashboard, getSchedule, formatUZS } from "@/lib/api";
import { PageHeader, StatCard, Spinner, EmptyState, StatusPill } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["portal-dashboard"],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  });

  // Today's schedule
  const todayStart = dayjs().startOf("day").toISOString();
  const todayEnd = dayjs().endOf("day").toISOString();
  const { data: todaySchedule } = useQuery({
    queryKey: ["portal-today-schedule"],
    queryFn: () => getSchedule(todayStart, todayEnd),
  });

  // Last 7 days schedule → bookings per day chart
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();
  const { data: weekSchedule } = useQuery({
    queryKey: ["portal-week-schedule"],
    queryFn: () => getSchedule(weekStart, todayEnd),
  });

  const chartData = buildLast7Days(weekSchedule ?? []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title={`Welcome${user?.firstName ? `, ${user.firstName}` : ""}`}
        subtitle={`${dayjs().format("dddd, MMMM D YYYY")} · ${stats?.totalPitches ?? 0} pitch${
          (stats?.totalPitches ?? 0) === 1 ? "" : "es"
        } registered`}
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="My Pitches"
              value={stats?.totalPitches ?? 0}
              icon={<Building2 size={18} />}
              accent="#00C853"
            />
            <StatCard
              label="Matches This Month"
              value={stats?.matchesThisMonth ?? 0}
              icon={<CalendarDays size={18} />}
              accent="#00B0FF"
            />
            <StatCard
              label="Unique Players"
              value={stats?.uniquePlayers ?? 0}
              icon={<Users size={18} />}
              accent="#8B5CF6"
            />
            <StatCard
              label="Revenue (held + released)"
              value={formatUZS(stats?.totalRevenue ?? 0)}
              icon={<Wallet size={18} />}
              accent="#F59E0B"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's schedule */}
            <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
                <h2 className="font-semibold text-[#0D1117]">Today&apos;s Schedule</h2>
                <span className="text-xs text-[#6B7280]">{todaySchedule?.length ?? 0} bookings</span>
              </div>
              <div className="divide-y divide-[#F3F4F6] max-h-[360px] overflow-y-auto">
                {(todaySchedule ?? []).length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#6B7280]">No bookings today.</div>
                ) : (
                  (todaySchedule ?? []).map((b: any) => (
                    <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="text-sm font-semibold text-[#00875A] w-14 shrink-0">
                        {dayjs(b.match?.startTime).format("HH:mm")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#0D1117] truncate">
                          {b.match?.pitch?.name ?? "Pitch"} · {b.match?.format ?? ""}
                        </div>
                        <div className="text-xs text-[#6B7280] truncate">
                          {b.user?.firstName} {b.user?.lastName}
                        </div>
                      </div>
                      <StatusPill status={b.status} />
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Last 7 days bookings */}
            <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
              <div className="px-5 py-4 border-b border-[#E5E7EB]">
                <h2 className="font-semibold text-[#0D1117]">Bookings — Last 7 Days</h2>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 13 }}
                    />
                    <Bar dataKey="bookings" fill="#00C853" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function buildLast7Days(schedule: any[]) {
  const days: { key: string; label: string; bookings: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = dayjs().subtract(i, "day");
    days.push({ key: d.format("YYYY-MM-DD"), label: d.format("ddd"), bookings: 0 });
  }
  const index = new Map(days.map((d) => [d.key, d]));
  for (const b of schedule) {
    const key = dayjs(b.match?.startTime).format("YYYY-MM-DD");
    const bucket = index.get(key);
    if (bucket) bucket.bookings += 1;
  }
  return days;
}
