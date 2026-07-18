"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Send } from "lucide-react";
import {
  getConversationMessages,
  sendChatMessage,
  getConversations,
  getMe,
  chatUserName,
  type ChatMessage,
} from "@/lib/api";
import { useMessagesSocket } from "@/lib/useMessagesSocket";
import { showBackButton, hapticImpact } from "@/lib/telegram";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: page, isLoading } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversationMessages(id),
  });

  // Title: pull from the conversations cache if we navigated from the list,
  // otherwise derive from the first message sender that isn't me.
  const cachedConvos = qc.getQueryData<any[]>(["conversations"]);
  const cachedConvo = cachedConvos?.find((c) => c.id === id);
  const otherFromMsg = messages.find((m) => m.senderId !== me?.id)?.sender;
  const title =
    cachedConvo?.type === "MATCH_GROUP"
      ? "Match group"
      : chatUserName(cachedConvo?.otherMember ?? otherFromMsg);

  useEffect(() => {
    if (page?.data) setMessages(page.data);
  }, [page]);

  useEffect(() => {
    const cleanup = showBackButton(() => router.back());
    return cleanup;
  }, [router]);

  // Live updates: append incoming, refresh the list cache so unread clears.
  useMessagesSocket(id, {
    onMessage: (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    hapticImpact("light");
    try {
      const msg = await sendChatMessage(id, content);
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      setDraft(content); // restore on failure
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header
        className="px-4 py-3 border-b shrink-0 sticky top-0 z-10"
        style={{ background: "var(--tg-bg)", borderColor: "rgba(0,0,0,0.08)" }}
      >
        <h1 className="font-bold truncate">{title}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-2">👋</div>
            <p className="font-medium">No messages yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--tg-hint)" }}>
              Say hello to start the conversation.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === me?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[78%] rounded-2xl px-3 py-2"
                  style={{
                    background: mine ? "#00C853" : "var(--tg-card)",
                    color: mine ? "#fff" : "var(--tg-text)",
                    borderBottomRightRadius: mine ? 6 : undefined,
                    borderBottomLeftRadius: mine ? undefined : 6,
                  }}
                >
                  <p className="text-[15px] whitespace-pre-wrap break-words">{m.content}</p>
                  <div
                    className="text-[10px] mt-0.5 text-right"
                    style={{ color: mine ? "rgba(255,255,255,0.7)" : "var(--tg-hint)" }}
                  >
                    {dayjs(m.createdAt).format("HH:mm")}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="shrink-0 flex items-end gap-2 px-3 py-2 border-t"
        style={{
          background: "var(--tg-bg)",
          borderColor: "rgba(0,0,0,0.08)",
          paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Message…"
          className="flex-1 resize-none rounded-2xl px-3 py-2 text-[15px] max-h-28 outline-none"
          style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ background: "#00C853", color: "#fff" }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
