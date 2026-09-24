"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  BarChart3,
  Megaphone,
  Wallet,
  UserCog,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n, LANGS } from "@/lib/i18n";
import { getPortalContext, type OrgRole } from "@/lib/api";
import { SIMPLE_MODE } from "@/lib/flags";

// Which org roles may see each nav item. STAFF is limited to schedule + check-in.
// hideInSimple: dropped from the nav when SIMPLE_MODE is on (default). The core
// loop keeps Today (dashboard), Schedule and Settings (pitches). The routes still
// exist and return when NEXT_PUBLIC_SIMPLE_MODE=false.
const NAV_ITEMS: { href: string; key: string; Icon: LucideIcon; roles: OrgRole[]; hideInSimple?: boolean }[] = [
  { href: "/", key: "nav.dashboard", Icon: LayoutDashboard, roles: ["OWNER", "MANAGER", "STAFF"] },
  { href: "/schedule", key: "nav.schedule", Icon: CalendarDays, roles: ["OWNER", "MANAGER", "STAFF"] },
  { href: "/pitches", key: "nav.pitches", Icon: Building2, roles: ["OWNER", "MANAGER"] },
  { href: "/players", key: "nav.players", Icon: Users, roles: ["OWNER", "MANAGER"], hideInSimple: true },
  { href: "/insights", key: "nav.insights", Icon: BarChart3, roles: ["OWNER", "MANAGER"], hideInSimple: true },
  { href: "/broadcast", key: "nav.broadcast", Icon: Megaphone, roles: ["OWNER", "MANAGER"], hideInSimple: true },
  { href: "/revenue", key: "nav.revenue", Icon: Wallet, roles: ["OWNER", "MANAGER"], hideInSimple: true },
  { href: "/staff", key: "nav.staff", Icon: UserCog, roles: ["OWNER"], hideInSimple: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();

  // Org identity + role drive the panel branding and which nav items appear.
  const { data: ctx } = useQuery({ queryKey: ["portal-context"], queryFn: getPortalContext });
  const role: OrgRole = ctx?.role ?? "OWNER";
  const items = NAV_ITEMS.filter(
    (i) => i.roles.includes(role) && !(SIMPLE_MODE && i.hideInSimple),
  );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="w-60 min-h-screen bg-[#0D1117] flex flex-col text-white flex-shrink-0">
      {/* Brand — the org's own workspace identity */}
      <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ctx?.org?.logoUrl || "/icon-512.png"}
          alt={ctx?.org?.name || "ExpoUz"}
          width={32}
          height={32}
          className="rounded-lg object-cover"
          style={{ width: 32, height: 32 }}
        />
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight truncate">
            {ctx?.org ? (
              <span className="text-white">{ctx.org.name}</span>
            ) : (
              <>
                <span className="text-[#00C853]">Expo</span>
                <span className="text-white">Uz</span>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {ctx?.role ? `${ctx.role.charAt(0)}${ctx.role.slice(1).toLowerCase()} · Partner Panel` : "Partner Panel"}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ href, key, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(href)
                ? "bg-[#00C853]/20 text-[#00C853]"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={18} />
            {t(key)}
          </Link>
        ))}
      </nav>

      {/* Language switcher */}
      <div className="px-4 pb-2 flex gap-1">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              lang === l.code ? "bg-[#00C853]/20 text-[#00C853]" : "text-gray-500 hover:bg-white/5 hover:text-white"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-white/10">
        {user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#00C853]/20 flex items-center justify-center text-sm font-bold text-[#00C853]">
              {user.firstName?.[0] ?? "O"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {user.firstName ?? "Owner"}
              </div>
              <div className="text-xs text-gray-500">
                {user.role?.replace("_", " ")}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 text-xs text-gray-600 hover:text-red-400 transition-colors py-1"
        >
          <LogOut size={14} /> {t("nav.signout")}
        </button>
      </div>
    </aside>
  );
}
