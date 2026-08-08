"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { Plus, Search, X, LifeBuoy } from "lucide-react";
import {
  getConversations,
  chatUserName,
  ensureSupport,
  getPublicGroups,
  joinPublicGroup,
  searchPlayers,
  startDirectConversation,
  type Conversation,
} from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { hapticImpact } from "@/lib/telegram";

type Tab = "direct" | "groups";

export default function MessagesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations("chat");
  const [tab, setTab] = useState<Tab>("direct");
  const [menuOpen, setMenuOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
    refetchInterval: 15000,
  });

  const conversations = data ?? [];
  const support = conversations.find((c) => c.type === "SUPPORT") ?? null;
  const direct = conversations.filter((c) => c.type === "DIRECT" || c.type === "PITCH_HIRE");
  const groups = conversations.filter((c) => c.type === "PUBLIC_GROUP");
  const list = tab === "direct" ? direct : groups;

  const openConversation = (id: string) => {
    hapticImpact("light");
    router.push(`/messages/${id}`);
  };

  const openSupport = async () => {
    hapticImpact("light");
    if (support) return openConversation(support.id);
    const conv = await ensureSupport();
    qc.invalidateQueries({ queryKey: ["conversations"] });
    router.push(`/messages/${conv.id}`);
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="px-4 pt-5 pb-2 sticky top-0 z-30" style={{ background: "var(--tg-bg)" }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <button
            onClick={() => {
              hapticImpact("light");
              setMenuOpen(true);
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "var(--tg-card)" }}
            aria-label={t("new")}
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {(["direct", "groups"] as Tab[]).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className="px-3.5 py-1.5 rounded-full text-sm font-semibold"
              style={{
                background: tab === tb ? "#00C853" : "var(--tg-card)",
                color: tab === tb ? "#fff" : "var(--tg-text)",
              }}
            >
              {tb === "direct" ? t("directTab") : t("groupsTab")}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 pt-2">
        {/* Support — pinned at top */}
        <button
          onClick={openSupport}
          className="w-full flex items-center gap-3 rounded-2xl p-3 text-left mb-2"
          style={{ background: "rgba(0,176,255,0.08)" }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(0,176,255,0.15)", color: "#0369A1" }}>
            <LifeBuoy size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">📌 {t("support")}</div>
            <div className="text-sm truncate" style={{ color: "var(--tg-hint)" }}>{t("supportHint")}</div>
          </div>
          {support && support.unreadCount > 0 && (
            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#00B0FF] text-white text-[11px] font-bold flex items-center justify-center">
              {support.unreadCount}
            </span>
          )}
        </button>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            tab={tab}
            onBrowse={() => setBrowseOpen(true)}
            onFindPlayer={() => router.push("/players")}
          />
        ) : (
          <div className="space-y-1">
            {list.map((c) => (
              <ConversationRow key={c.id} conversation={c} onClick={() => openConversation(c.id)} />
            ))}
          </div>
        )}
      </div>

      {/* [+] menu */}
      {menuOpen && (
        <Sheet title={t("new")} onClose={() => setMenuOpen(false)}>
          <SheetAction icon="💬" label={t("messagePlayer")} onClick={() => { setMenuOpen(false); setDmOpen(true); }} />
          <SheetAction icon="👥" label={t("browseGroups")} onClick={() => { setMenuOpen(false); setBrowseOpen(true); }} />
        </Sheet>
      )}

      {/* Browse public groups */}
      {browseOpen && <BrowseGroups onClose={() => setBrowseOpen(false)} onOpen={openConversation} />}

      {/* Start a DM */}
      {dmOpen && <StartDm onClose={() => setDmOpen(false)} onOpen={openConversation} />}

      <BottomNav />
    </div>
  );
}

function EmptyState({ tab, onBrowse, onFindPlayer }: { tab: Tab; onBrowse: () => void; onFindPlayer: () => void }) {
  const t = useTranslations("chat");
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-2">{tab === "direct" ? "💬" : "👥"}</div>
      <p className="font-medium">{tab === "direct" ? t("noDirect") : t("noGroups")}</p>
      <p className="text-sm mt-1" style={{ color: "var(--tg-hint)" }}>
        {tab === "direct" ? t("noDirectHint") : t("noGroupsHint")}
      </p>
      <button
        onClick={tab === "direct" ? onFindPlayer : onBrowse}
        className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
        style={{ background: "#00C853" }}
      >
        {tab === "direct" ? t("findPlayers") : t("browseGroups")}
      </button>
    </div>
  );
}

