"use client";

import { formatLevel, getSkillBand } from "@/lib/api";

interface VsPlayer {
  id: string;
  firstName?: string;
  avatarUrl?: string | null;
  padelLevel?: number;
}

function teamAvg(team: (VsPlayer | null)[]): number | null {
  const present = team.filter(Boolean) as VsPlayer[];
  if (!present.length) return null;
  return present.reduce((s, p) => s + Number(p.padelLevel ?? 0), 0) / present.length;
}

// Team A vs Team B matchup preview. Doubles as a live "who's in so far" view —
// it re-renders whenever the parent's match query refetches (e.g. after a join).
export function VersusPreview({
  teamA,
  teamB,
}: {
  teamA: (VsPlayer | null)[];
  teamB: (VsPlayer | null)[];
}) {
  const avgA = teamAvg(teamA);
  const avgB = teamAvg(teamB);
  const gap = avgA != null && avgB != null ? Math.abs(avgA - avgB) : null;
  const balance =
    gap == null ? null : gap < 0.3 ? "⚖️ Even match" : gap < 0.8 ? "Slight edge" : "Mismatch";

  return (
    <div className="vs-preview">
      <div className="vs-side">
        <div className="vs-avatars">
          {teamA.map((p, i) => (
            <VsAvatar key={p?.id ?? `a-${i}`} player={p} />
          ))}
        </div>
        <div className="vs-team-label" style={{ color: "#00875A" }}>Team A</div>
        <div className="vs-team-level">avg {avgA != null ? avgA.toFixed(1) : "—"}</div>
      </div>

      <div className="vs-center">
        <div className="vs-badge">VS</div>
        {balance && <span className="vs-balance">{balance}</span>}
      </div>

      <div className="vs-side">
        <div className="vs-avatars">
          {teamB.map((p, i) => (
            <VsAvatar key={p?.id ?? `b-${i}`} player={p} />
          ))}
        </div>
        <div className="vs-team-label" style={{ color: "#0066B0" }}>Team B</div>
        <div className="vs-team-level">avg {avgB != null ? avgB.toFixed(1) : "—"}</div>
      </div>

      <style jsx>{`
        .vs-preview {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          padding: 18px 16px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(0, 200, 83, 0.07), rgba(0, 176, 255, 0.07));
          border: 1px solid rgba(0, 0, 0, 0.06);
          position: relative;
          overflow: hidden;
          animation: vs-fade 0.3s ease both;
        }
        .vs-preview::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: linear-gradient(
            90deg,
            transparent 49.5%,
            rgba(0, 0, 0, 0.05) 49.5%,
            rgba(0, 0, 0, 0.05) 50.5%,
            transparent 50.5%
          );
          pointer-events: none;
        }
        .vs-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          z-index: 1;
        }
        .vs-side:first-of-type {
          animation: vs-slide-l 0.32s ease both;
        }
        .vs-side:last-of-type {
          animation: vs-slide-r 0.32s ease both;
        }
        .vs-avatars {
          display: flex;
          gap: 8px;
        }
        .vs-team-label {
          font-size: 12px;
          font-weight: 800;
        }
        .vs-team-level {
          font-size: 11px;
          color: var(--tg-hint);
          font-variant-numeric: tabular-nums;
        }
        .vs-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          z-index: 1;
        }
        .vs-badge {
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 0.06em;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--tg-bg);
          color: var(--tg-text);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
          animation: vs-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .vs-balance {
          font-size: 10px;
          font-weight: 700;
          color: var(--tg-hint);
          white-space: nowrap;
        }
        @keyframes vs-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes vs-slide-l {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes vs-slide-r {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes vs-pop {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function VsAvatar({ player }: { player: VsPlayer | null }) {
  if (!player) {
    return (
      <div className="vs-avatar-empty">
        <span>+</span>
        <span className="vs-empty-label">Open</span>
        <style jsx>{`
          .vs-avatar-empty {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: 2px dashed rgba(0, 0, 0, 0.18);
            display: grid;
            place-items: center;
            color: var(--tg-hint);
            font-size: 18px;
            position: relative;
          }
          .vs-empty-label {
            position: absolute;
            bottom: -16px;
            font-size: 9px;
            font-weight: 600;
          }
        `}</style>
      </div>
    );
  }
  const band = getSkillBand(Number(player.padelLevel ?? 0));
  const initial = (player.firstName?.[0] ?? "?").toUpperCase();
  return (
    <div className="vs-avatar">
      <div className="vs-avatar-img">
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.avatarUrl} alt={player.firstName ?? ""} />
        ) : (
          <span className="vs-initial">{initial}</span>
        )}
        <span className="vs-level-badge" style={{ background: band.color }}>
          {formatLevel(player.padelLevel)}
        </span>
      </div>
      <span className="vs-name">{player.firstName ?? "Player"}</span>
      <style jsx>{`
        .vs-avatar {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
        }
        .vs-avatar-img {
          position: relative;
          width: 52px;
          height: 52px;
        }
        .vs-avatar-img img,
        .vs-initial {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
          display: grid;
          place-items: center;
          background: rgba(0, 200, 83, 0.15);
          color: #00875a;
          font-weight: 700;
        }
        .vs-level-badge {
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 800;
          color: #fff;
          padding: 1px 6px;
          border-radius: 999px;
          border: 2px solid var(--tg-bg);
          line-height: 1.2;
        }
        .vs-name {
          font-size: 12px;
          font-weight: 600;
          max-width: 64px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
