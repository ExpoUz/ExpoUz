"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Activity,
  CreditCard,
  Radio,
  BarChart3,
  Building,
  ShieldCheck,
  HardHat,
  Search,
  MessagesSquare,
  MapPin,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/users", label: "Users", Icon: Users },
  { href: "/pitches", label: "Pitches", Icon: Building2 },
  { href: "/matches", label: "Matches", Icon: Activity },
  { href: "/transactions", label: "Transactions", Icon: CreditCard },
  { href: "/activity", label: "Activity", Icon: Radio },
  { href: "/analytics", label: "Analytics", Icon: BarChart3 },
];

const SUPER_ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/organizations", label: "Organizations", Icon: Building },
  { href: "/super/admins", label: "Admins", Icon: ShieldCheck },
  { href: "/super/pitch-admins", label: "Pitch Owners", Icon: HardHat },
  { href: "/super/crm-oversight", label: "CRM Oversight", Icon: Search },
  { href: "/super/groups", label: "Chat Groups", Icon: MessagesSquare },
  { href: "/super/locations", label: "Locations", Icon: MapPin },
  { href: "/super/settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="w-60 min-h-screen bg-[#0D1117] flex flex-col text-white flex-shrink-0">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="ExpoUz" width={32} height={32} className="rounded-lg" style={{ width: 32, height: 32 }} />
        <div>
          <div className="text-lg font-bold tracking-tight">
            <span className="text-[#00C853]">Expo</span>
            <span className="text-white">Uz</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Admin Panel</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
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
            {label}
          </Link>
        ))}

        {isSuperAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs text-gray-600 uppercase tracking-widest font-semibold">
                Super Admin
              </span>
            </div>
            {SUPER_ITEMS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(href)
                    ? "bg-red-500/20 text-red-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-white/10">
        {user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#00C853]/20 flex items-center justify-center text-sm font-bold text-[#00C853]">
              {user.firstName?.[0] ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {user.firstName ?? "Admin"}
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
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}

