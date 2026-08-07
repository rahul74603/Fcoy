// src/components/layout/EnterpriseLayout.tsx

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { User, Shield, LogOut, Loader2, MapPin, Layers } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';
import { useUnitConfig } from '../../contexts/UnitConfigContext';

// 🆕 Notification System Import
import NotificationBell from '../../features/notifications/NotificationBell';
import { GlobalSearch } from './GlobalSearch';

// 🆕 Subscription Expiry Banner
import SubscriptionBanner from '../../features/subscription/components/SubscriptionBanner';

// 🧪 Dev Practice Mode Banner
import PracticeBanner from '../../features/developer/components/PracticeBanner';

// 🔍 Global Search (har role apni permitted cheezein search kare)

interface EnterpriseLayoutProps {
  children: React.ReactNode;
}

// ⛓️ BATCH SWITCHER — STRICT BATCH RULE
// Is dropdown se jo batch select hoga, POORA APP (funds, dashboards,
// search, reports — sab) sirf USHI batch ka data dikhayega.
// 🔒 DEVELOPER ACCOUNT: koi dropdown NAHI — wo TEST-77 sandbox se
// permanently LOCKED hai (alag project jaisa). Sirf static badge dikhega.
const BatchSwitcher: React.FC = () => {
  const { user } = useAuth();
  const { allBatches, currentBatch, setSelectedBatch } = useBatch();

  // 🔒 DEV LOCK — developer ke liye batch-change system hi nahi hai
  if (user?.isDeveloper) {
    return (
      <div
        className="hidden xl:flex items-center gap-1.5 border-2 rounded-lg px-2.5 py-1.5 bg-purple-50 border-purple-400"
        title="Dev Sandbox: TEST-77 se permanently locked. Real batch ka data yahan kabhi nahi aata, TEST-77 ka data real me kabhi nahi jaata."
      >
        <Layers size={13} className="text-purple-700" />
        <span className="text-[11px] font-black uppercase text-purple-800">
          🧪 {currentBatch?.batchNumber ?? 'TEST-77'} · DEV SANDBOX · 🔒
        </span>
      </div>
    );
  }

  if (allBatches.length === 0) return null;
  return (
    <div
      className={`hidden xl:flex items-center gap-1.5 border-2 rounded-lg px-2.5 py-1.5 ${
        currentBatch?.status === 'active' ? 'bg-green-50 border-green-400' : 'bg-slate-50 border-slate-400'
      }`}
      title="Batch Rule: har screen sirf SELECTED batch ka data dikhayegi — 2 batches ka data kabhi mix nahi"
    >
      <Layers size={13} className="text-green-700" />
      <select
        value={currentBatch?.id ?? ''}
        onChange={e => setSelectedBatch(e.target.value)}
        className="bg-transparent text-[11px] font-black uppercase text-slate-800 outline-none cursor-pointer max-w-[170px]"
      >
        {allBatches.map(b => (
          <option key={b.id} value={b.id}>
            {b.batchNumber}{b.status === 'active' ? ' ●LIVE' : ' (completed)'}
          </option>
        ))}
      </select>
    </div>
  );
};

export const EnterpriseLayout: React.FC<EnterpriseLayoutProps> = ({ children }) => {
  const [time, setTime] = useState(new Date());

  // Firebase Auth Context se live user data aur logout
  const { user, logout } = useAuth();

  // 🔥 Unit Config Context se DYNAMIC data
  const { unitConfig, loading: configLoading } = useUnitConfig();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen bg-military-50 font-sans text-slate-800 overflow-hidden">
      {/* Left Sidebar Navigation */}
      <Sidebar />

      {/* Right Side Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full relative">

        {/* Supreme Command Header */}
        <header className="h-16 bg-white border-b-2 border-military-800 shadow-flat flex items-center justify-between px-6 z-10 flex-shrink-0">

          <div className="flex items-center space-x-4">
            {/* Unit Logo */}
            <div className="h-10 w-10 bg-military-900 rounded-sm flex items-center justify-center text-white shadow-inner">
              <Shield size={24} />
            </div>

            <div className="flex flex-col">
              <h2 className="text-[18px] font-black text-military-900 uppercase tracking-widest leading-tight">
                BSF Training Center Management System
              </h2>

              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-2 mt-0.5">
                {configLoading ? (
                  <span className="text-slate-400 bg-slate-50 px-1.5 py-0.5 border border-slate-200 flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin" /> Loading...
                  </span>
                ) : (
                  <>
                    <span className="text-military-800 bg-military-50 px-1.5 py-0.5 border border-military-300">
                      UNIT: {unitConfig.parentUnit}
                    </span>
                    <span className="text-military-800 bg-military-50 px-1.5 py-0.5 border border-military-300">
                      COY: {unitConfig.companyShort || unitConfig.companyName}
                    </span>
                    {unitConfig.location && (
                      <span className="text-slate-500 bg-slate-50 px-1.5 py-0.5 border border-slate-200 flex items-center gap-1">
                        <MapPin size={9} /> {unitConfig.location}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 🔍 GLOBAL SEARCH — "Search everything you can access" */}
          <GlobalSearch />
          <BatchSwitcher />

          <div className="flex items-center space-x-6">
            {/* Live Date & Time */}
            <div className="flex flex-col text-right mr-4 border-r border-slate-300 pr-6">
              <span className="text-[12px] font-black text-military-900 uppercase">
                {time.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {time.toLocaleTimeString('en-GB')} IST
              </span>
            </div>

            {/* 🆕 LIVE NOTIFICATION BELL (Was static before) */}
            <div className="print:hidden"><NotificationBell /></div>

            {/* Dynamic User Profile & Logout */}
            <div className="flex items-center space-x-4 pl-2 border-l border-slate-300">
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-bold text-military-900 leading-tight">
                    {user?.name || 'Loading...'}
                  </div>
                  <div className="text-[11px] text-red-600 font-bold uppercase">
                    {user?.role || 'Authenticating'}
                  </div>
                </div>
                <div className="h-9 w-9 bg-military-100 border border-military-300 text-military-800 rounded-sm flex items-center justify-center">
                  <User size={18} />
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="print:hidden p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors border border-transparent hover:border-red-200"
                title="Secure Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* 🧪 Practice Mode Banner (sirf dev account ko) */}
        <div className="app-banner"><PracticeBanner /></div>

        {/* 🆕 Subscription Expiry / Grace / Expired Warning */}
        <div className="app-banner"><SubscriptionBanner /></div>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 custom-scrollbar bg-slate-50">
          {children}
        </main>

      </div>
    </div>
  );
};