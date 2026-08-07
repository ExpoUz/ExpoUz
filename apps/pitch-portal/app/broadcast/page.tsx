"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { getBroadcastAudience, sendBroadcast } from "@/lib/api";
import { PageHeader, Spinner } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const SEGMENTS = ["REGULAR", "AT_RISK", "ALL"] as const;

export default function BroadcastPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [segment, setSegment] = useState<string>("REGULAR");
  const [message, setMessage] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["broadcast-audience"], queryFn: getBroadcastAudience });

  const sendMut = useMutation({
    mutationFn: () => sendBroadcast(segment, message),
    onSuccess: (r) => {
      setMessage("");
      setBanner(t("broadcast.sent", { n: r.sent }));
      qc.invalidateQueries({ queryKey: ["broadcast-audience"] });
    },
    onError: (e: any) => {
      const code = e?.response?.data?.code;
      setBanner(code === "BROADCAST_LIMIT" ? t("broadcast.limitReached") : t("common.error"));
    },
  });

  if (isLoading || !data) return <Spinner label={t("common.loading")} />;

  const count = data.counts[segment] ?? 0;
  const limitReached = data.sentThisWeek >= data.weeklyLimit;

  return (
    <div className="p-5 md:p-8 max-w-xl mx-auto">
      <PageHeader title={t("broadcast.title")} subtitle={t("broadcast.subtitle")} />

      {banner && <div className="mb-4 rounded-xl bg-[#00C853]/10 text-[#00875A] text-sm px-4 py-2.5">{banner}</div>}

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
        {/* Audience */}
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-2">{t("broadcast.sendTo")}</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {SEGMENTS.map((s) => {
            const n = data.counts[s] ?? 0;
            const active = segment === s;
            return (
              <button key={s} onClick={() => setSegment(s)}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  active ? "bg-[#0D1117] text-white border-[#0D1117]" : "bg-white text-[#374151] border-[#E5E7EB] hover:border-[#00C853]"
                }`}>
                {t(`seg.${s}`)} {n}
              </button>
            );
          })}
        </div>

        {/* Message */}
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-2">{t("broadcast.message")}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("broadcast.placeholder")}
          rows={4}
          maxLength={1000}
          className="w-full p-3 rounded-xl border border-[#E5E7EB] text-sm outline-none focus:ring-2 focus:ring-[#00C853]/30 resize-none mb-3"
        />

        <p className="text-xs text-[#9CA3AF] mb-1">{t("broadcast.note")}</p>
        <p className="text-xs text-[#9CA3AF] mb-4">{t("broadcast.limit", { n: data.sentThisWeek })}</p>

        <button
          onClick={() => {
            if (!message.trim()) { setBanner(t("broadcast.empty")); return; }
            sendMut.mutate();
          }}
          disabled={sendMut.isPending || limitReached || count === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00C853] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#00b34a]"
        >
          <Send size={16} /> {limitReached ? t("broadcast.limitReached") : t("broadcast.send", { n: count })}
        </button>
      </div>
    </div>
  );
}
