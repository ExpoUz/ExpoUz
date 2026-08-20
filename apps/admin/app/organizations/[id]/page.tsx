"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  getOrganization,
  updateOrganization,
  setOrganizationStatus,
  getOrganizationVenues,
  assignOrganizationVenue,
  removeOrganizationVenue,
  getOrganizationStaff,
  inviteOrganizationStaff,
  revokeOrganizationInvite,
  attachOrganizationUser,
  changeOrganizationMemberRole,
  removeOrganizationMember,
  getOrganizationPlayers,
  getOrganizationRevenue,
  getOrganizationCrm,
  addOrganizationContact,
  setOrganizationPipeline,
  setOrganizationFollowUp,
} from "@/lib/api";

const TABS = ["Overview", "Venues", "Staff", "Players", "Revenue", "CRM", "Settings"] as const;
type Tab = (typeof TABS)[number];

const ROLES = ["OWNER", "MANAGER", "STAFF"];
const PIPELINE = ["LEAD", "CONTACTED", "DEMO", "NEGOTIATING", "ACTIVE", "CHURNED"];
const CONTACT_TYPES = ["NOTE", "CALL", "MEETING", "EMAIL"];
const FLAG_BADGE: Record<string, string> = {
  AT_RISK: "bg-red-100 text-red-600",
  DORMANT: "bg-gray-200 text-gray-600",
  RENEWAL_DUE: "bg-amber-100 text-amber-700",
};
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  SUSPENDED: "bg-red-100 text-red-600",
  ARCHIVED: "bg-gray-200 text-gray-500",
};

