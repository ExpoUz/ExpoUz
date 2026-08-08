"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { getMatchChatSummary } from "@/lib/api";
import { hapticImpact } from "@/lib/telegram";

/**
 * "Match chat" row under the Players section. Visible to everyone; tappable only
 * for players who've joined the match. Non-members see it dimmed with a hint.
 */
export function MatchChatRow({ matchId }: { matchId: string }) {
  const router = useRouter();
  const t = useTranslations("matchChat");

  const { data } = useQuery({
    queryKey: ["match-chat-summary", matchId],
    queryFn: () => getMatchChatSummary(matchId),
    refetchInterval: 20000,
  });

  const isMember = data?.isMember ?? false;
  const unread = data?.unreadCount ?? 0;
  const count = data?.memberCount ?? 0;

  const open = () => {
    if (!isMember) return;
    hapticImpact("light");
    router.push(`/match/${matchId}/chat`);
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={!isMember}
      className="w-full text-left rounded-2xl p-4 flex items-center gap-3 transition-opacity"
      style={{ background: "var(--tg-card)", opacity: isMember ? 1 : 0.55 }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "rgba(0,200,83,0.12)", color: "#00875A" }}
      >
        <MessageCircle size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{t("title")}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>
          {isMember ? t("subtitle") : t("joinToChat")}
        </div>
      </div>
      {isMember && unread > 0 && (
        <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#00C853] text-white text-xs font-bold flex items-center justify-center">
          {unread}
        </span>
      )}
      {isMember && unread === 0 && count > 0 && (
        <span className="shrink-0 text-sm" style={{ color: "var(--tg-hint)" }}>
          {count} ›
        </span>
      )}
    </button>
  );
}
