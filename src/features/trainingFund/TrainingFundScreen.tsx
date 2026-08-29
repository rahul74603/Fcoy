// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\trainingFund\TrainingFundScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Plus, Loader2, X, CheckCircle2, AlertTriangle,
  RefreshCw, TrendingUp, TrendingDown, Info, Trash2,
  ArrowDownToLine, ArrowUpFromLine, Calculator,
  Building2, Receipt, Package,
  ShoppingBag,
  UserMinus, ShoppingCart,
  Tag, Ruler
} from 'lucide-react';
import {
  collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, serverTimestamp, query, where, increment
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { showDoc } from '../../utils/devDataFilter';
import { batchScopeRule } from '../../utils/batchScope';
import { useBatch } from '../../contexts/BatchContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  PaymentModeSelector, PaymentModeBadge, validatePaymentMode,
  getPaymentRef
} from '../shared/PaymentModeSelector';
import type { PaymentMode } from '../shared/PaymentModeSelector';
import {
  formatCurrency, formatDate, processBillFile
} from '../finance/shared/utils';
import { BILL_STATUS_CONFIG } from '../finance/shared/constants';
import type { Vendor, VendorEntry, VendorItem, BillAttachment } from '../finance/vendors/types';
import BillPreviewModal from '../finance/shared/BillPreviewModal';
import { ModuleReportButton } from '../system/ModuleReportButton';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface SizeBreakdown {
  size: string;
  quantity: number;
}

interface TrainingCollection {
  id: string;
  amount: number;
  collectionType: 'per_head' | 'round_figure' | 'manual';
  perHead: number;
  traineeCount: number;
  label: string;
  remarks: string;
  paymentMode: string;
  checkNumber: string;
  transactionId: string;
  recordedBy: string;
  date: string;
}

interface TrainingExpense {
  id: string;
  amount: number;
  itemName: string;
  vendor: string;
  vendorId: string;
  linkedEntryId: string;
  quantity: number;
  unitPrice: number;
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
  sizes: SizeBreakdown[];
}

