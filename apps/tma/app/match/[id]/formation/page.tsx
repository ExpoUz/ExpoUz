"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFormation, joinMatch } from "@/lib/api";
import {
  showBackButton,
  hapticImpact,
  hapticSuccess,
  hapticError,
  showAlert,
} from "@/lib/telegram";

// Group roles into pitch lines (back → front for each team)
const LINE_OF: Record<string, number> = {
  GK: 0,
  CB: 1, LB: 1, RB: 1, CDM: 1,
  CM: 2, LM: 2, RM: 2, CAM: 2,
  ST: 3, CF: 3, SS: 3, LW: 3, RW: 3, ANY: 2,
};

function toLines(positions: any[]): any[][] {
  const lines: any[][] = [[], [], [], []];
  for (const p of positions) {
    const line = LINE_OF[p.position] ?? 2;
    lines[line].push(p);
  }
  return lines;
}

export default function FormationPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tma-formation", id],
    queryFn: () => getFormation(id),
  });

  const take = useMutation({
    mutationFn: (positionId: string) => joinMatch(id, { positionId }),
    onSuccess: () => {
      hapticSuccess();
      qc.invalidateQueries({ queryKey: ["tma-formation", id] });
      qc.invalidateQueries({ queryKey: ["tma-match", id] });
    },
    onError: (e: any) => {
      hapticError();
      showAlert(e?.response?.data?.message ?? "Could not take this position.");
    },
  });

  useEffect(() => {
    const cleanup = showBackButton(() => router.back());
    return cleanup;
  }, [router]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex justify-center pt-24">
        <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // AWAY at top (lines reversed so attack faces centre), HOME at bottom.
  const awayLines = toLines(data.away).slice().reverse();
  const homeLines = toLines(data.home);

  const onTake = (pos: any) => {
    if (pos.booking) return;
    hapticImpact("medium");
    take.mutate(pos.id);
  };

  return (
    <div className="min-h-screen pb-10">
      <header className="px-4 pt-5 pb-3 text-center">
        <h1 className="text-lg font-bold">Lineup</h1>
        <p className="text-xs" style={{ color: "var(--tg-hint)" }}>
          Tap an open spot to take your position
        </p>
      </header>

      {/* Pitch */}
      <div className="mx-4 rounded-3xl overflow-hidden relative" style={{ background: "#0B6B2E" }}>
        {/* pitch markings */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-white/30" />
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/30" />
          <div className="absolute inset-3 border-2 border-white/20 rounded-2xl" />
        </div>

        {/* AWAY half */}
        <div className="relative py-5 px-3 space-y-5">
          <TeamLabel side="AWAY" />
          {awayLines.map((line, i) =>
            line.length ? (
              <PitchLine key={`a-${i}`} positions={line} onTake={onTake} side="AWAY" />
            ) : null
          )}
        </div>

        {/* HOME half */}
        <div className="relative py-5 px-3 space-y-5">
          {homeLines
            .slice()
            .reverse()
            .map((line, i) =>
              line.length ? (
                <PitchLine key={`h-${i}`} positions={line} onTake={onTake} side="HOME" />
              ) : null
            )}
          <TeamLabel side="HOME" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 text-xs" style={{ color: "var(--tg-hint)" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#00C853]" /> Home
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#FF5252]" /> Away
        </span>
      </div>
    </div>
  );
}

function TeamLabel({ side }: { side: "HOME" | "AWAY" }) {
  return (
    <div className="text-center">
      <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">
        {side === "HOME" ? "Home" : "Away"}
      </span>
    </div>
  );
}

function PitchLine({
  positions,
  onTake,
  side,
}: {
  positions: any[];
  onTake: (p: any) => void;
  side: "HOME" | "AWAY";
}) {
  return (
    <div className="flex justify-around items-center">
      {positions.map((p) => (
        <PositionSpot key={p.id} pos={p} onTake={onTake} side={side} />
      ))}
    </div>
  );
}

function PositionSpot({
  pos,
  onTake,
  side,
}: {
  pos: any;
  onTake: (p: any) => void;
  side: "HOME" | "AWAY";
}) {
  const user = pos.booking?.user;
  const ring = side === "HOME" ? "#00C853" : "#FF5252";

  if (user) {
    const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";
    return (
      <div className="flex flex-col items-center gap-1 w-16">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden border-2"
          style={{ background: ring, borderColor: "white" }}
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <span className="text-[10px] text-white truncate w-full text-center">{user.firstName}</span>
        <span className="text-[9px] text-white/60">{pos.position}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onTake(pos)}
      className="flex flex-col items-center gap-1 w-16 active:scale-95 transition-transform"
    >
      <div
        className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center text-white/70 text-lg"
        style={{ borderColor: "rgba(255,255,255,0.5)" }}
      >
        +
      </div>
      <span className="text-[10px] text-white/80">Open</span>
      <span className="text-[9px] text-white/50">{pos.position}</span>
    </button>
  );
}
