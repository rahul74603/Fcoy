// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\companyAssets\CompanyAssetsFundScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Wallet, Plus, Loader2, X, CheckCircle2, AlertTriangle,
  RefreshCw, TrendingUp, TrendingDown, Info, Trash2,
  Filter, ArrowDownToLine, ArrowUpFromLine, Calculator,
  Building2, Receipt,
  ShoppingCart,
  Landmark, Shield, Archive, Tag, ArrowRightLeft,
  Boxes, Layers
} from 'lucide-react';

import {
  collection, addDoc, getDocs, doc, deleteDoc,
  updateDoc, serverTimestamp
} from 'firebase/firestore';

import { db } from '../../config/firebase';
import { visibleDocCount } from '../../utils/devDataFilter';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';

import {
  PaymentModeSelector,
  PaymentModeBadge,
  validatePaymentMode,
  getPaymentRef
} from '../shared/PaymentModeSelector';
import type { PaymentMode } from '../shared/PaymentModeSelector';

import {
  formatCurrency,
  formatDate,
  processBillFile
} from '../finance/shared/utils';

import { BILL_STATUS_CONFIG } from '../finance/shared/constants';

import type { Vendor, VendorEntry, VendorItem, BillAttachment } from '../finance/vendors/types';

import BillPreviewModal from '../finance/shared/BillPreviewModal';
import { ModuleReportButton } from '../system/ModuleReportButton';


// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface AssetCollection {
  id: string;
  batchId?: string;
  amount: number;
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

interface AssetExpense {
  id: string;
  batchId?: string;
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
  assetStatus: 'Active' | 'Damaged' | 'Disposed';
  dueAmount: number;
  paidAmount: number;
  damagedQty?: number;
  disposedQty?: number;
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

interface AssetItem {
  name: string;
  emoji: string;
  hint: string;
  isCustom?: boolean;
  id?: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const FIXED_ASSET_ITEMS: AssetItem[] = [
  { name: 'Tent',                emoji: '⛺', hint: 'Training / camping tent'         },
  { name: 'Chair',               emoji: '🪑', hint: 'Plastic / folding chairs'        },
  { name: 'Bench',               emoji: '🪑', hint: 'Wooden / metal benches'          },
  { name: 'Dining Table',        emoji: '🍽️', hint: 'Mess dining tables'              },
  { name: 'Cooler',              emoji: '❄️', hint: 'Air / desert cooler'              },
  { name: 'Pankha / Fan',        emoji: '🌀', hint: 'Ceiling / table fan'             },
  { name: 'Glass Cutter Machine',emoji: '🔧', hint: 'Industrial glass cutter'         },
  { name: 'Almirah',             emoji: '🗄️', hint: 'Steel / wooden almirah'          },
  { name: 'Trunk',               emoji: '📦', hint: 'Storage trunk / box'             },
  { name: 'Lantern',             emoji: '🏮', hint: 'Emergency lantern'               },
  { name: 'Generator',           emoji: '⚡', hint: 'Power generator'                 },
  { name: 'Water Tank',          emoji: '💧', hint: 'Plastic / metal water tank'      },
  { name: 'Heater',              emoji: '🔥', hint: 'Room / water heater'             },
  { name: 'Washing Machine',     emoji: '🫧', hint: 'Clothes washing machine'         },
  { name: 'TV / Display',        emoji: '📺', hint: 'Television / display screen'     },
  { name: 'Speaker / PA System', emoji: '🔊', hint: 'Public address / parade speaker' },
  { name: 'Barbed Wire',         emoji: '🪡', hint: 'Fencing barbed wire'             },
  { name: 'Ladder',              emoji: '🪜', hint: 'Aluminium / wooden ladder'       },
];

const OTHER_ITEM: AssetItem = { name: 'Other', emoji: '🏗️', hint: 'Jo upar fit na ho' };

const ASSET_STATUS_CONFIG: Record<string, { cls: string; label: string }> = {
  Active:   { cls: 'bg-green-100 text-green-700',  label: 'Active'   },
  Damaged:  { cls: 'bg-red-100 text-red-700',      label: 'Damaged'  },
  Disposed: { cls: 'bg-slate-100 text-slate-600',  label: 'Disposed' },
};

// ═════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════
export const CompanyAssetsFundScreen: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const recordedBy = user?.email ?? 'Quarter Master';

  // ── BATCH CONTEXT ──
  const { activeBatch, allBatches, loading: batchLoading } = useBatch();
  const [selectedBatchId, setSelectedBatchId] = useState<string>('All');

  useEffect(() => {
    if (activeBatch && selectedBatchId === 'All') {
      setSelectedBatchId(activeBatch.id);
    }
  }, [activeBatch]);

  // ── DATA STATE ──
  const [collections, setCollections]       = useState<AssetCollection[]>([]);
  const [expenses, setExpenses]             = useState<AssetExpense[]>([]);
  const [vendors, setVendors]               = useState<Vendor[]>([]);
  const [vendorEntries, setVendorEntries]   = useState<VendorEntry[]>([]);
  const [customItems, setCustomItems]       = useState<AssetItem[]>([]);
  const [traineeCount, setTraineeCount]     = useState(0);
  const [dataLoading, setDataLoading]       = useState(true);
  const [transferredOut, setTransferredOut] = useState(0);

  // ── COLLECTION FORM ──
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [colPerHead, setColPerHead]                 = useState('');
  const [colTraineeCount, setColTraineeCount]       = useState('');
  const [colLabel, setColLabel]                     = useState('Company Assets Cutting');
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
  const [expBillStatus, setExpBillStatus]       = useState<AssetExpense['billStatus']>('Received');
  const [expBillFile, setExpBillFile]           = useState<File | null>(null);
  const [expPayNow, setExpPayNow]               = useState<'full' | 'partial' | 'none'>('none');
  const [expPayAmount, setExpPayAmount]         = useState('');
  const [expLoading, setExpLoading]             = useState(false);

  // ── VENDOR ENTRY FORM ──
  const [showVendorEntryForm, setShowVendorEntryForm] = useState(false);
  const [veVendorId, setVeVendorId]                   = useState('');
  const [veItems, setVeItems]                         = useState<VendorItem[]>([
    { itemName: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }
  ]);
  const [veRemarks, setVeRemarks]         = useState('');
  const [vePayNow, setVePayNow]           = useState<'full' | 'partial' | 'none'>('none');
  const [vePayAmount, setVePayAmount]     = useState('');
  const [vePaymentMode, setVePaymentMode] = useState<PaymentMode>('Cash');
  const [veCheckNumber, setVeCheckNumber] = useState('');
  const [veTransactionId, setVeTransactionId] = useState('');
  const [veBillFile, setVeBillFile]       = useState<File | null>(null);
  const [veLoading, setVeLoading]         = useState(false);

