"use client";

import { useQuery } from "@tanstack/react-query";
import { getActivityLog, exportActivityLog, type ActivityFilters } from "@/lib/api";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  UserPlus,
  LogIn,
  Pencil,
  PlusCircle,
  CheckCircle2,
  DoorOpen,
  XCircle,
  Receipt,
  CreditCard,
  AlertTriangle,
  Undo2,
  Ticket,
  Send,
  Handshake,
  Star,
  Shield,
  Lock,
  Circle,
  type LucideIcon,
} from "lucide-react";

dayjs.extend(relativeTime);

const CATEGORY_META: Record<string, { Icon: LucideIcon; color: string }> = {
  REGISTERED: { Icon: UserPlus, color: "bg-gray-100 text-gray-600" },
  LOGIN: { Icon: LogIn, color: "bg-gray-100 text-gray-600" },
  PROFILE_UPDATED: { Icon: Pencil, color: "bg-gray-100 text-gray-600" },
  MATCH_CREATED: { Icon: PlusCircle, color: "bg-green-100 text-green-700" },
  MATCH_JOINED: { Icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  MATCH_LEFT: { Icon: DoorOpen, color: "bg-orange-100 text-orange-700" },
  MATCH_CANCELLED: { Icon: XCircle, color: "bg-red-100 text-red-600" },
  PAYMENT_INITIATED: { Icon: Receipt, color: "bg-blue-100 text-blue-700" },
  PAYMENT_COMPLETED: { Icon: CreditCard, color: "bg-green-100 text-green-700" },
  PAYMENT_FAILED: { Icon: AlertTriangle, color: "bg-red-100 text-red-600" },
  PAYMENT_REFUNDED: { Icon: Undo2, color: "bg-blue-100 text-blue-700" },
  BOOKING_CONFIRMED: { Icon: Ticket, color: "bg-green-100 text-green-700" },
  BOOKING_CANCELLED: { Icon: XCircle, color: "bg-red-100 text-red-600" },
  INVITE_SENT: { Icon: Send, color: "bg-blue-100 text-blue-700" },
  INVITE_ACCEPTED: { Icon: Handshake, color: "bg-green-100 text-green-700" },
  RATING_GIVEN: { Icon: Star, color: "bg-yellow-100 text-yellow-700" },
  RATING_RECEIVED: { Icon: Star, color: "bg-yellow-100 text-yellow-700" },
  ADMIN_ACTION: { Icon: Shield, color: "bg-purple-100 text-purple-700" },
};

const CATEGORIES = ["ALL", ...Object.keys(CATEGORY_META)];

const ACTOR_TYPES: { key: string; label: string }[] = [
  { key: "ALL", label: "All actors" },
  { key: "PLAYER", label: "Players" },
  { key: "ORG_STAFF", label: "Partner staff" },
  { key: "SUPERADMIN", label: "Superadmin" },
  { key: "SYSTEM", label: "System" },
];

const ACTOR_BADGE: Record<string, string> = {
  PLAYER: "bg-gray-100 text-gray-600",
  ORG_STAFF: "bg-indigo-100 text-indigo-700",
  SUPERADMIN: "bg-purple-100 text-purple-700",
  SYSTEM: "bg-slate-200 text-slate-600",
};

// Actions that warrant a highlight — reveals, money, bans, force-cancels,
// commission changes, org suspensions (PART 4.2).
const SENSITIVE = /reveal|wallet|adjust|\bban\b|force|cancelled match|commission|suspend|archiv|refund/i;
function isSensitive(a: any): boolean {
  return SENSITIVE.test(`${a.description ?? ""} ${a.action ?? ""}`);
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading…</div>}>
      <ActivityFeed />
    </Suspense>
  );
}

/** Standalone activity feed. Reused for the per-org view via ?orgId=. */
function ActivityFeed() {
  const orgId = useSearchParams().get("orgId") ?? undefined;
  const [category, setCategory] = useState("ALL");
  const [actorType, setActorType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(true);

  const filters: ActivityFilters = {
    orgId,
    category: category === "ALL" ? undefined : category,
    actorType: actorType === "ALL" ? undefined : actorType,
    search: search.trim() || undefined,
    limit: 100,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", filters],
    queryFn: () => getActivityLog(filters),
    refetchInterval: live ? 30000 : false,
  });

  const rows = data?.data ?? [];

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {orgId ? "Organization activity" : "Platform activity"}
          </h1>
          <p className="text-sm text-gray-500">
            {orgId ? "Everything this organization's staff (and admins) have done" : "Live feed across all users"}
            {" · "}
            {data?.total ?? 0} entries · immutable audit trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Live (30s)
          </label>
          <button
            onClick={() => exportActivityLog(filters)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Actor type + search */}
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-3">
        {ACTOR_TYPES.map((a) => (
          <button
            key={a.key}
            onClick={() => setActorType(a.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              actorType === a.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {a.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description / action…"
          className="ml-auto min-w-56 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === c ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {c === "ALL" ? "All" : c.replace(/_/g, " ").toLowerCase()}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {isLoading && <div className="px-5 py-12 text-center text-gray-400 text-sm">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">No activity found.</div>
        )}
        {rows.map((a: any) => {
          const meta = CATEGORY_META[a.category] ?? { Icon: Circle, color: "bg-gray-100 text-gray-600" };
          const Icon = meta.Icon;
          const sensitive = isSensitive(a);
          return (
            <div key={a.id} className={`flex items-center gap-3 px-5 py-3 ${sensitive ? "bg-amber-50/60" : ""}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800 flex items-center gap-2">
                  {sensitive && <Lock size={12} aria-label="Sensitive action" />}
                  <span>{a.description ?? a.action}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {a.actorType && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ACTOR_BADGE[a.actorType] ?? "bg-gray-100 text-gray-500"}`}>
                      {a.actorType.replace("_", " ")}
                    </span>
                  )}
                  {a.user ? (
                    <Link href={`/users/${a.userId}`} className="text-xs text-green-700 hover:underline">
                      {a.user.firstName} {a.user.lastName}
                      {a.user.role ? ` · ${a.user.role}` : ""}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">system</span>
                  )}
                  {a.orgId && !orgId && (
                    <Link href={`/organizations/${a.orgId}`} className="text-xs text-indigo-600 hover:underline">
                      org
                    </Link>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-400 shrink-0" title={dayjs(a.createdAt).format("MMM D, YYYY HH:mm")}>
                {dayjs(a.createdAt).fromNow()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
