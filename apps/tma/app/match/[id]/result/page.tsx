"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import {
  getMatch,
  getMatchResult,
  getMatchPlayers,
  submitMatchResult,
  confirmMatchResult,
  disputeMatchResult,
  getMe,
} from "@/lib/api";
import { SkillBadge } from "@/components/SkillBadge";
import {
  showMainButton,
  hideMainButton,
  showBackButton,
  setMainButtonLoading,
  hapticImpact,
  hapticSuccess,
  hapticError,
  showAlert,
} from "@/lib/telegram";

export default function MatchResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations("result");

  const { data: me } = useQuery({ queryKey: ["tma-me"], queryFn: getMe });
  const { data: match } = useQuery({ queryKey: ["match", id], queryFn: () => getMatch(id) });
  const { data: players } = useQuery({ queryKey: ["match-players", id], queryFn: () => getMatchPlayers(id) });
  const { data: result, isLoading } = useQuery({ queryKey: ["match-result", id], queryFn: () => getMatchResult(id) });

  // Set scores: [team1, team2] per set
  const [sets, setSets] = useState<[number, number][]>([
    [0, 0],
    [0, 0],
    [0, 0],
  ]);

  const { team1, team2 } = useMemo(() => {
    const list = players ?? [];
    const home = list.filter((p: any) => p.teamSide === "HOME");
    const away = list.filter((p: any) => p.teamSide === "AWAY");
    if (home.length === 0 && away.length === 0 && list.length > 0) {
      const half = Math.ceil(list.length / 2);
      return { team1: list.slice(0, half), team2: list.slice(half) };
    }
    return { team1: home, team2: away };
  }, [players]);

  const alreadyConfirmed = result?.confirmedBy?.includes(me?.id);
  const isSubmitter = result?.submittedById === me?.id;

  async function submit() {
    setMainButtonLoading(true);
    try {
      const [s1, s2, s3] = sets;
      await submitMatchResult(id, {
        team1Set1: s1[0], team2Set1: s1[1],
        team1Set2: s2[0], team2Set2: s2[1],
        ...(s3[0] || s3[1] ? { team1Set3: s3[0], team2Set3: s3[1] } : {}),
      });
      hapticSuccess();
      await qc.invalidateQueries({ queryKey: ["match-result", id] });
    } catch (e: any) {
      hapticError();
      showAlert(e?.response?.data?.message ?? t("errSubmit"));
    } finally {
      setMainButtonLoading(false);
    }
  }

  async function confirm() {
    setMainButtonLoading(true);
    try {
      await confirmMatchResult(id);
      hapticSuccess();
      await qc.invalidateQueries({ queryKey: ["match-result", id] });
      await qc.invalidateQueries({ queryKey: ["tma-statistics"] });
    } catch (e: any) {
      hapticError();
      showAlert(e?.response?.data?.message ?? t("errConfirm"));
    } finally {
      setMainButtonLoading(false);
    }
  }

  async function dispute() {
    try {
      await disputeMatchResult(id);
      hapticImpact("medium");
      await qc.invalidateQueries({ queryKey: ["match-result", id] });
    } catch (e: any) {
      showAlert(e?.response?.data?.message ?? t("errDispute"));
    }
  }

  // Main button changes with state: submit / confirm / done
  const actionRef = useRef<() => void>(() => {});
  actionRef.current = () => {
    if (!result) submit();
    else if (!result.isConfirmed && !alreadyConfirmed) confirm();
    else router.replace("/profile");
  };

  useEffect(() => {
    let label = t("btnSubmit");
    if (result?.isConfirmed) label = t("btnDone");
    else if (result && !alreadyConfirmed) label = t("btnConfirm");
    else if (result && alreadyConfirmed) label = t("btnWaiting");
    const cleanup = showMainButton(label, () => actionRef.current());
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [result, alreadyConfirmed]);

  useEffect(() => {
    const cleanup = showBackButton(() => router.back());
    return cleanup;
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center pt-24">
        <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const winningTeam = result?.winningTeam;

  return (
    <div className="min-h-screen pb-28 px-4 pt-5">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm mt-0.5" style={{ color: "var(--tg-hint)" }}>
        {match?.pitch?.name ?? t("padelMatch")} · {t("bestOf3")}
      </p>

      {result?.isConfirmed && (
        <div className="mt-4 rounded-2xl p-3 text-sm font-semibold text-center text-white" style={{ background: "#00C853" }}>
          {t("confirmed")}
        </div>
      )}
      {result && !result.isConfirmed && result.isDisputed && (
        <div className="mt-4 rounded-2xl p-3 text-sm font-semibold text-center" style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>
          {t("disputed")}
        </div>
      )}
      {result && !result.isConfirmed && !result.isDisputed && (
        <div className="mt-4 rounded-2xl p-3 text-sm text-center" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
          {alreadyConfirmed ? t("waitingConfirm") : t("reviewScore")}
        </div>
      )}

      {/* Teams + scores */}
      <div className="mt-5 rounded-2xl p-4" style={{ background: "var(--tg-card)" }}>
        <TeamRow team={team1} label={t("team1")} highlight={winningTeam === 1} />

        <div className="my-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <SetColumn
              key={i}
              index={i}
              optional={i === 2}
              value={sets[i]}
              editable={!result}
              displayValue={
                result
                  ? [
                      [result.team1Set1, result.team2Set1],
                      [result.team1Set2, result.team2Set2],
                      [result.team1Set3, result.team2Set3],
                    ][i] as [number | null, number | null]
                  : undefined
              }
              onChange={(v) => setSets((prev) => prev.map((s, j) => (j === i ? v : s)) as [number, number][])}
            />
          ))}
        </div>

        <TeamRow team={team2} label={t("team2")} highlight={winningTeam === 2} />
      </div>

      {/* Dispute action (only while pending and not the submitter) */}
      {result && !result.isConfirmed && !alreadyConfirmed && !isSubmitter && (
        <button
          onClick={dispute}
          className="mt-4 w-full rounded-2xl py-3 font-semibold border-2"
          style={{ borderColor: "#EF4444", color: "#EF4444", background: "transparent" }}
        >
          {t("disputeScore")}
        </button>
      )}
    </div>
  );
}

