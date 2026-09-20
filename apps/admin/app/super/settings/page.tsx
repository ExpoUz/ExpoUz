"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { getSettings, updateCommission } from "@/lib/api";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: getSettings,
  });

  const [commission, setCommission] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings?.commissionRate != null) {
      setCommission(String(settings.commissionRate));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: () => updateCommission(parseFloat(commission)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure commission rates and platform fees.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-6">Commission &amp; Fees</h2>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-100 rounded-xl" />
            <div className="h-10 bg-gray-100 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Platform Commission Rate
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-sm text-gray-500">
                  = {(parseFloat(commission || "0") * 100).toFixed(0)}% per booking
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Current: {((settings?.commissionRate ?? 0.05) * 100).toFixed(0)}%. Set as decimal (e.g. 0.05 = 5%)
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !commission}
                className="bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saved ? <span className="inline-flex items-center gap-1"><Check size={14} /> Saved</span> : updateMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
