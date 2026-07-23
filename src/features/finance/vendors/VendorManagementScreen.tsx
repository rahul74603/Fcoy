// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\vendors\VendorManagementScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Loader2, CheckCircle2, AlertTriangle,
  RefreshCw, Trash2, Edit2, Check, Eye, Building2,
  ShoppingCart,
  Phone, Tag, Search,
  Clock, FileText,
  Upload
} from 'lucide-react';
import {
  collection, addDoc, getDocs, doc, updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  formatCurrency, formatDateTime,
  processBillFile, FIXED_MESS_CATEGORIES,
  type MessCategory
} from '../shared/utils';
import type { Vendor, VendorItem, VendorEntry, BillAttachment } from './types';
import BillPreviewModal from '../shared/BillPreviewModal';
export type { Vendor, VendorItem, VendorEntry, BillAttachment } from './types';




// ─────────────────────────────────────────────
// VENDOR CARD
// ─────────────────────────────────────────────
const VendorCard: React.FC<{
  vendor:   Vendor;
  entries:  VendorEntry[];
  onEdit:   (v: Vendor) => void;
  onDelete: (v: Vendor) => void;
  onAddEntry: (v: Vendor) => void;
  onViewHistory: (v: Vendor) => void;
}> = ({ vendor, entries, onEdit, onDelete, onAddEntry, onViewHistory }) => {
  const cat = FIXED_MESS_CATEGORIES.find(c => c.key === vendor.categoryKey);

  const vendorEntries = entries.filter(e => e.vendorId === vendor.id);
  const totalAmount   = vendorEntries.reduce((s, e) => s + e.totalAmount, 0);
  const totalPaid     = vendorEntries.reduce((s, e) => s + e.paidAmount,  0);
  const totalDue      = vendorEntries.reduce((s, e) => s + e.dueAmount,   0);

  return (
    <div className={`bg-white border-2 rounded-xl shadow-sm hover:shadow-md transition-all ${
      totalDue > 0 ? 'border-red-200' : 'border-green-200'
    }`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
            {cat?.emoji ?? '🏪'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">{vendor.name}</p>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <Tag size={9} /> {vendor.categoryLabel}
            </p>
            {vendor.phone && (
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Phone size={9} /> {vendor.phone}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {totalDue > 0 ? (
            <span className="text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
              ⚠ DUE: {formatCurrency(totalDue)}
            </span>
          ) : vendorEntries.length > 0 ? (
            <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
              ✓ All Paid
            </span>
          ) : (
            <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              No Entries
            </span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {vendorEntries.length > 0 && (
        <div className="px-4 pb-2 grid grid-cols-3 gap-2">
          <div className="text-center bg-slate-50 rounded p-1.5">
            <p className="text-[9px] text-slate-400 font-bold uppercase">Total</p>
            <p className="text-xs font-black text-slate-700">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="text-center bg-green-50 rounded p-1.5">
            <p className="text-[9px] text-green-500 font-bold uppercase">Paid</p>
            <p className="text-xs font-black text-green-700">{formatCurrency(totalPaid)}</p>
          </div>
          <div className={`text-center rounded p-1.5 ${totalDue > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className="text-[9px] font-bold uppercase text-slate-400">Due</p>
            <p className={`text-xs font-black ${totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(totalDue)}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap border-t border-slate-100 pt-2">
        <button onClick={() => onAddEntry(vendor)}
          className="flex items-center gap-1 text-[10px] font-black bg-green-700 text-white px-3 py-1.5 rounded hover:bg-green-800">
          <Plus size={11} /> Add Entry
        </button>
        <button onClick={() => onViewHistory(vendor)}
          className="flex items-center gap-1 text-[10px] font-bold border border-slate-300 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-50">
          <Clock size={11} /> History ({vendorEntries.length})
        </button>
        <button onClick={() => onEdit(vendor)}
          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 border border-blue-200 px-2 py-1.5 rounded hover:bg-blue-50">
          <Edit2 size={10} /> Edit
        </button>
        <button onClick={() => onDelete(vendor)}
          className="flex items-center gap-1 text-[10px] font-bold text-red-500 border border-red-200 px-2 py-1.5 rounded hover:bg-red-50 ml-auto">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════
export const VendorManagementScreen: React.FC = () => {
  const { user } = useAuth();
  const createdBy = user?.email ?? 'Quarter Master';

  // ── DATA ──
  const [vendors,     setVendors]     = useState<Vendor[]>([]);
  const [entries,     setEntries]     = useState<VendorEntry[]>([]);
  const [customCats,  setCustomCats]  = useState<MessCategory[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── UI ──
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [searchText, setSearchText] = useState('');
  const [filterCat,  setFilterCat]  = useState('All');

  // ── MODALS ──
  const [showAddVendor,   setShowAddVendor]   = useState(false);
  const [editingVendor,   setEditingVendor]   = useState<Vendor | null>(null);
  const [deleteVendor,    setDeleteVendor]    = useState<Vendor | null>(null);
  const [addEntryVendor,  setAddEntryVendor]  = useState<Vendor | null>(null);
  const [historyVendor,   setHistoryVendor]   = useState<Vendor | null>(null);
  const [previewBill,     setPreviewBill]     = useState<BillAttachment | null>(null);

  // ── VENDOR FORM ──
  const [vName,    setVName]    = useState('');
  const [vPhone,   setVPhone]   = useState('');
  const [vAddress, setVAddress] = useState('');
  const [vCatKey,  setVCatKey]  = useState('ration_store');
  const [vNotes,   setVNotes]   = useState('');
  const [vLoading, setVLoading] = useState(false);

  // ── ENTRY FORM ──
  const [entryItems,   setEntryItems]   = useState<VendorItem[]>([
    { itemName: '', quantity: 1, unit: 'kg', unitPrice: 0, total: 0 }
  ]);
  const [entryRemarks, setEntryRemarks] = useState('');
  const [entryLoading, setEntryLoading] = useState(false);

  // ── BILL UPLOAD ──
  const [, setBillFiles] = useState<File[]>([]);
  const [billUploading, setBillUploading] = useState(false);

  // ─────────────────────────────────────────
  // ALL CATEGORIES (fixed + custom)
  // ─────────────────────────────────────────
  const allCategories: MessCategory[] = [
    ...FIXED_MESS_CATEGORIES,
    ...customCats,
  ];

  // ── FETCH ──
  const fetchAllData = useCallback(async () => {
    setDataLoading(true);
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
          categoryKey:   data.categoryKey   ?? 'other',
          categoryLabel: data.categoryLabel ?? 'Other',
          isActive:      data.isActive      ?? true,
          createdAt:     data.createdAt     ?? '',
          notes:         data.notes         ?? '',
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
          totalAmount:   Number(data.totalAmount ?? 0),
          paidAmount:    Number(data.paidAmount  ?? 0),
          dueAmount:     Number(data.dueAmount   ?? 0),
          status:        data.status        ?? 'Pending',
          entryDate:     data.entryDate     ?? '',
          remarks:       data.remarks       ?? '',
          bills:         data.bills         ?? [],
          createdBy:     data.createdBy     ?? '',
        });
      });
      eList.sort((a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
      );
      setEntries(eList);

      // Custom categories
      const ccSnap = await getDocs(collection(db, 'mess_custom_categories'));
      const ccList: MessCategory[] = [];
      ccSnap.forEach(d => {
        const data = d.data();
        ccList.push({
          key:     data.key     ?? d.id,
          label:   data.label   ?? '',
          emoji:   data.emoji   ?? '📦',
          hint:    data.hint    ?? '',
          isFixed: false,
        });
      });
      setCustomCats(ccList);

    } catch (err) {
      console.error(err);
      setErrorMsg('Data load nahi hua. Refresh karo.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ── COMPUTED ──
  const allVendorsDue = vendors.reduce((s, v) => {
    const due = entries.filter(e => e.vendorId === v.id)
                       .reduce((ds, e) => ds + e.dueAmount, 0);
    return s + due;
  }, 0);

  const totalVendorAmount = entries.reduce((s, e) => s + e.totalAmount, 0);
  const totalVendorPaid   = entries.reduce((s, e) => s + e.paidAmount,  0);

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    const matchCat  = filterCat === 'All' || v.categoryKey === filterCat;
    const matchSrch = !searchText || v.name.toLowerCase().includes(searchText.toLowerCase());
    return matchCat && matchSrch;
  });

  // ─────────────────────────────────────────
  // VENDOR CRUD
  // ─────────────────────────────────────────
  const resetVendorForm = () => {
    setVName(''); setVPhone(''); setVAddress('');
    setVCatKey('ration_store'); setVNotes('');
    setEditingVendor(null);
  };

  const handleSaveVendor = async () => {
    if (!vName.trim()) { setErrorMsg('Vendor naam daalo'); return; }
    setVLoading(true);
    try {
      const catInfo = allCategories.find(c => c.key === vCatKey);
      const payload = {
        name:          vName.trim(),
        phone:         vPhone.trim(),
        address:       vAddress.trim(),
        categoryKey:   vCatKey,
        categoryLabel: catInfo?.label ?? vCatKey,
        notes:         vNotes.trim(),
        isActive:      true,
      };

      if (editingVendor) {
        await updateDoc(doc(db, 'vendors', editingVendor.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        setSuccessMsg(`${vName} updated!`);
      } else {
        await addDoc(collection(db, 'vendors'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy,
        });
        setSuccessMsg(`${vName} add ho gaya!`);
      }
      resetVendorForm();
      setShowAddVendor(false);
      await fetchAllData();
    } catch { setErrorMsg('Save nahi hua'); }
    finally   { setVLoading(false); }
  };

  const handleDeleteVendor = async () => {
    if (!deleteVendor) return;
    try {
      await updateDoc(doc(db, 'vendors', deleteVendor.id), {
        isActive: false, deletedAt: serverTimestamp(),
      });
      setSuccessMsg(`${deleteVendor.name} remove ho gaya`);
      setDeleteVendor(null);
      await fetchAllData();
    } catch { setErrorMsg('Delete nahi hua'); }
  };

  // ─────────────────────────────────────────
  // ENTRY ITEMS MANAGEMENT
  // ─────────────────────────────────────────
  const addEntryRow = () =>
    setEntryItems(prev => [
      ...prev,
      { itemName: '', quantity: 1, unit: 'kg', unitPrice: 0, total: 0 },
    ]);

  const removeEntryRow = (idx: number) =>
    setEntryItems(prev => prev.filter((_, i) => i !== idx));

  const updateEntryRow = (
    idx: number,
    field: keyof VendorItem,
    value: string | number
  ) => {
    setEntryItems(prev => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      // Recalc total
      const row = updated[idx];
      row.total = row.quantity * row.unitPrice;
      return updated;
    });
  };

  const entryTotal = entryItems.reduce((s, i) => s + i.total, 0);

  // ─────────────────────────────────────────
  // SAVE ENTRY
  // ─────────────────────────────────────────
  const handleSaveEntry = async () => {
    if (!addEntryVendor) return;
    const validItems = entryItems.filter(
      i => i.itemName.trim() && i.quantity > 0
    );
    if (validItems.length === 0) {
      setErrorMsg('Kam se kam ek item daalo');
      return;
    }
    if (entryTotal <= 0) {
      setErrorMsg('Total amount 0 nahi ho sakta');
      return;
    }

    setEntryLoading(true);
    try {
      await addDoc(collection(db, 'vendor_entries'), {
        vendorId:      addEntryVendor.id,
        vendorName:    addEntryVendor.name,
        categoryKey:   addEntryVendor.categoryKey,
        categoryLabel: addEntryVendor.categoryLabel,
        items:         validItems,
        totalAmount:   entryTotal,
        paidAmount:    0,
        dueAmount:     entryTotal,
        status:        'Pending',
        entryDate:     new Date().toISOString(),
        remarks:       entryRemarks,
        bills:         [],
        createdBy,
        createdAt:     serverTimestamp(),
      });

      setSuccessMsg(
        `Entry saved! ${addEntryVendor.name} — ${formatCurrency(entryTotal)} pending`
      );
      setEntryItems([{ itemName: '', quantity: 1, unit: 'kg', unitPrice: 0, total: 0 }]);
      setEntryRemarks('');
      setAddEntryVendor(null);
      await fetchAllData();
    } catch { setErrorMsg('Entry save nahi hua'); }
    finally   { setEntryLoading(false); }
  };

  // ─────────────────────────────────────────
  // MULTI BILL UPLOAD
  // ─────────────────────────────────────────
  const handleBillUpload = async (entryId: string, files: File[]) => {
    if (!files.length) return;
    setBillUploading(true);
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newBills: BillAttachment[] = [...entry.bills];

      for (const file of files) {
        const result = await processBillFile(file);
        if (result.error) {
          setErrorMsg(result.error);
          continue;
        }
        if (result.data) {
          newBills.push({
            id:         `bill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            base64:     result.data.billBase64,
            fileName:   result.data.billFileName,
            fileType:   result.data.billFileType,
            fileSize:   result.data.billFileSize,
            uploadedAt: new Date().toISOString(),
            uploadedBy: createdBy,
          });
        }
      }

      await updateDoc(doc(db, 'vendor_entries', entryId), {
        bills:     newBills,
        updatedAt: serverTimestamp(),
      });

      setSuccessMsg(`${files.length} bill(s) upload ho gaye!`);
      setBillFiles([]);
      await fetchAllData();
    } catch { setErrorMsg('Bill upload nahi hua'); }
    finally   { setBillUploading(false); }
  };

  const handleDeleteBill = async (entryId: string, billId: string) => {
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;
      const updatedBills = entry.bills.filter(b => b.id !== billId);
      await updateDoc(doc(db, 'vendor_entries', entryId), {
        bills: updatedBills, updatedAt: serverTimestamp(),
      });
      setSuccessMsg('Bill delete ho gaya');
      await fetchAllData();
    } catch { setErrorMsg('Delete nahi hua'); }
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-green-700 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-green-700 rounded-xl flex items-center justify-center text-xl">🏪</div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
              Vendor Management
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Vendor List · Purchase Entries · Due Tracking · Bill Upload
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAllData} disabled={dataLoading}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
            <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => { resetVendorForm(); setShowAddVendor(true); }}
            className="flex items-center gap-1.5 bg-green-700 text-white px-4 py-2 text-[11px] font-black uppercase hover:bg-green-800 rounded">
            <Plus size={13} /> Add Vendor
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

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Vendors',  value: vendors.length,              color: 'text-slate-700',  bg: 'bg-white',    icon: <Building2 size={14} className="text-slate-400" /> },
          { label: 'Total Entries',  value: formatCurrency(totalVendorAmount), color: 'text-blue-700',  bg: 'bg-blue-50',  icon: <ShoppingCart size={14} className="text-blue-400" /> },
          { label: 'Total Paid',     value: formatCurrency(totalVendorPaid),   color: 'text-green-700', bg: 'bg-green-50', icon: <CheckCircle2 size={14} className="text-green-400" /> },
          { label: 'Total Due',      value: formatCurrency(allVendorsDue),     color: allVendorsDue > 0 ? 'text-red-700' : 'text-green-700', bg: allVendorsDue > 0 ? 'bg-red-50' : 'bg-green-50', icon: <AlertTriangle size={14} className={allVendorsDue > 0 ? 'text-red-400' : 'text-green-400'} /> },
        ].map(card => (
          <div key={card.label} className={`${card.bg} border border-slate-200 rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black text-slate-400 uppercase">{card.label}</p>
              {card.icon}
            </div>
            <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 border border-slate-300 rounded px-3 py-1.5 flex-1 min-w-40">
          <Search size={13} className="text-slate-400" />
          <input
            type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Vendor naam search..."
            className="flex-1 text-xs font-bold focus:outline-none bg-transparent"
          />
        </div>
        {/* Category Filter */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilterCat('All')}
            className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${
              filterCat === 'All' ? 'bg-green-700 text-white border-green-700' : 'border-slate-300 text-slate-500'
            }`}>All ({vendors.length})</button>
          {allCategories.map(cat => {
            const cnt = vendors.filter(v => v.categoryKey === cat.key).length;
            if (cnt === 0) return null;
            return (
              <button key={cat.key} onClick={() => setFilterCat(cat.key)}
                className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border flex items-center gap-1 ${
                  filterCat === cat.key ? 'bg-green-600 text-white border-green-600' : 'border-slate-300 text-slate-500'
                }`}>
                {cat.emoji} {cat.label} ({cnt})
              </button>
            );
          })}
        </div>
      </div>

      {/* VENDOR GRID */}
      {dataLoading ? (
        <div className="text-center py-16">
          <Loader2 size={28} className="animate-spin mx-auto text-green-600 mb-3" />
          <p className="text-xs text-slate-500 font-bold">Loading vendors...</p>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-xl">
          <Building2 size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm font-black text-slate-400">Koi vendor nahi</p>
          <p className="text-xs text-slate-300 mt-1">+ Add Vendor se add karo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map(vendor => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              entries={entries}
              onEdit={v => {
                setEditingVendor(v);
                setVName(v.name); setVPhone(v.phone);
                setVAddress(v.address); setVCatKey(v.categoryKey);
                setVNotes(v.notes);
                setShowAddVendor(true);
              }}
              onDelete={v => setDeleteVendor(v)}
              onAddEntry={v => {
                setAddEntryVendor(v);
                setEntryItems([{ itemName: '', quantity: 1, unit: 'kg', unitPrice: 0, total: 0 }]);
                setEntryRemarks('');
              }}
              onViewHistory={v => setHistoryVendor(v)}
            />
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL: ADD / EDIT VENDOR
      ══════════════════════════════════════ */}
      {showAddVendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white shadow-2xl max-w-lg w-full rounded-xl overflow-hidden">
            <div className="bg-green-700 text-white px-5 py-3 flex items-center justify-between">
              <p className="text-sm font-black uppercase">
                {editingVendor ? `Edit: ${editingVendor.name}` : 'Add New Vendor'}
              </p>
              <button onClick={() => { setShowAddVendor(false); resetVendorForm(); }}><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {/* Category */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Category *</label>
                <div className="grid grid-cols-3 gap-2">
                  {allCategories.map(cat => (
                    <button key={cat.key} type="button" onClick={() => setVCatKey(cat.key)}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${
                        vCatKey === cat.key ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <span className="text-lg">{cat.emoji}</span>
                      <p className="text-[9px] font-black mt-0.5 text-slate-700">{cat.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vendor Name *</label>
                  <input type="text" value={vName} onChange={e => setVName(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs font-bold rounded focus:outline-none focus:border-green-600"
                    placeholder="e.g. Sharma Ration Store" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone</label>
                  <input type="text" value={vPhone} onChange={e => setVPhone(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs font-bold rounded focus:outline-none"
                    placeholder="Mobile number" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Address</label>
                <input type="text" value={vAddress} onChange={e => setVAddress(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                  placeholder="Dukan ka address" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Notes</label>
                <input type="text" value={vNotes} onChange={e => setVNotes(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                  placeholder="Any notes..." />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowAddVendor(false); resetVendorForm(); }}
                  className="flex-1 border border-slate-300 py-2 text-xs font-bold rounded hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveVendor} disabled={vLoading || !vName.trim()}
                  className="flex-1 bg-green-700 text-white py-2 text-xs font-black rounded hover:bg-green-800 disabled:opacity-40 flex items-center justify-center gap-2">
                  {vLoading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {editingVendor ? 'Update' : 'Save Vendor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL: ADD ENTRY (Purchase)
      ══════════════════════════════════════ */}
      {addEntryVendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white shadow-2xl max-w-2xl w-full rounded-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-green-700 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-sm font-black uppercase">Add Purchase Entry</p>
                <p className="text-[10px] text-white/70">{addEntryVendor.name} · {addEntryVendor.categoryLabel}</p>
              </div>
              <button onClick={() => setAddEntryVendor(null)}><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Items List *</label>
                  <button onClick={addEntryRow}
                    className="flex items-center gap-1 text-[10px] font-black bg-green-700 text-white px-2.5 py-1 rounded hover:bg-green-800">
                    <Plus size={10} /> Add Row
                  </button>
                </div>

                {/* Header */}
                <div className="grid grid-cols-12 gap-1 px-2 py-1 bg-slate-100 rounded text-[9px] font-black uppercase text-slate-500 mb-1">
                  <div className="col-span-4">Item Name</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-center">Unit</div>
                  <div className="col-span-2 text-center">Price</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Item Rows */}
                <div className="space-y-1.5">
                  {entryItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={e => updateEntryRow(idx, 'itemName', e.target.value)}
                          placeholder="Item naam..."
                          className="w-full border border-slate-300 px-2 py-1.5 text-xs font-bold rounded focus:outline-none focus:border-green-600"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number" min={0} step={0.1}
                          value={item.quantity}
                          onChange={e => updateEntryRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full border border-slate-300 px-2 py-1.5 text-xs font-black rounded text-center focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <select value={item.unit}
                          onChange={e => updateEntryRow(idx, 'unit', e.target.value)}
                          className="w-full border border-slate-300 px-1 py-1.5 text-xs rounded focus:outline-none bg-white">
                          {['kg','g','L','ml','pcs','doz','dozen','box','pkt','bag','tin','bottle'].map(u =>
                            <option key={u} value={u}>{u}</option>
                          )}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number" min={0}
                          value={item.unitPrice}
                          onChange={e => updateEntryRow(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          placeholder="₹"
                          className="w-full border border-slate-300 px-2 py-1.5 text-xs font-black rounded text-center focus:outline-none"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-[10px] font-black text-green-700">
                          {item.total > 0 ? `₹${item.total.toLocaleString('en-IN')}` : '—'}
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        {entryItems.length > 1 && (
                          <button onClick={() => removeEntryRow(idx)} className="text-red-400 hover:text-red-600 p-1">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-3 bg-green-50 border border-green-200 rounded p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-green-700">
                    {entryItems.filter(i => i.itemName).length} items
                  </span>
                  <span className="text-xl font-black text-green-800">
                    Total: {formatCurrency(entryTotal)}
                  </span>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
                <input type="text" value={entryRemarks} onChange={e => setEntryRemarks(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded focus:outline-none"
                  placeholder="Note..." />
              </div>

              {/* Info */}
              <div className="bg-amber-50 border border-amber-200 rounded p-2.5 flex items-center gap-2">
                <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                <p className="text-[10px] text-amber-700 font-semibold">
                  Yeh entry <strong>Pending</strong> mein jayegi. Payment ke liye
                  <strong> Vendor Payment</strong> screen pe jao.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 flex gap-2 flex-shrink-0">
              <button onClick={() => setAddEntryVendor(null)}
                className="flex-1 border border-slate-300 py-2 text-xs font-bold rounded hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveEntry} disabled={entryLoading || entryTotal <= 0}
                className="flex-1 bg-green-700 text-white py-2 text-xs font-black rounded hover:bg-green-800 disabled:opacity-40 flex items-center justify-center gap-2">
                {entryLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Save Entry — {formatCurrency(entryTotal)} Pending
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL: VENDOR HISTORY
      ══════════════════════════════════════ */}
      {historyVendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white shadow-2xl max-w-3xl w-full rounded-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-sm font-black uppercase">Vendor History</p>
                <p className="text-[10px] text-white/70">
                  {historyVendor.name} · {historyVendor.categoryLabel}
                </p>
              </div>
              <button onClick={() => setHistoryVendor(null)}><X size={16} /></button>
            </div>

            {/* Summary */}
            {(() => {
              const vEntries    = entries.filter(e => e.vendorId === historyVendor.id);
              const vTotal      = vEntries.reduce((s, e) => s + e.totalAmount, 0);
              const vPaid       = vEntries.reduce((s, e) => s + e.paidAmount,  0);
              const vDue        = vEntries.reduce((s, e) => s + e.dueAmount,   0);
              return (
                <>
                  <div className="grid grid-cols-3 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Total Amount</p>
                      <p className="text-lg font-black text-slate-700">{formatCurrency(vTotal)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-green-500 font-bold uppercase">Paid</p>
                      <p className="text-lg font-black text-green-700">{formatCurrency(vPaid)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold uppercase text-slate-400">Due</p>
                      <p className={`text-lg font-black ${vDue > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(vDue)}</p>
                    </div>
                  </div>

                  {/* Entries List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {vEntries.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <FileText size={32} className="mx-auto mb-2 text-slate-200" />
                        <p className="text-sm font-bold">Koi entry nahi</p>
                      </div>
                    ) : (
                      vEntries.map(entry => (
                        <div key={entry.id} className="p-4 hover:bg-slate-50">
                          {/* Entry Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-[10px] text-slate-500">{formatDateTime(entry.entryDate)}</p>
                              <p className="text-xs font-black text-slate-800">
                                {entry.items.length} items · {formatCurrency(entry.totalAmount)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                entry.status === 'Paid'    ? 'bg-green-100 text-green-700 border-green-200' :
                                entry.status === 'Partial' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                'bg-red-100 text-red-700 border-red-200'
                              }`}>{entry.status}</span>
                              {entry.dueAmount > 0 && (
                                <span className="text-[10px] font-black text-red-600">
                                  Due: {formatCurrency(entry.dueAmount)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Items */}
                          <div className="bg-slate-50 rounded p-2 mb-2 space-y-0.5">
                            {entry.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-700 font-bold">
                                  {item.itemName} · {item.quantity} {item.unit} @ ₹{item.unitPrice}
                                </span>
                                <span className="font-black text-slate-700">
                                  ₹{item.total.toLocaleString('en-IN')}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Bills Section */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Upload Bills */}
                            <input
                              type="file"
                              id={`bill-upload-${entry.id}`}
                              multiple
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              className="hidden"
                              onChange={async e => {
                                const files = Array.from(e.target.files ?? []);
                                if (files.length) await handleBillUpload(entry.id, files);
                                e.target.value = '';
                              }}
                            />
                            <label htmlFor={`bill-upload-${entry.id}`}
                              className="flex items-center gap-1 text-[10px] font-bold cursor-pointer bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded hover:bg-blue-100">
                              <Upload size={11} /> + Upload Bills
                            </label>

                            {/* Bills List */}
                            {entry.bills.map(bill => (
                              <div key={bill.id} className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1">
                                <span className="text-[9px] text-slate-500 max-w-24 truncate">{bill.fileName}</span>
                                <button onClick={() => setPreviewBill(bill)}
                                  className="text-indigo-500 hover:text-indigo-700 p-0.5">
                                  <Eye size={11} />
                                </button>
                                <button onClick={() => handleDeleteBill(entry.id, bill.id)}
                                  className="text-red-400 hover:text-red-600 p-0.5">
                                  <X size={10} />
                                </button>
                              </div>
                            ))}

                            {billUploading && (
                              <Loader2 size={13} className="animate-spin text-blue-500" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL: DELETE VENDOR CONFIRM
      ══════════════════════════════════════ */}
      {deleteVendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border shadow-2xl max-w-sm w-full rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-slate-800">
                  {deleteVendor.name} ko remove karo?
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Purani entries aur bills safe rahenge.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteVendor(null)}
                className="px-4 py-1.5 text-xs font-bold border border-slate-300 hover:bg-slate-50 uppercase rounded">Cancel</button>
              <button onClick={handleDeleteVendor}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 uppercase rounded">
                Haan, Remove
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

export default VendorManagementScreen;