function TeamRow({ team, label, highlight }: { team: any[]; label: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {(team.length ? team : [null]).map((p, i) => (
            <div
              key={p?.id ?? i}
              className="w-9 h-9 rounded-full bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-xs font-bold overflow-hidden ring-2 ring-white"
            >
              {p?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (p?.firstName?.[0] ?? "?").toUpperCase()
              )}
            </div>
          ))}
        </div>
        <div>
          <div className="text-sm font-semibold flex items-center gap-1.5">
            {team.map((p) => p.firstName).join(" & ") || label}
            {highlight && <Trophy size={14} style={{ color: "#F59E0B" }} aria-label="Winner" />}
          </div>
          <div className="flex gap-1 mt-0.5">
            {team.map((p) => (
              <SkillBadge key={p.id} level={p.padelLevel ?? p.eloRating} size="xs" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetColumn({
  index,
  optional,
  value,
  editable,
  displayValue,
  onChange,
}: {
  index: number;
  optional?: boolean;
  value: [number, number];
  editable: boolean;
  displayValue?: [number | null, number | null];
  onChange: (v: [number, number]) => void;
}) {
  const t = useTranslations("result");
  const top = displayValue ? displayValue[0] : value[0];
  const bottom = displayValue ? displayValue[1] : value[1];
  if (displayValue && top == null && bottom == null) {
    return (
      <div className="text-center text-xs flex items-center justify-center" style={{ color: "var(--tg-hint)" }}>
        —
      </div>
    );
  }
  return (
    <div className="text-center">
      <div className="text-[10px] mb-1" style={{ color: "var(--tg-hint)" }}>
        {t("set", { n: index + 1 })}
        {optional ? ` ${t("ifNeeded")}` : ""}
      </div>
      <ScoreStepper value={Number(top ?? 0)} editable={editable} onChange={(n) => onChange([n, value[1]])} />
      <div className="h-1" />
      <ScoreStepper value={Number(bottom ?? 0)} editable={editable} onChange={(n) => onChange([value[0], n])} />
    </div>
  );
}

function ScoreStepper({ value, editable, onChange }: { value: number; editable: boolean; onChange: (n: number) => void }) {
  if (!editable) {
    return <div className="text-xl font-bold py-1">{value}</div>;
  }
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        onClick={() => { hapticImpact("light"); onChange(Math.max(0, value - 1)); }}
        className="w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.06)" }}
      >
        −
      </button>
      <span className="text-lg font-bold w-5 text-center">{value}</span>
      <button
        onClick={() => { hapticImpact("light"); onChange(Math.min(7, value + 1)); }}
        className="w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center text-white"
        style={{ background: "#00C853" }}
      >
        +
      </button>
    </div>
  );
}
