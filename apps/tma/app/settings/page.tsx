'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronRight, Globe, Bell, Wallet, LogOut, Copy } from 'lucide-react';
import { useTMAAuth } from '../../lib/auth';
import { usersApi } from '../../lib/api';
import BottomNav from '../../components/BottomNav';

function formatUZS(n: number) { return new Intl.NumberFormat('uz-UZ').format(n); }

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useTMAAuth();
  const [language, setLanguage] = useState<'uz' | 'ru' | 'en'>('uz');
  const [notifications, setNotifications] = useState({ matchFull: true, matchReminder: true, paymentUpdate: true, promotions: false });

  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: usersApi.getWallet, enabled: !!user });

  const LANGS = [{ id: 'uz', label: 'O\'zbekcha 🇺🇿' }, { id: 'ru', label: 'Русский 🇷🇺' }, { id: 'en', label: 'English 🇬🇧' }];
  const referralCode = `EXPOZ-${user?.id?.slice(0, 6).toUpperCase() || 'XXXXXX'}`;

  function copyReferral() {
    navigator.clipboard.writeText(referralCode);
    // toast("Copied!")
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-gray-900">Settings</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Wallet */}
        <div className="rounded-2xl bg-gradient-to-r from-[#00C853] to-[#00A844] p-4">
          <p className="text-sm text-white/70 mb-0.5">In-App Wallet</p>
          <p className="font-display text-3xl font-extrabold text-white">{formatUZS(Number(wallet?.balance || 0))} UZS</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => router.push('/wallet/topup')} className="flex-1 rounded-xl bg-white/20 py-2 text-sm font-semibold text-white">+ Top Up</button>
            <button onClick={() => router.push('/wallet/withdraw')} className="flex-1 rounded-xl bg-white/20 py-2 text-sm font-semibold text-white">↓ Withdraw</button>
          </div>
        </div>

        {/* Language */}
        <div className="rounded-2xl bg-white">
          <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Language</p>
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLanguage(l.id as any)}
              className="flex w-full items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-800">{l.label}</span>
              {language === l.id && <span className="text-[#00C853] font-bold">✓</span>}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <div className="rounded-2xl bg-white">
          <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Notifications</p>
          {[
            { key: 'matchFull', label: 'Match is full' },
            { key: 'matchReminder', label: 'Match reminder (1h before)' },
            { key: 'paymentUpdate', label: 'Payment updates' },
            { key: 'promotions', label: 'Promotions & offers' },
          ].map((n) => (
            <div key={n.key} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-800">{n.label}</span>
              <button onClick={() => setNotifications({ ...notifications, [n.key]: !notifications[n.key as keyof typeof notifications] })}
                className={`relative h-6 w-11 rounded-full transition-colors ${notifications[n.key as keyof typeof notifications] ? 'bg-[#00C853]' : 'bg-gray-200'}`}>
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${notifications[n.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>

        {/* Referral */}
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Referral</p>
          <p className="text-sm text-gray-600 mb-3">Share your code and earn when friends join their first match.</p>
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
            <p className="flex-1 font-mono text-sm font-bold text-gray-800">{referralCode}</p>
            <button onClick={copyReferral} className="text-[#00C853]"><Copy size={16} /></button>
          </div>
        </div>

        {/* Account */}
        <div className="rounded-2xl bg-white">
          <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Account</p>
          <button className="flex w-full items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-sm text-gray-800">Privacy Policy</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
          <button className="flex w-full items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-sm text-gray-800">Terms of Service</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
          <button className="flex w-full items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-sm text-gray-800">Contact Support</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
          <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3 text-red-500">
            <LogOut size={16} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 pb-4">ExpoUz v1.0.0 · Made with ⚽ in Tashkent</p>
      </div>

      <BottomNav active="settings" />
    </div>
  );
}
