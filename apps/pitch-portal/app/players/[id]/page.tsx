"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Phone, MessageCircle, Plus } from "lucide-react";
import {
  getCrmPlayer,
  getCrmPlayerHistory,
  addCrmNote,
  revealCrmContact,
  messageCrmPlayer,
  formatUZS,
} from "@/lib/api";
import { Spinner } from "@/components/ui";
import { SegmentBadge, LevelBadge, Avatar } from "@/components/crm";
import { useI18n, useRelativeTime } from "@/lib/i18n";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 text-center py-3">
      <div className="text-lg font-bold text-[#0D1117]">{value}</div>
      <div className="text-[11px] text-[#6B7280] mt-0.5">{label}</div>
    </div>
  );
}

export default function PlayerDetailPage() {
  const { t } = useI18n();
  const rel = useRelativeTime();
  const params = useParams();
  const id = params.id as string;
  const qc = useQueryClient();

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const { data: player, isLoading } = useQuery({ queryKey: ["crm-player", id], queryFn: () => getCrmPlayer(id) });
  const { data: history } = useQuery({ queryKey: ["crm-history", id], queryFn: () => getCrmPlayerHistory(id) });

  const noteMut = useMutation({
    mutationFn: () => addCrmNote(id, noteText),
    onSuccess: () => {
      setNoteText("");
      setNoteOpen(false);
      qc.invalidateQueries({ queryKey: ["crm-player", id] });
    },
  });

  const revealMut = useMutation({
    mutationFn: () => revealCrmContact(id, "contact player about a booking"),
    onSuccess: (d) => setRevealed(d.phone ?? "—"),
  });

  const msgMut = useMutation({
    mutationFn: () => messageCrmPlayer(id, msgText),
    onSuccess: () => {
      setMsgText("");
      setMsgOpen(false);
      setBanner(t("detail.msg.sent"));
    },
  });

  if (isLoading || !player) return <Spinner label={t("common.loading")} />;

  const sinceDate = player.firstVisit ? new Date(player.firstVisit).toLocaleDateString() : "—";

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <Link href="/players" className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#0D1117] mb-4">
        <ArrowLeft size={16} /> {t("detail.back")}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <Avatar url={player.avatarUrl} first={player.firstName} last={player.lastName} size={56} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0D1117] truncate">{player.firstName} {player.lastName}</h1>
            <LevelBadge padelLevel={player.padelLevel} skillLevel={player.skillLevel} />
          </div>
          <p className="text-sm text-[#6B7280]">{t("detail.since", { date: sinceDate })}</p>
          <div className="mt-1"><SegmentBadge segment={player.segment} /></div>
        </div>
      </div>

      {banner && (
        <div className="mb-4 rounded-xl bg-[#00C853]/10 text-[#00875A] text-sm px-4 py-2.5">{banner}</div>
      )}

      {/* Stat strip */}
      <div className="flex items-stretch bg-white rounded-2xl border border-[#E5E7EB] shadow-sm mb-5 divide-x divide-[#F3F4F6]">
        <Stat value={player.gamesHere} label={t("detail.games")} />
        <Stat value={formatUZS(player.spentHere).replace(" UZS", "")} label={t("detail.spent")} />
        <Stat value={player.noShowsHere} label={t("detail.noShows")} />
        <Stat value={player.favouriteSlot ?? "—"} label={t("detail.usualSlot")} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setMsgOpen((v) => !v)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00C853] text-white text-sm font-semibold hover:bg-[#00b34a]">
          <MessageCircle size={16} /> {t("detail.message")}
        </button>
        <button
          onClick={() => player.contactAvailable && revealMut.mutate()}
          disabled={!player.contactAvailable || revealMut.isPending}
          title={player.contactAvailable ? undefined : t("detail.contactLocked")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#0D1117] disabled:opacity-40 hover:border-[#00C853]"
        >
          <Phone size={16} /> {revealed ?? t("detail.showContact")}
        </button>
      </div>
      {!player.contactAvailable && (
        <p className="-mt-4 mb-6 text-xs text-[#9CA3AF]">{t("detail.contactLocked")}</p>
      )}

      {/* Message composer */}
      {msgOpen && (
        <div className="mb-6 bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-sm">
          <textarea
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder={t("detail.msg.placeholder")}
            rows={3}
            className="w-full p-2.5 rounded-xl border border-[#E5E7EB] text-sm outline-none focus:ring-2 focus:ring-[#00C853]/30 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setMsgOpen(false)} className="px-3 py-1.5 text-sm text-[#6B7280]">{t("detail.cancel")}</button>
            <button onClick={() => msgText.trim() && msgMut.mutate()} disabled={msgMut.isPending}
              className="px-4 py-1.5 rounded-lg bg-[#00C853] text-white text-sm font-semibold disabled:opacity-50">
              {t("detail.message")}
            </button>
          </div>
        </div>
      )}

      {/* Visit history (this venue only) */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-[#0D1117] mb-2">{t("detail.history")}</h2>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          {history && history.length > 0 ? (
            <ul className="divide-y divide-[#F3F4F6]">
              {history.map((h: any) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-[#0D1117]">
                    {h.startTime ? new Date(h.startTime).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "—"}
                    <span className="text-[#6B7280]"> · {h.format} {h.sport?.toLowerCase?.()}</span>
                  </span>
                  <span className="text-[#6B7280]">
                    {h.startTime ? new Date(h.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-[#9CA3AF]">{t("detail.history.none")}</p>
          )}
        </div>
      </section>

      {/* Notes */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[#0D1117]">{t("detail.notes")}</h2>
          <button onClick={() => setNoteOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#00875A]">
            <Plus size={14} /> {t("detail.notes.add")}
          </button>
        </div>

        {noteOpen && (
          <div className="mb-3 bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-sm">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("detail.notes.placeholder")}
              rows={2}
              className="w-full p-2.5 rounded-xl border border-[#E5E7EB] text-sm outline-none focus:ring-2 focus:ring-[#00C853]/30 resize-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setNoteOpen(false)} className="px-3 py-1.5 text-sm text-[#6B7280]">{t("detail.cancel")}</button>
              <button onClick={() => noteText.trim() && noteMut.mutate()} disabled={noteMut.isPending}
                className="px-4 py-1.5 rounded-lg bg-[#00C853] text-white text-sm font-semibold disabled:opacity-50">{t("detail.save")}</button>
            </div>
          </div>
        )}

        {player.notes && player.notes.length > 0 ? (
          <ul className="space-y-2">
            {player.notes.map((n: any) => (
              <li key={n.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 shadow-sm text-sm text-[#0D1117]">
                {n.note}
                <div className="text-[11px] text-[#9CA3AF] mt-1">{rel(n.createdAt)}</div>
              </li>
            ))}
          </ul>
        ) : (
          !noteOpen && <p className="text-sm text-[#9CA3AF]">{t("detail.notes.none")}</p>
        )}
      </section>
    </div>
  );
}
