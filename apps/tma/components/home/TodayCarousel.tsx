"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { hapticImpact } from "@/lib/telegram";
import { PhotoOrInitials, initialsOf } from "./PhotoOrInitials";
import { matchPhoto, venueName } from "./matchHelpers";

/** Section A — small square venue cards with a time overlay. */
export function TodayCarousel({ matches }: { matches: any[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto snap-x px-4 pb-1">
      {matches.map((m) => (
        <Link
          key={m.id}
          href={`/match/${m.id}`}
          onClick={() => hapticImpact("light")}
          className="snap-start shrink-0 active:scale-[0.98] transition-transform"
        >
          <div className="relative w-[88px] h-[88px]">
            <PhotoOrInitials
              src={matchPhoto(m)}
              initials={initialsOf(venueName(m))}
              className="absolute inset-0"
              rounded="rounded-xl"
              initialsClassName="text-white/90 font-bold text-base"
            />
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 55%)",
              }}
            />
            <span className="absolute left-2 bottom-1.5 text-white text-xs font-semibold">
              {dayjs(m.startTime).format("HH:mm")}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
