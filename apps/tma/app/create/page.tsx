"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getPitches, createMatch, formatUZS } from "@/lib/api";
import {
  showMainButton,
  hideMainButton,
  showBackButton,
  setMainButtonLoading,
  hapticSuccess,
  hapticError,
  hapticImpact,
  showAlert,
} from "@/lib/telegram";

const FORMATS = ["5v5", "6v6", "7v7", "8v8", "11v11"];
const DURATIONS = [60, 90, 120];

interface Form {
  pitchId: string;
  format: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  maxPlayers: number;
  pricePerPlayer: number;
}

export default function CreateMatchPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0..3
  const [submitting, setSubmitting] = useState(false);

  const { data: pitches } = useQuery({ queryKey: ["tma-pitches"], queryFn: () => getPitches() });

  const [form, setForm] = useState<Form>({
    pitchId: "",
    format: "7v7",
    date: dayjs().add(1, "day").format("YYYY-MM-DD"),
    time: "19:00",
    durationMinutes: 60,
    maxPlayers: 14,
    pricePerPlayer: 50000,
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Derive default maxPlayers from format when format changes
  function pickFormat(fmt: string) {
    hapticImpact("light");
    const perSide = parseInt(fmt.split("v")[0], 10) || 7;
    set("format", fmt);
    set("maxPlayers", perSide * 2);
  }

  const canProceed = useMemo(() => {
    if (step === 0) return !!form.pitchId;
    if (step === 1) return !!form.date && !!form.time && !!form.format;
    if (step === 2) return form.maxPlayers > 0 && form.pricePerPlayer >= 0;
    return true;
  }, [step, form]);

  async function submit() {
    setSubmitting(true);
    setMainButtonLoading(true);
    try {
      const startTime = dayjs(`${form.date}T${form.time}`).toISOString();
      const match = await createMatch({
        pitchId: form.pitchId,
        format: form.format,
        startTime,
        durationMinutes: form.durationMinutes,
        maxPlayers: form.maxPlayers,
        pricePerPlayer: form.pricePerPlayer,
      });
      hapticSuccess();
      router.replace(`/match/${match.id}`);
    } catch (e: any) {
      hapticError();
      showAlert(e?.response?.data?.message ?? "Could not create the match.");
      setSubmitting(false);
      setMainButtonLoading(false);
    }
  }

  // Keep an always-fresh action handler for the Telegram Main Button.
  const actionRef = useRef<() => void>(() => {});
  actionRef.current = () => {
    if (!canProceed || submitting) return;
    if (step < 3) {
      hapticImpact("light");
      setStep((s) => s + 1);
    } else {
      submit();
    }
  };

  // Register Main Button; label depends on step.
  useEffect(() => {
    const label = step < 3 ? "Continue" : "Create Match";
    const cleanup = showMainButton(label, () => actionRef.current());
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [step]);

  // Back button steps backwards, or leaves on step 0.
  useEffect(() => {
    const cleanup = showBackButton(() => {
      if (step > 0) setStep((s) => s - 1);
      else router.back();
    });
    return cleanup;
  }, [step, router]);

  return (
    <div className="min-h-screen pb-28 px-4 pt-5">
      {/* Progress */}
      <div className="flex gap-1.5 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i <= step ? "#00C853" : "rgba(0,0,0,0.1)" }}
          />
        ))}
      </div>

      <h1 className="text-xl font-bold mb-1">
        {["Choose a pitch", "Date & format", "Players & price", "Review"][step]}
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--tg-hint)" }}>
        Step {step + 1} of 4
      </p>

      {/* STEP 0 — Pitch */}
      {step === 0 && (
        <div className="space-y-2">
          {(pitches ?? []).length === 0 && (
            <p className="text-sm" style={{ color: "var(--tg-hint)" }}>
              No pitches available yet.
            </p>
          )}
          {(pitches ?? []).map((p: any) => (
            <button
              key={p.id}
              onClick={() => {
                hapticImpact("light");
                set("pitchId", p.id);
              }}
              className="w-full flex items-center gap-3 rounded-2xl p-3 text-left border-2 transition-colors"
              style={{
                background: "var(--tg-card)",
                borderColor: form.pitchId === p.id ? "#00C853" : "transparent",
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-[#0D1117] overflow-hidden flex items-center justify-center text-xl shrink-0">
                {p.photos?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photos[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  "🏟"
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{p.name}</div>
                <div className="text-xs truncate" style={{ color: "var(--tg-hint)" }}>
                  {p.district ?? p.city ?? "Tashkent"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP 1 — Date & format */}
      {step === 1 && (
        <div className="space-y-5">
          <Field label="Date">
            <input
              type="date"
              value={form.date}
              min={dayjs().format("YYYY-MM-DD")}
              onChange={(e) => set("date", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Kick-off time">
            <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} className="input" />
          </Field>
          <Field label="Format">
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Chip key={f} active={form.format === f} onClick={() => pickFormat(f)}>
                  {f}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Duration">
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <Chip key={d} active={form.durationMinutes === d} onClick={() => set("durationMinutes", d)}>
                  {d} min
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* STEP 2 — Players & price */}
      {step === 2 && (
        <div className="space-y-5">
          <Field label="Max players">
            <Stepper value={form.maxPlayers} min={2} max={30} onChange={(v) => set("maxPlayers", v)} />
          </Field>
          <Field label="Price per player (UZS)">
            <input
              type="number"
              inputMode="numeric"
              value={form.pricePerPlayer}
              min={0}
              step={5000}
              onChange={(e) => set("pricePerPlayer", Number(e.target.value))}
              className="input"
            />
          </Field>
          <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
            Collected if full: <span className="font-semibold text-[#00C853]">{formatUZS(form.maxPlayers * form.pricePerPlayer)}</span>
          </div>
        </div>
      )}

      {/* STEP 3 — Review */}
      {step === 3 && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--tg-card)" }}>
          <ReviewRow label="Pitch" value={pitches?.find((p: any) => p.id === form.pitchId)?.name ?? "—"} />
          <ReviewRow label="When" value={dayjs(`${form.date}T${form.time}`).format("ddd, MMM D · HH:mm")} />
          <ReviewRow label="Format" value={form.format} />
          <ReviewRow label="Duration" value={`${form.durationMinutes} min`} />
          <ReviewRow label="Max players" value={String(form.maxPlayers)} />
          <ReviewRow label="Price / player" value={formatUZS(form.pricePerPlayer)} />
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          background: var(--tg-card);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 15px;
          color: var(--tg-text);
          outline: none;
        }
        .input:focus {
          border-color: #00c853;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors"
      style={{
        background: active ? "#00C853" : "var(--tg-card)",
        color: active ? "#fff" : "var(--tg-text)",
        borderColor: active ? "#00C853" : "rgba(0,0,0,0.1)",
      }}
    >
      {children}
    </button>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <StepBtn onClick={() => onChange(Math.max(min, value - 1))}>−</StepBtn>
      <span className="text-xl font-bold w-10 text-center">{value}</span>
      <StepBtn onClick={() => onChange(Math.min(max, value + 1))}>+</StepBtn>
    </div>
  );
}

function StepBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        hapticImpact("light");
        onClick();
      }}
      className="w-11 h-11 rounded-full text-xl font-bold flex items-center justify-center"
      style={{ background: "var(--tg-card)", border: "1px solid rgba(0,0,0,0.1)" }}
    >
      {children}
    </button>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: "var(--tg-hint)" }}>{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}
