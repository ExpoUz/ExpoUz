"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Megaphone, Users, Building2, Check, Swords, Smile, Lock, Globe, type LucideIcon } from "lucide-react";
import dayjs from "dayjs";
import { getPitches, createMatch, getPricingPreview, getAvailableSlots, formatUZS, isPhoneRequiredError } from "@/lib/api";
import { usePhoneGate } from "@/lib/phone-gate";
import { useSportStore, setSport, sportMeta, SPORTS } from "@/lib/sport-store";
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

const capForFormat = (f: string) => {
  const m = f.match(/^(\d+)v(\d+)$/);
  return m ? parseInt(m[1], 10) + parseInt(m[2], 10) : 4;
};

type BookingType = "OPEN_EVENT" | "GROUP_BOOKING" | "FULL_BOOKING";

// Titles/descriptions are translated at render via the `bookingType` namespace.
const BOOKING_TYPES: { type: BookingType; Icon: LucideIcon; color: string }[] = [
  { type: "OPEN_EVENT", Icon: Megaphone, color: "#00C853" },
  { type: "GROUP_BOOKING", Icon: Users, color: "#00B0FF" },
  { type: "FULL_BOOKING", Icon: Building2, color: "#FF5252" },
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
  // OPEN_EVENT — booked into an admin-published slot (PART 6)
  maxPlayers: number;
  pricePerPlayer: number; // derived from the slot; users never set it
  slotId: string;
  slotPrice: number; // the whole-slot price from the venue admin
  // GROUP_BOOKING
  organizerPlayerCount: number;
  extraSpotsAvailable: number;
  // FULL_BOOKING
  fullBookingHours: number;
  isPrivate: boolean;
}

const STEP_KEYS = ["step_bookingType", "step_choosePitch", "step_matchDetails", "step_review"] as const;

