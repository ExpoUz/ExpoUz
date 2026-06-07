"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

type Step = "phone" | "otp";

const ALLOWED_ROLES = ["PITCH_OWNER", "ADMIN", "SUPER_ADMIN"];

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (phone.replace(/\D/g, "").length < 9) {
      setError("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const fullPhone = phone.startsWith("+") ? phone : `+998${phone}`;
      await authApi.post("/auth/send-otp", { phone: fullPhone });
      setStep("otp");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fullPhone = phone.startsWith("+") ? phone : `+998${phone}`;
      const { data } = await authApi.post("/auth/verify-otp", { phone: fullPhone, code: otp });
      const { accessToken, refreshToken, user } = data;

      if (!ALLOWED_ROLES.includes(user?.role)) {
        setError("Access denied. Pitch owner accounts only.");
        setLoading(false);
        return;
      }

      localStorage.setItem("portal_access_token", accessToken);
      localStorage.setItem("portal_refresh_token", refreshToken);
      localStorage.setItem("portal_user", JSON.stringify(user));
      document.cookie = `portal_token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}`;
      router.replace("/");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold tracking-tight mb-1">
            <span className="text-[#00C853]">SCORE</span>
            <span className="text-white"> WITH US</span>
          </div>
          <p className="text-gray-500 text-sm">Pitch Owner Portal</p>
        </div>

        <div className="bg-[#161B22] rounded-2xl border border-white/10 p-8">
          <h1 className="text-white font-semibold text-lg mb-1">
            {step === "phone" ? "Sign in" : "Enter code"}
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            {step === "phone"
              ? "Enter your registered phone number"
              : `Code sent to +998${phone}`}
          </p>

          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="flex rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden focus-within:ring-2 focus-within:ring-[#00C853]/40">
                <span className="text-gray-400 text-sm px-4 py-3 border-r border-white/10 flex-shrink-0">
                  +998
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="90 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  className="flex-1 bg-transparent text-white text-sm px-4 py-3 outline-none placeholder:text-gray-600"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading || phone.length < 9}
                className="w-full py-3 rounded-xl bg-[#00C853] text-black font-semibold text-sm disabled:opacity-50 transition-opacity"
              >
                {loading ? "Sending…" : "Send OTP"}
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
                className="w-full bg-[#0D1117] border border-white/10 rounded-xl text-white text-center text-2xl tracking-[0.5em] py-4 outline-none focus:ring-2 focus:ring-[#00C853]/40"
                autoFocus
              />
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-3 rounded-xl bg-[#00C853] text-black font-semibold text-sm disabled:opacity-50 transition-opacity"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                className="w-full py-2 text-gray-500 text-sm hover:text-gray-300 transition-colors"
              >
                ← Change number
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          For verified pitch owners. Contact ExpoUz to register your venue.
        </p>
      </div>
    </div>
  );
}
