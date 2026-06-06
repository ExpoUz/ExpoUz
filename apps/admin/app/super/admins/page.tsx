"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, changeUserRole, deleteUser } from "@/lib/api";
import { useState } from "react";
import dayjs from "dayjs";

export default function AdminsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: allUsers, isLoading } = useQuery({
    queryKey: ["all-users-for-admins"],
    queryFn: () => getUsers({ limit: 500 }),
  });

  const admins = (allUsers ?? []).filter((u: any) =>
    ["ADMIN", "SUPER_ADMIN"].includes(u.role)
  );

  const players = (allUsers ?? []).filter(
    (u: any) => u.role === "PLAYER" || u.role === "PITCH_OWNER"
  );

  const promoteMutation = useMutation({
    mutationFn: (id: string) => changeUserRole(id, "ADMIN"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-users-for-admins"] }),
  });

  const demoteMutation = useMutation({
    mutationFn: (id: string) => changeUserRole(id, "PLAYER"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-users-for-admins"] }),
  });

  const filteredPlayers = players.filter((u: any) => {
    const s = search.toLowerCase();
    return (
      !s ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(s) ||
      u.phone?.includes(s)
    );
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage platform admins. Promote users to admin or remove admin access.
        </p>
      </div>

      {/* Current Admins */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            Current Admins ({admins.length})
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {admins.map((u: any) => (
              <div key={u.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-700">
                  {u.firstName?.[0] ?? "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {u.firstName} {u.lastName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {u.phone} · Since {dayjs(u.createdAt).format("MMM YYYY")}
                  </div>
                </div>
                <RoleBadge role={u.role} />
                {u.role === "ADMIN" && (
                  <button
                    onClick={() => demoteMutation.mutate(u.id)}
                    disabled={demoteMutation.isPending}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Remove Admin
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promote User */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="font-semibold text-gray-900 flex-1">
            Promote User to Admin
          </h2>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 w-56"
          />
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {filteredPlayers.slice(0, 50).map((u: any) => (
            <div key={u.id} className="px-6 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
                {u.firstName?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {u.firstName} {u.lastName}
                </div>
                <div className="text-xs text-gray-500">{u.phone}</div>
              </div>
              <RoleBadge role={u.role} />
              <button
                onClick={() => promoteMutation.mutate(u.id)}
                disabled={promoteMutation.isPending}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                Make Admin
              </button>
            </div>
          ))}
        </div>
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
      {role.replace(/_/g, " ")}
    </span>
  );
}