export default function CreateMatchPage() {
  const router = useRouter();
  const t = useTranslations("create");
  const { requirePhone } = usePhoneGate();
  const tBooking = useTranslations("bookingType");
  const tSports = useTranslations("sports");
  const { sport } = useSportStore();
  const meta = sportMeta(sport);
  const sportLabel = tSports(sport === "PADEL" ? "padel" : "football");
  const isPadel = sport === "PADEL";
  const [step, setStep] = useState(0); // 0..3
  const [submitting, setSubmitting] = useState(false);

  const qc = useQueryClient();
  const tCommon = useTranslations("common");
  const { data: pitches, isError: pitchesError } = useQuery({
    queryKey: ["tma-pitches", sport],
    queryFn: () => getPitches({ sport }),
  });

  const [form, setForm] = useState<Form>({
    bookingType: "OPEN_EVENT",
    matchType: "COMPETITIVE",
    pitchId: "",
    format: meta.formats[meta.formats.length - 1].id, // doubles / 6v6
    date: dayjs().add(1, "day").format("YYYY-MM-DD"),
    time: "19:00",
    durationMinutes: 60,
    maxPlayers: meta.formats[meta.formats.length - 1].maxPlayers,
    pricePerPlayer: 0,
    slotId: "",
    slotPrice: 0,
    organizerPlayerCount: 3,
    extraSpotsAvailable: 4,
    fullBookingHours: 1,
    isPrivate: false,
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // PART 6: available slots for the chosen venue (OPEN_EVENT books into a slot).
  const { data: slotGroups, isLoading: slotsLoading } = useQuery({
    queryKey: ["tma-slots", form.pitchId, sport],
    queryFn: () => getAvailableSlots({ pitchId: form.pitchId, sport }),
    enabled: step === 2 && form.bookingType === "OPEN_EVENT" && !!form.pitchId,
  });
  const slots = useMemo(() => slotGroups?.[0]?.slots ?? [], [slotGroups]);

  // Prefill from the "Free courts" conversion path: /create?pitchId=&date=&time=
  // Jump straight to the details step so the user just confirms.
  const searchParams = useSearchParams();
  const prefilledRef = useRef(false);
  const pendingSlotRef = useRef<string | null>(null);
  useEffect(() => {
    if (prefilledRef.current) return;
    const pitchId = searchParams.get("pitchId");
    const date = searchParams.get("date");
    const time = searchParams.get("time");
    const slotId = searchParams.get("slotId");
    if (!pitchId && !date && !time && !slotId) return;
    prefilledRef.current = true;
    if (slotId) pendingSlotRef.current = slotId; // preselected once slots load
    setForm((f) => ({
      ...f,
      ...(pitchId ? { pitchId } : {}),
      ...(date ? { date } : {}),
      ...(time ? { time } : {}),
    }));
    if (pitchId) setStep(2); // pitch chosen → go to slot/details
  }, [searchParams]);

  // Auto-select a slot passed via ?slotId= once the venue's slots have loaded.
  useEffect(() => {
    const pending = pendingSlotRef.current;
    if (!pending || slots.length === 0) return;
    const found = slots.find((s: any) => s.id === pending);
    if (found) {
      selectSlot(found);
      pendingSlotRef.current = null;
    }
  }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the sport switches, reset format + cap and clear the chosen pitch
  // (pitches are sport-specific).
  useEffect(() => {
    const def = meta.formats[meta.formats.length - 1];
    setForm((f) => ({ ...f, format: def.id, maxPlayers: def.maxPlayers, pitchId: "", slotId: "", slotPrice: 0 }));
  }, [sport]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPitch = useMemo(
    () => (pitches ?? []).find((p: any) => p.id === form.pitchId),
    [pitches, form.pitchId],
  );

  function pickFormat(fmt: string) {
    hapticImpact("light");
    const f = meta.formats.find((x) => x.id === fmt);
    set("format", fmt);
    set("maxPlayers", f?.maxPlayers ?? capForFormat(fmt));
  }

  // PART 6: selecting a slot fixes the venue's time, duration and price. The
  // per-player price is derived (slot price ÷ player cap) — never user-entered.
  function selectSlot(s: any) {
    hapticImpact("light");
    const start = dayjs(s.startTime);
    const dur = Math.round(
      (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000,
    );
    setForm((f) => ({
      ...f,
      slotId: s.id,
      slotPrice: Number(s.price),
      date: start.format("YYYY-MM-DD"),
      time: start.format("HH:mm"),
      durationMinutes: dur,
    }));
  }

  // Keep the per-player price in sync with the slot price and the format cap.
  useEffect(() => {
    if (form.bookingType !== "OPEN_EVENT" || form.slotPrice <= 0) return;
    const perPlayer = Math.ceil(form.slotPrice / Math.max(1, form.maxPlayers));
    setForm((f) => (f.pricePerPlayer === perPlayer ? f : { ...f, pricePerPlayer: perPlayer }));
  }, [form.slotPrice, form.maxPlayers, form.bookingType]);

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
      // OPEN_EVENT books into a slot (which carries its own time); the other
      // types still choose a date/time manually.
      if (form.bookingType === "OPEN_EVENT") return !!form.format && !!form.slotId;
      if (!form.date || !form.time) return false;
      if (form.bookingType === "GROUP_BOOKING") return !!form.format && form.organizerPlayerCount >= 1;
      if (form.bookingType === "FULL_BOOKING") return form.fullBookingHours >= 1;
    }
    return true;
  }, [step, form]);

  async function submit() {
    // Hosting requires a verified phone so the venue can reach the organizer.
    // Prompt at this moment; bail out quietly if the user dismisses it.
    if (!(await requirePhone())) return;
    setSubmitting(true);
    setMainButtonLoading(true);
    try {
      const startTime = dayjs(`${form.date}T${form.time}`).toISOString();
      const base: any = {
        pitchId: form.pitchId,
        sport,
        bookingType: form.bookingType,
        format: form.format,
        startTime,
        durationMinutes: form.durationMinutes,
      };
      // Match type (casual/competitive) only applies to padel.
      if (form.bookingType !== "FULL_BOOKING" && isPadel) {
        base.matchType = form.matchType;
      }
      if (form.bookingType === "OPEN_EVENT") {
        base.maxPlayers = form.maxPlayers;
        // PART 6: price comes from the slot — never sent by the client.
        base.slotId = form.slotId;
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
      // Server-side safety net: if the phone became unverified between the
      // prompt and submit, re-open the prompt instead of showing an error.
      if (isPhoneRequiredError(e)) {
        setSubmitting(false);
        setMainButtonLoading(false);
        if (await requirePhone()) submit();
        return;
      }
      // PART 6: the slot was taken between selection and submit — clear it,
      // refresh the list and send the user back to pick another.
      if (e?.response?.data?.code === "SLOT_TAKEN") {
        hapticError();
        setForm((f) => ({ ...f, slotId: "", slotPrice: 0 }));
        await qc.invalidateQueries({ queryKey: ["tma-slots", form.pitchId, sport] });
        setStep(2);
        showAlert(t("slotTaken"));
        setSubmitting(false);
        setMainButtonLoading(false);
        return;
      }
      hapticError();
      showAlert(e?.response?.data?.message ?? t("errCreate"));
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
    const label = step < 3 ? t("continue") : t("createMatch");
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

      <h1 className="text-xl font-bold mb-1">{t(STEP_KEYS[step])}</h1>
      <p className="text-sm mb-5" style={{ color: "var(--tg-hint)" }}>
        {t("stepOf", { n: step + 1 })}
      </p>

      {/* STEP 0 — Booking type */}
      {step === 0 && (
        <div className="space-y-3">
          {/* Sport (inherited from the home filter; changeable here) */}
          <div>
            <label className="block text-sm font-medium mb-2">{t("sport")}</label>
            <div className="grid grid-cols-2 gap-2">
              {SPORTS.map((s) => {
                const active = s.id === sport;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      hapticImpact("light");
                      setSport(s.id);
                    }}
                    className="flex items-center justify-center gap-2 rounded-2xl p-3 border-2 transition-colors"
                    style={{ background: "var(--tg-card)", borderColor: active ? "#00C853" : "transparent" }}
                  >
                    <span className="font-semibold text-sm" style={{ color: active ? "#00C853" : "var(--tg-text)" }}>
                      {tSports(s.id === "PADEL" ? "padel" : "football")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {BOOKING_TYPES.map((bt) => {
            const active = form.bookingType === bt.type;
            const Icon = bt.Icon;
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
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${bt.color}1A`, color: bt.color }}
                >
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    {tBooking(bt.type)}
                    {active && <Check size={16} style={{ color: bt.color }} />}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>
                    {tBooking(`${bt.type}_desc`)}
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
          {pitchesError && (
            <p className="text-sm" style={{ color: "var(--tg-hint)" }}>
              {tCommon("error")}
            </p>
          )}
          {!pitchesError && (pitches ?? []).length === 0 && (
            <p className="text-sm" style={{ color: "var(--tg-hint)" }}>
              {t("noPitches")}
            </p>
          )}
          {(pitches ?? []).map((p: any) => (
            <button
              key={p.id}
              onClick={() => {
                hapticImpact("light");
                // Switching venue invalidates the previously chosen slot.
                setForm((f) => ({ ...f, pitchId: p.id, slotId: "", slotPrice: 0 }));
              }}
              className="w-full flex items-center gap-3 rounded-2xl p-3 text-left border-2 transition-colors"
              style={{ background: "var(--tg-card)", borderColor: form.pitchId === p.id ? "#00C853" : "transparent" }}
            >
              <div className="w-12 h-12 rounded-xl bg-[#0D1117] overflow-hidden flex items-center justify-center shrink-0">
                {p.photos?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photos[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={22} style={{ color: "rgba(255,255,255,0.4)" }} />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{p.name}</div>
                <div className="text-xs truncate" style={{ color: "var(--tg-hint)" }}>
                  {p.district ?? p.city ?? "Tashkent"} · {formatUZS(p.hourlyRate)}{t("perHr")}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP 2 — Details (per booking type) */}
      {step === 2 && (
        <div className="space-y-5">
          {/* OPEN_EVENT picks a published slot (which sets the time); the other
              booking types still choose a date/time manually. */}
          {form.bookingType !== "OPEN_EVENT" && (
            <>
              <Field label={t("date")}>
                <input
                  type="date"
                  value={form.date}
                  min={dayjs().format("YYYY-MM-DD")}
                  onChange={(e) => set("date", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label={t("kickoff")}>
                <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} className="input" />
              </Field>
            </>
          )}

          {form.bookingType !== "FULL_BOOKING" && (
            <Field label={t("format")}>
              <div className="flex flex-wrap gap-2">
                {meta.formats.map((f) => (
                  <Chip key={f.id} active={form.format === f.id} onClick={() => pickFormat(f.id)}>
                    {f.label}
                  </Chip>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--tg-hint)" }}>
                {t("capNote", {
                  format: form.format,
                  sport: sportLabel,
                  count: meta.formats.find((f) => f.id === form.format)?.maxPlayers ?? capForFormat(form.format),
                })}
              </p>
            </Field>
          )}

          {/* Match type (Casual / Competitive) is padel-only */}
          {form.bookingType !== "FULL_BOOKING" && isPadel && (
            <Field label={t("matchType")}>
              <div className="grid grid-cols-2 gap-2">
                <MatchTypeButton
                  active={form.matchType === "COMPETITIVE"}
                  icon={<Swords size={22} />}
                  title={t("competitive")}
                  color="#EF4444"
                  onClick={() => { hapticImpact("light"); set("matchType", "COMPETITIVE"); }}
                />
                <MatchTypeButton
                  active={form.matchType === "CASUAL"}
                  icon={<Smile size={22} />}
                  title={t("casual")}
                  color="#00B0FF"
                  onClick={() => { hapticImpact("light"); set("matchType", "CASUAL"); }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--tg-hint)" }}>
                {form.matchType === "COMPETITIVE" ? t("competitiveNote") : t("casualNote")}
              </p>
            </Field>
          )}

          {form.bookingType === "OPEN_EVENT" && (
            <>
              <Field label={t("players")}>
                <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--tg-card)" }}>
                  {t("fixedByFormat")}{" "}
                  <span className="font-bold text-[#00C853]">{t("playersCount", { count: form.maxPlayers })}</span>
                </div>
              </Field>
              <Field label={t("chooseSlot")}>
                {slotsLoading ? (
                  <div className="rounded-2xl p-4 text-sm text-center" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
                    {t("calculating")}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="rounded-2xl p-4 text-sm text-center" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
                    {t("noSlots")}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {slots.map((s: any) => {
                      const active = form.slotId === s.id;
                      const perPlayer = Math.ceil(Number(s.price) / Math.max(1, form.maxPlayers));
                      return (
                        <button
                          key={s.id}
                          onClick={() => selectSlot(s)}
                          className="rounded-2xl p-3 text-left border-2 transition-colors"
                          style={{ background: "var(--tg-card)", borderColor: active ? "#00C853" : "rgba(0,0,0,0.1)" }}
                        >
                          <div className="font-semibold text-sm">{dayjs(s.startTime).format("ddd, MMM D")}</div>
                          <div className="text-sm">{dayjs(s.startTime).format("HH:mm")}–{dayjs(s.endTime).format("HH:mm")}</div>
                          <div className="text-xs mt-1" style={{ color: active ? "#00C853" : "var(--tg-hint)" }}>
                            {formatUZS(perPlayer)}{t("perPlayerShort")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs mt-2" style={{ color: "var(--tg-hint)" }}>
                  {t("slotPriceNote")}
                </p>
              </Field>
            </>
          )}

          {form.bookingType === "GROUP_BOOKING" && (
            <>
              <Field label={t("groupBringing")}>
                <Stepper value={form.organizerPlayerCount} min={1} max={10} onChange={(v) => set("organizerPlayerCount", v)} />
              </Field>
              <Field label={t("groupMore")}>
                <Stepper value={form.extraSpotsAvailable} min={0} max={10} onChange={(v) => set("extraSpotsAvailable", v)} />
              </Field>
              <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
                {t("totalSpots")} <span className="font-semibold">{form.organizerPlayerCount + form.extraSpotsAvailable}</span>
              </div>
            </>
          )}

          {form.bookingType === "FULL_BOOKING" && (
            <>
              <Field label={t("hours")}>
                <Stepper value={form.fullBookingHours} min={1} max={8} onChange={(v) => set("fullBookingHours", v)} />
              </Field>
              <Field label={t("privateBooking")}>
                <button
                  onClick={() => {
                    hapticImpact("light");
                    set("isPrivate", !form.isPrivate);
                  }}
                  className="w-full flex items-center justify-between rounded-2xl p-3 border-2"
                  style={{ background: "var(--tg-card)", borderColor: form.isPrivate ? "#FF5252" : "transparent" }}
                >
                  <span className="text-sm">{form.isPrivate ? t("privateHidden") : t("openVisible")}</span>
                  {form.isPrivate ? <Lock size={18} /> : <Globe size={18} />}
                </button>
              </Field>
              {selectedPitch && (
                <div className="rounded-2xl p-3 text-sm" style={{ background: "var(--tg-card)", color: "var(--tg-hint)" }}>
                  {t("totalPitchCost")}{" "}
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
            <ReviewRow label={t("r_type")} value={tBooking(form.bookingType)} />
            <ReviewRow label={t("r_pitch")} value={selectedPitch?.name ?? "—"} />
            <ReviewRow label={t("r_when")} value={dayjs(`${form.date}T${form.time}`).format("ddd, MMM D · HH:mm")} />
            <ReviewRow label={t("r_sport")} value={sportLabel} />
            {form.bookingType !== "FULL_BOOKING" && <ReviewRow label={t("r_format")} value={form.format} />}
            {form.bookingType !== "FULL_BOOKING" && isPadel && (
              <ReviewRow label={t("r_matchType")} value={form.matchType === "CASUAL" ? t("casual") : t("competitive")} />
            )}
            {form.bookingType === "OPEN_EVENT" && <ReviewRow label={t("r_maxPlayers")} value={String(form.maxPlayers)} />}
            {form.bookingType === "GROUP_BOOKING" && (
              <>
                <ReviewRow label={t("r_yourGroup")} value={String(form.organizerPlayerCount)} />
                <ReviewRow label={t("r_extraSpots")} value={String(form.extraSpotsAvailable)} />
              </>
            )}
            {form.bookingType === "FULL_BOOKING" && (
              <>
                <ReviewRow label={t("r_hours")} value={String(form.fullBookingHours)} />
                <ReviewRow label={t("r_visibility")} value={form.isPrivate ? t("v_private") : t("v_open")} />
              </>
            )}
          </div>

          {/* Pricing breakdown */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--tg-card)" }}>
            <div className="text-sm font-semibold mb-1">{t("pricing")}</div>
            {!pricing && <div className="text-sm" style={{ color: "var(--tg-hint)" }}>{t("calculating")}</div>}
            {pricing && form.bookingType === "OPEN_EVENT" && (
              <>
                <PriceRow label={t("basePerPlayer")} value={formatUZS(pricing.basePrice)} />
                <PriceRow label={t("platformFee5")} value={`+ ${formatUZS(pricing.platformFee)}`} />
                <PriceRow label={t("playersPay")} value={formatUZS(pricing.youPay)} strong />
              </>
            )}
            {pricing && form.bookingType === "GROUP_BOOKING" && (
              <>
                <PriceRow label={t("costPerPlayer")} value={formatUZS(pricing.costPerPlayer)} />
                <PriceRow label={t("youPayNow")} value={formatUZS(pricing.organizerPayNow)} strong />
                <PriceRow label={t("othersJoiningPay")} value={t("each", { price: formatUZS(pricing.perJoiningPlayer) })} />
              </>
            )}
            {pricing && form.bookingType === "FULL_BOOKING" && (
              <>
                <PriceRow label={t("pitchRateHours", { hours: pricing.hours })} value={formatUZS(pricing.totalCost)} />
                <PriceRow label={t("platformCommission10")} value={formatUZS(pricing.platformCommission)} />
                <PriceRow label={t("youPay")} value={formatUZS(pricing.youPay)} strong />
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
  icon: ReactNode;
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
      <span style={{ color: active ? color : "var(--tg-text)" }}>{icon}</span>
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
