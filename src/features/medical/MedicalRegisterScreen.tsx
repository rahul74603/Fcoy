// src/features/medical/MedicalRegisterScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  HeartPulse, Plus, Trash2,
  AlertCircle, Layers, CheckCircle2, X, Loader2, Activity,
  Stethoscope, BedDouble, Printer, Search
} from 'lucide-react';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { useAuth } from '../../contexts/AuthContext';               // ★ audit stamps
import { useUnitConfig } from '../../contexts/UnitConfigContext';   // ★ report header
import { buildSickReportHtml, printDocument } from '../shared/printDocuments'; // ★

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface MedicalRecord {
  id?: string;
  source?: 'medical' | 'absent';
  linkedAbsentId?: string;
  batchId: string;
  traineeId: string;
  chestNo: string;
  name: string;
  platoon: string;
  date: string;
  // ★ 'Injury (Training)' aur 'Medical Exam' naye additive categories
  category: 'Sick Report' | 'Hospital Admit' | 'B-Rest' | 'C-Rest' | 'Medical Board' | 'Injury (Training)' | 'Medical Exam';
  diagnosis: string;
  wardNo?: string;
  recommendedDays?: number;
  remarks: string;
  status: 'Active' | 'Fit / Discharged';
  createdBy?: string;        // ★
  createdByName?: string;    // ★
}

const CATEGORIES = ['Sick Report', 'Hospital Admit', 'Injury (Training)', 'B-Rest', 'C-Rest', 'Medical Board', 'Medical Exam'];


const absentTypeToMedicalCategory = (type: string): MedicalRecord['category'] => {
  if (type === 'H') return 'Hospital Admit';
  if (type === 'R') return 'B-Rest';
  if (type === 'M') return 'Medical Board';
  return 'Sick Report';
};


const categoryToAttendance = (category: MedicalRecord['category']): 'S' | 'H' | 'R' | 'M' => {
  if (category === 'Hospital Admit') return 'H';
  if (category === 'B-Rest' || category === 'C-Rest') return 'R';
  if (category === 'Medical Board') return 'M';
  return 'S';
};

const categoryToMedStat = (category: MedicalRecord['category']): string => {
  if (category === 'Hospital Admit') return 'Hospital';
  if (category === 'B-Rest' || category === 'C-Rest') return category;
  if (category === 'Medical Board') return 'Medical Board';
  return 'Sick';
};

// ★ 'Medical Exam' sirf record hai — trainee ki duty status (attn)
//   NAHI badalni chahiye (exam hone se koi sick nahi hota)
const shouldSyncDutyStatus = (category: MedicalRecord['category']): boolean =>
  category !== 'Medical Exam';

