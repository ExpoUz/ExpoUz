"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getPitches, createMatch, getPricingPreview, formatUZS } from "@/lib/api";
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

const FORMATS = ["1v1", "2v2"]; // padel: singles / doubles
const FORMAT_LABELS: Record<string, string> = { "1v1": "Singles (1v1)", "2v2": "Doubles (2v2)" };
const DURATIONS = [60, 90, 120];
const capForFormat = (f: string) => {
  const m = f.match(/^(\d+)v(\d+)$/);
  return m ? parseInt(m[1], 10) + parseInt(m[2], 10) : 4;
};

type BookingType = "OPEN_EVENT" | "GROUP_BOOKING" | "FULL_BOOKING";

const BOOKING_TYPES: {
  type: BookingType;
  icon: string;
  title: string;
  description: string;
  color: string;
}[] = [
  {
    type: "OPEN_EVENT",
    icon: "📢",
    title: "Open Event",
    description: "Create a public game. Anyone can join up to your limit.",
    color: "#00C853",
  },
  {
    type: "GROUP_BOOKING",
    icon: "👥",
    title: "Group Booking",
    description: "Pay for your group upfront, invite others to fill remaining spots.",
    color: "#00B0FF",
  },
  {
    type: "FULL_BOOKING",
    icon: "🏟️",
    title: "Full Pitch",
    description: "Book the entire pitch for your team. Private or open to others.",
    color: "#FF5252",
  },
];

type MatchType = "COMPETITIVE" | "CASUAL";

interface Form {
  bookingType: BookingType;
  matchType: MatchType;
  pitchId: string;
  format: string;
  date: string;
  time: string;
  durationMinutes: number;
  // OPEN_EVENT
  maxPlayers: number;
  pricePerPlayer: number;
  // GROUP_BOOKING
  organizerPlayerCount: number;
  extraSpotsAvailable: number;
  // FULL_BOOKING
  fullBookingHours: number;
  isPrivate: boolean;
}

const STEP_TITLES = ["Booking type", "Choose a pitch", "Match details", "Review & pricing"];

