"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getWalletBalance,
  getWalletHistory,
  formatUZS,
  WALLET_TX_META,
  type WalletTransaction,
} from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { usePhoneGate } from "@/lib/phone-gate";
import { hideMainButton, showBackButton, hapticImpact, showAlert } from "@/lib/telegram";

export default function WalletPage() {
  const router = useRouter();
  const t = useTranslations("wallet");
  const { requirePhone } = usePhoneGate();

  useEffect(() => {
    hideMainButton();
    const cleanup = showBackButton(() => router.back());
    return cleanup;
  }, [router]);

  const {
    data: balanceData,
    isLoading: balanceLoading,
  } = useQuery({ queryKey: ["wallet-balance"], queryFn: getWalletBalance });

  const {
    data: history,
    isLoading: historyLoading,
    isError,
  } = useQuery({ queryKey: ["wallet-history"], queryFn: getWalletHistory });

  const balance = balanceData?.balance ?? 0;

  return (
    <div className="min-h-screen pb-24">
      {/* Balance card */}
      <div className="px-4 pt-6">
        <div
          className="rounded-3xl p-6 text-white"
          style={{ background: "linear-gradient(135deg, #00C853 0%, #00875A 100%)" }}
        >
          <div className="text-sm opacity-80">{t("balance")}</div>
          {balanceLoading ? (
            <div className="mt-2 h-9 w-40 rounded-lg bg-white/20 animate-pulse" />
          ) : (
            <div className="mt-1 text-3xl font-bold tracking-tight">
              {formatUZS(balance)}
            </div>
          )}
          <button
            onClick={async () => {
              hapticImpact("light");
              // Wallet movements require a verified, reachable phone.
              if (!(await requirePhone())) return;
              showAlert(t("topUpSoon"));
            }}
            className="mt-4 w-full rounded-xl bg-white/15 py-2.5 text-sm font-semibold active:bg-white/25"
          >
            {t("topUp")}
          </button>
        </div>
      </div>

      {/* Ledger */}
      <div className="px-4 pt-6">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--tg-hint)" }}>
          {t("history")}
        </h2>

        {historyLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl animate-pulse"
                style={{ background: "var(--tg-card)" }}
              />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center text-sm py-10" style={{ color: "var(--tg-hint)" }}>
            {t("loadError")}
          </div>
        ) : !history?.length ? (
          <div className="text-center py-12" style={{ color: "var(--tg-hint)" }}>
            <div className="text-3xl mb-2">🧾</div>
            <div className="text-sm">{t("noTransactions")}</div>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((tx) => (
              <LedgerRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function LedgerRow({ tx }: { tx: WalletTransaction }) {
  const t = useTranslations("wallet.types");
  const meta = WALLET_TX_META[tx.type] ?? { label: tx.type, icon: "•" };
  // Prefer the localized type label; the server `description` is English-only.
  const label = t(tx.type as any) || tx.description || meta.label;
  const amount = Number(tx.amount);
  const isCredit = amount >= 0;

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{ background: "var(--tg-card)" }}
    >
      <div className="text-xl shrink-0">{meta.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--tg-hint)" }}>
          {dayjs(tx.createdAt).format("MMM D, HH:mm")}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className="text-sm font-bold"
          style={{ color: isCredit ? "#00875A" : "#E53935" }}
        >
          {isCredit ? "+" : "−"}
          {formatUZS(Math.abs(amount))}
        </div>
        <div className="text-[11px]" style={{ color: "var(--tg-hint)" }}>
          {formatUZS(tx.balanceAfter)}
        </div>
      </div>
    </div>
  );
}
