"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { TrendingUp, Percent, Wallet } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { getRevenue, getMatches, formatUZS } from "@/lib/api";
import { PageHeader, StatCard, Spinner } from "@/components/ui";

export default function RevenuePage() {
  const { data: revenue, isLoading } = useQuery({
    queryKey: ["portal-revenue"],
    queryFn: getRevenue,
  });

  const { data: matchData } = useQuery({
    queryKey: ["portal-revenue-matches"],
    queryFn: () => getMatches({ page: 1, limit: 50 }),
  });

  const pieData = revenue
    ? [
        { name: "Net to you", value: Math.max(0, Math.round(revenue.netRevenue)) },
        { name: "Platform commission", value: Math.max(0, Math.round(revenue.commissionDeducted)) },
      ]
    : [];

  // Estimate next payout: upcoming Friday
  const nextFriday = dayjs().day() < 5 ? dayjs().day(5) : dayjs().day(5).add(1, "week");

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader title="Revenue" subtitle="Earnings across all your pitches" />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Gross Revenue"
              value={formatUZS(revenue?.grossRevenue ?? 0)}
              icon={<TrendingUp size={18} />}
              accent="#00C853"
              hint="Held + released transactions"
            />
            <StatCard
              label="Platform Commission"
              value={formatUZS(revenue?.commissionDeducted ?? 0)}
              icon={<Percent size={18} />}
              accent="#F59E0B"
            />
            <StatCard
              label="Net Revenue"
              value={formatUZS(revenue?.netRevenue ?? 0)}
              icon={<Wallet size={18} />}
              accent="#00B0FF"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Split pie */}
            <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
              <div className="px-5 py-4 border-b border-[#E5E7EB]">
                <h2 className="font-semibold text-[#0D1117]">Revenue Split</h2>
              </div>
              <div className="p-4">
                {pieData.every((d) => d.value === 0) ? (
                  <div className="py-16 text-center text-sm text-[#6B7280]">No revenue yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        <Cell fill="#00C853" />
                        <Cell fill="#F59E0B" />
                      </Pie>
                      <Tooltip formatter={(v: any) => formatUZS(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* Payout + commission info */}
            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
                <h2 className="font-semibold text-[#0D1117] mb-1">Next Payout</h2>
                <p className="text-sm text-[#6B7280] mb-3">
                  Payouts are settled weekly on Fridays.
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#0D1117]">
                    {formatUZS(revenue?.netRevenue ?? 0)}
                  </span>
                  <span className="text-sm text-[#6B7280]">est.</span>
                </div>
                <div className="text-xs text-[#00875A] font-medium mt-1">
                  {nextFriday.format("dddd, MMMM D")}
                </div>
              </section>

              <section className="bg-[#0D1117] rounded-2xl p-5 text-white">
                <h2 className="font-semibold mb-1">How commission works</h2>
                <p className="text-sm text-gray-400">
                  ExpoUz deducts a platform commission from each completed booking on your
                  pitches. The rest is yours, paid out on the weekly settlement.
                </p>
              </section>
            </div>
          </div>

          {/* Recent matches as revenue activity */}
          <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm mt-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="font-semibold text-[#0D1117]">Recent Matches</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280] border-b border-[#E5E7EB]">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Pitch</th>
                  <th className="px-5 py-3">Format</th>
                  <th className="px-5 py-3">Players</th>
                  <th className="px-5 py-3">Price / player</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {(matchData?.data ?? []).slice(0, 12).map((m: any) => (
                  <tr key={m.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-5 py-3 text-[#6B7280]">{dayjs(m.startTime).format("MMM D, HH:mm")}</td>
                    <td className="px-5 py-3 font-medium text-[#0D1117]">{m.pitch?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{m.format}</td>
                    <td className="px-5 py-3 text-[#6B7280]">
                      {m.currentPlayers ?? m._count?.bookings ?? 0}/{m.maxPlayers}
                    </td>
                    <td className="px-5 py-3 font-semibold text-[#00875A]">{formatUZS(m.pricePerPlayer)}</td>
                  </tr>
                ))}
                {(matchData?.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#6B7280]">
                      No matches yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
