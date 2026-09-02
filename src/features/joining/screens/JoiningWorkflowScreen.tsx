// ═══════════════════════════════════════════════════════════
// JOINING WORKFLOW SCREEN (Bharti Prakriya)
// Pipeline: Selected → Called → Reported → Verified → Medically Fit → Joined → Allocated
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus, Plus, Search, Loader2, X, Save, ChevronRight,
  ArrowRight, CheckCircle2,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  addJoiningRecord, getJoiningRecordsByBatch,
  updateJoiningStage, updateJoiningRecord, deleteJoiningRecord,
} from '../api/joining.api';
import {
  type JoiningRecord, type JoiningStage, type JoiningStatus,
  JOINING_STAGES,
} from '../types/joining.types';

export const JoiningWorkflowScreen: React.FC = () => {
  const { activeBatch } = useBatch();
  const { user } = useAuth();

  const [records, setRecords] = useState<JoiningRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<JoiningStage | 'All'>('All');
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    traineeId: '', recruitmentCenter: '', selectionDate: '', selectionBoardNo: '',
    callLetterNo: '', callDate: '', reportingDate: '', reportingTime: '',
    joiningAuthority: '', remarks: '',
  });

  const [trainees, setTrainees] = useState<any[]>([]);

  useEffect(() => {
    if (!activeBatch) return;
    setLoading(true);
    getJoiningRecordsByBatch(activeBatch.id).then(setRecords).finally(() => setLoading(false));

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
      if (filterStage !== 'All' && r.currentStage !== filterStage) return false;
      if (search) {
        const s = search.toLowerCase();
        return r.traineeName.toLowerCase().includes(s) || r.chestNo.toLowerCase().includes(s) || r.regNo.toLowerCase().includes(s);
      }
      return true;
    });
  }, [records, filterStage, search]);

  // Pipeline stats
  const pipeline = useMemo(() => {
    return JOINING_STAGES.map(s => ({
      ...s,
      count: records.filter(r => r.currentStage === s.stage).length,
    }));
  }, [records]);

  const handleCreate = async () => {
    if (!form.traineeId || !activeBatch || !user) return;
    const t = trainees.find(x => x.id === form.traineeId);
    await addJoiningRecord({
      traineeId: form.traineeId,
      traineeName: t?.name || '', chestNo: t?.chestNo || '', regNo: t?.regNo || '',
      batchId: activeBatch.id,
      recruitmentCenter: form.recruitmentCenter, selectionDate: form.selectionDate,
      selectionBoardNo: form.selectionBoardNo, callLetterNo: form.callLetterNo,
      callDate: form.callDate, reportingDate: form.reportingDate, reportingTime: form.reportingTime,
      actualReportingDate: '', lateReporting: false, lateReason: '',
      identityVerified: false, documentsVerified: false, verifiedBy: '', verificationDate: '',
      initialMedicalDate: '', medicalStatus: 'Pending', medicalRemarks: '',
      joiningDate: '', joiningAuthority: form.joiningAuthority, oathTaken: false, oathDate: '',
      allocatedCompany: '', allocatedPlatoon: '', allocatedSection: '', kitIssued: false,
      currentStage: 'Selected', status: 'Active', dropReason: '', remarks: form.remarks,
    });
    setShowModal(false);
    setRecords(await getJoiningRecordsByBatch(activeBatch.id));
    setMessage('✅ Joining record created!');
    setTimeout(() => setMessage(''), 3000);
  };

  const advanceStage = async (record: JoiningRecord) => {
    const stageIdx = JOINING_STAGES.findIndex(s => s.stage === record.currentStage);
    if (stageIdx < 0 || stageIdx >= JOINING_STAGES.length - 1) return;
    const nextStage = JOINING_STAGES[stageIdx + 1].stage;
    const extra: Partial<JoiningRecord> = {};

    if (nextStage === 'Reported') extra.actualReportingDate = new Date().toISOString().split('T')[0];
    if (nextStage === 'Verified') { extra.verifiedBy = user?.name || ''; extra.verificationDate = new Date().toISOString().split('T')[0]; extra.identityVerified = true; extra.documentsVerified = true; }
    if (nextStage === 'Medically Fit') { extra.initialMedicalDate = new Date().toISOString().split('T')[0]; extra.medicalStatus = 'Fit'; }
    if (nextStage === 'Joined') { extra.joiningDate = new Date().toISOString().split('T')[0]; extra.oathTaken = true; extra.oathDate = new Date().toISOString().split('T')[0]; }
    if (nextStage === 'Allocated') { extra.status = 'Completed'; }

    await updateJoiningStage(record.id, nextStage, extra);
    setRecords(prev => prev.map(r => r.id === record.id ? { ...r, currentStage: nextStage, ...extra } : r));
  };

  if (!activeBatch) return (
    <div className="p-8 text-center"><UserPlus size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">Pehle batch select karo</p></div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-violet-900 to-violet-700 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider">🚶 Bharti Prakriya</h1>
          <p className="text-[10px] text-violet-200">Joining Workflow — Selected → Allocated Pipeline</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-white text-violet-800 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-violet-50">
          <Plus size={14} /> Add Rangroot
        </button>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-xs font-bold">{message}</div>}

      {/* Pipeline */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-black text-slate-700 uppercase mb-3">Pipeline Overview</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {pipeline.map((s, i) => (
            <React.Fragment key={s.stage}>
              <div className={`flex-shrink-0 px-3 py-2 rounded-lg text-center ${s.color} ${filterStage === s.stage ? 'ring-2 ring-offset-1 ring-violet-500' : ''}`}
                onClick={() => setFilterStage(filterStage === s.stage ? 'All' : s.stage)} style={{ cursor: 'pointer' }}>
                <p className="text-lg">{s.icon}</p>
                <p className="text-lg font-black">{s.count}</p>
                <p className="text-[8px] font-bold uppercase">{s.stage}</p>
              </div>
              {i < pipeline.length - 1 && <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
      </div>

      {/* Records */}
      {loading ? <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-violet-600 mx-auto" /></div>
      : filtered.length === 0 ? <div className="bg-slate-50 border border-slate-200 p-8 text-center rounded-xl"><UserPlus size={40} className="mx-auto text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-400">Koi joining record nahi</p></div>
      : <div className="space-y-2">
          {filtered.map(r => {
            const stageInfo = JOINING_STAGES.find(s => s.stage === r.currentStage);
            const stageIdx = JOINING_STAGES.findIndex(s => s.stage === r.currentStage);
            const canAdvance = stageIdx < JOINING_STAGES.length - 1;
            return (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xl">{stageInfo?.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-800">{r.traineeName} <span className="text-slate-400">({r.chestNo})</span></p>
                      <p className="text-[9px] text-slate-500">Stage: {r.currentStage} · {r.recruitmentCenter || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${stageInfo?.color}`}>{r.currentStage}</span>
                    {canAdvance && (
                      <button onClick={() => advanceStage(r)}
                        className="px-3 py-1.5 bg-violet-600 text-white text-[10px] font-black rounded-lg hover:bg-violet-700 flex items-center gap-1">
                        Next <ArrowRight size={10} />
                      </button>
                    )}
                  </div>
                </div>
                {/* Stage progress bar */}
                <div className="px-4 pb-3">
                  <div className="flex gap-1">
                    {JOINING_STAGES.map((s, i) => (
                      <div key={s.stage} className={`h-1.5 flex-1 rounded-full ${i <= stageIdx ? 'bg-violet-500' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-violet-800 px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-sm font-black text-white">🚶 Naya Joining Record</h3>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-violet-300"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Rangroot *</label>
                <select value={form.traineeId} onChange={e => setForm(p => ({ ...p, traineeId: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">-- Select --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>{t.chestNo} — {t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Recruitment Center</label><input type="text" value={form.recruitmentCenter} onChange={e => setForm(p => ({ ...p, recruitmentCenter: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Selection Date</label><input type="date" value={form.selectionDate} onChange={e => setForm(p => ({ ...p, selectionDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Call Letter No</label><input type="text" value={form.callLetterNo} onChange={e => setForm(p => ({ ...p, callLetterNo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Reporting Date</label><input type="date" value={form.reportingDate} onChange={e => setForm(p => ({ ...p, reportingDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Joining Authority</label><input type="text" value={form.joiningAuthority} onChange={e => setForm(p => ({ ...p, joiningAuthority: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              <div className="flex gap-3 justify-end pt-3 border-t">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">Cancel</button>
                <button onClick={handleCreate} className="px-6 py-2 bg-violet-700 text-white text-xs font-black rounded-lg flex items-center gap-2 hover:bg-violet-800"><Save size={14} /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
