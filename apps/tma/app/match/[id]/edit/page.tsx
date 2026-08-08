"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { getMatch, updateMatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { showBackButton, hapticSuccess, hapticError, showAlert } from "@/lib/telegram";

/** Minimal host-only match edit: start time, duration, price, description. */
export default function EditMatchPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const qc = useQueryClient();
  const { user } = useAuth();
  const t = useTranslations("editMatch");

  useEffect(() => showBackButton(() => router.back()), [router]);

  const { data: match, isLoading } = useQuery({ queryKey: ["tma-match", id], queryFn: () => getMatch(id) });

  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!match) return;
    setStartTime(dayjs(match.startTime).format("YYYY-MM-DDTHH:mm"));
    setDuration(String(match.durationMinutes ?? 60));
    setPrice(String(Number(match.pricePerPlayer ?? 0)));
    setDescription(match.description ?? "");
  }, [match]);

  const save = useMutation({
    mutationFn: () =>
      updateMatch(id, {
        startTime: dayjs(startTime).toISOString(),
        durationMinutes: Number(duration),
        pricePerPlayer: Number(price),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      hapticSuccess();
      qc.invalidateQueries({ queryKey: ["tma-match", id] });
      router.push(`/match/${id}`);
    },
    onError: (e: any) => {
      hapticError();
      showAlert(e?.response?.data?.message ?? t("failed"));
    },
  });

  if (isLoading || !match) {
    return (
      <div className="flex justify-center py-24">
        <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Guard: only the host can edit (the server enforces this too).
  if (user && match.hostId && user.id !== match.hostId) {
    return <div className="p-8 text-center text-sm" style={{ color: "var(--tg-hint)" }}>{t("notHost")}</div>;
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-5">
      <h1 className="text-xl font-bold mb-4">{t("title")}</h1>
      <div className="space-y-4">
        <Field label={t("startTime")}>
          <input
            type="datetime-local"
            value={startTime}
            min={dayjs().format("YYYY-MM-DDTHH:mm")}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
          />
        </Field>
        <Field label={t("duration")}>
          <input
            type="number"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
          />
        </Field>
        <Field label={t("price")}>
          <input
            type="number"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
          />
        </Field>
        <Field label={t("description")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={{ background: "var(--tg-card)", color: "var(--tg-text)" }}
          />
        </Field>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !startTime}
          className="w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: "#00C853" }}
        >
          {save.isPending ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold" style={{ color: "var(--tg-hint)" }}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
