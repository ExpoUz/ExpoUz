"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n, LANGS } from "@/lib/i18n";
import { getPortalContext, type OrgRole } from "@/lib/api";

// Which org roles may see each nav item. STAFF is limited to schedule + check-in.
const NAV_ITEMS: { href: string; key: string; icon: string; roles: OrgRole[] }[] = [
  { href: "/", key: "nav.dashboard", icon: "📊", roles: ["OWNER", "MANAGER", "STAFF"] },
  { href: "/schedule", key: "nav.schedule", icon: "🗓", roles: ["OWNER", "MANAGER", "STAFF"] },
  { href: "/pitches", key: "nav.pitches", icon: "🏟", roles: ["OWNER", "MANAGER"] },
  { href: "/players", key: "nav.players", icon: "👥", roles: ["OWNER", "MANAGER"] },
  { href: "/insights", key: "nav.insights", icon: "📈", roles: ["OWNER", "MANAGER"] },
  { href: "/broadcast", key: "nav.broadcast", icon: "📣", roles: ["OWNER", "MANAGER"] },
  { href: "/revenue", key: "nav.revenue", icon: "💰", roles: ["OWNER", "MANAGER"] },
  { href: "/staff", key: "nav.staff", icon: "🧑‍💼", roles: ["OWNER"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();

  // Org identity + role drive the panel branding and which nav items appear.
  const { data: ctx } = useQuery({ queryKey: ["portal-context"], queryFn: getPortalContext });
  const role: OrgRole = ctx?.role ?? "OWNER";
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

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
        {items.map(({ href, key, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(href)
                ? "bg-[#00C853]/20 text-[#00C853]"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="text-base">{icon}</span>
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
          className="w-full text-left text-xs text-gray-600 hover:text-red-400 transition-colors py-1"
        >
          {t("nav.signout")} →
        </button>
      </div>
    </aside>
  );
}
