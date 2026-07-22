// src/features/medical/MedicalRegisterScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  HeartPulse, Plus, Save, Trash2, Calendar, User,
  AlertCircle, Layers, CheckCircle2, X, Loader2, Activity,
  Stethoscope, BedDouble
} from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface MedicalRecord {
  id?: string;
  batchId: string;
  traineeId: string;
  chestNo: string;
  name: string;
  platoon: string;
  date: string;
  category: 'Sick Report' | 'Hospital Admit' | 'B-Rest' | 'C-Rest' | 'Medical Board';
  diagnosis: string;
  wardNo?: string;
  recommendedDays?: number;
  remarks: string;
  status: 'Active' | 'Fit / Discharged';
}

const CATEGORIES = ['Sick Report', 'Hospital Admit', 'B-Rest', 'C-Rest', 'Medical Board'];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const MedicalRegisterScreen = () => {
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const todayDate = new Date().toISOString().split('T')[0];

  const getEmptyForm = (): Omit<MedicalRecord, 'id' | 'batchId'> => ({
    traineeId: '', chestNo: '', name: '', platoon: '',
    date: todayDate, category: 'Sick Report', diagnosis: '', wardNo: '', recommendedDays: 0,
    remarks: '', status: 'Active'
  });
  
  const [form, setForm] = useState(getEmptyForm());

  // ── Fetch Data ──
  const fetchData = async () => {
    if (!activeBatch) { setLoading(false); return; }
    setLoading(true);
    try {
      // Fetch Trainees for Dropdown
      const tq = query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id));
      const tSnap = await getDocs(tq);
      const tList: any[] = [];
      tSnap.forEach(d => tList.push({ id: d.id, ...d.data() }));
      setTrainees(tList.sort((a, b) => (a.chestNo || '').localeCompare(b.chestNo || '')));

      // Fetch Medical Records
      const mq = query(collection(db, 'medicalRecords'), where('batchId', '==', activeBatch.id), orderBy('date', 'desc'));
      const mSnap = await getDocs(mq);
      const mList: MedicalRecord[] = [];
      mSnap.forEach(d => mList.push({ id: d.id, ...d.data() } as MedicalRecord));
      setRecords(mList);
    } catch (err) {
      console.error(err);
      setMessage('ERROR: Data fetch fail ho gaya.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeBatch]);

  // ── Save Record ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch) return;
    if (!form.traineeId) {
      setMessage('ERROR: Trainee select karna zaroori hai!');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await addDoc(collection(db, 'medicalRecords'), { ...form, batchId: activeBatch.id });
      setMessage('SUCCESS: Medical record save ho gaya!');
      setShowForm(false);
      setForm(getEmptyForm());
      fetchData();
    } catch (err: any) {
      setMessage(`ERROR: ${err.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // ── Mark as Fit ──
  const markAsFit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'medicalRecords', id), { status: 'Fit / Discharged' });
      fetchData();
    } catch (err) {
      alert("Status update failed");
    }
  };

  const deleteRecord = async (id: string) => {
    if (!window.confirm("Kya aap sure hain?")) return;
    try {
      await deleteDoc(doc(db, 'medicalRecords', id));
      fetchData();
    } catch { alert('Delete failed'); }
  };

  // ── Stats ──
  const activeCases = records.filter(r => r.status === 'Active');
  const hospitalCases = activeCases.filter(r => r.category === 'Hospital Admit').length;
  const restCases = activeCases.filter(r => r.category === 'B-Rest' || r.category === 'C-Rest').length;

  const inputCls = "w-full text-xs px-2 py-1.5 border border-slate-300 focus:outline-none focus:border-military-700 bg-white";
  const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1";

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="w-full flex flex-col space-y-4 pb-8">
      
      {!hasBatch && (
        <div className="bg-red-900 border border-red-600 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-300 flex-shrink-0 animate-pulse" />
          <span className="text-[11px] font-black text-red-200 uppercase tracking-wide">
            Koi Active Batch Nahi! Pehle Batch activate karo.
          </span>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-military-900 px-4 py-3 flex justify-between items-center shadow-flat">
        <div className="flex items-center gap-3">
          <HeartPulse size={20} className="text-red-400" />
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">MI Room & Medical Register</h1>
            <p className="text-[10px] text-military-300 uppercase tracking-wider">Sick Report, Hospitalization & Light Duty</p>
          </div>
        </div>
        {activeBatch && (
          <span className="bg-military-800 border border-military-700 text-white text-[10px] font-black px-3 py-1 uppercase flex items-center gap-1.5">
            <Layers size={12} /> Batch: {activeBatch.batchNumber}
          </span>
        )}
      </div>

      {/* ── STATS ── */}
      {hasBatch && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-l-4 border-red-500 shadow-flat p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Hospital Admitted</p>
              <p className="text-2xl font-black text-red-600">{hospitalCases}</p>
            </div>
            <BedDouble size={28} className="text-red-100" />
          </div>
          <div className="bg-white border-l-4 border-amber-500 shadow-flat p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">On Light Duty (B/C-Rest)</p>
              <p className="text-2xl font-black text-amber-500">{restCases}</p>
            </div>
            <Activity size={28} className="text-amber-100" />
          </div>
          <div className="bg-white border-l-4 border-military-500 shadow-flat p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Active Cases</p>
              <p className="text-2xl font-black text-military-700">{activeCases.length}</p>
            </div>
            <Stethoscope size={28} className="text-military-100" />
          </div>
        </div>
      )}

      {message && (
        <div className={`p-3 text-xs font-bold border flex items-center gap-2 ${message.includes('ERROR') ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {message.includes('ERROR') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />} {message}
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      {hasBatch && (
        <div className="bg-white border border-slate-300 shadow-flat flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-700 uppercase">Medical Records History</h3>
            <button onClick={() => { setShowForm(!showForm); setForm(getEmptyForm()); }} className="bg-red-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-red-700 flex items-center gap-1">
              {showForm ? <><X size={12}/> Close Form</> : <><Plus size={12}/> New Entry</>}
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSave} className="p-4 bg-red-50 border-b border-red-200 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>Select Trainee *</label>
                <select required value={form.traineeId} onChange={e => {
                  const t = trainees.find(x => x.id === e.target.value);
                  setForm({...form, traineeId: e.target.value, chestNo: t?.chestNo || 'N/A', name: t?.name || '', platoon: t?.platoon || ''});
                }} className={inputCls}>
                  <option value="">-- Trainee Select Karein --</option>
                  {trainees.map(t => <option key={t.id} value={t.id}>Chest: {t.chestNo || 'N/A'} - {t.name} ({t.platoon})</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Date *</label><input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inputCls} /></div>
              <div><label className={labelCls}>Category *</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value as any})} className={inputCls}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              
              <div className="md:col-span-2"><label className={labelCls}>Diagnosis / Problem *</label><input required type="text" value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} className={inputCls} placeholder="e.g. Viral Fever, Ankle Sprain" /></div>
              
              {form.category === 'Hospital Admit' && (
                <div><label className={labelCls}>Ward No. / Hospital</label><input type="text" value={form.wardNo} onChange={e => setForm({...form, wardNo: e.target.value})} className={inputCls} placeholder="e.g. Base Hospital Ward 2" /></div>
              )}
              {(form.category === 'B-Rest' || form.category === 'C-Rest') && (
                <div><label className={labelCls}>Recommended Days</label><input type="number" min="1" value={form.recommendedDays} onChange={e => setForm({...form, recommendedDays: Number(e.target.value)})} className={inputCls} placeholder="Days" /></div>
              )}

              <div className="md:col-span-4"><label className={labelCls}>Remarks / Doctor Advice</label><input type="text" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className={inputCls} placeholder="Dawaii ya instruction..." /></div>
              <div className="md:col-span-4 flex justify-end">
                <button type="submit" disabled={saving} className="bg-red-700 text-white px-6 py-2 text-xs font-bold uppercase hover:bg-red-800 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          {loading ? <div className="p-8 text-center"><Loader2 size={24} className="mx-auto animate-spin text-red-500" /></div> : (
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    {['Date','Chest & Name','Platoon','Category','Diagnosis / Details','Status','Actions'].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-600 uppercase">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50 ${r.status === 'Active' ? 'bg-red-50/20' : 'bg-slate-50 opacity-70'}`}>
                      <td className="px-3 py-2 font-mono text-slate-500">{r.date}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono font-bold text-military-800 mr-2">{r.chestNo}</span>
                        <span className="font-bold text-slate-800">{r.name}</span>
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-600">{r.platoon}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-sm ${r.category.includes('Hospital') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[10px]">
                        <p className="font-bold text-slate-700">{r.diagnosis}</p>
                        <p className="text-slate-500">
                          {r.wardNo && `Ward: ${r.wardNo} `}
                          {r.recommendedDays ? `(${r.recommendedDays} Days) ` : ''}
                          {r.remarks}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        {r.status === 'Active' 
                          ? <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded">● Active Case</span>
                          : <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">✓ Fit</span>}
                      </td>
                      <td className="px-3 py-2 flex gap-2">
                        {r.status === 'Active' && (
                          <button onClick={() => markAsFit(r.id!)} className="bg-green-100 text-green-700 px-2 py-1 text-[9px] font-bold hover:bg-green-200 rounded">
                            Mark Fit
                          </button>
                        )}
                        <button onClick={() => r.id && deleteRecord(r.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic font-bold">Koi medical record nahi hai.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};