  // ── QUICK ADD VENDOR ──
  const [showQuickVendor, setShowQuickVendor] = useState(false);
  const [qvName, setQvName]                   = useState('');
  const [qvPhone, setQvPhone]                 = useState('');
  const [qvLoading, setQvLoading]             = useState(false);

  // ── CUSTOM ITEM FORM ── (NEW)
  const [showItemForm, setShowItemForm]   = useState(false);
  const [newItemName, setNewItemName]     = useState('');
  const [newItemEmoji, setNewItemEmoji]   = useState('📦');
  const [newItemHint, setNewItemHint]     = useState('');
  const [itemLoading, setItemLoading]     = useState(false);

  // ── UI STATE ──
  const [activeTab, setActiveTab]           = useState<'overview' | 'collections' | 'expenses' | 'assets' | 'vendor_dues'>('overview');
  const [successMsg, setSuccessMsg]         = useState('');
  const [errorMsg, setErrorMsg]             = useState('');
  const [filterAssetStatus, setFilterAssetStatus] = useState<string>('All');
  const [assetSearchText, setAssetSearchText] = useState('');

  useEffect(() => {
    const term = new URLSearchParams(location.search).get('search');
    if (term) setAssetSearchText(term);
  }, [location.search]);
  const [previewBill, setPreviewBill]       = useState<BillAttachment | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<{
    type: 'col' | 'exp' | 'item';
    id: string;
    label: string;
  } | null>(null);

  // ── ALL ITEMS (Fixed + Custom + Other) ──
  const allItems: AssetItem[] = [
    ...FIXED_ASSET_ITEMS,
    ...customItems,
    OTHER_ITEM,
  ];

  // ── CLOSE ALL FORMS ──
  const closeAllForms = () => {
    setShowCollectionForm(false);
    setShowExpenseForm(false);
    setShowVendorEntryForm(false);
    setShowQuickVendor(false);
    setShowItemForm(false);
  };

  // ─────────────────────────────────────────
  // FETCH
  // ─────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      const tSnap = await getDocs(collection(db, 'trainees'));
      setTraineeCount(visibleDocCount(tSnap));

      // Collections
      const cSnap = await getDocs(collection(db, 'company_assets_collections'));
      const cList: AssetCollection[] = [];
      cSnap.forEach(d => {
        const data = d.data();
        cList.push({
          id:            d.id,
          batchId:       data.batchId ?? '',
          amount:        Number(data.amount ?? 0),
          perHead:       Number(data.perHead ?? 0),
          traineeCount:  Number(data.traineeCount ?? 0),
          label:         data.label ?? '',
          remarks:       data.remarks ?? '',
          paymentMode:   data.paymentMode ?? 'Cash',
          checkNumber:   data.checkNumber ?? '',
          transactionId: data.transactionId ?? '',
          recordedBy:    data.recordedBy ?? '',
          date:          data.date ?? '',
        });
      });
      cList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCollections(cList);

      // Expenses
      const eSnap = await getDocs(collection(db, 'company_assets_expenses'));
      const eList: AssetExpense[] = [];
      eSnap.forEach(d => {
        const data = d.data();
        eList.push({
          id:            d.id,
          batchId:       data.batchId ?? '',
          amount:        Number(data.amount ?? 0),
          itemName:      data.itemName ?? '',
          vendor:        data.vendor ?? '',
          vendorId:      data.vendorId ?? data.linkedVendorId ?? '',
          linkedEntryId: data.linkedEntryId ?? '',
          quantity:      Number(data.quantity ?? 0),
          unitPrice:     Number(data.unitPrice ?? 0),
          remarks:       data.remarks ?? '',
          paymentMode:   data.paymentMode ?? '',
          checkNumber:   data.checkNumber ?? '',
          transactionId: data.transactionId ?? '',
          billStatus:    data.billStatus ?? 'Pending',
          billBase64:    data.billBase64 ?? '',
          billFileName:  data.billFileName ?? '',
          billFileType:  data.billFileType ?? '',
          billFileSize:  Number(data.billFileSize ?? 0),
          recordedBy:    data.recordedBy ?? '',
          date:          data.date ?? '',
          assetStatus:   data.assetStatus ?? 'Active',
          dueAmount:     Number(data.dueAmount ?? 0),
          paidAmount:    Number(data.paidAmount ?? 0),
          damagedQty:    Number(data.damagedQty ?? 0),
          disposedQty:   Number(data.disposedQty ?? 0),
        });
      });
      eList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(eList);

      // Vendors
      const vSnap = await getDocs(collection(db, 'vendors'));
      const vList: Vendor[] = [];
      vSnap.forEach(d => {
        const data = d.data();
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

      // Transfer out
      const transferSnap = await getDocs(collection(db, 'fund_transfers'));
      let assetsTransferred = 0;
      transferSnap.forEach(d => {
        const data = d.data();
        if (data.fromFundKey === 'company_assets_fund') {
          assetsTransferred += Number(data.amount ?? 0);
        }
      });
      setTransferredOut(assetsTransferred);

      // Vendor Entries
      const veSnap = await getDocs(collection(db, 'vendor_entries'));
      const veList: VendorEntry[] = [];
      veSnap.forEach(d => {
        const data = d.data();
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
        });
      });
      veList.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
      setVendorEntries(veList);

