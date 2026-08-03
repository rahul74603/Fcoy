import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Plus, Loader2, X, CheckCircle2, AlertTriangle,
  RefreshCw, TrendingUp, TrendingDown, Info, Trash2,
  ArrowRightLeft, ArrowUpFromLine, Building2, Receipt,
  Briefcase, Shield, Phone
} from 'lucide-react';

import {
  collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, serverTimestamp
} from 'firebase/firestore';

import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';

import {
  PaymentModeSelector,
  validatePaymentMode,
  getPaymentRef,
  type PaymentMode
} from '../../shared/PaymentModeSelector';

import {
  formatCurrency,
  formatDate,
  processBillFile
} from '../shared/utils';

import { BILL_STATUS_CONFIG } from '../shared/constants';
import type { Vendor, VendorEntry, BillAttachment } from '../vendors/types';
import BillPreviewModal from '../shared/BillPreviewModal';
import { ModuleReportButton } from '../../system/ModuleReportButton';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface GeneralCollection {
  id: string;
  amount: number;
  collectionType: 'manual' | 'transfer_in';
  label: string;
  remarks: string;
  paymentMode: string;
  checkNumber: string;
  transactionId: string;
  recordedBy: string;
  date: string;
  sourceFundKey?: string;
  sourceFundLabel?: string;
}

interface GeneralExpense {
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
  billFileName: string;
  billFileType: string;
  billFileSize: number;
  recordedBy: string;
  date: string;
  dueAmount: number;
  paidAmount: number;
}

interface FundTransfer {
  id: string;
  fromFundKey: string;
  fromFundLabel: string;
  toFundKey: string;
  toFundLabel: string;
  amount: number;
  remarks: string;
  transferredBy: string;
  date: string;
  linkedCollectionId?: string;
}

