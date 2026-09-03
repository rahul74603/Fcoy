// ═══════════════════════════════════════════════════════════
// DISCIPLINE REGISTER SCREEN (Anushasan Register)
// BSF STC Tekanpur — Punishments, Awards, Warnings
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Plus, Search, Loader2, X, Save, Trash2,
  Award, AlertTriangle, ChevronDown, ChevronUp,
  Download, Filter,
} from 'lucide-react';
import { exportDisciplineRegister } from '../../../services/export.service';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  addDisciplineRecord, getDisciplineRecordsByBatch,
  updateDisciplineRecord, deleteDisciplineRecord,
} from '../api/discipline.api';
import {
  type DisciplineRecord, type DisciplineType, type DisciplineCategory,
  type DisciplineFormData, type DisciplineStatus,
  DISCIPLINE_TYPE_CONFIG, DISCIPLINE_CATEGORIES, PUNISHMENT_TYPES,
} from '../types/discipline.types';

export const DisciplineRegisterScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DisciplineType | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<DisciplineStatus | 'All'>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Form state
  const [form, setForm] = useState<DisciplineFormData>({
    traineeId: '', type: 'Punishment', category: 'Parade Violation',
    description: '', date: new Date().toISOString().split('T')[0],
    effectiveDate: new Date().toISOString().split('T')[0], endDate: '',
    awardedBy: '', authority: '', punishmentDays: 0, punishmentType: '', remarks: '',
  });

  // Fetch records
  useEffect(() => {
    if (!activeBatch) return;
    setLoading(true);
    getDisciplineRecordsByBatch(activeBatch.id)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [activeBatch]);

  // Filtered records
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterType !== 'All' && r.type !== filterType) return false;
      if (filterStatus !== 'All' && r.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return r.traineeName.toLowerCase().includes(s) ||
               r.chestNo.toLowerCase().includes(s) ||
               r.regNo.toLowerCase().includes(s) ||
               r.description.toLowerCase().includes(s);
      }
      return true;
    });
  }, [records, filterType, filterStatus, search]);

  // Stats
  const stats = useMemo(() => ({
    total: records.length,
    punishments: records.filter(r => r.type === 'Punishment').length,
    awards: records.filter(r => r.type === 'Award' || r.type === 'Commendation').length,
    warnings: records.filter(r => r.type === 'Warning').length,
    active: records.filter(r => r.status === 'Active').length,
  }), [records]);

  // Handle create
  const handleCreate = async () => {
    if (!form.traineeId || !form.description || !form.awardedBy) {
      alert('Please fill trainee, description, and awarded by');
      return;
    }
    if (!activeBatch || !user) return;

    try {
      // Find trainee info from batch
      const { getDocs, collection: col, query: q, where: w } = await import('firebase/firestore');
      const { db } = await import('../../../config/firebase');
      const snap = await getDocs(q(col(db, 'trainees'), w('batchId', '==', activeBatch.id)));
      let traineeInfo = { name: '', chestNo: '', regNo: '', platoon: '' };
      snap.forEach(d => {
        if (d.id === form.traineeId) {
          const data = d.data() as any;
          traineeInfo = { name: data.name || '', chestNo: data.chestNo || '', regNo: data.regNo || '', platoon: data.platoon || '' };
        }
      });

      await addDisciplineRecord(form, traineeInfo, activeBatch.id, user.name || 'System');
      setMessage('✅ Record added successfully!');
      setShowCreateModal(false);
      setForm({ traineeId: '', type: 'Punishment', category: 'Parade Violation', description: '', date: new Date().toISOString().split('T')[0], effectiveDate: new Date().toISOString().split('T')[0], endDate: '', awardedBy: '', authority: '', punishmentDays: 0, punishmentType: '', remarks: '' });
      // Refresh
      const fresh = await getDisciplineRecordsByBatch(activeBatch.id);
      setRecords(fresh);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    }
    setTimeout(() => setMessage(''), 3000);
  };

  // Handle status update
  const handleStatusUpdate = async (id: string, status: DisciplineStatus) => {
    await updateDisciplineRecord(id, { status });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this record?')) return;
    await deleteDisciplineRecord(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  // Get trainees for dropdown
  const [trainees, setTrainees] = useState<any[]>([]);
  useEffect(() => {
    if (!activeBatch) return;
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

  if (!activeBatch) {
    return (
      <div className="p-8 text-center">
        <Shield size={48} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-bold text-slate-500">Pehle batch select karo</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900 to-red-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">⚖️ Anushasan Register</h1>
          <p className="text-[10px] text-red-200">Discipline & Conduct Record — BSF STC Pattern</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="bg-white text-red-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-red-50">
          <Plus size={14} /> Naya Record
        </button>
        <button onClick={() => exportDisciplineRegister(records)} className="bg-white text-red-600 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-red-50 border border-red-200">
          📥 Export CSV
        </button>
      </div>

      {/* Message */}
      {message && <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Records', value: stats.total, icon: '📋', color: 'bg-slate-50 border-slate-300 text-slate-800' },
          { label: 'Sazaa (Punishment)', value: stats.punishments, icon: '🔴', color: 'bg-red-50 border-red-300 text-red-800' },
          { label: 'Inaam (Award)', value: stats.awards, icon: '🏆', color: 'bg-yellow-50 border-yellow-300 text-yellow-800' },
          { label: 'Chetavani (Warning)', value: stats.warnings, icon: '⚠️', color: 'bg-orange-50 border-orange-300 text-orange-800' },
          { label: 'Active', value: stats.active, icon: '●', color: 'bg-purple-50 border-purple-300 text-purple-800' },
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
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, chest, regt no..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold">
          <option value="All">All Types</option>
          {Object.entries(DISCIPLINE_TYPE_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.icon} {val.label}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold">
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Expired">Expired</option>
          <option value="Revoked">Revoked</option>
        </select>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-red-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl">
          <Shield size={40} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-400">Koi discipline record nahi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const config = DISCIPLINE_TYPE_CONFIG[r.type];
            const isOpen = expandedId === r.id;
            return (
              <div key={r.id} className={`rounded-xl border overflow-hidden ${config.borderColor} ${config.bgColor}`}>
                <button onClick={() => setExpandedId(isOpen ? null : r.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                    <span className="text-xl">{config.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-800">{r.traineeName} <span className="text-slate-400">({r.chestNo})</span></p>
                      <p className="text-[9px] text-slate-500">{r.category} · {r.date} · {r.awardedBy}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${config.bgColor} ${config.color} border ${config.borderColor}`}>{config.label}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${r.status === 'Active' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>{r.status}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-white/70 bg-white px-4 py-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[['Type', r.type], ['Category', r.category], ['Date', r.date], ['Effective', r.effectiveDate], ['End Date', r.endDate || '—'], ['Days', r.punishmentDays ? `${r.punishmentDays} days` : '—'], ['Punishment', r.punishmentType || '—'], ['Authority', r.authority || '—']].map(([l, v]) => (
                        <div key={l} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase">{l}</p>
                          <p className="text-[10px] font-bold text-slate-800 mt-0.5">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Description</p>
                      <p className="text-[11px] text-slate-700">{r.description}</p>
                    </div>
                    {r.remarks && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Remarks</p>
                        <p className="text-[11px] text-slate-700">{r.remarks}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t">
                      {r.status === 'Active' && (
                        <button onClick={() => handleStatusUpdate(r.id, 'Completed')}
                          className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded-lg hover:bg-green-700">✓ Mark Completed</button>
                      )}
                      {r.status !== 'Revoked' && (
                        <button onClick={() => handleStatusUpdate(r.id, 'Revoked')}
                          className="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-bold rounded-lg hover:bg-amber-700">↩ Revoke</button>
                      )}
                      <button onClick={() => handleDelete(r.id)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg hover:bg-red-200 ml-auto">
                        <Trash2 size={10} className="inline mr-1" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ CREATE MODAL ═══ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-red-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">⚖️ Naya Anushasan Record</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:text-red-300"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              {/* Trainee Select */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Rangroot *</label>
                <select value={form.traineeId} onChange={e => setForm(p => ({ ...p, traineeId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">-- Select Rangroot --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.chestNo} — {t.name} ({t.platoon})</option>)}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Type *</label>
                <div className="grid grid-cols-5 gap-1">
                  {Object.entries(DISCIPLINE_TYPE_CONFIG).map(([key, val]) => (
                    <button key={key} onClick={() => setForm(p => ({ ...p, type: key as DisciplineType }))}
                      className={`p-2 rounded-lg border-2 text-center text-[10px] font-bold transition-all ${
                        form.type === key ? `${val.bgColor} ${val.borderColor} ${val.color}` : 'bg-white border-slate-200 text-slate-500'
                      }`}>
                      {val.icon}<br />{key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Category *</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as DisciplineCategory }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {DISCIPLINE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Description *</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Kya hua? Detail me likho..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Effective Date</label>
                  <input type="date" value={form.effectiveDate} onChange={e => setForm(p => ({ ...p, effectiveDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>

              {/* Punishment specific */}
              {form.type === 'Punishment' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Punishment Type</label>
                    <select value={form.punishmentType} onChange={e => setForm(p => ({ ...p, punishmentType: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="">-- Select --</option>
                      {PUNISHMENT_TYPES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Days</label>
                    <input type="number" value={form.punishmentDays} onChange={e => setForm(p => ({ ...p, punishmentDays: Number(e.target.value) }))}
                      min={0} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>
              )}

              {/* Authority */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Awarded By *</label>
                  <input type="text" value={form.awardedBy} onChange={e => setForm(p => ({ ...p, awardedBy: e.target.value }))}
                    placeholder="Rank + Name" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Order/Authority</label>
                  <input type="text" value={form.authority} onChange={e => setForm(p => ({ ...p, authority: e.target.value }))}
                    placeholder="Order No / Reference" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Remarks</label>
                <input type="text" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                  placeholder="Additional remarks..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleCreate} className="px-6 py-2 bg-red-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-red-800">
                  <Save size={14} /> Save Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
