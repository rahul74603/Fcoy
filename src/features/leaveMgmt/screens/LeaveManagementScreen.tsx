// ═══════════════════════════════════════════════════════════
// LEAVE MANAGEMENT SCREEN (Chhutti Prabandhan)
// BSF STC Tekanpur — Apply, Sanction, Track, Overstay
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plane, Plus, Search, Loader2, X, Save, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  addLeaveApplication, getLeaveApplicationsByBatch,
  updateLeaveApplication, deleteLeaveApplication,
} from '../api/leave.api';
import {
  type LeaveApplication, type LeaveType, type LeaveStatus,
  LEAVE_TYPE_CONFIG,
} from '../types/leave.types';

export const LeaveManagementScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [records, setRecords] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | 'All'>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    traineeId: '', leaveType: 'Casual' as LeaveType,
    fromDate: '', toDate: '', reason: '',
    appliedTo: '', sanctionedBy: '', remarks: '',
  });

  const [trainees, setTrainees] = useState<any[]>([]);

  useEffect(() => {
    if (!activeBatch) return;
    setLoading(true);
    getLeaveApplicationsByBatch(activeBatch.id).then(setRecords).finally(() => setLoading(false));

    import('firebase/firestore').then(({ getDocs, collection: col, query: q, where: w }) => {
      import('../../../config/firebase').then(({ db }) => {
        getDocs(q(col(db, 'trainees'), w('batchId', '==', activeBatch.id))).then(snap => {
          const list: any[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => (a.chestNo || '').localeCompare(b.chestNo || ''));
          setTrainees(list);
        });
      });
    });
  }, [activeBatch]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterStatus !== 'All' && r.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return r.traineeName.toLowerCase().includes(s) || r.chestNo.toLowerCase().includes(s);
      }
      return true;
    });
  }, [records, filterStatus, search]);

  const stats = useMemo(() => ({
    total: records.length,
    onLeave: records.filter(r => r.status === 'On Leave').length,
    overstay: records.filter(r => r.status === 'Overstay' || r.overstayDays > 0).length,
    returned: records.filter(r => r.status === 'Returned').length,
    pending: records.filter(r => r.status === 'Applied').length,
  }), [records]);

  const calcDays = (from: string, to: string): number => {
    if (!from || !to) return 0;
    const diff = new Date(to).getTime() - new Date(from).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const handleCreate = async () => {
    if (!form.traineeId || !form.fromDate || !form.toDate || !form.reason) {
      alert('Fill all required fields'); return;
    }
    if (!activeBatch || !user) return;

    const t = trainees.find(x => x.id === form.traineeId);
    const totalDays = calcDays(form.fromDate, form.toDate);

    await addLeaveApplication({
      ...form,
      traineeName: t?.name || '', chestNo: t?.chestNo || '', regNo: t?.regNo || '',
      platoon: t?.platoon || '', batchId: activeBatch.id,
      totalDays, status: 'Applied',
      sanctionDate: '', departureDate: '', returnDate: form.toDate,
      actualReturnDate: '', overstayDays: 0,
      createdBy: user.name || 'System',
    });
    setMessage('✅ Leave application submitted!');
    setShowCreateModal(false);
    setRecords(await getLeaveApplicationsByBatch(activeBatch.id));
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSanction = async (id: string) => {
    await updateLeaveApplication(id, {
      status: 'Sanctioned', sanctionedBy: user?.name || 'Authority',
      sanctionDate: new Date().toISOString().split('T')[0],
    });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'Sanctioned' as LeaveStatus } : r));
  };

  // T-140: Recommend step (Applied → Recommended)
  const handleRecommend = async (id: string) => {
    await updateLeaveApplication(id, {
      status: 'Recommended', sanctionedBy: user?.name || 'Platoon Commander',
      sanctionDate: new Date().toISOString().split('T')[0],
    });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'Recommended' as LeaveStatus } : r));
  };

  // T-141: Mark Departed
  const handleDepart = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    await updateLeaveApplication(id, {
      status: 'Departed', departureDate: today,
    });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'Departed' as LeaveStatus, departureDate: today } : r));
  };

  const handleReturn = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const rec = records.find(r => r.id === id);
    const overstay = rec ? Math.max(0, Math.ceil((new Date(today).getTime() - new Date(rec.toDate).getTime()) / (1000*60*60*24))) : 0;
    await updateLeaveApplication(id, {
      status: overstay > 0 ? 'Overstay' : 'Returned',
      actualReturnDate: today, overstayDays: overstay,
    });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: (overstay > 0 ? 'Overstay' : 'Returned') as LeaveStatus, actualReturnDate: today, overstayDays: overstay } : r));
  };

  const handleReject = async (id: string) => {
    await updateLeaveApplication(id, { status: 'Rejected' });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'Rejected' as LeaveStatus } : r));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete?')) return;
    await deleteLeaveApplication(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  if (!activeBatch) return (
    <div className="p-8 text-center"><Plane size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-amber-900 to-amber-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">✈️ Chhutti Prabandhan</h1>
          <p className="text-[10px] text-amber-200">Leave Management — BSF STC Pattern</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="bg-white text-amber-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-amber-50">
          <Plus size={14} /> Apply Leave
        </button>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: '📋', color: 'bg-slate-50 border-slate-300 text-slate-800' },
          { label: 'Pending', value: stats.pending, icon: '⏳', color: 'bg-blue-50 border-blue-300 text-blue-800' },
          { label: 'On Leave', value: stats.onLeave, icon: '✈️', color: 'bg-amber-50 border-amber-300 text-amber-800' },
          { label: 'Overstay', value: stats.overstay, icon: '🚨', color: 'bg-red-50 border-red-300 text-red-800' },
          { label: 'Returned', value: stats.returned, icon: '✅', color: 'bg-green-50 border-green-300 text-green-800' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border-2 p-3 text-center ${card.color}`}>
            <p className="text-xl mb-1">{card.icon}</p>
            <p className="text-2xl font-black">{card.value}</p>
            <p className="text-[8px] font-bold uppercase opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold">
          <option value="All">All Status</option>
          {['Applied', 'Recommended', 'Sanctioned', 'Departed', 'Rejected', 'On Leave', 'Returned', 'Overstay'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-amber-600 mx-auto" /></div>
      : filtered.length === 0 ? <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl"><Plane size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Koi leave application nahi</p></div>
      : <div className="space-y-2">
          {filtered.map(r => {
            const config = LEAVE_TYPE_CONFIG[r.leaveType];
            const isOpen = expandedId === r.id;
            return (
              <div key={r.id} className={`rounded-xl border overflow-hidden ${r.status === 'Overstay' ? 'border-red-300 bg-red-50' : r.status === 'On Leave' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <button onClick={() => setExpandedId(isOpen ? null : r.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span className="text-xl">{config.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-800">{r.traineeName} <span className="text-slate-400">({r.chestNo})</span></p>
                      <p className="text-[9px] text-slate-500">{r.leaveType} · {r.fromDate} to {r.toDate} · {r.totalDays} days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.overstayDays > 0 && <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-red-600 text-white">+{r.overstayDays}d OVERSTAY</span>}
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${r.status === 'Returned' ? 'bg-green-600 text-white' : r.status === 'Overstay' ? 'bg-red-600 text-white' : r.status === 'Rejected' ? 'bg-slate-600 text-white' : r.status === 'Sanctioned' ? 'bg-blue-600 text-white' : r.status === 'Recommended' ? 'bg-indigo-600 text-white' : r.status === 'Departed' ? 'bg-purple-600 text-white' : 'bg-amber-600 text-white'}`}>{r.status}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-white/70 bg-white px-4 py-3 space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[['Type', r.leaveType], ['From', r.fromDate], ['To', r.toDate], ['Days', `${r.totalDays}`], ['Reason', r.reason], ['Applied To', r.appliedTo || '—'], ['Sanctioned By', r.sanctionedBy || '—'], ['Departure', r.departureDate || '—']].map(([l, v]) => (
                        <div key={l} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"><p className="text-[8px] font-black text-slate-400 uppercase">{l}</p><p className="text-[10px] font-bold text-slate-800 mt-0.5">{String(v)}</p></div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2 border-t flex-wrap">
                      {r.status === 'Applied' && <>
                        <button onClick={() => handleRecommend(r.id)} className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg">👍 Recommend</button>
                        <button onClick={() => handleSanction(r.id)} className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded-lg">✓ Sanction</button>
                        <button onClick={() => handleReject(r.id)} className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg">✗ Reject</button>
                      </>}
                      {r.status === 'Recommended' && <>
                        <button onClick={() => handleSanction(r.id)} className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded-lg">✓ Sanction</button>
                        <button onClick={() => handleReject(r.id)} className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg">✗ Reject</button>
                      </>}
                      {r.status === 'Sanctioned' && (
                        <button onClick={() => handleDepart(r.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg">🚶 Mark Departed</button>
                      )}
                      {(r.status === 'Departed' || r.status === 'On Leave') && (
                        <button onClick={() => handleReturn(r.id)} className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg">↩ Mark Returned</button>
                      )}
                      <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg ml-auto"><Trash2 size={10} className="inline mr-1" />Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-amber-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">✈️ Chhutti Application</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:text-amber-300"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Rangroot *</label>
                <select value={form.traineeId} onChange={e => setForm(p => ({ ...p, traineeId: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">-- Select --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.chestNo} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Leave Type *</label>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(LEAVE_TYPE_CONFIG).map(([key, val]) => (
                    <button key={key} onClick={() => setForm(p => ({ ...p, leaveType: key as LeaveType }))}
                      className={`p-2 rounded-lg border-2 text-center text-[10px] font-bold ${form.leaveType === key ? 'bg-amber-100 border-amber-500 text-amber-800' : 'bg-white border-slate-200 text-slate-500'}`}>
                      {val.icon} {key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">From Date *</label><input type="date" value={form.fromDate} onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">To Date *</label><input type="date" value={form.toDate} onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              {form.fromDate && form.toDate && <p className="text-[10px] font-bold text-amber-700">Total: {calcDays(form.fromDate, form.toDate)} days</p>}
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Reason *</label><textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Applied To</label><input type="text" value={form.appliedTo} onChange={e => setForm(p => ({ ...p, appliedTo: e.target.value }))} placeholder="Officer name" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Sanctioned By</label><input type="text" value={form.sanctionedBy} onChange={e => setForm(p => ({ ...p, sanctionedBy: e.target.value }))} placeholder="Authority" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleCreate} className="px-6 py-2 bg-amber-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-amber-800"><Save size={14} /> Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
