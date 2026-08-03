// D:\ALL PROJECTS\BSF COYs\frontend\src\features\quartermaster\InventoryIssueScreen.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search, Save, User, Crosshair, Activity, FileText,
  CheckCircle2, XCircle, Plus, Trash2, ShoppingCart,
  Package, AlertTriangle, Clock, Ruler,
  Loader2, RefreshCw, Info, X,
  UserCheck, Award, Target, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  collection, query, where, getDocs,
  doc, updateDoc, addDoc, serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';
import { ModuleReportButton } from '../system/ModuleReportButton';

const SHOE_SIZES  = ['5', '6', '7', '8', '9', '10', '11', '12', '13'];
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

interface BaseTrainingItem {
  id: string;
  name: string;
  emoji: string;
  category: string;
  hasSizes?: boolean;
  sizeOptions?: string[];
  isCustom?: boolean;
}

const FIXED_TRAINING_ITEMS: BaseTrainingItem[] = [
  { id: 'dm-shoes',     name: 'DM Shoes',     emoji: '👞', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { id: 'pt-shoes',     name: 'PT Shoes',     emoji: '👟', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { id: 'ankle-shoes',  name: 'Ankle Shoes',  emoji: '🥾', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { id: 'pt-t-shirt',   name: 'PT T-Shirt',   emoji: '👕', category: 'Uniform',   hasSizes: true, sizeOptions: SHIRT_SIZES },
  { id: 'ground-sheet', name: 'Ground Sheet', emoji: '🛏️', category: 'Bedding'   },
  { id: 'plate',        name: 'Plate',        emoji: '🍽️', category: 'Mess Item' },
  { id: 'glass',        name: 'Glass',        emoji: '🥤', category: 'Mess Item' },
  { id: 'bucket',       name: 'Bucket',       emoji: '🪣', category: 'Equipment' },
  { id: 'mug',          name: 'Mug',          emoji: '☕', category: 'Mess Item' },
  { id: 'mess-tin',     name: 'Mess Tin',     emoji: '🥫', category: 'Mess Item' },
  { id: 'mosquito-net', name: 'Mosquito Net', emoji: '🦟', category: 'Bedding'   },
  { id: 'water-bottle', name: 'Water Bottle', emoji: '💧', category: 'Equipment' },
  { id: 'towel',        name: 'Towel',        emoji: '🧻', category: 'Equipment' },
  { id: 'lock',         name: 'Lock',         emoji: '🔒', category: 'Equipment' },
];

interface SizeBreakdown { size: string; quantity: number; }

interface TrainingItemStock {
  id: string;
  itemName: string;
  emoji: string;
  category: string;
  sizeRequired: boolean;
  sizeOptions: string[];
  currentStock: number;
  minStockAlert: number;
  unitPrice: number;
  sizeStock: Record<string, number>;
  totalPurchased: number;
  totalIssued: number;
  isCustom?: boolean;
}

interface CartItem extends TrainingItemStock {
  cartKey: string;
  originalId: string;
  assignedSize: string;
  quantity: number;
  issueDate: string;
}

interface IssuedKitItem {
  id: string;
  itemName: string;
  assignedSize: string;
  quantity: number;
  issueDate: string;
  issuedBy?: string;
  issueSource?: string;
}

// ── Merged Issued Item (for grouping duplicates) ──
interface MergedIssuedItem {
  itemName: string;
  assignedSize: string;
  totalQuantity: number;
  issueCount: number;
  lastIssueDate: string;
  firstIssueDate: string;
  issuedBy: string[];
  entries: IssuedKitItem[];
}

// ── FPT & Weekly Test Types ──
interface FPTRecord {
  id?: string;
  weekNumber: number;
  testDate: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  result: 'Pass' | 'Fail';
  events?: { name: string; marks: number; maxMarks: number; passed: boolean }[];
}

interface WeeklyTestRecord {
  id?: string;
  weekNumber: number;
  testDate: string;
  testName: string;
  subject: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  result: 'Pass' | 'Fail';
}

interface Trainee {
  id: string;
  name: string;
  chestNo: string;
  platoon?: string;
  fatherName?: string;
  rifleNo?: string;
  fptStatus?: string;
  weeklyTestScore?: string;
  sickReports?: string | number;
  issuedKitItems?: IssuedKitItem[];
  lastKitIssueDate?: string;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const normalizeName = (v: string) => (v || '').trim().toLowerCase();

const slugify = (v: string) =>
  (v || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isAssetLike = (category?: string, name?: string) => {
  const c = normalizeName(category || '');
  const n = normalizeName(name    || '');
  return c.includes('asset') || n.includes('asset');
};

const getStockColor = (stock: number, min: number) => {
  if (stock === 0)  return 'text-red-600 bg-red-50';
  if (stock <= min) return 'text-amber-600 bg-amber-50';
  return 'text-green-700 bg-green-50';
};

const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : '—';

// ── MERGE ISSUED ITEMS HELPER ──
const mergeIssuedItems = (items: IssuedKitItem[]): MergedIssuedItem[] => {
  const map = new Map<string, MergedIssuedItem>();

  items.forEach(item => {
    // Group by itemName + assignedSize
    const key = `${normalizeName(item.itemName)}_${normalizeName(item.assignedSize || 'N/A')}`;

    if (!map.has(key)) {
      map.set(key, {
        itemName: item.itemName,
        assignedSize: item.assignedSize || 'N/A',
        totalQuantity: 0,
        issueCount: 0,
        lastIssueDate: item.issueDate || '',
        firstIssueDate: item.issueDate || '',
        issuedBy: [],
        entries: [],
      });
    }

    const merged = map.get(key)!;
    merged.totalQuantity += (item.quantity ?? 1);
    merged.issueCount += 1;
    merged.entries.push(item);

    // Track latest and first dates
    if (item.issueDate) {
      if (!merged.lastIssueDate || item.issueDate > merged.lastIssueDate) {
        merged.lastIssueDate = item.issueDate;
      }
      if (!merged.firstIssueDate || item.issueDate < merged.firstIssueDate) {
        merged.firstIssueDate = item.issueDate;
      }
    }

    // Track unique issuers
    if (item.issuedBy && !merged.issuedBy.includes(item.issuedBy)) {
      merged.issuedBy.push(item.issuedBy);
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    (b.lastIssueDate || '').localeCompare(a.lastIssueDate || '')
  );
};

// ─────────────────────────────────────────────
// SUB: Trainee Profile Card
// ─────────────────────────────────────────────
const TraineeProfileCard: React.FC<{ trainee: Trainee }> = ({ trainee }) => (
  <div className="border border-slate-200 shadow-sm overflow-hidden rounded">
    <div className="bg-slate-800 text-white p-3">
      <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
        <User size={15} /> {trainee.name}
      </h2>
      <p className="text-[10px] font-mono mt-1 text-slate-300">
        CHEST: {trainee.chestNo} &nbsp;|&nbsp;
        PLATOON: {trainee.platoon || 'Unassigned'}
      </p>
    </div>
    <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 text-xs">
      <div className="flex justify-between items-center">
        <span className="text-slate-500 font-bold uppercase">Father's Name:</span>
        <span className="font-semibold text-slate-800">{trainee.fatherName || 'Not Updated'}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-slate-500 font-bold uppercase flex items-center gap-1">
          <Crosshair size={11} /> Weapon Issued:
        </span>
        <span className="font-semibold text-slate-800">{trainee.rifleNo || 'Pending'}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-slate-500 font-bold uppercase flex items-center gap-1">
          <Activity size={11} /> Sick Reports:
        </span>
        <span className="font-semibold text-slate-800">{trainee.sickReports || 0} Times</span>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// SUB: FPT Results Panel (COLLAPSIBLE)
// ─────────────────────────────────────────────
const FPTResultsPanel: React.FC<{ 
  records: FPTRecord[]; 
  loading: boolean;
}> = ({ records, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-white border border-orange-200 rounded shadow-sm p-4 text-center">
        <Loader2 size={16} className="animate-spin mx-auto text-orange-500" />
        <p className="text-[10px] text-slate-400 mt-1 font-bold">
          FPT Records fetch ho rahe hain...
        </p>
      </div>
    );
  }

  const passed     = records.filter(r => r.result === 'Pass').length;
  const bestPct    = records.length > 0 
    ? Math.max(...records.map(r => r.percentage || 0)) 
    : 0;
  const everPassed = records.some(r => r.result === 'Pass');

  return (
    <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-orange-50 border-b border-orange-200 px-3 py-2.5 flex items-center justify-between hover:bg-orange-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={13} className="text-orange-600" />
          <span className="text-[11px] font-black uppercase text-orange-800">
            FPT Records ({records.length})
          </span>
          {records.length > 0 && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
              everPassed
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-red-100 text-red-600 border-red-300'
            }`}>
              {everPassed ? '✅ PASSED' : '❌ NOT PASSED'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <span className="text-[9px] font-bold text-orange-600">
              Best: {bestPct}%
            </span>
          )}
          {isOpen 
            ? <ChevronUp size={14} className="text-orange-500" /> 
            : <ChevronDown size={14} className="text-orange-500" />
          }
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <>
          {records.length === 0 ? (
            <div className="p-4 text-center">
              <Target size={24} className="mx-auto text-slate-200 mb-1" />
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                Koi FPT record nahi mila
              </p>
              <p className="text-[9px] text-slate-300 mt-0.5">
                FPT Tracker se data add karo
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                <div className="p-2 text-center">
                  <p className="text-sm font-black text-slate-700">{records.length}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Total</p>
                </div>
                <div className="p-2 text-center">
                  <p className="text-sm font-black text-green-600">{passed}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Passed</p>
                </div>
                <div className="p-2 text-center">
                  <p className="text-sm font-black text-orange-600">{bestPct}%</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Best %</p>
                </div>
              </div>

              {/* Records */}
              <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
                {records.map(r => (
                  <div key={r.id} className="px-3 py-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() =>
                        setExpanded(expanded === r.id ? null : (r.id ?? null))
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          W{r.weekNumber}
                        </span>
                        <span className="text-[10px] font-bold text-slate-700">
                          {r.obtainedMarks}/{r.totalMarks}
                        </span>
                        <span className="text-[9px] text-slate-400">{r.testDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                          r.result === 'Pass'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}>
                          {r.percentage}% {r.result === 'Pass' ? '✅' : '❌'}
                        </span>
                        {r.events && r.events.length > 0 && (
                          expanded === r.id
                            ? <ChevronUp size={11} className="text-slate-400" />
                            : <ChevronDown size={11} className="text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Events Expanded */}
                    {expanded === r.id && r.events && r.events.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {r.events.map((ev, i) => (
                          <div key={i}
                            className={`text-[9px] font-bold px-2 py-1 rounded border flex justify-between ${
                              ev.passed
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-red-50 border-red-200 text-red-600'
                            }`}>
                            <span className="truncate">{ev.name}</span>
                            <span className="ml-1 font-black flex-shrink-0">
                              {ev.marks}/{ev.maxMarks}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// SUB: Weekly Test Results Panel (COLLAPSIBLE)
// ─────────────────────────────────────────────
const WeeklyTestResultsPanel: React.FC<{ 
  records: WeeklyTestRecord[]; 
  loading: boolean;
}> = ({ records, loading }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <div className="bg-white border border-amber-200 rounded shadow-sm p-4 text-center">
        <Loader2 size={16} className="animate-spin mx-auto text-amber-500" />
        <p className="text-[10px] text-slate-400 mt-1 font-bold">
          Weekly Test Records fetch ho rahe hain...
        </p>
      </div>
    );
  }

  const passed = records.filter(r => r.result === 'Pass').length;
  const avgPct = records.length > 0
    ? Math.round(
        records.reduce((s, r) => s + (r.percentage || 0), 0) / records.length
      )
    : 0;

  return (
    <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-amber-50 border-b border-amber-200 px-3 py-2.5 flex items-center justify-between hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Award size={13} className="text-amber-600" />
          <span className="text-[11px] font-black uppercase text-amber-800">
            Weekly Tests ({records.length})
          </span>
          {records.length > 0 && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
              avgPct >= 50
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-red-100 text-red-600 border-red-300'
            }`}>
              Avg: {avgPct}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <span className="text-[9px] font-bold text-amber-600">
              {passed}/{records.length} Passed
            </span>
          )}
          {isOpen 
            ? <ChevronUp size={14} className="text-amber-500" /> 
            : <ChevronDown size={14} className="text-amber-500" />
          }
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <>
          {records.length === 0 ? (
            <div className="p-4 text-center">
              <Award size={24} className="mx-auto text-slate-200 mb-1" />
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                Koi weekly test record nahi mila
              </p>
              <p className="text-[9px] text-slate-300 mt-0.5">
                Weekly Test Tracker se data add karo
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                <div className="p-2 text-center">
                  <p className="text-sm font-black text-slate-700">{records.length}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Tests</p>
                </div>
                <div className="p-2 text-center">
                  <p className="text-sm font-black text-green-600">{passed}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Passed</p>
                </div>
                <div className="p-2 text-center">
                  <p className="text-sm font-black text-amber-600">{avgPct}%</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Avg%</p>
                </div>
              </div>

              {/* Records */}
              <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
                {records.map(r => (
                  <div key={r.id}
                    className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
                        W{r.weekNumber}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-700 truncate">
                          {r.testName}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate">
                          {r.subject} · {r.testDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] font-bold text-slate-600">
                        {r.obtainedMarks}/{r.totalMarks}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        r.result === 'Pass'
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}>
                        {r.percentage}% {r.result === 'Pass' ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// SUB: Kit Status Panel
// ─────────────────────────────────────────────
interface KitStatusPanelProps {
  trainee: Trainee;
  allItems: TrainingItemStock[];
  selectedItems: CartItem[];
}

const KitStatusPanel: React.FC<KitStatusPanelProps> = ({ 
  trainee, allItems, selectedItems 
}) => {
  const getStatus = (item: TrainingItemStock) => {
    const issued = trainee.issuedKitItems?.some(
      i => normalizeName(i.itemName) === normalizeName(item.itemName)
    );
    const inCart = selectedItems.some(i => i.originalId === item.id);
    if (issued) return { 
      label: 'RECEIVED', 
      cls: 'bg-green-50 text-green-700 border-green-200', 
      icon: <CheckCircle2 size={12} /> 
    };
    if (inCart) return { 
      label: 'IN CART', 
      cls: 'bg-blue-50 text-blue-700 border-blue-200', 
      icon: <ShoppingCart size={12} /> 
    };
    return { 
      label: 'PENDING', 
      cls: 'bg-red-50 text-red-600 border-red-200', 
      icon: <XCircle size={12} /> 
    };
  };

  const receivedCount = allItems.filter(item =>
    trainee.issuedKitItems?.some(
      i => normalizeName(i.itemName) === normalizeName(item.itemName)
    )
  ).length;

  const pct = allItems.length > 0
    ? Math.round((receivedCount / allItems.length) * 100)
    : 0;

  return (
    <div className="p-3 bg-white">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
          Training Essentials Status
        </p>
        <span className="text-[10px] font-bold text-slate-600">
          {receivedCount}/{allItems.length} received
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
        <div 
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }} 
        />
      </div>
      <div className="flex items-center gap-3 mb-2 text-[9px] font-bold uppercase">
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 size={9} /> Received
        </span>
        <span className="flex items-center gap-1 text-blue-600">
          <ShoppingCart size={9} /> In Cart
        </span>
        <span className="flex items-center gap-1 text-red-500">
          <XCircle size={9} /> Pending
        </span>
      </div>
      <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
        {allItems.length === 0 ? (
          <p className="text-[10px] text-slate-400 text-center py-4">
            No Training Essentials items found
          </p>
        ) : (
          allItems.map(item => {
            const { label, cls, icon } = getStatus(item);
            const issuedRecord = trainee.issuedKitItems?.find(
              i => normalizeName(i.itemName) === normalizeName(item.itemName)
            );
            return (
              <div key={item.id}
                className={`flex items-center justify-between text-[10px] font-bold uppercase p-1.5 rounded border ${cls}`}>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {icon}
                  <span className="truncate">{item.emoji} {item.itemName}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {issuedRecord?.assignedSize && 
                   issuedRecord.assignedSize !== 'N/A' && (
                    <span className="text-[9px] font-mono bg-white border px-1 rounded">
                      Sz: {issuedRecord.assignedSize}
                    </span>
                  )}
                  <span className="text-[9px]">{label}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const InventoryIssueScreen: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { activeBatch } = useBatch();
  const issuedBy = user?.email ?? 'Quarter Master';
  // Records created before batches existed are owned by the current active batch.
  const belongsToActiveBatch = (data: any) => !data.batchId || data.batchId === activeBatch?.id;

  const [searchQuery,   setSearchQuery]   = useState('');
  const [trainee,       setTrainee]       = useState<Trainee | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [issueLoading,  setIssueLoading]  = useState(false);
  const [allItems,      setAllItems]      = useState<TrainingItemStock[]>([]);
  const [itemsLoading,  setItemsLoading]  = useState(true);
  const [cartItems,     setCartItems]     = useState<CartItem[]>([]);
  const [itemSearchText,setItemSearchText]= useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [sizeErrors,    setSizeErrors]    = useState<Record<string, boolean>>({});
  const [successMsg,    setSuccessMsg]    = useState('');
  const [errorMsg,      setErrorMsg]      = useState('');

  // FPT & Weekly Test States
  const [fptRecords,        setFptRecords]        = useState<FPTRecord[]>([]);
  const [weeklyTestRecords, setWeeklyTestRecords] = useState<WeeklyTestRecord[]>([]);
  const [fptLoading,        setFptLoading]        = useState(false);
  const [weeklyTestLoading, setWeeklyTestLoading] = useState(false);

  // ✅ Previously Issued Items expand state
  const [expandedIssuedItem, setExpandedIssuedItem] = useState<string | null>(null);

  const dropdownRef   = useRef<HTMLDivElement>(null);
  const itemSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = new URLSearchParams(location.search).get('search');
    if (term) setItemSearchText(term);
  }, [location.search]);

  // ── REAL-TIME TRAINEE SYNC ──
  useEffect(() => {
    if (!trainee?.id) return;
    const unsub = onSnapshot(doc(db, 'trainees', trainee.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setTrainee(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          fptStatus:        data.fptStatus        ?? prev.fptStatus,
          weeklyTestScore:  data.weeklyTestScore   ?? prev.weeklyTestScore,
          sickReports:      data.sickReports       ?? prev.sickReports,
          rifleNo:          data.rifleNo           ?? prev.rifleNo,
          fatherName:       data.fatherName        ?? prev.fatherName,
          issuedKitItems:   data.issuedKitItems    ?? prev.issuedKitItems ?? [],
          lastKitIssueDate: data.lastKitIssueDate  ?? prev.lastKitIssueDate,
        };
      });
    });
    return () => unsub();
  }, [trainee?.id]);

  // FPT + Weekly Test fetch
  const fetchTraineeResults = async (traineeId: string) => {
    setFptLoading(true);
    try {
      const fptSnap = await getDocs(
        query(
          collection(db, 'fptRecords'),
          where('traineeId', '==', traineeId)
        )
      );
      const fptList: FPTRecord[] = [];
      fptSnap.forEach(d => 
        fptList.push({ id: d.id, ...d.data() } as FPTRecord)
      );
      fptList.sort((a, b) => (b.weekNumber || 0) - (a.weekNumber || 0));
      setFptRecords(fptList);
    } catch (err) {
      console.error('FPT fetch error:', err);
      setFptRecords([]);
    } finally {
      setFptLoading(false);
    }

    setWeeklyTestLoading(true);
    try {
      const wtSnap = await getDocs(
        query(
          collection(db, 'weeklyTestRecords'),
          where('traineeId', '==', traineeId)
        )
      );
      const wtList: WeeklyTestRecord[] = [];
      wtSnap.forEach(d => 
        wtList.push({ id: d.id, ...d.data() } as WeeklyTestRecord)
      );
      wtList.sort((a, b) => (b.weekNumber || 0) - (a.weekNumber || 0));
      setWeeklyTestRecords(wtList);
    } catch (err) {
      console.error('Weekly test fetch error:', err);
      setWeeklyTestRecords([]);
    } finally {
      setWeeklyTestLoading(false);
    }
  };

  // ── FETCH STOCK ──
  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const customSnap = await getDocs(collection(db, 'training_custom_items'));
      const customItems: BaseTrainingItem[] = customSnap.docs.map(d => {
        const data = d.data() as any;
        return {
          id:          d.id,
          name:        data.name        ?? '',
          emoji:       data.emoji       ?? '📦',
          category:    data.category    ?? 'Other',
          hasSizes:    Boolean(data.hasSizes),
          sizeOptions: Array.isArray(data.sizeOptions) ? data.sizeOptions : [],
          isCustom:    true,
        };
      });

      const catalogMap = new Map<string, BaseTrainingItem>();
      [...FIXED_TRAINING_ITEMS, ...customItems].forEach(item => {
        if (isAssetLike(item.category, item.name)) return;
        catalogMap.set(normalizeName(item.name), item);
      });

      const expSnap      = await getDocs(collection(db, 'training_fund_expenses'));
      const purchasedMap = new Map<string, {
        itemName: string; totalQty: number; totalValue: number;
        latestUnitPrice: number; sizeStock: Record<string, number>;
      }>();

      expSnap.forEach(d => {
        const data     = d.data() as any;
        if (!belongsToActiveBatch(data)) return;
        const itemName = String(data.itemName ?? '').trim();
        if (!itemName) return;
        const meta     = catalogMap.get(normalizeName(itemName));
        const category = meta?.category ?? 'Other';
        if (isAssetLike(category, itemName)) return;

        const qty       = Number(data.quantity  ?? 0);
        const amount    = Number(data.amount    ?? 0);
        const unitPrice = Number(data.unitPrice ?? 0);
        const key       = normalizeName(itemName);

        if (!purchasedMap.has(key)) {
          purchasedMap.set(key, { 
            itemName, totalQty: 0, totalValue: 0, 
            latestUnitPrice: 0, sizeStock: {} 
          });
        }
        const agg = purchasedMap.get(key)!;
        agg.totalQty   += qty;
        agg.totalValue += amount;
        if (unitPrice > 0) agg.latestUnitPrice = unitPrice;

        const sizes: SizeBreakdown[] = Array.isArray(data.sizes) ? data.sizes : [];
        sizes.forEach(sz => {
          const size = String(sz.size ?? '').trim();
          const q    = Number(sz.quantity ?? 0);
          if (!size || q <= 0) return;
          agg.sizeStock[size] = (agg.sizeStock[size] || 0) + q;
        });
      });

      const issueSnap = await getDocs(collection(db, 'issue_records'));
      const issuedMap = new Map<string, { 
        totalQty: number; sizeStock: Record<string, number> 
      }>();

      issueSnap.forEach(d => {
        const data = d.data() as any;
        if (!belongsToActiveBatch(data)) return;
        const isTrainingIssue =
          data.issueSource === 'TRAINING_ESSENTIALS' ||
          data.issueType   === 'TRAINING_ESSENTIALS';
        if (!isTrainingIssue) return;

        const items = Array.isArray(data.issuedItems) ? data.issuedItems
          : Array.isArray(data.items) ? data.items : [];

        items.forEach((item: any) => {
          const itemName = String(item.itemName ?? '').trim();
          if (!itemName) return;
          const key = normalizeName(itemName);
          if (!issuedMap.has(key)) 
            issuedMap.set(key, { totalQty: 0, sizeStock: {} });

          const qty  = Number(item.quantity     ?? 1);
          const size = String(item.assignedSize ?? '').trim();
          const agg  = issuedMap.get(key)!;
          agg.totalQty += qty;
          if (size && size !== 'N/A') {
            agg.sizeStock[size] = (agg.sizeStock[size] || 0) + qty;
          }
        });
      });

      const allKeys = new Set<string>([
        ...Array.from(catalogMap.keys()),
        ...Array.from(purchasedMap.keys()),
      ]);

      const finalList: TrainingItemStock[] = [];

      allKeys.forEach(key => {
        const meta      = catalogMap.get(key);
        const purchased = purchasedMap.get(key);
        const issued    = issuedMap.get(key);

        const itemName = purchased?.itemName ?? meta?.name ?? key;
        const category = meta?.category ?? 'Other';
        if (isAssetLike(category, itemName)) return;

        const sizeRequired   = Boolean(meta?.hasSizes) || 
                               Object.keys(purchased?.sizeStock ?? {}).length > 0;
        const sizeOptions    = meta?.sizeOptions ?? [];
        const purchSizeStock = purchased?.sizeStock ?? {};
        const issuSizeStock  = issued?.sizeStock   ?? {};

        const mergedSizeKeys = new Set<string>([
          ...sizeOptions,
          ...Object.keys(purchSizeStock),
          ...Object.keys(issuSizeStock),
        ]);

        const liveSizeStock: Record<string, number> = {};
        mergedSizeKeys.forEach(size => {
          liveSizeStock[size] = Math.max(
            0,
            Number(purchSizeStock[size] || 0) - Number(issuSizeStock[size] || 0)
          );
        });

        const totalPurchased = Number(purchased?.totalQty || 0);
        const totalIssued    = Number(issued?.totalQty    || 0);
        const currentStock   = sizeRequired && Object.keys(liveSizeStock).length > 0
          ? Object.values(liveSizeStock).reduce((s, q) => s + q, 0)
          : Math.max(0, totalPurchased - totalIssued);

        const fallbackUnitPrice = totalPurchased > 0
          ? Number((Number(purchased?.totalValue || 0) / totalPurchased).toFixed(2))
          : 0;

        finalList.push({
          id:            meta?.id ?? slugify(itemName),
          itemName,
          emoji:         meta?.emoji ?? '📦',
          category,
          sizeRequired,
          sizeOptions,
          currentStock,
          minStockAlert: 2,
          unitPrice:     Number(purchased?.latestUnitPrice || fallbackUnitPrice || 0),
          sizeStock:     liveSizeStock,
          totalPurchased,
          totalIssued,
          isCustom:      meta?.isCustom,
        });
      });

      finalList.sort((a, b) => a.itemName.localeCompare(b.itemName));
      setAllItems(finalList);
    } catch (err) {
      console.error('Training stock fetch error:', err);
      setErrorMsg('Training Essentials stock load karne mein error. Refresh karein.');
    } finally {
      setItemsLoading(false);
    }
  }, [activeBatch?.id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── CLOSE DROPDOWN ON OUTSIDE CLICK ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && 
          !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── SEARCH TRAINEE ──
  const searchTrainee = useCallback(async (forcedChestNo?: string) => {
    const q = (forcedChestNo ?? searchQuery).trim();
    if (!q) return;

    setSearchLoading(true);
    setTrainee(null);
    setCartItems([]);
    setItemSearchText('');
    setSuccessMsg('');
    setErrorMsg('');
    setSizeErrors({});
    setFptRecords([]);
    setWeeklyTestRecords([]);
    setExpandedIssuedItem(null);

    try {
      const snap = await getDocs(
        query(collection(db, 'trainees'), where('chestNo', '==', q))
      );
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data    = docSnap.data() as any;
        if (!belongsToActiveBatch(data)) {
          setErrorMsg('Trainee belongs to another batch. Select the correct active batch.');
          return;
        }
        const foundTrainee: Trainee = {
          id:               docSnap.id,
          name:             data.name             ?? 'Unknown',
          chestNo:          data.chestNo          ?? q,
          platoon:          data.platoon,
          fatherName:       data.fatherName,
          rifleNo:          data.rifleNo,
          fptStatus:        data.fptStatus,
          weeklyTestScore:  data.weeklyTestScore,
          sickReports:      data.sickReports,
          issuedKitItems:   data.issuedKitItems   ?? [],
          lastKitIssueDate: data.lastKitIssueDate,
        };
        setTrainee(foundTrainee);
        await fetchTraineeResults(docSnap.id);
      } else {
        setErrorMsg(`Chest No "${q}" nahi mila. Please check karo.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setErrorMsg('Search mein error aaya.');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const handleSearch = () => searchTrainee();

  // ── DERIVED ──
  const kitStatusItems = allItems.filter(
    i => normalizeName(i.itemName) !== 'other'
  );

  const filteredDropdownItems = allItems.filter(item => {
    if (!trainee) return false;
    if (normalizeName(item.itemName) === 'other') return false;
    if (item.currentStock <= 0) return false;
    const s = itemSearchText.toLowerCase();
    return (
      item.itemName.toLowerCase().includes(s) ||
      item.category.toLowerCase().includes(s)
    );
  });

  const getLiveItem = (originalId: string) => 
    allItems.find(i => i.id === originalId);

  const getMaxQtyForItem = (item: CartItem) => {
    const liveItem = getLiveItem(item.originalId);
    if (!liveItem) return 0;
    if (liveItem.sizeRequired && item.assignedSize && item.assignedSize !== 'N/A') {
      return Number(liveItem.sizeStock[item.assignedSize] || 0);
    }
    return Number(liveItem.currentStock || 0);
  };

  // ── CART ACTIONS ──
  const addToCart = (item: TrainingItemStock) => {
    const cartKey = `${item.id}_${Date.now()}`;
    setCartItems(prev => [
      ...prev,
      {
        ...item,
        cartKey,
        originalId:   item.id,
        id:           cartKey,
        assignedSize: item.sizeRequired ? '' : 'N/A',
        quantity:     1,
        issueDate:    new Date().toISOString(),
      },
    ]);
    setItemSearchText('');
    setShowDropdown(false);
    itemSearchRef.current?.focus();
  };

  const removeFromCart = (cartKey: string) => {
    setCartItems(prev => prev.filter(i => i.cartKey !== cartKey));
    setSizeErrors(prev => { 
      const u = { ...prev }; 
      delete u[cartKey]; 
      return u; 
    });
  };

  const updateSize = (cartKey: string, size: string) => {
    setCartItems(prev =>
      prev.map(i => 
        i.cartKey === cartKey ? { ...i, assignedSize: size, quantity: 1 } : i
      )
    );
    if (size.trim()) {
      setSizeErrors(prev => { 
        const u = { ...prev }; 
        delete u[cartKey]; 
        return u; 
      });
    }
  };

  const updateQuantity = (cartKey: string, qty: number) => {
    setCartItems(prev =>
      prev.map(i => {
        if (i.cartKey !== cartKey) return i;
        const max = getMaxQtyForItem(i);
        return { ...i, quantity: Math.max(1, Math.min(qty, Math.max(1, max))) };
      })
    );
  };

  // ── VALIDATE ──
  const validateCart = (): boolean => {
    const errors: Record<string, boolean> = {};
    let stockError = '';

    cartItems.forEach(item => {
      const liveItem = getLiveItem(item.originalId);

      if (item.sizeRequired && !item.assignedSize.trim()) {
        errors[item.cartKey] = true;
        if (!stockError) 
          stockError = `"${item.itemName}" ke liye size select karein.`;
        return;
      }
      if (!liveItem) {
        errors[item.cartKey] = true;
        if (!stockError) 
          stockError = `"${item.itemName}" stock mein nahi mila.`;
        return;
      }
      if (item.sizeRequired && item.assignedSize && item.assignedSize !== 'N/A') {
        const sizeAvail = Number(liveItem.sizeStock[item.assignedSize] || 0);
        if (sizeAvail < item.quantity) {
          errors[item.cartKey] = true;
          if (!stockError)
            stockError = `"${item.itemName}" size ${item.assignedSize} ka stock sirf ${sizeAvail} hai.`;
        }
      } else if (liveItem.currentStock < item.quantity) {
        errors[item.cartKey] = true;
        if (!stockError)
          stockError = `"${item.itemName}" ka available stock sirf ${liveItem.currentStock} hai.`;
      }
    });

    setSizeErrors(errors);
    if (stockError) { setErrorMsg(stockError); return false; }
    return Object.keys(errors).length === 0;
  };

  // ── ISSUE ──
  const handleIssue = async () => {
    if (!trainee || cartItems.length === 0) return;
    setErrorMsg(''); setSuccessMsg('');
    if (!validateCart()) return;
    setIssueLoading(true);

    try {
      const issueDateISO = new Date().toISOString();
      const totalValue   = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const totalUnits   = cartItems.reduce((s, i) => s + i.quantity, 0);

      const newIssuedItems: IssuedKitItem[] = cartItems.map(item => ({
        id:           item.originalId,
        itemName:     item.itemName,
        assignedSize: item.assignedSize,
        quantity:     item.quantity,
        issueDate:    issueDateISO,
        issuedBy,
        issueSource:  'TRAINING_ESSENTIALS',
      }));

      const updatedIssuedItems = [
        ...(trainee.issuedKitItems ?? []),
        ...newIssuedItems,
      ];

      await updateDoc(doc(db, 'trainees', trainee.id), {
        issuedKitItems:   updatedIssuedItems,
        lastKitIssueDate: issueDateISO,
      });

      await addDoc(collection(db, 'issue_records'), {
        traineeId:        trainee.id,
        traineeName:      trainee.name,
        chestNo:          trainee.chestNo,
        platoon:          trainee.platoon ?? '',
        issueType:        'TRAINING_ESSENTIALS',
        issueSource:      'TRAINING_ESSENTIALS',
        issuedItems:      newIssuedItems,
        totalItemsIssued: cartItems.length,
        totalUnits,
        totalValue,
        issuedBy,
        batchId:          activeBatch?.id ?? '',
        issuedAt:         serverTimestamp(),
        issueDateISO,
      });

      setSuccessMsg(
        `✓ ${cartItems.length} item(s) ${trainee.name} (${trainee.chestNo}) ko issue ho gaye.`
      );
      setCartItems([]);
      setItemSearchText('');
      await fetchItems();

    } catch (err) {
      console.error('Issue error:', err);
      setErrorMsg('Issue karne mein error. Please retry karein.');
    } finally {
      setIssueLoading(false);
    }
  };

  // ── COMPUTED ──
  const issuedCount = trainee
    ? kitStatusItems.filter(item =>
        trainee.issuedKitItems?.some(
          i => normalizeName(i.itemName) === normalizeName(item.itemName)
        )
      ).length
    : 0;

  const pendingCount        = kitStatusItems.length - issuedCount;
  const cartHasSizeErr      = Object.keys(sizeErrors).length > 0;
  const cartTotalValue      = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cartTotalUnits      = cartItems.reduce((s, i) => s + i.quantity, 0);
  const totalAvailableUnits = allItems.reduce((s, i) => s + i.currentStock, 0);

  // ✅ MERGED ISSUED ITEMS
  const mergedIssuedItems = trainee?.issuedKitItems 
    ? mergeIssuedItems(trainee.issuedKitItems) 
    : [];

  // ── RENDER ──
  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
            Training Essentials Issue
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1 text-green-600">
              <UserCheck size={11} /> Issue to Trainee Profile
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 text-blue-600">
              <Package size={11} /> Stock = Purchased − Already Issued
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModuleReportButton module="inventory" stats={[{ label: 'Stock Items', value: allItems.length }, { label: 'Purchased Units', value: allItems.reduce((s, i) => s + i.totalPurchased, 0) }, { label: 'Issued Units', value: allItems.reduce((s, i) => s + i.totalIssued, 0) }, { label: 'Available Units', value: totalAvailableUnits }, { label: 'Low Stock', value: kitStatusItems.filter(i => i.currentStock <= i.minStockAlert).length }, ...(trainee ? [{ label: 'Selected Chest', value: trainee.chestNo }] : [])]} rows={[...allItems.map(i => ({ item: i.itemName, quantity: i.currentStock, unitPrice: i.unitPrice, amount: i.unitPrice * i.totalPurchased, status: `Purchased ${i.totalPurchased} · Issued ${i.totalIssued} · Available ${i.currentStock}`, detail: i.category })), ...(trainee?.issuedKitItems || []).map(i => ({ item: `ISSUE · ${i.itemName}`, quantity: i.quantity, amount: '—', status: `Chest ${trainee.chestNo}`, detail: `${i.assignedSize || 'N/A'} · ${i.issueDate ? new Date(i.issueDate).toLocaleDateString('en-IN') : ''}` }))]} />
          <button 
          onClick={fetchItems} 
          disabled={itemsLoading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded"
        >
          <RefreshCw size={12} className={itemsLoading ? 'animate-spin' : ''} />
          Refresh Stock
        </button>
        </div>
      </div>

      {/* STOCK SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { 
            label: 'Total Items', 
            value: allItems.filter(i => normalizeName(i.itemName) !== 'other').length, 
            color: 'text-slate-800',  
            border: 'border-l-slate-500',  
            sub: 'Training Essentials' 
          },
          { 
            label: 'In Stock', 
            value: allItems.filter(i => i.currentStock > 0).length, 
            color: 'text-green-700',  
            border: 'border-l-green-500',  
            sub: 'Searchable' 
          },
          { 
            label: 'Sized Items', 
            value: allItems.filter(i => i.sizeRequired).length, 
            color: 'text-blue-600',   
            border: 'border-l-blue-500',   
            sub: 'Shoes / T-Shirt etc' 
          },
          { 
            label: 'Low Stock', 
            value: allItems.filter(
              i => i.currentStock > 0 && i.currentStock <= i.minStockAlert
            ).length, 
            color: 'text-amber-600', 
            border: 'border-l-amber-500', 
            sub: 'Need attention' 
          },
          { 
            label: 'Total Units', 
            value: totalAvailableUnits, 
            color: 'text-purple-700', 
            border: 'border-l-purple-500', 
            sub: 'Live available' 
          },
        ].map(({ label, value, color, border, sub }) => (
          <div key={label} 
            className={`bg-white border border-slate-200 border-l-4 ${border} p-3 rounded shadow-sm`}>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
            <p className={`text-xl font-black mt-0.5 ${color}`}>{value}</p>
            <p className="text-[9px] text-slate-300 font-semibold">{sub}</p>
          </div>
        ))}
      </div>

      {/* INFO BANNER */}
      <div className="bg-blue-50 border border-blue-200 rounded px-4 py-2.5 flex items-center gap-3">
        <Info size={16} className="text-blue-600 flex-shrink-0" />
        <div>
          <p className="text-xs font-black text-blue-800">Manual Recovery Only</p>
          <p className="text-[10px] text-blue-600">
            Is screen se item issue karne par{' '}
            <strong>koi recovery auto-create nahi hogi</strong>.
            Recovery sirf tab banegi jab aap manually Recovery section se create karenge.
          </p>
        </div>
      </div>

      {/* ALERTS */}
      {successMsg && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded text-sm font-semibold flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-green-600" />
          <span>{successMsg}</span>
          <button 
            onClick={() => setSuccessMsg('')} 
            className="ml-auto text-green-400 hover:text-green-600"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded text-sm font-semibold flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
          <button 
            onClick={() => setErrorMsg('')} 
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="col-span-1 space-y-4 lg:sticky lg:top-4">

          {/* Search */}
          <div className="bg-white border border-slate-300 shadow-sm p-4 rounded">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1.5">
              Search by Chest Number
            </label>
            <div className="flex">
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full text-sm font-mono font-bold px-3 py-2 border border-slate-300 border-r-0 focus:outline-none focus:border-slate-700 rounded-l"
                placeholder="e.g. 1001" 
              />
              <button 
                onClick={handleSearch} 
                disabled={searchLoading || !searchQuery.trim()}
                className="bg-slate-800 text-white px-4 border border-slate-800 hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center rounded-r"
              >
                {searchLoading
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Search size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
              <Info size={9} /> Press Enter or click Search
            </p>
          </div>

          {trainee ? (
            <>
              <TraineeProfileCard trainee={trainee} />

              {/* Kit Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Kit Items', value: kitStatusItems.length, color: 'text-slate-700' },
                  { label: 'Received',  value: issuedCount,           color: 'text-green-600' },
                  { label: 'Pending',   value: pendingCount,          color: 'text-red-500'   },
                ].map(({ label, value, color }) => (
                  <div key={label} 
                    className="bg-white border border-slate-200 p-2 text-center rounded shadow-sm">
                    <p className={`text-lg font-black ${color}`}>{value}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">{label}</p>
                  </div>
                ))}
              </div>

              {/* ✅ FPT Results Panel — Collapsible */}
              <FPTResultsPanel 
                records={fptRecords} 
                loading={fptLoading} 
              />

              {/* ✅ Weekly Test Results Panel — Collapsible */}
              <WeeklyTestResultsPanel 
                records={weeklyTestRecords} 
                loading={weeklyTestLoading} 
              />

              {/* Kit Status Panel */}
              <div className="bg-white border border-slate-300 shadow-sm rounded overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1">
                    <UserCheck size={11} className="text-green-600" /> 
                    Training Essentials Status
                  </p>
                  <span className="text-[9px] bg-green-100 text-green-600 font-bold px-1.5 py-0.5 rounded">
                    Mila / Nahi Mila
                  </span>
                </div>
                <KitStatusPanel
                  trainee={trainee}
                  allItems={kitStatusItems}
                  selectedItems={cartItems}
                />
              </div>
            </>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 p-10 text-center rounded">
              <User size={40} className="mx-auto text-slate-200 mb-3" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                No Trainee Selected
              </p>
              <p className="text-[10px] text-slate-300 mt-1">
                Enter Chest Number and search
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="col-span-2 space-y-4">

          {/* ITEM SEARCH */}
          <div className="bg-white border border-slate-300 shadow-sm p-4 rounded">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                Search & Add Training Essentials Items
              </label>
              <span className="text-[9px] bg-blue-100 text-blue-700 font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 border border-blue-200">
                <Package size={9} /> Assets Excluded
              </span>
            </div>

            <div className="mb-2 bg-blue-50 border border-blue-200 rounded px-2 py-1.5 flex items-center gap-2">
              <Info size={11} className="text-blue-500 flex-shrink-0" />
              <p className="text-[10px] text-blue-700 font-semibold">
                Same item <strong>multiple times</strong> issue ho sakta hai. Assets exclude hain.
              </p>
            </div>

            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  ref={itemSearchRef} 
                  type="text" 
                  value={itemSearchText}
                  onChange={e => { setItemSearchText(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  disabled={!trainee || itemsLoading}
                  className="w-full text-sm font-bold pl-9 pr-3 py-2 border border-slate-300 focus:outline-none focus:border-slate-700 disabled:bg-slate-50 disabled:text-slate-400 rounded"
                  placeholder={
                    itemsLoading  ? 'Items loading...'
                    : !trainee   ? 'Pehle trainee search karein...'
                    : 'Item name ya category type karein...'
                  }
                />
              </div>

              {trainee && showDropdown && itemSearchText.trim() !== '' && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-300 shadow-xl max-h-72 overflow-y-auto rounded">
                  {filteredDropdownItems.length === 0 ? (
                    <div className="p-5 text-center">
                      <XCircle size={22} className="mx-auto text-slate-200 mb-2" />
                      <p className="text-xs text-slate-400 font-bold">
                        Koi matching item nahi mila
                      </p>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        Out of stock ya asset ho sakta hai
                      </p>
                    </div>
                  ) : (
                    filteredDropdownItems.map(item => (
                      <button 
                        key={item.id} 
                        onClick={() => addToCart(item)}
                        className="w-full flex items-center justify-between px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50 text-left transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800 truncate">
                              {item.emoji} {item.itemName}
                            </span>
                            {item.sizeRequired && (
                              <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <Ruler size={8} /> SIZE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                            <span>{item.category}</span>
                            <span>₹{item.unitPrice}</span>
                            <span>
                              Purchased: {item.totalPurchased} · Issued: {item.totalIssued}
                            </span>
                          </div>
                          {item.sizeRequired && 
                           Object.keys(item.sizeStock).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(item.sizeStock)
                                .filter(([, q]) => q > 0)
                                .slice(0, 6)
                                .map(([size, qty]) => (
                                  <span key={size} 
                                    className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                                    {size}: {qty}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            getStockColor(item.currentStock, item.minStockAlert)
                          }`}>
                            Stock: {item.currentStock}
                          </span>
                          <div className="bg-slate-800 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus size={12} />
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {trainee && (
              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                <Info size={9} />
                {allItems.filter(i => i.currentStock > 0).length} items available ·
                Assets excluded · No auto recovery
              </p>
            )}
          </div>

          {/* CART PANEL */}
          <div className="bg-white border border-slate-300 shadow-sm rounded overflow-hidden flex flex-col min-h-[400px]">
            <div className="bg-slate-100 px-4 py-2.5 flex justify-between items-center border-b border-slate-300">
              <div className="flex items-center gap-2">
                <ShoppingCart size={15} className="text-slate-700" />
                <span className="text-xs font-black uppercase text-slate-900">Issue Cart</span>
                {cartItems.length > 0 && (
                  <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {cartItems.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cartItems.length > 0 && (
                  <button 
                    onClick={() => { setCartItems([]); setSizeErrors({}); }}
                    className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase border border-red-200 px-2 py-1 hover:bg-red-50 rounded"
                  >
                    Clear All
                  </button>
                )}
                <button 
                  onClick={handleIssue}
                  disabled={!trainee || cartItems.length === 0 || issueLoading}
                  className="bg-slate-800 text-white px-5 py-1.5 text-[11px] font-black uppercase hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 rounded"
                >
                  {issueLoading
                    ? <><Loader2 size={13} className="animate-spin" /> Issuing...</>
                    : <><Save size={13} /> Confirm Issue</>
                  }
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-slate-300">
                  <ShoppingCart size={52} className="mb-3 opacity-30" />
                  <p className="text-sm font-black uppercase tracking-wider text-slate-400">
                    Cart Empty
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    {trainee ? 'Search items above' : 'Select a trainee first'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map(item => {
                    const liveItem = getLiveItem(item.originalId);
                    const maxQty   = getMaxQtyForItem(item);
                    return (
                      <div key={item.cartKey}
                        className={`bg-white border shadow-sm p-3 rounded transition-colors ${
                          sizeErrors[item.cartKey] 
                            ? 'border-red-300 bg-red-50/50' 
                            : 'border-slate-200'
                        }`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-slate-800">
                                {item.emoji} {item.itemName}
                              </span>
                              <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                {item.category}
                              </span>
                              {item.sizeRequired && (
                                <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <Ruler size={8} /> Size Req.
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                              <span>₹{item.unitPrice}</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded ${
                                getStockColor(
                                  liveItem?.currentStock ?? item.currentStock,
                                  item.minStockAlert
                                )
                              }`}>
                                Stock: {liveItem?.currentStock ?? item.currentStock}
                              </span>
                            </div>
                          </div>

                          {/* QTY */}
                          <div className="flex flex-col items-center flex-shrink-0">
                            <label className="text-[9px] font-bold text-slate-500 uppercase mb-1">
                              Qty
                            </label>
                            <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                              <button 
                                onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                                className="w-7 h-7 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold"
                              >−</button>
                              <input 
                                type="number" 
                                min={1} 
                                max={Math.max(1, maxQty)} 
                                value={item.quantity}
                                onChange={e => updateQuantity(
                                  item.cartKey, parseInt(e.target.value) || 1
                                )}
                                className="w-10 h-7 text-center text-xs font-black border-x border-slate-300 focus:outline-none" 
                              />
                              <button 
                                onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                                className="w-7 h-7 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold"
                              >+</button>
                            </div>
                            <span className="text-[9px] text-slate-400 mt-0.5">
                              Max: {Math.max(1, maxQty)}
                            </span>
                          </div>

                          {/* SIZE */}
                          {item.sizeRequired && (
                            <div className="flex flex-col flex-shrink-0">
                              <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                <Ruler size={9} /> Size *
                              </label>
                              <select
                                value={item.assignedSize === 'N/A' ? '' : item.assignedSize}
                                onChange={e => updateSize(item.cartKey, e.target.value)}
                                className={`w-28 text-xs font-bold border px-2 py-1.5 focus:outline-none focus:border-slate-700 rounded ${
                                  sizeErrors[item.cartKey]
                                    ? 'border-red-400 bg-red-50 text-red-700'
                                    : 'border-slate-300'
                                }`}
                              >
                                <option value="">Select</option>
                                {(liveItem?.sizeOptions ?? item.sizeOptions).map(size => {
                                  const qty = liveItem?.sizeStock?.[size] ?? 0;
                                  return (
                                    <option 
                                      key={size} 
                                      value={size} 
                                      disabled={qty <= 0}
                                    >
                                      {size} ({qty})
                                    </option>
                                  );
                                })}
                              </select>
                              {sizeErrors[item.cartKey] && (
                                <span className="text-[9px] text-red-500 mt-0.5 font-bold">
                                  Required!
                                </span>
                              )}
                            </div>
                          )}

                          <button 
                            onClick={() => removeFromCart(item.cartKey)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded self-start"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">
                            ₹{item.unitPrice} × {item.quantity} units
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            = ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="border-t border-slate-200 bg-white px-4 py-3">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500">
                    <span className="font-bold">{cartItems.length}</span> item(s) ·
                    <span className="font-bold ml-1">{cartTotalUnits}</span> units
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Value</p>
                    <p className="text-lg font-black text-slate-900">
                      ₹{cartTotalValue.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                {cartHasSizeErr ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 font-bold bg-red-50 border border-red-200 px-3 py-1.5 rounded">
                    <AlertTriangle size={11} /> 
                    Size required fields fill karein before issuing
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-600 font-bold bg-green-50 border border-green-200 px-3 py-1.5 rounded">
                    <CheckCircle2 size={11} /> 
                    Ready · Trainee profile update hoga · Recovery auto-create nahi hogi
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ✅ PREVIOUSLY ISSUED ITEMS — MERGED & GROUPED */}
          {trainee?.issuedKitItems && trainee.issuedKitItems.length > 0 && (
            <div className="bg-white border border-slate-200 shadow-sm rounded overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-slate-500" />
                  <span className="text-[11px] font-black uppercase text-slate-600">
                    Previously Issued Items
                  </span>
                  <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                    {mergedIssuedItems.length} unique · {trainee.issuedKitItems.length} total entries
                  </span>
                </div>
                {trainee.lastKitIssueDate && (
                  <span className="text-[10px] text-slate-400">
                    Last: {formatDate(trainee.lastKitIssueDate)}
                  </span>
                )}
              </div>

              {/* Column Headers */}
              <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-slate-100 border-b border-slate-200 text-[9px] font-black uppercase text-slate-500">
                <div className="col-span-4">Item</div>
                <div className="col-span-2 text-center">Size</div>
                <div className="col-span-2 text-center">Total Qty</div>
                <div className="col-span-2 text-center">Times</div>
                <div className="col-span-2">Last Issue</div>
              </div>

              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {mergedIssuedItems.map((item, idx) => {
                  const key = `${normalizeName(item.itemName)}_${normalizeName(item.assignedSize)}`;
                  const isExpanded = expandedIssuedItem === key;

                  return (
                    <div key={`${key}_${idx}`}>
                      {/* Main merged row */}
                      <div 
                        className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center transition-colors ${
                          item.issueCount > 1 
                            ? 'hover:bg-blue-50 cursor-pointer' 
                            : 'hover:bg-slate-50'
                        }`}
                        onClick={() => {
                          if (item.issueCount > 1) {
                            setExpandedIssuedItem(isExpanded ? null : key);
                          }
                        }}
                      >
                        <div className="col-span-4 flex items-center gap-1.5">
                          <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">
                            {item.itemName}
                          </span>
                          {item.issueCount > 1 && (
                            isExpanded 
                              ? <ChevronUp size={11} className="text-slate-400 flex-shrink-0" />
                              : <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            {item.assignedSize && item.assignedSize !== 'N/A' 
                              ? item.assignedSize 
                              : '—'}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            item.totalQuantity > 1 
                              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                              : 'text-slate-600'
                          }`}>
                            {item.totalQuantity}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          {item.issueCount > 1 ? (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                              {item.issueCount}× issued
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">1× issued</span>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-400">
                            {formatDate(item.lastIssueDate)}
                          </span>
                        </div>
                      </div>

                      {/* ✅ Expanded: Individual issue entries */}
                      {isExpanded && item.issueCount > 1 && (
                        <div className="bg-blue-50/50 border-t border-blue-100 px-6 py-2 space-y-1.5">
                          <p className="text-[9px] font-black uppercase text-blue-600 mb-1 flex items-center gap-1">
                            <FileText size={9} /> Issue History ({item.issueCount} entries)
                          </p>
                          {item.entries.map((entry, eIdx) => (
                            <div key={eIdx}
                              className="grid grid-cols-12 gap-2 items-center text-[10px] bg-white border border-blue-100 rounded px-3 py-1.5">
                              <div className="col-span-1 text-slate-400 font-bold">
                                #{eIdx + 1}
                              </div>
                              <div className="col-span-3 font-semibold text-slate-600">
                                Qty: {entry.quantity ?? 1}
                              </div>
                              <div className="col-span-2 text-center font-mono text-slate-500">
                                {entry.assignedSize && entry.assignedSize !== 'N/A' 
                                  ? entry.assignedSize 
                                  : '—'}
                              </div>
                              <div className="col-span-3 text-slate-400">
                                {entry.issueDate ? formatDate(entry.issueDate) : '—'}
                              </div>
                              <div className="col-span-3 text-slate-400 truncate">
                                {entry.issuedBy ?? '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary footer */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  {mergedIssuedItems.length} unique items · {trainee.issuedKitItems.length} total issues
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  Total units: {mergedIssuedItems.reduce((s, i) => s + i.totalQuantity, 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryIssueScreen;