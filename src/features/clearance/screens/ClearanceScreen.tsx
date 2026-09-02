// ═══════════════════════════════════════════════════════════
// CLEARANCE SCREEN (Klirans Prabandhan)
// Passing out clearance checklist per trainee
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Loader2, RefreshCw, Search, CheckCircle2, XCircle, Users,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getClearanceByBatch, bulkCreateClearance, updateClearanceItem,
} from '../api/clearance.api';
import {
  type ClearanceRecord, type ClearanceItemStatus, type ClearanceDept,
  CLEARANCE_DEPARTMENTS, DEPT_ICONS,
} from '../types/clearance.types';

export const ClearanceScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [records, setRecords] = useState<ClearanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!activeBatch) return;
    setLoading(true);
    getClearanceByBatch(activeBatch.id).then(setRecords).finally(() => setLoading(false));
  }, [activeBatch]);

  const handleBulkCreate = async () => {
    if (!activeBatch) return;
    setLoading(true);
    try {
      const { getDocs, collection: col, query: q, where: w } = await import('firebase/firestore');
      const { db } = await import('../../../config/firebase');
      const snap = await getDocs(q(col(db, 'trainees'), w('batchId', '==', activeBatch.id)));
      const trainees: any[] = [];
      snap.forEach(d => { const data = d.data(); trainees.push({ id: d.id, name: data.name, chestNo: data.chestNo, regNo: data.regNo }); });
      const count = await bulkCreateClearance(activeBatch.id, trainees);
      setRecords(await getClearanceByBatch(activeBatch.id));
      setMessage(`✅ Clearance created for ${count} trainees!`);
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    }
    setLoading(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const toggleDeptStatus = (recordId: string, dept: ClearanceDept) => {
    setRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r;
      const items = r.items.map(item => {
        if (item.department !== dept) return item;
        const nextStatus: ClearanceItemStatus = item.status === 'Pending' ? 'Cleared' : item.status === 'Cleared' ? 'Pending' : 'Cleared';
        return { ...item, status: nextStatus, clearedBy: nextStatus === 'Cleared' ? (user?.name || '') : '', date: nextStatus === 'Cleared' ? new Date().toISOString().split('T')[0] : '' };
      });
      const clearedCount = items.filter(i => i.status === 'Cleared').length;
      const overallStatus = clearedCount === items.length ? 'Cleared' as const : clearedCount > 0 ? 'In Progress' as const : 'Pending' as const;
      return { ...r, items, overallStatus };
    }));
  };

  const saveRecord = async (record: ClearanceRecord) => {
    await updateClearanceItem(record.id, record.items, record.overallStatus);
    setMessage(`✅ ${record.traineeName} clearance saved!`);
    setTimeout(() => setMessage(''), 2000);
  };

  const filtered = useMemo(() => {
    if (!search) return records;
    const s = search.toLowerCase();
    return records.filter(r => r.traineeName.toLowerCase().includes(s) || r.chestNo.toLowerCase().includes(s));
  }, [records, search]);

  const stats = useMemo(() => ({
    total: records.length,
    cleared: records.filter(r => r.overallStatus === 'Cleared').length,
    inProgress: records.filter(r => r.overallStatus === 'In Progress').length,
    pending: records.filter(r => r.overallStatus === 'Pending').length,
  }), [records]);

  if (!activeBatch) return (
    <div className="p-8 text-center"><ClipboardCheck size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-teal-900 to-teal-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">📋 Klirans Prabandhan</h1>
          <p className="text-[10px] text-teal-200">Clearance System — Passing Out Checklist</p>
        </div>
        <button onClick={handleBulkCreate} disabled={loading}
          className="bg-white text-teal-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-teal-50 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} Generate for All
        </button>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: '📋', color: 'bg-slate-50 border-slate-300 text-slate-800' },
          { label: 'Cleared', value: stats.cleared, icon: '✅', color: 'bg-green-50 border-green-300 text-green-800' },
          { label: 'In Progress', value: stats.inProgress, icon: '🔄', color: 'bg-blue-50 border-blue-300 text-blue-800' },
          { label: 'Pending', value: stats.pending, icon: '⏳', color: 'bg-amber-50 border-amber-300 text-amber-800' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border-2 p-3 text-center ${card.color}`}>
            <p className="text-xl mb-1">{card.icon}</p>
            <p className="text-2xl font-black">{card.value}</p>
            <p className="text-[8px] font-bold uppercase opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>

      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-teal-600 mx-auto" /></div>
      : records.length === 0 ? <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl"><ClipboardCheck size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Click "Generate for All" to create clearance checklists</p></div>
      : <div className="space-y-2">
          {filtered.map(r => {
            const clearedCount = r.items.filter(i => i.status === 'Cleared').length;
            const pct = Math.round((clearedCount / r.items.length) * 100);
            const isOpen = expandedId === r.id;
            return (
              <div key={r.id} className={`rounded-xl border overflow-hidden ${r.overallStatus === 'Cleared' ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'}`}>
                <button onClick={() => setExpandedId(isOpen ? null : r.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black">{pct}%</div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-800">{r.traineeName} <span className="text-slate-400">({r.chestNo})</span></p>
                      <p className="text-[9px] text-slate-500">{clearedCount}/{r.items.length} departments cleared</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${r.overallStatus === 'Cleared' ? 'bg-green-600 text-white' : r.overallStatus === 'In Progress' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}`}>{r.overallStatus}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-white/70 bg-white px-4 py-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {r.items.map(item => (
                        <button key={item.department} onClick={() => toggleDeptStatus(r.id, item.department)}
                          className={`p-3 rounded-xl border-2 text-center transition-all active:scale-95 ${
                            item.status === 'Cleared' ? 'bg-green-100 border-green-400 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400'
                          }`}>
                          <p className="text-xl mb-1">{DEPT_ICONS[item.department]}</p>
                          <p className="text-[9px] font-black">{item.department}</p>
                          <p className="text-[8px] mt-1">{item.status === 'Cleared' ? '✅ Cleared' : '⬜ Pending'}</p>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end mt-3 pt-3 border-t">
                      <button onClick={() => saveRecord(r)} className="px-4 py-2 bg-teal-700 text-white text-xs font-black rounded-lg hover:bg-teal-800">Save Clearance</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>}
    </div>
  );
};
