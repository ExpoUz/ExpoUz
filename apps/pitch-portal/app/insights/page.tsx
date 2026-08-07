"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCrmInsights } from "@/lib/api";
import { PageHeader, Spinner, StatCard } from "@/components/ui";
import { SegmentBadge, Avatar } from "@/components/crm";
import { useI18n, useRelativeTime } from "@/lib/i18n";

export default function InsightsPage() {
  const { t } = useI18n();
  const rel = useRelativeTime();
  const { data, isLoading } = useQuery({ queryKey: ["crm-insights"], queryFn: getCrmInsights });

  if (isLoading || !data) return <Spinner label={t("common.loading")} />;

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto">
      <PageHeader title={t("insights.title")} subtitle={t("insights.subtitle")} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label={t("insights.repeatRate")} value={`${data.repeatRate}%`} hint={t("insights.repeatRate.hint")} />
        <StatCard label={t("insights.regulars")} value={data.regulars} hint={t("insights.regulars.hint", { n: data.regularsGainedThisMonth })} accent="#8B5CF6" />
        <StatCard label={t("insights.newThisMonth")} value={data.newThisMonth} accent="#00B0FF" />
      </div>

      {/* At-risk list with invite-back */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-[#0D1117] mb-2">{t("insights.atRisk")}</h2>
        {data.atRisk?.length > 0 ? (
          <div className="space-y-2">
            {data.atRisk.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 bg-white rounded-2xl border border-[#E5E7EB] p-3.5 shadow-sm">
                <Avatar url={p.avatarUrl} first={p.firstName} last={p.lastName} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#0D1117] truncate text-sm">{p.firstName} {p.lastName?.[0] ?? ""}.</div>
                  <div className="text-xs text-[#6B7280]">{p.gamesHere} {t("detail.games")} · {rel(p.lastVisit)}</div>
                </div>
                <SegmentBadge segment={p.segment} />
                <Link href={`/players/${p.id}`} className="px-3 py-1.5 rounded-lg bg-[#00C853] text-white text-xs font-semibold whitespace-nowrap">
                  {t("insights.inviteBack")}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9CA3AF] bg-white rounded-2xl border border-dashed border-[#E5E7EB] p-4">{t("insights.atRisk.none")}</p>
        )}
      </section>

      {/* Slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SlotList title={t("insights.busiest")} slots={data.busiest} emptyLabel={t("insights.slots.none")} accent="#00875A" />
        <SlotList title={t("insights.quietest")} slots={data.quietest} emptyLabel={t("insights.slots.none")} accent="#B45309" />
      </div>
    </div>
  );
}

function SlotList({ title, slots, emptyLabel, accent }: { title: string; slots?: { slot: string; count: number }[]; emptyLabel: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-sm">
      <h3 className="text-sm font-bold text-[#0D1117] mb-3">{title}</h3>
      {slots && slots.length > 0 ? (
        <ul className="space-y-2">
          {slots.map((s) => (
            <li key={s.slot} className="flex items-center justify-between text-sm">
              <span className="text-[#0D1117]">{s.slot}:00</span>
              <span className="font-semibold" style={{ color: accent }}>{s.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[#9CA3AF]">{emptyLabel}</p>
      )}
    </div>
  );
}