interface TrainingRecovery {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  expectedAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'Paid' | 'Partial' | 'Pending';
  label: string;
  remarks: string;
  date: string;
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

interface TrainingItem {
  name: string;
  emoji: string;
  category: string;
  hasSizes?: boolean;
  sizeOptions?: string[];
  isCustom?: boolean;
}

// ✅ NEW: Issued item structure from issue_records
interface IssuedItemRecord {
  itemName: string;
  assignedSize: string;
  quantity: number;
  issueSource?: string;
}

// ✅ NEW: Live stock per item
interface LiveItemStock {
  itemName: string;
  totalPurchased: number;
  totalIssued: number;
  currentStock: number;
  // Size-wise
  purchasedSizes: Record<string, number>;
  issuedSizes: Record<string, number>;
  liveSizes: Record<string, number>;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const SHOE_SIZES   = ['5', '6', '7', '8', '9', '10', '11', '12', '13'];
const SHIRT_SIZES  = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const FIXED_TRAINING_ITEMS: TrainingItem[] = [
  { name: 'DM Shoes',     emoji: '👞', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { name: 'PT Shoes',     emoji: '👟', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { name: 'Ankle Shoes',  emoji: '🥾', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { name: 'PT T-Shirt',   emoji: '👕', category: 'Uniform',   hasSizes: true, sizeOptions: SHIRT_SIZES },
  { name: 'Ground Sheet', emoji: '🛏️', category: 'Bedding'   },
  { name: 'Plate',        emoji: '🍽️', category: 'Mess Item' },
  { name: 'Glass',        emoji: '🥤', category: 'Mess Item' },
  { name: 'Bucket',       emoji: '🪣', category: 'Equipment' },
  { name: 'Mug',          emoji: '☕', category: 'Mess Item' },
  { name: 'Mess Tin',     emoji: '🥫', category: 'Mess Item' },
  { name: 'Mosquito Net', emoji: '🦟', category: 'Bedding'   },
  { name: 'Water Bottle', emoji: '💧', category: 'Equipment' },
  { name: 'Towel',        emoji: '🧻', category: 'Equipment' },
  { name: 'Lock',         emoji: '🔒', category: 'Equipment' },
];

const STATUS_CONFIG: Record<string, { cls: string; dot: string }> = {
  Paid:    { cls: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  Partial: { cls: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  Pending: { cls: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-500'   },
};

// ✅ HELPER: normalize name for comparison
const normalizeName = (v: string) => (v || '').trim().toLowerCase();

// ═════════════════════════════════════════════
// PARTIAL PAY MODAL (Recovery)
// ═════════════════════════════════════════════
const RecoveryPayModal: React.FC<{
  recovery: TrainingRecovery;
  onClose: () => void;
  onSuccess: () => void;
  recordedBy: string;
}> = ({ recovery, onClose, onSuccess, recordedBy }) => {
  const [amount, setAmount]               = useState(recovery.dueAmount);
  const [remarks, setRemarks]             = useState('');
  const [paymentMode, setPaymentMode]     = useState<PaymentMode>('Cash');
  const [checkNumber, setCheckNumber]     = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  const handlePay = async () => {
    if (amount <= 0) { setError('Amount 0 se zyada honi chahiye'); return; }
    if (amount > recovery.dueAmount) { setError(`Max: ${formatCurrency(recovery.dueAmount)}`); return; }
    const payErr = validatePaymentMode(paymentMode, checkNumber, transactionId);
    if (payErr) { setError(payErr); return; }

    setLoading(true); setError('');
    try {
      const newPaid   = recovery.paidAmount + amount;
      const newDue    = recovery.expectedAmount - newPaid;
      const newStatus = newDue <= 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

      await updateDoc(doc(db, 'training_fund_recoveries', recovery.id), {
        paidAmount:      newPaid,
        dueAmount:       Math.max(0, newDue),
        status:          newStatus,
        lastPaymentDate: new Date().toISOString(),
        remarks:         remarks || recovery.remarks,
      });

      if (recovery.traineeId) {
        await updateDoc(doc(db, 'trainees', recovery.traineeId), {
          pendingRecoveryAmount: increment(-amount),
        });
      }

      await addDoc(collection(db, 'training_fund_collections'), {
        amount,
        collectionType: 'per_head',
        perHead:        amount,
        traineeCount:   1,
        label:          `Recovery - ${recovery.traineeName} (${recovery.chestNo})`,
        remarks:        remarks || `Training Essentials Recovery`,
        paymentMode,
        checkNumber:    paymentMode === 'Check' ? checkNumber : '',
        transactionId:  getPaymentRef(paymentMode, checkNumber, transactionId),
        recordedBy,
        linkedRecoveryId: recovery.id,
        date:           new Date().toISOString(),
        createdAt:      serverTimestamp(),
      });

      onSuccess();
    } catch {
      setError('Payment save nahi hua. Retry karo.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white shadow-2xl max-w-md w-full rounded overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-blue-800 text-white px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider">Trainee Se Payment Lo</p>
            <p className="text-[10px] text-blue-300 mt-0.5">
              {recovery.traineeName} · Chest: {recovery.chestNo}
            </p>
          </div>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Banta Tha', value: formatCurrency(recovery.expectedAmount), color: 'text-slate-700'  },
              { label: 'Diya',      value: formatCurrency(recovery.paidAmount),      color: 'text-green-600' },
              { label: 'Baaki',     value: formatCurrency(recovery.dueAmount),       color: 'text-red-600'   },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{label}</p>
                <p className={`text-sm font-black mt-0.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Amount *</label>
            <div className="flex items-center border border-slate-300 rounded overflow-hidden">
              <span className="px-3 py-2 text-sm font-bold text-slate-500 bg-slate-50 border-r">₹</span>
              <input type="number" min={1} max={recovery.dueAmount} value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="flex-1 px-3 py-2 text-sm font-black focus:outline-none" />
              <button onClick={() => setAmount(recovery.dueAmount)}
                className="px-3 py-2 text-[10px] font-bold text-blue-700 hover:bg-blue-50 border-l uppercase">
                Pura
              </button>
            </div>
          </div>

          <PaymentModeSelector
            mode={paymentMode} setMode={setPaymentMode}
            checkNumber={checkNumber} setCheckNumber={setCheckNumber}
            transactionId={transactionId} setTransactionId={setTransactionId}
          />

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Note</label>
            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-xs rounded" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 text-xs rounded flex items-center gap-2">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handlePay} disabled={loading || amount <= 0}
              className="flex-1 bg-blue-800 text-white text-xs font-black uppercase py-2.5 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2 rounded">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Confirm ({paymentMode})
            </button>
            <button onClick={onClose}
              className="px-4 text-xs font-bold border border-slate-300 hover:bg-slate-50 uppercase rounded">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════
export const TrainingFundScreen: React.FC = () => {
  const { user } = useAuth();
  const { currentBatch: activeBatch } = useBatch(); // ⛓️ STRICT: selected batch follow
  const belongsToBatch = (data: any) => batchScopeRule(data);
  const recordedBy = user?.email ?? 'Quarter Master';

  // ── DATA STATE ──
  const [collections, setCollections]       = useState<TrainingCollection[]>([]);
  const [expenses, setExpenses]             = useState<TrainingExpense[]>([]);
  const [recoveries, setRecoveries]         = useState<TrainingRecovery[]>([]);
  const [vendors, setVendors]               = useState<Vendor[]>([]);
  const [vendorEntries, setVendorEntries]   = useState<VendorEntry[]>([]);
  const [customItems, setCustomItems]       = useState<TrainingItem[]>([]);
  const [traineeCount, setTraineeCount]     = useState(0);
  const [transferredOut, setTransferredOut] = useState(0);
  const [dataLoading, setDataLoading]       = useState(true);

  // ✅ NEW: Live stock state (purchases - issued)
  const [liveStockMap, setLiveStockMap] = useState<Record<string, LiveItemStock>>({});

  // ── COLLECTION FORM ──
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [colType, setColType]                       = useState<'per_head' | 'round_figure'>('round_figure');
  const [colPerHead, setColPerHead]                 = useState('');
  const [colTraineeCount, setColTraineeCount]       = useState('');
  const [colLabel, setColLabel]                     = useState('Training Kit');
  const [colRemarks, setColRemarks]                 = useState('');
  const [colPaymentMode, setColPaymentMode]         = useState<PaymentMode>('Cash');
  const [colCheckNumber, setColCheckNumber]         = useState('');
  const [colTransactionId, setColTransactionId]     = useState('');
  const [colLoading, setColLoading]                 = useState(false);

  // ── EXPENSE FORM ──
  const [showExpenseForm, setShowExpenseForm]   = useState(false);
  const [expItemName, setExpItemName]           = useState('');
  const [expAmount, setExpAmount]               = useState('');
  const [expVendorId, setExpVendorId]           = useState('');
  const [expVendorName, setExpVendorName]       = useState('');
  const [expQty, setExpQty]                     = useState('1');
  const [expUnitPrice, setExpUnitPrice]         = useState('');
  const [expRemarks, setExpRemarks]             = useState('');
  const [expPaymentMode, setExpPaymentMode]     = useState<PaymentMode>('Check');
  const [expCheckNumber, setExpCheckNumber]     = useState('');
  const [expTransactionId, setExpTransactionId] = useState('');
  const [expBillStatus, setExpBillStatus]       = useState<TrainingExpense['billStatus']>('Received');
  const [expBillFile, setExpBillFile]           = useState<File | null>(null);
  const [expPayNow, setExpPayNow]               = useState<'full' | 'partial' | 'none'>('none');
  const [expPayAmount, setExpPayAmount]         = useState('');
  const [expSizes, setExpSizes]                 = useState<SizeBreakdown[]>([]);
  const [expLoading, setExpLoading]             = useState(false);

  // ── VENDOR ENTRY FORM ──
  const [showVendorEntryForm, setShowVendorEntryForm] = useState(false);
  const [veVendorId, setVeVendorId]                   = useState('');
  const [veItems, setVeItems]                         = useState<VendorItem[]>([
    { itemName: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }
  ]);
  const [veRemarks, setVeRemarks]             = useState('');
  const [vePayNow, setVePayNow]               = useState<'full' | 'partial' | 'none'>('none');
  const [vePayAmount, setVePayAmount]         = useState('');
  const [vePaymentMode, setVePaymentMode]     = useState<PaymentMode>('Cash');
  const [veCheckNumber, setVeCheckNumber]     = useState('');
  const [veTransactionId, setVeTransactionId] = useState('');
  const [veBillFile, setVeBillFile]           = useState<File | null>(null);
  const [veLoading, setVeLoading]             = useState(false);

  // ── QUICK ADD VENDOR ──
  const [showQuickVendor, setShowQuickVendor] = useState(false);
  const [qvName, setQvName]                   = useState('');
  const [qvPhone, setQvPhone]                 = useState('');
  const [qvLoading, setQvLoading]             = useState(false);

  // ── RECOVERY FORM ──
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recChestNo, setRecChestNo]             = useState('');
  const [recExpected, setRecExpected]           = useState('');
  const [recPaidNow, setRecPaidNow]             = useState('');
  const [recLabel, setRecLabel]                 = useState('Training Kit');
  const [recLoading, setRecLoading]             = useState(false);

  // ── CUSTOM ITEM FORM ──
  const [showItemForm, setShowItemForm]         = useState(false);
  const [newItemName, setNewItemName]           = useState('');
  const [newItemEmoji, setNewItemEmoji]         = useState('📦');
  const [newItemCategory, setNewItemCategory]   = useState('Other');
  const [newItemHasSizes, setNewItemHasSizes]   = useState(false);
  const [newItemSizeType, setNewItemSizeType]   = useState<'shoe' | 'shirt' | 'custom'>('shoe');
  const [newItemCustomSizes, setNewItemCustomSizes] = useState('');
  const [itemLoading, setItemLoading]           = useState(false);

  // ── UI STATE ──
  const [activeTab, setActiveTab] = useState<
    'overview' | 'collections' | 'expenses' | 'recoveries' | 'vendor_dues' | 'stock'
  >('overview');
  const [successMsg, setSuccessMsg]               = useState('');
  const [errorMsg, setErrorMsg]                   = useState('');
  const [recoveryPayTarget, setRecoveryPayTarget] = useState<TrainingRecovery | null>(null);
  const [previewBill, setPreviewBill]             = useState<BillAttachment | null>(null);
  const [deleteConfirm, setDeleteConfirm]         = useState<{
    type: 'col' | 'exp' | 'rec' | 'item';
    id: string;
    label: string;
  } | null>(null);

  // ── ALL ITEMS ──
  const allItems: TrainingItem[] = [
    ...FIXED_TRAINING_ITEMS,
    ...customItems,
    { name: 'Other', emoji: '📦', category: 'Other' },
  ];

  // ── SELECTED ITEM INFO ──
  const selectedItem = allItems.find(i => i.name === expItemName);

  // ── CLOSE ALL FORMS ──
  const closeAllForms = () => {
    setShowCollectionForm(false);
    setShowExpenseForm(false);
    setShowVendorEntryForm(false);
    setShowRecoveryForm(false);
    setShowQuickVendor(false);
    setShowItemForm(false);
  };

  // ─────────────────────────────────────────
  // FETCH ALL DATA
  // ─────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      // ── Trainee count ──
      const tSnap = await getDocs(collection(db, 'trainees'));
      setTraineeCount(tSnap.docs.filter(d => belongsToBatch(d.data()) && showDoc(d.data())).length);

      // ── Collections ──
      const colSnap = await getDocs(collection(db, 'training_fund_collections'));
      const colList: TrainingCollection[] = [];
      colSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        colList.push({
          id:             d.id,
          amount:         Number(data.amount ?? 0),
          collectionType: data.collectionType ?? 'manual',
          perHead:        Number(data.perHead ?? 0),
          traineeCount:   Number(data.traineeCount ?? 0),
          label:          data.label ?? '',
          remarks:        data.remarks ?? '',
          paymentMode:    data.paymentMode ?? 'Cash',
          checkNumber:    data.checkNumber ?? '',
          transactionId:  data.transactionId ?? '',
          recordedBy:     data.recordedBy ?? '',
          date:           data.date ?? '',
        });
      });
      colList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCollections(colList);

      // ── Expenses ──
      const expSnap = await getDocs(collection(db, 'training_fund_expenses'));
      const expList: TrainingExpense[] = [];
      expSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        expList.push({
          id:            d.id,
          amount:        Number(data.amount ?? 0),
          itemName:      data.itemName ?? '',
          vendor:        data.vendor ?? '',
          vendorId:      data.vendorId ?? data.linkedVendorId ?? '',
          linkedEntryId: data.linkedEntryId ?? '',
          quantity:      Number(data.quantity ?? 0),
          unitPrice:     Number(data.unitPrice ?? 0),
          remarks:       data.remarks ?? '',
          paymentMode:   data.paymentMode ?? 'Cash',
          checkNumber:   data.checkNumber ?? '',
          transactionId: data.transactionId ?? '',
          billStatus:    data.billStatus ?? 'Pending',
          billBase64:    data.billBase64 ?? '',
          billFileName:  data.billFileName ?? '',
          billFileType:  data.billFileType ?? '',
          billFileSize:  Number(data.billFileSize ?? 0),
          recordedBy:    data.recordedBy ?? '',
          date:          data.date ?? '',
          dueAmount:     Number(data.dueAmount ?? 0),
          paidAmount:    Number(data.paidAmount ?? 0),
          sizes:         Array.isArray(data.sizes) ? data.sizes : [],
        });
      });
      expList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(expList);

      // ── Recoveries ──
      const recSnap = await getDocs(collection(db, 'training_fund_recoveries'));
      const recList: TrainingRecovery[] = [];
      recSnap.forEach(d => {
        const data     = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        const expected = Number(data.expectedAmount ?? 0);
        const paid     = Number(data.paidAmount ?? 0);
        recList.push({
          id:             d.id,
          traineeId:      data.traineeId ?? '',
          traineeName:    data.traineeName ?? '',
          chestNo:        data.chestNo ?? '',
          expectedAmount: expected,
          paidAmount:     paid,
          dueAmount:      Number(data.dueAmount ?? Math.max(0, expected - paid)),
          status:         data.status ?? 'Pending',
          label:          data.label ?? '',
          remarks:        data.remarks ?? '',
          date:           data.date ?? '',
        });
      });
      recList.sort((a, b) => {
        const ord: Record<string, number> = { Pending: 0, Partial: 1, Paid: 2 };
        return (ord[a.status] ?? 1) - (ord[b.status] ?? 1);
      });
      setRecoveries(recList);

      // ── Vendors (Global) ──
      const vSnap = await getDocs(collection(db, 'vendors'));
      const vList: Vendor[] = [];
      vSnap.forEach(d => {
        const data = d.data();
        if (!showDoc(data)) return;
        if (data.isActive === false) return;
        vList.push({
          id:            d.id,
          name:          data.name ?? '',
          phone:         data.phone ?? '',
          address:       data.address ?? '',
          categoryKey:   data.categoryKey ?? 'other',
          categoryLabel: data.categoryLabel ?? 'Other',
          isActive:      true,
          createdAt:     data.createdAt ?? '',
          notes:         data.notes ?? '',
        });
      });
      vList.sort((a, b) => a.name.localeCompare(b.name));
      setVendors(vList);

      // ── Vendor Entries ──
      const veSnap = await getDocs(collection(db, 'vendor_entries'));
      const veList: VendorEntry[] = [];
      veSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        veList.push({
          id:            d.id,
          vendorId:      data.vendorId ?? '',
          vendorName:    data.vendorName ?? '',
          categoryKey:   data.categoryKey ?? '',
          categoryLabel: data.categoryLabel ?? '',
          items:         data.items ?? [],
          totalAmount:   Number(data.totalAmount ?? 0),
          paidAmount:    Number(data.paidAmount ?? 0),
          dueAmount:     Number(data.dueAmount ?? 0),
          status:        data.status ?? 'Pending',
          entryDate:     data.entryDate ?? '',
          remarks:       data.remarks ?? '',
          bills:         data.bills ?? [],
          createdBy:     data.createdBy ?? '',
          ...(data.fundKey ? { fundKey: data.fundKey } : {}),
        } as VendorEntry);
      });
      veList.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
      setVendorEntries(veList);

      // ── Custom Items ──
      const ciSnap = await getDocs(collection(db, 'training_custom_items'));
      const ciList: TrainingItem[] = [];
      ciSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        ciList.push({
          name:        data.name ?? '',
          emoji:       data.emoji ?? '📦',
          category:    data.category ?? 'Other',
          hasSizes:    data.hasSizes ?? false,
          sizeOptions: data.sizeOptions ?? [],
          isCustom:    true,
        });
      });
      setCustomItems(ciList);

      // ── Transfer Out ──
      const transferSnap = await getDocs(collection(db, 'fund_transfers'));
      let trainingTransferred = 0;
      transferSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data) || !showDoc(data)) return;
        if (data.fromFundKey === 'training_fund') {
          trainingTransferred += Number(data.amount ?? 0);
        }
      });
      setTransferredOut(trainingTransferred);

      // ✅ NEW: Fetch issued items from issue_records to compute live stock
      const issueSnap = await getDocs(collection(db, 'issue_records'));

      // Build issued map: itemName (normalized) -> { totalQty, sizeStock }
      const issuedMap: Record<string, {
        totalQty: number;
        sizeStock: Record<string, number>;
      }> = {};

      issueSnap.forEach(d => {
        const data = d.data() as any;

        // ✅ Only count TRAINING_ESSENTIALS issues
        const isTraining =
          data.issueSource === 'TRAINING_ESSENTIALS' ||
          data.issueType   === 'TRAINING_ESSENTIALS';
        if (!isTraining) return;

        const items: IssuedItemRecord[] = Array.isArray(data.issuedItems)
          ? data.issuedItems
          : Array.isArray(data.items) ? data.items : [];

        items.forEach(item => {
          const key  = normalizeName(item.itemName ?? '');
          if (!key) return;
          const qty  = Number(item.quantity ?? 1);
          const size = String(item.assignedSize ?? '').trim();

          if (!issuedMap[key]) {
            issuedMap[key] = { totalQty: 0, sizeStock: {} };
          }
          issuedMap[key].totalQty += qty;
          if (size && size !== 'N/A') {
            issuedMap[key].sizeStock[size] =
              (issuedMap[key].sizeStock[size] || 0) + qty;
          }
        });
      });

      // ✅ Build purchased size map from expenses
      const purchasedMap: Record<string, {
        totalQty: number;
        sizeStock: Record<string, number>;
      }> = {};

      expSnap.forEach(d => {
        const data     = d.data() as any;
        const itemName = String(data.itemName ?? '').trim();
        if (!itemName) return;
        const key      = normalizeName(itemName);
        const qty      = Number(data.quantity ?? 0);
        const sizes: SizeBreakdown[] = Array.isArray(data.sizes) ? data.sizes : [];

        if (!purchasedMap[key]) {
          purchasedMap[key] = { totalQty: 0, sizeStock: {} };
        }
        purchasedMap[key].totalQty += qty;

        sizes.forEach(sz => {
          const size = String(sz.size ?? '').trim();
          const q    = Number(sz.quantity ?? 0);
          if (!size || q <= 0) return;
          purchasedMap[key].sizeStock[size] =
            (purchasedMap[key].sizeStock[size] || 0) + q;
        });
      });

      // ✅ Compute liveStockMap: purchased - issued
      const newLiveStockMap: Record<string, LiveItemStock> = {};

      const allItemKeys = new Set([
        ...Object.keys(purchasedMap),
        ...Object.keys(issuedMap),
      ]);

      allItemKeys.forEach(key => {
        const purchased = purchasedMap[key] ?? { totalQty: 0, sizeStock: {} };
        const issued    = issuedMap[key]    ?? { totalQty: 0, sizeStock: {} };

        // All size keys from both
        const allSizeKeys = new Set([
          ...Object.keys(purchased.sizeStock),
          ...Object.keys(issued.sizeStock),
        ]);

        const liveSizes: Record<string, number> = {};
        allSizeKeys.forEach(size => {
          liveSizes[size] = Math.max(
            0,
            (purchased.sizeStock[size] || 0) - (issued.sizeStock[size] || 0)
          );
        });

        const currentStock = Object.keys(liveSizes).length > 0
          ? Object.values(liveSizes).reduce((s, q) => s + q, 0)
          : Math.max(0, purchased.totalQty - issued.totalQty);

        // ✅ Find original item name (non-normalized) from expenses
        let displayName = key;
        expSnap.forEach(d => {
          const iname = String(d.data().itemName ?? '').trim();
          if (normalizeName(iname) === key) displayName = iname;
        });

        newLiveStockMap[key] = {
          itemName:       displayName,
          totalPurchased: purchased.totalQty,
          totalIssued:    issued.totalQty,
          currentStock,
          purchasedSizes: purchased.sizeStock,
          issuedSizes:    issued.sizeStock,
          liveSizes,
        };
      });

      setLiveStockMap(newLiveStockMap);

    } catch (err) {
      console.error(err);
      setErrorMsg('Data load nahi hua');
    } finally {
      setDataLoading(false);
    }
  }, [activeBatch?.id]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ── COMPUTED ──
  const totalCollection   = collections.reduce((s, c) => s + c.amount, 0);
  const totalExpense      = expenses.reduce((s, e) => s + e.amount, 0);
  const totalActuallyPaid = expenses.reduce((s, e) => {
    if (e.vendorId) return s + (e.paidAmount ?? 0);
    return s + e.amount;
  }, 0);

  const fundBalance      = totalCollection - totalActuallyPaid - transferredOut;
  const totalPendingDue  = expenses.reduce((s, e) => s + (e.dueAmount ?? 0), 0);
  const totalRecoveryDue = recoveries
    .filter(r => r.status !== 'Paid')
    .reduce((s, r) => s + r.dueAmount, 0);
  const pendingRecoveries = recoveries.filter(r => r.status !== 'Paid').length;

  const colTotal   = Number(colPerHead) * Number(colTraineeCount);
  const autoAmount = Number(expQty) * Number(expUnitPrice);
  const veTotal    = veItems.reduce((s, i) => s + i.total, 0);

  const expSizeTotal = expSizes.reduce((s, x) => s + (x.quantity || 0), 0);

  // Vendor dues
  const trainingVendorDues: VendorDueSummary[] = (() => {
    const dueMap: Record<string, VendorDueSummary> = {};

    vendorEntries.forEach(ve => {
      const data = ve as any;
      if (data.fundKey !== 'training_fund') return;
      if (ve.dueAmount <= 0) return;
      const vendor = vendors.find(v => v.id === ve.vendorId);
      if (!dueMap[ve.vendorId]) {
        dueMap[ve.vendorId] = {
          vendorId:      ve.vendorId,
          vendorName:    vendor?.name ?? ve.vendorName,
          categoryLabel: vendor?.categoryLabel ?? ve.categoryLabel,
          totalAmount:   0, totalPaid: 0, totalDue: 0, entries: 0,
        };
      }
      dueMap[ve.vendorId].totalAmount += ve.totalAmount;
      dueMap[ve.vendorId].totalPaid   += ve.paidAmount;
      dueMap[ve.vendorId].totalDue    += ve.dueAmount;
      dueMap[ve.vendorId].entries     += 1;
    });

    expenses.forEach(exp => {
      if (!exp.vendorId || exp.linkedEntryId) return;
      if (exp.dueAmount <= 0) return;
      const vendor = vendors.find(v => v.id === exp.vendorId);
      if (!dueMap[exp.vendorId]) {
        dueMap[exp.vendorId] = {
          vendorId:      exp.vendorId,
          vendorName:    vendor?.name ?? exp.vendor,
          categoryLabel: vendor?.categoryLabel ?? '',
          totalAmount:   0, totalPaid: 0, totalDue: 0, entries: 0,
        };
      }
      dueMap[exp.vendorId].totalAmount += exp.amount;
      dueMap[exp.vendorId].totalPaid   += exp.paidAmount;
      dueMap[exp.vendorId].totalDue    += exp.dueAmount;
      dueMap[exp.vendorId].entries     += 1;
    });

    return Object.values(dueMap).sort((a, b) => b.totalDue - a.totalDue);
  })();

  // ✅ Item totals now uses liveStockMap for current stock
  const itemTotals = allItems.map(item => {
    const itemExps  = expenses.filter(e => e.itemName === item.name);
    const stockKey  = normalizeName(item.name);
    const liveStock = liveStockMap[stockKey];
    return {
      ...item,
      total:         itemExps.reduce((s, e) => s + e.amount, 0),
      count:         itemExps.length,
      totalQty:      itemExps.reduce((s, e) => s + e.quantity, 0),
      // ✅ Live stock from purchased - issued
      totalPurchased: liveStock?.totalPurchased ?? 0,
      totalIssued:    liveStock?.totalIssued    ?? 0,
      currentStock:   liveStock?.currentStock   ?? 0,
    };
  });

  // ✅ NEW sizeStock: purchased sizes from expenses (for size breakdown tab)
  const purchasedSizeStock: Record<string, Record<string, number>> = {};
  expenses.forEach(exp => {
    if (!exp.sizes || exp.sizes.length === 0) return;
    if (!purchasedSizeStock[exp.itemName]) purchasedSizeStock[exp.itemName] = {};
    exp.sizes.forEach(sz => {
      purchasedSizeStock[exp.itemName][sz.size] =
        (purchasedSizeStock[exp.itemName][sz.size] || 0) + sz.quantity;
    });
  });

  // ─────────────────────────────────────────
  // VENDOR ENTRY ITEM MANAGEMENT
  // ─────────────────────────────────────────
  const addVeRow = () =>
    setVeItems(prev => [
      ...prev, { itemName: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }
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
  // SIZE BREAKDOWN MANAGEMENT
  // ─────────────────────────────────────────
  const addSizeRow = () =>
    setExpSizes(prev => [...prev, { size: '', quantity: 0 }]);

  const removeSizeRow = (idx: number) =>
    setExpSizes(prev => prev.filter((_, i) => i !== idx));

  const updateSizeRow = (
    idx: number,
    field: 'size' | 'quantity',
    value: string | number
  ) => {
    setExpSizes(prev => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      return updated;
    });
  };

  // Sync size total with qty
  useEffect(() => {
    if (selectedItem?.hasSizes && expSizes.length > 0) {
      const total = expSizes.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
      setExpQty(String(total || 1));
    }
  }, [expSizes, selectedItem]);

  // Reset sizes when item changes
  useEffect(() => {
    if (selectedItem?.hasSizes) {
      if (expSizes.length === 0) {
        setExpSizes([{ size: selectedItem.sizeOptions?.[0] ?? '', quantity: 0 }]);
      }
    } else {
      setExpSizes([]);
    }
  }, [expItemName]);

  // ─────────────────────────────────────────
  // SAVE COLLECTION
  // ─────────────────────────────────────────
  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg('');
    if (!colPerHead || !colTraineeCount || Number(colTraineeCount) <= 0) {
      setErrorMsg('Per head amount aur trainee count daalo'); return;
    }
    const payErr = validatePaymentMode(colPaymentMode, colCheckNumber, colTransactionId);
    if (payErr) { setErrorMsg(payErr); return; }

    setColLoading(true);
    try {
      await addDoc(collection(db, 'training_fund_collections'), {
        amount:         colTotal,
        collectionType: colType,
        perHead:        Number(colPerHead),
        traineeCount:   Number(colTraineeCount),
        label:          colLabel || 'Training Kit',
        remarks:        colRemarks || `${colLabel}: ${colTraineeCount} × ₹${colPerHead}`,
        paymentMode:    colPaymentMode,
        checkNumber:    colPaymentMode === 'Check' ? colCheckNumber : '',
        transactionId:  getPaymentRef(colPaymentMode, colCheckNumber, colTransactionId),
        recordedBy,
        date:           new Date().toISOString(),
        createdAt:      serverTimestamp(),
      });
      setSuccessMsg(
        `✓ Training Fund Collection: ${formatCurrency(colTotal)} via ${colPaymentMode}!`
      );
      setColPerHead(''); setColTraineeCount(''); setColRemarks('');
      setColCheckNumber(''); setColTransactionId('');
      setShowCollectionForm(false);
      await fetchAllData();
    } catch {
      setErrorMsg('Save nahi hua. Retry karo.');
    } finally { setColLoading(false); }
  };

  // ─────────────────────────────────────────
  // SAVE EXPENSE
  // ─────────────────────────────────────────
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg('');
    if (!expItemName) { setErrorMsg('Item select karo'); return; }

    const finalAmount = expAmount ? Number(expAmount) : autoAmount;
    if (!finalAmount || finalAmount <= 0) { setErrorMsg('Amount daalo'); return; }

    let finalSizes: SizeBreakdown[] = [];
    if (selectedItem?.hasSizes) {
      finalSizes = expSizes.filter(s => s.size.trim() && s.quantity > 0);
      if (finalSizes.length === 0) {
        setErrorMsg('Kam se kam ek size aur quantity daalo');
        return;
      }
      const sizeTotal = finalSizes.reduce((s, x) => s + x.quantity, 0);
      if (sizeTotal !== Number(expQty)) {
        setErrorMsg(`Size total (${sizeTotal}) aur Qty (${expQty}) match nahi karte`);
        return;
      }
    }

    if (expPayNow !== 'none') {
      const payErr = validatePaymentMode(expPaymentMode, expCheckNumber, expTransactionId);
      if (payErr) { setErrorMsg(payErr); return; }
    }

    setExpLoading(true);
    try {
      let billBase64 = '', billFileName = '', billFileType = '', billFileSize = 0;
      if (expBillFile) {
        const result = await processBillFile(expBillFile);
        if (result.error) { setErrorMsg(result.error); setExpLoading(false); return; }
        if (result.data) {
          billBase64   = result.data.billBase64;
          billFileName = result.data.billFileName;
          billFileType = result.data.billFileType;
          billFileSize = result.data.billFileSize;
        }
      }

      const vendor     = vendors.find(v => v.id === expVendorId);
      const vendorName = vendor?.name ?? expVendorName ?? '';

      let paidAmount = 0, dueAmount = finalAmount;
      if (!expVendorId) {
        paidAmount = finalAmount; dueAmount = 0;
      } else if (expPayNow === 'full') {
        paidAmount = finalAmount; dueAmount = 0;
      } else if (expPayNow === 'partial') {
        paidAmount = Math.min(Number(expPayAmount) || 0, finalAmount);
        dueAmount  = finalAmount - paidAmount;
      }

      const expenseRef = await addDoc(collection(db, 'training_fund_expenses'), {
        amount:        finalAmount,
        itemName:      expItemName,
        vendor:        vendorName,
        vendorId:      expVendorId,
        quantity:      Number(expQty) || 1,
        unitPrice:     Number(expUnitPrice) || finalAmount,
        remarks:       expRemarks,
        paymentMode:   expPayNow !== 'none'
          ? expPaymentMode
          : (expVendorId ? '' : expPaymentMode),
        checkNumber:   (expPayNow !== 'none' || !expVendorId) && expPaymentMode === 'Check'
          ? expCheckNumber : '',
        transactionId: (expPayNow !== 'none' || !expVendorId)
          ? getPaymentRef(expPaymentMode, expCheckNumber, expTransactionId) : '',
        billStatus:    billBase64 ? 'Received' : expBillStatus,
        billBase64, billFileName, billFileType, billFileSize,
        sizes:         finalSizes,
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
            base64:     billBase64,
            fileName:   billFileName,
            fileType:   billFileType,
            fileSize:   billFileSize,
            uploadedAt: new Date().toISOString(),
            uploadedBy: recordedBy,
          });
        }
        const itemDesc = finalSizes.length > 0
          ? `${expItemName} (${finalSizes.map(s => `${s.size}:${s.quantity}`).join(', ')})`
          : expItemName;

        const veRef = await addDoc(collection(db, 'vendor_entries'), {
          vendorId:      expVendorId,
          vendorName:    vendor.name,
          categoryKey:   vendor.categoryKey,
          categoryLabel: vendor.categoryLabel,
          items: [{
            itemName:  itemDesc,
            quantity:  Number(expQty) || 1,
            unit:      'pcs',
            unitPrice: Number(expUnitPrice) || finalAmount,
            total:     finalAmount,
          }],
          totalAmount:     finalAmount,
          paidAmount,
          dueAmount,
          status:          dueAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending',
          entryDate:       new Date().toISOString(),
          remarks:         expRemarks || `Training Fund: ${itemDesc}`,
          bills,
          fundKey:         'training_fund',
          linkedExpenseId: expenseRef.id,
          createdBy:       recordedBy,
          createdAt:       serverTimestamp(),
        });
        linkedEntryId = veRef.id;

        await updateDoc(doc(db, 'training_fund_expenses', expenseRef.id), {
          linkedEntryId:  veRef.id,
          linkedVendorId: expVendorId,
        });
      }

      if (expVendorId && paidAmount > 0) {
        await addDoc(collection(db, 'vendor_payments'), {
          vendorId:      expVendorId,
          vendorName:    vendorName,
          entryId:       linkedEntryId,
          categoryKey:   vendor?.categoryKey ?? '',
          categoryLabel: vendor?.categoryLabel ?? '',
          paidAmount,
          fundKey:       'training_fund',
          fundLabel:     'Training Essentials Fund',
          paymentMode:   expPaymentMode,
          checkNumber:   expPaymentMode === 'Check' ? expCheckNumber : '',
          transactionId: getPaymentRef(expPaymentMode, expCheckNumber, expTransactionId),
          remarks:       expRemarks || `Training purchase — ${expItemName}`,
          paidBy:        recordedBy,
          paidAt:        new Date().toISOString(),
          createdAt:     serverTimestamp(),
        });
      }

      setSuccessMsg(
        `✓ ${expItemName}: ${formatCurrency(finalAmount)} saved!` +
        (finalSizes.length > 0 ? ` (${finalSizes.length} sizes)` : '') +
        (vendorName ? ` Vendor: ${vendorName}` : '') +
        (dueAmount > 0 ? ` · Due: ${formatCurrency(dueAmount)}` : ' · Fully Paid!')
      );

      setExpItemName(''); setExpAmount(''); setExpVendorId(''); setExpVendorName('');
      setExpQty('1'); setExpUnitPrice(''); setExpRemarks('');
      setExpCheckNumber(''); setExpTransactionId(''); setExpBillFile(null);
      setExpPayNow('none'); setExpPayAmount(''); setExpSizes([]);
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
      let paidAmount = 0, dueAmount = veTotal;

      if (vePayNow === 'full') { paidAmount = veTotal; dueAmount = 0; }
      else if (vePayNow === 'partial') {
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
            base64:     result.data.billBase64,
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
        remarks:       veRemarks || `Training Fund — Vendor Purchase`,
        bills,
        fundKey:       'training_fund',
        createdBy:     recordedBy,
        createdAt:     serverTimestamp(),
      });

      await addDoc(collection(db, 'training_fund_expenses'), {
        amount:        veTotal,
        itemName:      validItems[0]?.itemName ?? 'Other',
        vendor:        vendor.name,
        vendorId:      veVendorId,
        linkedEntryId: veRef.id,
        quantity:      validItems.reduce((s, i) => s + i.quantity, 0),
        unitPrice:     0,
        remarks:       veRemarks || `Vendor Entry: ${validItems.map(i => i.itemName).join(', ')}`,
        paymentMode:   vePayNow !== 'none' ? vePaymentMode : '',
        checkNumber:   vePayNow !== 'none' && vePaymentMode === 'Check' ? veCheckNumber : '',
        transactionId: vePayNow !== 'none'
          ? getPaymentRef(vePaymentMode, veCheckNumber, veTransactionId) : '',
        billStatus:    bills.length > 0 ? 'Received' : 'Pending',
        billBase64:    bills[0]?.base64 ?? '',
        billFileName:  bills[0]?.fileName ?? '',
        billFileType:  bills[0]?.fileType ?? '',
        billFileSize:  bills[0]?.fileSize ?? 0,
        sizes:         [],
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
          fundKey:       'training_fund',
          fundLabel:     'Training Essentials Fund',
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
      setVeItems([{ itemName: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }]);
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
      const ref = await addDoc(collection(db, 'vendors'), {
        name:          qvName.trim(),
        phone:         qvPhone.trim(),
        address:       '',
        categoryKey:   'training_essentials',
        categoryLabel: 'Training Essentials',
        isActive:      true,
        notes:         '',
        createdAt:     serverTimestamp(),
        createdBy:     recordedBy,
      });
      setSuccessMsg(`✓ Vendor "${qvName}" add ho gaya!`);
      setExpVendorId(ref.id);
      setExpVendorName(qvName.trim());
      setQvName(''); setQvPhone('');
      setShowQuickVendor(false);
      await fetchAllData();
    } catch { setErrorMsg('Vendor save nahi hua'); }
    finally { setQvLoading(false); }
  };

  // ─────────────────────────────────────────
  // SAVE CUSTOM ITEM
  // ─────────────────────────────────────────
  const handleSaveCustomItem = async () => {
    if (!newItemName.trim()) { setErrorMsg('Item naam daalo'); return; }
    setItemLoading(true);
    try {
      let sizeOptions: string[] = [];
      if (newItemHasSizes) {
        if (newItemSizeType === 'shoe')   sizeOptions = SHOE_SIZES;
        if (newItemSizeType === 'shirt')  sizeOptions = SHIRT_SIZES;
        if (newItemSizeType === 'custom') {
          sizeOptions = newItemCustomSizes
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          if (sizeOptions.length === 0) {
            setErrorMsg('Custom sizes daalo (comma separated, e.g. S,M,L)');
            setItemLoading(false);
            return;
          }
        }
      }

      await addDoc(collection(db, 'training_custom_items'), {
        name:        newItemName.trim(),
        emoji:       newItemEmoji || '📦',
        category:    newItemCategory || 'Other',
        hasSizes:    newItemHasSizes,
        sizeOptions,
        isCustom:    true,
        createdAt:   serverTimestamp(),
        createdBy:   recordedBy,
      });

      setSuccessMsg(`✓ "${newItemName}" item add ho gaya!`);
      setNewItemName(''); setNewItemEmoji('📦');
      setNewItemCategory('Other'); setNewItemHasSizes(false);
      setNewItemCustomSizes('');
      setShowItemForm(false);
      await fetchAllData();
    } catch {
      setErrorMsg('Item save nahi hua');
    } finally { setItemLoading(false); }
  };

  // ─────────────────────────────────────────
  // CREATE RECOVERY
  // ─────────────────────────────────────────
  const handleCreateRecovery = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg('');
    if (!recChestNo || !recExpected) {
      setErrorMsg('Chest No aur expected amount daalo'); return;
    }

    setRecLoading(true);
    try {
      const tSnap = await getDocs(
        query(collection(db, 'trainees'), where('chestNo', '==', recChestNo.trim()))
      );
      if (tSnap.empty) {
        setErrorMsg(`Chest No "${recChestNo}" nahi mila`);
        setRecLoading(false);
        return;
      }

      const traineeDoc  = tSnap.docs[0];
      const traineeData = traineeDoc.data();
      const expected    = Number(recExpected);
      const initialPaid = Number(recPaidNow) || 0;
      const due         = Math.max(0, expected - initialPaid);

      const exists = recoveries.find(
        r => r.chestNo === recChestNo.trim() && r.label === recLabel
      );
      if (exists) {
        setErrorMsg(`Already exists: ${recLabel} for Chest ${recChestNo}`);
        setRecLoading(false);
        return;
      }

      await addDoc(collection(db, 'training_fund_recoveries'), {
        traineeId:      traineeDoc.id,
        traineeName:    traineeData.name ?? '',
        chestNo:        recChestNo.trim(),
        expectedAmount: expected,
        paidAmount:     initialPaid,
        dueAmount:      due,
        status:         due <= 0 ? 'Paid' : initialPaid > 0 ? 'Partial' : 'Pending',
        label:          recLabel,
        remarks:        '',
        date:           new Date().toISOString(),
        createdAt:      serverTimestamp(),
      });

      if (due > 0) {
        await updateDoc(doc(db, 'trainees', traineeDoc.id), {
          pendingRecoveryAmount: increment(due),
        });
      }

      if (initialPaid > 0) {
        await addDoc(collection(db, 'training_fund_collections'), {
          amount:         initialPaid,
          collectionType: 'per_head',
          perHead:        initialPaid,
          traineeCount:   1,
          label:          `${recLabel} - ${traineeData.name} (${recChestNo})`,
          remarks:        `Initial payment at recovery creation`,
          paymentMode:    'Cash',
          checkNumber:    '',
          transactionId:  '',
          recordedBy,
          date:           new Date().toISOString(),
          createdAt:      serverTimestamp(),
        });
      }

      setSuccessMsg(
        `✓ Recovery created: ${traineeData.name} (${recChestNo}) — Due: ${formatCurrency(due)}`
      );
      setRecChestNo(''); setRecExpected(''); setRecPaidNow('');
      setShowRecoveryForm(false);
      await fetchAllData();
    } catch {
      setErrorMsg('Error. Retry karo.');
    } finally { setRecLoading(false); }
  };

  // ─────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const colMap: Record<string, string> = {
        col:  'training_fund_collections',
        exp:  'training_fund_expenses',
        rec:  'training_fund_recoveries',
        item: 'training_custom_items',
      };
      await deleteDoc(doc(db, colMap[deleteConfirm.type], deleteConfirm.id));
      setSuccessMsg(`${deleteConfirm.label} delete ho gaya`);
      setDeleteConfirm(null);
      await fetchAllData();
    } catch { setErrorMsg('Delete nahi hua'); }
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-blue-400 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-blue-700 rounded-xl flex items-center justify-center text-xl">
            🎓
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
              Training Essentials Fund
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Collection · Item Purchase (with Sizes) · Vendor Billing ·
              Trainee Recovery · Live Stock Tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModuleReportButton module="training" stats={[{ label: 'Collections', value: formatCurrency(totalCollection) }, { label: 'Purchases', value: formatCurrency(totalExpense) }, { label: 'Paid', value: formatCurrency(totalActuallyPaid) }, { label: 'Balance', value: formatCurrency(totalCollection - totalActuallyPaid) }, { label: 'Vendor Due', value: formatCurrency(totalPendingDue) }, { label: 'Recovery Due', value: formatCurrency(totalRecoveryDue) }]} rows={expenses.map(e => ({ item: e.itemName, quantity: e.quantity, unitPrice: e.unitPrice, amount: e.amount, status: e.dueAmount > 0 ? `Due ${formatCurrency(e.dueAmount)}` : 'Paid', detail: e.vendor || e.remarks }))} />
          <button onClick={fetchAllData} disabled={dataLoading}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
            <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {successMsg && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-600" /> {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> {errorMsg}
          <button onClick={() => setErrorMsg('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* BALANCE CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <div className="bg-white border border-green-200 border-l-4 border-l-green-500 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Collection</p>
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
          <p className="text-[10px] text-orange-600 mt-1">{expenses.length} purchases</p>
        </div>

        <div className="bg-white border border-red-200 border-l-4 border-l-red-500 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Actually Paid</p>
            <TrendingDown size={14} className="text-red-400" />
          </div>
          <p className="text-xl font-black text-red-600">{formatCurrency(totalActuallyPaid)}</p>
          <p className="text-[10px] text-red-500 mt-1">Paisa gaya</p>
        </div>

        {transferredOut > 0 && (
          <div className="bg-purple-50 border border-purple-200 border-l-4 border-l-purple-500 rounded p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black text-slate-400 uppercase">Transferred</p>
              <span className="text-purple-500 text-sm">🔄</span>
            </div>
            <p className="text-xl font-black text-purple-700">{formatCurrency(transferredOut)}</p>
            <p className="text-[10px] text-purple-600 mt-1">To General Fund</p>
          </div>
        )}

        <div className={`border-l-4 rounded p-4 shadow-sm ${
          fundBalance >= 0
            ? 'bg-blue-50 border border-blue-200 border-l-blue-500'
            : 'bg-red-100 border border-red-300 border-l-red-600'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Cash in Hand</p>
            <Wallet size={14} className="text-blue-500" />
          </div>
          <p className={`text-xl font-black ${
            fundBalance >= 0 ? 'text-blue-700' : 'text-red-700'
          }`}>
            {fundBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(fundBalance))}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Available</p>
        </div>

        <div className={`border-l-4 rounded p-4 shadow-sm ${
          totalPendingDue > 0
            ? 'bg-amber-50 border border-amber-200 border-l-amber-500'
            : 'bg-green-50 border border-green-200 border-l-green-500'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Vendor Dues</p>
            <Building2 size={14} className={totalPendingDue > 0 ? 'text-amber-400' : 'text-green-400'} />
          </div>
          <p className={`text-xl font-black ${
            totalPendingDue > 0 ? 'text-amber-600' : 'text-green-600'
          }`}>
            {formatCurrency(totalPendingDue)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Vendor ko dena</p>
        </div>

        <div className={`border-l-4 rounded p-4 shadow-sm ${
          totalRecoveryDue > 0
            ? 'bg-purple-50 border border-purple-200 border-l-purple-500'
            : 'bg-green-50 border border-green-200 border-l-green-500'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Recovery Due</p>
            <UserMinus size={14} className={totalRecoveryDue > 0 ? 'text-purple-500' : 'text-green-500'} />
          </div>
          <p className={`text-xl font-black ${
            totalRecoveryDue > 0 ? 'text-purple-700' : 'text-green-700'
          }`}>
            {formatCurrency(totalRecoveryDue)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">{pendingRecoveries} pending</p>
        </div>
      </div>

      {/* INFO BANNER */}
      <div className="bg-blue-50 border border-blue-200 rounded px-4 py-3 flex items-start gap-2">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-blue-700 space-y-1">
          <p>
            <strong>Live Stock:</strong> Purchased − Issued (InventoryIssueScreen se issue
            hone par stock automatically kam ho jata hai). Refresh karein latest data ke liye.
          </p>
          <p>
            <strong>Cash in Hand</strong> = Collection − Paid − Transferred to General Fund
          </p>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            closeAllForms();
            setShowCollectionForm(true);
            setColTraineeCount(String(traineeCount));
          }}
          className="flex items-center gap-1.5 bg-green-700 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-green-800 rounded">
          <ArrowDownToLine size={13} /> Collect Karo
        </button>
        <button
          onClick={() => { closeAllForms(); setShowExpenseForm(true); }}
          className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-red-700 rounded">
          <ArrowUpFromLine size={13} /> Item Purchase
        </button>
        <button
          onClick={() => { closeAllForms(); setShowVendorEntryForm(true); }}
          className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-amber-700 rounded">
          <ShoppingCart size={13} /> Vendor Entry
        </button>
        <button
          onClick={() => { closeAllForms(); setShowRecoveryForm(true); }}
          className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-blue-800 rounded">
          <UserMinus size={13} /> Create Recovery
        </button>
        <button
          onClick={() => { closeAllForms(); setShowItemForm(true); }}
          className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-purple-700 rounded">
          <Plus size={13} /> Add Item
        </button>
      </div>

      {/* ── COLLECTION FORM ── */}
      {showCollectionForm && (
        <form onSubmit={handleSaveCollection}
          className="bg-green-50 border border-green-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-green-800 flex items-center gap-2">
              <Calculator size={14} /> Training Fund Collection
            </h3>
            <button type="button" onClick={() => setShowCollectionForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
              Collection Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setColType('round_figure')}
                className={`p-3 rounded-lg border-2 text-left ${
                  colType === 'round_figure'
                    ? 'border-green-600 bg-green-100'
                    : 'border-slate-200'
                }`}>
                <p className="text-xs font-black text-slate-800">💰 Round Figure</p>
                <p className="text-[9px] text-slate-500 mt-0.5">₹1000 per head × trainees</p>
              </button>
              <button type="button" onClick={() => setColType('per_head')}
                className={`p-3 rounded-lg border-2 text-left ${
                  colType === 'per_head'
                    ? 'border-green-600 bg-green-100'
                    : 'border-slate-200'
                }`}>
                <p className="text-xs font-black text-slate-800">👤 Per Head (Exact)</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Item cost ÷ trainees</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Per Head (₹) *
              </label>
              <input type="number" min={1} value={colPerHead}
                onChange={e => setColPerHead(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black focus:outline-none focus:border-green-600 rounded" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Trainees *
              </label>
              <input type="number" min={1} value={colTraineeCount}
                onChange={e => setColTraineeCount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black focus:outline-none focus:border-green-600 rounded" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Label</label>
              <input type="text" value={colLabel} onChange={e => setColLabel(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs focus:outline-none rounded" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
              <input type="text" value={colRemarks} onChange={e => setColRemarks(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs focus:outline-none rounded" />
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
            disabled={colLoading || !colPerHead || !colTraineeCount}
            className="bg-green-700 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-green-800 disabled:opacity-40 flex items-center gap-2 rounded">
            {colLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <CheckCircle2 size={13} />}
            Save · {formatCurrency(colTotal)} via {colPaymentMode}
          </button>
        </form>
      )}

      {/* ── EXPENSE FORM ── */}
      {showExpenseForm && (
        <form onSubmit={handleSaveExpense}
          className="bg-red-50 border border-red-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-red-800 flex items-center gap-2">
              <ShoppingBag size={14} /> Training Item Purchase
            </h3>
            <button type="button" onClick={() => setShowExpenseForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          {/* Item Selection */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
              Item * (Kya kharida?)
            </label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {allItems.map(item => (
                <button key={item.name} type="button"
                  onClick={() => setExpItemName(item.name)}
                  className={`p-2 rounded-lg border-2 text-center transition-all relative ${
                    expItemName === item.name
                      ? 'border-red-500 bg-red-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                  <span className="text-lg">{item.emoji}</span>
                  <p className={`text-[9px] font-black mt-0.5 ${
                    expItemName === item.name ? 'text-red-700' : 'text-slate-700'
                  }`}>{item.name}</p>
                  <p className="text-[7px] text-slate-400 leading-tight">{item.category}</p>
                  {item.hasSizes && (
                    <span className="absolute top-0.5 right-0.5 text-[7px] font-bold text-purple-600 bg-purple-50 px-1 rounded">
                      📏
                    </span>
                  )}
                  {item.isCustom && (
                    <span className="absolute top-0.5 left-0.5 text-[7px] font-bold text-green-600 bg-green-50 px-1 rounded">
                      ★
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* SIZE BREAKDOWN */}
          {selectedItem?.hasSizes && (
            <div className="bg-white border border-purple-300 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-purple-700 uppercase flex items-center gap-1">
                  <Ruler size={11} /> Size-wise Breakdown *
                </label>
                <button type="button" onClick={addSizeRow}
                  className="text-[10px] font-black bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">
                  + Add Size
                </button>
              </div>

              <div className="space-y-1.5">
                {expSizes.map((sz, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select value={sz.size}
                        onChange={e => updateSizeRow(idx, 'size', e.target.value)}
                        className="w-full border border-purple-300 px-2 py-1.5 text-xs font-bold rounded bg-white focus:outline-none">
                        <option value="">— Size chunno —</option>
                        {selectedItem.sizeOptions?.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5">
                      <input type="number" min={0} value={sz.quantity}
                        onChange={e =>
                          updateSizeRow(idx, 'quantity', parseInt(e.target.value) || 0)
                        }
                        placeholder="Qty"
                        className="w-full border border-purple-300 px-2 py-1.5 text-xs font-black rounded text-center focus:outline-none" />
                    </div>
                    <div className="col-span-2 text-center">
                      {expSizes.length > 1 && (
                        <button type="button" onClick={() => removeSizeRow(idx)}
                          className="text-red-400 hover:text-red-600 p-1">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded p-2 flex items-center justify-between">
                <span className="text-[10px] text-purple-700 font-bold">
                  Total Size Qty: <strong>{expSizeTotal}</strong>
                </span>
                <span className="text-[10px] text-purple-700">
                  Main Qty: <strong>{expQty}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Vendor Selection */}
          {expItemName && (
            <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Building2 size={10} /> Vendor (Optional)
                </label>
                <button type="button"
                  onClick={() => setShowQuickVendor(!showQuickVendor)}
                  className="text-[9px] font-black text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100">
                  + New Vendor
                </button>
              </div>

              <select value={expVendorId} onChange={e => {
                setExpVendorId(e.target.value);
                const v = vendors.find(v => v.id === e.target.value);
                setExpVendorName(v?.name ?? '');
              }}
                className="w-full border border-slate-300 px-3 py-2 text-xs font-bold rounded focus:outline-none bg-white">
                <option value="">— Bina Vendor (Direct Expense) —</option>
                {vendors.map(v => {
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
                    <input type="text" value={qvName}
                      onChange={e => setQvName(e.target.value)}
                      placeholder="Vendor naam *"
                      className="border border-green-300 px-3 py-1.5 text-xs font-bold rounded focus:outline-none" />
                    <input type="text" value={qvPhone}
                      onChange={e => setQvPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="border border-green-300 px-3 py-1.5 text-xs rounded focus:outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleQuickAddVendor}
                      disabled={qvLoading || !qvName.trim()}
                      className="bg-green-700 text-white px-3 py-1.5 text-[10px] font-black rounded hover:bg-green-800 disabled:opacity-40 flex items-center gap-1">
                      {qvLoading
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Plus size={10} />} Add
                    </button>
                    <button type="button" onClick={() => setShowQuickVendor(false)}
                      className="text-[10px] font-bold text-slate-500 px-2">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Details */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Qty *</label>
              <input type="number" min={1} value={expQty}
                onChange={e => setExpQty(e.target.value)}
                disabled={selectedItem?.hasSizes && expSizes.length > 0}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none disabled:bg-slate-50" />
              {selectedItem?.hasSizes && (
                <p className="text-[8px] text-purple-600 mt-0.5">Auto from sizes</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Unit Price (₹)
              </label>
              <input type="number" min={0} value={expUnitPrice}
                onChange={e => setExpUnitPrice(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Total (₹) *
              </label>
              <input type="number" min={1} value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none focus:border-red-500"
                placeholder={autoAmount > 0 ? String(autoAmount) : '0'} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vendor</label>
              <input type="text"
                value={
                  expVendorId
                    ? (vendors.find(v => v.id === expVendorId)?.name ?? '')
                    : expVendorName
                }
                onChange={e => { if (!expVendorId) setExpVendorName(e.target.value); }}
                disabled={!!expVendorId}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none disabled:bg-slate-50" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Bill Status
              </label>
              <select value={expBillStatus}
                onChange={e =>
                  setExpBillStatus(e.target.value as TrainingExpense['billStatus'])
                }
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none bg-white">
                <option value="Received">Received</option>
                <option value="Pending">Pending</option>
                <option value="Verified">Verified</option>
                <option value="No Bill">No Bill</option>
              </select>
            </div>
          </div>

          {Number(expQty) > 0 && Number(expUnitPrice) > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded p-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-600">
                {expQty} × ₹{Number(expUnitPrice).toLocaleString('en-IN')}
              </span>
              <span className="text-sm font-black text-red-600">
                = ₹{autoAmount.toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {/* Payment Status */}
          {expVendorId && (Number(expAmount) > 0 || autoAmount > 0) && (
            <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                Payment Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'none',    label: '⏳ Due',     hint: 'Baad mein pay' },
                  { key: 'partial', label: '💰 Partial', hint: 'Kuch abhi do'  },
                  { key: 'full',    label: '✅ Full',    hint: 'Poora de do'   },
                ] as const).map(opt => (
                  <button key={opt.key} type="button"
                    onClick={() => {
                      setExpPayNow(opt.key);
                      const amt = expAmount ? expAmount : String(autoAmount);
                      if (opt.key === 'full') setExpPayAmount(amt);
                      if (opt.key === 'none') setExpPayAmount('');
                    }}
                    className={`p-2 rounded-lg border-2 text-left ${
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
                <input type="number" min={1} value={expPayAmount}
                  onChange={e => setExpPayAmount(e.target.value)}
                  className="w-full border border-amber-300 px-3 py-2 text-sm font-black rounded focus:outline-none"
                  placeholder="Pay Amount *" />
              )}
            </div>
          )}

          {/* Bill Upload */}
          <div className="bg-white border border-slate-200 rounded p-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Bill Upload
            </label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => setExpBillFile(e.target.files?.[0] ?? null)}
              className="text-xs" />
            {expBillFile && (
              <span className="text-[10px] text-green-600 font-bold ml-2">
                ✓ {expBillFile.name}
              </span>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
            <input type="text" value={expRemarks} onChange={e => setExpRemarks(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none" />
          </div>

          {(expPayNow !== 'none' || !expVendorId) && (
            <PaymentModeSelector
              mode={expPaymentMode} setMode={setExpPaymentMode}
              checkNumber={expCheckNumber} setCheckNumber={setExpCheckNumber}
              transactionId={expTransactionId} setTransactionId={setExpTransactionId}
            />
          )}

          <button type="submit"
            disabled={expLoading || !expItemName}
            className="bg-red-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-red-700 disabled:opacity-40 flex items-center gap-2 rounded">
            {expLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <Plus size={13} />}
            Save Purchase{expVendorId ? ' + Vendor Entry' : ''}
          </button>
        </form>
      )}

      {/* ── CUSTOM ITEM FORM ── */}
      {showItemForm && (
        <div className="bg-purple-50 border border-purple-300 rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-purple-800 flex items-center gap-2">
              <Tag size={14} /> Add Custom Training Item
            </h3>
            <button onClick={() => setShowItemForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Item Name *
              </label>
              <input type="text" value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-xs font-bold rounded focus:outline-none"
                placeholder="e.g. Belt" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Emoji</label>
              <input type="text" value={newItemEmoji}
                onChange={e => setNewItemEmoji(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-sm rounded focus:outline-none"
                maxLength={2} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Category</label>
              <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-xs rounded bg-white focus:outline-none">
                {['Footwear', 'Uniform', 'Bedding', 'Mess Item', 'Equipment', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white border border-purple-200 rounded p-3 space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={newItemHasSizes}
                onChange={e => setNewItemHasSizes(e.target.checked)}
                className="rounded" />
              <span className="text-[10px] font-black text-purple-700">Sizing required?</span>
            </label>

            {newItemHasSizes && (
              <div className="space-y-2 pl-6">
                <div className="grid grid-cols-3 gap-2">
                  {(['shoe', 'shirt', 'custom'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setNewItemSizeType(t)}
                      className={`p-2 rounded border-2 text-[10px] font-bold ${
                        newItemSizeType === t
                          ? 'border-purple-500 bg-purple-100'
                          : 'border-slate-200'
                      }`}>
                      {t === 'shoe'  ? '👞 Shoe (5-13)'    :
                       t === 'shirt' ? '👕 Shirt (S-XXXL)' :
                       '✏️ Custom'}
                    </button>
                  ))}
                </div>
                {newItemSizeType === 'custom' && (
                  <input type="text" value={newItemCustomSizes}
                    onChange={e => setNewItemCustomSizes(e.target.value)}
                    placeholder="Sizes (comma separated): e.g. Small, Medium, Large"
                    className="w-full border border-purple-300 px-3 py-2 text-xs rounded focus:outline-none" />
                )}
              </div>
            )}
          </div>

          <button onClick={handleSaveCustomItem}
            disabled={itemLoading || !newItemName.trim()}
            className="bg-purple-600 text-white px-4 py-2 text-xs font-black uppercase rounded hover:bg-purple-700 disabled:opacity-40 flex items-center gap-2">
            {itemLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <Plus size={13} />}
            Add Item
          </button>
        </div>
      )}

      {/* ── VENDOR ENTRY FORM ── */}
      {showVendorEntryForm && (
        <div className="bg-amber-50 border border-amber-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-amber-800 flex items-center gap-2">
              <ShoppingCart size={14} /> Vendor Purchase Entry
            </h3>
            <button onClick={() => setShowVendorEntryForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vendor *</label>
            <select value={veVendorId} onChange={e => setVeVendorId(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-sm font-bold rounded focus:outline-none bg-white">
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Items *</label>
                  <button type="button" onClick={addVeRow}
                    className="text-[10px] font-black bg-amber-600 text-white px-2.5 py-1 rounded hover:bg-amber-700">
                    + Add Row
                  </button>
                </div>

                <div className="space-y-1.5">
                  {veItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                      <input type="text" value={item.itemName}
                        onChange={e => updateVeRow(idx, 'itemName', e.target.value)}
                        placeholder="Item naam..."
                        className="col-span-4 border border-slate-300 px-2 py-1.5 text-xs font-bold rounded focus:outline-none" />
                      <input type="number" min={0} value={item.quantity}
                        onChange={e => updateVeRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="col-span-2 border border-slate-300 px-2 py-1.5 text-xs font-black rounded text-center focus:outline-none" />
                      <select value={item.unit}
                        onChange={e => updateVeRow(idx, 'unit', e.target.value)}
                        className="col-span-2 border border-slate-300 px-1 py-1.5 text-xs rounded bg-white focus:outline-none">
                        {['pcs','kg','g','L','ml','doz','box','pkt','bag','set'].map(u => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                      <input type="number" min={0} value={item.unitPrice}
                        onChange={e => updateVeRow(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="₹"
                        className="col-span-2 border border-slate-300 px-2 py-1.5 text-xs font-black rounded text-center focus:outline-none" />
                      <span className="col-span-1 text-[10px] font-black text-amber-700 text-right">
                        {item.total > 0 ? `₹${item.total}` : '—'}
                      </span>
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
                    {(['none', 'partial', 'full'] as const).map(opt => (
                      <button key={opt} type="button"
                        onClick={() => {
                          setVePayNow(opt);
                          if (opt === 'full') setVePayAmount(String(veTotal));
                          if (opt === 'none') setVePayAmount('');
                        }}
                        className={`p-2 rounded border-2 text-[10px] font-bold uppercase ${
                          vePayNow === opt
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-slate-200'
                        }`}>
                        {opt === 'none' ? '⏳ Due' : opt === 'partial' ? '💰 Partial' : '✅ Full'}
                      </button>
                    ))}
                  </div>

                  {vePayNow === 'partial' && (
                    <input type="number" min={1} max={veTotal} value={vePayAmount}
                      onChange={e => setVePayAmount(e.target.value)}
                      className="w-full border border-amber-300 px-3 py-2 text-sm font-black rounded focus:outline-none" />
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
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={e => setVeBillFile(e.target.files?.[0] ?? null)}
                  className="text-xs" />
                {veBillFile && (
                  <span className="text-[10px] text-green-600 font-bold ml-2">
                    ✓ {veBillFile.name}
                  </span>
                )}
              </div>

              <input type="text" value={veRemarks} onChange={e => setVeRemarks(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                placeholder="Remarks..." />

              <button type="button" onClick={handleSaveVendorEntry}
                disabled={veLoading || !veVendorId || veTotal <= 0}
                className="bg-amber-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-amber-700 disabled:opacity-40 flex items-center gap-2 rounded w-full justify-center">
                {veLoading
                  ? <Loader2 size={13} className="animate-spin" />
                  : <ShoppingCart size={13} />}
                Save Entry — {formatCurrency(veTotal)}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── RECOVERY FORM ── */}
      {showRecoveryForm && (
        <form onSubmit={handleCreateRecovery}
          className="bg-blue-50 border border-blue-300 rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-blue-800 flex items-center gap-2">
              <UserMinus size={14} /> Recovery Entry
            </h3>
            <button type="button" onClick={() => setShowRecoveryForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="text" required value={recChestNo}
              onChange={e => setRecChestNo(e.target.value)}
              className="border border-slate-300 px-3 py-2 text-xs font-black focus:outline-none rounded"
              placeholder="Chest No *" />
            <select value={recLabel} onChange={e => setRecLabel(e.target.value)}
              className="border border-slate-300 px-3 py-2 text-xs focus:outline-none rounded">
              <option>Training Kit</option>
              <option>Shoes Recovery</option>
              <option>Uniform Recovery</option>
              <option>Equipment Recovery</option>
              <option>Other</option>
            </select>
            <input type="number" min={1} required value={recExpected}
              onChange={e => setRecExpected(e.target.value)}
              className="border border-slate-300 px-3 py-2 text-xs font-black focus:outline-none rounded"
              placeholder="Expected Amount *" />
            <input type="number" min={0} value={recPaidNow}
              onChange={e => setRecPaidNow(e.target.value)}
              className="border border-slate-300 px-3 py-2 text-xs focus:outline-none rounded"
              placeholder="Paid Now (optional)" />
          </div>
          <button type="submit" disabled={recLoading}
            className="bg-blue-700 text-white px-5 py-2 text-xs font-black uppercase hover:bg-blue-800 disabled:opacity-50 flex items-center gap-2 rounded">
            {recLoading
              ? <Loader2 size={12} className="animate-spin" />
              : <Plus size={12} />}
            Create Recovery
          </button>
        </form>
      )}

      {/* ── TABS ── */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {([
            { key: 'overview',    label: 'Overview',    icon: <Package size={13} /> },
            { key: 'stock',       label: 'Live Stock',  icon: <Ruler size={13} /> },
            { key: 'collections', label: 'Collections', icon: <ArrowDownToLine size={13} />, count: collections.length },
            { key: 'expenses',    label: 'Purchases',   icon: <ShoppingBag size={13} />,     count: expenses.length },
            { key: 'recoveries',  label: 'Recoveries',  icon: <UserMinus size={13} />,       count: pendingRecoveries },
            { key: 'vendor_dues', label: 'Vendor Dues', icon: <Building2 size={13} />,
              count: trainingVendorDues.filter(v => v.totalDue > 0).length },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-black uppercase border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {tab.icon} {tab.label}
              {'count' in tab && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {itemTotals.map(item => {
              const stockKey  = normalizeName(item.name);
              const liveStock = liveStockMap[stockKey];
              return (
                <div key={item.name}
                  className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{item.emoji}</span>
                    <button
                      onClick={() => {
                        closeAllForms();
                        setExpItemName(item.name);
                        setShowExpenseForm(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
                      + Add
                    </button>
                  </div>
                  <p className="text-xs font-black text-slate-800">{item.name}</p>
                  <p className="text-[9px] text-slate-400 mb-1">
                    {item.category}
                    {item.hasSizes && <span className="ml-1 text-purple-600">📏</span>}
                    {item.isCustom && <span className="ml-1 text-green-600">★</span>}
                  </p>
                  <p className="text-lg font-black text-red-600">
                    {item.total > 0 ? formatCurrency(item.total) : '₹0'}
                  </p>
                  {/* ✅ Live stock indicator on overview cards */}
                  {liveStock && (
                    <div className="mt-1 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-slate-400">Stock:</span>
                        <span className={`font-black ${
                          liveStock.currentStock === 0
                            ? 'text-red-600'
                            : liveStock.currentStock <= 5
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`}>
                          {liveStock.currentStock} left
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400">
                        <span>Issued: {liveStock.totalIssued}</span>
                        <span>/{liveStock.totalPurchased}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-blue-100 border-2 border-blue-300 rounded p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-blue-700 uppercase">Total Training Expense</p>
              <p className="text-[10px] text-blue-600 mt-0.5">
                {expenses.length} purchases · {allItems.length} items
              </p>
            </div>
            <p className="text-2xl font-black text-blue-800">{formatCurrency(totalExpense)}</p>
          </div>
        </div>
      )}

      {/* ── TAB: LIVE STOCK ── */}
      {activeTab === 'stock' && (
        <div className="space-y-3">
          {/* Info Banner */}
          <div className="bg-purple-50 border border-purple-200 rounded px-4 py-2.5 flex items-start gap-2">
            <Ruler size={13} className="text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-purple-700 font-semibold">
              <strong>Live Stock = Purchased − Issued.</strong> InventoryIssueScreen se
              jo bhi issue hua hai wo automatically yahan se kam ho jata hai.
              Refresh karein latest data ke liye.
            </p>
          </div>

          {/* ✅ ALL items stock — sized & non-sized both */}
          {Object.keys(liveStockMap).length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Package size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi item purchase nahi hua abhi tak</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* ── SIZED ITEMS ── */}
              {Object.entries(liveStockMap)
                .filter(([, stock]) =>
                  Object.keys(stock.liveSizes).length > 0
                )
                .map(([key, stock]) => {
                  const item = allItems.find(
                    i => normalizeName(i.name) === key
                  );
                  return (
                    <div key={key}
                      className="bg-white border-2 border-purple-200 rounded-xl overflow-hidden">
                      {/* Item Header */}
                      <div className="bg-purple-600 text-white px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{item?.emoji ?? '📦'}</span>
                          <div>
                            <p className="text-sm font-black uppercase">{stock.itemName}</p>
                            <p className="text-[9px] text-purple-200">
                              Purchased: {stock.totalPurchased} ·
                              Issued: {stock.totalIssued} ·
                              Available: {stock.currentStock}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            stock.currentStock === 0
                              ? 'bg-red-500 text-white'
                              : stock.currentStock <= 5
                              ? 'bg-amber-400 text-white'
                              : 'bg-white/20 text-white'
                          }`}>
                            {stock.currentStock === 0
                              ? '❌ Out of Stock'
                              : `✅ ${stock.currentStock} Available`}
                          </span>
                        </div>
                      </div>

                      {/* Size breakdown grid */}
                      <div className="p-4 grid grid-cols-4 md:grid-cols-7 gap-2">
                        {Object.entries(stock.liveSizes)
                          .sort((a, b) => {
                            const order = [...SHOE_SIZES, ...SHIRT_SIZES];
                            const ai = order.indexOf(a[0]);
                            const bi = order.indexOf(b[0]);
                            if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
                            if (ai === -1) return 1;
                            if (bi === -1) return -1;
                            return ai - bi;
                          })
                          .map(([size, liveQty]) => {
                            const purchased = stock.purchasedSizes[size] || 0;
                            const issued    = stock.issuedSizes[size]    || 0;
                            return (
                              <div key={size}
                                className={`border rounded p-2 text-center ${
                                  liveQty === 0
                                    ? 'bg-red-50 border-red-200'
                                    : liveQty <= 2
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-purple-50 border-purple-200'
                                }`}>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Size</p>
                                <p className="text-sm font-black text-slate-800">{size}</p>
                                <p className={`text-lg font-black ${
                                  liveQty === 0 ? 'text-red-600'
                                  : liveQty <= 2 ? 'text-amber-600'
                                  : 'text-purple-800'
                                }`}>
                                  {liveQty}
                                </p>
                                <p className="text-[8px] text-slate-400 mt-0.5">
                                  {issued}/{purchased}
                                </p>
                                <p className="text-[8px] font-bold text-slate-500">
                                  {liveQty === 0 ? '❌ Out' : 'left'}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })
              }

              {/* ── NON-SIZED ITEMS ── */}
              {(() => {
                const nonSizedItems = Object.entries(liveStockMap).filter(
                  ([, stock]) => Object.keys(stock.liveSizes).length === 0
                );
                if (nonSizedItems.length === 0) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-700 text-white px-4 py-2.5 flex items-center gap-2">
                      <Package size={15} />
                      <p className="text-sm font-black uppercase">
                        Non-Sized Items ({nonSizedItems.length})
                      </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {nonSizedItems.map(([key, stock]) => {
                        const item = allItems.find(
                          i => normalizeName(i.name) === key
                        );
                        return (
                          <div key={key}
                            className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{item?.emoji ?? '📦'}</span>
                              <div>
                                <p className="text-xs font-black text-slate-800">
                                  {stock.itemName}
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  {item?.category ?? 'Other'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-center">
                              <div>
                                <p className="text-[9px] text-slate-400 uppercase">Purchased</p>
                                <p className="text-sm font-black text-slate-700">
                                  {stock.totalPurchased}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-amber-500 uppercase">Issued</p>
                                <p className="text-sm font-black text-amber-600">
                                  {stock.totalIssued}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase font-bold ${
                                  stock.currentStock === 0
                                    ? 'text-red-500'
                                    : stock.currentStock <= 5
                                    ? 'text-amber-500'
                                    : 'text-green-500'
                                }">Available</p>
                                <p className={`text-lg font-black ${
                                  stock.currentStock === 0
                                    ? 'text-red-600'
                                    : stock.currentStock <= 5
                                    ? 'text-amber-600'
                                    : 'text-green-600'
                                }`}>
                                  {stock.currentStock}
                                </p>
                              </div>
                              <div className={`text-[9px] font-bold px-2 py-1 rounded ${
                                stock.currentStock === 0
                                  ? 'bg-red-100 text-red-600'
                                  : stock.currentStock <= 5
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-green-100 text-green-600'
                              }`}>
                                {stock.currentStock === 0 ? '❌ Out' : '✅ OK'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: COLLECTIONS ── */}
      {activeTab === 'collections' && (
        <div className="space-y-1">
          {collections.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Receipt size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi collection nahi</p>
            </div>
          ) : (
            collections.map(c => (
              <div key={c.id} className="bg-white border p-3 flex justify-between items-center rounded">
                <div>
                  <p className="text-xs font-black text-slate-800">{c.label}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(c.date)} · {c.remarks}</p>
                </div>
                <div className="flex items-center gap-3">
                  <PaymentModeBadge
                    mode={c.paymentMode}
                    checkNumber={c.checkNumber}
                    transactionId={c.transactionId}
                  />
                  <span className="text-sm font-black text-green-700">
                    +{formatCurrency(c.amount)}
                  </span>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'col', id: c.id, label: c.label })}
                    className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: PURCHASES ── */}
      {activeTab === 'expenses' && (
        <div className="space-y-1">
          {expenses.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ShoppingBag size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi purchase nahi</p>
            </div>
          ) : (
            expenses.map(exp => {
              const bsc  = BILL_STATUS_CONFIG[exp.billStatus] ?? BILL_STATUS_CONFIG['Pending'];
              const item = allItems.find(t => t.name === exp.itemName);
              return (
                <div key={exp.id} className="bg-white border p-3 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black text-slate-800">
                          {item?.emoji ?? '📦'} {exp.itemName}
                        </p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${bsc.cls}`}>
                          {exp.billStatus}
                        </span>
                        {exp.vendorId && <Building2 size={10} className="text-blue-500" />}
                        {exp.vendor && (
                          <span className="text-[10px] text-slate-600">{exp.vendor}</span>
                        )}
                        {exp.dueAmount > 0 && (
                          <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            Due: {formatCurrency(exp.dueAmount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                        <span>{formatDate(exp.date)}</span>
                        <span>{exp.quantity} × ₹{exp.unitPrice}</span>
                        {exp.paymentMode && (
                          <PaymentModeBadge
                            mode={exp.paymentMode}
                            checkNumber={exp.checkNumber}
                            transactionId={exp.transactionId}
                          />
                        )}
                      </div>
                      {exp.sizes && exp.sizes.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] font-bold text-purple-600">Sizes:</span>
                          {exp.sizes.map((sz, i) => (
                            <span key={i}
                              className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                              {sz.size}: {sz.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-black text-red-600">
                        −{formatCurrency(exp.amount)}
                      </span>
                      <button
                        onClick={() =>
                          setDeleteConfirm({ type: 'exp', id: exp.id, label: exp.itemName })
                        }
                        className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: RECOVERIES ── */}
      {activeTab === 'recoveries' && (
        <div className="space-y-1">
          {recoveries.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-green-300" />
              <p className="text-sm font-bold">Koi recovery pending nahi!</p>
            </div>
          ) : (
            recoveries.map(r => {
              const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG['Pending'];
              return (
                <div key={r.id}
                  className="bg-white border p-3 rounded flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-800">
                      {r.chestNo} · {r.traineeName}
                    </p>
                    <p className="text-[10px] text-slate-500">{r.label}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px]">
                        Banta: {formatCurrency(r.expectedAmount)} ·
                        Diya: {formatCurrency(r.paidAmount)}
                      </p>
                      <p className="text-xs font-black text-red-600">
                        Baaki: {formatCurrency(r.dueAmount)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black ${sc.cls}`}>
                      {r.status}
                    </span>
                    {r.status !== 'Paid' && (
                      <button onClick={() => setRecoveryPayTarget(r)}
                        className="bg-blue-800 text-white px-2.5 py-1 text-[9px] font-black uppercase hover:bg-blue-700 rounded">
                        Le Lo
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setDeleteConfirm({ type: 'rec', id: r.id, label: r.traineeName })
                      }
                      className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: VENDOR DUES ── */}
      {activeTab === 'vendor_dues' && (
        <div className="space-y-2">
          {trainingVendorDues.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi vendor due nahi</p>
            </div>
          ) : (
            trainingVendorDues.map(vd => (
              <div key={vd.vendorId}
                className="bg-white border-2 border-red-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-800">{vd.vendorName}</p>
                  <p className="text-[10px] text-slate-500">
                    {vd.categoryLabel} · {vd.entries} entries
                  </p>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase">Total</p>
                    <p className="text-xs font-black">{formatCurrency(vd.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-green-500 uppercase">Paid</p>
                    <p className="text-xs font-black text-green-600">{formatCurrency(vd.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-red-500 uppercase">Due</p>
                    <p className="text-sm font-black text-red-600">{formatCurrency(vd.totalDue)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      {recoveryPayTarget && (
        <RecoveryPayModal
          recovery={recoveryPayTarget}
          recordedBy={recordedBy}
          onClose={() => setRecoveryPayTarget(null)}
          onSuccess={async () => {
            setRecoveryPayTarget(null);
            setSuccessMsg('Payment record ho gaya!');
            await fetchAllData();
          }}
        />
      )}

      {previewBill && (
        <BillPreviewModal bill={previewBill} onClose={() => setPreviewBill(null)} />
      )}

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
    </div>
  );
};

export default TrainingFundScreen;