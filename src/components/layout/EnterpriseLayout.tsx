// src/components/layout/EnterpriseLayout.tsx

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { User, Shield, LogOut, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnitConfig } from '../../contexts/UnitConfigContext';

// 🆕 Notification System Import
import NotificationBell from '../../features/notifications/NotificationBell';
// ★ Module 19: maintenance mode flag (system_config/flags)
import { getSystemFlags, DEFAULT_FLAGS, SystemFlags } from '../../features/system/systemHealth.api';
import { Construction } from 'lucide-react';

// 🆕 Global Search (Ctrl+K) — permission-based
import GlobalSearch from '../../features/globalSearch/GlobalSearch';

interface EnterpriseLayoutProps {
  children: React.ReactNode;
}

export const EnterpriseLayout: React.FC<EnterpriseLayoutProps> = ({ children }) => {
  const [time, setTime] = useState(new Date());

  // Firebase Auth Context se live user data aur logout
  const { user, logout } = useAuth();

  // 🔥 Unit Config Context se DYNAMIC data
  const { unitConfig, loading: configLoading } = useUnitConfig();

  // ★ Module 19: maintenance flag state (default OFF — safe)
  const [maintenance, setMaintenance] = useState<SystemFlags>(DEFAULT_FLAGS);
  useEffect(() => {
    getSystemFlags().then(setMaintenance);
    // Har 2 min mein refresh (CC flag badle to jaldi pata chale)
    const timer = setInterval(() => { getSystemFlags().then(setMaintenance); }, 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

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

          {/* 🆕 GLOBAL SEARCH BAR — sab roles ke liye, results permission-based */}
          <div className="flex-1 max-w-xl mx-6 hidden md:block">
            <GlobalSearch />
          </div>

          <div className="flex items-center space-x-6">
            {/* Mobile: sirf search icon ke liye */}
            <div className="md:hidden w-40">
              <GlobalSearch />
            </div>
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
            <NotificationBell />

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
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors border border-transparent hover:border-red-200"
                title="Secure Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 custom-scrollbar bg-slate-50">
          {/* ★ Module 19: Maintenance Mode banner — non-CC users ko dikhega,
              CC kaam karta rahega (banner bhi dikhega par amber info ke roop mein) */}
          {maintenance.maintenanceMode && user?.role !== 'Company Commander' && (
            <div className="mb-3 bg-amber-50 border-l-4 border-amber-500 text-amber-900 px-4 py-3 rounded flex items-start gap-3 shadow-sm">
              <Construction size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider">⚠️ Maintenance Mode Active</p>
                <p className="text-xs font-semibold mt-0.5 normal-case">{maintenance.maintenanceMessage}</p>
                <p className="text-[10px] text-amber-700 mt-1">Kaam save karke wait karein. Data entry abhi avoid karein — CC Office.</p>
              </div>
            </div>
          )}
          {children}
        </main>

      </div>
    </div>
  );
};