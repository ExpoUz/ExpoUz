"use client";

import { useQuery } from "@tanstack/react-query";
import { getActivityLog } from "@/lib/api";
import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  REGISTERED: { icon: "👤", color: "bg-gray-100 text-gray-600" },
  LOGIN: { icon: "🔑", color: "bg-gray-100 text-gray-600" },
  PROFILE_UPDATED: { icon: "✏️", color: "bg-gray-100 text-gray-600" },
  MATCH_CREATED: { icon: "⚽", color: "bg-green-100 text-green-700" },
  MATCH_JOINED: { icon: "✅", color: "bg-green-100 text-green-700" },
  MATCH_LEFT: { icon: "🚪", color: "bg-orange-100 text-orange-700" },
  MATCH_CANCELLED: { icon: "❌", color: "bg-red-100 text-red-600" },
  PAYMENT_INITIATED: { icon: "🧾", color: "bg-blue-100 text-blue-700" },
  PAYMENT_COMPLETED: { icon: "💳", color: "bg-green-100 text-green-700" },
  PAYMENT_FAILED: { icon: "⚠️", color: "bg-red-100 text-red-600" },
  PAYMENT_REFUNDED: { icon: "💰", color: "bg-blue-100 text-blue-700" },
  BOOKING_CONFIRMED: { icon: "🎟️", color: "bg-green-100 text-green-700" },
  BOOKING_CANCELLED: { icon: "❌", color: "bg-red-100 text-red-600" },
  INVITE_SENT: { icon: "📤", color: "bg-blue-100 text-blue-700" },
  INVITE_ACCEPTED: { icon: "🤝", color: "bg-green-100 text-green-700" },
  RATING_GIVEN: { icon: "⭐", color: "bg-yellow-100 text-yellow-700" },
  RATING_RECEIVED: { icon: "⭐", color: "bg-yellow-100 text-yellow-700" },
  ADMIN_ACTION: { icon: "🛡️", color: "bg-purple-100 text-purple-700" },
};

const CATEGORIES = ["ALL", ...Object.keys(CATEGORY_META)];

export default function ActivityPage() {
  const [category, setCategory] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", category],
    queryFn: () => getActivityLog({ category: category === "ALL" ? undefined : category, limit: 100 }),
    refetchInterval: 30000,
  });

  const rows = data?.data ?? [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Platform Activity</h1>
      <p className="text-sm text-gray-500 mb-5">Live feed across all users · refreshes every 30s</p>

      <div className="flex flex-wrap gap-2 mb-5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === c ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {c === "ALL" ? "All" : `${CATEGORY_META[c]?.icon ?? ""} ${c.replace(/_/g, " ").toLowerCase()}`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {isLoading && <div className="px-5 py-12 text-center text-gray-400 text-sm">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">No activity found.</div>
        )}
        {rows.map((a: any) => {
          const meta = CATEGORY_META[a.category] ?? { icon: "•", color: "bg-gray-100 text-gray-600" };
          return (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${meta.color}`}>
                {meta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800">
                  {a.description ?? a.action}
                </div>
                {a.user && (
                  <Link
                    href={`/users/${a.userId}`}
                    className="text-xs text-green-700 hover:underline"
                  >
                    {a.user.firstName} {a.user.lastName}
                    {a.user.role ? ` · ${a.user.role}` : ""}
                  </Link>
                )}
              </div>
              <div className="text-xs text-gray-400 shrink-0">{dayjs(a.createdAt).fromNow()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
