"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  apiErrorCode,
  requestPhoneCode,
  savePhoneContact,
  verifyPhoneCode,
} from "@/lib/api";
import { requestPhoneNumber, hapticError, hapticSuccess } from "@/lib/telegram";
import { OtpInput } from "./OtpInput";

type Step = "intro" | "phone" | "otp";

/**
 * Bottom-sheet phone-capture prompt. Tier 1 (Telegram contact share) is the
 * primary path; "use a different number" reveals the Tier 2 Gateway OTP flow.
 * The user can always dismiss — gated actions re-prompt at the next attempt.
 */
export function PhoneSheet({
  onSuccess,
  onDismiss,
}: {
  onSuccess: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("phone");
  const [step, setStep] = useState<Step>("intro");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const fullPhone = phone.startsWith("+") ? phone : `+998${phone}`;

  // Resend countdown for the OTP step.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  function errText(): string | null {
    if (!errorCode) return null;
    // Localized per-code message; fall back to a generic error string.
    const msg = t(`errors.${errorCode}`);
    return msg.startsWith("phone.errors.") ? t("errors.generic") : msg;
  }

  async function shareViaTelegram() {
    setErrorCode(null);
    setLoading(true);
    try {
      const res = await requestPhoneNumber();
      if (!res.ok || !res.raw) {
        // Declined or unsupported — steer them to the manual path.
        setStep("phone");
        return;
      }
      await savePhoneContact(res.raw);
      hapticSuccess();
      onSuccess();
    } catch (e: any) {
      hapticError();
      setErrorCode(apiErrorCode(e) ?? "generic");
    } finally {
      setLoading(false);
    }
  }

  async function sendCode() {
    setErrorCode(null);
    if (phone.replace(/\D/g, "").length < 9) {
      setErrorCode("PHONE_INVALID");
      return;
    }
    setLoading(true);
    try {
      await requestPhoneCode(fullPhone);
      setCode("");
      setStep("otp");
      setResendIn(60);
    } catch (e: any) {
      hapticError();
      setErrorCode(apiErrorCode(e) ?? "generic");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(value: string) {
    setErrorCode(null);
    setLoading(true);
    try {
      await verifyPhoneCode(value);
      hapticSuccess();
      onSuccess();
    } catch (e: any) {
      hapticError();
      setErrorCode(apiErrorCode(e) ?? "CODE_INVALID");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md rounded-t-3xl p-6 pb-8 animate-[slideUp_.2s_ease-out]"
        style={{ background: "var(--tg-card)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/15" />

        {step === "intro" && (
          <>
            <h2 className="text-lg font-bold mb-2">{t("title")}</h2>
            <p className="text-sm mb-5" style={{ color: "var(--tg-hint)" }}>
              {t("why")}
            </p>
            <button
              onClick={shareViaTelegram}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-[#00C853] text-white font-semibold text-sm disabled:opacity-50"
            >
              {loading ? t("sharing") : t("shareViaTelegram")}
            </button>
            <button
              onClick={() => {
                setErrorCode(null);
                setStep("phone");
              }}
              className="w-full py-3 mt-2 text-sm font-medium"
              style={{ color: "var(--tg-hint)" }}
            >
              {t("useDifferentNumber")}
            </button>
            {errText() && <p className="text-red-500 text-xs text-center mt-2">{errText()}</p>}
          </>
        )}

        {step === "phone" && (
          <>
            <h2 className="text-lg font-bold mb-2">{t("enterNumber")}</h2>
            <p className="text-sm mb-4" style={{ color: "var(--tg-hint)" }}>
              {t("enterNumberSub")}
            </p>
            <div
              className="flex rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#00C853]/40 mb-3"
              style={{ border: "1px solid rgba(0,0,0,0.12)" }}
            >
              <span className="text-sm px-4 py-3 border-r border-black/10 flex-shrink-0" style={{ color: "var(--tg-hint)" }}>
                +998
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={9}
                placeholder="90 000 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="flex-1 bg-transparent text-sm px-4 py-3 outline-none"
                autoFocus
              />
            </div>
            {errText() && <p className="text-red-500 text-xs mb-2">{errText()}</p>}
            <button
              onClick={sendCode}
              disabled={loading || phone.length < 9}
              className="w-full py-3.5 rounded-2xl bg-[#00C853] text-white font-semibold text-sm disabled:opacity-50"
            >
              {loading ? t("sending") : t("sendCode")}
            </button>
            <button
              onClick={() => {
                setErrorCode(null);
                setStep("intro");
              }}
              className="w-full py-3 mt-1 text-sm font-medium"
              style={{ color: "var(--tg-hint)" }}
            >
              {t("back")}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <h2 className="text-lg font-bold mb-2">{t("enterCode")}</h2>
            <p className="text-sm mb-4" style={{ color: "var(--tg-hint)" }}>
              {t("codeSentTo", { phone: fullPhone })}
            </p>
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={submitCode}
              disabled={loading}
            />
            {errText() && <p className="text-red-500 text-xs text-center mt-3">{errText()}</p>}
            <div className="mt-4 text-center">
              {resendIn > 0 ? (
                <span className="text-xs" style={{ color: "var(--tg-hint)" }}>
                  {t("resendIn", { seconds: resendIn })}
                </span>
              ) : (
                <button
                  onClick={sendCode}
                  disabled={loading}
                  className="text-xs font-semibold text-[#00875A]"
                >
                  {t("resend")}
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setErrorCode(null);
                setCode("");
                setStep("phone");
              }}
              className="w-full py-3 mt-2 text-sm font-medium"
              style={{ color: "var(--tg-hint)" }}
            >
              {t("changeNumber")}
            </button>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
