"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getConversations, chatUserName, type Conversation } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { hapticImpact } from "@/lib/telegram";

export default function MessagesPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
    refetchInterval: 15000,
  });

  const conversations = data ?? [];

  return (
    <div className="min-h-screen pb-24">
      <header className="px-4 pt-5 pb-3 sticky top-0 z-30" style={{ background: "var(--tg-bg)" }}>
        <h1 className="text-xl font-bold">Messages</h1>
      </header>

      <div className="px-4 pt-1">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-2">💬</div>
            <p className="font-medium">No messages yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--tg-hint)" }}>
              Start a conversation from a player&apos;s profile.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                onClick={() => {
                  hapticImpact("light");
                  router.push(`/messages/${c.id}`);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function ConversationRow({
  conversation: c,
  onClick,
}: {
  conversation: Conversation;
  onClick: () => void;
}) {
  const name = c.type === "MATCH_GROUP" ? "Match group" : chatUserName(c.otherMember);
  const initials =
    c.type === "MATCH_GROUP"
      ? "⚽"
      : `${c.otherMember?.firstName?.[0] ?? ""}${c.otherMember?.lastName?.[0] ?? ""}`
          .toUpperCase() || "?";
  const preview = c.lastMessage?.content ?? "No messages yet";
  const time = c.lastMessage?.createdAt ? dayjs(c.lastMessage.createdAt).format("MMM D") : "";
  const unread = c.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
      style={{ background: "var(--tg-card)" }}
    >
      <div className="w-12 h-12 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-base font-bold overflow-hidden shrink-0">
        {c.otherMember?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.otherMember.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate ${unread ? "font-bold" : "font-semibold"}`}>{name}</span>
          <span className="text-[11px] shrink-0" style={{ color: "var(--tg-hint)" }}>
            {time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span
            className="text-sm truncate"
            style={{ color: unread ? "var(--tg-text)" : "var(--tg-hint)" }}
          >
            {preview}
          </span>
          {unread && (
            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#00C853] text-white text-[11px] font-bold flex items-center justify-center">
              {c.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
