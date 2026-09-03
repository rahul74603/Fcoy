// ═══════════════════════════════════════════════════════════
// MOVEMENT REGISTER SCREEN (Sthanantar Register)
// BSF STC Tekanpur — Transfer, Posting, Detachment tracking
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRightLeft, Plus, Search, Loader2, X, Save, Trash2,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  addMovementRecord, getMovementRecordsByBatch,
  updateMovementRecord, deleteMovementRecord,
} from '../api/movement.api';
import {
  type MovementRecord, type MovementType, type MovementStatus,
  MOVEMENT_TYPE_CONFIG,
} from '../types/movement.types';

export const MovementRegisterScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [records, setRecords] = useState<MovementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<MovementType | 'All'>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    traineeId: '', type: 'Transfer' as MovementType,
    fromUnit: '', toUnit: '', fromPlace: '', toPlace: '',
    movementOrderNo: '', orderDate: new Date().toISOString().split('T')[0],
    movementDate: new Date().toISOString().split('T')[0],
    reportingDate: '', authority: '', purpose: '', remarks: '',
  });

  const [trainees, setTrainees] = useState<any[]>([]);

  useEffect(() => {
    if (!activeBatch) return;
    setLoading(true);
    getMovementRecordsByBatch(activeBatch.id).then(setRecords).finally(() => setLoading(false));

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
      if (filterType !== 'All' && r.type !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        return r.traineeName.toLowerCase().includes(s) || r.chestNo.toLowerCase().includes(s) || r.regNo.toLowerCase().includes(s);
      }
      return true;
    });
  }, [records, filterType, search]);

  const stats = useMemo(() => ({
    total: records.length,
    ordered: records.filter(r => r.status === 'Ordered').length,
    completed: records.filter(r => r.status === 'Completed').length,
    overdue: records.filter(r => r.status === 'Overdue').length,
  }), [records]);

  const handleCreate = async () => {
    if (!form.traineeId || !form.toUnit) { alert('Fill trainee and destination'); return; }
    if (!activeBatch || !user) return;

    const t = trainees.find(x => x.id === form.traineeId);
    await addMovementRecord({
      ...form,
      traineeName: t?.name || '', chestNo: t?.chestNo || '', regNo: t?.regNo || '',
      platoon: t?.platoon || '', batchId: activeBatch.id,
      status: 'Ordered', createdBy: user.name || 'System',
    });
    setMessage('✅ Movement record added!');
    setShowCreateModal(false);
    setRecords(await getMovementRecordsByBatch(activeBatch.id));
    setTimeout(() => setMessage(''), 3000);
  };

  const handleStatusUpdate = async (id: string, status: MovementStatus) => {
    await updateMovementRecord(id, { status, ...(status === 'Completed' ? { actualReportingDate: new Date().toISOString().split('T')[0] } : {}) });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete?')) return;
    await deleteMovementRecord(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  if (!activeBatch) return (
    <div className="p-8 text-center"><ArrowRightLeft size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">🚶 Sthanantar Register</h1>
          <p className="text-[10px] text-blue-200">Movement & Transfer Record — BSF STC Pattern</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="bg-white text-blue-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-50">
          <Plus size={14} /> Naya Record
        </button>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: '📋', color: 'bg-slate-50 border-slate-300 text-slate-800' },
          { label: 'Ordered', value: stats.ordered, icon: '📝', color: 'bg-blue-50 border-blue-300 text-blue-800' },
          { label: 'Completed', value: stats.completed, icon: '✅', color: 'bg-green-50 border-green-300 text-green-800' },
          { label: 'Overdue', value: stats.overdue, icon: '⚠️', color: 'bg-red-50 border-red-300 text-red-800' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border-2 p-3 text-center ${card.color}`}>
            <p className="text-xl mb-1">{card.icon}</p>
            <p className="text-2xl font-black">{card.value}</p>
            <p className="text-[8px] font-bold uppercase opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold">
          <option value="All">All Types</option>
          {Object.entries(MOVEMENT_TYPE_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.icon} {val.label}</option>)}
        </select>
      </div>

      {/* Records */}
      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></div>
      : filtered.length === 0 ? <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl"><ArrowRightLeft size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Koi movement record nahi</p></div>
      : <div className="space-y-2">
          {filtered.map(r => {
            const config = MOVEMENT_TYPE_CONFIG[r.type];
            const isOpen = expandedId === r.id;
            return (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button onClick={() => setExpandedId(isOpen ? null : r.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span className="text-xl">{config.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-800">{r.traineeName} <span className="text-slate-400">({r.chestNo})</span></p>
                      <p className="text-[9px] text-slate-500">{r.fromPlace || r.fromUnit} → {r.toPlace || r.toUnit} · {r.movementDate}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${r.status === 'Completed' ? 'bg-green-600 text-white' : r.status === 'Overdue' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>{r.status}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[['Type', r.type], ['Order No', r.movementOrderNo || '—'], ['Order Date', r.orderDate], ['Movement Date', r.movementDate], ['Reporting Date', r.reportingDate || '—'], ['From', `${r.fromUnit} (${r.fromPlace})`], ['To', `${r.toUnit} (${r.toPlace})`], ['Authority', r.authority || '—']].map(([l, v]) => (
                        <div key={l} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"><p className="text-[8px] font-black text-slate-400 uppercase">{l}</p><p className="text-[10px] font-bold text-slate-800 mt-0.5">{String(v)}</p></div>
                      ))}
                    </div>
                    {r.purpose && <div className="bg-slate-50 rounded-lg p-2"><p className="text-[9px] font-black text-slate-500 uppercase">Purpose</p><p className="text-[10px] text-slate-700">{r.purpose}</p></div>}
                    <div className="flex gap-2 pt-2 border-t">
                      {r.status === 'Ordered' && <button onClick={() => handleStatusUpdate(r.id, 'Completed')} className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded-lg">✓ Completed</button>}
                      {r.status === 'Ordered' && <button onClick={() => handleStatusUpdate(r.id, 'Overdue')} className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg">⚠ Overdue</button>}
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
            <div className="bg-blue-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">🚶 Naya Movement Record</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:text-blue-300"><X size={18} /></button>
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
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Type *</label>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(MOVEMENT_TYPE_CONFIG).map(([key, val]) => (
                    <button key={key} onClick={() => setForm(p => ({ ...p, type: key as MovementType }))}
                      className={`p-2 rounded-lg border-2 text-center text-[10px] font-bold ${form.type === key ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-500'}`}>
                      {val.icon} {key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">From Unit</label><input type="text" value={form.fromUnit} onChange={e => setForm(p => ({ ...p, fromUnit: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">To Unit *</label><input type="text" value={form.toUnit} onChange={e => setForm(p => ({ ...p, toUnit: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">From Place</label><input type="text" value={form.fromPlace} onChange={e => setForm(p => ({ ...p, fromPlace: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">To Place</label><input type="text" value={form.toPlace} onChange={e => setForm(p => ({ ...p, toPlace: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Order No</label><input type="text" value={form.movementOrderNo} onChange={e => setForm(p => ({ ...p, movementOrderNo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Order Date</label><input type="date" value={form.orderDate} onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Movement Date</label><input type="date" value={form.movementDate} onChange={e => setForm(p => ({ ...p, movementDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Reporting Date</label><input type="date" value={form.reportingDate} onChange={e => setForm(p => ({ ...p, reportingDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Authority</label><input type="text" value={form.authority} onChange={e => setForm(p => ({ ...p, authority: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Purpose</label><textarea value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" /></div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleCreate} className="px-6 py-2 bg-blue-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-blue-800"><Save size={14} /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
