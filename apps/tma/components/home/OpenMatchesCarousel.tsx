"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { hapticImpact } from "@/lib/telegram";
import { PhotoOrInitials, initialsOf } from "./PhotoOrInitials";
import {
  matchPhoto,
  venueName,
  spotsLeft,
  sportBadge,
} from "./matchHelpers";

/** Section B — landscape venue cards with venue name, format + spots, badge. */
export function OpenMatchesCarousel({ matches }: { matches: any[] }) {
  const t = useTranslations("matches");

  return (
    <div className="flex gap-3 overflow-x-auto snap-x px-4 pb-1">
      {matches.map((m) => {
        const left = spotsLeft(m);
        const name = venueName(m) || t("venue");
        return (
          <Link
            key={m.id}
            href={`/match/${m.id}`}
            onClick={() => hapticImpact("light")}
            className="snap-start shrink-0 active:scale-[0.98] transition-transform"
          >
            <div className="relative w-[200px] h-[130px]">
              <PhotoOrInitials
                src={matchPhoto(m)}
                initials={initialsOf(name)}
                className="absolute inset-0"
                rounded="rounded-2xl"
                initialsClassName="text-white/90 font-extrabold text-2xl"
              />
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 58%)",
                }}
              />

              {/* Sport badge, top-left */}
              <span
                className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  background: "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }}
              >
                {sportBadge(m.sport)}
              </span>

              {/* Copy, bottom-left */}
              <div className="absolute left-2.5 right-2.5 bottom-2">
                <div className="text-white text-sm font-semibold leading-tight line-clamp-1">
                  {name}
                </div>
                <div className="text-[12px] text-white/70 mt-0.5 line-clamp-1">
                  {m.format}
                  {left > 0 ? ` · ${t("spotsLeft", { count: left })}` : ` · ${t("full")}`}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