interface FundSnapshot {
  key: string;
  label: string;
  emoji: string;
  totalCollection: number;
  totalOrders: number;
  actuallyPaid: number;
  transferredOut: number;
  balance: number;
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

interface GeneralCategory {
  key: string;
  label: string;
  emoji: string;
  hint: string;
}

const GENERAL_CATEGORIES: GeneralCategory[] = [
  { key: 'mess_boy_salary', label: 'Mess Boys Salary', emoji: '👨‍🍳', hint: 'Cook / helper salary' },
  { key: 'salary', label: 'Salary', emoji: '💼', hint: 'General staff salary' },
  { key: 'misc_purchase', label: 'Misc Purchase', emoji: '🛒', hint: 'General small purchase' },
  { key: 'maintenance', label: 'Maintenance', emoji: '🛠️', hint: 'Repair / upkeep' },
  { key: 'welfare', label: 'Welfare', emoji: '🤝', hint: 'Welfare expense' },
  { key: 'emergency', label: 'Emergency', emoji: '🚨', hint: 'Emergency use' },
  { key: 'transport', label: 'Transport', emoji: '🚚', hint: 'Vehicle / movement' },
  { key: 'stationery', label: 'Stationery', emoji: '📝', hint: 'Office / records' },
  { key: 'other', label: 'Other', emoji: '📦', hint: 'Other general expense' },
];

const SOURCE_FUNDS = [
  {
    key: 'mess_fund',
    label: 'Mess Fund',
    emoji: '🍽️',
    collectionName: 'mess_fund_collections',
    expenseName: 'mess_fund_expenses',
  },
  {
    key: 'company_assets_fund',
    label: 'Company Assets Fund',
    emoji: '🏛️',
    collectionName: 'company_assets_collections',
    expenseName: 'company_assets_expenses',
  },
  {
    key: 'training_fund',
    label: 'Training Essentials Fund',
    emoji: '🎓',
    collectionName: 'training_fund_collections',
    expenseName: 'training_fund_expenses',
  },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const calcActuallyPaid = (expList: any[]): number =>
  expList.reduce((s, e) => {
    if (e.vendorId) return s + Number(e.paidAmount ?? 0);
    return s + Number(e.amount ?? 0);
  }, 0);

// ═════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════
export const GeneralFundScreen: React.FC = () => {
  const { user } = useAuth();
  const recordedBy = user?.email ?? 'Quarter Master';

  // ── DATA ──
  const [collections, setCollections] = useState<GeneralCollection[]>([]);
  const [expenses, setExpenses] = useState<GeneralExpense[]>([]);
  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  const [sourceFunds, setSourceFunds] = useState<FundSnapshot[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorEntries, setVendorEntries] = useState<VendorEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── TRANSFER FORM ──
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferFromFundKey, setTransferFromFundKey] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

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
  const [expBillStatus, setExpBillStatus] = useState<GeneralExpense['billStatus']>('Received');
  const [expBillFile, setExpBillFile] = useState<File | null>(null);
  const [expPayNow, setExpPayNow] = useState<'full' | 'partial' | 'none'>('none');
  const [expPayAmount, setExpPayAmount] = useState('');
  const [expLoading, setExpLoading] = useState(false);

  // ── QUICK VENDOR ──
  const [showQuickVendor, setShowQuickVendor] = useState(false);
  const [qvName, setQvName] = useState('');
  const [qvPhone, setQvPhone] = useState('');
  const [qvLoading, setQvLoading] = useState(false);

  // ── UI ──
  const [activeTab, setActiveTab] = useState<'overview' | 'transfers' | 'collections' | 'expenses' | 'vendor_dues'>('overview');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewBill, setPreviewBill] = useState<BillAttachment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'transfer' | 'exp' | 'col';
    id: string;
    label: string;
  } | null>(null);

  // ─────────────────────────────────────────
  // FETCH
  // ─────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [
        colSnap,
        expSnap,
        transferSnap,
        vendorSnap,
        entrySnap,
      ] = await Promise.all([
               getDocs(collection(db, 'general_fund_collections')),
        getDocs(collection(db, 'general_fund_expenses')),
        getDocs(collection(db, 'fund_transfers')),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'vendor_entries')),
      ]);

      // General Collections
      const colList: GeneralCollection[] = [];
      colSnap.forEach(d => {
        const data = d.data();
        colList.push({
          id: d.id,
          amount: Number(data.amount ?? 0),
          collectionType: data.collectionType ?? 'manual',
          label: data.label ?? '',
          remarks: data.remarks ?? '',
          paymentMode: data.paymentMode ?? '',
          checkNumber: data.checkNumber ?? '',
          transactionId: data.transactionId ?? '',
          recordedBy: data.recordedBy ?? '',
          date: data.date ?? '',
          sourceFundKey: data.sourceFundKey ?? '',
          sourceFundLabel: data.sourceFundLabel ?? '',
        });
      });
      colList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCollections(colList);

      // General Expenses
      const expList: GeneralExpense[] = [];
      expSnap.forEach(d => {
        const data = d.data();
        expList.push({
          id: d.id,
          amount: Number(data.amount ?? 0),
          category: data.category ?? 'other',
          categoryLabel: data.categoryLabel ?? data.category ?? 'Other',
          vendor: data.vendor ?? '',
          vendorId: data.vendorId ?? data.linkedVendorId ?? '',
          linkedEntryId: data.linkedEntryId ?? '',
          remarks: data.remarks ?? '',
          paymentMode: data.paymentMode ?? '',
          checkNumber: data.checkNumber ?? '',
          transactionId: data.transactionId ?? '',
          billStatus: data.billStatus ?? 'Pending',
          billBase64: data.billBase64 ?? '',
          billFileName: data.billFileName ?? '',
          billFileType: data.billFileType ?? '',
          billFileSize: Number(data.billFileSize ?? 0),
          recordedBy: data.recordedBy ?? '',
          date: data.date ?? '',
          dueAmount: Number(data.dueAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
        });
      });
      expList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(expList);

      // Transfers
      const transferList: FundTransfer[] = [];
      transferSnap.forEach(d => {
        const data = d.data();
        transferList.push({
          id: d.id,
          fromFundKey: data.fromFundKey ?? '',
          fromFundLabel: data.fromFundLabel ?? '',
          toFundKey: data.toFundKey ?? '',
          toFundLabel: data.toFundLabel ?? '',
          amount: Number(data.amount ?? 0),
          remarks: data.remarks ?? '',
          transferredBy: data.transferredBy ?? '',
          date: data.date ?? '',
          linkedCollectionId: data.linkedCollectionId ?? '',
        });
      });
      transferList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransfers(transferList);

      // Vendors
      const vList: Vendor[] = [];
      vendorSnap.forEach(d => {
        const data = d.data();
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
      const veList: VendorEntry[] = [];
      entrySnap.forEach(d => {
        const data = d.data();
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
          ...(data.linkedExpenseId ? { linkedExpenseId: data.linkedExpenseId } : {}),
        } as VendorEntry & { fundKey?: string; linkedExpenseId?: string });
      });
      veList.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
      setVendorEntries(veList);

      // Source Funds Snapshot
      const sourceSnapshots: FundSnapshot[] = [];
      for (const src of SOURCE_FUNDS) {
        const [srcColSnap, srcExpSnap] = await Promise.all([
          getDocs(collection(db, src.collectionName)),
          getDocs(collection(db, src.expenseName)),
        ]);

        let totalCollection = 0;
        const srcExpList: any[] = [];

        srcColSnap.forEach(d => {
          totalCollection += Number(d.data().amount ?? 0);
        });

        srcExpSnap.forEach(d => {
          const data = d.data();
          srcExpList.push({
            amount: Number(data.amount ?? 0),
            vendorId: data.vendorId ?? data.linkedVendorId ?? '',
            paidAmount: Number(data.paidAmount ?? 0),
          });
        });

        const totalOrders = srcExpList.reduce((s, e) => s + e.amount, 0);
        const actuallyPaid = calcActuallyPaid(srcExpList);
        const transferredOut = transferList
          .filter(t => t.fromFundKey === src.key)
          .reduce((s, t) => s + t.amount, 0);

        sourceSnapshots.push({
          key: src.key,
          label: src.label,
          emoji: src.emoji,
          totalCollection,
          totalOrders,
          actuallyPaid,
          transferredOut,
          balance: totalCollection - actuallyPaid - transferredOut,
        });
      }

      setSourceFunds(sourceSnapshots);

    } catch (err) {
      console.error(err);
      setErrorMsg('Data load nahi hua');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ─────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────
  const totalCollection = collections.reduce((s, c) => s + c.amount, 0);
  const totalOrders = expenses.reduce((s, e) => s + e.amount, 0);

  const totalActuallyPaid = expenses.reduce((s, e) => {
    if (e.vendorId) return s + (e.paidAmount ?? 0);
    return s + e.amount;
  }, 0);

  const generalBalance = totalCollection - totalActuallyPaid;
  const totalPendingDue = expenses.reduce((s, e) => s + (e.dueAmount ?? 0), 0);

  const generalVendorDues: VendorDueSummary[] = (() => {
    const dueMap: Record<string, VendorDueSummary> = {};

    vendorEntries.forEach(ve => {
      const fundKey = (ve as any).fundKey;
      if (fundKey !== 'general_fund') return;
      if (ve.dueAmount <= 0) return;

      const vendor = vendors.find(v => v.id === ve.vendorId);

      if (!dueMap[ve.vendorId]) {
        dueMap[ve.vendorId] = {
          vendorId: ve.vendorId,
          vendorName: vendor?.name ?? ve.vendorName,
          categoryLabel: vendor?.categoryLabel ?? ve.categoryLabel,
          totalAmount: 0,
          totalPaid: 0,
          totalDue: 0,
          entries: 0,
        };
      }

      dueMap[ve.vendorId].totalAmount += ve.totalAmount;
      dueMap[ve.vendorId].totalPaid += ve.paidAmount;
      dueMap[ve.vendorId].totalDue += ve.dueAmount;
      dueMap[ve.vendorId].entries += 1;
    });

    return Object.values(dueMap).sort((a, b) => b.totalDue - a.totalDue);
  })();

  const selectedSourceFund = sourceFunds.find(f => f.key === transferFromFundKey);

  // ─────────────────────────────────────────
  // TRANSFER SAVE
  // ─────────────────────────────────────────
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!transferFromFundKey) {
      setErrorMsg('Source fund select karo');
      return;
    }

    if (!transferAmount || Number(transferAmount) <= 0) {
      setErrorMsg('Transfer amount daalo');
      return;
    }

    const source = sourceFunds.find(f => f.key === transferFromFundKey);
    if (!source) {
      setErrorMsg('Source fund nahi mila');
      return;
    }

    if (Number(transferAmount) > source.balance) {
      setErrorMsg(
        `${source.label} mein sirf ${formatCurrency(source.balance)} available hai`
      );
      return;
    }

    setTransferLoading(true);
    try {
      const now = new Date().toISOString();
      const amount = Number(transferAmount);

      // 1. General fund collection banao
            // 1. General fund collection banao
      const colRef = await addDoc(collection(db, 'general_fund_collections'), {
        amount,
        collectionType: 'transfer_in',
        label: `Transfer from ${source.label}`,
        remarks: transferRemarks || `Surplus transferred from ${source.label}`,
        paymentMode: 'Transfer',
        checkNumber: '',
        transactionId: '',
        recordedBy,
        sourceFundKey: source.key,
        sourceFundLabel: source.label,
        date: now,
        createdAt: serverTimestamp(),
      });

      // 2. Transfer ledger record
      await addDoc(collection(db, 'fund_transfers'), {
        fromFundKey: source.key,
        fromFundLabel: source.label,
        toFundKey: 'general_fund',
        toFundLabel: 'General Fund',
        amount,
        remarks: transferRemarks || `Surplus transferred from ${source.label}`,
        transferredBy: recordedBy,
        linkedCollectionId: colRef.id,
        date: now,
        createdAt: serverTimestamp(),
      });

      setSuccessMsg(
        `✓ ${formatCurrency(amount)} transferred from ${source.label} to General Fund`
      );

      setTransferFromFundKey('');
      setTransferAmount('');
      setTransferRemarks('');
      setShowTransferForm(false);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Transfer save nahi hua');
    } finally {
      setTransferLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // SAVE EXPENSE
  // ─────────────────────────────────────────
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!expCategory) {
      setErrorMsg('Category select karo');
      return;
    }

    if (!expAmount || Number(expAmount) <= 0) {
      setErrorMsg('Amount daalo');
      return;
    }

    if (Number(expAmount) > generalBalance) {
      setErrorMsg(`General Fund mein sirf ${formatCurrency(generalBalance)} available hai`);
      return;
    }

    if (expPayNow !== 'none') {
      const payErr = validatePaymentMode(expPaymentMode, expCheckNumber, expTransactionId);
      if (payErr) {
        setErrorMsg(payErr);
        return;
      }
    }

    setExpLoading(true);
    try {
      let billBase64 = '', billFileName = '', billFileType = '', billFileSize = 0;

      if (expBillFile) {
        const result = await processBillFile(expBillFile);
        if (result.error) {
          setErrorMsg(result.error);
          setExpLoading(false);
          return;
        }
        if (result.data) {
          billBase64 = result.data.billBase64;
          billFileName = result.data.billFileName;
          billFileType = result.data.billFileType;
          billFileSize = result.data.billFileSize;
        }
      }

      const amount = Number(expAmount);
      const catInfo = GENERAL_CATEGORIES.find(c => c.key === expCategory);
      const vendor = vendors.find(v => v.id === expVendorId);
      const vendorName = vendor?.name ?? expVendorName ?? '';

      let paidAmount = 0;
      let dueAmount = amount;

      if (!expVendorId) {
        paidAmount = amount;
        dueAmount = 0;
      } else if (expPayNow === 'full') {
        paidAmount = amount;
        dueAmount = 0;
      } else if (expPayNow === 'partial') {
        paidAmount = Math.min(Number(expPayAmount) || 0, amount);
        dueAmount = amount - paidAmount;
      } else {
        paidAmount = 0;
        dueAmount = amount;
      }

           const expenseRef = await addDoc(collection(db, 'general_fund_expenses'), {
        amount,
        category: expCategory,
        categoryLabel: catInfo?.label ?? expCategory,
        vendor: vendorName,
        vendorId: expVendorId,
        remarks: expRemarks,
        paymentMode: expPayNow !== 'none' ? expPaymentMode : (expVendorId ? '' : expPaymentMode),
        checkNumber:
          ((expPayNow !== 'none') || !expVendorId) && expPaymentMode === 'Check'
            ? expCheckNumber
            : '',
        transactionId:
          ((expPayNow !== 'none') || !expVendorId)
            ? getPaymentRef(expPaymentMode, expCheckNumber, expTransactionId)
            : '',
        billStatus: billBase64 ? 'Received' : expBillStatus,
        billBase64,
        billFileName,
        billFileType,
        billFileSize,
        paidAmount,
        dueAmount,
        recordedBy,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });

      let linkedEntryId = '';
      if (expVendorId && vendor) {
        const bills: BillAttachment[] = [];
        if (billBase64) {
          bills.push({
            id: `bill_${Date.now()}`,
            base64: billBase64,
            fileName: billFileName,
            fileType: billFileType,
            fileSize: billFileSize,
            uploadedAt: new Date().toISOString(),
            uploadedBy: recordedBy,
          });
        }

        const veRef = await addDoc(collection(db, 'vendor_entries'), {
          vendorId: expVendorId,
          vendorName: vendor.name,
          categoryKey: vendor.categoryKey,
          categoryLabel: vendor.categoryLabel,
          items: [{
            itemName: catInfo?.label ?? expCategory,
            quantity: 1,
            unit: 'pcs',
            unitPrice: amount,
            total: amount,
          }],
          totalAmount: amount,
          paidAmount,
          dueAmount,
          status: dueAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending',
          entryDate: new Date().toISOString(),
          remarks: expRemarks || `General Fund Expense — ${catInfo?.label ?? expCategory}`,
          bills,
          fundKey: 'general_fund',
          linkedExpenseId: expenseRef.id,
          createdBy: recordedBy,
          createdAt: serverTimestamp(),
        });

        linkedEntryId = veRef.id;

                await updateDoc(doc(db, 'general_fund_expenses', expenseRef.id), {
          linkedEntryId: veRef.id,
          linkedVendorId: expVendorId,
        });
      }

      if (expVendorId && paidAmount > 0) {
        await addDoc(collection(db, 'vendor_payments'), {
          vendorId: expVendorId,
          vendorName,
          entryId: linkedEntryId,
          categoryKey: vendor?.categoryKey ?? expCategory,
          categoryLabel: vendor?.categoryLabel ?? catInfo?.label ?? expCategory,
          paidAmount,
          fundKey: 'general_fund',
          fundLabel: 'General Fund',
          paymentMode: expPaymentMode,
          checkNumber: expPaymentMode === 'Check' ? expCheckNumber : '',
          transactionId: getPaymentRef(expPaymentMode, expCheckNumber, expTransactionId),
          remarks: expRemarks || `General fund expense payment`,
          paidBy: recordedBy,
          paidAt: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
      }

      setSuccessMsg(
        `✓ ${catInfo?.label ?? expCategory}: ${formatCurrency(amount)} saved!` +
        (vendorName ? ` Vendor: ${vendorName}` : '') +
        (dueAmount > 0 ? ` · Due: ${formatCurrency(dueAmount)}` : ' · Fully Paid!')
      );

      setExpCategory('');
      setExpAmount('');
      setExpVendorId('');
      setExpVendorName('');
      setExpRemarks('');
      setExpCheckNumber('');
      setExpTransactionId('');
      setExpBillFile(null);
      setExpBillStatus('Received');
      setExpPayNow('none');
      setExpPayAmount('');
      setShowExpenseForm(false);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Save nahi hua');
    } finally {
      setExpLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // QUICK ADD VENDOR
  // ─────────────────────────────────────────
  const handleQuickAddVendor = async () => {
    if (!qvName.trim()) {
      setErrorMsg('Vendor naam daalo');
      return;
    }

    setQvLoading(true);
    try {
      const ref = await addDoc(collection(db, 'vendors'), {
        name: qvName.trim(),
        phone: qvPhone.trim(),
        address: '',
        categoryKey: 'general_fund',
        categoryLabel: 'General Fund',
        isActive: true,
        notes: '',
        createdAt: serverTimestamp(),
        createdBy: recordedBy,
      });

      setSuccessMsg(`✓ Vendor "${qvName}" add ho gaya!`);
      setExpVendorId(ref.id);
      setExpVendorName(qvName.trim());
      setQvName('');
      setQvPhone('');
      setShowQuickVendor(false);
      await fetchAllData();
    } catch {
      setErrorMsg('Vendor save nahi hua');
    } finally {
      setQvLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
           if (deleteConfirm.type === 'transfer') {
        const transfer = transfers.find(t => t.id === deleteConfirm.id);
        if (transfer?.linkedCollectionId) {
          await deleteDoc(doc(db, 'general_fund_collections', transfer.linkedCollectionId));
        }
        await deleteDoc(doc(db, 'fund_transfers', deleteConfirm.id));
      } else if (deleteConfirm.type === 'exp') {
        await deleteDoc(doc(db, 'general_fund_expenses', deleteConfirm.id));
      } else {
        await deleteDoc(doc(db, 'general_fund_collections', deleteConfirm.id));
      }

      setSuccessMsg(`${deleteConfirm.label} delete ho gaya`);
      setDeleteConfirm(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Delete nahi hua');
    }
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-slate-700 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center text-xl">💰</div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">General Fund</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Surplus Transfer · Salary / Misc Expense · Central Reserve Fund
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModuleReportButton module="general" stats={[{ label: 'Collections', value: formatCurrency(totalCollection) }, { label: 'Purchases', value: formatCurrency(totalOrders) }, { label: 'Paid', value: formatCurrency(totalActuallyPaid) }, { label: 'Balance', value: formatCurrency(generalBalance) }, { label: 'Vendor Due', value: formatCurrency(generalVendorDues.reduce((s, v) => s + v.totalDue, 0)) }]} rows={[...collections.map(c => ({ item: c.label || 'Collection', quantity: 1, amount: c.amount, status: c.collectionType === 'transfer_in' ? 'Transfer In' : 'Collection', detail: c.sourceFundLabel || c.remarks })), ...vendorEntries.filter(v => (v as any).fundKey === 'general_fund').flatMap(v => (v.items || []).map(i => ({ item: i.itemName || 'Purchase', quantity: i.quantity, unitPrice: i.unitPrice, amount: i.total || i.quantity * i.unitPrice, status: v.dueAmount > 0 ? `Due ${formatCurrency(v.dueAmount)}` : 'Paid', detail: v.vendorName }))), ...expenses.filter(e => !vendorEntries.some(v => v.id === e.linkedEntryId)).map(e => ({ item: e.itemName || e.remarks || 'Expense', quantity: 1, amount: e.amount, status: e.dueAmount > 0 ? `Due ${formatCurrency(e.dueAmount)}` : 'Paid', detail: e.vendor || e.remarks }))]} />
          <button onClick={fetchAllData} disabled={dataLoading} className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded"><RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} /> Refresh</button>
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

      {/* MAIN CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <p className="text-xl font-black text-orange-700">{formatCurrency(totalOrders)}</p>
          <p className="text-[10px] text-orange-600 mt-1">{expenses.length} entries</p>
        </div>

        <div className="bg-white border border-red-200 border-l-4 border-l-red-500 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Actually Paid</p>
            <TrendingDown size={14} className="text-red-400" />
          </div>
          <p className="text-xl font-black text-red-600">{formatCurrency(totalActuallyPaid)}</p>
          <p className="text-[10px] text-red-500 mt-1">Paisa gaya</p>
        </div>

        <div className={`border-l-4 rounded p-4 shadow-sm ${
          generalBalance >= 0
            ? 'bg-blue-50 border border-blue-200 border-l-blue-500'
            : 'bg-red-100 border border-red-300 border-l-red-600'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Cash in Hand</p>
            <Wallet size={14} className="text-blue-500" />
          </div>
          <p className={`text-xl font-black ${generalBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {generalBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(generalBalance))}
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
            <Building2 size={14} className={totalPendingDue > 0 ? 'text-amber-400' : 'text-green-400'} />
          </div>
          <p className={`text-xl font-black ${totalPendingDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {formatCurrency(totalPendingDue)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Vendor ko dena hai</p>
        </div>
      </div>

      {/* INFO */}
      <div className="bg-slate-50 border border-slate-200 rounded px-4 py-3 flex items-start gap-2">
        <Info size={14} className="text-slate-600 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-slate-700 space-y-1">
          <p><strong>General Fund ka purpose:</strong> Bacha hua / surplus paisa ek central fund me transfer karke salary, misc kharcha, emergency use ke liye rakhna.</p>
          <p><strong>Transfer rule:</strong> Source fund se sirf utna hi transfer karo jitna usme actual available balance ho.</p>
          <p><strong>Expense rule:</strong> Yahan se salary, misc kharcha ya vendor payment linked expense record ho sakta hai.</p>
        </div>
      </div>

      {/* SOURCE FUND SNAPSHOT */}
      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5">
          <Shield size={11} /> Source Funds Available for Transfer
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sourceFunds.map(f => (
            <button
              key={f.key}
              onClick={() => {
                setTransferFromFundKey(f.key);
                setShowTransferForm(true);
                setShowExpenseForm(false);
              }}
              className={`text-left border-2 rounded-xl p-4 transition-all ${
                transferFromFundKey === f.key
                  ? 'border-slate-700 bg-slate-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl">{f.emoji}</p>
                  <p className="text-sm font-black text-slate-800 mt-1">{f.label}</p>
                </div>
                <ArrowRightLeft size={16} className="text-slate-400" />
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-green-600 font-bold">Collection: {formatCurrency(f.totalCollection)}</p>
                <p className="text-[10px] text-red-500 font-bold">Paid: {formatCurrency(f.actuallyPaid)}</p>
                {f.transferredOut > 0 && (
                  <p className="text-[10px] text-purple-600 font-bold">Transferred: {formatCurrency(f.transferredOut)}</p>
                )}
                <p className={`text-sm font-black ${f.balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  Available: {formatCurrency(f.balance)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setShowTransferForm(!showTransferForm);
            setShowExpenseForm(false);
          }}
          className="flex items-center gap-1.5 bg-slate-800 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-slate-900 rounded"
        >
          <ArrowRightLeft size={13} /> Transfer to General Fund
        </button>

        <button
          onClick={() => {
            setShowExpenseForm(!showExpenseForm);
            setShowTransferForm(false);
          }}
          className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-red-700 rounded"
        >
          <ArrowUpFromLine size={13} /> Add General Expense
        </button>
      </div>

      {/* TRANSFER FORM */}
      {showTransferForm && (
        <form onSubmit={handleSaveTransfer} className="bg-slate-50 border border-slate-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
              <ArrowRightLeft size={14} /> Fund Transfer to General Fund
            </h3>
            <button type="button" onClick={() => setShowTransferForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Source Fund *</label>
              <select
                value={transferFromFundKey}
                onChange={e => setTransferFromFundKey(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs font-bold rounded focus:outline-none bg-white"
              >
                <option value="">— Fund select karo —</option>
                {sourceFunds.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label} · Available: {formatCurrency(f.balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Amount (₹) *</label>
              <input
                type="number"
                min={1}
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none"
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
              <input
                type="text"
                value={transferRemarks}
                onChange={e => setTransferRemarks(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                placeholder="Surplus transfer..."
              />
            </div>
          </div>

          {selectedSourceFund && (
            <div className="bg-white border border-slate-200 rounded p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-800">{selectedSourceFund.label}</p>
                <p className="text-[10px] text-slate-500">
                  Available: {formatCurrency(selectedSourceFund.balance)}
                </p>
              </div>
              {Number(transferAmount) > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">After Transfer</p>
                  <p className="text-sm font-black text-blue-700">
                    {formatCurrency(selectedSourceFund.balance - Number(transferAmount))}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={transferLoading || !transferFromFundKey || !transferAmount}
            className="bg-slate-800 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-slate-900 disabled:opacity-40 flex items-center gap-2 rounded"
          >
            {transferLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Transfer {transferAmount ? formatCurrency(Number(transferAmount)) : '₹0'} to General Fund
          </button>
        </form>
      )}

      {/* EXPENSE FORM */}
      {showExpenseForm && (
        <form onSubmit={handleSaveExpense} className="bg-red-50 border border-red-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-red-800 flex items-center gap-2">
              <Briefcase size={14} /> General Fund Expense
            </h3>
            <button type="button" onClick={() => setShowExpenseForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Category *</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {GENERAL_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    setExpCategory(cat.key);
                    setExpVendorId('');
                  }}
                  className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                    expCategory === cat.key
                      ? 'border-red-500 bg-red-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.emoji}</span>
                    <div>
                      <p className={`text-[10px] font-black ${
                        expCategory === cat.key ? 'text-red-700' : 'text-slate-700'
                      }`}>{cat.label}</p>
                      <p className="text-[8px] text-slate-400 leading-tight">{cat.hint}</p>
                    </div>
                  </div>
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
                <button
                  type="button"
                  onClick={() => setShowQuickVendor(!showQuickVendor)}
                  className="text-[9px] font-black text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100"
                >
                  + New Vendor
                </button>
              </div>

              <select
                value={expVendorId}
                onChange={e => {
                  setExpVendorId(e.target.value);
                  const v = vendors.find(v => v.id === e.target.value);
                  setExpVendorName(v?.name ?? '');
                }}
                className="w-full border border-slate-300 px-3 py-2 text-xs font-bold rounded focus:outline-none bg-white"
              >
                <option value="">— Bina Vendor (Direct Expense) —</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.categoryLabel}
                  </option>
                ))}
              </select>

              {showQuickVendor && (
                <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                  <p className="text-[10px] font-black text-green-800 uppercase">Quick Add Vendor</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={qvName}
                      onChange={e => setQvName(e.target.value)}
                      placeholder="Vendor naam *"
                      className="border border-green-300 px-3 py-1.5 text-xs font-bold rounded focus:outline-none"
                    />
                    <input
                      type="text"
                      value={qvPhone}
                      onChange={e => setQvPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="border border-green-300 px-3 py-1.5 text-xs rounded focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleQuickAddVendor}
                      disabled={qvLoading || !qvName.trim()}
                      className="bg-green-700 text-white px-3 py-1.5 text-[10px] font-black rounded hover:bg-green-800 disabled:opacity-40 flex items-center gap-1"
                    >
                      {qvLoading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuickVendor(false)}
                      className="text-[10px] font-bold text-slate-500 px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount / Bill / Vendor Name / Remarks */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Amount (₹) *</label>
              <input
                type="number"
                min={1}
                required
                value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none focus:border-red-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bill Status</label>
              <select
                value={expBillStatus}
                onChange={e => setExpBillStatus(e.target.value as GeneralExpense['billStatus'])}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none bg-white"
              >
                <option value="Received">Bill Received</option>
                <option value="Pending">Bill Pending</option>
                <option value="Verified">Verified</option>
                <option value="No Bill">No Bill</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vendor / Supplier</label>
              <input
                type="text"
                value={expVendorId ? (vendors.find(v => v.id === expVendorId)?.name ?? '') : expVendorName}
                onChange={e => { if (!expVendorId) setExpVendorName(e.target.value); }}
                disabled={!!expVendorId}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none disabled:bg-slate-50"
                placeholder="Manual naam"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
              <input
                type="text"
                value={expRemarks}
                onChange={e => setExpRemarks(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                placeholder="Note..."
              />
            </div>
          </div>

          {/* Payment Now / Later */}
          {expVendorId && Number(expAmount) > 0 && (
            <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                Payment Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'none', label: '⏳ Abhi Nahi (Due)', hint: 'Vendor Payment se baad mein' },
                  { key: 'partial', label: '💰 Partial Pay', hint: 'Kuch pay karo abhi' },
                  { key: 'full', label: '✅ Full Pay', hint: 'Poora pay kar do' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setExpPayNow(opt.key);
                      if (opt.key === 'full') setExpPayAmount(expAmount);
                      if (opt.key === 'none') setExpPayAmount('');
                    }}
                    className={`p-2.5 rounded-lg border-2 text-left ${
                      expPayNow === opt.key
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-[10px] font-black text-slate-800">{opt.label}</p>
                    <p className="text-[8px] text-slate-400">{opt.hint}</p>
                  </button>
                ))}
              </div>

              {expPayNow === 'partial' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pay Amount *</label>
                  <input
                    type="number"
                    min={1}
                    max={Number(expAmount)}
                    value={expPayAmount}
                    onChange={e => setExpPayAmount(e.target.value)}
                    className="w-full border border-amber-300 px-3 py-2 text-sm font-black rounded focus:outline-none"
                    placeholder={`Max: ${expAmount}`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Bill Upload */}
          <div className="bg-white border border-slate-200 rounded p-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Bill Upload (Optional)
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => setExpBillFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            {expBillFile && (
              <span className="text-[10px] text-green-600 font-bold ml-2">✓ {expBillFile.name}</span>
            )}
          </div>

          {/* Payment Mode */}
          {(expPayNow !== 'none' || !expVendorId) && (
            <PaymentModeSelector
              mode={expPaymentMode}
              setMode={setExpPaymentMode}
              checkNumber={expCheckNumber}
              setCheckNumber={setExpCheckNumber}
              transactionId={expTransactionId}
              setTransactionId={setExpTransactionId}
            />
          )}

          <button
            type="submit"
            disabled={expLoading || !expCategory || !expAmount}
            className="bg-red-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-red-700 disabled:opacity-40 flex items-center gap-2 rounded"
          >
            {expLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Save General Expense
          </button>
        </form>
      )}

      {/* TABS */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'transfers', label: 'Transfers' },
            { key: 'collections', label: 'Collections' },
            { key: 'expenses', label: 'Expenses' },
            { key: 'vendor_dues', label: 'Vendor Dues' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-[11px] font-black uppercase border-b-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-slate-700 text-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Category-wise General Expenses</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {GENERAL_CATEGORIES.map(cat => {
                const catExp = expenses.filter(e => e.category === cat.key);
                const total = catExp.reduce((s, e) => s + e.amount, 0);
                return (
                  <div key={cat.key} className="border border-slate-200 rounded p-3 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{cat.emoji}</span>
                      <span className="text-sm font-black text-red-600">{formatCurrency(total)}</span>
                    </div>
                    <p className="text-xs font-black text-slate-800 mt-1">{cat.label}</p>
                    <p className="text-[9px] text-slate-400">{catExp.length} entries</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TRANSFERS TAB */}
      {activeTab === 'transfers' && (
        <div className="space-y-2">
          {transfers.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ArrowRightLeft size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi transfer nahi</p>
            </div>
          ) : (
            transfers.map(t => (
              <div key={t.id} className="bg-white border border-slate-200 rounded p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-800">
                    {t.fromFundLabel} → {t.toFundLabel}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatDate(t.date)} · {t.remarks || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-green-700">{formatCurrency(t.amount)}</span>
                  <button
                    onClick={() => setDeleteConfirm({
                      type: 'transfer',
                      id: t.id,
                      label: `${t.fromFundLabel} transfer`
                    })}
                    className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* COLLECTIONS TAB */}
      {activeTab === 'collections' && (
        <div className="space-y-2">
          {collections.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Receipt size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi collection nahi</p>
            </div>
          ) : (
            collections.map(c => (
              <div key={c.id} className="bg-white border border-slate-200 rounded p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-800">{c.label}</p>
                    {c.collectionType === 'transfer_in' && (
                      <span className="text-[9px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Transfer In
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {formatDate(c.date)} · {c.remarks || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-green-700">+{formatCurrency(c.amount)}</span>
                  <button
                    onClick={() => setDeleteConfirm({
                      type: 'col',
                      id: c.id,
                      label: c.label
                    })}
                    className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div className="space-y-2">
          {expenses.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ArrowUpFromLine size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi expense nahi</p>
            </div>
          ) : (
            expenses.map(exp => {
              const catInfo = GENERAL_CATEGORIES.find(c => c.key === exp.category);
              const bsc = BILL_STATUS_CONFIG[exp.billStatus] ?? BILL_STATUS_CONFIG['Pending'];
              return (
                <div key={exp.id} className="bg-white border border-slate-200 rounded p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-800">
                        {catInfo?.emoji ?? '📦'} {exp.categoryLabel}
                      </p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${bsc.cls}`}>
                        {exp.billStatus}
                      </span>
                      {exp.dueAmount > 0 && (
                        <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                          Due: {formatCurrency(exp.dueAmount)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {formatDate(exp.date)} · {exp.vendor || 'Direct Expense'} · {exp.remarks || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-red-600">−{formatCurrency(exp.amount)}</span>
                    <button
                      onClick={() => setDeleteConfirm({
                        type: 'exp',
                        id: exp.id,
                        label: `${exp.categoryLabel} - ${formatCurrency(exp.amount)}`
                      })}
                      className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VENDOR DUES TAB */}
      {activeTab === 'vendor_dues' && (
        <div className="space-y-2">
          {generalVendorDues.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi vendor due nahi</p>
            </div>
          ) : (
            generalVendorDues.map(vd => {
              const vendor = vendors.find(v => v.id === vd.vendorId);
              return (
                <div
                  key={vd.vendorId}
                  className={`bg-white border-2 rounded-lg p-4 ${
                    vd.totalDue > 0 ? 'border-red-200' : 'border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl">
                        🏪
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
                        <p className="text-xs font-black text-slate-700">{formatCurrency(vd.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-green-500 font-bold uppercase">Paid</p>
                        <p className="text-xs font-black text-green-600">{formatCurrency(vd.totalPaid)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Due</p>
                        <p className={`text-sm font-black ${vd.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(vd.totalDue)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
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
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-1.5 text-xs font-bold border border-slate-300 hover:bg-slate-50 uppercase rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 uppercase rounded"
              >
                Haan, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BILL PREVIEW */}
      {previewBill && (
        <BillPreviewModal bill={previewBill} onClose={() => setPreviewBill(null)} />
      )}
    </div>
  );
};

export default GeneralFundScreen;