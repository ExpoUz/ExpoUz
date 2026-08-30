'use client';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, CalendarDays, Users, TrendingUp } from 'lucide-react';

const TABS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pitches', label: 'Pitches', icon: Building2 },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/players', label: 'Players', icon: Users },
  { href: '/revenue', label: 'Revenue', icon: TrendingUp },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-[#111a14] border-[#1e2e21] flex h-16 items-center justify-around px-2 z-50">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <button key={href} onClick={() => router.push(href)} className="flex flex-col items-center gap-0.5 flex-1 py-1">
            <Icon size={20} color={active ? '#00C853' : '#7a9a80'} />
            <span className="text-[10px] font-medium" style={{ color: active ? '#00C853' : '#7a9a80' }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
