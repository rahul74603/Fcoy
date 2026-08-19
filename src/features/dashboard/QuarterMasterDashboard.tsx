// D:\ALL PROJECTS\BSF COYs\frontend\src\features\dashboard\QuarterMasterDashboard.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, RefreshCw, ChevronRight, AlertTriangle, CheckCircle2,
  Wallet, ArrowUpRight, ArrowDownRight,
  Users, BoxSelect, Building2, UserCheck,
  CreditCard, Clock, Zap,
  ArrowRightLeft,
  BarChart3, Info
} from 'lucide-react';
import {
  collection, getDocs
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { showDoc } from '../../utils/devDataFilter';
import { onAuthStateChanged } from 'firebase/auth';
import { ReportButton } from '../../components/common/ReportButton';
import { useBatch } from '../../contexts/BatchContext';
import { useAuth } from '../../contexts/AuthContext';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface FundSummary {
  key: string;
  label: string;
  emoji: string;
  color: string;
  borderColor: string;
  bgColor: string;
  totalCollection: number;
  totalOrders: number;
  actuallyPaid: number;
  balance: number;
  vendorDue: number;
  transferredOut: number;
  entries: number;
  pendingBills: number;
}

interface VendorDueSummary {
  vendorId: string;
  vendorName: string;
  phone: string;
  categoryLabel: string;
  totalDue: number;
  entries: number;
}

interface StockAlert {
  itemName: string;
  emoji: string;
  currentStock: number;
  totalPurchased: number;
  totalIssued: number;
  category: string;
}

interface SalarySnapshot {
  totalRecords: number;
  totalPaid: number;
  latestMonth: string;
  totalBoys: number;
}

interface RecoverySnapshot {
  totalExpected: number;
  totalPaid: number;
  totalDue: number;
  pendingCount: number;
  paidCount: number;
}

interface TransferSnapshot {
  totalTransferred: number;
  count: number;
  latest: { from: string; to: string; amount: number; date: string } | null;
}

interface RecentActivity {
  id: string;
  type: 'collection' | 'expense' | 'transfer' | 'salary' | 'issue';
  label: string;
  amount: number;
  fund: string;
  date: string;
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────
const ROUTES = {
  dashboard: '/quartermaster',
  trainees: '/profile',
  stock: '/stock',
  issueKit: '/issue-kit',
  messFund: '/mess-fund',
  trainingFund: '/training-fund',
  companyAssets: '/company-assets-fund',
  generalFund: '/general-fund',
    fundsDashboard: '/funds',
  vendorPayments: '/vendor-payments',
  messBoySalary: '/mess-boy-salary',
  bills: '/vendor-payments',
  reports: '/reports',
} as const;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const fmtShort = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : '—';

const calcActuallyPaid = (expList: any[]): number =>
  expList.reduce((s, e) => {
    if (e.vendorId) return s + Number(e.paidAmount ?? 0);
    return s + Number(e.amount ?? 0);
  }, 0);

const calcVendorDue = (expList: any[]): number =>
  expList.reduce((s, e) => s + Number(e.dueAmount ?? 0), 0);

const normalizeName = (v: string) => (v || '').trim().toLowerCase();

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
);

const CardSkeleton = () => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse space-y-3">
    <Skeleton className="h-3 w-2/3" />
    <Skeleton className="h-7 w-1/2" />
    <Skeleton className="h-3 w-1/3" />
  </div>
);

