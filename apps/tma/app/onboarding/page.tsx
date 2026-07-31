"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitOnboarding, formatLevel, getSkillBand } from "@/lib/api";
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

type Experience = "never" | "few_times" | "months" | "years";

const EXPERIENCE_KEYS: Experience[] = ["never", "few_times", "months", "years"];

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tBands = useTranslations("levels.bands");
  const searchParams = useSearchParams();
  const SELF_LABELS = [t("self_1"), t("self_2"), t("self_3"), t("self_4"), t("self_5")];
  // Where to go after onboarding — e.g. back to a match the user tried to join.
  const next = searchParams.get("next") || "/";
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ level: number; band: { label: string; color: string } } | null>(null);

  const [experience, setExperience] = useState<Experience | null>(null);
  const [otherRacketSports, setOtherRacketSports] = useState<boolean | null>(null);
  const [selfAssessment, setSelfAssessment] = useState(3);
  const [competitivePlay, setCompetitivePlay] = useState<boolean | null>(null);

  const totalSteps = 4;

  const canProceed = (() => {
    if (step === 0) return experience !== null;
    if (step === 1) return otherRacketSports !== null;
    if (step === 2) return true;
    if (step === 3) return competitivePlay !== null;
    return false;
  })();

  async function finish() {
    setMainButtonLoading(true);
    try {
      const res = await submitOnboarding({
        experience: experience!,
        otherRacketSports: otherRacketSports!,
        selfAssessment,
        competitivePlay: competitivePlay!,
      });
      hapticSuccess();
      setResult({ level: res.level, band: res.band });
    } catch (e: any) {
      hapticError();
      showAlert(e?.response?.data?.message ?? t("saveError"));
    } finally {
      setMainButtonLoading(false);
    }
  }

  const actionRef = useRef<() => void>(() => {});
  actionRef.current = () => {
    if (!canProceed) return;
    hapticImpact("light");
    if (step < totalSteps - 1) setStep((s) => s + 1);
    else finish();
  };

  // Main button (hidden on the result screen, which has its own CTA)
  useEffect(() => {
    if (result) {
      hideMainButton();
      return;
    }
    const label = step < totalSteps - 1 ? t("continue") : t("seeLevel");
    const cleanup = showMainButton(label, () => actionRef.current());
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [step, result]);

  useEffect(() => {
    if (result) return; // back button is hidden by the prior effect's cleanup
    const cleanup = showBackButton(() => {
      if (step > 0) setStep((s) => s - 1);
      else router.back();
    });
    return cleanup;
  }, [step, result, router]);

  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🎾</div>
        <p className="text-sm" style={{ color: "var(--tg-hint)" }}>
          {t("startingLevel")}
        </p>
        <div className="text-6xl font-black my-2" style={{ color: result.band.color }}>
          {formatLevel(result.level)}
        </div>
        <div className="text-lg font-bold" style={{ color: result.band.color }}>
          {tBands(getSkillBand(result.level).key)}
        </div>
        <p className="text-sm mt-5 max-w-xs" style={{ color: "var(--tg-hint)" }}>
          {t("resultExplain")}
        </p>
        <button
          onClick={() => {
            hapticImpact("medium");
            router.replace(next);
          }}
          className="mt-8 w-full max-w-xs rounded-2xl py-3.5 font-bold text-white"
          style={{ background: "#00C853" }}
        >
          {next === "/" ? t("startPlaying") : t("continueToMatch")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 px-4 pt-5">
      <div className="flex gap-1.5 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i <= step ? "#00C853" : "rgba(0,0,0,0.1)" }}
          />
        ))}
      </div>

      {step === 0 && (
        <Question title={t("q_experience")}>
          {EXPERIENCE_KEYS.map((key) => (
            <OptionCard
              key={key}
              active={experience === key}
              title={t(`exp_${key}_label`)}
              sub={t(`exp_${key}_sub`)}
              onClick={() => {
                hapticImpact("light");
                setExperience(key);
              }}
            />
          ))}
        </Question>
      )}

      {step === 1 && (
        <Question title={t("q_otherRacket")} sub={t("q_otherRacket_sub")}>
          <OptionCard active={otherRacketSports === true} title={t("yes")} onClick={() => { hapticImpact("light"); setOtherRacketSports(true); }} />
          <OptionCard active={otherRacketSports === false} title={t("no")} onClick={() => { hapticImpact("light"); setOtherRacketSports(false); }} />
        </Question>
      )}

      {step === 2 && (
        <Question title={t("q_selfAssessment")}>
          <div className="rounded-2xl p-5" style={{ background: "var(--tg-card)" }}>
            <div className="text-center mb-4">
              <div className="text-4xl font-black text-[#00C853]">{selfAssessment}</div>
              <div className="text-sm mt-1" style={{ color: "var(--tg-hint)" }}>
                {SELF_LABELS[selfAssessment - 1]}
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={selfAssessment}
              onChange={(e) => setSelfAssessment(Number(e.target.value))}
              className="w-full accent-[#00C853]"
            />
            <div className="flex justify-between text-[11px] mt-1" style={{ color: "var(--tg-hint)" }}>
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
        </Question>
      )}

      {step === 3 && (
        <Question title={t("q_competitive")} sub={t("q_competitive_sub")}>
          <OptionCard active={competitivePlay === true} title={t("yes")} onClick={() => { hapticImpact("light"); setCompetitivePlay(true); }} />
          <OptionCard active={competitivePlay === false} title={t("noJustFun")} onClick={() => { hapticImpact("light"); setCompetitivePlay(false); }} />
        </Question>
      )}
    </div>
  );
}

function Question({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-bold mb-1">{title}</h1>
      {sub && <p className="text-sm mb-5" style={{ color: "var(--tg-hint)" }}>{sub}</p>}
      <div className={`space-y-2.5 ${sub ? "" : "mt-5"}`}>{children}</div>
    </div>
  );
}

function OptionCard({ active, title, sub, onClick }: { active: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-2xl p-4 text-left border-2 transition-colors"
      style={{ background: "var(--tg-card)", borderColor: active ? "#00C853" : "transparent" }}
    >
      <div>
        <div className="font-semibold">{title}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>{sub}</div>}
      </div>
      {active && <span className="text-[#00C853] text-lg">✓</span>}
    </button>
  );
}
