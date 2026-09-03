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
import SubscriptionStatusChip from '../../features/subscription/components/SubscriptionStatusChip';
import SubscriptionGate from '../../features/subscription/components/SubscriptionGate';

// 🧪 Dev Practice Mode Banner
import PracticeBanner from '../../features/developer/components/PracticeBanner';

// 🔍 Global Search (har role apni permitted cheezein search kare)

interface EnterpriseLayoutProps {
  children: React.ReactNode;
}

// ⛓️ BATCH SWITCHER — STRICT BATCH RULE
// Is dropdown se jo batch select hoga, POORA APP (funds, dashboards,
// search, reports — sab) sirf USHI batch ka data dikhayega.
// 🧪 DEVELOPER ACCOUNT: sandbox dropdown — SIRF dev batches (TEST-77 jaise)
// dikhte hain; real batch yahan aata hi nahi (BatchContext filter).
// MASTER COY yahan se apne test batches manage karega.
const BatchSwitcher: React.FC = () => {
  const { allBatches, currentBatch, setSelectedBatch } = useBatch();

  if (allBatches.length === 0) {
    return (
      <div className="hidden xl:flex items-center gap-1.5 border-2 rounded-lg px-2.5 py-1.5 bg-amber-50 border-amber-400" title="Koi batch list nahi mili">
        <Layers size={13} className="text-amber-700" />
        <span className="text-[11px] font-black uppercase text-amber-800">No batch</span>
      </div>
    );
  }
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
      <div className="relative flex h-full min-w-0 flex-1 flex-col">

        {/* Supreme Command Header */}
        <header className="z-10 flex-shrink-0 border-b-2 border-military-800 bg-white px-3 py-2 shadow-flat sm:px-4 lg:px-5">
          {/* Identity + live controls. min-w-0/truncate keeps long names on one line. */}
          <div className="flex min-h-12 w-full items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              {/* Unit Logo */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-military-900 text-white shadow-inner sm:h-10 sm:w-10">
                <Shield size={22} />
              </div>

              <div className="min-w-0 flex-1" title="BSF Training Center Management System">
                <h2 className="truncate whitespace-nowrap text-[14px] font-black uppercase leading-tight tracking-[0.12em] text-military-900 sm:text-[16px]">
                  <span className="2xl:hidden">BSF Training Center ERP</span>
                  <span className="hidden 2xl:inline">BSF Training Center Management System</span>
                </h2>

                <div className="mt-0.5 hidden min-w-0 items-center gap-1.5 overflow-hidden text-[10px] font-bold uppercase tracking-wide text-slate-600 sm:flex">
                  {configLoading ? (
                    <span className="flex items-center gap-1 whitespace-nowrap border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-400">
                      <Loader2 size={9} className="animate-spin" /> Loading...
                    </span>
                  ) : (
                    <>
                      <span
                        className="max-w-[150px] truncate whitespace-nowrap border border-military-300 bg-military-50 px-1.5 py-0.5 text-military-800"
                        title={`Unit: ${unitConfig.parentUnit}`}
                      >
                        UNIT: {unitConfig.parentUnit}
                      </span>
                      <span
                        className="max-w-[120px] truncate whitespace-nowrap border border-military-300 bg-military-50 px-1.5 py-0.5 text-military-800"
                        title={`Company: ${unitConfig.companyShort || unitConfig.companyName}`}
                      >
                        COY: {unitConfig.companyShort || unitConfig.companyName}
                      </span>
                      {unitConfig.location && (
                        <span
                          className="hidden max-w-[150px] items-center gap-1 truncate whitespace-nowrap border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-500 lg:inline-flex"
                          title={unitConfig.location}
                        >
                          <MapPin size={9} className="shrink-0" />
                          <span className="truncate">{unitConfig.location}</span>
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
              {/* Live Date & Time — never wraps; compact screens hide it. */}
              <div className="mr-1 hidden flex-col border-r border-slate-300 pr-3 text-right xl:flex">
                <span className="whitespace-nowrap text-[11px] font-black uppercase text-military-900">
                  {time.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="whitespace-nowrap font-mono text-[10px] font-bold text-slate-500">
                  {time.toLocaleTimeString('en-GB')} IST
                </span>
              </div>

              {/* Desktop/tablet license status. Mobile copy is in the controls row. */}
              <div className="hidden lg:block print:hidden">
                <SubscriptionStatusChip />
              </div>

              <div className="print:hidden"><NotificationBell /></div>

              {/* Dynamic User Profile & Logout */}
              <div className="flex items-center gap-1.5 border-l border-slate-300 pl-2 sm:gap-2">
                <div className="hidden max-w-[165px] min-w-0 text-right xl:block" title={`${user?.name || ''} · ${user?.role || ''}`}>
                  <div className="truncate whitespace-nowrap text-[12px] font-bold leading-tight text-military-900">
                    {user?.name || 'Loading...'}
                  </div>
                  <div className="truncate whitespace-nowrap text-[10px] font-bold uppercase text-red-600">
                    {user?.role || 'Authenticating'}
                  </div>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-military-300 bg-military-100 text-military-800 sm:h-9 sm:w-9">
                  <User size={18} />
                </div>

                <button
                  onClick={logout}
                  className="print:hidden rounded-sm border border-transparent p-1.5 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:p-2"
                  title="Secure Logout"
                  aria-label="Secure logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Search is a dedicated responsive row, so it remains usable on mobile. */}
          <div className="mt-2 flex w-full flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:items-center">
            <div className="shrink-0 lg:hidden print:hidden">
              <SubscriptionStatusChip />
            </div>
            <GlobalSearch className="w-full sm:min-w-[240px]" />
            <BatchSwitcher />
          </div>
        </header>

        {/* 🧪 Practice Mode Banner (sirf dev account ko) */}
        <div className="app-banner"><PracticeBanner /></div>

        {/* 🆕 Subscription Expiry / Grace / Expired Warning */}
        <div className="app-banner"><SubscriptionBanner /></div>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 custom-scrollbar bg-slate-50">
          <SubscriptionGate>{children}</SubscriptionGate>
        </main>

      </div>
    </div>
  );
};