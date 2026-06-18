"use client";

import { useQuery } from "@tanstack/react-query";
import { getRevenue, getPadelAnalytics } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import dayjs from "dayjs";

export default function AnalyticsPage() {
  const { data: dailyData, isLoading } = useQuery({
    queryKey: ["admin-revenue", "month"],
    queryFn: () => getRevenue("month"),
  });

  const { data: yearlyData } = useQuery({
    queryKey: ["admin-revenue", "year"],
    queryFn: () => getRevenue("year"),
  });

  const { data: padel } = useQuery({
    queryKey: ["admin-padel-analytics"],
    queryFn: getPadelAnalytics,
  });

  const daily: any[] = dailyData ?? [];
  const monthly: any[] = yearlyData ?? [];
  const totalRevenue = daily.reduce((s: number, d: any) => s + Number(d.revenue ?? 0), 0);
  const totalBookings = daily.reduce((s: number, d: any) => s + Number(d.bookings ?? 0), 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Platform revenue and growth metrics</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <MetricCard
          title="Total Revenue (this month)"
          value={`${totalRevenue.toLocaleString()} UZS`}
          icon="💰"
          color="#00C853"
          loading={isLoading}
        />
        <MetricCard
          title="Transactions (this month)"
          value={totalBookings}
          icon="✅"
          color="#2563EB"
          loading={isLoading}
        />
        <MetricCard
          title="Avg per Transaction"
          value={totalBookings > 0 ? `${Math.round(totalRevenue / totalBookings).toLocaleString()} UZS` : "—"}
          icon="📊"
          color="#7C3AED"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      {daily.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Daily Revenue (Last 30 days)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickFormatter={(v) => dayjs(v).format("MMM D")}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: any) => [`${Number(v).toLocaleString()} UZS`, "Revenue"]}
                labelFormatter={(l) => dayjs(l).format("MMMM D, YYYY")}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#00C853"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {monthly.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickFormatter={(v) => dayjs(v).format("MMM YY")}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: any) => [`${Number(v).toLocaleString()} UZS`, "Revenue"]}
              />
              <Bar dataKey="revenue" fill="#00C853" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Padel — level distribution + match-type split */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">🎾 Padel Insights</h2>
        <p className="text-gray-500 text-sm mb-4">
          {padel?.totalAssessed ?? 0} rated players · {(padel?.matchTypeSplit?.casual ?? 0) + (padel?.matchTypeSplit?.competitive ?? 0)} padel matches
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Level Distribution (0.0 – 7.0)</h3>
            {(padel?.distribution ?? []).some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={padel?.distribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="band" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                  <Tooltip formatter={(v: any) => [`${v} players`, "Count"]} />
                  <Bar dataKey="count" fill="#00B0FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-gray-400">
                No rated padel players yet
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Casual vs Competitive</h3>
            <div className="space-y-4">
              <SplitRow
                label="⚔️ Competitive"
                value={padel?.matchTypeSplit?.competitive ?? 0}
                total={(padel?.matchTypeSplit?.casual ?? 0) + (padel?.matchTypeSplit?.competitive ?? 0)}
                color="#EF4444"
              />
              <SplitRow
                label="😎 Casual"
                value={padel?.matchTypeSplit?.casual ?? 0}
                total={(padel?.matchTypeSplit?.casual ?? 0) + (padel?.matchTypeSplit?.competitive ?? 0)}
                color="#00B0FF"
              />
            </div>
          </div>
        </div>
      </div>

      {!isLoading && daily.length === 0 && monthly.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center mt-6">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-gray-500">No revenue data yet</div>
        </div>
      )}
    </div>
  );
}

function SplitRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="text-gray-500">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {loading ? (
        <div className="h-16 bg-gray-100 rounded animate-pulse" />
      ) : (
        <>
          <div className="text-2xl mb-3">{icon}</div>
          <div className="text-2xl font-bold mb-1" style={{ color }}>
            {value}
          </div>
          <div className="text-sm text-gray-500">{title}</div>
        </>
      )}
    </div>
  );
}
