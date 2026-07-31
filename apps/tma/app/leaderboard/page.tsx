"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getLeaderboard, getCities, getMe, LEVEL_META } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { hapticImpact } from "@/lib/telegram";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const router = useRouter();
  const t = useTranslations("leaderboard");
  const tRanks = useTranslations("levels.ranks");
  const [city, setCity] = useState("");

  const { data: cities } = useQuery({ queryKey: ["cities"], queryFn: getCities });
  const { data: me } = useQuery({ queryKey: ["tma-me"], queryFn: getMe });
  const { data: board, isLoading } = useQuery({
    queryKey: ["leaderboard", city],
    queryFn: () => getLeaderboard(city || undefined),
  });

  const cityList = ["", ...(cities ?? []).map((c) => c.city)];

  return (
    <div className="min-h-screen pb-24">
      <header className="px-4 pt-5 pb-3 sticky top-0 z-30" style={{ background: "var(--tg-bg)" }}>
        <h1 className="text-xl font-bold mb-1">{t("title")}</h1>
        <p className="text-sm mb-3" style={{ color: "var(--tg-hint)" }}>
          {t("rankedBy")}
        </p>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {cityList.map((c) => (
            <button
              key={c || "all"}
              onClick={() => {
                hapticImpact("light");
                setCity(c);
              }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium ${
                city === c ? "bg-[#00C853] text-white" : ""
              }`}
              style={city === c ? {} : { background: "var(--tg-card)", color: "var(--tg-hint)" }}
            >
              {c || t("allCities")}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 pt-2 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (board ?? []).length === 0 ? (
          <p className="text-center text-sm py-16" style={{ color: "var(--tg-hint)" }}>
            {t("empty")}
          </p>
        ) : (
          (board ?? []).map((p: any) => {
            const lvl = LEVEL_META[p.playerLevel] ?? LEVEL_META.NEW;
            const isMe = me?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  hapticImpact("light");
                  router.push(`/players/${p.id}`);
                }}
                className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
                style={{
                  background: isMe ? "rgba(0,200,83,0.12)" : "var(--tg-card)",
                  border: isMe ? "1px solid #00C853" : "1px solid transparent",
                }}
              >
                <div className="w-7 text-center font-bold text-sm shrink-0">
                  {p.rank <= 3 ? MEDALS[p.rank - 1] : p.rank}
                </div>
                <Avatar user={p} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">
                    {p.firstName} {p.lastName} {isMe && <span className="text-[#00C853]">{t("you")}</span>}
                  </div>
                  <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                    {lvl.icon} {tRanks(p.playerLevel ?? "NEW")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-sm">{p.gamesAttended}</div>
                  <div className="text-[10px]" style={{ color: "var(--tg-hint)" }}>{t("games")}</div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function Avatar({ user }: { user: any }) {
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <div className="w-10 h-10 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
