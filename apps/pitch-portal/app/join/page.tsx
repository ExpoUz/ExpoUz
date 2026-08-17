"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { previewInvite, acceptInvite } from "@/lib/api";
import { Spinner } from "@/components/ui";

const REASONS: Record<string, string> = {
  not_found: "This invite link is not valid.",
  already_used: "This invite has already been used.",
  expired: "This invite has expired. Ask your organization to send a new one.",
  org_inactive: "This organization is not currently active.",
};

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");

  const { data: preview, isLoading } = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => previewInvite(token),
    enabled: !!token,
  });

  const accept = useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-context"] });
      router.replace("/");
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Could not accept invite"),
  });

  if (!token) return <Centered>Missing invite token.</Centered>;
  if (isLoading) return <Centered><Spinner /></Centered>;
  if (!preview?.valid) return <Centered>{REASONS[(preview as any)?.reason] ?? "Invalid invite."}</Centered>;

  return (
    <Centered>
      <div className="text-center">
        {preview.orgLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.orgLogoUrl} alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#00C853]/15 flex items-center justify-center text-2xl font-bold text-[#00A344] mx-auto mb-4">
            {preview.orgName?.[0] ?? "?"}
          </div>
        )}
        <h1 className="text-xl font-bold text-[#0D1117]">Join {preview.orgName}</h1>
        <p className="text-sm text-gray-500 mt-1">
          You&apos;ve been invited as <span className="font-semibold">{preview.role}</span>.
        </p>
        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        <button
          onClick={() => { setError(""); accept.mutate(); }}
          disabled={accept.isPending}
          className="mt-6 w-full rounded-xl bg-[#00C853] px-5 py-3 font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          {accept.isPending ? "Joining…" : "Accept & join"}
        </button>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F5F6F8]">
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white shadow-sm p-8">{children}</div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<Centered><Spinner /></Centered>}>
      <JoinInner />
    </Suspense>
  );
}
