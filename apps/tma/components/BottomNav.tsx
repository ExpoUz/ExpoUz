"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Trophy, User } from "lucide-react";
import { hapticImpact } from "@/lib/telegram";

const ITEMS = [
  { href: "/", label: "Games", icon: Home },
  { href: "/players", label: "Players", icon: Search },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t flex"
      style={{
        background: "var(--tg-card)",
        borderColor: "rgba(0,0,0,0.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => hapticImpact("light")}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
            style={{ color: active ? "#00C853" : "var(--tg-hint)" }}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
            <span className="text-[11px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
