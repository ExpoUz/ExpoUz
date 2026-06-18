"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SportSwitcher } from "./SportSwitcher";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [open, setOpen] = useState(false);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-[#0D1117] text-white flex items-center px-3 gap-3">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <span className="font-bold text-sm flex-1">
          <span className="text-[#00C853]">SCORE</span> Admin
        </span>
        <SportSwitcher />
      </div>

      {/* Off-canvas overlay (mobile) */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar: static on desktop, slide-over on mobile */}
      <div
        className={`fixed md:static z-50 h-full transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        onClick={() => setOpen(false)}
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden absolute top-3 right-3 text-white z-10"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
          <Sidebar />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pt-12 md:pt-0">
        {/* Desktop top bar with the global sport switcher */}
        <div className="hidden md:flex sticky top-0 z-30 h-14 bg-white/90 backdrop-blur border-b border-gray-100 items-center justify-end px-8">
          <SportSwitcher />
        </div>
        {children}
      </main>
    </div>
  );
}
