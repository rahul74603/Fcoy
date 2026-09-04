// D:\ALL PROJECTS\BSF COYs\frontend\src\features\messFund\MessFundScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Plus, Loader2, X, CheckCircle2, AlertTriangle,
  RefreshCw, TrendingUp, TrendingDown, Info, Trash2,
  Filter, ArrowDownToLine, ArrowUpFromLine, Calculator,
  Receipt, ChevronDown, ChevronUp, Lock, Calendar,
  Tag, Building2, Phone,
  ShoppingCart, ArrowRightLeft
} from 'lucide-react';
import {
  collection, addDoc, getDocs, doc, deleteDoc,
  updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { showDoc } from '../../utils/devDataFilter';
import { MESS_COLLECTION_PER_HEAD } from '../../config/businessConstants';
import { useBatch } from '../../contexts/BatchContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  PaymentModeSelector,
  PaymentModeBadge,
  validatePaymentMode,
  getPaymentRef,
  type PaymentMode
} from '../shared/PaymentModeSelector';
import {
  formatCurrency, formatDate, formatMonth,
  generateMonthOptions, processBillFile,
  FIXED_MESS_CATEGORIES, type MessCategory
} from '../finance/shared/utils';
import { BILL_STATUS_CONFIG } from '../finance/shared/constants';
import type { Vendor, VendorEntry, VendorItem, BillAttachment } from '../finance/vendors/types';
import BillPreviewModal from '../finance/shared/BillPreviewModal';
import { ModuleReportButton } from '../system/ModuleReportButton';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface MessCollection {
  id: string;
  amount: number;
  month: string;
  monthLabel: string;
  perHead: number;
  traineeCount: number;
  paymentMode: string;
  checkNumber: string;
  transactionId: string;
  remarks: string;
  recordedBy: string;
  date: string;
}

interface MessExpense {
  id: string;
  amount: number;
  category: string;
  categoryLabel: string;
  vendor: string;
  vendorId: string;
  linkedEntryId: string;
  remarks: string;
  paymentMode: string;
  checkNumber: string;
  transactionId: string;
  billStatus: 'Pending' | 'Received' | 'Verified' | 'No Bill';
  billBase64: string;
  billDownloadUrl?: string;
  billStoragePath?: string;
  billFileName: string;
  billFileType: string;
  billFileSize: number;
  recordedBy: string;
  date: string;
  dueAmount: number;
  paidAmount: number;
}

interface VendorDueSummary {
  vendorId: string;
  vendorName: string;
  categoryLabel: string;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  entries: number;
}

