"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Home, Search, MessageCircle, Trophy, User } from "lucide-react";
import { hapticImpact } from "@/lib/telegram";
import { getConversations } from "@/lib/api";

const ITEMS = [
  { href: "/", key: "games", icon: Home },
  { href: "/players", key: "players", icon: Search },
  { href: "/messages", key: "chat", icon: MessageCircle },
  { href: "/leaderboard", key: "ranks", icon: Trophy },
  { href: "/profile", key: "profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
    refetchInterval: 20000,
    staleTime: 10000,
  });
  const unreadTotal = (conversations ?? []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t flex"
      style={{
        background: "var(--tg-card)",
        borderColor: "rgba(0,0,0,0.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const showBadge = href === "/messages" && unreadTotal > 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => hapticImpact("light")}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
            style={{ color: active ? "#00C853" : "var(--tg-hint)" }}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              {showBadge && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3B30] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadTotal > 9 ? "9+" : unreadTotal}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
