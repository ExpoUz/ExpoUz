"use client";

import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "@/lib/api";
import { useState } from "react";
import dayjs from "dayjs";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-600",
  REFUNDED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const TYPE_COLORS: Record<string, string> = {
  PAYMENT: "text-green-600",
  PAYOUT: "text-blue-600",
  REFUND: "text-yellow-600",
  ESCROW_HOLD: "text-purple-600",
  ESCROW_RELEASE: "text-teal-600",
  PLATFORM_FEE: "text-red-600",
};

export default function TransactionsPage() {
  const { data: txs, isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: getTransactions,
  });

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const STATUSES = ["ALL", "PENDING", "COMPLETED", "FAILED", "REFUNDED", "CANCELLED"];

  const filtered = (txs ?? []).filter((t: any) => {
    const statusMatch = statusFilter === "ALL" || t.status === statusFilter;
    const term = search.toLowerCase();
    const textMatch =
      !term ||
      t.id?.toLowerCase().includes(term) ||
      t.user?.firstName?.toLowerCase().includes(term) ||
      t.user?.phone?.includes(term);
    return statusMatch && textMatch;
  });

  const total = filtered.reduce(
    (acc: any, t: any) =>
      t.status === "COMPLETED" ? acc + Number(t.amount ?? 0) : acc,
    0
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">{(txs ?? []).length} total transactions</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 text-right">
          <div className="text-xs text-gray-500 mb-0.5">Completed Volume (filtered)</div>
          <div className="text-xl font-bold text-green-600">{total.toLocaleString()} UZS</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex gap-3 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search by ID, user name, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Gateway</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading &&
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                  No transactions found
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs text-gray-500">{t.id?.slice(0, 10)}…</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 flex-shrink-0">
                        {t.user?.firstName?.[0] ?? "?"}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-xs">
                          {t.user?.firstName ?? "Unknown"} {t.user?.lastName ?? ""}
                        </div>
                        <div className="text-xs text-gray-400">{t.user?.phone ?? ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-semibold ${TYPE_COLORS[t.type] ?? "text-gray-600"}`}
                    >
                      {t.type?.replace("_", " ") ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {t.gateway ?? "WALLET"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`font-semibold text-sm ${
                        t.status === "COMPLETED" ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {Number(t.amount ?? 0).toLocaleString()} UZS
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {dayjs(t.createdAt).format("MMM D, YYYY HH:mm")}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
