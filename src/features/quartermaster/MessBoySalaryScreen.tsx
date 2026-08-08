// D:\ALL PROJECTS\BSF COYs\frontend\src\features\quartermaster\MessBoySalaryScreen.tsx

import React, { useState, useCallback, useEffect } from 'react';
import {
  Users, Calculator, CheckCircle2, AlertTriangle,
  Loader2, X, Trash2, Save, Info,
  Calendar, RefreshCw, Edit2, UserPlus,
  Check, Eye, Lock, Wallet
} from 'lucide-react';
import {
  collection, addDoc, getDocs, serverTimestamp,
  query, orderBy, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';
import { scopeVisible } from '../../utils/batchScope';
import {
  PaymentModeSelector,
  PaymentModeBadge,
  validatePaymentMode,
  getPaymentRef
} from '../shared/PaymentModeSelector';
import type { PaymentMode } from '../shared/PaymentModeSelector';
import {
  formatCurrency, formatMonth, generateMonthOptions
} from '../finance/shared/utils';
import { ReportButton } from '../../components/common/ReportButton';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface MessBoy {
  id:       string;
  name:     string;
  isActive: boolean;
}

interface AttendanceEntry {
  boyId:  string;
  name:   string;
  days:   number;
  amount: number;
}

interface SalaryRecord {
  id:            string;
  month:         string;
  monthName:     string;
  totalBoys:     number;
  totalDays:     number;
  ratePerDay:    number;
  totalSalary:   number;
  boys:          AttendanceEntry[];
  recordedBy:    string;
  status:        'Paid' | 'Pending';
  paidDate?:     string;
  fundKey?:      string;
  fundLabel?:    string;
  paymentMode?:  string;
  checkNumber?:  string;
  transactionId?:string;
  expenseId?:    string;
}

interface FundOption {
  key:             string;
  label:           string;
  emoji:           string;
  totalCollection: number;
  actuallyPaid:    number;
  vendorDue:       number;
  transferredOut:  number;  // NEW
  balance:         number;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const calcActuallyPaid = (expList: any[]): number =>
  expList.reduce((s, e) => {
    if (e.vendorId) return s + Number(e.paidAmount ?? 0);
    return s + Number(e.amount ?? 0);
  }, 0);

const calcVendorDue = (expList: any[]): number =>
  expList.reduce((s, e) => s + Number(e.dueAmount ?? 0), 0);

// ═════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════
export const MessBoySalaryScreen: React.FC = () => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();
  const recordedBy = user?.email ?? 'Quarter Master';

  // ── DATA ──
  const [messBoys,    setMessBoys]    = useState<MessBoy[]>([]);
  const [records,     setRecords]     = useState<SalaryRecord[]>([]);
  const [funds,       setFunds]       = useState<FundOption[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── FORM ──
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [ratePerDay, setRatePerDay] = useState(350);
  const [attendance, setAttendance] = useState<Record<string, number>>({});
  const [loading,    setLoading]    = useState(false);
  const [success,    setSuccess]    = useState('');
  const [error,      setError]      = useState('');

  // ── FUND SELECTION ──
  const [selectedFundKey, setSelectedFundKey] = useState('general_fund');  // Default General Fund
  const [payMode,         setPayMode]         = useState<PaymentMode>('Cash');
  const [checkNumber,     setCheckNumber]     = useState('');
  const [transactionId,   setTransactionId]   = useState('');

  // ── BOY MANAGEMENT ──
  const [newBoyName,    setNewBoyName]    = useState('');
  const [editingBoyId,  setEditingBoyId]  = useState<string | null>(null);
  const [editingName,   setEditingName]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState<MessBoy | null>(null);
  const [deleteRecord,  setDeleteRecord]  = useState<SalaryRecord | null>(null);

  // ── HISTORY ──
  const [viewingRecord, setViewingRecord] = useState<SalaryRecord | null>(null);

  const monthOptions = generateMonthOptions();

  // ─────────────────────────────────────────
  // BUILD FUND OPTIONS — 4 FUNDS + Transfer Out
  // ─────────────────────────────────────────
  const buildFunds = async () => {
    const fundList: FundOption[] = [];

    // ── Transfer records ──
    let transferList: any[] = [];
    try {
      const transferSnap = await getDocs(collection(db, 'fund_transfers'));
      transferList = transferSnap.docs.map(d => d.data()).filter(scopeVisible); // scope guard
    } catch {
      transferList = [];
    }

    const getTransferredOut = (fundKey: string) =>
      transferList
        .filter(t => t.fromFundKey === fundKey)
        .reduce((s, t) => s + Number(t.amount ?? 0), 0);

    // ── MESS FUND ──
    try {
      const mcSnap = await getDocs(collection(db, 'mess_fund_collections'));
      const meSnap = await getDocs(collection(db, 'mess_fund_expenses'));
      let mc = 0;
      const meList: any[] = [];

      mcSnap.forEach(d => { const _dd = d.data(); if (!scopeVisible(_dd)) return; mc += Number(_dd.amount ?? 0); });
      meSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        meList.push({
          amount:     Number(data.amount     ?? 0),
          vendorId:   data.vendorId ?? data.linkedVendorId ?? '',
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount:  Number(data.dueAmount  ?? 0),
        });
      });

      const mActuallyPaid  = calcActuallyPaid(meList);
      const mVendorDue     = calcVendorDue(meList);
      const mTransferred   = getTransferredOut('mess_fund');

      fundList.push({
        key:             'mess_fund',
        label:           'Mess Fund',
        emoji:           '🍽️',
        totalCollection: mc,
        actuallyPaid:    mActuallyPaid,
        vendorDue:       mVendorDue,
        transferredOut:  mTransferred,
        balance:         mc - mActuallyPaid - mTransferred,
      });
    } catch { /* ignore */ }

    // ── TRAINING ESSENTIALS FUND ──
    try {
      const tcSnap = await getDocs(collection(db, 'training_fund_collections'));
      const teSnap = await getDocs(collection(db, 'training_fund_expenses'));
      let tc = 0;
      const teList: any[] = [];

      tcSnap.forEach(d => { const _dd = d.data(); if (!scopeVisible(_dd)) return; tc += Number(_dd.amount ?? 0); });
      teSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        teList.push({
          amount:     Number(data.amount     ?? 0),
          vendorId:   data.vendorId ?? data.linkedVendorId ?? '',
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount:  Number(data.dueAmount  ?? 0),
        });
      });

      const tActuallyPaid  = calcActuallyPaid(teList);
      const tVendorDue     = calcVendorDue(teList);
      const tTransferred   = getTransferredOut('training_fund');

      fundList.push({
        key:             'training_fund',
        label:           'Training Essentials Fund',
        emoji:           '🎓',
        totalCollection: tc,
        actuallyPaid:    tActuallyPaid,
        vendorDue:       tVendorDue,
        transferredOut:  tTransferred,
        balance:         tc - tActuallyPaid - tTransferred,
      });
    } catch { /* ignore */ }

    // ── COMPANY ASSETS FUND ──
    try {
      const acSnap = await getDocs(collection(db, 'company_assets_collections'));
      const aeSnap = await getDocs(collection(db, 'company_assets_expenses'));
      let ac = 0;
      const aeList: any[] = [];

      acSnap.forEach(d => { const _dd = d.data(); if (!scopeVisible(_dd)) return; ac += Number(_dd.amount ?? 0); });
      aeSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        aeList.push({
          amount:     Number(data.amount     ?? 0),
          vendorId:   data.vendorId ?? data.linkedVendorId ?? '',
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount:  Number(data.dueAmount  ?? 0),
        });
      });

      const aActuallyPaid  = calcActuallyPaid(aeList);
      const aVendorDue     = calcVendorDue(aeList);
      const aTransferred   = getTransferredOut('company_assets_fund');

      fundList.push({
        key:             'company_assets_fund',
        label:           'Company Assets Fund',
        emoji:           '🏛️',
        totalCollection: ac,
        actuallyPaid:    aActuallyPaid,
        vendorDue:       aVendorDue,
        transferredOut:  aTransferred,
        balance:         ac - aActuallyPaid - aTransferred,
      });
    } catch { /* ignore */ }

    // ── GENERAL FUND ── (NEW collection names)
    try {
      const gcSnap = await getDocs(collection(db, 'general_fund_collections'));
      const geSnap = await getDocs(collection(db, 'general_fund_expenses'));
      let gc = 0;
      const geList: any[] = [];

      gcSnap.forEach(d => { const _dd = d.data(); if (!scopeVisible(_dd)) return; gc += Number(_dd.amount ?? 0); });
      geSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        geList.push({
          amount:     Number(data.amount     ?? 0),
          vendorId:   data.vendorId ?? '',
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount:  Number(data.dueAmount  ?? 0),
        });
      });

      const gActuallyPaid = calcActuallyPaid(geList);
      const gVendorDue    = calcVendorDue(geList);

      fundList.push({
        key:             'general_fund',
        label:           'General Fund',
        emoji:           '💰',
        totalCollection: gc,
        actuallyPaid:    gActuallyPaid,
        vendorDue:       gVendorDue,
        transferredOut:  0,
        balance:         gc - gActuallyPaid,
      });
    } catch { /* ignore */ }

    setFunds(fundList);
  };

  // ─────────────────────────────────────────
  // FETCH ALL DATA
  // ─────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      // Mess Boys
      const boysSnap = await getDocs(collection(db, 'mess_boys'));
      const boysList: MessBoy[] = [];
      boysSnap.forEach(d => {
        const data = d.data();
        if (data.isActive !== false) {
          boysList.push({ id: d.id, name: data.name ?? '', isActive: true });
        }
      });
      boysList.sort((a, b) => a.name.localeCompare(b.name));
      setMessBoys(boysList);

      // Default attendance
      const defAtt: Record<string, number> = {};
      boysList.forEach(b => { defAtt[b.id] = 30; });
      setAttendance(prev => ({ ...defAtt, ...prev }));

      // Salary Records
      const recSnap = await getDocs(
        query(collection(db, 'mess_boy_salaries'), orderBy('month', 'desc'))
      );
      const recList: SalaryRecord[] = [];
      recSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        recList.push({
          id:            d.id,
          month:         data.month         ?? '',
          monthName:     data.monthName     ?? formatMonth(data.month),
          totalBoys:     data.totalBoys     ?? 0,
          totalDays:     data.totalDays     ?? 0,
          ratePerDay:    data.ratePerDay    ?? 350,
          totalSalary:   data.totalSalary   ?? 0,
          boys:          data.boys          ?? [],
          recordedBy:    data.recordedBy    ?? '',
          status:        data.status        ?? 'Paid',
          paidDate:      data.paidDate      ?? '',
          fundKey:       data.fundKey       ?? '',
          fundLabel:     data.fundLabel     ?? '',
          paymentMode:   data.paymentMode   ?? '',
          checkNumber:   data.checkNumber   ?? '',
          transactionId: data.transactionId ?? '',
          expenseId:     data.expenseId     ?? '',
        });
      });
      setRecords(recList);

      await buildFunds();

    } catch (err) {
      console.error(err);
      setError('Data load nahi hua');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ── COMPUTED ──
  const selectedMonthRecord = records.find(r => r.month === selectedMonth);
  const isMonthLocked       = !!selectedMonthRecord;

  const boyAttendanceList = messBoys.map(boy => ({
    ...boy,
    days:   attendance[boy.id] ?? 30,
    amount: (attendance[boy.id] ?? 30) * ratePerDay,
  }));

  const totalSalary     = boyAttendanceList.reduce((s, b) => s + b.amount, 0);
  const totalDays       = boyAttendanceList.reduce((s, b) => s + b.days,   0);
  const selectedFund    = funds.find(f => f.key === selectedFundKey);
  const totalSalaryPaid = records.reduce((s, r) => s + r.totalSalary, 0);

  // ─────────────────────────────────────────
  // BOY MANAGEMENT
  // ─────────────────────────────────────────
  const handleAddBoy = async () => {
    if (!newBoyName.trim()) { setError('Boy ka naam enter karo'); return; }
    const exists = messBoys.find(
      b => b.name.toLowerCase() === newBoyName.trim().toLowerCase()
    );
    if (exists) { setError(`"${newBoyName}" pehle se exist karta hai`); return; }
    try {
      await addDoc(collection(db, 'mess_boys'), {
        name:      newBoyName.trim(),
        isActive:  true,
        createdAt: serverTimestamp(),
      });
      setSuccess(`${newBoyName} add ho gaya!`);
      setNewBoyName('');
      await fetchAllData();
    } catch { setError('Boy add nahi hua'); }
  };

  const handleEditBoy = async (boyId: string) => {
    if (!editingName.trim()) return;
    try {
      await updateDoc(doc(db, 'mess_boys', boyId), {
        name:      editingName.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingBoyId(null); setEditingName('');
      setSuccess('Naam update ho gaya');
      await fetchAllData();
    } catch { setError('Update nahi hua'); }
  };

  const handleDeleteBoy = async () => {
    if (!confirmDelete) return;
    try {
      await updateDoc(doc(db, 'mess_boys', confirmDelete.id), {
        isActive:  false,
        deletedAt: serverTimestamp(),
      });
      setConfirmDelete(null);
      setSuccess(`${confirmDelete.name} remove ho gaya`);
      await fetchAllData();
    } catch { setError('Delete nahi hua'); }
  };

  const updateDays = (boyId: string, days: number) => {
    setAttendance(prev => ({
      ...prev,
      [boyId]: Math.max(0, Math.min(31, days)),
    }));
  };

  const setAllDays = (days: number) => {
    const updated: Record<string, number> = {};
    messBoys.forEach(b => { updated[b.id] = days; });
    setAttendance(updated);
  };

  // ─────────────────────────────────────────
  // DELETE SALARY RECORD
  // ─────────────────────────────────────────
  const handleDeleteRecord = async () => {
    if (!deleteRecord) return;
    try {
      await deleteDoc(doc(db, 'mess_boy_salaries', deleteRecord.id));

      if (deleteRecord.expenseId) {
        const expCol =
          deleteRecord.fundKey === 'mess_fund'          ? 'mess_fund_expenses' :
          deleteRecord.fundKey === 'training_fund'      ? 'training_fund_expenses' :
          deleteRecord.fundKey === 'company_assets_fund' ? 'company_assets_expenses' :
          deleteRecord.fundKey === 'general_fund'       ? 'general_fund_expenses' :
          'general_fund_expenses';
        try {
          await deleteDoc(doc(db, expCol, deleteRecord.expenseId));
        } catch { /* ignore if already deleted */ }
      }

      setDeleteRecord(null);
      setViewingRecord(null);
      setSuccess(
        `${deleteRecord.monthName} salary record delete ho gaya. Month unlock hua.`
      );
      await fetchAllData();
    } catch { setError('Delete nahi hua'); }
  };

  // ─────────────────────────────────────────
  // SAVE SALARY
  // ─────────────────────────────────────────
  const handleSave = async () => {
    if (isMonthLocked) {
      setError(`${formatMonth(selectedMonth)} ki salary pehle se paid hai`); return;
    }
    if (messBoys.length === 0) { setError('Pehle mess boys add karo'); return; }
    if (totalSalary === 0)     { setError('Kam se kam ek boy ke din enter karo'); return; }
    if (!selectedFundKey)      { setError('Fund select karo'); return; }

    const payErr = validatePaymentMode(payMode, checkNumber, transactionId);
    if (payErr) { setError(payErr); return; }

    if (selectedFund && totalSalary > selectedFund.balance) {
      setError(
        `${selectedFund.label} mein sirf ${formatCurrency(selectedFund.balance)} available hai. ` +
        `Salary ${formatCurrency(totalSalary)} se zyada hai.`
      );
      return;
    }

    setLoading(true); setError(''); setSuccess('');
    try {
      const boyEntries: AttendanceEntry[] = boyAttendanceList
        .filter(b => b.days > 0)
        .map(b => ({ boyId: b.id, name: b.name, days: b.days, amount: b.amount }));

      const monthLabel = formatMonth(selectedMonth);
      const fund       = funds.find(f => f.key === selectedFundKey)!;
      const nowISO     = new Date().toISOString();
      const payRef     = getPaymentRef(payMode, checkNumber, transactionId);

      // STEP 1: Salary record
      const salaryRef = await addDoc(collection(db, 'mess_boy_salaries'), {
        month:         selectedMonth,
        monthName:     monthLabel,
        totalBoys:     boyEntries.length,
        totalDays,
        ratePerDay,
        totalSalary,
        boys:          boyEntries,
        recordedBy,
        status:        'Paid',
        paidDate:      nowISO,
        fundKey:       selectedFundKey,
        fundLabel:     fund.label,
        batchId:        activeBatch?.id ?? '',
        paymentMode:   payMode,
        checkNumber:   payMode === 'Check' ? checkNumber : '',
        transactionId: payRef,
        createdAt:     serverTimestamp(),
      });

      // STEP 2: Fund expense
      const expCollection =
        selectedFundKey === 'mess_fund'          ? 'mess_fund_expenses' :
        selectedFundKey === 'training_fund'      ? 'training_fund_expenses' :
        selectedFundKey === 'company_assets_fund' ? 'company_assets_expenses' :
        'general_fund_expenses';

      const expRef = await addDoc(collection(db, expCollection), {
        amount:         totalSalary,
        paidAmount:     totalSalary,
        dueAmount:      0,
        vendorId:       '',
        category:       'mess_boy_salary',
        categoryLabel:  'Mess Boy Salary',
        vendor:         `${boyEntries.length} Mess Boys`,
        itemName:       'Mess Boy Salary',
        expenseType:    'Mess Boy Salary',
        remarks:        `Salary — ${monthLabel} · ${boyEntries.length} boys · ₹${ratePerDay}/day`,
        paymentMode:    payMode,
        checkNumber:    payMode === 'Check' ? checkNumber : '',
        transactionId:  payRef,
        billStatus:     'Received',
        assetStatus:    'Active',
        linkedSalaryId: salaryRef.id,
        batchId:         activeBatch?.id ?? '',
        recordedBy,
        date:           nowISO,
        createdAt:      serverTimestamp(),
      });

      // STEP 3: Link expense ID
      await updateDoc(doc(db, 'mess_boy_salaries', salaryRef.id), {
        expenseId: expRef.id,
      });

      setSuccess(
        `✓ ${monthLabel} salary paid from ${fund.label}! ` +
        `Total: ${formatCurrency(totalSalary)} via ${payMode}.`
      );
      setCheckNumber(''); setTransactionId('');
      await fetchAllData();
    } catch (err) {
      console.error(err);
      setError('Save karne mein error. Retry karo.');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-slate-700 pb-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
            Mess Boy Salary
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Boys List · Month-wise Salary · 4 Funds Available · Auto Expense Entry
          </p>
        </div>
        <button onClick={fetchAllData} disabled={dataLoading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
          <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} /> Refresh
        </button>
        <ReportButton />
      </div>

      {/* ALERTS */}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600" /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Boys', value: messBoys.length,                color: 'text-slate-700', bg: 'bg-white' },
          { label: 'Records',    value: records.length,                  color: 'text-blue-700',  bg: 'bg-blue-50' },
          { label: 'Total Paid', value: formatCurrency(totalSalaryPaid), color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'This Month', value: formatCurrency(totalSalary),     color: 'text-slate-700', bg: 'bg-slate-50' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border border-slate-200 rounded-xl p-4 shadow-sm`}>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{c.label}</p>
            <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* INFO BANNER */}
      <div className="bg-amber-50 border border-amber-200 rounded px-4 py-2.5 flex items-start gap-2">
        <Info size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-amber-700 space-y-0.5">
          <p><strong>💡 Tip:</strong> Salary ke liye <strong>General Fund</strong> use karna best hai. Pehle Mess/Training/Assets se General Fund me transfer karo, fir wahan se salary do.</p>
          <p>Sab funds (Mess, Training, Company Assets, General) se salary di ja sakti hai — jahan balance ho.</p>
        </div>
      </div>

      {/* MONTH STATUS GRID */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <p className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center gap-1.5">
          <Calendar size={11} /> Month-wise Payment Status
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {monthOptions.map(m => {
            const rec       = records.find(r => r.month === m.value);
            const isCurrent = m.value === selectedMonth;
            return (
              <button key={m.value} onClick={() => setSelectedMonth(m.value)}
                className={`p-2 rounded border-2 text-left transition-all ${
                  isCurrent
                    ? 'border-slate-700 bg-slate-100'
                    : rec
                    ? 'border-green-300 bg-green-50 hover:bg-green-100'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}>
                <p className="text-[10px] font-black text-slate-700 truncate">
                  {m.label.split(' ')[0]}
                </p>
                <p className="text-[9px] text-slate-400">{m.label.split(' ')[1]}</p>
                {rec ? (
                  <div className="mt-1 flex items-center gap-0.5 text-[9px] font-black text-green-600">
                    <CheckCircle2 size={9} /> {formatCurrency(rec.totalSalary)}
                  </div>
                ) : (
                  <div className="mt-1 text-[9px] font-bold text-amber-600">⚠ Pending</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: FORM */}
        <div className="lg:col-span-2 space-y-4">

          {/* Settings */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Month *
                </label>
                <select value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className={`w-full border px-3 py-2 text-sm font-bold rounded focus:outline-none ${
                    isMonthLocked
                      ? 'bg-green-50 border-green-400 text-green-800'
                      : 'border-slate-300'
                  }`}>
                  {monthOptions.map(m => {
                    const isPaid = records.find(r => r.month === m.value);
                    return (
                      <option key={m.value} value={m.value}>
                        {m.label} {isPaid ? '✓ PAID' : '⚠ Pending'}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Rate/Day (₹)
                </label>
                <input type="number" min={1} value={ratePerDay}
                  onChange={e => setRatePerDay(Number(e.target.value))}
                  disabled={isMonthLocked}
                  className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none disabled:bg-slate-50" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Quick Set Days
                </label>
                <div className="flex gap-1">
                  {[28, 29, 30, 31].map(d => (
                    <button key={d} onClick={() => setAllDays(d)}
                      disabled={isMonthLocked}
                      className="flex-1 border border-slate-300 hover:bg-slate-100 text-xs font-bold py-2 rounded disabled:opacity-40">
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isMonthLocked && selectedMonthRecord && (
              <div className="mt-3 bg-green-50 border border-green-300 rounded-lg p-2.5 flex items-center gap-2">
                <Lock size={12} className="text-green-700" />
                <p className="text-[11px] text-green-800 font-semibold">
                  {formatMonth(selectedMonth)} ki salary{' '}
                  <strong>{formatCurrency(selectedMonthRecord.totalSalary)}</strong> already paid
                  from <strong>{selectedMonthRecord.fundLabel || 'Fund'}</strong>.
                </p>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setViewingRecord(selectedMonthRecord)}
                    className="flex items-center gap-1 text-[10px] font-bold text-green-700 border border-green-400 px-2 py-1 hover:bg-green-100 rounded">
                    <Eye size={10} /> Details
                  </button>
                  <button onClick={() => setDeleteRecord(selectedMonthRecord)}
                    className="flex items-center gap-1 text-[10px] font-bold text-red-600 border border-red-300 px-2 py-1 hover:bg-red-50 rounded">
                    <Trash2 size={10} /> Unlock
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ADD BOY */}
          {!isMonthLocked && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex gap-2">
                <input type="text" value={newBoyName}
                  onChange={e => setNewBoyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddBoy()}
                  placeholder="Naye Mess Boy ka naam..."
                  className="flex-1 border border-blue-300 px-3 py-2 text-xs font-bold rounded focus:outline-none focus:border-blue-600" />
                <button onClick={handleAddBoy} disabled={!newBoyName.trim()}
                  className="bg-blue-600 text-white px-4 py-2 text-xs font-black uppercase hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5 rounded">
                  <UserPlus size={12} /> Add Boy
                </button>
              </div>
              <p className="text-[10px] text-blue-700 mt-1.5 flex items-center gap-1">
                <Info size={10} /> Boys ek baar add karo — har month automatically aayenge
              </p>
            </div>
          )}

          {/* BOYS LIST */}
          <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1.5">
                <Users size={12} /> Mess Boys ({messBoys.length})
              </p>
              <p className="text-[10px] font-bold text-slate-500">
                Total Days: <span className="font-black text-slate-700">{totalDays}</span>
              </p>
            </div>

            {messBoys.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users size={36} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm font-bold">Koi Mess Boy nahi</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 border-b border-slate-200 text-[9px] font-black uppercase text-slate-500">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">Naam</div>
                  <div className="col-span-3 text-center">Kitne Din</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1 text-center">Act</div>
                </div>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {boyAttendanceList.map((boy, idx) => {
                    const isEditing = editingBoyId === boy.id;
                    return (
                      <div key={boy.id}
                        className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50/50">
                        <div className="col-span-1">
                          <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                        </div>
                        <div className="col-span-5">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input type="text" value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleEditBoy(boy.id)}
                                autoFocus
                                className="flex-1 border border-blue-400 px-2 py-1 text-xs font-bold rounded focus:outline-none" />
                              <button onClick={() => handleEditBoy(boy.id)}
                                className="bg-green-600 text-white px-2 rounded hover:bg-green-700">
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => { setEditingBoyId(null); setEditingName(''); }}
                                className="bg-slate-300 text-slate-700 px-2 rounded">
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-slate-800">{boy.name}</p>
                          )}
                        </div>
                        <div className="col-span-3">
                          <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                            <button
                              onClick={() => updateDays(boy.id, boy.days - 1)}
                              disabled={isMonthLocked}
                              className="w-7 h-7 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold disabled:opacity-30">
                              −
                            </button>
                            <input type="number" min={0} max={31} value={boy.days}
                              onChange={e => updateDays(boy.id, Number(e.target.value))}
                              disabled={isMonthLocked}
                              className="flex-1 h-7 text-center text-xs font-black border-x border-slate-300 focus:outline-none disabled:bg-slate-50" />
                            <button
                              onClick={() => updateDays(boy.id, boy.days + 1)}
                              disabled={isMonthLocked}
                              className="w-7 h-7 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold disabled:opacity-30">
                              +
                            </button>
                          </div>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className={`text-[11px] font-black ${
                            boy.amount > 0 ? 'text-slate-800' : 'text-slate-300'
                          }`}>
                            ₹{boy.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="col-span-1 flex justify-center gap-0.5">
                          {!isEditing && !isMonthLocked && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingBoyId(boy.id);
                                  setEditingName(boy.name);
                                }}
                                className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50">
                                <Edit2 size={11} />
                              </button>
                              <button onClick={() => setConfirmDelete(boy)}
                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* FUND SELECTION + PAYMENT MODE */}
          {!isMonthLocked && (
            <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <Wallet size={14} /> Fund Select & Payment Mode
              </h3>

              {/* Fund Cards — 4 FUNDS */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                  Kahan se salary deni hai? * (4 funds available)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {funds.map(fund => (
                    <button key={fund.key} type="button"
                      onClick={() => setSelectedFundKey(fund.key)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedFundKey === fund.key
                          ? 'border-slate-700 bg-slate-50 shadow-md'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{fund.emoji}</span>
                        <p className="text-[10px] font-black text-slate-800">{fund.label}</p>
                      </div>
                      <p className={`text-sm font-black ${
                        fund.balance >= 0 ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {formatCurrency(fund.balance)}
                      </p>
                      <p className="text-[8px] text-slate-400 leading-tight">
                        In: {formatCurrency(fund.totalCollection)}
                      </p>
                      <p className="text-[8px] text-slate-400 leading-tight">
                        Paid: {formatCurrency(fund.actuallyPaid)}
                      </p>
                      {fund.transferredOut > 0 && (
                        <p className="text-[8px] text-purple-600 leading-tight">
                          🔄 {formatCurrency(fund.transferredOut)}
                        </p>
                      )}
                      {fund.vendorDue > 0 && (
                        <p className="text-[8px] text-amber-600 leading-tight">
                          Due: {formatCurrency(fund.vendorDue)}
                        </p>
                      )}
                      {selectedFundKey === fund.key && (
                        <div className="mt-1">
                          <span className="text-[9px] font-black text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">
                            ✓ Selected
                          </span>
                        </div>
                      )}
                      {selectedFundKey === fund.key && totalSalary > fund.balance && (
                        <p className="text-[9px] font-black text-red-600 mt-1 flex items-center gap-0.5">
                          <AlertTriangle size={9} /> Insufficient!
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Mode */}
              <PaymentModeSelector
                mode={payMode} setMode={setPayMode}
                checkNumber={checkNumber} setCheckNumber={setCheckNumber}
                transactionId={transactionId} setTransactionId={setTransactionId}
              />

              {/* Salary Preview */}
              {totalSalary > 0 && selectedFund && (
                <div className={`rounded-xl p-3 border ${
                  totalSalary > selectedFund.balance
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {formatMonth(selectedMonth)} Salary
                      </p>
                      <p className="text-[10px] text-slate-500">
                        from {selectedFund.label} via {payMode}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Balance after payment:{' '}
                        <strong className={
                          selectedFund.balance - totalSalary >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }>
                          {formatCurrency(selectedFund.balance - totalSalary)}
                        </strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-800">
                        {formatCurrency(totalSalary)}
                      </p>
                      <p className={`text-[10px] font-bold ${
                        totalSalary > selectedFund.balance
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        {totalSalary > selectedFund.balance
                          ? '⚠ Insufficient Balance'
                          : '✓ Sufficient Balance'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 flex items-start gap-2">
                <Info size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700">
                  Salary save karne par selected fund mein <strong>expense entry</strong> automatically
                  add hogi. Fund balance accordingly update ho jayega.
                </p>
              </div>
            </div>
          )}

          {/* SAVE BUTTON */}
          {!isMonthLocked && (
            <button onClick={handleSave}
              disabled={
                loading || totalSalary === 0 ||
                messBoys.length === 0 || !selectedFundKey
              }
              className="w-full bg-slate-800 text-white py-3 text-xs font-black uppercase hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center gap-2 rounded-xl">
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                : <><Save size={14} /> Pay {formatMonth(selectedMonth)} Salary — {formatCurrency(totalSalary)}</>
              }
            </button>
          )}
        </div>

        {/* RIGHT: PREVIEW + HISTORY */}
        <div className="space-y-4">

          {/* Summary Card */}
          <div className={`text-white rounded-xl p-4 shadow-sm ${
            isMonthLocked ? 'bg-green-700' : 'bg-slate-800'
          }`}>
            <p className="text-[10px] font-black uppercase text-white/60 mb-3 flex items-center gap-1">
              {isMonthLocked ? <Lock size={11} /> : <Calculator size={11} />}
              {isMonthLocked ? 'Already Paid' : 'Salary Preview'}
            </p>
            <div className="space-y-2 text-xs mb-4">
              {[
                { l: 'Month',      v: formatMonth(selectedMonth) },
                { l: 'Boys',       v: String(messBoys.length) },
                { l: 'Total Days', v: String(isMonthLocked ? selectedMonthRecord?.totalDays : totalDays) },
                { l: 'Rate/Day',   v: `₹${isMonthLocked ? selectedMonthRecord?.ratePerDay : ratePerDay}` },
                { l: 'Fund',       v: isMonthLocked ? (selectedMonthRecord?.fundLabel ?? '—') : (selectedFund?.label ?? '—') },
                { l: 'Mode',       v: isMonthLocked ? (selectedMonthRecord?.paymentMode ?? '—') : payMode },
              ].map(({ l, v }) => (
                <div key={l} className="flex justify-between">
                  <span className="text-white/60">{l}:</span>
                  <span className="font-black">{v}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/20 pt-3">
              <p className="text-[10px] text-white/50 uppercase font-bold">Total Salary</p>
              <p className="text-3xl font-black text-white mt-0.5">
                {formatCurrency(
                  isMonthLocked
                    ? (selectedMonthRecord?.totalSalary ?? 0)
                    : totalSalary
                )}
              </p>
            </div>
          </div>

          {/* Fund Balances Quick View */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1.5">
                <Wallet size={11} /> All Fund Balances
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {funds.map(f => (
                <div key={f.key} className="px-3 py-2 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{f.emoji}</span>
                    <p className="text-[10px] font-bold text-slate-700">{f.label}</p>
                  </div>
                  <p className={`text-xs font-black ${
                    f.balance >= 0 ? 'text-green-700' : 'text-red-600'
                  }`}>
                    {formatCurrency(f.balance)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] font-black uppercase text-slate-600">
                Payment History ({records.length})
              </p>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {records.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-6">
                  Koi payment history nahi
                </p>
              ) : (
                records.map(rec => (
                  <button key={rec.id} onClick={() => setViewingRecord(rec)}
                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-green-50/50 text-left">
                    <div>
                      <p className="text-xs font-black text-slate-800">{rec.monthName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] text-slate-400">
                          {rec.totalBoys} boys · {rec.fundLabel || 'Fund'}
                        </p>
                        {rec.paymentMode && (
                          <PaymentModeBadge
                            mode={rec.paymentMode}
                            checkNumber={rec.checkNumber}
                            transactionId={rec.transactionId}
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-green-600">
                        {formatCurrency(rec.totalSalary)}
                      </p>
                      <p className="text-[9px] font-bold text-green-500 flex items-center gap-0.5 justify-end">
                        <CheckCircle2 size={8} /> PAID
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW RECORD MODAL */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white shadow-2xl max-w-lg w-full rounded-xl overflow-hidden">
            <div className="bg-green-700 text-white px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase">Salary Record</p>
                <p className="text-sm font-black mt-0.5">{viewingRecord.monthName}</p>
              </div>
              <button onClick={() => setViewingRecord(null)}><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-4 gap-3 bg-slate-50 rounded-lg p-3 text-center">
                {[
                  { l: 'Boys', v: viewingRecord.totalBoys },
                  { l: 'Days', v: viewingRecord.totalDays },
                  { l: 'Rate', v: `₹${viewingRecord.ratePerDay}` },
                  { l: 'Fund', v: viewingRecord.fundLabel ?? '—' },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <p className="text-[9px] uppercase font-bold text-slate-400">{l}</p>
                    <p className="text-sm font-black text-slate-700">{v}</p>
                  </div>
                ))}
              </div>

              {viewingRecord.paymentMode && (
                <div className="bg-blue-50 rounded-lg p-2.5 flex items-center gap-2">
                  <PaymentModeBadge
                    mode={viewingRecord.paymentMode}
                    checkNumber={viewingRecord.checkNumber}
                    transactionId={viewingRecord.transactionId}
                  />
                  <span className="text-[10px] text-slate-500">
                    via {viewingRecord.paymentMode}
                  </span>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 grid grid-cols-12 gap-2 text-[9px] font-black uppercase text-slate-500">
                  <div className="col-span-6">Naam</div>
                  <div className="col-span-3 text-center">Days</div>
                  <div className="col-span-3 text-right">Amount</div>
                </div>
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {viewingRecord.boys.map((b, i) => (
                    <div key={i} className="px-3 py-2 grid grid-cols-12 gap-2 text-xs">
                      <div className="col-span-6 font-bold text-slate-700">{b.name}</div>
                      <div className="col-span-3 text-center">{b.days}</div>
                      <div className="col-span-3 text-right font-black text-slate-800">
                        {formatCurrency(b.amount)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-green-50 px-3 py-2 grid grid-cols-12 gap-2 border-t border-green-200">
                  <div className="col-span-9 font-black text-green-800 text-xs uppercase">
                    Total
                  </div>
                  <div className="col-span-3 text-right font-black text-green-700 text-sm">
                    {formatCurrency(viewingRecord.totalSalary)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>By: <strong>{viewingRecord.recordedBy}</strong></span>
                {viewingRecord.paidDate && (
                  <span>{new Date(viewingRecord.paidDate).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}</span>
                )}
              </div>

              <button onClick={() => setDeleteRecord(viewingRecord)}
                className="w-full flex items-center justify-center gap-2 text-[11px] font-black text-red-600 border border-red-200 py-2 rounded-lg hover:bg-red-50">
                <Trash2 size={12} /> Record Delete karo (Month Unlock hoga)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SALARY CONFIRM */}
      {deleteRecord && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white border shadow-2xl max-w-sm w-full rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-slate-800">
                  {deleteRecord.monthName} salary delete karo?
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Record delete hoga → Month unlock hoga → Linked expense bhi delete hoga.
                  Yeh action reversible nahi hai.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteRecord(null)}
                className="px-4 py-1.5 text-xs font-bold border border-slate-300 hover:bg-slate-50 uppercase rounded">
                Cancel
              </button>
              <button onClick={handleDeleteRecord}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 uppercase rounded">
                Haan, Delete & Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE BOY CONFIRM */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border shadow-2xl max-w-sm w-full rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-slate-800">
                  {confirmDelete.name} ko remove karo?
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  List se hat jayega. Purane records mein naam rahega.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-1.5 text-xs font-bold border border-slate-300 hover:bg-slate-50 uppercase rounded">
                Cancel
              </button>
              <button onClick={handleDeleteBoy}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 uppercase rounded">
                Haan, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessBoySalaryScreen;