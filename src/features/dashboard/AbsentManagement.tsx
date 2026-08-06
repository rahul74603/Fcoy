// D:\ALL PROJECTS\BSF COYs\frontend\src\features\dashboard\AbsentManagement.tsx

import React, { useState, useEffect } from 'react';
import {
  UserX, Plus, Save, X, Search,
  CheckCircle2, AlertCircle, Loader2,
  BarChart3,
  Layers, Trash2, Edit3
} from 'lucide-react';
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where, orderBy
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { ReportButton } from '../../components/common/ReportButton';

// ─── Types ───
interface AbsentRecord {
  id?: string;
  source?: 'absent' | 'medical';
  linkedMedicalId?: string;
  batchId: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  platoon: string;
  type: 'A' | 'L' | 'S' | 'H' | 'R' | 'M';
  reason: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: 'Active' | 'Returned';
  remarks: string;
  createdAt: string;
}

interface TraineeBasic {
  id: string;
  name?: string;
  chestNo?: string;
  regNo?: string;
  platoon?: string;
  rank?: string;
  attn?: string;
  [key: string]: any;
}

// ─── Constants ───
const ABSENT_TYPES = [
  { value: 'A', label: 'Absent (बिना बताए)', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'L', label: 'Leave (छुट्टी पर)', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'S', label: 'Sick / MI Room (बीमार)', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'H', label: 'Hospitalized (अस्पताल)', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'R', label: 'Rest / Excused (आराम)', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'M', label: 'Medical Appointment', color: 'bg-teal-100 text-teal-800 border-teal-300' },
];

const getTypeInfo = (type: string) =>
  ABSENT_TYPES.find(t => t.value === type) || ABSENT_TYPES[0];


