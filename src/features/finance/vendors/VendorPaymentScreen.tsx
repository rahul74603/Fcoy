// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\vendors\VendorPaymentScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee, CheckCircle2, AlertTriangle, Loader2,
  X, RefreshCw, ChevronDown, Building2,
  Wallet, Receipt, Eye, Info,
  Clock, Search
} from 'lucide-react';
import {
  collection, getDocs, doc, writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { scopeVisible } from '../../../utils/batchScope';
import { useAuth } from '../../../contexts/AuthContext';
import {
  PaymentModeSelector,
  PaymentModeBadge,
  validatePaymentMode,
  getPaymentRef
} from '../../shared/PaymentModeSelector';
import type { PaymentMode } from '../../shared/PaymentModeSelector';
import { formatCurrency, formatDate } from '../shared/utils';
import type { VendorEntry, Vendor, BillAttachment } from './types';
import BillPreviewModal from '../shared/BillPreviewModal';
import { ReportButton } from '../../../components/common/ReportButton';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface FundOption {
  key:             string;
  label:           string;
  emoji:           string;
  totalCollection: number;
  totalExpense:    number;  // total orders
  actuallyPaid:    number;  // paisa jo gaya
  vendorDue:       number;  // vendor ko dena hai
  balance:         number;  // collection - actuallyPaid
}

interface PaymentRecord {
  id:            string;
  vendorId:      string;
  vendorName:    string;
  entryId:       string;
  categoryKey:   string;
  categoryLabel: string;
  paidAmount:    number;
  fundKey:       string;
  fundLabel:     string;
  paymentMode:   string;
  checkNumber:   string;
  transactionId: string;
  paidBy:        string;
  paidAt:        string;
  remarks:       string;
}

// ─────────────────────────────────────────────
// HELPER — fund expense se actually paid calculate
// ─────────────────────────────────────────────
const calcActuallyPaid = (expList: any[]): number =>
  expList.reduce((s, e) => {
    if (e.vendorId) return s + Number(e.paidAmount ?? 0);
    return s + Number(e.amount ?? 0);
  }, 0);

const calcVendorDue = (expList: any[]): number =>
  expList.reduce((s, e) => s + Number(e.dueAmount ?? 0), 0);

const getFundExpenseCollection = (fundKey: string): string | null => {
  switch (fundKey) {
    case 'mess_fund': return 'mess_fund_expenses';
    case 'company_assets_fund': return 'company_assets_expenses';
    case 'training_fund': return 'training_fund_expenses';
    case 'general_fund': return 'general_fund_expenses';
    default: return null;
  }
};

// ═════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════
export const VendorPaymentScreen: React.FC = () => {
  const { user } = useAuth();
  const paidBy = user?.email ?? 'Quarter Master';

  // ── DATA ──
  const [vendors,  setVendors]  = useState<Vendor[]>([]);
  const [entries,  setEntries]  = useState<VendorEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [funds,    setFunds]    = useState<FundOption[]>([]);
  const [loading,  setLoading]  = useState(true);

  // ── PAYMENT FORM ──
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedEntryId,  setSelectedEntryId]  = useState('');
  const [payAmount,        setPayAmount]         = useState('');
  const [selectedFundKey,  setSelectedFundKey]  = useState('');
  const [payMode,          setPayMode]           = useState<PaymentMode>('Cash');
  const [checkNumber,      setCheckNumber]       = useState('');
  const [transactionId,    setTransactionId]     = useState('');
  const [payRemarks,       setPayRemarks]        = useState('');
  const [payLoading,       setPayLoading]        = useState(false);

  // ── UI ──
  const [successMsg,          setSuccessMsg]          = useState('');
  const [errorMsg,            setErrorMsg]            = useState('');
  const [filterStatus,        setFilterStatus]        = useState<'All' | 'Pending' | 'Partial' | 'Paid'>('Pending');
  const [filterFund,          setFilterFund]          = useState<string>('All');
  const [searchVendor,        setSearchVendor]        = useState('');
  const [previewBill,         setPreviewBill]         = useState<BillAttachment | null>(null);
  const [expandedEntry,       setExpandedEntry]       = useState<string | null>(null);
  const [showPaymentHistory,  setShowPaymentHistory]  = useState(false);

  // ─────────────────────────────────────────
  // FETCH
  // ─────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Vendors
      const vSnap = await getDocs(collection(db, 'vendors'));
      const vList: Vendor[] = [];
      vSnap.forEach(d => {
        const data = d.data();
        if (data.isActive === false) return;
        vList.push({
          id:            d.id,
          name:          data.name          ?? '',
          phone:         data.phone         ?? '',
          address:       data.address       ?? '',
          categoryKey:   data.categoryKey   ?? '',
          categoryLabel: data.categoryLabel ?? '',
          isActive:      true,
          createdAt:     '',
          notes:         '',
        });
      });
      vList.sort((a, b) => a.name.localeCompare(b.name));
      setVendors(vList);

      // Vendor Entries
      const eSnap = await getDocs(collection(db, 'vendor_entries'));
      const eList: VendorEntry[] = [];
      eSnap.forEach(d => {
        const data = d.data();
        eList.push({
          id:            d.id,
          vendorId:      data.vendorId      ?? '',
          vendorName:    data.vendorName    ?? '',
          categoryKey:   data.categoryKey   ?? '',
          categoryLabel: data.categoryLabel ?? '',
          items:         data.items         ?? [],
          totalAmount:   Number(data.totalAmount  ?? 0),
          paidAmount:    Number(data.paidAmount   ?? 0),
          dueAmount:     Number(data.dueAmount    ?? 0),
          status:        data.status        ?? 'Pending',
          entryDate:     data.entryDate     ?? '',
          remarks:       data.remarks       ?? '',
          bills:         data.bills         ?? [],
          createdBy:     data.createdBy     ?? '',
          // ── fundKey preserve karo ──
          ...(data.fundKey ? { fundKey: data.fundKey } : {}),
          // ── linkedExpenseId preserve karo ──
          ...(data.linkedExpenseId ? { linkedExpenseId: data.linkedExpenseId } : {}),
        } as VendorEntry & { fundKey?: string; linkedExpenseId?: string });
      });
      eList.sort((a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
      );
      setEntries(eList);

      // Vendor Payments
      const pSnap = await getDocs(collection(db, 'vendor_payments'));
      const pList: PaymentRecord[] = [];
      pSnap.forEach(d => {
        const data = d.data();
        pList.push({
          id:            d.id,
          vendorId:      data.vendorId      ?? '',
          vendorName:    data.vendorName    ?? '',
          entryId:       data.entryId       ?? '',
          categoryKey:   data.categoryKey   ?? '',
          categoryLabel: data.categoryLabel ?? '',
          paidAmount:    Number(data.paidAmount ?? 0),
          fundKey:       data.fundKey       ?? '',
          fundLabel:     data.fundLabel     ?? '',
          paymentMode:   data.paymentMode   ?? 'Cash',
          checkNumber:   data.checkNumber   ?? '',
          transactionId: data.transactionId ?? '',
          paidBy:        data.paidBy        ?? '',
          paidAt:        data.paidAt        ?? '',
          remarks:       data.remarks       ?? '',
        });
      });
      pList.sort((a, b) =>
        new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      );
      setPayments(pList);

      // Build fund options
      await buildFundOptions();

    } catch (err) {
      console.error(err);
      setErrorMsg('Data load nahi hua');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────
  // BUILD FUND OPTIONS — FIXED BALANCE CALC
  // ─────────────────────────────────────────
    const buildFundOptions = async () => {
    const fundList: FundOption[] = [];

    // transfer records
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
      const mColSnap = await getDocs(collection(db, 'mess_fund_collections'));
      const mExpSnap = await getDocs(collection(db, 'mess_fund_expenses'));
      let mCol = 0;
      const mExpList: any[] = [];

      mColSnap.forEach(d => { const _dd = d.data(); if (!scopeVisible(_dd)) return; mCol += Number(_dd.amount ?? 0); });
      mExpSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        mExpList.push({
          amount:    Number(data.amount    ?? 0),
          vendorId:  data.vendorId ?? data.linkedVendorId ?? '',
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount:  Number(data.dueAmount  ?? 0),
        });
      });

      const mTotalOrders   = mExpList.reduce((s, e) => s + e.amount, 0);
      const mActuallyPaid  = calcActuallyPaid(mExpList);
      const mVendorDue     = calcVendorDue(mExpList);

      fundList.push({
        key:             'mess_fund',
        label:           'Mess Fund',
        emoji:           '🍽️',
        totalCollection: mCol,
        totalExpense:    mTotalOrders,
        actuallyPaid:    mActuallyPaid,
        vendorDue:       mVendorDue,
        // ── FIX: balance = collection - actuallyPaid ──
               balance:         mCol - mActuallyPaid - getTransferredOut('mess_fund'),
      });
    } catch { /* ignore */ }

    // ── COMPANY ASSETS FUND ──
    try {
      const aColSnap = await getDocs(collection(db, 'company_assets_collections'));
      const aExpSnap = await getDocs(collection(db, 'company_assets_expenses'));
      let aCol = 0;
      const aExpList: any[] = [];

      aColSnap.forEach(d => { const _dd = d.data(); if (!scopeVisible(_dd)) return; aCol += Number(_dd.amount ?? 0); });
      aExpSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        aExpList.push({
          amount:     Number(data.amount     ?? 0),
          vendorId:   data.vendorId ?? data.linkedVendorId ?? '',
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount:  Number(data.dueAmount  ?? 0),
        });
      });

      const aTotalOrders  = aExpList.reduce((s, e) => s + e.amount, 0);
      const aActuallyPaid = calcActuallyPaid(aExpList);
      const aVendorDue    = calcVendorDue(aExpList);

      fundList.push({
        key:             'company_assets_fund',
        label:           'Company Assets Fund',
        emoji:           '🏛️',
        totalCollection: aCol,
        totalExpense:    aTotalOrders,
        actuallyPaid:    aActuallyPaid,
        vendorDue:       aVendorDue,
                balance:         aCol - aActuallyPaid - getTransferredOut('company_assets_fund'),
      });
    } catch { /* ignore */ }

    // ── TRAINING FUND ──
    try {
      const tColSnap = await getDocs(collection(db, 'training_fund_collections'));
      const tExpSnap = await getDocs(collection(db, 'training_fund_expenses'));
      let tCol = 0;
      const tExpList: any[] = [];

      tColSnap.forEach(d => { const _dd = d.data(); if (!scopeVisible(_dd)) return; tCol += Number(_dd.amount ?? 0); });
      tExpSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        tExpList.push({
          amount:     Number(data.amount     ?? 0),
          vendorId:   data.vendorId ?? '',
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount:  Number(data.dueAmount  ?? 0),
        });
      });

      const tTotalOrders  = tExpList.reduce((s, e) => s + e.amount, 0);
      const tActuallyPaid = calcActuallyPaid(tExpList);
      const tVendorDue    = calcVendorDue(tExpList);

      fundList.push({
        key:             'training_fund',
        label:           'Training Essentials Fund',
        emoji:           '🎓',
        totalCollection: tCol,
        totalExpense:    tTotalOrders,
        actuallyPaid:    tActuallyPaid,
        vendorDue:       tVendorDue,
                balance:         tCol - tActuallyPaid - getTransferredOut('training_fund'),
      });
    } catch { /* ignore */ }

    // ── GENERAL FUND ──
       // ── GENERAL FUND ──
    try {
      const gColSnap = await getDocs(collection(db, 'general_fund_collections'));
      const gExpSnap = await getDocs(collection(db, 'general_fund_expenses'));
      let gCol = 0;
      const gExpList: any[] = [];

      gColSnap.forEach(d => { const _dd = d.data(); if (!scopeVisible(_dd)) return; gCol += Number(_dd.amount ?? 0); });
      gExpSnap.forEach(d => {
        const data = d.data();
        if (!scopeVisible(data)) return; // batch+dev isolation guard
        gExpList.push({
          amount:     Number(data.amount     ?? 0),
          vendorId:   data.vendorId ?? '',
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount:  Number(data.dueAmount  ?? 0),
        });
      });

      const gTotalOrders  = gExpList.reduce((s, e) => s + e.amount, 0);
      const gActuallyPaid = calcActuallyPaid(gExpList);
      const gVendorDue    = calcVendorDue(gExpList);

      fundList.push({
        key:             'general_fund',
        label:           'General Fund',
        emoji:           '💰',
        totalCollection: gCol,
        totalExpense:    gTotalOrders,
        actuallyPaid:    gActuallyPaid,
        vendorDue:       gVendorDue,
                balance:         gCol - gActuallyPaid,
      });
    } catch { /* ignore */ }

    setFunds(fundList);
    if (fundList.length > 0 && !selectedFundKey) {
      setSelectedFundKey(fundList[0].key);
    }
  };

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ─────────────────────────────────────────
  // DERIVED
  // ─────────────────────────────────────────
  const vendorPendingEntries = selectedVendorId
    ? entries.filter(e => e.vendorId === selectedVendorId && e.status !== 'Paid')
    : [];

  const selectedEntry = entries.find(e => e.id === selectedEntryId);
  const entryFundKey = selectedEntry ? ((selectedEntry as any).fundKey || '') : '';
  const effectiveFundKey = entryFundKey || selectedFundKey;
  const selectedFund  = funds.find(f => f.key === effectiveFundKey);
  const maxPayable    = selectedEntry?.dueAmount ?? 0;

  useEffect(() => {
    if (entryFundKey && selectedFundKey !== entryFundKey) {
      setSelectedFundKey(entryFundKey);
    }
  }, [entryFundKey, selectedFundKey]);

  // Filtered entries for list
  const filteredEntries = entries.filter(e => {
    if (filterStatus !== 'All' && e.status !== filterStatus) return false;
    if (filterFund !== 'All' && (e as any).fundKey !== filterFund) return false;
    if (searchVendor.trim()) {
      const vendor = vendors.find(v => v.id === e.vendorId);
      const name   = (vendor?.name ?? e.vendorName).toLowerCase();
      if (!name.includes(searchVendor.toLowerCase())) return false;
    }
    return true;
  });

  const totalDue      = entries.reduce((s, e) => s + e.dueAmount,    0);
  const totalPaid     = entries.reduce((s, e) => s + e.paidAmount,   0);
  const totalAmt      = entries.reduce((s, e) => s + e.totalAmount,  0);
  const pendingCount  = entries.filter(e => e.status !== 'Paid').length;

  // Vendor-wise due summary
  const vendorDueSummary = (() => {
    const map: Record<string, {
      vendorId: string; vendorName: string; phone: string;
      totalAmount: number; totalPaid: number; totalDue: number;
      entries: number; categoryLabel: string;
    }> = {};

    entries.forEach(e => {
      if (e.dueAmount <= 0) return;
      const vendor = vendors.find(v => v.id === e.vendorId);
      if (!map[e.vendorId]) {
        map[e.vendorId] = {
          vendorId:      e.vendorId,
          vendorName:    vendor?.name          ?? e.vendorName,
          phone:         vendor?.phone         ?? '',
          totalAmount:   0,
          totalPaid:     0,
          totalDue:      0,
          entries:       0,
          categoryLabel: vendor?.categoryLabel ?? e.categoryLabel,
        };
      }
      map[e.vendorId].totalAmount += e.totalAmount;
      map[e.vendorId].totalPaid   += e.paidAmount;
      map[e.vendorId].totalDue    += e.dueAmount;
      map[e.vendorId].entries     += 1;
    });

    return Object.values(map).sort((a, b) => b.totalDue - a.totalDue);
  })();

  // ─────────────────────────────────────────
  // PROCESS PAYMENT — FIXED
  // ─────────────────────────────────────────
  const handlePayment = async () => {
    setErrorMsg('');
    if (!selectedVendorId)  { setErrorMsg('Vendor select karo');  return; }
    if (!selectedEntryId)   { setErrorMsg('Entry select karo');   return; }
    if (!payAmount || Number(payAmount) <= 0) { setErrorMsg('Amount daalo'); return; }
    if (Number(payAmount) > maxPayable) {
      setErrorMsg(`Maximum ${formatCurrency(maxPayable)} pay kar sakte ho`);
      return;
    }
    if (!selectedFundKey) { setErrorMsg('Fund select karo'); return; }

    const payErr = validatePaymentMode(payMode, checkNumber, transactionId);
    if (payErr) { setErrorMsg(payErr); return; }

    setPayLoading(true);
    try {
      const amount  = Number(payAmount);
      const entry   = entries.find(e => e.id === selectedEntryId)!;
      const vendor  = vendors.find(v => v.id === selectedVendorId)!;
      const paymentFundKey = (entry as any).fundKey || selectedFundKey;
      const paymentFund = funds.find(f => f.key === paymentFundKey);
      const fundExpCollection = getFundExpenseCollection(paymentFundKey);
      const nowISO  = new Date().toISOString();

      if (!fundExpCollection) {
        setErrorMsg('Is entry ka fund mapping nahi mila. Payment stop kar diya.');
        return;
      }

      if (paymentFund && amount > paymentFund.balance) {
        setErrorMsg(
          `${paymentFund.label} mein sirf ${formatCurrency(paymentFund.balance)} available hai ` +
          `(Collection: ${formatCurrency(paymentFund.totalCollection)} − Paid: ${formatCurrency(paymentFund.actuallyPaid)})`
        );
        return;
      }

      const newPaid   = entry.paidAmount + amount;
      const newDue    = Math.max(0, entry.totalAmount - newPaid);
      const newStatus: VendorEntry['status'] =
        newDue <= 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

      // Fund balance expense se calculate hota hai, isliye expense doc milna mandatory hai.
      let expenseDocId = (entry as any).linkedExpenseId || '';
      if (!expenseDocId) {
        const expSnap = await getDocs(collection(db, fundExpCollection));
        for (const expDoc of expSnap.docs) {
          const expData = expDoc.data();
          const expVendorId = expData.vendorId ?? expData.linkedVendorId ?? '';
          if (
            expVendorId === selectedVendorId &&
            Number(expData.amount ?? 0) === entry.totalAmount &&
            Number(expData.dueAmount ?? 0) > 0
          ) {
            expenseDocId = expDoc.id;
            break;
          }
        }
      }

      const batch = writeBatch(db);
      const entryRef = doc(db, 'vendor_entries', selectedEntryId);
      const paymentRef = doc(collection(db, 'vendor_payments'));

      let expenseRef;
      if (!expenseDocId) {
        // Create a new expense doc inside the selected fund's expense collection
        const newExpenseRef = doc(collection(db, fundExpCollection));
        expenseDocId = newExpenseRef.id;
        expenseRef = newExpenseRef;

        batch.set(newExpenseRef, {
          amount:        entry.totalAmount,
          itemName:      entry.items[0]?.itemName || 'Vendor Entry Purchase',
          vendor:        vendor.name,
          vendorId:      selectedVendorId,
          quantity:      entry.items.reduce((s, i: any) => s + Number(i.quantity ?? 0), 0) || 1,
          unitPrice:     entry.items[0]?.unitPrice || entry.totalAmount,
          remarks:       entry.remarks || `Vendor purchase: ${vendor.name}`,
          billStatus:    entry.bills.length > 0 ? 'Received' : 'Pending',
          billBase64:    entry.bills[0]?.base64 ?? '',
          billFileName:  entry.bills[0]?.fileName ?? '',
          billFileType:  entry.bills[0]?.fileType ?? '',
          billFileSize:  entry.bills[0]?.fileSize ?? 0,
          assetStatus:   'Active',
          paidAmount:    newPaid,
          dueAmount:     newDue,
          status:        newStatus,
          paymentMode:   payMode,
          checkNumber:   payMode === 'Check' ? checkNumber : '',
          transactionId: getPaymentRef(payMode, checkNumber, transactionId),
          recordedBy:    paidBy,
          date:          entry.entryDate || nowISO,
          createdAt:     serverTimestamp(),
          linkedEntryId: selectedEntryId,
          linkedVendorId: selectedVendorId,
        });
      } else {
        expenseRef = doc(db, fundExpCollection, expenseDocId);
        batch.update(expenseRef, {
          paidAmount:    newPaid,
          dueAmount:     newDue,
          status:        newStatus,
          paymentMode:   payMode,
          checkNumber:   payMode === 'Check' ? checkNumber : '',
          transactionId: getPaymentRef(payMode, checkNumber, transactionId),
          updatedAt:     serverTimestamp(),
        });
      }

      batch.update(entryRef, {
        paidAmount: newPaid,
        dueAmount:  newDue,
        status:     newStatus,
        fundKey:    paymentFundKey,
        linkedExpenseId: expenseDocId,
        updatedAt:  serverTimestamp(),
      });

      batch.set(paymentRef, {
        vendorId:      selectedVendorId,
        vendorName:    vendor.name,
        entryId:       selectedEntryId,
        categoryKey:   entry.categoryKey,
        categoryLabel: entry.categoryLabel,
        paidAmount:    amount,
        fundKey:       paymentFundKey,
        fundLabel:     paymentFund?.label ?? paymentFundKey,
        paymentMode:   payMode,
        checkNumber:   payMode === 'Check' ? checkNumber : '',
        transactionId: getPaymentRef(payMode, checkNumber, transactionId),
        remarks:       payRemarks || `Vendor payment — ${vendor.name}`,
        paidBy,
        paidAt:        nowISO,
        createdAt:     serverTimestamp(),
      });

      await batch.commit();

      setSuccessMsg(
        `✓ ${formatCurrency(amount)} paid to ${vendor.name} from ${paymentFund?.label ?? paymentFundKey}! ` +
        `Status: ${newStatus}. ` +
        (newDue > 0
          ? `Remaining: ${formatCurrency(newDue)}`
          : 'Fully Paid! 🎉')
      );

      // Reset form
      setSelectedEntryId('');
      setPayAmount('');
      setCheckNumber('');
      setTransactionId('');
      setPayRemarks('');
      await fetchAllData();

    } catch (err) {
      console.error(err);
      setErrorMsg('Payment nahi hua. Retry karo.');
    } finally {
      setPayLoading(false);
    }
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-amber-500 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-amber-600 rounded-xl flex items-center justify-center text-xl">
            💳
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
              Vendor Payments
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Pending Dues · Fund Select · Payment Processing · History
            </p>
          </div>
        </div>
        <button onClick={fetchAllData} disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <ReportButton />
      </div>

      {/* ALERTS */}
      {successMsg && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={14} /> {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> {errorMsg}
          <button onClick={() => setErrorMsg('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* HOW IT WORKS */}
      <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3 flex items-start gap-2">
        <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-amber-700 space-y-1">
          <p><strong>Kaise kaam karta hai:</strong></p>
          <p>1. Jab saman kharida → Expense ALREADY ban chuka hai (Mess/Assets/Training Fund mein)</p>
          <p>2. Yahan sirf <strong>vendor ka due clear</strong> hota hai —
            <strong> dobara expense NAHI banta</strong></p>
          <p>3. Fund balance = Collection − Actually Paid
            (Due amount balance mein tha, payment ke baad ghattega)</p>
          <p>4. Vendor → Entry Select → Amount → Fund → Pay karo ✅</p>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-400 rounded p-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Orders</p>
          <p className="text-xl font-black text-slate-700">{formatCurrency(totalAmt)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{entries.length} entries</p>
        </div>
        <div className="bg-green-50 border border-green-200 border-l-4 border-l-green-500 rounded p-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Paid</p>
          <p className="text-xl font-black text-green-700">{formatCurrency(totalPaid)}</p>
          <p className="text-[10px] text-green-600 mt-1">
            {entries.filter(e => e.status === 'Paid').length} fully paid
          </p>
        </div>
        <div className={`border-l-4 rounded p-4 shadow-sm ${
          totalDue > 0
            ? 'bg-red-50 border border-red-200 border-l-red-500'
            : 'bg-green-50 border border-green-200 border-l-green-500'
        }`}>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Due</p>
          <p className={`text-xl font-black ${totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(totalDue)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{pendingCount} entries pending</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded p-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Vendors with Due</p>
          <p className="text-xl font-black text-amber-700">{vendorDueSummary.length}</p>
          <p className="text-[10px] text-amber-600 mt-1">need payment</p>
        </div>
      </div>

      {/* VENDOR-WISE DUE SUMMARY */}
      {vendorDueSummary.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase text-red-700 flex items-center gap-1.5">
              <AlertTriangle size={11} /> Vendors with Pending Dues
            </p>
            <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded">
              {formatCurrency(totalDue)} total due
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
            {vendorDueSummary.map(vd => (
              <div key={vd.vendorId}
                className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                onClick={() => {
                  setSelectedVendorId(vd.vendorId);
                  setSelectedEntryId('');
                  setPayAmount('');
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}>
                <div className="flex items-center gap-2">
                  <Building2 size={12} className="text-slate-400" />
                  <div>
                    <p className="text-xs font-black text-slate-800">{vd.vendorName}</p>
                    <p className="text-[10px] text-slate-400">
                      {vd.categoryLabel} · {vd.entries} entries
                      {vd.phone && <span className="ml-1">· 📱 {vd.phone}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-black text-red-600">
                      {formatCurrency(vd.totalDue)}
                    </p>
                    <p className="text-[9px] text-green-600">
                      Paid: {formatCurrency(vd.totalPaid)}
                    </p>
                  </div>
                  <button className="text-[9px] font-black bg-amber-600 text-white px-2.5 py-1 rounded hover:bg-amber-700">
                    Pay →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FUND BALANCE CARDS */}
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5">
          <Wallet size={11} /> Available Funds (Payment yahan se hoga)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {funds.map(fund => (
            <div key={fund.key}
              onClick={() => setSelectedFundKey(fund.key)}
              className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${
                selectedFundKey === fund.key
                  ? 'border-amber-500 bg-amber-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-amber-300'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{fund.emoji}</span>
                  <div>
                    <p className="text-xs font-black text-slate-800">{fund.label}</p>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <span className="text-[8px] font-bold text-green-600">
                        In: {formatCurrency(fund.totalCollection)}
                      </span>
                      <span className="text-[8px] font-bold text-red-500">
                        Paid: {formatCurrency(fund.actuallyPaid)}
                      </span>
                      {fund.vendorDue > 0 && (
                        <span className="text-[8px] font-bold text-amber-600">
                          Due: {formatCurrency(fund.vendorDue)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${
                    fund.balance >= 0 ? 'text-green-700' : 'text-red-600'
                  }`}>
                    {formatCurrency(fund.balance)}
                  </p>
                  <p className="text-[8px] text-slate-400">balance</p>
                  {selectedFundKey === fund.key && (
                    <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      ✓ Selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PAYMENT FORM */}
      <div className="bg-white border-2 border-amber-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase text-amber-800 flex items-center gap-2">
          <IndianRupee size={14} /> Process Payment
        </h3>

        <div className="bg-green-50 border border-green-200 rounded px-3 py-2 flex items-start gap-2">
          <CheckCircle2 size={12} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-green-700">
            <strong>Yahan payment karne se expense DOBARA nahi banega.</strong>{' '}
            Sirf vendor ka due clear hoga aur linked expense ka dueAmount update hoga.
            Fund balance = Collection − Actually Paid.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vendor Select */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Vendor Select *
            </label>
            <select
              value={selectedVendorId}
              onChange={e => {
                setSelectedVendorId(e.target.value);
                setSelectedEntryId('');
                setPayAmount('');
              }}
              className="w-full border border-slate-300 px-3 py-2 text-sm font-bold rounded focus:outline-none focus:border-amber-500 bg-white">
              <option value="">— Vendor chunno —</option>
              {vendors.map(v => {
                const due = entries
                  .filter(e => e.vendorId === v.id)
                  .reduce((s, e) => s + e.dueAmount, 0);
                if (due <= 0) return null;
                return (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.categoryLabel} · Due: {formatCurrency(due)}
                  </option>
                );
              })}
            </select>

            {selectedVendorId && (() => {
              const v = vendors.find(v => v.id === selectedVendorId);
              if (!v) return null;
              const vDue = entries
                .filter(e => e.vendorId === v.id)
                .reduce((s, e) => s + e.dueAmount, 0);
              return (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={12} className="text-amber-600" />
                    <div>
                      <p className="text-[10px] font-black text-amber-800">{v.name}</p>
                      <p className="text-[9px] text-amber-600">
                        {v.categoryLabel}
                        {v.phone && <span> · 📱 {v.phone}</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-red-600">
                    Due: {formatCurrency(vDue)}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Entry Select */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Pending Entry Select *
            </label>
            <select
              value={selectedEntryId}
              onChange={e => {
                setSelectedEntryId(e.target.value);
                const entry = entries.find(en => en.id === e.target.value);
                if (entry) setPayAmount(String(entry.dueAmount));
              }}
              disabled={!selectedVendorId || vendorPendingEntries.length === 0}
              className="w-full border border-slate-300 px-3 py-2 text-xs font-bold rounded focus:outline-none focus:border-amber-500 bg-white disabled:bg-slate-50">
              <option value="">
                {!selectedVendorId             ? '— Pehle vendor chunno —'
                  : vendorPendingEntries.length === 0 ? '✓ Koi pending entry nahi'
                  : '— Entry chunno —'}
              </option>
              {vendorPendingEntries.map(e => (
                <option key={e.id} value={e.id}>
                  {formatDate(e.entryDate)} · {e.items.length} items ·
                  Total: {formatCurrency(e.totalAmount)} ·
                  Paid: {formatCurrency(e.paidAmount)} ·
                  Due: {formatCurrency(e.dueAmount)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Entry Preview */}
        {selectedEntry && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-black text-amber-700 uppercase">Entry Details</p>

            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { l: 'Total',        v: formatCurrency(selectedEntry.totalAmount), c: 'text-slate-700' },
                { l: 'Already Paid', v: formatCurrency(selectedEntry.paidAmount),  c: 'text-green-700' },
                { l: 'Due',          v: formatCurrency(selectedEntry.dueAmount),   c: 'text-red-700' },
                {
                  l: 'Status', v: selectedEntry.status,
                  c: selectedEntry.status === 'Pending' ? 'text-red-600'
                   : selectedEntry.status === 'Partial' ? 'text-amber-600'
                   : 'text-green-600',
                },
              ].map(s => (
                <div key={s.l}>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{s.l}</p>
                  <p className={`text-sm font-black ${s.c}`}>{s.v}</p>
                </div>
              ))}
            </div>

            {/* Items */}
            <div className="space-y-0.5">
              {selectedEntry.items.map((item, i) => (
                <p key={i}
                  className="text-[10px] text-slate-600 bg-white rounded px-2 py-1 border border-slate-100">
                  {item.itemName} · {item.quantity} {item.unit} ×
                  ₹{item.unitPrice.toLocaleString('en-IN')}
                  = <strong>₹{item.total.toLocaleString('en-IN')}</strong>
                </p>
              ))}
            </div>

            {/* Fund tag */}
            {(selectedEntry as any).fundKey && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-500">Fund:</span>
                <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  {funds.find(f => f.key === (selectedEntry as any).fundKey)?.label
                    ?? (selectedEntry as any).fundKey}
                </span>
              </div>
            )}

            {/* Bills */}
            {selectedEntry.bills.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-500 font-bold">Bills:</span>
                {selectedEntry.bills.map(bill => (
                  <button key={bill.id} onClick={() => setPreviewBill(bill)}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-100">
                    <Eye size={10} /> {bill.fileName.slice(0, 15)}...
                  </button>
                ))}
              </div>
            )}

            {/* Previous payments */}
            {(() => {
              const entryPayments = payments.filter(p => p.entryId === selectedEntry.id);
              if (entryPayments.length === 0) return null;
              return (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                    Previous Payments
                  </p>
                  {entryPayments.map(p => (
                    <div key={p.id}
                      className="flex items-center justify-between text-[10px] bg-green-50 rounded px-2 py-1 border border-green-100 mb-0.5">
                      <span className="text-slate-600">
                        {formatDate(p.paidAt)} · {p.fundLabel}
                      </span>
                      <div className="flex items-center gap-2">
                        <PaymentModeBadge
                          mode={p.paymentMode}
                          checkNumber={p.checkNumber}
                          transactionId={p.transactionId}
                        />
                        <span className="font-black text-green-700">
                          +{formatCurrency(p.paidAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Amount + Remarks */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Amount (₹) *{' '}
              {maxPayable > 0 && (
                <span className="text-green-600">Max: {formatCurrency(maxPayable)}</span>
              )}
            </label>
            <div className="flex items-center border border-slate-300 rounded overflow-hidden">
              <span className="px-3 py-2 text-sm font-bold text-slate-500 bg-slate-50 border-r">₹</span>
              <input
                type="number" min={1} max={maxPayable || undefined}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0"
                className="flex-1 px-3 py-2 text-sm font-black focus:outline-none"
              />
              {maxPayable > 0 && (
                <button onClick={() => setPayAmount(String(maxPayable))}
                  className="px-3 py-2 text-[10px] font-bold text-amber-700 hover:bg-amber-50 border-l uppercase">
                  Pura
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Remarks
            </label>
            <input type="text" value={payRemarks}
              onChange={e => setPayRemarks(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
              placeholder="Payment note..." />
          </div>
        </div>

        {/* Fund Selection */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
            Fund se Payment *
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {funds.map(fund => {
              const lockedToEntryFund = Boolean(entryFundKey) && fund.key !== entryFundKey;
              return (
              <button key={fund.key} type="button"
                disabled={lockedToEntryFund}
                onClick={() => !lockedToEntryFund && setSelectedFundKey(fund.key)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  effectiveFundKey === fund.key
                    ? 'border-amber-500 bg-amber-50'
                    : lockedToEntryFund
                      ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                      : 'border-slate-200 hover:border-amber-300'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{fund.emoji}</span>
                  <div>
                    <p className="text-[10px] font-black text-slate-800">{fund.label}</p>
                    <p className={`text-[10px] font-black ${
                      fund.balance >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {formatCurrency(fund.balance)}
                    </p>
                    {fund.vendorDue > 0 && (
                      <p className="text-[8px] text-amber-600">
                        Due: {formatCurrency(fund.vendorDue)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        </div>

        {/* Payment preview */}
        {selectedEntry && Number(payAmount) > 0 && selectedFund && (
          <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-green-700">
                <strong>{vendors.find(v => v.id === selectedVendorId)?.name}</strong> ko{' '}
                <strong>{formatCurrency(Number(payAmount))}</strong>{' '}
                <strong>{selectedFund.label}</strong> se
              </p>
              <p className="text-[9px] text-green-600 mt-0.5">
                After payment → Vendor Due: {formatCurrency(maxPayable - Number(payAmount))} ·
                Fund Balance: {formatCurrency(selectedFund.balance - Number(payAmount))}
              </p>
            </div>
            <CheckCircle2 size={16} className="text-green-600" />
          </div>
        )}

        {/* Payment Mode */}
        <PaymentModeSelector
          mode={payMode} setMode={setPayMode}
          checkNumber={checkNumber} setCheckNumber={setCheckNumber}
          transactionId={transactionId} setTransactionId={setTransactionId}
        />

        {/* Submit */}
        <button onClick={handlePayment}
          disabled={
            payLoading || !selectedVendorId || !selectedEntryId ||
            !payAmount || !selectedFundKey
          }
          className="w-full bg-amber-600 text-white py-3 text-xs font-black uppercase rounded-xl hover:bg-amber-700 disabled:opacity-40 flex items-center justify-center gap-2">
          {payLoading ? (
            <><Loader2 size={14} className="animate-spin" /> Processing...</>
          ) : (
            <>
              <CheckCircle2 size={14} />
              Pay {payAmount ? formatCurrency(Number(payAmount)) : '—'} via {payMode} from{' '}
              {selectedFund?.label ?? '—'}
            </>
          )}
        </button>
      </div>

      {/* ALL ENTRIES LIST */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-black uppercase text-slate-600 flex items-center gap-2">
              <Receipt size={13} /> All Vendor Entries ({filteredEntries.length})
            </p>
            <button
              onClick={() => setShowPaymentHistory(!showPaymentHistory)}
              className={`text-[9px] font-black uppercase px-2.5 py-1 rounded border ${
                showPaymentHistory
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-50'
              }`}>
              <Clock size={10} className="inline mr-1" />
              {showPaymentHistory ? 'Hide History' : 'Payment History'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(['All', 'Pending', 'Partial', 'Paid'] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-full border ${
                    filterStatus === s
                      ? s === 'Pending' ? 'bg-red-600 text-white border-red-600'
                      : s === 'Partial' ? 'bg-amber-600 text-white border-amber-600'
                      : s === 'Paid'    ? 'bg-green-600 text-white border-green-600'
                      :                   'bg-slate-700 text-white border-slate-700'
                      : 'border-slate-300 text-slate-500'
                  }`}>{s}</button>
              ))}
            </div>

            <div className="flex gap-1 ml-2">
              <button onClick={() => setFilterFund('All')}
                className={`px-2 py-1 text-[9px] font-black rounded-full border ${
                  filterFund === 'All'
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'border-slate-300 text-slate-500'
                }`}>All Funds</button>
              {funds.map(f => (
                <button key={f.key} onClick={() => setFilterFund(f.key)}
                  className={`px-2 py-1 text-[9px] font-black rounded-full border flex items-center gap-0.5 ${
                    filterFund === f.key
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'border-slate-300 text-slate-500'
                  }`}>
                  {f.emoji} {f.label.split(' ')[0]}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center border border-slate-300 rounded px-2 py-1">
              <Search size={10} className="text-slate-400 mr-1" />
              <input type="text" value={searchVendor}
                onChange={e => setSearchVendor(e.target.value)}
                placeholder="Vendor search..."
                className="text-[10px] w-24 focus:outline-none" />
            </div>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Receipt size={32} className="mx-auto mb-2 text-slate-200" />
            <p className="text-sm font-bold">Koi entry nahi</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredEntries.map(entry => {
              const vendor     = vendors.find(v => v.id === entry.vendorId);
              const isExpanded = expandedEntry === entry.id;
              const entryPayments = payments.filter(p => p.entryId === entry.id);
              const entryFund  = funds.find(f => f.key === (entry as any).fundKey);

              return (
                <div key={entry.id}>
                  <div
                    className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                    onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-black text-slate-800">
                            {vendor?.name ?? entry.vendorName}
                          </p>
                          {entryFund && (
                            <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded">
                              {entryFund.emoji} {entryFund.label.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {entry.categoryLabel} · {formatDate(entry.entryDate)} ·
                          {entry.items.length} items
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-700">
                          {formatCurrency(entry.totalAmount)}
                        </p>
                        {entry.dueAmount > 0 && (
                          <p className="text-[10px] font-black text-red-600">
                            Due: {formatCurrency(entry.dueAmount)}
                          </p>
                        )}
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                        entry.status === 'Paid'    ? 'bg-green-100 text-green-700 border-green-200'  :
                        entry.status === 'Partial' ? 'bg-amber-100 text-amber-700 border-amber-200'  :
                        'bg-red-100 text-red-700 border-red-200'
                      }`}>{entry.status}</span>
                      {entry.bills.length > 0 && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {entry.bills.length} bill{entry.bills.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="px-4 pb-3 bg-slate-50 border-t border-slate-100 space-y-3">
                      {/* Items */}
                      <div className="space-y-1 mt-2">
                        {entry.items.map((item, i) => (
                          <div key={i}
                            className="flex items-center justify-between text-[10px] bg-white rounded px-2 py-1 border border-slate-100">
                            <span className="font-bold text-slate-700">
                              {item.itemName} · {item.quantity} {item.unit} ×
                              ₹{item.unitPrice.toLocaleString('en-IN')}
                            </span>
                            <span className="font-black text-slate-700">
                              ₹{item.total.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Summary bar */}
                      <div className="grid grid-cols-3 gap-2 text-center bg-white rounded p-2 border border-slate-100">
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold">Total</p>
                          <p className="text-xs font-black text-slate-700">
                            {formatCurrency(entry.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-green-500 font-bold">Paid</p>
                          <p className="text-xs font-black text-green-600">
                            {formatCurrency(entry.paidAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-red-500 font-bold">Due</p>
                          <p className={`text-xs font-black ${
                            entry.dueAmount > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatCurrency(entry.dueAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Payment History */}
                      {entryPayments.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                            Payment History ({entryPayments.length})
                          </p>
                          {entryPayments.map(p => (
                            <div key={p.id}
                              className="flex items-center justify-between text-[10px] bg-green-50 rounded px-2 py-1 border border-green-100 mb-0.5">
                              <span className="text-slate-600">
                                {formatDate(p.paidAt)} · {p.fundLabel}
                                {p.remarks && (
                                  <span className="text-slate-400 ml-1">· {p.remarks}</span>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                <PaymentModeBadge
                                  mode={p.paymentMode}
                                  checkNumber={p.checkNumber}
                                  transactionId={p.transactionId}
                                />
                                <span className="font-black text-green-700">
                                  +{formatCurrency(p.paidAmount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bills */}
                      {entry.bills.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-bold">Bills:</span>
                          {entry.bills.map(bill => (
                            <button key={bill.id} onClick={() => setPreviewBill(bill)}
                              className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-100">
                              <Eye size={10} /> {bill.fileName.slice(0, 20)}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Pay */}
                      {entry.dueAmount > 0 && (
                        <button
                          onClick={() => {
                            setSelectedVendorId(entry.vendorId);
                            setSelectedEntryId(entry.id);
                            setPayAmount(String(entry.dueAmount));
                            const eFund = (entry as any).fundKey;
                            if (eFund && funds.some(f => f.key === eFund)) {
                              setSelectedFundKey(eFund);
                            }
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-black bg-amber-600 text-white px-3 py-1.5 rounded hover:bg-amber-700">
                          <IndianRupee size={10} />
                          Quick Pay {formatCurrency(entry.dueAmount)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PAYMENT HISTORY (Toggle) */}
      {showPaymentHistory && payments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase text-green-700 flex items-center gap-2">
              <Clock size={13} /> Payment History ({payments.length})
            </p>
            <button onClick={() => setShowPaymentHistory(false)}
              className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {payments.map(p => (
              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-black text-slate-800">{p.vendorName}</p>
                    <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded">
                      {p.fundLabel}
                    </span>
                    <PaymentModeBadge
                      mode={p.paymentMode}
                      checkNumber={p.checkNumber}
                      transactionId={p.transactionId}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {formatDate(p.paidAt)} · {p.categoryLabel}
                    {p.remarks && <span> · {p.remarks}</span>}
                  </p>
                </div>
                <span className="text-sm font-black text-green-700">
                  {formatCurrency(p.paidAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BILL PREVIEW MODAL */}
      {previewBill && (
        <BillPreviewModal
          bill={previewBill}
          onClose={() => setPreviewBill(null)}
        />
      )}
    </div>
  );
};

export default VendorPaymentScreen;