// ═════════════════════════════════════════════
// MAIN DASHBOARD
// ═════════════════════════════════════════════
export const QuarterMasterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const go = (route: string) => navigate(route);
  const { user } = useAuth();
  const { currentBatch: activeBatch } = useBatch(); // ⛓️ STRICT: selected batch follow
  const belongsToBatch = (data: any) => data.batchId ? data.batchId === activeBatch?.id : activeBatch?.status === 'active';

  // ── STATE ──
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Data
  const [funds, setFunds] = useState<FundSummary[]>([]);
  const [vendorDues, setVendorDues] = useState<VendorDueSummary[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [salary, setSalary] = useState<SalarySnapshot>({ totalRecords: 0, totalPaid: 0, latestMonth: '', totalBoys: 0 });
  const [recovery, setRecovery] = useState<RecoverySnapshot>({ totalExpected: 0, totalPaid: 0, totalDue: 0, pendingCount: 0, paidCount: 0 });
  const [transfers, setTransfers] = useState<TransferSnapshot>({ totalTransferred: 0, count: 0, latest: null });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [traineeCount, setTraineeCount] = useState(0);
  const [totalIssueRecords, setTotalIssueRecords] = useState(0);
  const [kitDoneCount, setKitDoneCount] = useState(0);      // kitne trainees ko kit mil chuki
  const [todayIssueCount, setTodayIssueCount] = useState(0); // aaj kitne issue hue

  // Computed
  const grandCollection = funds.reduce((s, f) => s + f.totalCollection, 0);
  const grandOrders = funds.reduce((s, f) => s + f.totalOrders, 0);
  const grandActuallyPaid = funds.reduce((s, f) => s + f.actuallyPaid, 0);
  const grandBalance = funds.reduce((s, f) => s + f.balance, 0);
  const totalVendorDue = vendorDues.reduce((s, v) => s + v.totalDue, 0);
  const totalPendingBills = funds.reduce((s, f) => s + f.pendingBills, 0);

  // ── AUTH ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthReady(!!u);
      if (!u) setError('Session expired. Please login again.');
    });
    return () => unsub();
  }, []);

  // ── FETCH ALL DATA ──
  const fetchAllData = useCallback(async () => {
    if (!authReady) return;
    setLoading(true);
    setError('');

    try {
      // ── TRANSFERS ──
      const transferSnap = await getDocs(collection(db, 'fund_transfers'));
      const transferList: any[] = [];
        transferSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data)) return;
        transferList.push({
          id: d.id,
          fromFundKey: data.fromFundKey ?? '',
          fromFundLabel: data.fromFundLabel ?? '',
          toFundKey: data.toFundKey ?? '',
          toFundLabel: data.toFundLabel ?? '',
          amount: Number(data.amount ?? 0),
          date: data.date ?? '',
        });
      });

      const getTransferredOut = (fundKey: string) =>
        transferList.filter(t => t.fromFundKey === fundKey)
          .reduce((s, t) => s + t.amount, 0);

      const totalTransferred = transferList.reduce((s, t) => s + t.amount, 0);
      const latestTransfer = transferList.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0] ?? null;

      setTransfers({
        totalTransferred,
        count: transferList.length,
        latest: latestTransfer ? {
          from: latestTransfer.fromFundLabel,
          to: latestTransfer.toFundLabel,
          amount: latestTransfer.amount,
          date: latestTransfer.date,
        } : null,
      });

      // ── HELPER: Build fund summary ──
      const buildFund = async (
        key: string, label: string, emoji: string,
        color: string, borderColor: string, bgColor: string,
        colName: string, expName: string,
        includeTransferOut: boolean = true,
      ): Promise<FundSummary> => {
        const [colSnap, expSnap] = await Promise.all([
          getDocs(collection(db, colName)),
          getDocs(collection(db, expName)),
        ]);

        let totalCollection = 0;
        const expList: any[] = [];
        let entries = 0;
        let pendingBills = 0;

        colSnap.forEach(d => {
          if (!belongsToBatch(d.data())) return;
          totalCollection += Number(d.data().amount ?? 0);
          entries++;
        });

        expSnap.forEach(d => {
          const data = d.data();
          if (!belongsToBatch(data)) return;
          entries++;
          if ((data.billStatus ?? '') === 'Pending') pendingBills++;
          expList.push({
            amount: Number(data.amount ?? 0),
            vendorId: data.vendorId ?? data.linkedVendorId ?? '',
            paidAmount: Number(data.paidAmount ?? 0),
            dueAmount: Number(data.dueAmount ?? 0),
          });
        });

        const totalOrders = expList.reduce((s, e) => s + e.amount, 0);
        const actuallyPaid = calcActuallyPaid(expList);
        const vendorDue = calcVendorDue(expList);
        const transferredOut = includeTransferOut ? getTransferredOut(key) : 0;
        const balance = totalCollection - actuallyPaid - transferredOut;

        return {
          key, label, emoji, color, borderColor, bgColor,
          totalCollection, totalOrders, actuallyPaid,
          balance, vendorDue, transferredOut, entries, pendingBills,
        };
      };

      // ── BUILD ALL 4 FUNDS ──
      const [messFund, trainingFund, assetsFund, generalFund] = await Promise.all([
        buildFund('mess_fund', 'Mess Fund', '🍽️', 'bg-orange-600', 'border-orange-500', 'bg-orange-50',
          'mess_fund_collections', 'mess_fund_expenses'),
        buildFund('training_fund', 'Training Fund', '🎓', 'bg-blue-700', 'border-blue-500', 'bg-blue-50',
          'training_fund_collections', 'training_fund_expenses'),
        buildFund('company_assets_fund', 'Company Assets', '🏛️', 'bg-green-700', 'border-green-600', 'bg-green-50',
          'company_assets_collections', 'company_assets_expenses'),
        buildFund('general_fund', 'General Fund', '💰', 'bg-slate-800', 'border-slate-700', 'bg-slate-50',
          'general_fund_collections', 'general_fund_expenses', false),
      ]);

      setFunds([messFund, trainingFund, assetsFund, generalFund]);

      // ── VENDOR DUES ──
      const [vendorSnap, veSnap] = await Promise.all([
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'vendor_entries')),
      ]);

      const vendorMap: Record<string, { name: string; phone: string; categoryLabel: string }> = {};
      vendorSnap.forEach(d => {
        const data = d.data();
        if (data.isActive !== false) {
          vendorMap[d.id] = {
            name: data.name ?? '',
            phone: data.phone ?? '',
            categoryLabel: data.categoryLabel ?? '',
          };
        }
      });

      const vDueMap: Record<string, VendorDueSummary> = {};
      veSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data)) return;
        const due = Number(data.dueAmount ?? 0);
        if (due <= 0) return;
        const vId = data.vendorId ?? '';
        if (!vDueMap[vId]) {
          vDueMap[vId] = {
            vendorId: vId,
            vendorName: vendorMap[vId]?.name ?? data.vendorName ?? '',
            phone: vendorMap[vId]?.phone ?? '',
            categoryLabel: vendorMap[vId]?.categoryLabel ?? data.categoryLabel ?? '',
            totalDue: 0,
            entries: 0,
          };
        }
        vDueMap[vId].totalDue += due;
        vDueMap[vId].entries += 1;
      });

      setVendorDues(Object.values(vDueMap).sort((a, b) => b.totalDue - a.totalDue));

      // ── TRAINEES + KIT COVERAGE ──
      const tSnap = await getDocs(collection(db, 'trainees'));
      const batchTrainees = tSnap.docs.filter(d => belongsToBatch(d.data()) && showDoc(d.data()));
      setTraineeCount(batchTrainees.length);
      setKitDoneCount(batchTrainees.filter(d => {
        const data: any = d.data();
        return Array.isArray(data.issuedKitItems) && data.issuedKitItems.length > 0;
      }).length);

      // ── ISSUE RECORDS ──
      const issueSnap = await getDocs(collection(db, 'issue_records'));
      const batchIssues = issueSnap.docs.filter(d => belongsToBatch(d.data()));
      setTotalIssueRecords(batchIssues.length);
      const todayISO = new Date().toISOString().split('T')[0];
      setTodayIssueCount(batchIssues.filter(d => {
        const data: any = d.data();
        return String(data.issueDateISO ?? '').startsWith(todayISO);
      }).length);

      // ── TRAINING STOCK ALERTS ──
      // Build purchased vs issued for training items
      const trainingExpSnap = await getDocs(collection(db, 'training_fund_expenses'));
      const purchasedMap: Record<string, { qty: number; name: string; emoji: string; category: string }> = {};

      const TRAINING_ITEMS_META: Record<string, { emoji: string; category: string }> = {
        'dm shoes': { emoji: '👞', category: 'Footwear' },
        'pt shoes': { emoji: '👟', category: 'Footwear' },
        'ankle shoes': { emoji: '🥾', category: 'Footwear' },
        'pt t-shirt': { emoji: '👕', category: 'Uniform' },
        'ground sheet': { emoji: '🛏️', category: 'Bedding' },
        'plate': { emoji: '🍽️', category: 'Mess Item' },
        'glass': { emoji: '🥤', category: 'Mess Item' },
        'bucket': { emoji: '🪣', category: 'Equipment' },
        'mug': { emoji: '☕', category: 'Mess Item' },
        'mess tin': { emoji: '🥫', category: 'Mess Item' },
        'mosquito net': { emoji: '🦟', category: 'Bedding' },
        'water bottle': { emoji: '💧', category: 'Equipment' },
        'towel': { emoji: '🧻', category: 'Equipment' },
        'lock': { emoji: '🔒', category: 'Equipment' },
      };

      trainingExpSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data)) return;
        const name = String(data.itemName ?? '').trim();
        if (!name) return;
        const key = normalizeName(name);
        const meta = TRAINING_ITEMS_META[key];
        if (!purchasedMap[key]) {
          purchasedMap[key] = {
            qty: 0,
            name,
            emoji: meta?.emoji ?? '📦',
            category: meta?.category ?? 'Other',
          };
        }
        purchasedMap[key].qty += Number(data.quantity ?? 0);
      });

      const issuedItemMap: Record<string, number> = {};
      issueSnap.forEach(d => {
        const data = d.data() as any;
        const isTraining = data.issueSource === 'TRAINING_ESSENTIALS' || data.issueType === 'TRAINING_ESSENTIALS';
        if (!isTraining) return;
        const items = Array.isArray(data.issuedItems) ? data.issuedItems : Array.isArray(data.items) ? data.items : [];
        items.forEach((item: any) => {
          const key = normalizeName(item.itemName ?? '');
          if (!key) return;
          issuedItemMap[key] = (issuedItemMap[key] || 0) + Number(item.quantity ?? 1);
        });
      });

      const alerts: StockAlert[] = [];
      Object.entries(purchasedMap).forEach(([key, p]) => {
        const issued = issuedItemMap[key] || 0;
        const current = Math.max(0, p.qty - issued);
        if (current <= 5) {
          alerts.push({
            itemName: p.name,
            emoji: p.emoji,
            currentStock: current,
            totalPurchased: p.qty,
            totalIssued: issued,
            category: p.category,
          });
        }
      });
      alerts.sort((a, b) => a.currentStock - b.currentStock);
      setStockAlerts(alerts);

      // ── SALARY ──
      const salarySnap = await getDocs(collection(db, 'mess_boy_salaries'));
      let salaryTotal = 0;
      let salaryLatest = '';
      let salaryBoys = 0;
      salarySnap.forEach(d => {
        const data = d.data();
        salaryTotal += Number(data.totalSalary ?? 0);
        if (!salaryLatest || (data.month ?? '') > salaryLatest) {
          salaryLatest = data.monthName ?? data.month ?? '';
          salaryBoys = Number(data.totalBoys ?? 0);
        }
      });
      setSalary({
        totalRecords: salarySnap.size,
        totalPaid: salaryTotal,
        latestMonth: salaryLatest,
        totalBoys: salaryBoys,
      });

      // ── RECOVERY ──
      const recSnap = await getDocs(collection(db, 'training_fund_recoveries'));
      let recExpected = 0, recPaid = 0, recPending = 0, recPaidCount = 0;
      recSnap.forEach(d => {
        const data = d.data();
        if (!belongsToBatch(data)) return;
        recExpected += Number(data.expectedAmount ?? 0);
        recPaid += Number(data.paidAmount ?? 0);
        if (data.status === 'Paid') recPaidCount++;
        else recPending++;
      });
      setRecovery({
        totalExpected: recExpected,
        totalPaid: recPaid,
        totalDue: Math.max(0, recExpected - recPaid),
        pendingCount: recPending,
        paidCount: recPaidCount,
      });

      // ── RECENT ACTIVITY ──
      const activities: RecentActivity[] = [];
      const addActivities = (snap: any, type: RecentActivity['type'], fund: string, labelField: string, prefix: string) => {
        snap.forEach((d: any) => {
          const data = d.data();
          activities.push({
            id: d.id,
            type,
            label: `${prefix}: ${data[labelField] ?? data.remarks ?? data.label ?? 'Entry'}`,
            amount: Number(data.amount ?? data.totalSalary ?? 0),
            fund,
            date: data.date ?? data.paidDate ?? '',
          });
        });
      };

      // Add from each fund's collections & expenses
      const mcSnap = await getDocs(collection(db, 'mess_fund_collections'));
      addActivities(mcSnap, 'collection', '🍽️ Mess', 'monthLabel', 'Mess Cutting');

      const meSnap = await getDocs(collection(db, 'mess_fund_expenses'));
      addActivities(meSnap, 'expense', '🍽️ Mess', 'categoryLabel', 'Mess Expense');

      const gcSnap = await getDocs(collection(db, 'general_fund_collections'));
      addActivities(gcSnap, 'collection', '💰 General', 'label', 'General Collection');

      const geSnap = await getDocs(collection(db, 'general_fund_expenses'));
      addActivities(geSnap, 'expense', '💰 General', 'categoryLabel', 'General Expense');

      transferList.forEach(t => {
        activities.push({
          id: t.id,
          type: 'transfer',
          label: `Transfer: ${t.fromFundLabel} → ${t.toFundLabel}`,
          amount: t.amount,
          fund: '🔄 Transfer',
          date: t.date,
        });
      });

      salarySnap.forEach(d => {
        const data = d.data();
        activities.push({
          id: d.id,
          type: 'salary',
          label: `Salary: ${data.monthName ?? ''} · ${data.totalBoys ?? 0} boys`,
          amount: Number(data.totalSalary ?? 0),
          fund: `💰 ${data.fundLabel ?? 'Fund'}`,
          date: data.paidDate ?? data.date ?? '',
        });
      });

      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentActivity(activities.slice(0, 15));

      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      setError('Data load failed. Refresh karo.');
    } finally {
      setLoading(false);
    }
  }, [authReady, activeBatch?.id]);

  useEffect(() => {
    if (authReady) fetchAllData();
  }, [authReady, fetchAllData]);

  const recoveryPct = recovery.totalExpected > 0
    ? Math.round((recovery.totalPaid / recovery.totalExpected) * 100) : 0;

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">

      {/* ══════════ HEADER ══════════ */}
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
              {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'}, {user?.name || 'Quarter Master'}
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              QM Command Center · {activeBatch ? `${activeBatch.batchNumber} — ${activeBatch.batchName}` : 'No Active Batch'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full animate-pulse ${authReady ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-[10px] text-slate-400 hidden sm:block">
            {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={fetchAllData} disabled={loading || !authReady}
            className="flex items-center gap-1.5 bg-slate-800 text-white px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg hover:bg-slate-700 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        <ReportButton />
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {/* ══════════ GRAND TOTALS — 6 CARDS ══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {loading ? Array(6).fill(0).map((_, i) => <CardSkeleton key={i} />) : (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => go(ROUTES.fundsDashboard)}>
              <p className="text-[9px] font-black text-green-500 uppercase mb-1">Grand Collection</p>
              <p className="text-xl font-black text-green-700">{fmtShort(grandCollection)}</p>
              <p className="text-[9px] text-green-600 mt-0.5">All 4 funds combined</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => go(ROUTES.fundsDashboard)}>
              <p className="text-[9px] font-black text-orange-500 uppercase mb-1">Total Orders</p>
              <p className="text-xl font-black text-orange-700">{fmtShort(grandOrders)}</p>
              <p className="text-[9px] text-orange-600 mt-0.5">Saman ka total</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => go(ROUTES.fundsDashboard)}>
              <p className="text-[9px] font-black text-red-500 uppercase mb-1">Actually Paid</p>
              <p className="text-xl font-black text-red-600">{fmtShort(grandActuallyPaid)}</p>
              <p className="text-[9px] text-red-500 mt-0.5">Paisa gaya</p>
            </div>

            <div className={`rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all ${
              grandBalance >= 0 ? 'bg-white border border-slate-200' : 'bg-red-100 border border-red-300'
            }`} onClick={() => go(ROUTES.fundsDashboard)}>
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Net Balance</p>
              <p className={`text-xl font-black ${grandBalance >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
                {grandBalance < 0 ? '−' : ''}{fmtShort(Math.abs(grandBalance))}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">Cash in hand</p>
            </div>

            <div className={`rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all ${
              totalVendorDue > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
            }`} onClick={() => go(ROUTES.vendorPayments)}>
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Vendor Dues</p>
              <p className={`text-xl font-black ${totalVendorDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {fmtShort(totalVendorDue)}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">{vendorDues.length} vendors</p>
            </div>

            <div className={`rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all ${
              totalPendingBills > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'
            }`} onClick={() => go(ROUTES.bills)}>
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pending Bills</p>
              <p className={`text-xl font-black ${totalPendingBills > 0 ? 'text-amber-700' : 'text-green-600'}`}>
                {totalPendingBills}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">Bills to verify</p>
            </div>
          </>
        )}
      </div>

      {/* ══════════ NEEDS YOUR ATTENTION (HERO) ══════════ */}
      {!loading && (() => {
        type QAlert = { level: 'CRITICAL' | 'TODAY' | 'PENDING'; text: string; count: string; action: string; route: string };
        const qAlerts: QAlert[] = [];
        const negFunds = funds.filter(f => f.balance < 0);
        if (negFunds.length > 0) qAlerts.push({ level: 'CRITICAL', text: `Fund NEGATIVE balance me: ${negFunds.map(f => f.label).join(', ')}`, count: String(negFunds.length), action: 'Funds Dashboard', route: ROUTES.fundsDashboard });
        if (totalVendorDue > 0) qAlerts.push({ level: 'CRITICAL', text: `Vendor payments due — ${vendorDues.length} vendor(s) ka paisa baaki`, count: fmtShort(totalVendorDue), action: 'Pay Vendors', route: ROUTES.vendorPayments });
        const zeroStock = stockAlerts.filter(a => a.currentStock === 0);
        if (zeroStock.length > 0) qAlerts.push({ level: 'CRITICAL', text: `Items OUT OF STOCK: ${zeroStock.slice(0, 3).map(a => a.itemName).join(', ')}${zeroStock.length > 3 ? '...' : ''}`, count: String(zeroStock.length), action: 'Restock', route: ROUTES.trainingFund });
        const lowStock = stockAlerts.filter(a => a.currentStock > 0);
        if (lowStock.length > 0) qAlerts.push({ level: 'TODAY', text: `Items LOW stock me (≤5 bache) — jaldi order karo`, count: String(lowStock.length), action: 'View Stock', route: ROUTES.trainingFund });
        if (totalPendingBills > 0) qAlerts.push({ level: 'TODAY', text: 'Bills verify hone baaki hain', count: String(totalPendingBills), action: 'Verify Bills', route: ROUTES.bills });
        const kitPendingCount = Math.max(0, traineeCount - kitDoneCount);
        if (kitPendingCount > 0) qAlerts.push({ level: 'PENDING', text: 'Trainees ko abhi tak KOI kit item issue nahi hua', count: String(kitPendingCount), action: 'Issue Kit', route: ROUTES.issueKit });
        if (recovery.pendingCount > 0) qAlerts.push({ level: 'PENDING', text: `Recovery pending — ${fmtShort(recovery.totalDue)} wasooli baaki`, count: String(recovery.pendingCount), action: 'Recoveries', route: ROUTES.trainingFund });

        const style: Record<QAlert['level'], { chip: string; border: string }> = {
          CRITICAL: { chip: 'bg-red-600 text-white', border: 'border-l-red-600 bg-red-50/60' },
          TODAY: { chip: 'bg-amber-500 text-white', border: 'border-l-amber-500 bg-amber-50/60' },
          PENDING: { chip: 'bg-slate-400 text-white', border: 'border-l-slate-400 bg-slate-50' },
        };
        return (
          <div className="bg-white border-2 border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={15} className="text-amber-400" />
                <div>
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">Needs Your Attention</h2>
                  <p className="text-[9.5px] text-slate-400">Issues that require QM action</p>
                </div>
              </div>
              {qAlerts.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full">{qAlerts.length}</span>
              )}
            </div>
            {qAlerts.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                <p className="text-sm font-black text-green-700 uppercase">All Clear</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Funds, vendors, stock, bills — sab under control.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {qAlerts.map((a, i) => (
                  <div key={i} className={`px-4 py-3 border-l-4 flex items-center gap-3 flex-wrap ${style[a.level].border}`}>
                    <span className={`text-[8.5px] font-black px-2 py-0.5 uppercase flex-shrink-0 rounded ${style[a.level].chip}`}>
                      {a.level === 'TODAY' ? 'ACTION SOON' : a.level}
                    </span>
                    <span className="text-lg font-black text-slate-900 min-w-[52px] text-center flex-shrink-0">{a.count}</span>
                    <span className="text-xs font-bold text-slate-700 flex-1 min-w-[180px]">{a.text}</span>
                    <button onClick={() => go(a.route)}
                      className="bg-slate-800 text-white px-3 py-1.5 text-[9.5px] font-black uppercase rounded hover:bg-slate-700 flex items-center gap-1.5 flex-shrink-0">
                      {a.action} <ChevronRight size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════════ KIT ISSUE COVERAGE ══════════ */}
      {!loading && traineeCount > 0 && (
        <div className="bg-white border border-indigo-200 rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-all"
          onClick={() => go(ROUTES.issueKit)}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <BoxSelect size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase">Kit Issue Coverage — Active Batch</p>
                <p className="text-lg font-black text-slate-900">
                  {kitDoneCount} / {traineeCount} trainees ko kit mili
                  <span className={`ml-2 text-xs ${kitDoneCount >= traineeCount ? 'text-green-600' : 'text-amber-600'}`}>
                    ({traineeCount > 0 ? Math.round((kitDoneCount / traineeCount) * 100) : 0}%)
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xl font-black text-indigo-700">{todayIssueCount}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Issues Today</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-black ${traineeCount - kitDoneCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>{Math.max(0, traineeCount - kitDoneCount)}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Kit Pending</p>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${kitDoneCount >= traineeCount ? 'bg-green-500' : 'bg-indigo-500'}`}
              style={{ width: `${traineeCount > 0 ? (kitDoneCount / traineeCount) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* ══════════ 4 FUND CARDS ══════════ */}
      {!loading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
              <Wallet size={11} /> Fund-wise Breakdown — Click to open
            </p>
            <button onClick={() => go(ROUTES.fundsDashboard)}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 uppercase">
              Full Dashboard <ChevronRight size={10} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {funds.map(fund => {
              const fundRoute =
                fund.key === 'mess_fund' ? ROUTES.messFund :
                fund.key === 'training_fund' ? ROUTES.trainingFund :
                fund.key === 'company_assets_fund' ? ROUTES.companyAssets :
                ROUTES.generalFund;

              return (
                <div key={fund.key} onClick={() => go(fundRoute)}
                  className={`cursor-pointer bg-white border-2 ${fund.borderColor} rounded-xl shadow-sm hover:shadow-lg transition-all group overflow-hidden`}>

                  <div className={`${fund.color} text-white px-4 py-2.5 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{fund.emoji}</span>
                      <p className="text-[11px] font-black uppercase">{fund.label}</p>
                    </div>
                    <ChevronRight size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 rounded p-1.5 text-center">
                        <p className="text-[8px] text-green-500 font-bold">Collection</p>
                        <p className="text-[11px] font-black text-green-700">{fmtShort(fund.totalCollection)}</p>
                      </div>
                      <div className="bg-red-50 rounded p-1.5 text-center">
                        <p className="text-[8px] text-red-400 font-bold">Paid Out</p>
                        <p className="text-[11px] font-black text-red-600">{fmtShort(fund.actuallyPaid)}</p>
                      </div>
                    </div>

                    {fund.transferredOut > 0 && (
                      <div className="bg-purple-50 rounded p-1.5 text-center">
                        <p className="text-[8px] text-purple-500 font-bold">Transferred Out</p>
                        <p className="text-[11px] font-black text-purple-700">{fmtShort(fund.transferredOut)}</p>
                      </div>
                    )}

                    <div className={`rounded-lg p-2 flex items-center justify-between ${
                      fund.balance >= 0 ? 'bg-slate-50' : 'bg-red-100'
                    }`}>
                      <p className="text-[9px] font-bold text-slate-500">Balance</p>
                      <p className={`text-sm font-black ${fund.balance >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
                        {fund.balance < 0 ? '−' : ''}{fmtShort(Math.abs(fund.balance))}
                      </p>
                    </div>

                    {fund.vendorDue > 0 && (
                      <p className="text-[9px] font-bold text-red-500 text-center">
                        Vendor Due: {fmtShort(fund.vendorDue)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════ QUICK STATS ROW ══════════ */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

          {/* Trainees */}
          <div onClick={() => go(ROUTES.issueKit)}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center cursor-pointer hover:shadow-md transition-all">
            <Users size={20} className="mx-auto text-slate-400 mb-1" />
            <p className="text-2xl font-black text-slate-800">{traineeCount}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Trainees · {kitDoneCount} kitted</p>
          </div>

          {/* Issue Records */}
          <div onClick={() => go(ROUTES.issueKit)}
            className="bg-white border border-indigo-200 rounded-xl p-4 shadow-sm text-center cursor-pointer hover:shadow-md transition-all">
            <BoxSelect size={20} className="mx-auto text-indigo-500 mb-1" />
            <p className="text-2xl font-black text-indigo-700">{totalIssueRecords}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Kit Issues</p>
          </div>

          {/* Salary */}
          <div onClick={() => go(ROUTES.messBoySalary)}
            className="bg-white border border-teal-200 rounded-xl p-4 shadow-sm text-center cursor-pointer hover:shadow-md transition-all">
            <UserCheck size={20} className="mx-auto text-teal-500 mb-1" />
            <p className="text-2xl font-black text-teal-700">{fmtShort(salary.totalPaid)}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">
              Salary Paid · {salary.totalRecords} months
            </p>
          </div>

          {/* Recovery */}
          <div onClick={() => go(ROUTES.trainingFund)}
            className={`border rounded-xl p-4 shadow-sm text-center cursor-pointer hover:shadow-md transition-all ${
              recovery.totalDue > 0 ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'
            }`}>
            <CreditCard size={20} className={`mx-auto mb-1 ${recovery.totalDue > 0 ? 'text-purple-500' : 'text-green-500'}`} />
            <p className={`text-2xl font-black ${recovery.totalDue > 0 ? 'text-purple-700' : 'text-green-600'}`}>
              {fmtShort(recovery.totalDue)}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">
              Recovery Due · {recovery.pendingCount} pending
            </p>
          </div>

          {/* Transfers */}
          <div onClick={() => go(ROUTES.generalFund)}
            className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm text-center cursor-pointer hover:shadow-md transition-all">
            <ArrowRightLeft size={20} className="mx-auto text-purple-500 mb-1" />
            <p className="text-2xl font-black text-purple-700">{fmtShort(transfers.totalTransferred)}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">
              Transferred · {transfers.count} times
            </p>
          </div>
        </div>
      )}

      {/* ══════════ VENDOR DUES + STOCK ALERTS + RECOVERY ══════════ */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* ── VENDOR DUES ── */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors"
              onClick={() => go(ROUTES.vendorPayments)}>
              <div className="flex items-center gap-2">
                <Building2 size={13} className="text-red-600" />
                <p className="text-[10px] font-black uppercase text-red-800">
                  Vendor Dues ({vendorDues.length})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                  {fmtShort(totalVendorDue)}
                </span>
                <ChevronRight size={12} className="text-red-400" />
              </div>
            </div>

            {vendorDues.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 size={24} className="mx-auto text-green-400 mb-1" />
                <p className="text-[10px] font-bold text-green-600">All vendors clear!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {vendorDues.slice(0, 6).map(v => (
                  <div key={v.vendorId} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                    onClick={() => go(ROUTES.vendorPayments)}>
                    <div>
                      <p className="text-[11px] font-black text-slate-800">{v.vendorName}</p>
                      <p className="text-[9px] text-slate-400">{v.categoryLabel} · {v.entries} entries</p>
                    </div>
                    <p className="text-[11px] font-black text-red-600">{fmtShort(v.totalDue)}</p>
                  </div>
                ))}
                {vendorDues.length > 6 && (
                  <div className="px-4 py-2 text-center">
                    <button onClick={() => go(ROUTES.vendorPayments)} className="text-[9px] font-bold text-red-600 hover:underline">
                      +{vendorDues.length - 6} more vendors →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── STOCK ALERTS ── */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={() => go(ROUTES.trainingFund)}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} className="text-amber-600" />
                <p className="text-[10px] font-black uppercase text-amber-800">
                  Low Stock ({stockAlerts.length})
                </p>
              </div>
              <ChevronRight size={12} className="text-amber-400" />
            </div>

            {stockAlerts.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 size={24} className="mx-auto text-green-400 mb-1" />
                <p className="text-[10px] font-bold text-green-600">All stocks OK!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {stockAlerts.map((item, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.emoji}</span>
                      <div>
                        <p className="text-[11px] font-black text-slate-800">{item.itemName}</p>
                        <p className="text-[9px] text-slate-400">
                          Bought: {item.totalPurchased} · Issued: {item.totalIssued}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                      item.currentStock === 0
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-600'
                    }`}>
                      {item.currentStock === 0 ? '❌ OUT' : `${item.currentStock} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── RECOVERY BREAKDOWN ── */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-100 flex items-center justify-between cursor-pointer hover:bg-purple-100 transition-colors"
              onClick={() => go(ROUTES.trainingFund)}>
              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-purple-600" />
                <p className="text-[10px] font-black uppercase text-purple-800">
                  Recovery Status
                </p>
              </div>
              <ChevronRight size={12} className="text-purple-400" />
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded p-2">
                  <p className="text-[9px] text-slate-400 font-bold">Expected</p>
                  <p className="text-sm font-black text-slate-700">{fmtShort(recovery.totalExpected)}</p>
                </div>
                <div className="bg-green-50 rounded p-2 border border-green-100">
                  <p className="text-[9px] text-green-500 font-bold">Paid</p>
                  <p className="text-sm font-black text-green-600">{fmtShort(recovery.totalPaid)}</p>
                </div>
                <div className="bg-red-50 rounded p-2 border border-red-100">
                  <p className="text-[9px] text-red-500 font-bold">Pending</p>
                  <p className="text-sm font-black text-red-600">{fmtShort(recovery.totalDue)}</p>
                </div>
              </div>

              {recovery.totalExpected > 0 && (
                <div>
                  <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                    <span>Recovery Progress</span>
                    <span className="font-black text-slate-600">{recoveryPct}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${
                      recoveryPct >= 80 ? 'bg-green-500' : recoveryPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`} style={{ width: `${Math.min(recoveryPct, 100)}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] text-slate-400">
                <span>{recovery.paidCount} paid · {recovery.pendingCount} pending</span>
                <button onClick={() => go(ROUTES.trainingFund)} className="font-bold text-purple-600 hover:underline">
                  View All →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ QUICK ACCESS MODULES ══════════ */}
      {!loading && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-1.5">
            <Zap size={11} /> Quick Access — Click to Navigate
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {[
              { label: 'Mess Fund', emoji: '🍽️', route: ROUTES.messFund, color: 'bg-orange-600' },
              { label: 'Training Fund', emoji: '🎓', route: ROUTES.trainingFund, color: 'bg-blue-700' },
              { label: 'Assets Fund', emoji: '🏛️', route: ROUTES.companyAssets, color: 'bg-green-700' },
              { label: 'General Fund', emoji: '💰', route: ROUTES.generalFund, color: 'bg-slate-800' },
              { label: 'Vendor Pay', emoji: '💳', route: ROUTES.vendorPayments, color: 'bg-amber-600' },
              { label: 'Salary', emoji: '👨‍🍳', route: ROUTES.messBoySalary, color: 'bg-teal-700' },
              { label: 'Issue Kit', emoji: '📦', route: ROUTES.issueKit, color: 'bg-indigo-700' },
              { label: 'Funds View', emoji: '📊', route: ROUTES.fundsDashboard, color: 'bg-purple-700' },
            ].map(mod => (
              <button key={mod.route} onClick={() => go(mod.route)}
                className="flex flex-col items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-3 hover:shadow-md hover:border-slate-300 active:scale-95 transition-all group">
                <div className={`w-9 h-9 ${mod.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm`}>
                  <span className="text-lg">{mod.emoji}</span>
                </div>
                <p className="text-[9px] font-black text-slate-700 uppercase text-center leading-tight">
                  {mod.label}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ RECENT ACTIVITY ══════════ */}
      {!loading && recentActivity.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-slate-500" />
              <p className="text-[10px] font-black uppercase text-slate-600">
                Recent Activity (Last 15)
              </p>
            </div>
            <button onClick={() => go(ROUTES.fundsDashboard)}
              className="text-[9px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-0.5">
              Full View <ChevronRight size={10} />
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {recentActivity.map(act => (
              <div key={`${act.type}_${act.id}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  act.type === 'collection' ? 'bg-green-100' :
                  act.type === 'transfer' ? 'bg-purple-100' :
                  act.type === 'salary' ? 'bg-teal-100' :
                  'bg-red-100'
                }`}>
                  {act.type === 'collection' && <ArrowUpRight size={11} className="text-green-600" />}
                  {act.type === 'expense' && <ArrowDownRight size={11} className="text-red-500" />}
                  {act.type === 'transfer' && <ArrowRightLeft size={11} className="text-purple-600" />}
                  {act.type === 'salary' && <UserCheck size={11} className="text-teal-600" />}
                  {act.type === 'issue' && <BoxSelect size={11} className="text-indigo-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-700 truncate">{act.label}</p>
                  <p className="text-[9px] text-slate-400">{act.fund} · {formatDate(act.date)}</p>
                </div>
                <span className={`text-[11px] font-black flex-shrink-0 ${
                  act.type === 'collection' ? 'text-green-600' :
                  act.type === 'transfer' ? 'text-purple-600' :
                  act.type === 'salary' ? 'text-teal-600' :
                  'text-red-600'
                }`}>
                  {act.type === 'collection' ? '+' : act.type === 'transfer' ? '↔' : '−'}{fmtShort(act.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ BALANCE FORMULA + SALARY CARD ══════════ */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Balance Formula */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg cursor-pointer hover:bg-slate-800 transition-colors"
            onClick={() => go(ROUTES.fundsDashboard)}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5">
              <BarChart3 size={11} /> Net Balance Formula (All Funds)
            </p>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-green-400 flex items-center gap-1"><ArrowUpRight size={11} /> Grand Collection</span>
                <span className="text-green-400 font-black">{fmtShort(grandCollection)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-400 flex items-center gap-1"><ArrowDownRight size={11} /> Actually Paid</span>
                <span className="text-red-400 font-black">{fmtShort(grandActuallyPaid)}</span>
              </div>
              {transfers.totalTransferred > 0 && (
                <div className="flex justify-between">
                  <span className="text-purple-400 flex items-center gap-1"><ArrowRightLeft size={11} /> Internal Transfers</span>
                  <span className="text-purple-400 font-black">{fmtShort(transfers.totalTransferred)}</span>
                </div>
              )}
              <div className="border-t border-slate-600 pt-2 flex justify-between font-black">
                <span className="text-white text-base">= Net Balance</span>
                <span className={`text-lg ${grandBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {grandBalance < 0 ? '−' : '+'}{fmtShort(Math.abs(grandBalance))}
                </span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-3 flex items-center gap-1">
              <Info size={9} /> Collection − Paid − Transferred = Balance
            </p>
          </div>

          {/* Salary Summary */}
          <div className="bg-white border-2 border-teal-200 rounded-xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-all"
            onClick={() => go(ROUTES.messBoySalary)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-teal-600" />
                <p className="text-[11px] font-black uppercase text-teal-800">Mess Boy Salary</p>
              </div>
              <ChevronRight size={14} className="text-teal-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-[9px] text-teal-500 font-bold uppercase">Total Paid</p>
                <p className="text-lg font-black text-teal-700">{fmtShort(salary.totalPaid)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Records</p>
                <p className="text-lg font-black text-slate-700">{salary.totalRecords} months</p>
              </div>
            </div>
            {salary.latestMonth && (
              <p className="text-[10px] text-teal-600 mt-3 text-center font-bold">
                Latest: {salary.latestMonth} · {salary.totalBoys} boys
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══════════ FOOTER ══════════ */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 py-2 border-t border-slate-100">
        <span>Quarter Master Module · BSF COY System</span>
        <div className="flex items-center gap-3">
          {[
            { label: 'Funds', route: ROUTES.fundsDashboard },
            { label: 'Vendors', route: ROUTES.vendorPayments },
            { label: 'Stock', route: ROUTES.stock },
          ].map(link => (
            <button key={link.route} onClick={() => go(link.route)}
              className="hover:text-slate-700 transition-colors font-semibold">{link.label}</button>
          ))}
          <span className="flex items-center gap-1.5 ml-2">
            <span className={`w-1.5 h-1.5 rounded-full ${authReady ? 'bg-green-400' : 'bg-red-400'}`} />
            {authReady ? 'Live' : 'Offline'} · {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuarterMasterDashboard;