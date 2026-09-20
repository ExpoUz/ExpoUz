"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { Send, Check, Lock, MessageSquare, Crown } from "lucide-react";
import {
  getMatchChat,
  getConversationMessages,
  sendChatMessage,
  editChatMessage,
  deleteChatMessage,
  getMe,
  type ChatMessage,
} from "@/lib/api";
import { useMessagesSocket } from "@/lib/useMessagesSocket";
import { showBackButton, hapticImpact, showAlert } from "@/lib/telegram";

export default function MatchChatPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations("matchChat");
  const tc = useTranslations("chat");
  const matchId = String(params.id);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  // Resolves the conversation (403 if not a member — the row prevents that).
  const { data: convo, isLoading: convoLoading, isError } = useQuery({
    queryKey: ["match-chat", matchId],
    queryFn: () => getMatchChat(matchId),
    retry: false,
  });
  const conversationId: string | undefined = convo?.id;
  const readOnly: boolean = !!convo?.readOnly;

  // Host id → host badge on their messages.
  const hostId = useMemo(
    () => convo?.members?.find((m: any) => m.isAdmin)?.userId ?? null,
    [convo],
  );

  const { data: page } = useQuery({
    queryKey: ["match-chat-messages", conversationId],
    queryFn: () => getConversationMessages(conversationId!),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (page?.data) setMessages(page.data);
  }, [page]);

  useEffect(() => showBackButton(() => router.push(`/match/${matchId}`)), [router, matchId]);

  useMessagesSocket(conversationId ?? "", {
    onMessage: (m: ChatMessage) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      qc.invalidateQueries({ queryKey: ["match-chat-summary", matchId] });
    },
    onUpdate: (m: ChatMessage) => setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending || !conversationId || readOnly) return;
    setSending(true);
    setDraft("");
    hapticImpact("light");
    try {
      if (editing) {
        const updated = await editChatMessage(editing.id, content);
        setMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        setEditing(null);
      } else {
        const msg = await sendChatMessage(conversationId, content);
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      }
    } catch {
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  const remove = async (m: ChatMessage) => {
    setActionMsg(null);
    hapticImpact("light");
    try {
      await deleteChatMessage(m.id);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deletedAt: new Date().toISOString(), content: "" } : x)));
    } catch {
      showAlert(t("actionFailed"));
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header
        className="px-4 py-3 border-b shrink-0 sticky top-0 z-10"
        style={{ background: "var(--tg-bg)", borderColor: "rgba(0,0,0,0.08)" }}
      >
        <h1 className="font-bold truncate">{t("title")}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {convoLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <div className="flex justify-center mb-2">
              <Lock size={28} style={{ color: "var(--tg-hint)" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--tg-hint)" }}>{t("joinToChat")}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <div className="flex justify-center mb-2">
              <MessageSquare size={28} style={{ color: "var(--tg-hint)" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--tg-hint)" }}>{t("empty")}</p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageRow
              key={m.id}
              m={m}
              mineId={me?.id}
              hostId={hostId}
              onAction={() => !readOnly && setActionMsg(m)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {editing && (
        <div className="px-3 py-1.5 flex items-center justify-between text-xs border-t" style={{ background: "var(--tg-card)", borderColor: "rgba(0,0,0,0.08)", color: "var(--tg-hint)" }}>
          <span>{tc("editing")}</span>
          <button onClick={() => { setEditing(null); setDraft(""); }} className="font-semibold">{tc("cancel")}</button>
        </div>
      )}

      {readOnly ? (
        <div
          className="shrink-0 px-4 py-3 text-center text-xs border-t"
          style={{ background: "var(--tg-bg)", borderColor: "rgba(0,0,0,0.08)", color: "var(--tg-hint)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          {t("closed")}
        </div>
      ) : (
        <div
          className="shrink-0 flex items-end gap-2 px-3 py-2 border-t"
          style={{ background: "var(--tg-bg)", borderColor: "rgba(0,0,0,0.08)", paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}
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
            placeholder={t("typeMessage")}
            className="flex-1 resize-none rounded-2xl px-3 py-2 text-[15px] max-h-28 outline-none"
            style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"
            style={{ background: "#00C853", color: "#fff" }}
          >
            {editing ? <Check size={18} /> : <Send size={18} />}
          </button>
        </div>
      )}

      {/* Own-message actions */}
      {actionMsg && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setActionMsg(null)}>
          <div className="w-full rounded-t-3xl p-4 pb-8 space-y-2" style={{ background: "var(--tg-bg)" }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setEditing(actionMsg); setDraft(actionMsg.content); setActionMsg(null); }}
              className="w-full rounded-2xl py-3 text-sm font-semibold"
              style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
            >
              {tc("edit")}
            </button>
            <button
              onClick={() => remove(actionMsg)}
              className="w-full rounded-2xl py-3 text-sm font-semibold"
              style={{ background: "var(--tg-card)", color: "#FF5252" }}
            >
              {tc("delete")}
            </button>
            <button onClick={() => setActionMsg(null)} className="w-full rounded-2xl py-3 text-sm font-semibold" style={{ background: "var(--tg-card)" }}>
              {tc("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageRow({ m, mineId, hostId, onAction }: { m: ChatMessage; mineId?: string; hostId: string | null; onAction: () => void }) {
  const t = useTranslations("matchChat");
  const tc = useTranslations("chat");

  if (m.type === "SYSTEM") {
    let text = m.content;
    try {
      const p = JSON.parse(m.content);
      if (p.t === "joined") text = t("sys.joined", { name: p.name });
      else if (p.t === "left") text = t("sys.left", { name: p.name });
      else if (p.t === "confirmed") text = t("sys.confirmed");
      else if (p.t === "timeChanged") text = t("sys.timeChanged", { time: dayjs(p.iso).format("HH:mm") });
    } catch {
      /* fall back to raw content */
    }
    return (
      <div className="flex justify-center my-1">
        <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.06)", color: "var(--tg-hint)" }}>
          {text}
        </span>
      </div>
    );
  }

  const mine = m.senderId === mineId;
  const isHost = m.senderId === hostId;
  const deleted = !!m.deletedAt;
  const name = `${m.sender?.firstName ?? ""} ${m.sender?.lastName ?? ""}`.trim() || "Player";
  const initial = (m.sender?.firstName?.[0] ?? "?").toUpperCase();

  return (
    <div className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <div className="w-7 h-7 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-[11px] font-bold overflow-hidden shrink-0 self-end">
          {m.sender?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => mine && !deleted && onAction()}
        className="max-w-[74%] rounded-2xl px-3 py-2 text-left"
        style={{
          background: deleted ? "transparent" : mine ? "#00C853" : "var(--tg-card)",
          color: deleted ? "var(--tg-hint)" : mine ? "#fff" : "var(--tg-text)",
          border: deleted ? "1px dashed rgba(0,0,0,0.15)" : undefined,
          borderBottomRightRadius: mine && !deleted ? 6 : undefined,
          borderBottomLeftRadius: !mine && !deleted ? 6 : undefined,
        }}
      >
        {!mine && !deleted && (
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[11px] font-semibold" style={{ color: "#00875A" }}>{name}</span>
            {isHost && <Crown size={11} style={{ color: "#F59E0B" }} />}
          </div>
        )}
        {deleted ? (
          <p className="text-[13px] italic">{tc("deletedMessage")}</p>
        ) : (
          <p className="text-[15px] whitespace-pre-wrap break-words">{m.content}</p>
        )}
        <div className="text-[10px] mt-0.5 text-right" style={{ color: mine && !deleted ? "rgba(255,255,255,0.7)" : "var(--tg-hint)" }}>
          {m.editedAt && !deleted ? `${tc("edited")} · ` : ""}
          {dayjs(m.createdAt).format("HH:mm")}
        </div>
      </button>
    </div>
  );
}
