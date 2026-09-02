// ═══════════════════════════════════════════════════════════
// SYLLABUS TRACKING SCREEN (Pathyakram Anurekhan)
// Subject-wise progress tracking
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Plus, Loader2, X, Save, Trash2, Edit2,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  addSyllabusTopic, getSyllabusByBatch,
  updateSyllabusTopic, deleteSyllabusTopic,
} from '../api/syllabus.api';
import {
  type SyllabusTopic, type SyllabusStatus,
  SYLLABUS_SUBJECTS, SYLLABUS_STATUS_CONFIG,
} from '../types/syllabus.types';

export const SyllabusTrackingScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    subject: SYLLABUS_SUBJECTS[0], topic: '', totalHours: 10, completedHours: 0,
    instructorName: '', status: 'Not Started' as SyllabusStatus,
    startDate: '', endDate: '', remarks: '',
  });

  useEffect(() => {
    if (!activeBatch) return;
    setLoading(true);
    getSyllabusByBatch(activeBatch.id).then(setTopics).finally(() => setLoading(false));
  }, [activeBatch]);

  // Group by subject
  const grouped = useMemo(() => {
    const map: Record<string, SyllabusTopic[]> = {};
    topics.forEach(t => { (map[t.subject] = map[t.subject] || []).push(t); });
    return map;
  }, [topics]);

  // Overall progress per subject
  const subjectProgress = useMemo(() => {
    return Object.entries(grouped).map(([subject, tpcs]) => {
      const total = tpcs.reduce((s, t) => s + t.totalHours, 0);
      const completed = tpcs.reduce((s, t) => s + t.completedHours, 0);
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { subject, total, completed, pct, topics: tpcs.length, completedTopics: tpcs.filter(t => t.status === 'Completed').length };
    });
  }, [grouped]);

  const overallPct = useMemo(() => {
    const total = topics.reduce((s, t) => s + t.totalHours, 0);
    const completed = topics.reduce((s, t) => s + t.completedHours, 0);
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [topics]);

  const handleSave = async () => {
    if (!form.topic || !activeBatch) return;
    if (editingId) {
      await updateSyllabusTopic(editingId, form);
      setTopics(prev => prev.map(t => t.id === editingId ? { ...t, ...form } : t));
    } else {
      const id = await addSyllabusTopic({ ...form, batchId: activeBatch.id, instructorId: '', createdAt: '' });
      setTopics(prev => [...prev, { ...form, id, batchId: activeBatch.id, instructorId: '', createdAt: '' }]);
    }
    setShowModal(false);
    setEditingId(null);
    setForm({ subject: SYLLABUS_SUBJECTS[0], topic: '', totalHours: 10, completedHours: 0, instructorName: '', status: 'Not Started', startDate: '', endDate: '', remarks: '' });
    setMessage(editingId ? '✅ Topic updated!' : '✅ Topic added!');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete?')) return;
    await deleteSyllabusTopic(id);
    setTopics(prev => prev.filter(t => t.id !== id));
  };

  const handleEdit = (t: SyllabusTopic) => {
    setEditingId(t.id);
    setForm({ subject: t.subject, topic: t.topic, totalHours: t.totalHours, completedHours: t.completedHours, instructorName: t.instructorName, status: t.status, startDate: t.startDate, endDate: t.endDate, remarks: t.remarks });
    setShowModal(true);
  };

  if (!activeBatch) return (
    <div className="p-8 text-center"><BookOpen size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">📚 Pathyakram Anurekhan</h1>
          <p className="text-[10px] text-indigo-200">Syllabus Tracking — Subject-wise Progress</p>
        </div>
        <button onClick={() => { setShowModal(true); setEditingId(null); }} className="bg-white text-indigo-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-indigo-50">
          <Plus size={14} /> Add Topic
        </button>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      {/* Overall Progress */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-black text-slate-700 uppercase">Overall Syllabus Progress</p>
          <p className="text-lg font-black text-indigo-700">{overallPct}%</p>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all rounded-full" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="text-[10px] text-slate-500 mt-1">{topics.filter(t => t.status === 'Completed').length}/{topics.length} topics completed</p>
      </div>

      {/* Subject-wise Progress */}
      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-indigo-600 mx-auto" /></div>
      : subjectProgress.length === 0 ? <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl"><BookOpen size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Koi syllabus topic nahi</p></div>
      : <div className="space-y-4">
          {subjectProgress.map(sp => (
            <div key={sp.subject} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-800">{sp.subject}</p>
                  <p className="text-[10px] text-slate-500">{sp.completedTopics}/{sp.topics} topics · {sp.completed}/{sp.total} hours</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${sp.pct}%` }} />
                  </div>
                  <span className="text-xs font-black text-indigo-700">{sp.pct}%</span>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {(grouped[sp.subject] || []).map(t => {
                  const config = SYLLABUS_STATUS_CONFIG[t.status];
                  const topicPct = t.totalHours > 0 ? Math.round((t.completedHours / t.totalHours) * 100) : 0;
                  return (
                    <div key={t.id} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span>{config.icon}</span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{t.topic}</p>
                          <p className="text-[9px] text-slate-500">{t.instructorName || '—'} · {t.completedHours}/{t.totalHours} hrs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${config.bg} ${config.color}`}>{t.status}</span>
                        <span className="text-[10px] font-black text-slate-600">{topicPct}%</span>
                        <button onClick={() => handleEdit(t)} className="p-1 text-slate-400 hover:text-blue-600"><Edit2 size={12} /></button>
                        <button onClick={() => handleDelete(t.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="bg-indigo-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">{editingId ? 'Edit Topic' : '📚 Naya Topic'}</h3>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-white hover:text-indigo-300"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Subject *</label>
                <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {SYLLABUS_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Topic *</label>
                <input type="text" value={form.topic} onChange={e => setForm(p => ({ ...p, topic: e.target.value }))} placeholder="e.g., Introduction to Weapons" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Total Hours</label>
                  <input type="number" value={form.totalHours} onChange={e => setForm(p => ({ ...p, totalHours: Number(e.target.value) }))} min={1} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Completed Hours</label>
                  <input type="number" value={form.completedHours} onChange={e => setForm(p => ({ ...p, completedHours: Number(e.target.value) }))} min={0} max={form.totalHours} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Status</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['Not Started', 'In Progress', 'Completed'] as SyllabusStatus[]).map(s => (
                    <button key={s} onClick={() => setForm(p => ({ ...p, status: s }))}
                      className={`p-2 rounded-lg border-2 text-[10px] font-bold text-center ${form.status === s ? 'bg-indigo-100 border-indigo-500 text-indigo-800' : 'bg-white border-slate-200 text-slate-500'}`}>
                      {SYLLABUS_STATUS_CONFIG[s].icon} {s}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Instructor</label>
                <input type="text" value={form.instructorName} onChange={e => setForm(p => ({ ...p, instructorName: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => { setShowModal(false); setEditingId(null); }} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 bg-indigo-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-indigo-800"><Save size={14} /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
