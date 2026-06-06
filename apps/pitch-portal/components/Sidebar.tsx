"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/pitches", label: "My Pitches", icon: "🏟" },
  { href: "/schedule", label: "Schedule", icon: "🗓" },
  { href: "/players", label: "Players", icon: "👥" },
  { href: "/revenue", label: "Revenue", icon: "💰" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="w-60 min-h-screen bg-[#0D1117] flex flex-col text-white flex-shrink-0">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-lg font-bold tracking-tight">
          <span className="text-[#00C853]">SCORE</span>
          <span className="text-white"> WITH US</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">Pitch Owner Portal</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon }) => (
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
            {label}
          </Link>
        ))}
      </nav>

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
          Sign out →
        </button>
      </div>
    </aside>
  );
}
