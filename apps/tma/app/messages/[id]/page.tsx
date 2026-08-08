"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { Send, MoreVertical, X, Check } from "lucide-react";
import {
  getConversationMessages,
  sendChatMessage,
  editChatMessage,
  deleteChatMessage,
  deleteConversation,
  getMe,
  chatUserName,
  type ChatMessage,
} from "@/lib/api";
import { useMessagesSocket } from "@/lib/useMessagesSocket";
import { showBackButton, hapticImpact, showAlert } from "@/lib/telegram";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations("chat");
  const id = params.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: page, isLoading } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversationMessages(id),
  });

  const cachedConvos = qc.getQueryData<any[]>(["conversations"]);
  const cachedConvo = cachedConvos?.find((c) => c.id === id);
  const otherFromMsg = messages.find((m) => m.senderId !== me?.id)?.sender;
  const title =
    cachedConvo?.type === "PUBLIC_GROUP"
      ? cachedConvo?.title ?? t("group")
      : cachedConvo?.type === "SUPPORT"
        ? t("support")
        : chatUserName(cachedConvo?.otherMember ?? otherFromMsg);

  useEffect(() => {
    if (page?.data) setMessages(page.data);
  }, [page]);

  useEffect(() => showBackButton(() => router.back()), [router]);

  const upsert = (m: ChatMessage) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]));

  useMessagesSocket(id, {
    onMessage: (m) => {
      upsert(m);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onUpdate: (m) => setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))),
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
      if (editing) {
        const updated = await editChatMessage(editing.id, content);
        setMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        setEditing(null);
      } else {
        const msg = await sendChatMessage(id, content);
        upsert(msg);
        qc.invalidateQueries({ queryKey: ["conversations"] });
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

  const removeChat = async () => {
    setMenuOpen(false);
    hapticImpact("light");
    try {
      await deleteConversation(id);
      qc.invalidateQueries({ queryKey: ["conversations"] });
      router.push("/messages");
    } catch {
      showAlert(t("actionFailed"));
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header
        className="px-4 py-3 border-b shrink-0 sticky top-0 z-10 flex items-center justify-between gap-2"
        style={{ background: "var(--tg-bg)", borderColor: "rgba(0,0,0,0.08)" }}
      >
        <h1 className="font-bold truncate">{title}</h1>
        <button onClick={() => setMenuOpen(true)} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" aria-label={t("options")}>
          <MoreVertical size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-2">👋</div>
            <p className="text-sm" style={{ color: "var(--tg-hint)" }}>{t("noMessages")}</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === me?.id;
            const deleted = !!m.deletedAt;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <button
                  type="button"
                  onClick={() => mine && !deleted && setActionMsg(m)}
                  className="max-w-[78%] rounded-2xl px-3 py-2 text-left"
                  style={{
                    background: deleted ? "transparent" : mine ? "#00C853" : "var(--tg-card)",
                    color: deleted ? "var(--tg-hint)" : mine ? "#fff" : "var(--tg-text)",
                    border: deleted ? "1px dashed rgba(0,0,0,0.15)" : undefined,
                    borderBottomRightRadius: mine && !deleted ? 6 : undefined,
                    borderBottomLeftRadius: !mine && !deleted ? 6 : undefined,
                  }}
                >
                  {deleted ? (
                    <p className="text-[13px] italic">{t("deletedMessage")}</p>
                  ) : (
                    <p className="text-[15px] whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                  <div className="text-[10px] mt-0.5 text-right" style={{ color: mine && !deleted ? "rgba(255,255,255,0.7)" : "var(--tg-hint)" }}>
                    {m.editedAt && !deleted ? `${t("edited")} · ` : ""}
                    {dayjs(m.createdAt).format("HH:mm")}
                  </div>
                </button>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {editing && (
        <div className="px-3 py-1.5 flex items-center justify-between text-xs border-t" style={{ background: "var(--tg-card)", borderColor: "rgba(0,0,0,0.08)", color: "var(--tg-hint)" }}>
          <span>{t("editing")}</span>
          <button onClick={() => { setEditing(null); setDraft(""); }} className="font-semibold">{t("cancel")}</button>
        </div>
      )}

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

      {/* Message action sheet (own messages) */}
      {actionMsg && (
        <Sheet onClose={() => setActionMsg(null)}>
          <SheetBtn label={t("edit")} onClick={() => { setEditing(actionMsg); setDraft(actionMsg.content); setActionMsg(null); }} />
          <SheetBtn label={t("delete")} danger onClick={() => remove(actionMsg)} />
        </Sheet>
      )}

      {/* Conversation menu */}
      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)}>
          <SheetBtn label={t("deleteChat")} danger onClick={removeChat} />
        </Sheet>
      )}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const t = useTranslations("chat");
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full rounded-t-3xl p-4 pb-8 space-y-2" style={{ background: "var(--tg-bg)" }} onClick={(e) => e.stopPropagation()}>
        {children}
        <button onClick={onClose} className="w-full rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2" style={{ background: "var(--tg-card)" }}>
          <X size={15} /> {t("cancel")}
        </button>
      </div>
    </div>
  );
}

function SheetBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl py-3 text-sm font-semibold"
      style={{ background: "var(--tg-card)", color: danger ? "#FF5252" : "var(--tg-text)" }}
    >
      {label}
    </button>
  );
}