      // Custom items (NEW)
      const ciSnap = await getDocs(collection(db, 'company_assets_custom_items'));
      const ciList: AssetItem[] = [];
      ciSnap.forEach(d => {
        const data = d.data();
        ciList.push({
          id:       d.id,
          name:     data.name ?? '',
          emoji:    data.emoji ?? '📦',
          hint:     data.hint ?? '',
          isCustom: true,
        });
      });
      setCustomItems(ciList);

    } catch (err) {
      console.error(err);
      setErrorMsg('Data load nahi hua');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ── COMPUTED ──
  const filteredCollectionsByBatch = selectedBatchId === 'All'
    ? collections
    : collections.filter(c => {
        const bId = (c as any).batchId;
        if (!bId) return selectedBatchId === activeBatch?.id;
        return bId === selectedBatchId;
      });

  const filteredExpensesByBatch = (selectedBatchId === 'All'
    ? expenses
    : expenses.filter(e => {
        const bId = (e as any).batchId;
        if (!bId) return selectedBatchId === activeBatch?.id;
        return bId === selectedBatchId;
      })).filter(e => !assetSearchText.trim() || e.itemName.toLowerCase().includes(assetSearchText.trim().toLowerCase()) || e.vendor.toLowerCase().includes(assetSearchText.trim().toLowerCase()));

  const totalCollection = filteredCollectionsByBatch.reduce((s, c) => s + c.amount, 0);
  const totalExpense    = filteredExpensesByBatch.reduce((s, e) => s + e.amount, 0);
  const totalActuallyPaid = filteredExpensesByBatch.reduce((s, e) => {
    if (e.vendorId) return s + (e.paidAmount ?? 0);
    return s + e.amount;
  }, 0);
  const fundBalance     = totalCollection - totalActuallyPaid - transferredOut;
  const totalPendingDue = filteredExpensesByBatch.reduce((s, e) => s + (e.dueAmount ?? 0), 0);

  const colTotal        = Number(colPerHead) * Number(colTraineeCount);
  const autoAmount      = Number(expQty) * Number(expUnitPrice);

  const totalAssets    = filteredExpensesByBatch.reduce((s, e) => s + e.quantity, 0);
  const damagedAssets  = filteredExpensesByBatch.reduce((s, e) => s + Number(e.damagedQty ?? 0), 0);
  const disposedAssets = filteredExpensesByBatch.reduce((s, e) => s + Number(e.disposedQty ?? 0), 0);
  const activeAssets   = totalAssets - damagedAssets - disposedAssets;

  const veTotal = veItems.reduce((s, i) => s + i.total, 0);

  // Vendor dues
  const assetVendorDues: VendorDueSummary[] = (() => {
    const dueMap: Record<string, VendorDueSummary> = {};

    vendorEntries.forEach(ve => {
      const data = ve as any;
      if (data.fundKey !== 'company_assets_fund') return;
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

    filteredExpensesByBatch.forEach(exp => {
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

  const totalAssetVendorDue = assetVendorDues.reduce((s, v) => s + v.totalDue, 0);

  // Item-wise totals (with stock breakdown)
  const itemTotals = allItems.map(item => {
    const itemExps   = filteredExpensesByBatch.filter(e => e.itemName === item.name);
    const total      = itemExps.reduce((s, e) => s + e.amount, 0);
    const totalQty   = itemExps.reduce((s, e) => s + e.quantity, 0);
    const damagedQty = itemExps.reduce((s, e) => s + Number(e.damagedQty ?? 0), 0);
    const disposedQty = itemExps.reduce((s, e) => s + Number(e.disposedQty ?? 0), 0);
    const activeQty  = totalQty - damagedQty - disposedQty;
    return { ...item, total, count: itemExps.length, totalQty, activeQty, damagedQty, disposedQty, expenses: itemExps };
  });

  // ─────────────────────────────────────────
  // VENDOR ENTRY MGMT
  // ─────────────────────────────────────────
  const addVeRow = () =>
    setVeItems(prev => [...prev, { itemName: '', quantity: 1, unit: 'pcs', unitPrice: 0, total: 0 }]);

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
  // SAVE COLLECTION
  // ─────────────────────────────────────────
  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!colPerHead || !colTraineeCount || Number(colTraineeCount) <= 0) {
      setErrorMsg('Per head amount aur trainee count daalo'); return;
    }
    const payErr = validatePaymentMode(colPaymentMode, colCheckNumber, colTransactionId);
    if (payErr) { setErrorMsg(payErr); return; }

    setColLoading(true);
    try {
      await addDoc(collection(db, 'company_assets_collections'), {
        amount:        colTotal,
        perHead:       Number(colPerHead),
        traineeCount:  Number(colTraineeCount),
        label:         colLabel || 'Company Assets Cutting',
        remarks:       colRemarks || `${colLabel}: ${colTraineeCount} × ₹${colPerHead}`,
        paymentMode:   colPaymentMode,
        checkNumber:   colPaymentMode === 'Check' ? colCheckNumber : '',
        transactionId: getPaymentRef(colPaymentMode, colCheckNumber, colTransactionId),
        recordedBy,
        date:          new Date().toISOString(),
        createdAt:     serverTimestamp(),
        batchId:       activeBatch?.id || '',
      });
      setSuccessMsg(`✓ Company Assets: ${formatCurrency(colTotal)} collected!`);
      setColPerHead(''); setColTraineeCount(''); setColRemarks('');
      setColCheckNumber(''); setColTransactionId('');
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
    if (!expItemName) { setErrorMsg('Asset item select karo'); return; }

    const finalAmount = expAmount ? Number(expAmount) : autoAmount;
    if (!finalAmount || finalAmount <= 0) { setErrorMsg('Amount daalo'); return; }

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
          billBase64    = result.data.billBase64;
          billFileName  = result.data.billFileName;
          billFileType  = result.data.billFileType;
          billFileSize  = result.data.billFileSize;
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

      const expenseRef = await addDoc(collection(db, 'company_assets_expenses'), {
        amount:        finalAmount,
        itemName:      expItemName,
        vendor:        vendorName,
        vendorId:      expVendorId,
        quantity:      Number(expQty) || 1,
        unitPrice:     Number(expUnitPrice) || finalAmount,
        remarks:       expRemarks,
        paymentMode:   expPayNow !== 'none' ? expPaymentMode : (expVendorId ? '' : expPaymentMode),
        checkNumber:   (expPayNow !== 'none' || !expVendorId) && expPaymentMode === 'Check' ? expCheckNumber : '',
        transactionId: (expPayNow !== 'none' || !expVendorId) ? getPaymentRef(expPaymentMode, expCheckNumber, expTransactionId) : '',
        billStatus:    billBase64 ? 'Received' : expBillStatus,
        billBase64, billFileName, billFileType, billFileSize,
        assetStatus:   'Active',
        paidAmount,
        dueAmount,
        recordedBy,
        date:          new Date().toISOString(),
        createdAt:     serverTimestamp(),
        batchId:       activeBatch?.id || '',
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
        const veRef = await addDoc(collection(db, 'vendor_entries'), {
          vendorId:      expVendorId,
          vendorName:    vendor.name,
          categoryKey:   vendor.categoryKey,
          categoryLabel: vendor.categoryLabel,
          items: [{
            itemName:  expItemName,
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
          remarks:         expRemarks || `Company Asset: ${expItemName}`,
          bills,
          fundKey:         'company_assets_fund',
          linkedExpenseId: expenseRef.id,
          createdBy:       recordedBy,
          createdAt:       serverTimestamp(),
          batchId:         activeBatch?.id || '',
        });
        linkedEntryId = veRef.id;

        await updateDoc(doc(db, 'company_assets_expenses', expenseRef.id), {
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
          fundKey:       'company_assets_fund',
          fundLabel:     'Company Assets Fund',
          paymentMode:   expPaymentMode,
          checkNumber:   expPaymentMode === 'Check' ? expCheckNumber : '',
          transactionId: getPaymentRef(expPaymentMode, expCheckNumber, expTransactionId),
          remarks:       expRemarks || `Asset purchase — ${expItemName}`,
          paidBy:        recordedBy,
          paidAt:        new Date().toISOString(),
          createdAt:     serverTimestamp(),
        });
      }

      setSuccessMsg(
        `✓ ${expItemName}: ${formatCurrency(finalAmount)} registered!` +
        (vendorName ? ` Vendor: ${vendorName}` : '') +
        (dueAmount > 0 ? ` · Due: ${formatCurrency(dueAmount)}` : ' · Fully Paid!')
      );

      setExpItemName(''); setExpAmount(''); setExpVendorId(''); setExpVendorName('');
      setExpQty('1'); setExpUnitPrice(''); setExpRemarks('');
      setExpCheckNumber(''); setExpTransactionId(''); setExpBillFile(null);
      setExpPayNow('none'); setExpPayAmount('');
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
        remarks:       veRemarks || `Company Assets — Vendor Purchase`,
        bills,
        fundKey:       'company_assets_fund',
        createdBy:     recordedBy,
        createdAt:     serverTimestamp(),
        batchId:       activeBatch?.id || '',
      });

      await addDoc(collection(db, 'company_assets_expenses'), {
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
        transactionId: vePayNow !== 'none' ? getPaymentRef(vePaymentMode, veCheckNumber, veTransactionId) : '',
        billStatus:    bills.length > 0 ? 'Received' : 'Pending',
        billBase64:    bills[0]?.base64 ?? '',
        billFileName:  bills[0]?.fileName ?? '',
        billFileType:  bills[0]?.fileType ?? '',
        billFileSize:  bills[0]?.fileSize ?? 0,
        assetStatus:   'Active',
        paidAmount,
        dueAmount,
        recordedBy,
        date:          new Date().toISOString(),
        createdAt:     serverTimestamp(),
        batchId:       activeBatch?.id || '',
      });

      if (paidAmount > 0) {
        await addDoc(collection(db, 'vendor_payments'), {
          vendorId:      veVendorId,
          vendorName:    vendor.name,
          entryId:       veRef.id,
          categoryKey:   vendor.categoryKey,
          categoryLabel: vendor.categoryLabel,
          paidAmount,
          fundKey:       'company_assets_fund',
          fundLabel:     'Company Assets Fund',
          paymentMode:   vePaymentMode,
          checkNumber:   vePaymentMode === 'Check' ? veCheckNumber : '',
          transactionId: getPaymentRef(vePaymentMode, veCheckNumber, veTransactionId),
          remarks:       veRemarks || `Vendor purchase payment`,
          paidBy:        recordedBy,
          paidAt:        new Date().toISOString(),
          createdAt:     serverTimestamp(),
        });
      }

      setSuccessMsg(`✓ ${vendor.name}: ${formatCurrency(veTotal)} entry saved!`);
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
        categoryKey:   'company_assets',
        categoryLabel: 'Company Assets',
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
  // SAVE CUSTOM ITEM (NEW)
  // ─────────────────────────────────────────
  const handleSaveCustomItem = async () => {
    if (!newItemName.trim()) { setErrorMsg('Item naam daalo'); return; }
    const exists = allItems.some(i => i.name.toLowerCase() === newItemName.trim().toLowerCase());
    if (exists) { setErrorMsg(`"${newItemName}" already exists`); return; }

    setItemLoading(true);
    try {
      await addDoc(collection(db, 'company_assets_custom_items'), {
        name:      newItemName.trim(),
        emoji:     newItemEmoji || '📦',
        hint:      newItemHint.trim() || 'Custom asset',
        isCustom:  true,
        createdAt: serverTimestamp(),
        createdBy: recordedBy,
      });
      setSuccessMsg(`✓ "${newItemName}" item add ho gaya!`);
      setNewItemName(''); setNewItemEmoji('📦'); setNewItemHint('');
      setShowItemForm(false);
      await fetchAllData();
    } catch {
      setErrorMsg('Item save nahi hua');
    } finally { setItemLoading(false); }
  };

  // ─────────────────────────────────────────
  // UPDATE ASSET STATUS
  // ─────────────────────────────────────────
  const updateAssetStatus = async (expenseId: string, newStatus: AssetExpense['assetStatus']) => {
    try {
      const exp = expenses.find(e => e.id === expenseId);
      if (!exp) return;

      if (newStatus === 'Active') {
        await updateDoc(doc(db, 'company_assets_expenses', expenseId), {
          assetStatus: 'Active',
          damagedQty: 0,
          disposedQty: 0,
        });
        setSuccessMsg(`✓ Asset "${exp.itemName}" set to Active for all ${exp.quantity} units!`);
        await fetchAllData();
        return;
      }

      const promptMsg = newStatus === 'Damaged'
        ? `Total Quantity: ${exp.quantity}. How many units are Damaged?`
        : `Total Quantity: ${exp.quantity}. How many units are Disposed?`;

      const inputVal = window.prompt(
        promptMsg,
        String(newStatus === 'Damaged' ? (exp.damagedQty || exp.quantity) : (exp.disposedQty || exp.quantity))
      );
      if (inputVal === null) return; // User cancelled

      const qty = parseInt(inputVal) || 0;
      if (qty < 0 || qty > exp.quantity) {
        setErrorMsg(`Quantity must be between 0 and ${exp.quantity}`);
        return;
      }

      const updates: any = {
        assetStatus: newStatus,
      };

      if (newStatus === 'Damaged') {
        updates.damagedQty = qty;
        const currentDisposed = Number(exp.disposedQty ?? 0);
        if (qty + currentDisposed > exp.quantity) {
          updates.disposedQty = exp.quantity - qty;
        } else {
          updates.disposedQty = currentDisposed;
        }
      } else if (newStatus === 'Disposed') {
        updates.disposedQty = qty;
        const currentDamaged = Number(exp.damagedQty ?? 0);
        if (qty + currentDamaged > exp.quantity) {
          updates.damagedQty = exp.quantity - qty;
        } else {
          updates.damagedQty = currentDamaged;
        }
      }

      const totalDamagedAndDisposed = (updates.damagedQty || 0) + (updates.disposedQty || 0);
      if (totalDamagedAndDisposed < exp.quantity) {
        updates.assetStatus = 'Active';
      }

      await updateDoc(doc(db, 'company_assets_expenses', expenseId), updates);
      setSuccessMsg(`✓ Quantities updated successfully! Active: ${exp.quantity - totalDamagedAndDisposed}, Damaged: ${updates.damagedQty || 0}, Disposed: ${updates.disposedQty || 0}`);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Update nahi hua. Please retry karein.');
    }
  };

  // ─────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const colMap: Record<string, string> = {
        col:  'company_assets_collections',
        exp:  'company_assets_expenses',
        item: 'company_assets_custom_items',
      };
      await deleteDoc(doc(db, colMap[deleteConfirm.type], deleteConfirm.id));
      setSuccessMsg(`${deleteConfirm.label} delete ho gaya`);
      setDeleteConfirm(null);
      await fetchAllData();
    } catch { setErrorMsg('Delete nahi hua'); }
  };

  const filteredAssets = filterAssetStatus === 'All'
    ? filteredExpensesByBatch
    : filteredExpensesByBatch.filter(e => e.assetStatus === filterAssetStatus);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-green-600 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-green-700 rounded-xl flex items-center justify-center text-xl">🏛️</div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
              Company Assets Fund
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Asset Cutting · Property Purchase · Stock Register · Vendor Billing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModuleReportButton module="assets" stats={[{ label: 'Valuation', value: formatCurrency(totalExpense) }, { label: 'Purchased Units', value: totalAssets }, { label: 'Active Units', value: activeAssets }, { label: 'Damaged Units', value: damagedAssets }, { label: 'Disposed Units', value: disposedAssets }, { label: 'Vendor Due', value: formatCurrency(totalPendingDue) }]} rows={filteredExpensesByBatch.map(e => ({ item: e.itemName, quantity: e.quantity, unitPrice: e.unitPrice, amount: e.amount, status: `Active ${Math.max(0, e.quantity - Number(e.damagedQty || 0) - Number(e.disposedQty || 0))} · Damaged ${Number(e.damagedQty || 0)} · Disposed ${Number(e.disposedQty || 0)}`, detail: e.vendor || e.remarks }))} />
          <button onClick={fetchAllData} disabled={dataLoading}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
            <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* BATCH SELECTOR CONTROL BAR */}
      <div className="bg-white border border-slate-300 shadow-sm p-3 rounded flex items-center gap-3 flex-wrap">
        <Layers size={14} className="text-slate-400" />
        <span className="text-xs font-black uppercase text-slate-700">Select Batch Filter:</span>
        <select
          value={selectedBatchId}
          onChange={e => setSelectedBatchId(e.target.value)}
          className="text-xs font-bold border border-slate-300 px-3 py-1.5 focus:outline-none focus:border-green-600 bg-white rounded min-w-[200px]"
        >
          <option value="All">All Batches (Showing Combined Data)</option>
          {allBatches.map((b: any) => (
            <option key={b.id} value={b.id}>
              {b.batchNumber} — {b.batchName}
            </option>
          ))}
        </select>
        {activeBatch && selectedBatchId === activeBatch.id && (
          <span className="text-[10px] font-black text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
            Active Batch
          </span>
        )}
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

      {/* BALANCE CARDS */}
      <div className={`grid grid-cols-2 ${transferredOut > 0 ? 'md:grid-cols-7' : 'md:grid-cols-6'} gap-3`}>

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

        <div className={`border-l-4 rounded p-4 shadow-sm ${fundBalance >= 0
          ? 'bg-green-50 border border-green-200 border-l-green-600'
          : 'bg-red-100 border border-red-300 border-l-red-600'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Cash in Hand</p>
            <Wallet size={14} className="text-green-600" />
          </div>
          <p className={`text-xl font-black ${fundBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {fundBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(fundBalance))}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Available to use</p>
        </div>

        <div className={`border-l-4 rounded p-4 shadow-sm ${totalPendingDue > 0
          ? 'bg-amber-50 border border-amber-200 border-l-amber-500'
          : 'bg-green-50 border border-green-200 border-l-green-500'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Pending Dues</p>
            <Building2 size={14} className={totalPendingDue > 0 ? 'text-amber-400' : 'text-green-400'} />
          </div>
          <p className={`text-xl font-black ${totalPendingDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {formatCurrency(totalPendingDue)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Vendor ko dena hai</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-slate-500 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Stock Register</p>
            <Archive size={14} className="text-slate-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-center">
              <p className="text-lg font-black text-green-600">{activeAssets}</p>
              <p className="text-[9px] text-slate-400">Active</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <p className="text-lg font-black text-red-500">{damagedAssets}</p>
              <p className="text-[9px] text-slate-400">Damaged</p>
            </div>
          </div>
        </div>
      </div>

      {/* INFO BANNER */}
      <div className="bg-green-50 border border-green-200 rounded px-4 py-3 flex items-start gap-2">
        <Info size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-green-800 space-y-1">
          <p><strong>Yeh fund kya hai:</strong> Company ki permanent property — Tent, Chair, Cooler, Generator etc.</p>
          <p><strong>Stock Counter:</strong> Har item ke saath active/damaged/disposed count automatic dikhega.</p>
          <p><strong>Custom Item:</strong> [+ Add Item] se naya asset add karo agar list me nahi hai.</p>
          <p><strong>Cash in Hand</strong> = Collection − Paid − Transferred to General Fund</p>
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
          <ArrowDownToLine size={13} /> Asset Cutting Collect
        </button>

        <button
          onClick={() => { closeAllForms(); setShowExpenseForm(true); }}
          className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-red-700 rounded">
          <ArrowUpFromLine size={13} /> Add Asset Purchase
        </button>

        <button
          onClick={() => { closeAllForms(); setShowVendorEntryForm(true); }}
          className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-amber-700 rounded">
          <ShoppingCart size={13} /> Vendor Purchase Entry
        </button>

        {/* NEW: Add Custom Item */}
        <button
          onClick={() => { closeAllForms(); setShowItemForm(true); }}
          className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-purple-700 rounded">
          <Plus size={13} /> Add New Asset Item
        </button>
      </div>

      {/* COLLECTION FORM */}
      {showCollectionForm && (
        <form onSubmit={handleSaveCollection}
          className="bg-green-50 border border-green-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-green-800 flex items-center gap-2">
              <Calculator size={14} /> Company Assets Per Head Cutting
            </h3>
            <button type="button" onClick={() => setShowCollectionForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="bg-white border border-green-200 rounded px-3 py-2 flex items-center gap-2">
            <Shield size={12} className="text-green-600 flex-shrink-0" />
            <p className="text-[10px] text-green-700">
              <strong>Current Trainees:</strong> {traineeCount} · Company assets ke liye alag fund.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Per Head (₹) *</label>
              <input type="number" min={1} value={colPerHead}
                onChange={e => setColPerHead(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none focus:border-green-600"
                placeholder="e.g. 200" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Trainees *</label>
              <input type="number" min={1} value={colTraineeCount}
                onChange={e => setColTraineeCount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Label</label>
              <input type="text" value={colLabel} onChange={e => setColLabel(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
              <input type="text" value={colRemarks} onChange={e => setColRemarks(e.target.value)}
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
            disabled={colLoading || !colPerHead || !colTraineeCount}
            className="bg-green-700 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-green-800 disabled:opacity-40 flex items-center gap-2 rounded">
            {colLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Save · {formatCurrency(colTotal)} via {colPaymentMode}
          </button>
        </form>
      )}

      {/* EXPENSE FORM */}
      {showExpenseForm && (
        <form onSubmit={handleSaveExpense}
          className="bg-red-50 border border-red-300 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-red-800 flex items-center gap-2">
              <Landmark size={14} /> Company Asset Purchase
            </h3>
            <button type="button" onClick={() => setShowExpenseForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          {/* Asset Selection */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
              Asset * (Kya kharida?)
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
                  <p className="text-[7px] text-slate-400 leading-tight">{item.hint}</p>
                  {item.isCustom && (
                    <span className="absolute top-0.5 right-0.5 text-[7px] font-bold text-purple-600 bg-purple-50 px-1 rounded">
                      ★
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Selection */}
          {expItemName && (
            <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Building2 size={10} /> Vendor (Optional — billing ke liye)
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
                const vDue = vendorEntries
                  .filter(ve => ve.vendorId === v.id)
                  .reduce((s, ve) => s + ve.dueAmount, 0);
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 size={12} className="text-amber-600" />
                      <div>
                        <p className="text-[10px] font-black text-amber-800">{v.name}</p>
                        <p className="text-[9px] text-amber-600">{v.categoryLabel}</p>
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

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Qty *</label>
              <input type="number" min={1} value={expQty}
                onChange={e => setExpQty(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none"
                placeholder="1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Unit Price (₹)</label>
              <input type="number" min={0} value={expUnitPrice}
                onChange={e => setExpUnitPrice(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none"
                placeholder="e.g. 5000" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Total (₹) *
                {autoAmount > 0 && !expAmount && (
                  <span className="text-green-600 ml-1">= ₹{autoAmount.toLocaleString('en-IN')}</span>
                )}
              </label>
              <input type="number" min={1} value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm font-black rounded focus:outline-none focus:border-red-500"
                placeholder={autoAmount > 0 ? String(autoAmount) : '0'} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vendor / Supplier</label>
              <input type="text"
                value={expVendorId ? (vendors.find(v => v.id === expVendorId)?.name ?? '') : expVendorName}
                onChange={e => { if (!expVendorId) setExpVendorName(e.target.value); }}
                disabled={!!expVendorId}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none disabled:bg-slate-50"
                placeholder="Naam (manual)" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bill Status</label>
              <select value={expBillStatus}
                onChange={e => setExpBillStatus(e.target.value as AssetExpense['billStatus'])}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none bg-white">
                <option value="Received">Bill Received</option>
                <option value="Pending">Bill Pending</option>
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

          {expVendorId && (Number(expAmount) > 0 || autoAmount > 0) && (
            <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Payment Status</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'none',    label: '⏳ Abhi Nahi (Due)', hint: 'Vendor Payment se baad mein' },
                  { key: 'partial', label: '💰 Partial Pay',     hint: 'Kuch abhi do' },
                  { key: 'full',    label: '✅ Full Pay',         hint: 'Poora de do' },
                ] as const).map(opt => (
                  <button key={opt.key} type="button"
                    onClick={() => {
                      setExpPayNow(opt.key);
                      const amt = expAmount ? expAmount : String(autoAmount);
                      if (opt.key === 'full') setExpPayAmount(amt);
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
                <input type="number" min={1} value={expPayAmount}
                  onChange={e => setExpPayAmount(e.target.value)}
                  className="w-full border border-amber-300 px-3 py-2 text-sm font-black rounded focus:outline-none"
                  placeholder="Pay Amount *" />
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded p-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Bill Upload (Optional)
            </label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => setExpBillFile(e.target.files?.[0] ?? null)}
              className="text-xs" />
            {expBillFile && (
              <span className="text-[10px] text-green-600 font-bold ml-2">✓ {expBillFile.name}</span>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
            <input type="text" value={expRemarks} onChange={e => setExpRemarks(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
              placeholder="Note..." />
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
            {expLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Register Asset{expVendorId ? ' + Vendor Entry' : ''}
          </button>
        </form>
      )}

      {/* CUSTOM ITEM FORM (NEW) */}
      {showItemForm && (
        <div className="bg-purple-50 border border-purple-300 rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-purple-800 flex items-center gap-2">
              <Tag size={14} /> Add New Asset Item
            </h3>
            <button onClick={() => setShowItemForm(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="bg-white border border-purple-200 rounded px-3 py-2">
            <p className="text-[10px] text-purple-700">
              <strong>Custom asset add karo</strong> agar tumhare paas koi naya item hai jo upar list me nahi hai (jaise: Printer, Refrigerator, Iron Press, etc.)
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Item Name *</label>
              <input type="text" value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-xs font-bold rounded focus:outline-none focus:border-purple-600"
                placeholder="e.g. Printer" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Emoji</label>
              <input type="text" value={newItemEmoji}
                onChange={e => setNewItemEmoji(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-sm rounded focus:outline-none"
                placeholder="📦" maxLength={2} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hint / Description</label>
              <input type="text" value={newItemHint}
                onChange={e => setNewItemHint(e.target.value)}
                className="w-full border border-purple-300 px-3 py-2 text-xs rounded focus:outline-none"
                placeholder="Office printer" />
            </div>
          </div>
          <button onClick={handleSaveCustomItem}
            disabled={itemLoading || !newItemName.trim()}
            className="bg-purple-600 text-white px-4 py-2 text-xs font-black uppercase rounded hover:bg-purple-700 disabled:opacity-40 flex items-center gap-2">
            {itemLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Item
          </button>
        </div>
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
                        {['pcs','kg','g','L','ml','doz','box','pkt','bag','set','roll'].map(u => <option key={u}>{u}</option>)}
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
                          <button type="button" onClick={() => removeVeRow(idx)} className="text-red-400 hover:text-red-600 p-1">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 bg-amber-100 border border-amber-300 rounded p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700">{veItems.filter(i => i.itemName).length} items</span>
                  <span className="text-xl font-black text-amber-800">Total: {formatCurrency(veTotal)}</span>
                </div>
              </div>

              {veTotal > 0 && (
                <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Payment Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['none','partial','full'] as const).map(opt => (
                      <button key={opt} type="button"
                        onClick={() => {
                          setVePayNow(opt);
                          if (opt === 'full') setVePayAmount(String(veTotal));
                          if (opt === 'none') setVePayAmount('');
                        }}
                        className={`p-2 rounded border-2 text-[10px] font-bold uppercase ${
                          vePayNow === opt ? 'border-amber-500 bg-amber-50' : 'border-slate-200'
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
                {veBillFile && <span className="text-[10px] text-green-600 font-bold ml-2">✓ {veBillFile.name}</span>}
              </div>

              <input type="text" value={veRemarks} onChange={e => setVeRemarks(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                placeholder="Remarks..." />

              <button type="button" onClick={handleSaveVendorEntry}
                disabled={veLoading || !veVendorId || veTotal <= 0}
                className="bg-amber-600 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-amber-700 disabled:opacity-40 flex items-center gap-2 rounded w-full justify-center">
                {veLoading ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
                Save Entry — {formatCurrency(veTotal)}
              </button>
            </>
          )}
        </div>
      )}

      {/* TABS */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {([
            { key: 'overview',    label: 'Asset Overview',  icon: <Landmark size={13} /> },
            { key: 'collections', label: 'Collections',     icon: <ArrowDownToLine size={13} />, count: filteredCollectionsByBatch.length },
            { key: 'expenses',    label: 'Purchases',       icon: <ArrowUpFromLine size={13} />, count: filteredExpensesByBatch.length },
            { key: 'assets',      label: 'Stock Register',  icon: <Boxes size={13} />,           count: totalAssets,      countCls: 'bg-green-100 text-green-700' },
            { key: 'vendor_dues', label: 'Vendor Dues',     icon: <Building2 size={13} />,       count: assetVendorDues.filter(v => v.totalDue > 0).length, countCls: totalAssetVendorDue > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700' },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-black uppercase border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-green-600 text-green-700'
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

      {/* TAB: OVERVIEW — WITH STOCK COUNTER */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded px-4 py-2.5 flex items-center gap-2">
            <Boxes size={13} className="text-green-600" />
            <p className="text-[10px] text-green-700 font-semibold">
              <strong>Stock Counter:</strong> Har item ka total quantity + active/damaged breakdown.
              <strong> [+ Add]</strong> se purchase karo.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {itemTotals.map(item => (
              <div key={item.name}
                className={`bg-white border-2 rounded-lg p-3 shadow-sm hover:shadow-md transition-all relative ${
                  item.totalQty > 0 ? 'border-green-200' : 'border-slate-200'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{item.emoji}</span>
                    {item.totalQty > 0 && (
                      <span className="text-2xl font-black text-slate-800">{item.totalQty}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
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
                    {item.isCustom && item.id && (
                      <button
                        onClick={() => setDeleteConfirm({
                          type: 'item', id: item.id!,
                          label: `Custom item "${item.name}"`
                        })}
                        className="text-[9px] font-bold text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={10} className="mx-auto" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs font-black text-slate-800">{item.name}</p>
                <p className="text-[9px] text-slate-400 leading-tight">{item.hint}</p>
                {item.isCustom && (
                  <span className="absolute top-0.5 right-0.5 text-[7px] font-bold text-purple-600 bg-purple-50 px-1 rounded">
                    ★ Custom
                  </span>
                )}

                {/* STOCK COUNTER */}
                {item.totalQty > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1 bg-slate-50 rounded p-1.5">
                    <div className="text-center">
                      <p className="text-[8px] text-green-500 font-bold">Active</p>
                      <p className="text-sm font-black text-green-700">{item.activeQty}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-red-500 font-bold">Damaged</p>
                      <p className="text-sm font-black text-red-600">{item.damagedQty}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-slate-400 font-bold">Disposed</p>
                      <p className="text-sm font-black text-slate-500">{item.disposedQty}</p>
                    </div>
                  </div>
                )}

                <p className="text-base font-black text-red-600 mt-2">
                  {item.total > 0 ? formatCurrency(item.total) : '₹0'}
                </p>
                <p className="text-[9px] text-slate-400">{item.count} purchases</p>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="bg-green-100 border-2 border-green-300 rounded p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-green-700 uppercase">Total Asset Investment</p>
              <p className="text-[10px] text-green-600 mt-0.5">
                {expenses.length} purchases · <strong>{totalAssets} total items</strong>
                {' '}({activeAssets} active, {damagedAssets} damaged, {disposedAssets} disposed)
              </p>
            </div>
            <p className="text-2xl font-black text-green-800">{formatCurrency(totalExpense)}</p>
          </div>

          {/* Per Head Split */}
          {traineeCount > 0 && totalExpense > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded p-4">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                <Calculator size={11} /> Per Head Asset Cost
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Total Asset Cost</p>
                  <p className="text-lg font-black text-red-600">{formatCurrency(totalExpense)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">÷ Trainees</p>
                  <p className="text-lg font-black text-slate-600">÷ {traineeCount}</p>
                </div>
                <div className="bg-green-100 rounded-lg p-2">
                  <p className="text-[9px] text-green-500 uppercase font-bold">Per Head</p>
                  <p className="text-xl font-black text-green-800">
                    ₹{Math.ceil(totalExpense / traineeCount).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: COLLECTIONS */}
      {activeTab === 'collections' && (
        <div className="space-y-1">
          {filteredCollectionsByBatch.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Receipt size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi collection nahi</p>
            </div>
          ) : (
            filteredCollectionsByBatch.map(c => (
              <div key={c.id} className="bg-white border p-3 rounded flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-800">{c.label}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(c.date)} · {c.traineeCount} × ₹{c.perHead}</p>
                </div>
                <div className="flex items-center gap-3">
                  <PaymentModeBadge mode={c.paymentMode} checkNumber={c.checkNumber} transactionId={c.transactionId} />
                  <span className="text-sm font-black text-green-700">+{formatCurrency(c.amount)}</span>
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

      {/* TAB: PURCHASES */}
      {activeTab === 'expenses' && (
        <div className="space-y-1">
          {filteredExpensesByBatch.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Archive size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi purchase nahi</p>
            </div>
          ) : (
            filteredExpensesByBatch.map(exp => {
              const bsc  = BILL_STATUS_CONFIG[exp.billStatus] ?? BILL_STATUS_CONFIG['Pending'];
              const asc  = ASSET_STATUS_CONFIG[exp.assetStatus] ?? ASSET_STATUS_CONFIG['Active'];
              const item = allItems.find(a => a.name === exp.itemName);
              return (
                <div key={exp.id} className="bg-white border p-3 rounded flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-slate-800">{item?.emoji ?? '🏗️'} {exp.itemName}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${asc.cls}`}>{asc.label}</span>
                      {exp.quantity > 1 && <span className="text-[9px] font-bold bg-slate-100 px-1.5 py-0.5 rounded">×{exp.quantity}</span>}
                      {exp.vendorId && <Building2 size={10} className="text-blue-500" />}
                      {exp.vendor && <span className="text-[10px] text-slate-600">{exp.vendor}</span>}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${bsc.cls}`}>{exp.billStatus}</span>
                      {exp.dueAmount > 0 && (
                        <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Due: {formatCurrency(exp.dueAmount)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(exp.date)} · {exp.quantity} × ₹{exp.unitPrice}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-black text-red-600">−{formatCurrency(exp.amount)}</span>
                    <button
                      onClick={() => setDeleteConfirm({
                        type: 'exp', id: exp.id,
                        label: `${exp.itemName} - ${formatCurrency(exp.amount)}`
                      })}
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

      {/* TAB: STOCK REGISTER */}
      {activeTab === 'assets' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded p-3">
            <Filter size={12} className="text-slate-400" />
            {(['All', 'Active', 'Damaged', 'Disposed'] as const).map(s => {
              const cnt = s === 'All' ? filteredExpensesByBatch.length : filteredExpensesByBatch.filter(e => e.assetStatus === s).length;
              return (
                <button key={s} onClick={() => setFilterAssetStatus(s)}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${
                    filterAssetStatus === s
                      ? s === 'Active'   ? 'bg-green-600 text-white border-green-600'
                      : s === 'Damaged'  ? 'bg-red-600 text-white border-red-600'
                      : s === 'Disposed' ? 'bg-slate-600 text-white border-slate-600'
                      :                    'bg-green-700 text-white border-green-700'
                      : 'border-slate-300 text-slate-500'
                  }`}>{s} ({cnt})</button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
              <p className="text-[10px] font-bold text-green-600 uppercase">Active</p>
              <p className="text-2xl font-black text-green-700">{activeAssets}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
              <p className="text-[10px] font-bold text-red-600 uppercase">Damaged</p>
              <p className="text-2xl font-black text-red-600">{damagedAssets}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Value</p>
              <p className="text-2xl font-black text-slate-700">{formatCurrency(totalExpense)}</p>
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Archive size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi asset nahi</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map(exp => {
                const item = allItems.find(a => a.name === exp.itemName);
                const asc  = ASSET_STATUS_CONFIG[exp.assetStatus] ?? ASSET_STATUS_CONFIG['Active'];
                return (
                  <div key={exp.id}
                    className={`bg-white border-2 rounded p-3 flex items-center gap-3 ${
                      exp.assetStatus === 'Active'   ? 'border-green-200'
                      : exp.assetStatus === 'Damaged'  ? 'border-red-200'
                      : 'border-slate-200'
                    }`}>
                    <span className="text-2xl">{item?.emoji ?? '🏗️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-800">{exp.itemName}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${asc.cls}`}>{asc.label}</span>
                        {exp.quantity > 1 && (
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Total: {exp.quantity}</span>
                        )}
                        {(Number(exp.damagedQty ?? 0) > 0 || Number(exp.disposedQty ?? 0) > 0) && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                              Active: {exp.quantity - Number(exp.damagedQty ?? 0) - Number(exp.disposedQty ?? 0)}
                            </span>
                            {Number(exp.damagedQty ?? 0) > 0 && (
                              <span className="text-[9px] font-black bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200">
                                Damaged: {exp.damagedQty}
                              </span>
                            )}
                            {Number(exp.disposedQty ?? 0) > 0 && (
                              <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                Disposed: {exp.disposedQty}
                              </span>
                            )}
                          </div>
                        )}
                        {exp.vendor && (
                          <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-200 flex items-center gap-0.5">
                            <Building2 size={7} /> {exp.vendor}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                        <span>{formatDate(exp.date)}</span>
                        <span className="font-black text-red-600">{formatCurrency(exp.amount)}</span>
                      </div>
                    </div>
                    <select value={exp.assetStatus}
                      onChange={e => updateAssetStatus(exp.id, e.target.value as AssetExpense['assetStatus'])}
                      className={`text-[9px] font-bold border px-2 py-1.5 focus:outline-none rounded ${
                        exp.assetStatus === 'Active'  ? 'border-green-300 text-green-700'
                        : exp.assetStatus === 'Damaged' ? 'border-red-300 text-red-700'
                        : 'border-slate-300 text-slate-600'
                      }`}>
                      <option value="Active">Active</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Disposed">Disposed</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: VENDOR DUES */}
      {activeTab === 'vendor_dues' && (
        <div className="space-y-2">
          {assetVendorDues.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold">Koi vendor due nahi</p>
            </div>
          ) : (
            assetVendorDues.map(vd => (
              <div key={vd.vendorId} className="bg-white border-2 border-red-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-800">{vd.vendorName}</p>
                  <p className="text-[10px] text-slate-500">{vd.categoryLabel} · {vd.entries} entries</p>
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

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border shadow-2xl max-w-sm w-full rounded p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-slate-800">Delete karna hai?</p>
                <p className="text-xs text-slate-500 mt-1">"{deleteConfirm.label}" — wapas nahi aayega</p>
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

      {previewBill && (
        <BillPreviewModal bill={previewBill} onClose={() => setPreviewBill(null)} />
      )}
    </div>
  );
};

export default CompanyAssetsFundScreen;