function ConversationRow({ conversation: c, onClick }: { conversation: Conversation; onClick: () => void }) {
  const t = useTranslations("chat");
  const isGroup = c.type === "PUBLIC_GROUP";
  const name = isGroup ? c.title ?? t("group") : chatUserName(c.otherMember);
  const initials = isGroup
    ? "👥"
    : `${c.otherMember?.firstName?.[0] ?? ""}${c.otherMember?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const preview = c.lastMessage?.content ?? t("noMessagesShort");
  const time = c.lastMessage?.createdAt ? dayjs(c.lastMessage.createdAt).format("MMM D") : "";
  const unread = c.unreadCount > 0;

  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 rounded-2xl p-3 text-left" style={{ background: "var(--tg-card)" }}>
      <div className="w-12 h-12 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-base font-bold overflow-hidden shrink-0">
        {!isGroup && c.otherMember?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.otherMember.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate ${unread ? "font-bold" : "font-semibold"}`}>{name}</span>
          <span className="text-[11px] shrink-0" style={{ color: "var(--tg-hint)" }}>{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-sm truncate" style={{ color: unread ? "var(--tg-text)" : "var(--tg-hint)" }}>{preview}</span>
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

function BrowseGroups({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const t = useTranslations("chat");
  const qc = useQueryClient();
  const { data: groups, isLoading } = useQuery({ queryKey: ["public-groups"], queryFn: () => getPublicGroups() });

  const join = async (id: string) => {
    hapticImpact("light");
    const r = await joinPublicGroup(id);
    qc.invalidateQueries({ queryKey: ["public-groups"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    onClose();
    onOpen(r.conversationId);
  };

  return (
    <Sheet title={t("browseGroups")} onClose={onClose}>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="w-5 h-5 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (groups ?? []).length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--tg-hint)" }}>{t("noGroupsYet")}</p>
      ) : (
        <div className="space-y-2">
          {groups!.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--tg-card)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(0,200,83,0.12)" }}>👥</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{g.title}</div>
                <div className="text-xs" style={{ color: "var(--tg-hint)" }}>
                  {[g.city, g.sport].filter(Boolean).join(" · ")} · {t("members", { count: g.memberCount })}
                </div>
              </div>
              {g.joined ? (
                <button onClick={() => onOpen(g.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.05)" }}>{t("open")}</button>
              ) : (
                <button onClick={() => join(g.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: "#00C853" }}>{t("join")}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function StartDm({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const t = useTranslations("chat");
  const [q, setQ] = useState("");
  const { data: results } = useQuery({
    queryKey: ["dm-search", q],
    queryFn: () => searchPlayers(q),
    enabled: q.trim().length >= 2,
  });

  const start = async (userId: string) => {
    hapticImpact("light");
    const convo = await startDirectConversation(userId);
    onClose();
    onOpen(convo.id);
  };

  return (
    <Sheet title={t("messagePlayer")} onClose={onClose}>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tg-hint)" }} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlayers")}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
        />
      </div>
      <div className="space-y-1">
        {(results ?? []).map((u: any) => (
          <button key={u.id} onClick={() => start(u.id)} className="w-full flex items-center gap-3 rounded-2xl p-2.5 text-left" style={{ background: "var(--tg-card)" }}>
            <div className="w-9 h-9 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
              {u.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (u.firstName?.[0] ?? "?").toUpperCase()
              )}
            </div>
            <span className="text-sm font-medium truncate">{u.firstName} {u.lastName}</span>
          </button>
        ))}
        {q.trim().length >= 2 && (results ?? []).length === 0 && (
          <p className="text-sm text-center py-4" style={{ color: "var(--tg-hint)" }}>{t("noPlayersFound")}</p>
        )}
      </div>
    </Sheet>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full rounded-t-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto" style={{ background: "var(--tg-bg)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--tg-card)" }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SheetAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 rounded-2xl p-3.5 text-left mb-2" style={{ background: "var(--tg-card)" }}>
      <span className="text-xl">{icon}</span>
      <span className="font-semibold text-sm">{label}</span>
    </button>
  );
}