function money(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n || 0));
}

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Overview");
  const { data: org, isLoading } = useQuery({ queryKey: ["org", id], queryFn: () => getOrganization(id) });

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!org) return <div className="p-8 text-gray-400">Organization not found</div>;

  return (
    <div className="p-8">
      <Link href="/organizations" className="text-sm text-gray-500 hover:text-primary">
        ← Organizations
      </Link>

      <div className="mt-3 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            org.name?.[0] ?? "?"
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[org.status]}`}>
              {org.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">/{org.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab org={org} />}
      {tab === "Venues" && <VenuesTab id={id} />}
      {tab === "Staff" && <StaffTab id={id} />}
      {tab === "Players" && <PlayersTab id={id} />}
      {tab === "Revenue" && <RevenueTab id={id} />}
      {tab === "CRM" && <CrmTab id={id} />}
      {tab === "Settings" && <SettingsTab org={org} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function OverviewTab({ org }: { org: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Venues" value={org.venues} />
        <Stat label="Staff" value={org.staff} />
        <Stat label="Players" value={org.players} />
        <Stat label="This month" value={`${money(org.monthRevenue)} UZS`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-3">Commercial terms</h3>
          <Row k="Commission" v={`${org.effectiveCommissionPct}%${org.commissionRate == null ? " (platform default)" : ""}`} />
          <Row k="Player fee" v={`${org.effectivePlayerFeePct}%${org.playerFeeRate == null ? " (platform default)" : ""}`} />
          <Row k="Contract start" v={org.contractStartDate ? dayjs(org.contractStartDate).format("MMM D, YYYY") : "—"} />
          <Row k="Contract end" v={org.contractEndDate ? dayjs(org.contractEndDate).format("MMM D, YYYY") : "—"} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-3">Contact</h3>
          <Row k="Email" v={org.contactEmail || "—"} />
          <Row k="Phone" v={org.contactPhone || "—"} />
          <Row k="Address" v={org.address || "—"} />
          <Row k="Created" v={dayjs(org.createdAt).format("MMM D, YYYY")} />
        </div>
      </div>
      {org.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-2">Internal notes</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{org.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-900 font-medium text-right">{v}</span>
    </div>
  );
}

function VenuesTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["org-venues", id], queryFn: () => getOrganizationVenues(id) });
  const [adding, setAdding] = useState(false);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["org-venues", id] });
    qc.invalidateQueries({ queryKey: ["org", id] });
  };
  const assign = useMutation({
    mutationFn: (pitchId: string) => assignOrganizationVenue(id, pitchId),
    onSuccess: () => { invalidate(); setAdding(false); },
  });
  const remove = useMutation({
    mutationFn: (pitchId: string) => removeOrganizationVenue(id, pitchId),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-gray-900">Venues ({data?.venues.length ?? 0})</h3>
        <button onClick={() => setAdding((v) => !v)} className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white hover:opacity-90">
          {adding ? "Close" : "Add venue"}
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-2">Attach an unassigned venue:</p>
          {(data?.unassigned ?? []).length === 0 && <p className="text-sm text-gray-400">No unassigned venues available.</p>}
          <div className="space-y-2">
            {(data?.unassigned ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="text-gray-400"> · {p.district}, {p.city} · {p.sport}</span>
                </div>
                <button onClick={() => assign.mutate(p.id)} disabled={assign.isPending} className="text-xs font-semibold text-primary hover:underline">
                  Attach
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {(data?.venues ?? []).length === 0 && <div className="p-8 text-center text-gray-400">No venues assigned yet.</div>}
        {(data?.venues ?? []).map((p: any) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <div className="font-medium text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-400">
                {p.district}, {p.city} · {p.sport} · {p._count?.matches ?? 0} matches
              </div>
            </div>
            <button
              onClick={() => confirm(`Detach ${p.name} from this organization?`) && remove.mutate(p.id)}
              className="text-xs font-semibold text-red-500 hover:underline"
            >
              Detach
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["org-staff", id], queryFn: () => getOrganizationStaff(id) });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["org-staff", id] });
    qc.invalidateQueries({ queryKey: ["org", id] });
  };
  const [invite, setInvite] = useState({ contact: "", channel: "phone", role: "STAFF" });
  const [attachId, setAttachId] = useState("");

  const inviteMut = useMutation({
    mutationFn: () =>
      inviteOrganizationStaff(id, {
        [invite.channel === "phone" ? "phone" : "telegramId"]: invite.contact,
        role: invite.role,
      }),
    onSuccess: () => { invalidate(); setInvite({ contact: "", channel: "phone", role: "STAFF" }); },
  });
  const attachMut = useMutation({
    mutationFn: () => attachOrganizationUser(id, attachId.trim(), "STAFF"),
    onSuccess: () => { invalidate(); setAttachId(""); },
  });
  const roleMut = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) => changeOrganizationMemberRole(id, memberId, role),
    onSuccess: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: (memberId: string) => removeOrganizationMember(id, memberId),
    onSuccess: invalidate,
  });
  const revokeMut = useMutation({
    mutationFn: (inviteId: string) => revokeOrganizationInvite(id, inviteId),
    onSuccess: invalidate,
  });

  const input = "rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-6">
      {/* Members */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {(data?.members ?? []).map((m: any) => (
          <div key={m.id} className="flex items-center gap-3 px-5 py-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {m.user.firstName?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900">{m.user.firstName} {m.user.lastName}</div>
              <div className="text-xs text-gray-400">{m.user.phone ?? m.user.telegramUsername ?? "—"}</div>
            </div>
            <select
              value={m.role}
              onChange={(e) => roleMut.mutate({ memberId: m.id, role: e.target.value })}
              className={input}
            >
              {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
            <button
              onClick={() => confirm(`Remove ${m.user.firstName} from this organization? Access is revoked immediately.`) && removeMut.mutate(m.id)}
              className="text-xs font-semibold text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        {(data?.members ?? []).length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No members yet — invite the first OWNER below.</div>}
      </div>

      {/* Pending invites */}
      {(data?.invites ?? []).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pending invites</h4>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {data!.invites.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-gray-700">
                  {inv.phone ?? inv.telegramId} · <span className="text-gray-400">{inv.role}</span> · expires {dayjs(inv.expiresAt).format("MMM D")}
                </span>
                <button onClick={() => revokeMut.mutate(inv.id)} className="text-xs font-semibold text-red-500 hover:underline">Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite / attach forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="font-bold text-gray-900 mb-3">Invite staff</h4>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <select value={invite.channel} onChange={(e) => setInvite({ ...invite, channel: e.target.value })} className={input}>
                <option value="phone">Phone</option>
                <option value="telegram">Telegram</option>
              </select>
              <input className={`${input} flex-1`} placeholder={invite.channel === "phone" ? "+998…" : "@username"} value={invite.contact} onChange={(e) => setInvite({ ...invite, contact: e.target.value })} />
            </div>
            <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} className={input}>
              {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
            <button onClick={() => inviteMut.mutate()} disabled={!invite.contact.trim() || inviteMut.isPending} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40">
              Send invite
            </button>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="font-bold text-gray-900 mb-3">Attach existing user</h4>
          <p className="text-xs text-gray-400 mb-2">Paste a user ID to add them directly as STAFF (change role after).</p>
          <div className="flex gap-2">
            <input className={`${input} flex-1`} placeholder="user id" value={attachId} onChange={(e) => setAttachId(e.target.value)} />
            <button onClick={() => attachMut.mutate()} disabled={!attachId.trim() || attachMut.isPending} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40">
              Attach
            </button>
          </div>
          {attachMut.isError && <p className="text-xs text-red-500 mt-2">{(attachMut.error as any)?.response?.data?.message ?? "Failed"}</p>}
        </div>
      </div>
    </div>
  );
}

function PlayersTab({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ["org-players", id], queryFn: () => getOrganizationPlayers(id) });
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Player</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ELO</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reliability</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {(data ?? []).map((b: any) => (
            <tr key={b.id} className="hover:bg-gray-50">
              <td className="px-5 py-3 font-medium text-gray-900">{b.user.firstName} {b.user.lastName}</td>
              <td className="px-5 py-3 font-mono text-xs text-gray-600">{b.user.phone ?? "—"}</td>
              <td className="px-5 py-3 text-gray-700">{b.user.eloRating}</td>
              <td className="px-5 py-3 text-gray-700">{Math.round(b.user.reliabilityScore)}%</td>
            </tr>
          ))}
          {(data ?? []).length === 0 && (
            <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400">No players yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RevenueTab({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ["org-revenue", id], queryFn: () => getOrganizationRevenue(id) });
  if (!data) return <div className="text-gray-400">Loading…</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Gross" value={`${money(data.totalGross)}`} />
        <Stat label={`Commission (${data.commissionPct}%)`} value={`${money(data.totalCommission)}`} />
        <Stat label="Payout due" value={`${money(data.totalPayout)}`} />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Venue</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Commission</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.perVenue.map((v: any) => (
              <tr key={v.pitchId}>
                <td className="px-5 py-3 font-medium text-gray-900">{v.pitchName}</td>
                <td className="px-5 py-3 text-right text-gray-700">{money(v.gross)}</td>
                <td className="px-5 py-3 text-right text-gray-700">{money(v.commission)}</td>
                <td className="px-5 py-3 text-right text-gray-900 font-medium">{money(v.payout)}</td>
              </tr>
            ))}
            {data.perVenue.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400">No revenue yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function trendIcon(t: string) {
  if (t === "up") return <span className="text-green-600">▲ up</span>;
  if (t === "down") return <span className="text-red-500">▼ down</span>;
  return <span className="text-gray-400">— flat</span>;
}

function CrmTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["org-crm", id], queryFn: () => getOrganizationCrm(id) });
  const [contact, setContact] = useState({ type: "NOTE", summary: "", followUpDate: "" });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["org-crm", id] });

  const pipelineMut = useMutation({
    mutationFn: (stage: string) => setOrganizationPipeline(id, stage),
    onSuccess: invalidate,
  });
  const followUpMut = useMutation({
    mutationFn: (date: string | null) => setOrganizationFollowUp(id, { date }),
    onSuccess: invalidate,
  });
  const contactMut = useMutation({
    mutationFn: () =>
      addOrganizationContact(id, {
        type: contact.type,
        summary: contact.summary,
        followUpDate: contact.followUpDate || undefined,
      }),
    onSuccess: () => { invalidate(); setContact({ type: "NOTE", summary: "", followUpDate: "" }); },
  });

  const input = "rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  if (!data) return <div className="text-gray-400">Loading…</div>;
  const h = data.health;

  return (
    <div className="space-y-6">
      {/* Health + flags */}
      <div className="flex flex-wrap items-center gap-2">
        {h.flags.length === 0 && <span className="text-sm text-gray-400">No health flags — this partner looks healthy.</span>}
        {h.flags.map((f: string) => (
          <span key={f} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${FLAG_BADGE[f] ?? "bg-gray-100 text-gray-600"}`}>
            {f.replace("_", " ")}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Venues active" value={`${h.venuesActive}/${h.venuesListed}`} />
        <Stat label="Bookings 30d" value={<span>{h.bookingsLast30} <span className="text-sm font-normal">{trendIcon(h.bookingsTrend)}</span></span>} />
        <Stat label="Revenue 30d" value={<span>{money(h.revenueLast30)} <span className="text-sm font-normal">{trendIcon(h.revenueTrend)}</span></span>} />
        <Stat label="Open disputes" value={h.unresolvedDisputes} />
      </div>

      {/* Pipeline + follow-up */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-3">Pipeline stage</h3>
          <select value={data.pipelineStage} onChange={(e) => pipelineMut.mutate(e.target.value)} className={`${input} w-full`}>
            {PIPELINE.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <p className="text-xs text-gray-400 mt-2">Last activity: {h.lastActivityAt ? dayjs(h.lastActivityAt).format("MMM D, YYYY") : "never"}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-3">Next follow-up</h3>
          <div className="flex gap-2">
            <input
              type="date"
              defaultValue={data.followUpDate ? dayjs(data.followUpDate).format("YYYY-MM-DD") : ""}
              onChange={(e) => followUpMut.mutate(e.target.value || null)}
              className={`${input} flex-1`}
            />
            {data.followUpDate && (
              <button onClick={() => followUpMut.mutate(null)} className="text-xs font-semibold text-red-500 hover:underline">Clear</button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Contract ends: {data.contractEndDate ? dayjs(data.contractEndDate).format("MMM D, YYYY") : "—"}</p>
        </div>
      </div>

      {/* Log a contact */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-3">Log contact</h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select value={contact.type} onChange={(e) => setContact({ ...contact, type: e.target.value })} className={input}>
              {CONTACT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
            <input
              type="date"
              value={contact.followUpDate}
              onChange={(e) => setContact({ ...contact, followUpDate: e.target.value })}
              className={input}
              title="Optional: set the next follow-up"
            />
          </div>
          <textarea
            rows={2}
            className={input}
            placeholder="What was discussed?"
            value={contact.summary}
            onChange={(e) => setContact({ ...contact, summary: e.target.value })}
          />
          <button
            onClick={() => contactMut.mutate()}
            disabled={!contact.summary.trim() || contactMut.isPending}
            className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            Save entry
          </button>
        </div>
      </div>

      {/* Contact log */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {(data.contacts ?? []).length === 0 && <div className="p-8 text-center text-gray-400">No contact history yet.</div>}
        {(data.contacts ?? []).map((c: any) => (
          <div key={c.id} className="px-5 py-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span className="font-semibold text-gray-600">{c.type}</span>
              <span>{c.authorName} · {dayjs(c.createdAt).format("MMM D, YYYY HH:mm")}</span>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ org }: { org: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    name: org.name,
    contactEmail: org.contactEmail ?? "",
    contactPhone: org.contactPhone ?? "",
    address: org.address ?? "",
    commissionRate: org.commissionRate ?? "",
    playerFeeRate: org.playerFeeRate ?? "",
    notes: org.notes ?? "",
  });
  const [saved, setSaved] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["org", org.id] });

  const save = useMutation({
    mutationFn: () =>
      updateOrganization(org.id, {
        ...form,
        commissionRate: form.commissionRate === "" ? null : Number(form.commissionRate),
        playerFeeRate: form.playerFeeRate === "" ? null : Number(form.playerFeeRate),
      }),
    onSuccess: () => { invalidate(); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });
  const status = useMutation({
    mutationFn: (s: string) => setOrganizationStatus(org.id, s),
    onSuccess: invalidate,
  });

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const input = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  const label = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-gray-900">Terms & contact</h3>
        <div><label className={label}>Name</label><input className={input} value={form.name} onChange={set("name")} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Contact email</label><input className={input} value={form.contactEmail} onChange={set("contactEmail")} /></div>
          <div><label className={label}>Contact phone</label><input className={input} value={form.contactPhone} onChange={set("contactPhone")} /></div>
        </div>
        <div><label className={label}>Address</label><input className={input} value={form.address} onChange={set("address")} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Commission % (blank = default)</label><input type="number" className={input} value={form.commissionRate} onChange={set("commissionRate")} /></div>
          <div><label className={label}>Player fee % (blank = default)</label><input type="number" className={input} value={form.playerFeeRate} onChange={set("playerFeeRate")} /></div>
        </div>
        <div><label className={label}>Internal notes</label><textarea rows={3} className={input} value={form.notes} onChange={set("notes")} /></div>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40">
          {save.isPending ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-gray-900">Status</h3>
        <p className="text-sm text-gray-500">Current: <span className="font-semibold">{org.status}</span></p>
        <div className="flex flex-wrap gap-2">
          {org.status !== "ACTIVE" && (
            <button onClick={() => status.mutate("ACTIVE")} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              Reactivate
            </button>
          )}
          {org.status !== "SUSPENDED" && (
            <button
              onClick={() =>
                confirm(
                  "Suspend this organization?\n\nAll members lose panel access immediately and its venues stop accepting NEW bookings. Existing confirmed bookings are honoured (players' games are NOT cancelled).",
                ) && status.mutate("SUSPENDED")
              }
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            >
              Suspend
            </button>
          )}
          {org.status !== "ARCHIVED" && (
            <button
              onClick={() => confirm("Archive this organization? Members lose access and it is hidden from active lists.") && status.mutate("ARCHIVED")}
              className="rounded-xl bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
