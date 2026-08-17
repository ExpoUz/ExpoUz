"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Login and the invite-join page render standalone (no sidebar/shell).
  const isStandalone = pathname === "/login" || pathname === "/join";

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
