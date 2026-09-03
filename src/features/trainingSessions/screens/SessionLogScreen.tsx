// ═══════════════════════════════════════════════════════════
// TRAINING SESSION LOG SCREEN — T-152
// Log each training session, link to syllabus, mark attendance
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Plus, Search, Loader2, X, Save, Trash2,
  ChevronDown, ChevronUp, Calendar, Clock,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import { addSession, getSessionsByBatch, updateSession, deleteSession } from '../api/session.api';
import { type TrainingSession, type SessionType, SESSION_TYPE_CONFIG } from '../types/session.types';

export const SessionLogScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<SessionType | 'All'>('All');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    subject: '', topic: '', sessionDate: new Date().toISOString().split('T')[0],
    period: 'Period 1', instructorName: '', sessionType: 'Theory' as SessionType,
    duration: 45, attendanceTaken: false, attendanceCount: 0, remarks: '',
  });

  useEffect(() => {
    if (!activeBatch) return;
    setLoading(true);
    getSessionsByBatch(activeBatch.id).then(setSessions).finally(() => setLoading(false));
  }, [activeBatch]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (filterType !== 'All' && s.sessionType !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.subject.toLowerCase().includes(q) || s.topic.toLowerCase().includes(q) || (s.instructorName || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [sessions, filterType, search]);

  const stats = useMemo(() => ({
    total: sessions.length,
    thisWeek: sessions.filter(s => {
      const d = new Date(s.sessionDate);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }).length,
    byType: Object.keys(SESSION_TYPE_CONFIG).map(t => ({
      type: t as SessionType,
      count: sessions.filter(s => s.sessionType === t).length,
    })),
  }), [sessions]);

  const handleCreate = async () => {
    if (!form.subject || !form.topic || !activeBatch) return;
    await addSession({
      ...form,
      batchId: activeBatch.id,
      totalTrainees: 0,
      createdBy: user?.name || 'System',
    });
    setMessage('✅ Session logged!');
    setShowCreate(false);
    setSessions(await getSessionsByBatch(activeBatch.id));
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete session?')) return;
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  if (!activeBatch) return (
    <div className="p-8 text-center"><BookOpen size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">📚 Training Session Log</h1>
          <p className="text-[10px] text-indigo-200">Pathyakram Session Anurekhan — Track every class</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-white text-indigo-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-indigo-50">
          <Plus size={14} /> Log Session
        </button>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-slate-800">{stats.total}</p>
          <p className="text-[8px] font-bold uppercase text-slate-500">Total Sessions</p>
        </div>
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-blue-700">{stats.thisWeek}</p>
          <p className="text-[8px] font-bold uppercase text-blue-500">This Week</p>
        </div>
        {stats.byType.filter(t => t.count > 0).slice(0, 2).map(t => {
          const cfg = SESSION_TYPE_CONFIG[t.type];
          return (
            <div key={t.type} className={`rounded-xl border-2 p-3 text-center ${cfg.color}`}>
              <p className="text-2xl font-black">{t.count}</p>
              <p className="text-[8px] font-bold uppercase">{cfg.icon} {t.type}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject, topic..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold">
          <option value="All">All Types</option>
          {Object.keys(SESSION_TYPE_CONFIG).map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-indigo-600 mx-auto" /></div>
      : filtered.length === 0 ? <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl"><BookOpen size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Koi session log nahi</p></div>
      : <div className="space-y-2">
          {filtered.map(s => {
            const cfg = SESSION_TYPE_CONFIG[s.sessionType] || SESSION_TYPE_CONFIG.Theory;
            const isOpen = expandedId === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button onClick={() => setExpandedId(isOpen ? null : s.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span className="text-xl">{cfg.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-800">{s.subject} — {s.topic}</p>
                      <p className="text-[9px] text-slate-500">{s.sessionDate} · {s.period} · {s.duration}min · {s.instructorName || 'No instructor'}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${cfg.color}`}>{s.sessionType}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[['Subject', s.subject], ['Topic', s.topic], ['Date', s.sessionDate], ['Period', s.period], ['Duration', `${s.duration} min`], ['Instructor', s.instructorName || '—'], ['Attendance', s.attendanceTaken ? `${s.attendanceCount || 0}/${s.totalTrainees || '—'}` : 'Not Taken'], ['Remarks', s.remarks || '—']].map(([l, v]) => (
                        <div key={l} className="rounded-lg border border-slate-100 bg-white px-2 py-1.5"><p className="text-[8px] font-black text-slate-400 uppercase">{l}</p><p className="text-[10px] font-bold text-slate-800 mt-0.5">{String(v)}</p></div>
                      ))}
                    </div>
                    <button onClick={() => handleDelete(s.id)} className="px-3 py-1.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg"><Trash2 size={10} className="inline mr-1" />Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>}

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-indigo-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">📚 Log Training Session</h3>
              <button onClick={() => setShowCreate(false)} className="text-white hover:text-indigo-300"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Session Type *</label>
                <div className="grid grid-cols-4 gap-1">
                  {Object.entries(SESSION_TYPE_CONFIG).map(([key, val]) => (
                    <button key={key} onClick={() => setForm(p => ({ ...p, sessionType: key as SessionType }))}
                      className={`p-2 rounded-lg border-2 text-center text-[9px] font-bold ${form.sessionType === key ? `${val.color} border-current` : 'bg-white border-slate-200 text-slate-500'}`}>
                      {val.icon} {key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Subject *</label><input type="text" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Topic *</label><input type="text" value={form.topic} onChange={e => setForm(p => ({ ...p, topic: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Date *</label><input type="date" value={form.sessionDate} onChange={e => setForm(p => ({ ...p, sessionDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Period</label><select value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">{['Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Period 7','Period 8'].map(p => <option key={p}>{p}</option>)}</select></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Duration (min)</label><input type="number" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Instructor</label><input type="text" value={form.instructorName} onChange={e => setForm(p => ({ ...p, instructorName: e.target.value }))} placeholder="Instructor name" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Remarks</label><textarea value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" /></div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleCreate} className="px-6 py-2 bg-indigo-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-indigo-800"><Save size={14} /> Log Session</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
