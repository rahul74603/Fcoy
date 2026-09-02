// ═══════════════════════════════════════════════════════════
// ADMIN DASHBOARD — HQ Training Command
// Real Firestore data — no mock data
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, FileText, Activity, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Layers, ArrowRight, Building2,
} from 'lucide-react';
import {
  collection, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const go = useCallback((path: string) => navigate(path), [navigate]);
  const { currentBatch: activeBatch } = useBatch();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTrainees: 0,
    presentToday: 0,
    absentToday: 0,
    onLeave: 0,
    sickHospital: 0,
    totalBatches: 0,
    activeBatches: 0,
    totalStaff: 0,
    docsPending: 0,
    fptFailed: 0,
  });
  const [recentTrainees, setRecentTrainees] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [traineesSnap, batchesSnap, staffSnap] = await Promise.all([
        getDocs(collection(db, 'trainees')),
        getDocs(collection(db, 'batches')),
        getDocs(collection(db, 'staff')).catch(() => ({ docs: [] })),
      ]);

      let total = 0, present = 0, absent = 0, leave = 0, sick = 0, docsPend = 0, fptFail = 0;
      const recent: any[] = [];

      traineesSnap.forEach(d => {
        total++;
        const data = d.data();
        const attn = data.attn || 'P';
        if (attn === 'P') present++;
        else if (attn === 'A') absent++;
        else if (attn === 'L') leave++;
        else if (attn === 'S' || attn === 'H') sick++;
        if (!data.docsComplete) docsPend++;
        if (data.fptResult === 'Fail') fptFail++;

        recent.push({ id: d.id, ...data });
      });

      recent.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setRecentTrainees(recent.slice(0, 10));

      let totalBatches = 0, activeBatches = 0;
      batchesSnap.forEach(d => {
        totalBatches++;
        const data = d.data();
        if (data.status === 'active') activeBatches++;
      });

      setStats({
        totalTrainees: total,
        presentToday: present,
        absentToday: absent,
        onLeave: leave,
        sickHospital: sick,
        totalBatches,
        activeBatches,
        totalStaff: staffSnap.docs?.length || 0,
        docsPending: docsPend,
        fptFailed: fptFail,
      });
    } catch (err) {
      console.error('AdminDashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-military-700" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900 to-green-700 rounded-2xl px-6 py-5 shadow-lg text-white">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
              <Shield size={20} className="text-green-300" />
              HQ Training Command
            </h1>
            <p className="text-[10px] text-white/50 mt-1 ml-8">
              BSF Training Center Management System — All Companies Overview
            </p>
          </div>
          <button onClick={fetchData} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-[10px] font-bold uppercase rounded-xl border border-white/20 flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Trainees', value: stats.totalTrainees, icon: Users, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'Present Today', value: stats.presentToday, icon: CheckCircle2, color: 'bg-green-50 border-green-200', text: 'text-green-700' },
          { label: 'Absent', value: stats.absentToday, icon: AlertTriangle, color: 'bg-red-50 border-red-200', text: 'text-red-700' },
          { label: 'On Leave', value: stats.onLeave, icon: Activity, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
          { label: 'Sick/Hospital', value: stats.sickHospital, icon: Activity, color: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
        ].map(s => (
          <div key={s.label} className={`bg-white border ${s.color} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500">{s.label}</span>
              <s.icon size={16} className={s.text} />
            </div>
            <p className={`text-2xl font-black mt-1 ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Batches', value: `${stats.activeBatches}/${stats.totalBatches}`, icon: Layers, color: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
          { label: 'Total Staff', value: stats.totalStaff, icon: Shield, color: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700' },
          { label: 'Docs Pending', value: stats.docsPending, icon: FileText, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
          { label: 'FPT Failed', value: stats.fptFailed, icon: AlertTriangle, color: 'bg-red-50 border-red-200', text: 'text-red-700' },
        ].map(s => (
          <div key={s.label} className={`bg-white border ${s.color} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500">{s.label}</span>
              <s.icon size={16} className={s.text} />
            </div>
            <p className={`text-2xl font-black mt-1 ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Trainees */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-blue-600" />
            <span className="text-[11px] font-black text-slate-700 uppercase">Recent Trainees ({recentTrainees.length})</span>
          </div>
          <button onClick={() => go('/profile')} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
            View All <ArrowRight size={10} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['#', 'Chest', 'Name', 'Batch', 'Platoon', 'Status', 'FPT', 'Docs'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[9px] font-black uppercase text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentTrainees.map((t, idx) => {
                const attn = t.attn || 'P';
                const attnCls = attn === 'P' ? 'bg-green-100 text-green-700'
                  : attn === 'A' ? 'bg-red-100 text-red-700'
                  : attn === 'L' ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-100 text-orange-700';
                return (
                  <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => go('/profile')}>
                    <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2 font-mono font-black">{t.chestNo || '—'}</td>
                    <td className="px-4 py-2 font-bold">{t.name}</td>
                    <td className="px-4 py-2 text-slate-500">{t.batchNumber || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{t.platoon || '—'}</td>
                    <td className="px-4 py-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${attnCls}`}>{attn}</span></td>
                    <td className="px-4 py-2">{t.fptResult === 'Pass' ? '✅' : t.fptResult === 'Fail' ? '❌' : '—'}</td>
                    <td className="px-4 py-2">{t.docsComplete ? <CheckCircle2 size={13} className="text-green-500" /> : <AlertTriangle size={13} className="text-amber-400" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className="text-[11px] font-black text-slate-700 uppercase mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { label: 'Profile', path: '/profile', icon: '👥', color: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'Batches', path: '/batch-management', icon: '📊', color: 'bg-purple-600 hover:bg-purple-700' },
            { label: 'Staff', path: '/staff', icon: '👤', color: 'bg-cyan-600 hover:bg-cyan-700' },
            { label: 'Reports', path: '/reports', icon: '📋', color: 'bg-indigo-600 hover:bg-indigo-700' },
            { label: 'Settings', path: '/settings', icon: '⚙️', color: 'bg-slate-600 hover:bg-slate-700' },
            { label: 'Users', path: '/user-management', icon: '🔐', color: 'bg-amber-600 hover:bg-amber-700' },
          ].map(btn => (
            <button key={btn.path} onClick={() => go(btn.path)}
              className={`${btn.color} text-white rounded-xl px-3 py-3 text-[10px] font-bold uppercase flex flex-col items-center gap-1.5 transition-colors`}>
              <span className="text-lg">{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
