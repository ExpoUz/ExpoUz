"use client";

import { useQuery } from "@tanstack/react-query";
import { getUserById } from "@/lib/api";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const CATEGORY_ICON: Record<string, string> = {
  REGISTERED: "👤", LOGIN: "🔑", PROFILE_UPDATED: "✏️", MATCH_CREATED: "⚽",
  MATCH_JOINED: "✅", MATCH_LEFT: "🚪", MATCH_CANCELLED: "❌", PAYMENT_COMPLETED: "💳",
  PAYMENT_REFUNDED: "💰", BOOKING_CONFIRMED: "🎟️", BOOKING_CANCELLED: "❌",
  INVITE_ACCEPTED: "🤝", RATING_GIVEN: "⭐", RATING_RECEIVED: "⭐", ADMIN_ACTION: "🛡️",
};

const TABS = ["Activity", "Bookings", "Transactions"] as const;

function money(v: any) {
  return `${Number(v ?? 0).toLocaleString("en-US")} UZS`;
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Activity");

  const { data: u, isLoading } = useQuery({
    queryKey: ["admin-user", params.id],
    queryFn: () => getUserById(params.id),
  });

  if (isLoading || !u) {
    return <div className="p-6 text-gray-400 text-sm">Loading user…</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-800 mb-4">
        ← Back
      </button>

      {/* User card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center text-xl font-bold overflow-hidden">
          {u.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">
              {u.firstName} {u.lastName}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
              {u.role}
            </span>
            {u.isOnline && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                ● Online
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {u.phone ?? "—"} {u.email ? `· ${u.email}` : ""}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Joined {dayjs(u.createdAt).format("MMM YYYY")} · {u.city ?? "Tashkent"}
            {u.district ? ` · ${u.district}` : ""}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
        <Stat label="ELO" value={u.eloRating ?? "—"} />
        <Stat label="Reliability" value={u.reliabilityScore != null ? `${Math.round(u.reliabilityScore)}%` : "—"} />
        <Stat label="Bookings" value={u.stats?.totalBookings ?? 0} />
        <Stat label="Confirmed" value={u.stats?.confirmedBookings ?? 0} />
        <Stat label="Total Spent" value={money(u.stats?.totalSpent)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Activity" && (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {(u.activityLogs ?? []).length === 0 && (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No activity recorded.</div>
          )}
          {(u.activityLogs ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg">{CATEGORY_ICON[a.category] ?? "•"}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800">{a.description ?? a.action}</div>
                <div className="text-[11px] text-gray-400">{a.category ?? a.action}</div>
              </div>
              <div className="text-xs text-gray-400">{dayjs(a.createdAt).fromNow()}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "Bookings" && (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {(u.bookings ?? []).length === 0 && (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No bookings.</div>
          )}
          {(u.bookings ?? []).map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800 truncate">{b.match?.title ?? "Match"}</div>
                <div className="text-xs text-gray-400">
                  {b.match?.startTime ? dayjs(b.match.startTime).format("MMM D · HH:mm") : ""}
                </div>
              </div>
              <span className="text-xs font-medium text-gray-600">{b.status}</span>
              {b.transaction && <span className="text-xs text-gray-500 w-24 text-right">{money(b.transaction.amount)}</span>}
            </div>
          ))}
        </div>
      )}

      {tab === "Transactions" && (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {(u.transactions ?? []).length === 0 && (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No transactions.</div>
          )}
          {(u.transactions ?? []).map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800">{money(t.amount)}</div>
                <div className="text-xs text-gray-400">{t.gateway} · {dayjs(t.createdAt).format("MMM D, HH:mm")}</div>
              </div>
              <span className="text-xs font-medium text-gray-600">{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <div className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-base font-bold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}
