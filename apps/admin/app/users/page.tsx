"use client";

import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/lib/api";
import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";

export default function UsersPage() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getUsers(),
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sort, setSort] = useState<"name" | "elo" | "createdAt">("createdAt");

  const ROLES = ["ALL", "PLAYER", "PITCH_OWNER", "ADMIN", "SUPER_ADMIN"];

  const filtered = (users ?? [])
    .filter((u: any) => {
      const term = search.toLowerCase();
      const matches =
        !term ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(term) ||
        u.phone?.includes(term) ||
        u.email?.toLowerCase().includes(term);
      const roleMatch = roleFilter === "ALL" || u.role === roleFilter;
      return matches && roleMatch;
    })
    .sort((a: any, b: any) => {
      if (sort === "name") return `${a.firstName}`.localeCompare(`${b.firstName}`);
      if (sort === "elo") return (b.eloRating ?? 0) - (a.eloRating ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">{(users ?? []).length} total users</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex gap-3 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search by name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-56 rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                roleFilter === r
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r === "ALL" ? "All" : r.replace("_", " ")}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
        >
          <option value="createdAt">Sort: Newest</option>
          <option value="elo">Sort: ELO</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">⚽ Football</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">🎾 Padel</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reliability</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading &&
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(9)].map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-gray-400">
                  No users found
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 flex-shrink-0">
                        {u.firstName?.[0] ?? "?"}
                      </div>
                      <div>
                        <Link
                          href={`/users/${u.id}`}
                          className="font-medium text-gray-900 hover:text-green-700 hover:underline"
                        >
                          {u.firstName} {u.lastName}
                        </Link>
                        {u.email && (
                          <div className="text-xs text-gray-400">{u.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-700 font-mono text-xs">{u.phone}</td>
                  <td className="px-5 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-bold ${
                          u.eloRating >= 1300
                            ? "text-red-500"
                            : u.eloRating >= 1100
                            ? "text-yellow-500"
                            : "text-green-600"
                        }`}
                      >
                        {u.eloRating ?? 1000}
                      </span>
                      {u.skillLevel && (
                        <span className="text-[10px] text-gray-400 uppercase">{u.skillLevel}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {u.padelInitialSet ? (
                      <span className="font-bold text-[#00B0FF]">{Number(u.padelLevel ?? 0).toFixed(1)}</span>
                    ) : (
                      <span className="text-xs text-gray-300">unrated</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <ReliabilityBar score={u.reliabilityScore ?? 100} />
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.city ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.isBanned
                          ? "bg-red-100 text-red-500"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {u.isBanned ? "Banned" : "Active"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {dayjs(u.createdAt).format("MMM D, YYYY")}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    SUPER_ADMIN: "bg-red-100 text-red-700",
    ADMIN: "bg-orange-100 text-orange-700",
    PITCH_OWNER: "bg-purple-100 text-purple-700",
    PLAYER: "bg-green-100 text-green-700",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[role] ?? "bg-gray-100 text-gray-500"}`}
    >
      {role.replace("_", " ")}
    </span>
  );
}

function ReliabilityBar({ score }: { score: number }) {
  const color =
    score >= 90 ? "#00C853" : score >= 70 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-500">{Math.round(score)}%</span>
    </div>
  );
}
