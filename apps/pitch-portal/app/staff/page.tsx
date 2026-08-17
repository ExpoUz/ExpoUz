"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStaff,
  inviteStaff,
  revokeStaffInvite,
  changeStaffRole,
  removeStaff,
  type OrgRole,
} from "@/lib/api";
import { PageHeader, Spinner } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const ROLES: OrgRole[] = ["OWNER", "MANAGER", "STAFF"];

export default function StaffPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-staff"], queryFn: getStaff });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["portal-staff"] });

  const [invite, setInvite] = useState({ channel: "phone", contact: "", role: "STAFF" as OrgRole });

  const inviteMut = useMutation({
    mutationFn: () =>
      inviteStaff({ [invite.channel === "phone" ? "phone" : "telegramId"]: invite.contact, role: invite.role }),
    onSuccess: () => { invalidate(); setInvite({ channel: "phone", contact: "", role: "STAFF" }); },
  });
  const roleMut = useMutation({
    mutationFn: (v: { memberId: string; role: OrgRole }) => changeStaffRole(v.memberId, v.role),
    onSuccess: invalidate,
  });
  const removeMut = useMutation({ mutationFn: (memberId: string) => removeStaff(memberId), onSuccess: invalidate });
  const revokeMut = useMutation({ mutationFn: (id: string) => revokeStaffInvite(id), onSuccess: invalidate });

  const input = "rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00C853]/30";

  if (isLoading) return <div className="p-8"><Spinner /></div>;

  // Server returns 403 for non-OWNER — surface a friendly message.
  if (error) {
    return (
      <div className="p-5 md:p-8 max-w-4xl mx-auto">
        <PageHeader title={t("nav.staff")} />
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-400">
          Only an OWNER can manage staff.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader title={t("nav.staff")} subtitle="Manage who can access this workspace" />

      {/* Members */}
      <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
        {(data?.members ?? []).map((m: any) => (
          <div key={m.id} className="flex items-center gap-3 px-5 py-3">
            <div className="w-9 h-9 rounded-full bg-[#00C853]/15 flex items-center justify-center text-sm font-bold text-[#00A344]">
              {m.user.firstName?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[#0D1117]">{m.user.firstName} {m.user.lastName}</div>
              <div className="text-xs text-gray-400">{m.user.phone ?? m.user.telegramUsername ?? "—"}</div>
            </div>
            <select value={m.role} onChange={(e) => roleMut.mutate({ memberId: m.id, role: e.target.value as OrgRole })} className={input}>
              {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
            <button
              onClick={() => confirm(`Remove ${m.user.firstName}? Their access is revoked immediately.`) && removeMut.mutate(m.id)}
              className="text-xs font-semibold text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {(data?.invites ?? []).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Pending invites</h4>
          <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
            {data!.invites.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-gray-700">{inv.phone ?? inv.telegramId} · <span className="text-gray-400">{inv.role}</span></span>
                <button onClick={() => revokeMut.mutate(inv.id)} className="text-xs font-semibold text-red-500 hover:underline">Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h4 className="font-bold text-[#0D1117] mb-3">Invite a staff member</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={invite.channel} onChange={(e) => setInvite({ ...invite, channel: e.target.value })} className={input}>
            <option value="phone">Phone</option>
            <option value="telegram">Telegram</option>
          </select>
          <input
            className={`${input} flex-1`}
            placeholder={invite.channel === "phone" ? "+998…" : "@username"}
            value={invite.contact}
            onChange={(e) => setInvite({ ...invite, contact: e.target.value })}
          />
          <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as OrgRole })} className={input}>
            {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
          <button
            onClick={() => inviteMut.mutate()}
            disabled={!invite.contact.trim() || inviteMut.isPending}
            className="rounded-xl bg-[#00C853] px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}
