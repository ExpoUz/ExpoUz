"use client";

import { useMemo } from "react";
import dayjs from "dayjs";

interface Point {
  level: number;
  createdAt: string;
  reason?: string;
}

// Dependency-free SVG line chart of skill-rating progression over time.
// Green line with a gradient fill below it (Playtomic-style level chart).
export function LevelChart({ history }: { history: Point[] }) {
  const W = 320;
  const H = 140;
  const PAD = { top: 12, right: 10, bottom: 18, left: 26 };

  const geom = useMemo(() => {
    if (!history || history.length === 0) return null;
    const pts = history.map((h) => ({ ...h, t: dayjs(h.createdAt).valueOf() }));
    const levels = pts.map((p) => p.level);
    const minL = Math.max(0, Math.floor(Math.min(...levels) * 2) / 2 - 0.5);
    const maxL = Math.min(7, Math.ceil(Math.max(...levels) * 2) / 2 + 0.5);
    const span = maxL - minL || 1;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const n = pts.length;

    const x = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (lvl: number) => PAD.top + innerH - ((lvl - minL) / span) * innerH;

    const coords = pts.map((p, i) => ({ x: x(i), y: y(p.level), ...p }));
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${coords[0].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;

    // ~4 horizontal gridlines
    const ticks: number[] = [];
    const step = span / 3;
    for (let i = 0; i <= 3; i++) ticks.push(Number((minL + step * i).toFixed(1)));

    return { coords, line, area, y, ticks, minL, maxL };
  }, [history]);

  if (!geom) {
    return (
      <div
        className="rounded-2xl py-12 text-center text-sm"
        style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}
      >
        No level history yet — play a competitive match to start your progression.
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3" style={{ background: "var(--tg-card)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="levelFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00C853" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
          </linearGradient>
        </defs>

        {geom.ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={geom.y(t)}
              y2={geom.y(t)}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={1}
            />
            <text x={4} y={geom.y(t) + 3} fontSize={9} fill="var(--tg-hint)">
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={geom.area} fill="url(#levelFill)" />
        <path d={geom.line} fill="none" stroke="#00C853" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />

        {geom.coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={2.8} fill="#fff" stroke="#00C853" strokeWidth={1.8} />
        ))}
      </svg>
    </div>
  );
}