const medicalCategoryToAbsentType = (category: string): AbsentRecord['type'] => {
  if (category === 'Hospital Admit') return 'H';
  if (category === 'B-Rest' || category === 'C-Rest') return 'R';
  if (category === 'Medical Board') return 'M';
  return 'S';
};

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export const AbsentManagement: React.FC = () => {
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  const [records, setRecords]       = useState<AbsentRecord[]>([]);
  const [trainees, setTrainees]     = useState<TraineeBasic[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [message, setMessage]       = useState('');

  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Filters
  const [filterType, setFilterType]     = useState('All');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [searchQuery, setSearchQuery]   = useState('');

  const todayDate = new Date().toISOString().split('T')[0];

  // Form
  const getEmptyForm = () => ({
    traineeId:   '',
    traineeName: '',
    chestNo:     '',
    regNo:       '',
    platoon:     '',
    type:        'L' as AbsentRecord['type'],
    reason:      '',
    fromDate:    todayDate,
    toDate:      todayDate,
    remarks:     '',
  });
  const [formData, setFormData] = useState(getEmptyForm());

  // ── Fetch ──
  const fetchData = async () => {
    if (!activeBatch) { setLoading(false); return; }
    setLoading(true);
    try {
      // Trainees
      const tq = query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id));
      const tSnap = await getDocs(tq);
      const tList: TraineeBasic[] = [];
      tSnap.forEach(d => tList.push({ id: d.id, ...d.data() } as TraineeBasic));
      setTrainees(tList);

      // Absent records
      const aq = query(
        collection(db, 'absentRecords'),
        where('batchId', '==', activeBatch.id),
        orderBy('fromDate', 'desc')
      );
      const aSnap = await getDocs(aq);
      const aList: AbsentRecord[] = [];
      aSnap.forEach(d => aList.push({ id: d.id, source: 'absent', ...d.data() } as AbsentRecord));

      // MI Room medical records ko same daily tracking list me virtual rows ke रूप me dikhाओ.
      const medicalSnap = await getDocs(query(
        collection(db, 'medicalRecords'),
        where('batchId', '==', activeBatch.id)
      ));
      medicalSnap.forEach(d => {
        const data = d.data();
        const type = medicalCategoryToAbsentType(data.category ?? 'Sick Report');
        const exists = aList.some(r =>
          r.traineeId === data.traineeId &&
          r.fromDate === data.date &&
          r.type === type
        );
        if (exists) return;
        aList.push({
          id: `medical_${d.id}`,
          source: 'medical',
          linkedMedicalId: d.id,
          batchId: activeBatch.id,
          traineeId: data.traineeId ?? '',
          traineeName: data.name ?? '',
          chestNo: data.chestNo ?? '',
          regNo: data.regNo ?? '',
          platoon: data.platoon ?? '',
          type,
          reason: data.diagnosis ?? data.category ?? '',
          fromDate: data.date ?? '',
          toDate: data.date ?? '',
          totalDays: Number(data.recommendedDays ?? 1),
          status: data.status === 'Fit / Discharged' ? 'Returned' : 'Active',
          remarks: data.remarks ?? data.wardNo ?? '',
          createdAt: data.createdAt ?? data.date ?? '',
        });
      });
      aList.sort((a, b) => String(b.fromDate).localeCompare(String(a.fromDate)));
      setRecords(aList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeBatch]);

  // ── Calculate days ──
  const calcDays = (from: string, to: string): number => {
    if (!from || !to) return 1;
    const diff = new Date(to).getTime() - new Date(from).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  // ── Trainee select ──
  const handleTraineeSelect = (traineeId: string) => {
    const t = trainees.find(x => x.id === traineeId);
    if (t) {
      setFormData(prev => ({
        ...prev,
        traineeId:   t.id,
        traineeName: t.name || '',
        chestNo:     t.chestNo || '',
        regNo:       t.regNo || '',
        platoon:     t.platoon || '',
      }));
    }
  };

  // ── Save ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch || !formData.traineeId) {
      setMessage('ERROR: Trainee select karo!');
      return;
    }
    setSaving(true); setMessage('');
    try {
      const totalDays = calcDays(formData.fromDate, formData.toDate);
      const saveData = {
        ...formData,
        batchId:   activeBatch.id,
        totalDays,
        status:    'Active' as const,
        createdAt: new Date().toISOString(),
      };

      if (editId) {
        await updateDoc(doc(db, 'absentRecords', editId), saveData);
        setMessage('SUCCESS: Record update ho gaya!');
      } else {
        await addDoc(collection(db, 'absentRecords'), saveData);
        // Update trainee attendance status
        await updateDoc(doc(db, 'trainees', formData.traineeId), {
          attn: formData.type,
        });
        setMessage('SUCCESS: Absent record save ho gaya!');
      }

      setShowForm(false); setEditId(null);
      setFormData(getEmptyForm());
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(`ERROR: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Mark Returned ──
  const handleReturn = async (record: AbsentRecord) => {
    if (!window.confirm(`${record.traineeName} wapas aa gaya?`)) return;
    try {
      if (record.source === 'medical' && record.linkedMedicalId) {
        await updateDoc(doc(db, 'medicalRecords', record.linkedMedicalId), { status: 'Fit / Discharged' });
      } else {
        await updateDoc(doc(db, 'absentRecords', record.id!), {
          status: 'Returned',
          toDate: todayDate,
          totalDays: calcDays(record.fromDate, todayDate),
        });
      }
      await updateDoc(doc(db, 'trainees', record.traineeId), { attn: 'P', medStat: 'SHAPE-1' });
      fetchData();
    } catch (err) {
      alert('Error updating!');
    }
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete karna hai?')) return;
    try {
      if (id.startsWith('medical_')) {
        await deleteDoc(doc(db, 'medicalRecords', id.replace('medical_', '')));
      } else {
        await deleteDoc(doc(db, 'absentRecords', id));
      }
      fetchData();
    } catch { alert('Delete failed!'); }
  };

  // ── Edit ──
  const handleEdit = (r: AbsentRecord) => {
    setFormData({
      traineeId:   r.traineeId,
      traineeName: r.traineeName,
      chestNo:     r.chestNo,
      regNo:       r.regNo,
      platoon:     r.platoon,
      type:        r.type,
      reason:      r.reason,
      fromDate:    r.fromDate,
      toDate:      r.toDate,
      remarks:     r.remarks,
    });
    setEditId(r.id!);
    setShowForm(true);
  };

  // ── Filtered Records ──
  const filteredRecords = records.filter(r => {
    if (filterType !== 'All' && r.type !== filterType) return false;
    if (filterStatus !== 'All' && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.traineeName.toLowerCase().includes(q) &&
          !r.chestNo.toLowerCase().includes(q) &&
          !r.regNo.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Analytics ──
  const activeAbsent  = records.filter(r => r.status === 'Active');
  const typeWiseCount = ABSENT_TYPES.map(t => ({
    ...t,
    active: records.filter(r => r.type === t.value && r.status === 'Active').length,
    total:  records.filter(r => r.type === t.value).length,
  }));

  // Trainee-wise absence count (for analytics)
  const traineeAbsenceMap: Record<string, { name: string; chestNo: string; platoon: string; count: number; totalDays: number }> = {};
  records.forEach(r => {
    if (!traineeAbsenceMap[r.traineeId]) {
      traineeAbsenceMap[r.traineeId] = {
        name: r.traineeName, chestNo: r.chestNo,
        platoon: r.platoon, count: 0, totalDays: 0
      };
    }
    traineeAbsenceMap[r.traineeId].count++;
    traineeAbsenceMap[r.traineeId].totalDays += r.totalDays || 1;
  });
  const topAbsentees = Object.entries(traineeAbsenceMap)
    .sort(([, a], [, b]) => b.totalDays - a.totalDays)
    .slice(0, 15);

  // ── Styles ──
  const inputCls = "w-full text-xs px-2 py-1.5 border border-slate-300 focus:outline-none focus:border-military-700 bg-white";
  const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1";

  // ═══════════════════════════════
  // RENDER
  // ═══════════════════════════════
  return (
    <div className="w-full flex flex-col space-y-4 pb-8">

      {!hasBatch && (
        <div className="bg-red-900 border border-red-600 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-300 animate-pulse" />
          <span className="text-[11px] font-black text-red-200 uppercase">
            Koi Active Batch Nahi! Pehle Batch activate karo.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-military-900 px-4 py-3 flex items-center justify-between shadow-flat">
        <div className="flex items-center gap-3">
          <UserX size={20} className="text-red-400" />
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">
              Absent / Leave / Medical Manager
            </h1>
            <p className="text-[10px] text-military-300 uppercase">
              Track every absence — History saved permanently
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeBatch && (
            <span className="bg-military-800 text-white text-[10px] font-black px-3 py-1 border border-military-600 flex items-center gap-1">
              <Layers size={12} /> {activeBatch.batchNumber}
            </span>
          )}
          <button onClick={() => setShowAnalytics(!showAnalytics)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase flex items-center gap-1 border ${
              showAnalytics
                ? 'bg-amber-500 text-black border-amber-600'
                : 'bg-military-800 text-white border-military-600 hover:bg-military-700'
            }`}>
            <BarChart3 size={12} /> {showAnalytics ? 'Hide Analytics' : 'Analytics'}
          </button>
          <button onClick={() => { setShowForm(true); setEditId(null); setFormData(getEmptyForm()); }}
            className="bg-red-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-red-700 flex items-center gap-1">
            <Plus size={12} /> Mark Absent
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {hasBatch && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <div className="bg-white border border-slate-300 p-3 shadow-flat border-t-2 border-t-military-700">
            <p className="text-[9px] font-bold text-slate-500 uppercase">Total Strength</p>
            <p className="text-2xl font-black text-military-900">{trainees.length}</p>
            <p className="text-[9px] text-green-600 font-bold">
              {trainees.length - activeAbsent.length} Present
            </p>
          </div>
          {typeWiseCount.map(t => (
            <div key={t.value} className={`bg-white border border-slate-300 p-3 shadow-flat border-t-2 ${
              t.value === 'A' ? 'border-t-red-500' :
              t.value === 'L' ? 'border-t-amber-500' :
              t.value === 'S' ? 'border-t-orange-500' :
              t.value === 'H' ? 'border-t-purple-500' :
              t.value === 'M' ? 'border-t-teal-500' :
              'border-t-blue-500'
            }`}>
              <p className="text-[9px] font-bold text-slate-500 uppercase">{t.label.split(' (')[0]}</p>
              <p className="text-2xl font-black">{t.active}</p>
              <p className="text-[9px] text-slate-400">Total: {t.total} records</p>
            </div>
          ))}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`p-3 text-xs font-bold border flex items-center gap-2 ${
          message.startsWith('ERROR')
            ? 'bg-red-50 text-red-600 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          {message.startsWith('ERROR') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          {message}
        </div>
      )}

      {/* ── ANALYTICS PANEL ── */}
      {showAnalytics && hasBatch && (
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-amber-100 border-b border-amber-300 px-4 py-2">
            <h3 className="text-xs font-black text-amber-900 uppercase flex items-center gap-2">
              <BarChart3 size={14} /> Absence Analytics — Full History
            </h3>
          </div>
          <div className="p-4">
            <h4 className="text-[10px] font-black text-slate-700 uppercase mb-3 border-b pb-2">
              Most Absent Trainees (By Total Days)
            </h4>
            {topAbsentees.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">Koi record nahi hai abhi</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {['Rank','Chest No','Name','Platoon','Total Times','Total Days','Avg Days'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topAbsentees.map(([id, data], idx) => (
                    <tr key={id} className={`hover:bg-slate-50 ${idx < 3 ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono font-bold text-military-800">{data.chestNo || '—'}</td>
                      <td className="px-3 py-2 font-bold text-slate-800">{data.name}</td>
                      <td className="px-3 py-2 text-slate-600">{data.platoon || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold">
                          {data.count}x
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-black text-red-700">{data.totalDays} Days</span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {(data.totalDays / data.count).toFixed(1)} days/time
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── ADD/EDIT FORM ── */}
      {showForm && hasBatch && (
        <div className="bg-white border-t-4 border-t-red-600 border border-slate-300 shadow-flat p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-military-900 uppercase flex items-center gap-2">
              <UserX size={14} /> {editId ? 'Edit Absent Record' : 'Mark Trainee Absent'}
            </h2>
            <button onClick={() => { setShowForm(false); setEditId(null); setFormData(getEmptyForm()); }}
              className="text-slate-500 hover:text-red-600">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Trainee Select */}
              <div className="md:col-span-2">
                <label className={labelCls}>Select Trainee *</label>
                <select required value={formData.traineeId}
                  onChange={e => handleTraineeSelect(e.target.value)}
                  className={inputCls}>
                  <option value="">-- Trainee Select Karo --</option>
                  {trainees.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.chestNo || 'XX'} — {t.name} ({t.platoon || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div className="md:col-span-2">
                <label className={labelCls}>Absence Type *</label>
                <select required value={formData.type}
                  onChange={e => setFormData(p => ({ ...p, type: e.target.value as any }))}
                  className={`${inputCls} font-bold`}>
                  {ABSENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div>
                <label className={labelCls}>From Date *</label>
                <input required type="date" value={formData.fromDate}
                  onChange={e => setFormData(p => ({ ...p, fromDate: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>To Date (Expected Return)</label>
                <input type="date" value={formData.toDate}
                  onChange={e => setFormData(p => ({ ...p, toDate: e.target.value }))}
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Days</label>
                <input readOnly value={`${calcDays(formData.fromDate, formData.toDate)} Days`}
                  className={`${inputCls} bg-slate-50 font-bold`} />
              </div>

              {/* Reason */}
              <div>
                <label className={labelCls}>Reason *</label>
                <input required type="text" value={formData.reason}
                  onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
                  className={inputCls} placeholder="e.g. Fever, Family Emergency..." />
              </div>

              <div className="md:col-span-4">
                <label className={labelCls}>Remarks</label>
                <input type="text" value={formData.remarks}
                  onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))}
                  className={inputCls} placeholder="Additional notes..." />
              </div>
            </div>

            {/* Selected trainee info */}
            {formData.traineeName && (
              <div className="bg-blue-50 border border-blue-200 p-3 flex items-center gap-4">
                <span className="text-[10px] font-black text-blue-900 uppercase">Selected:</span>
                <span className="font-bold text-slate-800">{formData.traineeName}</span>
                <span className="font-mono text-[10px]">Chest: {formData.chestNo || '—'}</span>
                <span className="font-mono text-[10px]">Reg: {formData.regNo || '—'}</span>
                <span className="text-[10px]">Platoon: {formData.platoon || '—'}</span>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button type="submit" disabled={saving}
                className="bg-red-700 text-white px-6 py-2 text-xs font-bold uppercase hover:bg-red-800 flex items-center gap-2 disabled:opacity-50">
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  : <><Save size={14} /> {editId ? 'Update Record' : 'Save Absent Record'}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── FILTERS ── */}
      {hasBatch && (
        <div className="flex items-center justify-between bg-white border border-slate-300 px-3 py-2 shadow-flat flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Type:</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="text-xs border border-slate-300 px-2 py-1 focus:outline-none">
                <option value="All">All Types</option>
                {ABSENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label.split(' (')[0]}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Status:</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="text-xs border border-slate-300 px-2 py-1 focus:outline-none">
                <option value="All">All</option>
                <option value="Active">Active (Abhi Absent)</option>
                <option value="Returned">Returned (Wapas Aaya)</option>
              </select>
            </div>
            <div className="relative">
              <input type="text" placeholder="Search name/chest..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="text-xs border border-slate-300 pl-7 pr-2 py-1 focus:outline-none w-48" />
              <Search size={12} className="absolute left-2 top-1.5 text-slate-400" />
            </div>
          </div>
          <ReportButton />
          <span className="text-[10px] font-bold text-slate-500 bg-white border px-2 py-0.5">
            {filteredRecords.length} Records
          </span>
        </div>
      )}

      {/* ── RECORDS TABLE ── */}
      {hasBatch && (
        <div className="bg-white border border-slate-300 shadow-flat flex-1 min-h-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 size={24} className="mx-auto animate-spin text-military-500" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500 uppercase">
                {filterStatus === 'Active' ? 'Sab Present Hain — All Clear!' : 'Koi record nahi mila'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    {['S.No','Chest','Name','Platoon','Type','Reason','From','To','Days','Status','Actions'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((r, idx) => {
                    const typeInfo = getTypeInfo(r.type);
                    return (
                      <tr key={r.id} className={`hover:bg-slate-50 ${
                        r.status === 'Active' ? 'bg-red-50/20' : ''
                      }`}>
                        <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-bold text-military-800">{r.chestNo || '—'}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{r.traineeName}</td>
                        <td className="px-3 py-2 text-slate-600">{r.platoon || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-[9px] font-bold border ${typeInfo.color}`}>
                            {typeInfo.label.split(' (')[0]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-[10px] max-w-[150px] truncate">{r.reason || '—'}</td>
                        <td className="px-3 py-2 font-mono text-[10px]">{r.fromDate}</td>
                        <td className="px-3 py-2 font-mono text-[10px]">{r.toDate}</td>
                        <td className="px-3 py-2 font-bold text-red-700">{r.totalDays || 1}d</td>
                        <td className="px-3 py-2">
                          {r.status === 'Active' ? (
                            <span className="bg-red-600 text-white px-2 py-0.5 text-[9px] font-bold">ABSENT</span>
                          ) : (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 text-[9px] font-bold border border-green-200">RETURNED</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {r.status === 'Active' && (
                              <button onClick={() => handleReturn(r)}
                                className="bg-green-100 text-green-700 px-2 py-1 text-[9px] font-bold hover:bg-green-200"
                                title="Mark Returned">
                                ✅
                              </button>
                            )}
                            {r.source !== 'medical' && (
                              <button onClick={() => handleEdit(r)}
                                className="bg-blue-50 text-blue-600 px-2 py-1 text-[9px] font-bold hover:bg-blue-100"
                                title="Edit">
                                <Edit3 size={10} />
                              </button>
                            )}
                            <button onClick={() => handleDelete(r.id!)}
                              className="bg-red-50 text-red-600 px-2 py-1 text-[9px] font-bold hover:bg-red-100"
                              title="Delete">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};