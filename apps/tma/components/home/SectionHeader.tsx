"use client";

import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { hapticImpact } from "@/lib/telegram";

/** One consistent header for every discovery section. */
export function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  const t = useTranslations("home");
  return (
    <div className="flex items-center justify-between px-4 mb-3">
      <h2 className="text-[17px] font-semibold" style={{ color: "var(--tg-text)" }}>
        {title}
      </h2>
      {onSeeAll && (
        <button
          onClick={() => {
            hapticImpact("light");
            onSeeAll();
          }}
          className="flex items-center gap-0.5 text-[13px]"
          style={{ color: "var(--tg-hint)" }}
        >
          {t("seeAll")}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
