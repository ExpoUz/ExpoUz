"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { hapticImpact } from "@/lib/telegram";
import { LEVEL_META } from "@/lib/api";
import { PhotoOrInitials, initialsOf } from "./PhotoOrInitials";

/** Section C — portrait player cards; name + level chip sit below the image. */
export function PlayersCarousel({ players }: { players: any[] }) {
  const tRanks = useTranslations("levels.ranks");

  return (
    <div className="flex gap-3 overflow-x-auto snap-x px-4 pb-1">
      {players.map((p) => {
        const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Player";
        const level = LEVEL_META[p.playerLevel as keyof typeof LEVEL_META] ?? LEVEL_META.NEW;
        return (
          <Link
            key={p.id}
            href={`/players/${p.id}`}
            onClick={() => hapticImpact("light")}
            className="snap-start shrink-0 w-[104px] active:scale-[0.98] transition-transform"
          >
            <PhotoOrInitials
              src={p.avatarUrl}
              initials={initialsOf(name)}
              className="w-[104px] h-[140px]"
              rounded="rounded-2xl"
              initialsClassName="text-white/90 font-extrabold text-2xl"
            />
            <div className="mt-1.5 px-0.5">
              <div className="text-[13px] font-medium line-clamp-1" style={{ color: "var(--tg-text)" }}>
                {name}
              </div>
              <span
                className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: `${level.color}1F`, color: level.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: level.color }} />
                {tRanks(p.playerLevel ?? "NEW")}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
