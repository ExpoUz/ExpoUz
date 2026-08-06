"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { getPhoneStatus } from "./api";
import { PhoneSheet } from "@/components/phone/PhoneSheet";

interface PhoneGateValue {
  /** Latest known verification state (best-effort; refreshed on demand). */
  phoneVerified: boolean;
  /**
   * Ensure the user has a verified phone. Resolves `true` if already verified or
   * verified during the prompt; `false` if the user dismissed it. Callers gate
   * their action on the result — the prompt is never a hard block.
   */
  requirePhone: () => Promise<boolean>;
  /** Open the prompt without gating an action (e.g. the profile nudge). */
  openPhonePrompt: () => void;
}

const PhoneGateContext = createContext<PhoneGateValue>({
  phoneVerified: false,
  requirePhone: async () => false,
  openPhonePrompt: () => {},
});

export function usePhoneGate() {
  return useContext(PhoneGateContext);
}

export function PhoneGateProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const queryClient = useQueryClient();
  const [verified, setVerified] = useState<boolean>(
    // Seed from the cached auth user if it carried the flag.
    !!(user as any)?.phoneVerified,
  );
  const [open, setOpen] = useState(false);
  // Pending requirePhone() promise resolver, settled when the sheet closes.
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  // Fetch authoritative status once authenticated.
  useEffect(() => {
    let cancelled = false;
    if (status !== "authenticated") return;
    getPhoneStatus()
      .then((s) => {
        if (!cancelled) setVerified(s.phoneVerified);
      })
      .catch(() => {
        /* non-critical; falls back to seeded value */
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const settle = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
  }, []);

  const requirePhone = useCallback(async (): Promise<boolean> => {
    if (verified) return true;
    // Double-check with the server in case it was verified elsewhere.
    try {
      const s = await getPhoneStatus();
      if (s.phoneVerified) {
        setVerified(true);
        return true;
      }
    } catch {
      /* ignore and prompt */
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpen(true);
    });
  }, [verified]);

  const openPhonePrompt = useCallback(() => {
    if (verified) return;
    setOpen(true);
  }, [verified]);

  const handleSuccess = useCallback(() => {
    setVerified(true);
    setOpen(false);
    settle(true);
    // Refresh anything that shows verification state.
    queryClient.invalidateQueries({ queryKey: ["tma-me"] });
    queryClient.invalidateQueries({ queryKey: ["phone-status"] });
  }, [queryClient, settle]);

  const handleDismiss = useCallback(() => {
    setOpen(false);
    settle(false);
  }, [settle]);

  return (
    <PhoneGateContext.Provider value={{ phoneVerified: verified, requirePhone, openPhonePrompt }}>
      {children}
      {open && <PhoneSheet onSuccess={handleSuccess} onDismiss={handleDismiss} />}
    </PhoneGateContext.Provider>
  );
}
