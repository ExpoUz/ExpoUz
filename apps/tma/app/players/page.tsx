"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { searchPlayers, LEVEL_META } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { hapticImpact } from "@/lib/telegram";

export default function PlayersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const { data: players, isFetching } = useQuery({
    queryKey: ["players", q],
    queryFn: () => searchPlayers(q),
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="min-h-screen pb-24">
      <header className="px-4 pt-5 pb-3 sticky top-0 z-30" style={{ background: "var(--tg-bg)" }}>
        <h1 className="text-xl font-bold mb-3">Players</h1>
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: "var(--tg-card)" }}>
          <Search size={18} style={{ color: "var(--tg-hint)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players by name…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </header>

      <div className="px-4 pt-2 space-y-2">
        {q.trim().length < 2 && (
          <p className="text-center text-sm py-16" style={{ color: "var(--tg-hint)" }}>
            Type at least 2 letters to search.
          </p>
        )}
        {q.trim().length >= 2 && isFetching && (
          <div className="flex justify-center py-16">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {q.trim().length >= 2 && !isFetching && (players ?? []).length === 0 && (
          <p className="text-center text-sm py-16" style={{ color: "var(--tg-hint)" }}>
            No players found.
          </p>
        )}
        {(players ?? []).map((p: any) => {
          const lvl = LEVEL_META[p.playerLevel] ?? LEVEL_META.NEW;
          return (
            <button
              key={p.id}
              onClick={() => {
                hapticImpact("light");
                router.push(`/players/${p.id}`);
              }}
              className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
              style={{ background: "var(--tg-card)" }}
            >
              <Avatar user={p} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">
                  {p.firstName} {p.lastName}
                </div>
                <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                  {lvl.icon} {lvl.label} · {p.gamesAttended} games
                </div>
              </div>
              {p.district || p.city ? (
                <span className="text-xs" style={{ color: "var(--tg-hint)" }}>
                  {p.district ?? p.city}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}

function Avatar({ user }: { user: any }) {
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <div className="w-11 h-11 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