export default function CreateMatchPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0..3
  const [submitting, setSubmitting] = useState(false);

  const { data: pitches } = useQuery({ queryKey: ["tma-pitches"], queryFn: () => getPitches() });

  const [form, setForm] = useState<Form>({
    bookingType: "OPEN_EVENT",
    matchType: "COMPETITIVE",
    pitchId: "",
    format: "2v2",
    date: dayjs().add(1, "day").format("YYYY-MM-DD"),
    time: "19:00",
    durationMinutes: 60,
    maxPlayers: 4,
    pricePerPlayer: 50000,
    organizerPlayerCount: 3,
    extraSpotsAvailable: 4,
    fullBookingHours: 1,
    isPrivate: false,
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const selectedPitch = useMemo(
    () => (pitches ?? []).find((p: any) => p.id === form.pitchId),
    [pitches, form.pitchId],
  );

  function pickFormat(fmt: string) {
    hapticImpact("light");
    const perSide = parseInt(fmt.split("v")[0], 10) || 7;
    set("format", fmt);
    set("maxPlayers", perSide * 2);
  }

  // Pricing preview (review step)
  const { data: pricing } = useQuery({
    queryKey: [
      "tma-pricing",
      form.bookingType,
      form.pitchId,
      form.organizerPlayerCount,
      form.extraSpotsAvailable,
      form.fullBookingHours,
      form.pricePerPlayer,
    ],
    queryFn: () =>
      getPricingPreview({
        pitchId: form.pitchId,
        bookingType: form.bookingType,
        organizerPlayerCount: form.organizerPlayerCount,
        extraSpotsAvailable: form.extraSpotsAvailable,
        fullBookingHours: form.fullBookingHours,
        pricePerPlayer: form.pricePerPlayer,
      }),
    enabled: step === 3 && !!form.pitchId,
  });

  const canProceed = useMemo(() => {
    if (step === 0) return !!form.bookingType;
    if (step === 1) return !!form.pitchId;
    if (step === 2) {
      if (!form.date || !form.time) return false;
      if (form.bookingType === "OPEN_EVENT") return !!form.format && form.maxPlayers > 0 && form.pricePerPlayer >= 0;
      if (form.bookingType === "GROUP_BOOKING") return !!form.format && form.organizerPlayerCount >= 1;
      if (form.bookingType === "FULL_BOOKING") return form.fullBookingHours >= 1;
    }
    return true;
  }, [step, form]);

  async function submit() {
    setSubmitting(true);
    setMainButtonLoading(true);
    try {
      const startTime = dayjs(`${form.date}T${form.time}`).toISOString();
      const base: any = {
        pitchId: form.pitchId,
        bookingType: form.bookingType,
        format: form.format,
        startTime,
        durationMinutes: form.durationMinutes,
      };
      if (form.bookingType !== "FULL_BOOKING") {
        base.matchType = form.matchType;
      }
      if (form.bookingType === "OPEN_EVENT") {
        base.maxPlayers = form.maxPlayers;
        base.pricePerPlayer = form.pricePerPlayer;
      } else if (form.bookingType === "GROUP_BOOKING") {
        base.organizerPlayerCount = form.organizerPlayerCount;
        base.extraSpotsAvailable = form.extraSpotsAvailable;
        base.pricePerPlayer = pricing?.perJoiningPlayer ?? form.pricePerPlayer;
      } else if (form.bookingType === "FULL_BOOKING") {
        base.fullBookingHours = form.fullBookingHours;
        base.isPrivate = form.isPrivate;
      }
      const match = await createMatch(base);
      hapticSuccess();
      router.replace(`/match/${match.id}?created=1`);
    } catch (e: any) {
      hapticError();
      showAlert(e?.response?.data?.message ?? "Could not create the match.");
      setSubmitting(false);
      setMainButtonLoading(false);
    }
  }

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

  useEffect(() => {
    const label = step < 3 ? "Continue" : "Create Match";
    const cleanup = showMainButton(label, () => actionRef.current());
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [step]);

  useEffect(() => {
    const cleanup = showBackButton(() => {
      if (step > 0) setStep((s) => s - 1);
      else router.back();
    });
    return cleanup;
  }, [step, router]);

  return (
    <div className="min-h-screen pb-28 px-4 pt-5">
      <div className="flex gap-1.5 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i <= step ? "#00C853" : "rgba(0,0,0,0.1)" }}
          />
        ))}
      </div>

      <h1 className="text-xl font-bold mb-1">{STEP_TITLES[step]}</h1>
      <p className="text-sm mb-5" style={{ color: "var(--tg-hint)" }}>
        Step {step + 1} of 4
      </p>

      {/* STEP 0 — Booking type */}
      {step === 0 && (
        <div className="space-y-3">
          {BOOKING_TYPES.map((bt) => {
            const active = form.bookingType === bt.type;
            return (
              <button
                key={bt.type}
                onClick={() => {
                  hapticImpact("light");
                  set("bookingType", bt.type);
                }}
                className="w-full flex items-start gap-3 rounded-2xl p-4 text-left border-2 transition-colors"
                style={{ background: "var(--tg-card)", borderColor: active ? bt.color : "transparent" }}
              >
                <div className="text-3xl shrink-0">{bt.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    {bt.title}
                    {active && <span style={{ color: bt.color }}>✓</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>
                    {bt.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* STEP 1 — Pitch */}
      {step === 1 && (
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
              style={{ background: "var(--tg-card)", borderColor: form.pitchId === p.id ? "#00C853" : "transparent" }}
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
                  {p.district ?? p.city ?? "Tashkent"} · {formatUZS(p.hourlyRate)}/hr
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP 2 — Details (per booking type) */}
      {step === 2 && (
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

          {form.bookingType !== "FULL_BOOKING" && (
            <Field label="Format">
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <Chip key={f} active={form.format === f} onClick={() => pickFormat(f)}>
                    {FORMAT_LABELS[f] ?? f}
                  </Chip>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--tg-hint)" }}>
                A {form.format} padel match is capped at {capForFormat(form.format)} players.
              </p>
            </Field>
          )}

          {form.bookingType !== "FULL_BOOKING" && (
            <Field label="Match type">
              <div className="grid grid-cols-2 gap-2">
                <MatchTypeButton
                  active={form.matchType === "COMPETITIVE"}
                  icon="⚔️"
                  title="Competitive"
                  color="#EF4444"
                  onClick={() => { hapticImpact("light"); set("matchType", "COMPETITIVE"); }}
                />
                <MatchTypeButton
                  active={form.matchType === "CASUAL"}
                  icon="😎"
                  title="Casual"
                  color="#00B0FF"
                  onClick={() => { hapticImpact("light"); set("matchType", "CASUAL"); }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--tg-hint)" }}>
                {form.matchType === "COMPETITIVE"
                  ? "Results count toward everyone's level."
                  : "Just for fun — no level changes."}
              </p>
            </Field>
          )}

          {form.bookingType === "OPEN_EVENT" && (
            <>
              <Field label="Duration">
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <Chip key={d} active={form.durationMinutes === d} onClick={() => set("durationMinutes", d)}>
                      {d} min
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Players">
                <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--tg-card)" }}>
                  Fixed by format: <span className="font-bold text-[#00C853]">{form.maxPlayers} players</span>
                </div>
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
            </>
          )}

          {form.bookingType === "GROUP_BOOKING" && (
            <>
              <Field label="How many people are you bringing? (incl. you)">
                <Stepper value={form.organizerPlayerCount} min={1} max={10} onChange={(v) => set("organizerPlayerCount", v)} />
              </Field>
              <Field label="How many more can join?">
                <Stepper value={form.extraSpotsAvailable} min={0} max={10} onChange={(v) => set("extraSpotsAvailable", v)} />
              </Field>
              <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
                Total spots: <span className="font-semibold">{form.organizerPlayerCount + form.extraSpotsAvailable}</span>
              </div>
            </>
          )}

          {form.bookingType === "FULL_BOOKING" && (
            <>
              <Field label="How many hours?">
                <Stepper value={form.fullBookingHours} min={1} max={8} onChange={(v) => set("fullBookingHours", v)} />
              </Field>
              <Field label="Private booking">
                <button
                  onClick={() => {
                    hapticImpact("light");
                    set("isPrivate", !form.isPrivate);
                  }}
                  className="w-full flex items-center justify-between rounded-2xl p-3 border-2"
                  style={{ background: "var(--tg-card)", borderColor: form.isPrivate ? "#FF5252" : "transparent" }}
                >
                  <span className="text-sm">{form.isPrivate ? "Private — hidden from listings" : "Open — visible on platform"}</span>
                  <span>{form.isPrivate ? "🔒" : "🌍"}</span>
                </button>
              </Field>
              {selectedPitch && (
                <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
                  Total pitch cost:{" "}
                  <span className="font-semibold text-[#00C853]">
                    {formatUZS(Number(selectedPitch.hourlyRate) * form.fullBookingHours)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* STEP 3 — Review & pricing */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--tg-card)" }}>
            <ReviewRow label="Type" value={BOOKING_TYPES.find((b) => b.type === form.bookingType)!.title} />
            <ReviewRow label="Pitch" value={selectedPitch?.name ?? "—"} />
            <ReviewRow label="When" value={dayjs(`${form.date}T${form.time}`).format("ddd, MMM D · HH:mm")} />
            {form.bookingType !== "FULL_BOOKING" && <ReviewRow label="Format" value={form.format} />}
            {form.bookingType !== "FULL_BOOKING" && (
              <ReviewRow label="Match type" value={form.matchType === "CASUAL" ? "😎 Casual" : "⚔️ Competitive"} />
            )}
            {form.bookingType === "OPEN_EVENT" && <ReviewRow label="Max players" value={String(form.maxPlayers)} />}
            {form.bookingType === "GROUP_BOOKING" && (
              <>
                <ReviewRow label="Your group" value={String(form.organizerPlayerCount)} />
                <ReviewRow label="Extra spots" value={String(form.extraSpotsAvailable)} />
              </>
            )}
            {form.bookingType === "FULL_BOOKING" && (
              <>
                <ReviewRow label="Hours" value={String(form.fullBookingHours)} />
                <ReviewRow label="Visibility" value={form.isPrivate ? "Private" : "Open"} />
              </>
            )}
          </div>

          {/* Pricing breakdown */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--tg-card)" }}>
            <div className="text-sm font-semibold mb-1">Pricing</div>
            {!pricing && <div className="text-sm" style={{ color: "var(--tg-hint)" }}>Calculating…</div>}
            {pricing && form.bookingType === "OPEN_EVENT" && (
              <>
                <PriceRow label="Base per player" value={formatUZS(pricing.basePrice)} />
                <PriceRow label="Platform fee (5%)" value={`+ ${formatUZS(pricing.platformFee)}`} />
                <PriceRow label="Players pay" value={formatUZS(pricing.youPay)} strong />
              </>
            )}
            {pricing && form.bookingType === "GROUP_BOOKING" && (
              <>
                <PriceRow label="Cost per player" value={formatUZS(pricing.costPerPlayer)} />
                <PriceRow label="You pay now" value={formatUZS(pricing.organizerPayNow)} strong />
                <PriceRow label="Others joining pay" value={`${formatUZS(pricing.perJoiningPlayer)} each`} />
              </>
            )}
            {pricing && form.bookingType === "FULL_BOOKING" && (
              <>
                <PriceRow label={`Pitch rate × ${pricing.hours}h`} value={formatUZS(pricing.totalCost)} />
                <PriceRow label="Platform commission (10%)" value={formatUZS(pricing.platformCommission)} />
                <PriceRow label="You pay" value={formatUZS(pricing.youPay)} strong />
              </>
            )}
          </div>
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

function MatchTypeButton({
  active,
  icon,
  title,
  color,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl p-3 border-2 transition-colors"
      style={{ background: "var(--tg-card)", borderColor: active ? color : "transparent" }}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-semibold" style={{ color: active ? color : "var(--tg-text)" }}>
        {title}
      </span>
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

function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: "var(--tg-hint)" }}>{label}</span>
      <span className={strong ? "font-bold text-[#00C853]" : "font-medium"}>{value}</span>
    </div>
  );
}