// ═════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════
export const MessFundScreen: React.FC = () => {
  const { user } = useAuth();
  const { currentBatch: activeBatch } = useBatch(); // ⛓️ STRICT: selected batch follow
  const belongsToBatch = (data: any) => data.batchId ? data.batchId === activeBatch?.id : activeBatch?.status === 'active';
  const recordedBy = user?.email ?? 'Quarter Master';

  // ── DATA ──
  const [collections, setCollections] = useState<MessCollection[]>([]);
  const [expenses, setExpenses] = useState<MessExpense[]>([]);
  const [customCats, setCustomCats] = useState<MessCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorEntries, setVendorEntries] = useState<VendorEntry[]>([]);
  const [traineeCount, setTraineeCount] = useState(0);
  const [transferredOut, setTransferredOut] = useState(0); // NEW
  const [dataLoading, setDataLoading] = useState(true);

  // ── COLLECTION FORM ──
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [colMonth, setColMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [colPerHead, setColPerHead] = useState(String(MESS_COLLECTION_PER_HEAD));
  const [colTraineeCount, setColTraineeCount] = useState('');
  const [colPaymentMode, setColPaymentMode] = useState<PaymentMode>('Cash');
  const [colCheckNumber, setColCheckNumber] = useState('');
  const [colTransactionId, setColTransactionId] = useState('');
  const [colRemarks, setColRemarks] = useState('');
  const [colLoading, setColLoading] = useState(false);

  // ── EXPENSE FORM ──
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expCategory, setExpCategory] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expVendorId, setExpVendorId] = useState('');
  const [expVendorName, setExpVendorName] = useState('');
  const [expRemarks, setExpRemarks] = useState('');
  const [expPaymentMode, setExpPaymentMode] = useState<PaymentMode>('Cash');
  const [expCheckNumber, setExpCheckNumber] = useState('');
  const [expTransactionId, setExpTransactionId] = useState('');
  const [expBillStatus, setExpBillStatus] = useState<MessExpense['billStatus']>('Received');
  const [expBillFile, setExpBillFile] = useState<File | null>(null);
  const [expPayNow, setExpPayNow] = useState<'full' | 'partial' | 'none'>('none');
  const [expPayAmount, setExpPayAmount] = useState('');
  const [expLoading, setExpLoading] = useState(false);

  // ── VENDOR ENTRY FORM ──
  const [showVendorEntryForm, setShowVendorEntryForm] = useState(false);
  const [veVendorId, setVeVendorId] = useState('');
  const [veItems, setVeItems] = useState<VendorItem[]>([
    { itemName: '', quantity: 1, unit: 'kg', unitPrice: 0, total: 0 }
  ]);
  const [veRemarks, setVeRemarks] = useState('');
  const [vePayNow, setVePayNow] = useState<'full' | 'partial' | 'none'>('none');
  const [vePayAmount, setVePayAmount] = useState('');
  const [vePaymentMode, setVePaymentMode] = useState<PaymentMode>('Cash');
  const [veCheckNumber, setVeCheckNumber] = useState('');
  const [veTransactionId, setVeTransactionId] = useState('');
  const [veBillFile, setVeBillFile] = useState<File | null>(null);
  const [veLoading, setVeLoading] = useState(false);

  // ── QUICK ADD VENDOR ──
  const [showQuickVendor, setShowQuickVendor] = useState(false);
  const [qvName, setQvName] = useState('');
  const [qvPhone, setQvPhone] = useState('');
  const [qvCatKey, setQvCatKey] = useState('');
  const [qvLoading, setQvLoading] = useState(false);

  // ── CUSTOM CATEGORY FORM ──
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📦');
  const [newCatHint, setNewCatHint] = useState('');
  const [catLoading, setCatLoading] = useState(false);

  // ── UI ──
  const [activeTab, setActiveTab] = useState<'overview' | 'collections' | 'expenses' | 'vendor_dues'>('overview');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [expFilterCat, setExpFilterCat] = useState('All');
  const [previewBill, setPreviewBill] = useState<BillAttachment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'col' | 'exp' | 'cat';
    id: string;
    label: string;
  } | null>(null);

  const monthOptions = generateMonthOptions();

  const allCategories: MessCategory[] = [
    ...FIXED_MESS_CATEGORIES,
    ...customCats,
  ];

  const categoryVendors = expCategory
    ? vendors.filter(v => v.categoryKey === expCategory)
    : vendors;

  // ─────────────────────────────────────────
  // FETCH
  // ─────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      const tSnap = await getDocs(collection(db, 'trainees'));
      setTraineeCount(tSnap.docs.filter(d => belongsToBatch(d.data()) && showDoc(d.data())).length);

      // Collections
      const cSnap = await getDocs(collection(db, 'mess_fund_collections'));
      const cList: MessCollection[] = [];
      cSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        cList.push({
          id: d.id,
          amount: Number(data.amount ?? 0),
          month: data.month ?? '',
          monthLabel: data.monthLabel ?? formatMonth(data.month),
          perHead: Number(data.perHead ?? 0),
          traineeCount: Number(data.traineeCount ?? 0),
          paymentMode: data.paymentMode ?? 'Cash',
          checkNumber: data.checkNumber ?? '',
          transactionId: data.transactionId ?? '',
          remarks: data.remarks ?? '',
          recordedBy: data.recordedBy ?? '',
          date: data.date ?? '',
        });
      });
      cList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCollections(cList);

      // Expenses
      const eSnap = await getDocs(collection(db, 'mess_fund_expenses'));
      const eList: MessExpense[] = [];
      eSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        const catKey = data.category ?? 'other';
        eList.push({
          id: d.id,
          amount: Number(data.amount ?? 0),
          category: catKey,
          categoryLabel: data.categoryLabel ?? catKey,
          vendor: data.vendor ?? '',
          vendorId: data.vendorId ?? data.linkedVendorId ?? '',
          linkedEntryId: data.linkedEntryId ?? '',
          remarks: data.remarks ?? '',
          paymentMode: data.paymentMode ?? '',
          checkNumber: data.checkNumber ?? '',
          transactionId: data.transactionId ?? '',
          billStatus: data.billStatus ?? 'Pending',
          billBase64: data.billBase64 ?? '',
          billDownloadUrl: data.billDownloadUrl ?? '',
          billStoragePath: data.billStoragePath ?? '',
          billFileName: data.billFileName ?? '',
          billFileType: data.billFileType ?? '',
          billFileSize: Number(data.billFileSize ?? 0),
          recordedBy: data.recordedBy ?? '',
          date: data.date ?? '',
          dueAmount: Number(data.dueAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
        });
      });
      eList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(eList);

      // Custom categories
      const ccSnap = await getDocs(collection(db, 'mess_custom_categories'));
      const ccList: MessCategory[] = [];
      ccSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        ccList.push({
          key: data.key ?? d.id,
          label: data.label ?? '',
          emoji: data.emoji ?? '📦',
          hint: data.hint ?? '',
          isFixed: false,
        });
      });
      setCustomCats(ccList);

      // Vendors
      const vSnap = await getDocs(collection(db, 'vendors'));
      const vList: Vendor[] = [];
      vSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        if (data.isActive === false) return;
        vList.push({
          id: d.id,
          name: data.name ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          categoryKey: data.categoryKey ?? 'other',
          categoryLabel: data.categoryLabel ?? 'Other',
          isActive: true,
          createdAt: data.createdAt ?? '',
          notes: data.notes ?? '',
        });
      });
      vList.sort((a, b) => a.name.localeCompare(b.name));
      setVendors(vList);

      // Vendor Entries
      const veSnap = await getDocs(collection(db, 'vendor_entries'));
      const veList: VendorEntry[] = [];
      veSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        veList.push({
          id: d.id,
          vendorId: data.vendorId ?? '',
          vendorName: data.vendorName ?? '',
          categoryKey: data.categoryKey ?? '',
          categoryLabel: data.categoryLabel ?? '',
          items: data.items ?? [],
          totalAmount: Number(data.totalAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount: Number(data.dueAmount ?? 0),
          status: data.status ?? 'Pending',
          entryDate: data.entryDate ?? '',
          remarks: data.remarks ?? '',
          bills: data.bills ?? [],
          createdBy: data.createdBy ?? '',
          ...(data.fundKey ? { fundKey: data.fundKey } : {}),
        } as VendorEntry & { fundKey?: string });
      });
      veList.sort((a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
      );
      setVendorEntries(veList);

      // ── TRANSFER OUT ── NEW
      const transferSnap = await getDocs(collection(db, 'fund_transfers'));
      let messTransferred = 0;
      transferSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        if (data.fromFundKey === 'mess_fund') {
          messTransferred += Number(data.amount ?? 0);
        }
      });
      setTransferredOut(messTransferred);

    } catch (err) {
      console.error(err);
      setErrorMsg('Data load nahi hua');
    } finally {
      setDataLoading(false);
    }
  }, [activeBatch?.id]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ─────────────────────────────────────────
  // COMPUTED — FIXED BALANCE LOGIC
  // ─────────────────────────────────────────
  const totalCollection = collections.reduce((s, c) => s + c.amount, 0);
  const totalExpense    = expenses.reduce((s, e) => s + e.amount, 0);

  const totalActuallyPaid = expenses.reduce((s, e) => {
    if (e.vendorId) return s + (e.paidAmount ?? 0);
    return s + e.amount;
  }, 0);

  // ── FIX: Balance includes transfer out ──
  const messBalance = totalCollection - totalActuallyPaid - transferredOut;

  const totalPendingDue = expenses.reduce((s, e) => s + (e.dueAmount ?? 0), 0);

  const isMonthCollected = (month: string) =>
    collections.some(c => c.month === month);

  const colTotal = Number(colPerHead) * Number(colTraineeCount);

  const messVendorDues: VendorDueSummary[] = (() => {
    const dueMap: Record<string, VendorDueSummary> = {};

    vendorEntries.forEach(ve => {
      const veFundKey = (ve as any).fundKey;
      if (veFundKey && veFundKey !== 'mess_fund') return;

      if (!veFundKey) {
        const vendor = vendors.find(v => v.id === ve.vendorId);
        if (!vendor) return;
        const isMess = FIXED_MESS_CATEGORIES.some(c => c.key === vendor.categoryKey) ||
                       customCats.some(c => c.key === vendor.categoryKey);
        if (!isMess) return;
      }

      if (ve.dueAmount <= 0) return;

      const vendor = vendors.find(v => v.id === ve.vendorId);
      const vendorId = ve.vendorId;

      if (!dueMap[vendorId]) {
        dueMap[vendorId] = {
          vendorId,
          vendorName:    vendor?.name    ?? ve.vendorName,
          categoryLabel: vendor?.categoryLabel ?? ve.categoryLabel,
          totalAmount:   0,
          totalPaid:     0,
          totalDue:      0,
          entries:       0,
        };
      }
      dueMap[vendorId].totalAmount += ve.totalAmount;
      dueMap[vendorId].totalPaid   += ve.paidAmount;
      dueMap[vendorId].totalDue    += ve.dueAmount;
      dueMap[vendorId].entries     += 1;
    });

    return Object.values(dueMap).sort((a, b) => b.totalDue - a.totalDue);
  })();

  const totalMessVendorDue = messVendorDues.reduce((s, v) => s + v.totalDue, 0);

  const categoryTotals = allCategories.map(cat => {
    const catExp    = expenses.filter(e => e.category === cat.key);
    const total     = catExp.reduce((s, e) => s + e.amount, 0);
    const pending   = catExp.filter(e => e.billStatus === 'Pending').length;
    const catVendors = vendors.filter(v => v.categoryKey === cat.key);
    const catVendorDue = messVendorDues
      .filter(vd => catVendors.some(v => v.id === vd.vendorId))
      .reduce((s, vd) => s + vd.totalDue, 0);
    return {
      ...cat, total, count: catExp.length, pending,
      expenses: catExp, vendorCount: catVendors.length, vendorDue: catVendorDue,
    };
  });

  const veTotal = veItems.reduce((s, i) => s + i.total, 0);

  // ─────────────────────────────────────────
  // SAVE COLLECTION
  // ─────────────────────────────────────────
  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!colPerHead || !colTraineeCount || Number(colTraineeCount) <= 0) {
      setErrorMsg('Per head rate aur trainee count daalo'); return;
    }
    if (isMonthCollected(colMonth)) {
      setErrorMsg(`${formatMonth(colMonth)} pehle se collect ho chuki hai`); return;
    }
    const payErr = validatePaymentMode(colPaymentMode, colCheckNumber, colTransactionId);
    if (payErr) { setErrorMsg(payErr); return; }

    setColLoading(true);
    try {
      await addDoc(collection(db, 'mess_fund_collections'), {
        amount:        colTotal,
        month:         colMonth,
        monthLabel:    formatMonth(colMonth),
        perHead:       Number(colPerHead),
        traineeCount:  Number(colTraineeCount),
        paymentMode:   colPaymentMode,
        checkNumber:   colPaymentMode === 'Check' ? colCheckNumber : '',
        transactionId: getPaymentRef(colPaymentMode, colCheckNumber, colTransactionId),
        remarks:       colRemarks || `Mess Cutting ${formatMonth(colMonth)}`,
        recordedBy,
        date:          new Date().toISOString(),
        createdAt:     serverTimestamp(),
      });
      setSuccessMsg(`✓ ${formatMonth(colMonth)}: ${formatCurrency(colTotal)} collected!`);
      setColPerHead(String(MESS_COLLECTION_PER_HEAD)); setColTraineeCount('');
      setColRemarks(''); setColCheckNumber(''); setColTransactionId('');
      setShowCollectionForm(false);
      await fetchAllData();
    } catch { setErrorMsg('Save nahi hua'); }
    finally { setColLoading(false); }
  };

  // ─────────────────────────────────────────
  // SAVE EXPENSE
  // ─────────────────────────────────────────
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!expCategory) { setErrorMsg('Category select karo'); return; }
    if (!expAmount || Number(expAmount) <= 0) { setErrorMsg('Amount daalo'); return; }

    if (expPayNow !== 'none') {
      const payErr = validatePaymentMode(expPaymentMode, expCheckNumber, expTransactionId);
      if (payErr) { setErrorMsg(payErr); return; }
    }

    setExpLoading(true);
    try {
      let billBase64 = '', billFileName = '', billFileType = '', billFileSize = 0;
      let billUrl = '', billPath = '';
      if (expBillFile) {
        const result = await processBillFile(expBillFile);
        if (result.error) { setErrorMsg(result.error); setExpLoading(false); return; }
        if (result.data) {
          billBase64    = result.data.billBase64;

          billUrl  = result.data.billDownloadUrl ?? '';

          billPath = result.data.billStoragePath ?? '';
          billFileName  = result.data.billFileName;
          billFileType  = result.data.billFileType;
          billFileSize  = result.data.billFileSize;
        }
      }

      const amount    = Number(expAmount);
      const catInfo   = allCategories.find(c => c.key === expCategory);
      const vendor    = vendors.find(v => v.id === expVendorId);
      const vendorName = vendor?.name ?? expVendorName ?? '';

      let paidAmount = 0;
      let dueAmount  = amount;

      if (!expVendorId) {
        paidAmount = amount;
        dueAmount  = 0;
      } else if (expPayNow === 'full') {
        paidAmount = amount;
        dueAmount  = 0;
      } else if (expPayNow === 'partial') {
        paidAmount = Math.min(Number(expPayAmount) || 0, amount);
        dueAmount  = amount - paidAmount;
      } else {
        paidAmount = 0;
        dueAmount  = amount;
      }

      const expenseRef = await addDoc(collection(db, 'mess_fund_expenses'), {
        amount,
        category:      expCategory,
        categoryLabel: catInfo?.label ?? expCategory,
        vendor:        vendorName,
        vendorId:      expVendorId,
        remarks:       expRemarks,
        paymentMode:   expPayNow !== 'none' ? expPaymentMode : (expVendorId ? '' : expPaymentMode),
        checkNumber:   (expPayNow !== 'none' || !expVendorId) && expPaymentMode === 'Check' ? expCheckNumber : '',
        transactionId: expPayNow !== 'none' || !expVendorId
          ? getPaymentRef(expPaymentMode, expCheckNumber, expTransactionId) : '',
        billStatus:    (billUrl || billBase64) ? 'Received' : expBillStatus,
        billBase64, billFileName, billFileType, billFileSize,
        billDownloadUrl: billUrl, billStoragePath: billPath,
        paidAmount,
        dueAmount,
        recordedBy,
        date:          new Date().toISOString(),
        createdAt:     serverTimestamp(),
      });

      let linkedEntryId = '';
      if (expVendorId && vendor) {
        const bills: BillAttachment[] = [];
        if (billBase64) {
          bills.push({
            id:         `bill_${Date.now()}`,
            base64:     billUrl || billBase64,
            fileName:   billFileName,
            fileType:   billFileType,
            fileSize:   billFileSize,
            uploadedAt: new Date().toISOString(),
            uploadedBy: recordedBy,
          });
        }

        const veRef = await addDoc(collection(db, 'vendor_entries'), {
          vendorId:      expVendorId,
          vendorName:    vendor.name,
          categoryKey:   vendor.categoryKey,
          categoryLabel: vendor.categoryLabel,
          items: [{
            itemName:  catInfo?.label ?? expCategory,
            quantity:  1,
            unit:      'pcs',
            unitPrice: amount,
            total:     amount,
          }],
          totalAmount:     amount,
          paidAmount,
          dueAmount,
          status:          dueAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending',
          entryDate:       new Date().toISOString(),
          remarks:         expRemarks || `Mess Fund Expense — ${catInfo?.label ?? expCategory}`,
          bills,
          fundKey:         'mess_fund',
          linkedExpenseId: expenseRef.id,
          createdBy:       recordedBy,
          createdAt:       serverTimestamp(),
        });
        linkedEntryId = veRef.id;

        await updateDoc(doc(db, 'mess_fund_expenses', expenseRef.id), {
          linkedEntryId:  veRef.id,
          linkedVendorId: expVendorId,
        });
      }

      if (expVendorId && paidAmount > 0) {
        await addDoc(collection(db, 'vendor_payments'), {
          vendorId:      expVendorId,
          vendorName:    vendorName,
          entryId:       linkedEntryId,
          categoryKey:   vendor?.categoryKey ?? expCategory,
          categoryLabel: vendor?.categoryLabel ?? catInfo?.label ?? expCategory,
          paidAmount,
          fundKey:       'mess_fund',
          fundLabel:     'Mess Fund',
          paymentMode:   expPaymentMode,
          checkNumber:   expPaymentMode === 'Check' ? expCheckNumber : '',
          transactionId: getPaymentRef(expPaymentMode, expCheckNumber, expTransactionId),
          remarks:       expRemarks || `Mess expense payment`,
          paidBy:        recordedBy,
          paidAt:        new Date().toISOString(),
          createdAt:     serverTimestamp(),
        });
      }

      setSuccessMsg(
        `✓ ${catInfo?.label ?? expCategory}: ${formatCurrency(amount)} saved!` +
        (vendorName ? ` Vendor: ${vendorName}` : '') +
        (dueAmount > 0 ? ` · Due: ${formatCurrency(dueAmount)}` : ' · Fully Paid!')
      );

      setExpCategory(''); setExpAmount(''); setExpVendorId('');
      setExpVendorName(''); setExpRemarks(''); setExpCheckNumber('');
      setExpTransactionId(''); setExpBillFile(null);
      setExpBillStatus('Received'); setExpPayNow('none'); setExpPayAmount('');
      setShowExpenseForm(false);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Save nahi hua');
    } finally { setExpLoading(false); }
  };

  // ─────────────────────────────────────────
  // SAVE VENDOR ENTRY
  // ─────────────────────────────────────────
  const handleSaveVendorEntry = async () => {
    setErrorMsg('');
    if (!veVendorId) { setErrorMsg('Vendor select karo'); return; }
    const validItems = veItems.filter(i => i.itemName.trim() && i.quantity > 0);
    if (validItems.length === 0) { setErrorMsg('Kam se kam ek item daalo'); return; }
    if (veTotal <= 0) { setErrorMsg('Total 0 nahi ho sakta'); return; }

    if (vePayNow !== 'none') {
      const payErr = validatePaymentMode(vePaymentMode, veCheckNumber, veTransactionId);
      if (payErr) { setErrorMsg(payErr); return; }
    }

    setVeLoading(true);
    try {
      const vendor = vendors.find(v => v.id === veVendorId)!;
      let paidAmount = 0;
      let dueAmount  = veTotal;

      if (vePayNow === 'full') {
        paidAmount = veTotal; dueAmount = 0;
      } else if (vePayNow === 'partial') {
        paidAmount = Math.min(Number(vePayAmount) || 0, veTotal);
        dueAmount  = veTotal - paidAmount;
      }

      const bills: BillAttachment[] = [];
      if (veBillFile) {
        const result = await processBillFile(veBillFile);
        if (result.error) { setErrorMsg(result.error); setVeLoading(false); return; }
        if (result.data) {
          bills.push({
            id:         `bill_${Date.now()}`,
            base64:     result.data.billDownloadUrl || result.data.billBase64,
            fileName:   result.data.billFileName,
            fileType:   result.data.billFileType,
            fileSize:   result.data.billFileSize,
            uploadedAt: new Date().toISOString(),
            uploadedBy: recordedBy,
          });
        }
      }

      const veRef = await addDoc(collection(db, 'vendor_entries'), {
        vendorId:      veVendorId,
        vendorName:    vendor.name,
        categoryKey:   vendor.categoryKey,
        categoryLabel: vendor.categoryLabel,
        items:         validItems,
        totalAmount:   veTotal,
        paidAmount,
        dueAmount,
        status:        dueAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending',
        entryDate:     new Date().toISOString(),
        remarks:       veRemarks || `Mess Fund — Vendor Purchase`,
        bills,
        fundKey:       'mess_fund',
        createdBy:     recordedBy,
        createdAt:     serverTimestamp(),
      });

      await addDoc(collection(db, 'mess_fund_expenses'), {
        amount:        veTotal,
        category:      vendor.categoryKey,
        categoryLabel: vendor.categoryLabel,
        vendor:        vendor.name,
        vendorId:      veVendorId,
        linkedEntryId: veRef.id,
        remarks:       veRemarks || `Vendor Entry: ${validItems.map(i => i.itemName).join(', ')}`,
        paymentMode:   vePayNow !== 'none' ? vePaymentMode : '',
        checkNumber:   vePayNow !== 'none' && vePaymentMode === 'Check' ? veCheckNumber : '',
        transactionId: vePayNow !== 'none'
          ? getPaymentRef(vePaymentMode, veCheckNumber, veTransactionId) : '',
        billStatus:    bills.length > 0 ? 'Received' : 'Pending',
        billBase64:    bills[0]?.base64   ?? '',
        billFileName:  bills[0]?.fileName ?? '',
        billFileType:  bills[0]?.fileType ?? '',
        billFileSize:  bills[0]?.fileSize ?? 0,
        paidAmount,
        dueAmount,
        recordedBy,
        date:          new Date().toISOString(),
        createdAt:     serverTimestamp(),
      });

      if (paidAmount > 0) {
        await addDoc(collection(db, 'vendor_payments'), {
          vendorId:      veVendorId,
          vendorName:    vendor.name,
          entryId:       veRef.id,
          categoryKey:   vendor.categoryKey,
          categoryLabel: vendor.categoryLabel,
          paidAmount,
          fundKey:       'mess_fund',
          fundLabel:     'Mess Fund',
          paymentMode:   vePaymentMode,
          checkNumber:   vePaymentMode === 'Check' ? veCheckNumber : '',
          transactionId: getPaymentRef(vePaymentMode, veCheckNumber, veTransactionId),
          remarks:       veRemarks || `Vendor purchase payment`,
          paidBy:        recordedBy,
          paidAt:        new Date().toISOString(),
          createdAt:     serverTimestamp(),
        });
      }

      setSuccessMsg(
        `✓ ${vendor.name}: ${formatCurrency(veTotal)} entry saved!` +
        (dueAmount > 0 ? ` Due: ${formatCurrency(dueAmount)}` : ' Fully Paid!')
      );

      setVeVendorId('');
      setVeItems([{ itemName: '', quantity: 1, unit: 'kg', unitPrice: 0, total: 0 }]);
      setVeRemarks(''); setVePayNow('none'); setVePayAmount('');
      setVeCheckNumber(''); setVeTransactionId(''); setVeBillFile(null);
      setShowVendorEntryForm(false);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Save nahi hua');
    } finally { setVeLoading(false); }
  };

  // ─────────────────────────────────────────
  // QUICK ADD VENDOR
  // ─────────────────────────────────────────
  const handleQuickAddVendor = async () => {
    if (!qvName.trim()) { setErrorMsg('Vendor naam daalo'); return; }
    setQvLoading(true);
    try {
      const catKey  = qvCatKey || expCategory || 'other';
      const catInfo = allCategories.find(c => c.key === catKey);
      const ref = await addDoc(collection(db, 'vendors'), {
        name:          qvName.trim(),
        phone:         qvPhone.trim(),
        address:       '',
        categoryKey:   catKey,
        categoryLabel: catInfo?.label ?? catKey,
        isActive:      true,
        notes:         '',
        createdAt:     serverTimestamp(),
        createdBy:     recordedBy,
      });
      setSuccessMsg(`✓ Vendor "${qvName}" add ho gaya!`);
      setExpVendorId(ref.id);
      setExpVendorName(qvName.trim());
      setQvName(''); setQvPhone(''); setQvCatKey('');
      setShowQuickVendor(false);
      await fetchAllData();
    } catch { setErrorMsg('Vendor save nahi hua'); }
    finally { setQvLoading(false); }
  };

  // ─────────────────────────────────────────
  // SAVE CUSTOM CATEGORY
  // ─────────────────────────────────────────
  const handleSaveCategory = async () => {
    if (!newCatLabel.trim()) { setErrorMsg('Category naam daalo'); return; }
    const key = `custom_${newCatLabel.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    setCatLoading(true);
    try {
      await addDoc(collection(db, 'mess_custom_categories'), {
        key, label: newCatLabel.trim(),
        emoji:    newCatEmoji || '📦',
        hint:     newCatHint.trim(),
        isFixed:  false,
        createdAt: serverTimestamp(),
        createdBy: recordedBy,
      });
      setSuccessMsg(`✓ "${newCatLabel}" category add ho gayi!`);
      setNewCatLabel(''); setNewCatEmoji('📦'); setNewCatHint('');
      setShowCatForm(false);
      await fetchAllData();
    } catch { setErrorMsg('Category save nahi hui'); }
    finally { setCatLoading(false); }
  };

  // ─────────────────────────────────────────
  // VENDOR ENTRY ITEM MANAGEMENT
  // ─────────────────────────────────────────
  const addVeRow = () =>
    setVeItems(prev => [
      ...prev,
      { itemName: '', quantity: 1, unit: 'kg', unitPrice: 0, total: 0 },
    ]);

  const removeVeRow = (idx: number) =>
    setVeItems(prev => prev.filter((_, i) => i !== idx));

  const updateVeRow = (idx: number, field: keyof VendorItem, value: string | number) => {
    setVeItems(prev => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      updated[idx].total = updated[idx].quantity * updated[idx].unitPrice;
      return updated;
    });
  };

  // ─────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const colMap = {
        col: 'mess_fund_collections',
        exp: 'mess_fund_expenses',
        cat: 'mess_custom_categories',
      };
      await deleteDoc(doc(db, colMap[deleteConfirm.type], deleteConfirm.id));
      setSuccessMsg(`${deleteConfirm.label} delete ho gaya`);
      setDeleteConfirm(null);
      await fetchAllData();
    } catch { setErrorMsg('Delete nahi hua'); }
  };

  const filteredExpenses = expFilterCat === 'All'
    ? expenses
    : expenses.filter(e => e.category === expFilterCat);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-orange-500 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-orange-600 rounded-xl flex items-center justify-center text-xl">🍽️</div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">Mess Fund</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Monthly Cutting · Category Expenses · Vendor Billing · Due Tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModuleReportButton module="mess" stats={[{ label: 'Collections', value: formatCurrency(totalCollection) }, { label: 'Purchases', value: formatCurrency(totalExpense) }, { label: 'Paid', value: formatCurrency(totalActuallyPaid) }, { label: 'Balance', value: formatCurrency(messBalance) }, { label: 'Vendor Due', value: formatCurrency(totalMessVendorDue) }]} rows={[...collections.map(c => ({ item: `Collection · ${c.monthLabel || 'Mess Cutting'}`, amount: c.amount, quantity: c.traineeCount, status: 'Collection' })), ...vendorEntries.flatMap(v => (v.items || []).map(i => ({ item: i.itemName || 'Mess Item', quantity: i.quantity, unitPrice: i.unitPrice, amount: i.total || (i.quantity * i.unitPrice), status: v.dueAmount > 0 ? `Due ${formatCurrency(v.dueAmount)}` : 'Paid', detail: `${v.vendorName || 'Vendor'} · ${v.entryDate || ''}` }))), ...expenses.filter(e => !vendorEntries.some(v => v.id === e.linkedEntryId)).map(e => ({ item: e.categoryLabel || e.category || 'Mess Purchase', quantity: 1, unitPrice: e.amount, amount: e.amount, status: e.dueAmount > 0 ? `Due ${formatCurrency(e.dueAmount)}` : 'Paid', detail: e.vendor || e.remarks }))]} />
          <button onClick={fetchAllData} disabled={dataLoading}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
            <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
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

      {/* ── BALANCE CARDS — 6 cards if transferred ── */}
      <div className={`grid grid-cols-2 ${transferredOut > 0 ? 'md:grid-cols-6' : 'md:grid-cols-5'} gap-3`}>

        <div className="bg-white border border-green-200 border-l-4 border-l-green-500 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Total Collection</p>
            <TrendingUp size={14} className="text-green-400" />
          </div>
          <p className="text-xl font-black text-green-700">{formatCurrency(totalCollection)}</p>
          <p className="text-[10px] text-green-600 mt-1">{collections.length} entries</p>
        </div>

        <div className="bg-white border border-orange-200 border-l-4 border-l-orange-400 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Total Orders</p>
            <Receipt size={14} className="text-orange-400" />
          </div>
          <p className="text-xl font-black text-orange-700">{formatCurrency(totalExpense)}</p>
          <p className="text-[10px] text-orange-600 mt-1">{expenses.length} entries · saman ka</p>
        </div>

        <div className="bg-white border border-red-200 border-l-4 border-l-red-500 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Actually Paid</p>
            <TrendingDown size={14} className="text-red-400" />
          </div>
          <p className="text-xl font-black text-red-600">{formatCurrency(totalActuallyPaid)}</p>
          <p className="text-[10px] text-red-500 mt-1">Paisa gaya</p>
        </div>

        {/* ── NEW: Transferred Out Card ── */}
        {transferredOut > 0 && (
          <div className="bg-purple-50 border border-purple-200 border-l-4 border-l-purple-500 rounded p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black text-slate-400 uppercase">Transferred</p>
              <ArrowRightLeft size={14} className="text-purple-500" />
            </div>
            <p className="text-xl font-black text-purple-700">{formatCurrency(transferredOut)}</p>
            <p className="text-[10px] text-purple-600 mt-1">To General Fund</p>
          </div>
        )}

        <div className={`border-l-4 rounded p-4 shadow-sm ${
          messBalance >= 0
            ? 'bg-blue-50 border border-blue-200 border-l-blue-500'
            : 'bg-red-100 border border-red-300 border-l-red-600'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Cash in Hand</p>
            <Wallet size={14} className="text-blue-500" />
          </div>
          <p className={`text-xl font-black ${messBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {messBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(messBalance))}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Available to use</p>
        </div>

        <div className={`border-l-4 rounded p-4 shadow-sm ${
          totalPendingDue > 0
            ? 'bg-amber-50 border border-amber-200 border-l-amber-500'
            : 'bg-green-50 border border-green-200 border-l-green-500'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Pending Dues</p>
            <AlertTriangle size={14} className={totalPendingDue > 0 ? 'text-amber-400' : 'text-green-400'} />
          </div>
          <p className={`text-xl font-black ${totalPendingDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {formatCurrency(totalPendingDue)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Vendor ko dena hai</p>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setShowCollectionForm(!showCollectionForm);
            setShowExpenseForm(false);
            setShowVendorEntryForm(false);
            setShowCatForm(false);
            setColTraineeCount(String(traineeCount));
          }}
          className="flex items-center gap-1.5 bg-green-700 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-green-800 rounded">
          <ArrowDownToLine size={13} /> Mess Cutting Collect
        </button>
        <button
          onClick={() => {
            setShowExpenseForm(!showExpenseForm);
            setShowCollectionForm(false);
            setShowVendorEntryForm(false);
            setShowCatForm(false);
          }}
          className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-red-700 rounded">
          <ArrowUpFromLine size={13} /> Add Expense
        </button>
        <button
          onClick={() => {
            setShowVendorEntryForm(!showVendorEntryForm);
            setShowCollectionForm(false);
            setShowExpenseForm(false);
            setShowCatForm(false);
          }}
          className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-amber-700 rounded">
          <ShoppingCart size={13} /> Vendor Purchase Entry
        </button>
        <button
          onClick={() => {
            setShowCatForm(!showCatForm);
            setShowCollectionForm(false);
            setShowExpenseForm(false);
            setShowVendorEntryForm(false);
          }}
          className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-purple-700 rounded">
          <Plus size={13} /> Add Custom Category
        </button>
      </div>

      {/* COLLECTION FORM */}
      {showCollectionForm && (
        <form onSubmit={handleSaveCollection}
          className="bg-green-50 border border-green-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-green-800 flex items-center gap-2">
              <Calculator size={14} /> Mess Cutting Collection
            </h3>
            <button type="button" onClick={() => setShowCollectionForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="bg-white border border-green-200 rounded px-3 py-2 flex items-center gap-2">
            <Info size={12} className="text-green-600 flex-shrink-0" />
            <p className="text-[10px] text-green-700">
              <strong>Current Trainees:</strong> {traineeCount} · Default ₹{MESS_COLLECTION_PER_HEAD}/month
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Month *</label>
              <select value={colMonth} onChange={e => setColMonth(e.target.value)}
                className={`w-full border px-3 py-2 text-xs font-bold rounded focus:outline-none ${
                  isMonthCollected(colMonth)
                    ? 'border-green-400 bg-green-50 text-green-800'
                    : 'border-slate-300'
                }`}>
                {monthOptions.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label} {isMonthCollected(m.value) ? '✓' : ''}
                  </option>
                ))}
              </select>
              {isMonthCollected(colMonth) && (
                <p className="text-[9px] text-green-600 font-bold mt-1 flex items-center gap-1">
                  <Lock size={9} /> Already collected
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Per Head (₹) *</label>
              <input type="number" min={1} value={colPerHead}
                onChange={e => setColPerHead(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs font-black rounded focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Trainees *</label>
              <input type="number" min={1} value={colTraineeCount}
                onChange={e => setColTraineeCount(e.target.value)}
                placeholder={String(traineeCount)}
                className="w-full border border-slate-300 px-3 py-2 text-xs font-black rounded focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
              <input type="text" value={colRemarks}
                onChange={e => setColRemarks(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none" />
            </div>
          </div>

          {Number(colPerHead) > 0 && Number(colTraineeCount) > 0 && (
            <div className="bg-green-100 border border-green-300 rounded p-3 flex items-center justify-between">
              <p className="text-xs text-green-800">
                {colTraineeCount} × ₹{Number(colPerHead).toLocaleString('en-IN')}
              </p>
              <p className="text-2xl font-black text-green-800">
                ₹{colTotal.toLocaleString('en-IN')}
              </p>
            </div>
          )}

          <PaymentModeSelector
            mode={colPaymentMode} setMode={setColPaymentMode}
            checkNumber={colCheckNumber} setCheckNumber={setColCheckNumber}
            transactionId={colTransactionId} setTransactionId={setColTransactionId}
          />

          <button type="submit"
            disabled={colLoading || isMonthCollected(colMonth) || !colPerHead || !colTraineeCount}
            className="bg-green-700 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-green-800 disabled:opacity-40 flex items-center gap-2 rounded">
            {colLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Save {formatCurrency(colTotal)} via {colPaymentMode}
          </button>
        </form>
      )}

      {/* EXPENSE FORM */}
      {showExpenseForm && (
        <form onSubmit={handleSaveExpense}
          className="bg-red-50 border border-red-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-red-800 flex items-center gap-2">
              <ArrowUpFromLine size={14} /> Mess Fund Expense
            </h3>
            <button type="button" onClick={() => setShowExpenseForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Category *</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {allCategories.map(cat => (
                <button key={cat.key} type="button"
                  onClick={() => { setExpCategory(cat.key); setExpVendorId(''); }}
                  className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                    expCategory === cat.key
                      ? 'border-red-500 bg-red-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.emoji}</span>
                    <div>
                      <p className={`text-[10px] font-black ${
                        expCategory === cat.key ? 'text-red-700' : 'text-slate-700'
                      }`}>{cat.label}</p>
                      <p className="text-[8px] text-slate-400 leading-tight">{cat.hint}</p>
                    </div>
                  </div>
                  {!cat.isFixed && (
                    <span className="text-[8px] font-bold text-purple-600 bg-purple-50 px-1 py-0.5 rounded mt-1 inline-block">
                      Custom
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Selection */}
          {expCategory && (
            <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Building2 size={10} /> Vendor Select (Optional)
                </label>
                <button type="button"
                  onClick={() => { setShowQuickVendor(!showQuickVendor); setQvCatKey(expCategory); }}
                  className="text-[9px] font-black text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100">
                  + New Vendor
                </button>
              </div>

              <select value={expVendorId}
                onChange={e => {
                  setExpVendorId(e.target.value);
                  const v = vendors.find(v => v.id === e.target.value);
                  setExpVendorName(v?.name ?? '');
                }}
                className="w-full border border-slate-300 px-3 py-2 text-xs font-bold rounded focus:outline-none bg-white">
                <option value="">— Bina Vendor (Direct Expense) —</option>
                {categoryVendors.map(v => {
                  const vDue = vendorEntries
                    .filter(ve => ve.vendorId === v.id)
                    .reduce((s, ve) => s + ve.dueAmount, 0);
                  return (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.categoryLabel}
                      {vDue > 0 ? ` · Due: ${formatCurrency(vDue)}` : ''}
                    </option>
                  );
                })}
              </select>

              {showQuickVendor && (
                <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                  <p className="text-[10px] font-black text-green-800 uppercase">Quick Add Vendor</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={qvName} onChange={e => setQvName(e.target.value)}
                      placeholder="Vendor naam *"
                      className="border border-green-300 px-3 py-1.5 text-xs font-bold rounded focus:outline-none" />
                    <input type="text" value={qvPhone} onChange={e => setQvPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="border border-green-300 px-3 py-1.5 text-xs rounded focus:outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleQuickAddVendor}
                      disabled={qvLoading || !qvName.trim()}
                      className="bg-green-700 text-white px-3 py-1.5 text-[10px] font-black rounded hover:bg-green-800 disabled:opacity-40 flex items-center gap-1">
                      {qvLoading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Add
                    </button>
                    <button type="button" onClick={() => setShowQuickVendor(false)}
                      className="text-[10px] font-bold text-slate-500 px-2">Cancel</button>
                  </div>
                </div>
              )}

              {expVendorId && (() => {
                const v = vendors.find(v => v.id === expVendorId);
                if (!v) return null;
                const vEntries = vendorEntries.filter(ve => ve.vendorId === v.id);
                const vDue = vEntries.reduce((s, ve) => s + ve.dueAmount, 0);
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 size={12} className="text-amber-600" />
                      <div>
                        <p className="text-[10px] font-black text-amber-800">{v.name}</p>
                        <p className="text-[9px] text-amber-600">
                          {v.categoryLabel} · {vEntries.length} entries
                        </p>
                      </div>
                    </div>
                    {vDue > 0 && (
                      <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        Due: {formatCurrency(vDue)}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Amount (₹) *</label>
              <input type="number" min={1} required value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none focus:border-red-500"
                placeholder="0" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bill Status</label>
              <select value={expBillStatus}
                onChange={e => setExpBillStatus(e.target.value as MessExpense['billStatus'])}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none bg-white">
                <option value="Received">Bill Received</option>
                <option value="Pending">Bill Pending</option>
                <option value="Verified">Verified</option>
                <option value="No Bill">No Bill</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vendor / Dukaan</label>
              <input type="text"
                value={expVendorId ? (vendors.find(v => v.id === expVendorId)?.name ?? '') : expVendorName}
                onChange={e => { if (!expVendorId) setExpVendorName(e.target.value); }}
                disabled={!!expVendorId}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none disabled:bg-slate-50"
                placeholder="Manual naam" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
              <input type="text" value={expRemarks}
                onChange={e => setExpRemarks(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                placeholder="Note..." />
            </div>
          </div>

          {expVendorId && Number(expAmount) > 0 && (
            <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                Payment Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'none',    label: '⏳ Abhi Nahi (Due)', hint: 'Vendor Payment se baad mein' },
                  { key: 'partial', label: '💰 Partial Pay',      hint: 'Kuch pay karo abhi' },
                  { key: 'full',    label: '✅ Full Pay',          hint: 'Poora pay kar do' },
                ] as const).map(opt => (
                  <button key={opt.key} type="button"
                    onClick={() => {
                      setExpPayNow(opt.key);
                      if (opt.key === 'full')    setExpPayAmount(expAmount);
                      if (opt.key === 'none') setExpPayAmount('');
                    }}
                    className={`p-2.5 rounded-lg border-2 text-left ${
                      expPayNow === opt.key
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    <p className="text-[10px] font-black text-slate-800">{opt.label}</p>
                    <p className="text-[8px] text-slate-400">{opt.hint}</p>
                  </button>
                ))}
              </div>

              {expPayNow === 'partial' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Pay Amount *
                  </label>
                  <input type="number" min={1} max={Number(expAmount)} value={expPayAmount}
                    onChange={e => setExpPayAmount(e.target.value)}
                    className="w-full border border-amber-300 px-3 py-2 text-sm font-black rounded focus:outline-none focus:border-amber-500"
                    placeholder={`Max: ${expAmount}`} />
                </div>
              )}

              {expPayNow !== 'none' && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-center justify-between">
                  <span className="text-[10px] text-amber-700">
                    Paying: {formatCurrency(
                      expPayNow === 'full' ? Number(expAmount) : Number(expPayAmount) || 0
                    )}
                  </span>
                  <span className="text-[10px] font-black text-red-600">
                    Due: {formatCurrency(
                      Number(expAmount) - (expPayNow === 'full' ? Number(expAmount) : Number(expPayAmount) || 0)
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded p-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Bill Upload (Optional)
            </label>
            <div className="flex items-center gap-3">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => setExpBillFile(e.target.files?.[0] ?? null)}
                className="text-xs" />
              {expBillFile && (
                <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                  <CheckCircle2 size={10} /> {expBillFile.name}
                </span>
              )}
            </div>
          </div>

          {(expPayNow !== 'none' || !expVendorId) && (
            <PaymentModeSelector
              mode={expPaymentMode} setMode={setExpPaymentMode}
              checkNumber={expCheckNumber} setCheckNumber={setExpCheckNumber}
              transactionId={expTransactionId} setTransactionId={setExpTransactionId}
            />
          )}

          <button type="submit"
            disabled={expLoading || !expCategory || !expAmount}
            className="bg-red-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-red-700 disabled:opacity-40 flex items-center gap-2 rounded">
            {expLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Save Expense{expVendorId ? ` + Vendor Entry` : ''}
            {expPayNow !== 'none' ? ` via ${expPaymentMode}` : (expVendorId ? ' (Due)' : '')}
          </button>
        </form>
      )}

      {/* VENDOR PURCHASE ENTRY FORM */}
      {showVendorEntryForm && (
        <div className="bg-amber-50 border border-amber-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-amber-800 flex items-center gap-2">
              <ShoppingCart size={14} /> Vendor Purchase Entry (Itemized Bill)
            </h3>
            <button onClick={() => setShowVendorEntryForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="bg-white border border-amber-200 rounded px-3 py-2 flex items-start gap-2">
            <Info size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700">
              <strong>Item-by-item purchase entry.</strong> Bill upload karo, payment status set karo.
              Vendor Payment screen se baad mein bhi pay kar sakte ho.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vendor *</label>
            <select value={veVendorId} onChange={e => setVeVendorId(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-sm font-bold rounded focus:outline-none focus:border-amber-500 bg-white">
              <option value="">— Vendor chunno —</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name} · {v.categoryLabel}</option>
              ))}
            </select>
          </div>

          {veVendorId && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Items List *</label>
                  <button type="button" onClick={addVeRow}
                    className="flex items-center gap-1 text-[10px] font-black bg-amber-600 text-white px-2.5 py-1 rounded hover:bg-amber-700">
                    <Plus size={10} /> Add Row
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-1 px-2 py-1 bg-slate-100 rounded text-[9px] font-black uppercase text-slate-500 mb-1">
                  <div className="col-span-4">Item Name</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-center">Unit</div>
                  <div className="col-span-2 text-center">Price</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-1.5">
                  {veItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                      <div className="col-span-4">
                        <input type="text" value={item.itemName}
                          onChange={e => updateVeRow(idx, 'itemName', e.target.value)}
                          placeholder="Item naam..."
                          className="w-full border border-slate-300 px-2 py-1.5 text-xs font-bold rounded focus:outline-none focus:border-amber-600" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={0} step={0.1} value={item.quantity}
                          onChange={e => updateVeRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full border border-slate-300 px-2 py-1.5 text-xs font-black rounded text-center focus:outline-none" />
                      </div>
                      <div className="col-span-2">
                        <select value={item.unit}
                          onChange={e => updateVeRow(idx, 'unit', e.target.value)}
                          className="w-full border border-slate-300 px-1 py-1.5 text-xs rounded focus:outline-none bg-white">
                          {['kg','g','L','ml','pcs','doz','dozen','box','pkt','bag','tin','bottle'].map(u =>
                            <option key={u} value={u}>{u}</option>
                          )}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={0} value={item.unitPrice}
                          onChange={e => updateVeRow(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          placeholder="₹"
                          className="w-full border border-slate-300 px-2 py-1.5 text-xs font-black rounded text-center focus:outline-none" />
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-[10px] font-black text-amber-700">
                          {item.total > 0 ? `₹${item.total.toLocaleString('en-IN')}` : '—'}
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        {veItems.length > 1 && (
                          <button type="button" onClick={() => removeVeRow(idx)}
                            className="text-red-400 hover:text-red-600 p-1">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 bg-amber-100 border border-amber-300 rounded p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700">
                    {veItems.filter(i => i.itemName).length} items
                  </span>
                  <span className="text-xl font-black text-amber-800">
                    Total: {formatCurrency(veTotal)}
                  </span>
                </div>
              </div>

              {veTotal > 0 && (
                <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">
                    Payment Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'none',    label: '⏳ Due (Baad mein)', hint: 'Vendor Payment se pay karna' },
                      { key: 'partial', label: '💰 Partial',          hint: 'Kuch abhi de do' },
                      { key: 'full',    label: '✅ Full Pay',          hint: 'Poora de do' },
                    ] as const).map(opt => (
                      <button key={opt.key} type="button"
                        onClick={() => {
                          setVePayNow(opt.key);
                          if (opt.key === 'full') setVePayAmount(String(veTotal));
                          if (opt.key === 'none') setVePayAmount('');
                        }}
                        className={`p-2.5 rounded-lg border-2 text-left ${
                          vePayNow === opt.key
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}>
                        <p className="text-[10px] font-black text-slate-800">{opt.label}</p>
                        <p className="text-[8px] text-slate-400">{opt.hint}</p>
                      </button>
                    ))}
                  </div>

                  {vePayNow === 'partial' && (
                    <input type="number" min={1} max={veTotal} value={vePayAmount}
                      onChange={e => setVePayAmount(e.target.value)}
                      className="w-full border border-amber-300 px-3 py-2 text-sm font-black rounded focus:outline-none"
                      placeholder={`Max: ${veTotal}`} />
                  )}

                  {vePayNow !== 'none' && (
                    <PaymentModeSelector
                      mode={vePaymentMode} setMode={setVePaymentMode}
                      checkNumber={veCheckNumber} setCheckNumber={setVeCheckNumber}
                      transactionId={veTransactionId} setTransactionId={setVeTransactionId}
                    />
                  )}
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded p-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Bill Upload
                </label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={e => setVeBillFile(e.target.files?.[0] ?? null)}
                  className="text-xs" />
                {veBillFile && (
                  <span className="text-[10px] text-green-600 font-bold ml-2">
                    ✓ {veBillFile.name}
                  </span>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
                <input type="text" value={veRemarks}
                  onChange={e => setVeRemarks(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                  placeholder="Note..." />
              </div>

              <button type="button" onClick={handleSaveVendorEntry}
                disabled={veLoading || !veVendorId || veTotal <= 0}
                className="bg-amber-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-amber-700 disabled:opacity-40 flex items-center gap-2 rounded w-full justify-center">
                {veLoading ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
                Save Entry — {formatCurrency(veTotal)}{' '}
                {vePayNow === 'none' ? '(Due)' : vePayNow === 'full' ? '(Paid)' : '(Partial)'}
              </button>
            </>
          )}
        </div>
      )}

      {/* CUSTOM CATEGORY FORM */}
      {showCatForm && (
        <div className="bg-purple-50 border border-purple-300 rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-purple-800 flex items-center gap-2">
              <Tag size={14} /> Add Custom Category
            </h3>
            <button onClick={() => setShowCatForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Category Name *
              </label>
              <input type="text" value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-xs font-bold rounded focus:outline-none focus:border-purple-600"
                placeholder="e.g. Bakery" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Emoji</label>
              <input type="text" value={newCatEmoji}
                onChange={e => setNewCatEmoji(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-sm rounded focus:outline-none"
                placeholder="📦" maxLength={2} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hint</label>
              <input type="text" value={newCatHint}
                onChange={e => setNewCatHint(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-xs rounded focus:outline-none"
                placeholder="Description" />
            </div>
          </div>
          <button onClick={handleSaveCategory}
            disabled={catLoading || !newCatLabel.trim()}
            className="bg-purple-600 text-white px-4 py-2 text-xs font-black uppercase rounded hover:bg-purple-700 disabled:opacity-40 flex items-center gap-2">
            {catLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Category
          </button>
        </div>
      )}

      {/* TABS */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {([
            { key: 'overview',    label: 'Category Overview', icon: <Wallet size={13} /> },
            { key: 'collections', label: 'Collections',       icon: <ArrowDownToLine size={13} />, count: collections.length },
            { key: 'expenses',    label: 'All Expenses',      icon: <ArrowUpFromLine size={13} />, count: expenses.length },
            {
              key: 'vendor_dues', label: 'Vendor Dues',
              icon: <Building2 size={13} />,
              count: messVendorDues.filter(v => v.totalDue > 0).length,
              countCls: messVendorDues.some(v => v.totalDue > 0)
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700',
            },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-black uppercase border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {tab.icon} {tab.label}
              {'count' in tab && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  'countCls' in tab ? tab.countCls : 'bg-slate-100 text-slate-600'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="bg-orange-50 border border-orange-200 rounded px-4 py-2.5 flex items-start gap-2">
            <Info size={13} className="text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-orange-700 font-semibold">
              Har category ka total expense + vendor dues.{' '}
              <strong>[+ Add]</strong> se expense add karo.
            </p>
          </div>

          {categoryTotals.map(cat => {
            const isExpanded = expandedCat === cat.key;
            const pct = totalExpense > 0
              ? Math.round((cat.total / totalExpense) * 100) : 0;

            return (
              <div key={cat.key}
                className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedCat(isExpanded ? null : cat.key)}>
                  <span className="text-2xl">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-800">{cat.label}</span>
                      {!cat.isFixed && (
                        <span className="text-[8px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                          Custom
                        </span>
                      )}
                      {cat.pending > 0 && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          {cat.pending} bill pending
                        </span>
                      )}
                      {cat.vendorDue > 0 && (
                        <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Building2 size={8} /> {formatCurrency(cat.vendorDue)} vendor due
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {cat.hint} · {cat.vendorCount} vendors
                    </p>
                    {cat.total > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-48">
                          <div
                            className="h-1.5 rounded-full bg-red-400"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">{pct}%</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-black text-red-600">
                        {cat.total > 0 ? formatCurrency(cat.total) : '₹0'}
                      </p>
                      <p className="text-[9px] text-slate-400">{cat.count} entries</p>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setExpCategory(cat.key);
                        setShowExpenseForm(true);
                        setShowCollectionForm(false);
                        setShowVendorEntryForm(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1 text-[9px] font-black bg-red-50 text-red-600 border border-red-200 px-2.5 py-1.5 rounded hover:bg-red-100">
                      <Plus size={10} /> Add
                    </button>
                    {!cat.isFixed && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteConfirm({ type: 'cat', id: cat.key, label: cat.label });
                        }}
                        className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50">
                        <Trash2 size={12} />
                      </button>
                    )}
                    {isExpanded
                      ? <ChevronUp size={16} className="text-slate-400" />
                      : <ChevronDown size={16} className="text-slate-400" />
                    }
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50">
                    {cat.expenses.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <p className="text-xs font-bold">Koi expense nahi</p>
                        <button
                          onClick={() => {
                            setExpCategory(cat.key);
                            setShowExpenseForm(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="mt-2 text-[10px] font-bold text-red-600 hover:underline">
                          + Pehla expense add karo
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {cat.expenses.map(exp => {
                          const bsc = BILL_STATUS_CONFIG[exp.billStatus] ?? BILL_STATUS_CONFIG['Pending'];
                          return (
                            <div key={exp.id}
                              className="px-4 py-2.5 flex items-center gap-3 hover:bg-white">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-black text-red-600">
                                    {formatCurrency(exp.amount)}
                                  </span>
                                  {exp.vendor && (
                                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                      <Building2 size={8} /> {exp.vendor}
                                    </span>
                                  )}
                                  <PaymentModeBadge
                                    mode={exp.paymentMode}
                                    checkNumber={exp.checkNumber}
                                    transactionId={exp.transactionId}
                                  />
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${bsc.cls}`}>
                                    {exp.billStatus}
                                  </span>
                                  {exp.dueAmount > 0 && (
                                    <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                      Due: {formatCurrency(exp.dueAmount)}
                                    </span>
                                  )}
                                  {exp.vendorId && (
                                    <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                                      Vendor Linked
                                    </span>
                                  )}
                                </div>
                                {exp.remarks && (
                                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                    {exp.remarks}
                                  </p>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 flex-shrink-0">
                                {formatDate(exp.date)}
                              </span>
                              <button
                                onClick={() => setDeleteConfirm({
                                  type: 'exp', id: exp.id,
                                  label: `${cat.label} - ${formatCurrency(exp.amount)}`,
                                })}
                                className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="bg-orange-100 border-2 border-orange-300 rounded p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-orange-700 uppercase">
                Total Mess Fund Orders
              </p>
              <p className="text-[10px] text-orange-600 mt-0.5">
                {allCategories.length} categories · {messVendorDues.length} vendors
              </p>
            </div>
            <p className="text-2xl font-black text-orange-800">{formatCurrency(totalExpense)}</p>
          </div>
        </div>
      )}

      {/* TAB: COLLECTIONS */}
      {activeTab === 'collections' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded p-3">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5">
              <Calendar size={11} /> Month-wise Collection Status
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {monthOptions.map(m => {
                const rec = collections.find(c => c.month === m.value);
                return (
                  <div key={m.value}
                    className={`p-2 rounded border-2 text-left ${
                      rec ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'
                    }`}>
                    <p className="text-[10px] font-black text-slate-700 truncate">
                      {m.label.split(' ')[0]}
                    </p>
                    <p className="text-[9px] text-slate-400">{m.label.split(' ')[1]}</p>
                    {rec ? (
                      <div className="mt-1 flex items-center gap-0.5 text-[9px] font-black text-green-600">
                        <CheckCircle2 size={9} /> {formatCurrency(rec.amount)}
                      </div>
                    ) : (
                      <div className="mt-1 text-[9px] font-bold text-amber-600">⚠ Pending</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {collections.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Receipt size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi collection nahi</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 text-[9px] font-black uppercase text-slate-500 rounded">
                <div className="col-span-2">Month</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1">Per Head</div>
                <div className="col-span-1">Count</div>
                <div className="col-span-2">Mode</div>
                <div className="col-span-2">Remarks</div>
                <div className="col-span-1 text-right">Amount</div>
                <div className="col-span-1 text-center">Del</div>
              </div>
              {collections.map((c, idx) => (
                <div key={c.id}
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center border rounded ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  } border-slate-100`}>
                  <div className="col-span-2">
                    <p className="text-[10px] font-black text-slate-800">{c.monthLabel}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-500">{formatDate(c.date)}</p>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] font-bold text-slate-600">₹{c.perHead}</p>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] font-bold text-slate-600">{c.traineeCount}</p>
                  </div>
                  <div className="col-span-2">
                    <PaymentModeBadge
                      mode={c.paymentMode}
                      checkNumber={c.checkNumber}
                      transactionId={c.transactionId}
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-400 truncate">{c.remarks || '—'}</p>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-sm font-black text-green-700">
                      +{formatCurrency(c.amount)}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      onClick={() => setDeleteConfirm({
                        type: 'col', id: c.id,
                        label: `${c.monthLabel} collection`,
                      })}
                      className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: ALL EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded p-3">
            <Filter size={12} className="text-slate-400" />
            <button onClick={() => setExpFilterCat('All')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${
                expFilterCat === 'All'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'border-slate-300 text-slate-500'
              }`}>
              All ({expenses.length})
            </button>
            {allCategories.map(cat => {
              const cnt = expenses.filter(e => e.category === cat.key).length;
              if (cnt === 0) return null;
              return (
                <button key={cat.key} onClick={() => setExpFilterCat(cat.key)}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-full border flex items-center gap-1 ${
                    expFilterCat === cat.key
                      ? 'bg-red-600 text-white border-red-600'
                      : 'border-slate-300 text-slate-500'
                  }`}>
                  {cat.emoji} {cat.label} ({cnt})
                </button>
              );
            })}
            <span className="ml-auto text-[10px] font-bold text-red-600">
              {formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ArrowUpFromLine size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi expense nahi</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 text-[9px] font-black uppercase text-slate-500 rounded">
                <div className="col-span-1">Date</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Vendor</div>
                <div className="col-span-2">Remarks</div>
                <div className="col-span-1">Mode</div>
                <div className="col-span-1 text-center">Bill</div>
                <div className="col-span-1 text-center">Due</div>
                <div className="col-span-1 text-right">Amount</div>
                <div className="col-span-1 text-center">Del</div>
              </div>
              {filteredExpenses.map((exp, idx) => {
                const catInfo = allCategories.find(c => c.key === exp.category);
                const bsc = BILL_STATUS_CONFIG[exp.billStatus] ?? BILL_STATUS_CONFIG['Pending'];
                return (
                  <div key={exp.id}
                    className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center border rounded ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    } border-slate-100`}>
                    <div className="col-span-1">
                      <p className="text-[10px] font-bold text-slate-600">{formatDate(exp.date)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                        {catInfo?.emoji ?? '📦'} {catInfo?.label ?? exp.category}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-600 truncate flex items-center gap-0.5">
                        {exp.vendorId && <Building2 size={8} className="text-blue-500" />}
                        {exp.vendor || '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400 truncate">{exp.remarks || '—'}</p>
                    </div>
                    <div className="col-span-1">
                      {exp.paymentMode
                        ? <PaymentModeBadge mode={exp.paymentMode} checkNumber={exp.checkNumber} transactionId={exp.transactionId} />
                        : <span className="text-[9px] text-slate-300">—</span>
                      }
                    </div>
                    <div className="col-span-1 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${bsc.cls}`}>
                        {exp.billStatus}
                      </span>
                    </div>
                    <div className="col-span-1 text-center">
                      {exp.dueAmount > 0 ? (
                        <span className="text-[9px] font-black text-red-600 bg-red-50 px-1 py-0.5 rounded">
                          {formatCurrency(exp.dueAmount)}
                        </span>
                      ) : exp.vendorId ? (
                        <span className="text-[9px] font-bold text-green-600">✓ Paid</span>
                      ) : (
                        <span className="text-[9px] text-slate-300">—</span>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-sm font-black text-red-600">
                        −{formatCurrency(exp.amount)}
                      </span>
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        onClick={() => setDeleteConfirm({
                          type: 'exp', id: exp.id,
                          label: `${catInfo?.label ?? exp.category} - ${formatCurrency(exp.amount)}`,
                        })}
                        className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: VENDOR DUES */}
      {activeTab === 'vendor_dues' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Mess Vendors</p>
              <p className="text-2xl font-black text-slate-700">{messVendorDues.length}</p>
            </div>
            <div className={`border rounded p-3 text-center ${
              totalMessVendorDue > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Due</p>
              <p className={`text-2xl font-black ${
                totalMessVendorDue > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(totalMessVendorDue)}
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Paid</p>
              <p className="text-2xl font-black text-green-600">
                {formatCurrency(messVendorDues.reduce((s, v) => s + v.totalPaid, 0))}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded px-4 py-2.5 flex items-start gap-2">
            <Info size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 font-semibold">
              Yahan sirf Mess Fund se linked vendor dues dikhte hain.
              Payment ke liye <strong>Vendor Payment</strong> screen pe jao aur{' '}
              <strong>Mess Fund</strong> select karo.
            </p>
          </div>

          {messVendorDues.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi vendor due nahi</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messVendorDues.map(vd => {
                const vendor = vendors.find(v => v.id === vd.vendorId);
                const cat    = allCategories.find(c => c.label === vd.categoryLabel);
                return (
                  <div key={vd.vendorId}
                    className={`bg-white border-2 rounded-lg p-4 ${
                      vd.totalDue > 0 ? 'border-red-200' : 'border-green-200'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl">
                          {cat?.emoji ?? '🏪'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{vd.vendorName}</p>
                          <p className="text-[10px] text-slate-500">
                            {vd.categoryLabel} · {vd.entries} entries
                          </p>
                          {vendor?.phone && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Phone size={9} /> {vendor.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">Total</p>
                          <p className="text-xs font-black text-slate-700">
                            {formatCurrency(vd.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-green-500 font-bold uppercase">Paid</p>
                          <p className="text-xs font-black text-green-600">
                            {formatCurrency(vd.totalPaid)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">Due</p>
                          <p className={`text-sm font-black ${
                            vd.totalDue > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatCurrency(vd.totalDue)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border shadow-2xl max-w-sm w-full rounded p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-slate-800">Delete karna hai?</p>
                <p className="text-xs text-slate-500 mt-1">
                  "{deleteConfirm.label}" — wapas nahi aayega
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-1.5 text-xs font-bold border border-slate-300 hover:bg-slate-50 uppercase rounded">
                Cancel
              </button>
              <button onClick={handleDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 uppercase rounded">
                Haan, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BILL PREVIEW MODAL */}
      {previewBill && (
        <BillPreviewModal bill={previewBill} onClose={() => setPreviewBill(null)} />
      )}
    </div>
  );
};

export default MessFundScreen;