// ★ Kitne din se case chal raha hai
const daysSince = (dateStr: string): number => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1);
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const MedicalRegisterScreen = () => {
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;
  const { user } = useAuth();                 // ★
  const { unitConfig } = useUnitConfig();     // ★

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [showForm, setShowForm] = useState(false);
  const todayDate = new Date().toISOString().split('T')[0];

  // ★ SEARCH & FILTERS (M14)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlatoon, setFilterPlatoon] = useState<string>('all');

  // ★ Sick report date (print)
  const [reportDate, setReportDate] = useState(todayDate);

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
      mSnap.forEach(d => mList.push({ id: d.id, source: 'medical', ...d.data() } as MedicalRecord));

      // Daily Tracking ke medical-type absent records ko bhi yahin show karo.
      const absentSnap = await getDocs(query(
        collection(db, 'absentRecords'),
        where('batchId', '==', activeBatch.id)
      ));
      absentSnap.forEach(d => {
        const data = d.data();
        if (!['S', 'H', 'R', 'M'].includes(data.type)) return;
        const category = absentTypeToMedicalCategory(data.type);
        const exists = mList.some(r =>
          r.traineeId === data.traineeId &&
          r.date === data.fromDate &&
          r.category === category
        );
        if (exists) return;
        mList.push({
          id: `absent_${d.id}`,
          source: 'absent',
          linkedAbsentId: d.id,
          batchId: activeBatch.id,
          traineeId: data.traineeId ?? '',
          chestNo: data.chestNo ?? '',
          name: data.traineeName ?? '',
          platoon: data.platoon ?? '',
          date: data.fromDate ?? '',
          category,
          diagnosis: data.reason ?? category,
          wardNo: data.remarks ?? '',
          recommendedDays: Number(data.totalDays ?? 1),
          remarks: data.remarks ?? '',
          status: data.status === 'Returned' ? 'Fit / Discharged' : 'Active',
        });
      });
      mList.sort((a, b) => String(b.date).localeCompare(String(a.date)));
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
      // ★ audit stamps — kaun ne record banaya
      await addDoc(collection(db, 'medicalRecords'), {
        ...form,
        batchId: activeBatch.id,
        createdBy: user?.uid ?? '',
        createdByName: user?.displayName ?? user?.email ?? '',
        createdAt: serverTimestamp(),
      });
      // ★ Medical Exam pe duty-status sync NAHI hota
      if (shouldSyncDutyStatus(form.category)) {
        await updateDoc(doc(db, 'trainees', form.traineeId), {
          attn: categoryToAttendance(form.category),
          medStat: categoryToMedStat(form.category),
          medicalStatus: form.category,
          lastMedicalUpdate: new Date().toISOString(),
        });
      }
      setMessage(shouldSyncDutyStatus(form.category)
        ? 'SUCCESS: Medical record save ho gaya aur trainee status sync ho gaya!'
        : 'SUCCESS: Medical exam record save ho gaya! (duty status unchanged — exam record hai)');
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
      const record = records.find(r => r.id === id);
      if (record?.source === 'absent' && record.linkedAbsentId) {
        await updateDoc(doc(db, 'absentRecords', record.linkedAbsentId), { status: 'Returned', toDate: new Date().toISOString().split('T')[0] });
      } else {
        // ★ fit-marking audit stamps (kisne fit kiya + kab)
        await updateDoc(doc(db, 'medicalRecords', id), {
          status: 'Fit / Discharged',
          fitMarkedBy: user?.uid ?? '',
          fitMarkedByName: user?.displayName ?? user?.email ?? '',
          fitMarkedAt: serverTimestamp(),
        });
      }

      if (record?.traineeId) {
        const activeMedicalLeft = records.some(r =>
          r.id !== id && r.traineeId === record.traineeId && r.status === 'Active'
        );

        const activeAbsentSnap = await getDocs(query(
          collection(db, 'absentRecords'),
          where('traineeId', '==', record.traineeId),
          where('status', '==', 'Active')
        ));

        if (!activeMedicalLeft && activeAbsentSnap.empty) {
          await updateDoc(doc(db, 'trainees', record.traineeId), {
            attn: 'P',
            medStat: 'SHAPE-1',
            medicalStatus: 'Fit / Discharged',
            lastMedicalUpdate: new Date().toISOString(),
          });
        }
      }
      fetchData();
    } catch (err) {
      alert("Status update failed");
    }
  };

  const deleteRecord = async (id: string) => {
    if (!window.confirm("Kya aap sure hain?")) return;
    try {
      const currentRecord = records.find(r => r.id === id);
      let record: MedicalRecord | null = currentRecord ?? null;
      if (currentRecord?.source === 'absent' && currentRecord.linkedAbsentId) {
        await deleteDoc(doc(db, 'absentRecords', currentRecord.linkedAbsentId));
      } else {
        const recordSnap = await getDoc(doc(db, 'medicalRecords', id));
        record = recordSnap.exists() ? ({ id, ...recordSnap.data() } as MedicalRecord) : null;
        await deleteDoc(doc(db, 'medicalRecords', id));
      }

      if (record?.traineeId && record.status === 'Active') {
        const activeMedicalLeft = records.some(r =>
          r.id !== id && r.traineeId === record.traineeId && r.status === 'Active'
        );
        const activeAbsentSnap = await getDocs(query(
          collection(db, 'absentRecords'),
          where('traineeId', '==', record.traineeId),
          where('status', '==', 'Active')
        ));
        if (!activeMedicalLeft && activeAbsentSnap.empty) {
          await updateDoc(doc(db, 'trainees', record.traineeId), {
            attn: 'P',
            medStat: 'SHAPE-1',
            medicalStatus: 'Fit / Discharged',
            lastMedicalUpdate: new Date().toISOString(),
          });
        }
      }
      fetchData();
    } catch { alert('Delete failed'); }
  };

  // ── Stats ──
  const activeCases = records.filter(r => r.status === 'Active');
  const hospitalCases = activeCases.filter(r => r.category === 'Hospital Admit').length;
  const restCases = activeCases.filter(r => r.category === 'B-Rest' || r.category === 'C-Rest').length;

  // ═══════════════════════════════════════════
  // ★ SEARCH + FILTERS (chest / name / diagnosis / category / status / platoon)
  // ═══════════════════════════════════════════
  const filteredRecords = records.filter(r => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      r.chestNo.toLowerCase().includes(q) ||
      r.diagnosis.toLowerCase().includes(q);
    const matchCategory = filterCategory === 'all' || r.category === filterCategory;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchPlatoon = filterPlatoon === 'all' || r.platoon === filterPlatoon;
    return matchSearch && matchCategory && matchStatus && matchPlatoon;
  });

  const platoonOptions = Array.from(new Set(records.map(r => r.platoon).filter(Boolean))).sort();

  // ═══════════════════════════════════════════
  // ★ DAILY SICK PARADE STATE — print (M14)
  // ═══════════════════════════════════════════
  const handlePrintSickReport = () => {
    const newEntries = records
      .filter(r => r.date === reportDate)
      .map(r => ({
        date: r.date, chestNo: r.chestNo, traineeName: r.name, platoon: r.platoon,
        category: r.category, diagnosis: r.diagnosis, wardNo: r.wardNo,
        days: daysSince(r.date),
      }));
    const active = activeCases.map(r => ({
      date: r.date, chestNo: r.chestNo, traineeName: r.name, platoon: r.platoon,
      category: r.category, diagnosis: r.diagnosis, wardNo: r.wardNo,
      days: daysSince(r.date),
    }));
    const html = buildSickReportHtml({
      dateStr: new Date(reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      unitName: unitConfig.parentUnit,
      coyName: unitConfig.companyShort,
      batchNumber: activeBatch?.batchNumber,
      totalStrength: trainees.length,
      newEntries,
      activeCases: active,
      printedBy: user?.displayName ?? user?.email ?? '',
    });
    printDocument(`Daily Sick Parade State — ${reportDate}`, html);
  };

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
            <div className="flex items-center gap-2">
              {/* ★ Daily Sick State print */}
              <input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                title="Sick report date"
                className="text-[10px] border border-slate-300 px-2 py-1 focus:outline-none focus:border-red-400"
              />
              <button
                onClick={handlePrintSickReport}
                className="bg-slate-700 text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-slate-800 flex items-center gap-1"
                title="Daily Sick Parade State print karein (aaj ke naye cases + saare active cases)"
              >
                <Printer size={12}/> Sick State
              </button>
              <button onClick={() => { setShowForm(!showForm); setForm(getEmptyForm()); }} className="bg-red-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-red-700 flex items-center gap-1">
                {showForm ? <><X size={12}/> Close Form</> : <><Plus size={12}/> New Entry</>}
              </button>
            </div>
          </div>

          {/* ★ SEARCH & FILTER BAR */}
          <div className="px-4 py-2 border-b border-slate-200 bg-white flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search: chest no / naam / diagnosis..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-300 focus:outline-none focus:border-red-400"
              />
            </div>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-[11px] border border-slate-300 px-2 py-1.5 focus:outline-none">
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[11px] border border-slate-300 px-2 py-1.5 focus:outline-none">
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Fit / Discharged">Fit / Discharged</option>
            </select>
            <select value={filterPlatoon} onChange={e => setFilterPlatoon(e.target.value)} className="text-[11px] border border-slate-300 px-2 py-1.5 focus:outline-none">
              <option value="all">All Platoons</option>
              {platoonOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(searchQuery || filterCategory !== 'all' || filterStatus !== 'all' || filterPlatoon !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setFilterCategory('all'); setFilterStatus('all'); setFilterPlatoon('all'); }}
                className="text-[10px] font-bold text-red-600 hover:text-red-800 uppercase"
              >
                Clear ✕
              </button>
            )}
            <span className="text-[10px] font-bold text-slate-400 uppercase ml-auto">
              {filteredRecords.length} / {records.length} records
            </span>
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
                  {filteredRecords.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50 ${r.status === 'Active' ? 'bg-red-50/20' : 'bg-slate-50 opacity-70'}`}>
                      <td className="px-3 py-2 font-mono text-slate-500">
                        {r.date}
                        {/* ★ active case kitne din se chal raha hai */}
                        {r.status === 'Active' && (
                          <span className="block text-[9px] font-bold text-red-500">Day {daysSince(r.date)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono font-bold text-military-800 mr-2">{r.chestNo}</span>
                        <span className="font-bold text-slate-800">{r.name}</span>
                        {/* ★ audit: kisne entry ki */}
                        {r.createdByName && (
                          <span className="block text-[8px] text-slate-400">by {r.createdByName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-600">{r.platoon}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-sm ${
                          r.category.includes('Hospital') ? 'bg-red-100 text-red-700' :
                          r.category.includes('Injury') ? 'bg-orange-100 text-orange-700' :
                          r.category.includes('Exam') ? 'bg-blue-100 text-blue-700' :
                          r.category.includes('Board') ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
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
                  {filteredRecords.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic font-bold">{records.length === 0 ? 'Koi medical record nahi hai.' : 'Filter/search mein koi record match nahi hua.'}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};