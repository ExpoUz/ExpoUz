"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Step = "phone" | "otp";

/**
 * Browser-only phone + OTP login, shown when the app is opened outside Telegram
 * and NEXT_PUBLIC_ENABLE_BROWSER_LOGIN is on. Mirrors the admin panel's two-step
 * flow (+998 prefixing, phone → OTP) but styled for the TMA light theme. On
 * success it hands the tokens to AuthProvider.completeLogin, which persists them
 * exactly like the Telegram path.
 */
export function BrowserLogin() {
  const { completeLogin } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fullPhone = phone.startsWith("+") ? phone : `+998${phone}`;

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (phone.replace(/\D/g, "").length < 9) {
      setError("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { phone: fullPhone });
      setStep("otp");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { phone: fullPhone, otp });
      completeLogin(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid code");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="text-2xl font-extrabold tracking-tight mb-1">
            <span className="text-[#00C853]">SCORE</span>
            <span> WITH US</span>
          </div>
          <p className="text-sm text-[color:var(--tg-hint)]">Sign in to continue</p>
        </div>

        <div
          className="rounded-2xl p-6 shadow-sm"
          style={{ background: "var(--tg-card)", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <h1 className="font-semibold text-lg mb-1">
            {step === "phone" ? "Enter your phone" : "Enter code"}
          </h1>
          <p className="text-sm text-[color:var(--tg-hint)] mb-5">
            {step === "phone"
              ? "We'll text you a verification code"
              : `Code sent to ${fullPhone}`}
          </p>

          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div
                className="flex rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#00C853]/40"
                style={{ border: "1px solid rgba(0,0,0,0.12)" }}
              >
                <span className="text-sm px-4 py-3 border-r border-black/10 text-[color:var(--tg-hint)] flex-shrink-0">
                  +998
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="90 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  className="flex-1 bg-transparent text-sm px-4 py-3 outline-none placeholder:text-[color:var(--tg-hint)]"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading || phone.length < 9}
                className="w-full py-3 rounded-xl bg-[#00C853] text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
              >
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl text-center text-2xl tracking-[0.5em] py-4 outline-none focus:ring-2 focus:ring-[#00C853]/40"
                style={{ border: "1px solid rgba(0,0,0,0.12)", background: "transparent" }}
                autoFocus
              />
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-3 rounded-xl bg-[#00C853] text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
                className="w-full py-2 text-[color:var(--tg-hint)] text-sm hover:opacity-70 transition-opacity"
              >
                ← Change number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
