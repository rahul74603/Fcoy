// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\FundsDashboard.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet, RefreshCw,
  AlertTriangle, CheckCircle2, X, Loader2,
  Building2,
  Eye, Clock,
  ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatCurrency, formatDate, FIXED_MESS_CATEGORIES } from './shared/utils';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface FundSummary {
  key:            string;
  label:          string;
  emoji:          string;
  color:          string;
  borderColor:    string;
  collection:     number;
  expense:        number;
  actuallyPaid:   number;
  balance:        number;
  totalOrders:    number;
  entries:        number;
  pendingBills:   number;
  vendorDue:      number;
  transferredOut: number;
}

interface VendorDueSummary {
  vendorId:      string;
  vendorName:    string;
  categoryLabel: string;
  totalDue:      number;
  entries:       number;
}

interface RecentActivity {
  id:     string;
  type:   'collection' | 'expense' | 'vendor_payment' | 'salary' | 'transfer';
  label:  string;
  amount: number;
  date:   string;
  fund:   string;
}

// ─────────────────────────────────────────────
// FUND DETAIL MODAL — FIXED
// ─────────────────────────────────────────────
interface FundDetailProps {
  fund:        FundSummary;
  collections: {
    id: string; amount: number; date: string;
    remarks?: string; monthLabel?: string;
  }[];
  expenses: {
    id: string; amount: number; date: string;
    category?: string; categoryLabel?: string; vendor?: string;
    billStatus?: string; dueAmount?: number; paidAmount?: number;
    vendorId?: string;
  }[];
  onClose: () => void;
}

const FundDetailModal: React.FC<FundDetailProps> = ({
  fund, collections, expenses, onClose
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'expenses'>('collections');
  const modalRef = useRef<HTMLDivElement>(null);

  // ── ESC key closes modal ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    // Prevent body scroll when modal open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // ── Only close if clicking directly on backdrop ──
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    // Backdrop — stops ALL propagation from children
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Modal Box — stops click from reaching backdrop accidentally */}
      <div
        ref={modalRef}
        className="bg-white shadow-2xl max-w-3xl w-full rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={`${fund.color} text-white px-5 py-4 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{fund.emoji}</span>
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-white">
                {fund.label}
              </p>
              <p className="text-white/60 text-[10px]">Detailed Fund View</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-4 gap-0 border-b border-slate-200 flex-shrink-0">
          {[
            {
              l: 'Total Collection',
              v: formatCurrency(fund.collection),
              c: 'text-green-700',
              bg: 'bg-green-50',
            },
            {
              l: 'Total Orders',
              v: formatCurrency(fund.totalOrders),
              c: 'text-orange-700',
              bg: 'bg-orange-50',
            },
            {
              l: 'Actually Paid',
              v: formatCurrency(fund.actuallyPaid),
              c: 'text-red-700',
              bg: 'bg-red-50',
            },
            {
              l: 'Cash Balance',
              v: (fund.balance < 0 ? '−' : '') + formatCurrency(Math.abs(fund.balance)),
              c: fund.balance >= 0 ? 'text-slate-900' : 'text-red-700',
              bg: 'bg-white',
            },
          ].map((s) => (
            <div
              key={s.l}
              className={`${s.bg} px-4 py-3 text-center border-r border-slate-100 last:border-0`}
            >
              <p className="text-[9px] font-bold text-slate-400 uppercase">{s.l}</p>
              <p className={`text-base font-black mt-0.5 ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* ── Transfer Alert ── */}
        {fund.transferredOut > 0 && (
          <div className="bg-purple-50 border-b border-purple-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <ArrowRightLeft size={12} className="text-purple-600 flex-shrink-0" />
            <p className="text-[10px] text-purple-700 font-bold">
              Transferred to General Fund:{' '}
              <strong>{formatCurrency(fund.transferredOut)}</strong>
            </p>
          </div>
        )}

        {/* ── Vendor Due Alert ── */}
        {fund.vendorDue > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <AlertTriangle size={12} className="text-amber-600 flex-shrink-0" />
            <p className="text-[10px] text-amber-700 font-bold">
              Vendor Pending Due:{' '}
              <strong>{formatCurrency(fund.vendorDue)}</strong> — Vendor Payment
              screen se clear karo
            </p>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-slate-200 flex-shrink-0">
          {(['collections', 'expenses'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveTab(t); }}
              className={`px-6 py-2.5 text-[11px] font-black uppercase border-b-2 transition-colors ${
                activeTab === t
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'collections'
                ? `Collections (${collections.length})`
                : `Expenses (${expenses.length})`}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'collections' ? (
            collections.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ArrowDownToLine
                  size={32}
                  className="mx-auto mb-2 text-slate-200"
                />
                <p className="text-sm font-bold">Koi collection nahi</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {collections
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .map((c) => (
                    <div
                      key={c.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-green-50/50"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-700">
                          {c.monthLabel || c.remarks || 'Collection'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatDate(c.date)}
                        </p>
                      </div>
                      <span className="text-sm font-black text-green-700">
                        +{formatCurrency(c.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            )
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ArrowUpFromLine
                size={32}
                className="mx-auto mb-2 text-slate-200"
              />
              <p className="text-sm font-bold">Koi expense nahi</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {expenses
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                )
                .map((e) => (
                  <div
                    key={e.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-red-50/50"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {e.categoryLabel || e.category || 'Expense'}
                        {e.vendor ? ` · ${e.vendor}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[10px] text-slate-400">
                          {formatDate(e.date)}
                        </p>
                        {e.billStatus && (
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                              e.billStatus === 'Pending'
                                ? 'bg-amber-100 text-amber-700'
                                : e.billStatus === 'Received'
                                ? 'bg-blue-100 text-blue-700'
                                : e.billStatus === 'Verified'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {e.billStatus}
                          </span>
                        )}
                        {(e.dueAmount ?? 0) > 0 && (
                          <span className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            Due: {formatCurrency(e.dueAmount!)}
                          </span>
                        )}
                        {e.vendorId && (e.dueAmount ?? 0) <= 0 && (
                          <span className="text-[8px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            ✓ Paid
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-black text-red-600">
                        −{formatCurrency(e.amount)}
                      </span>
                      {e.vendorId && (e.paidAmount ?? 0) !== e.amount && (
                        <p className="text-[9px] text-green-600 font-bold">
                          Paid: {formatCurrency(e.paidAmount ?? 0)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <p className="text-[9px] text-slate-400 font-mono">
            Press ESC to close · {collections.length} collections ·{' '}
            {expenses.length} expenses
          </p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white px-4 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════
export const FundsDashboard: React.FC = () => {
  const [funds, setFunds]                   = useState<FundSummary[]>([]);
  const [vendorDues, setVendorDues]         = useState<VendorDueSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading]               = useState(true);
  const [errorMsg, setErrorMsg]             = useState('');

  const [detailFund, setDetailFund]               = useState<FundSummary | null>(null);
  const [detailCollections, setDetailCollections] = useState<FundDetailProps['collections']>([]);
  const [detailExpenses, setDetailExpenses]       = useState<FundDetailProps['expenses']>([]);

  // Raw data stores
  const [rawMessCol,  setRawMessCol]  = useState<any[]>([]);
  const [rawMessExp,  setRawMessExp]  = useState<any[]>([]);
  const [rawTrainCol, setRawTrainCol] = useState<any[]>([]);
  const [rawTrainExp, setRawTrainExp] = useState<any[]>([]);
  const [rawAssetCol, setRawAssetCol] = useState<any[]>([]);
  const [rawAssetExp, setRawAssetExp] = useState<any[]>([]);
  const [rawGenCol,   setRawGenCol]   = useState<any[]>([]);
  const [rawGenExp,   setRawGenExp]   = useState<any[]>([]);

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────
  const calcActuallyPaid = (expList: any[]): number =>
    expList.reduce((s, e) => {
      if (e.vendorId) return s + Number(e.paidAmount ?? 0);
      return s + Number(e.amount ?? 0);
    }, 0);

  const calcVendorDue = (expList: any[]): number =>
    expList.reduce((s, e) => s + Number(e.dueAmount ?? 0), 0);

  // ─────────────────────────────────────────
  // FETCH
  // ─────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // ── Transfers ──
      const transferSnap = await getDocs(collection(db, 'fund_transfers'));
      const transferList: any[] = [];
      transferSnap.forEach((d) => {
        const data = d.data();
        transferList.push({
          id: d.id,
          fromFundKey:   data.fromFundKey   ?? '',
          fromFundLabel: data.fromFundLabel ?? '',
          toFundKey:     data.toFundKey     ?? '',
          toFundLabel:   data.toFundLabel   ?? '',
          amount: Number(data.amount ?? 0),
          date:   data.date ?? '',
        });
      });

      const getTransferredOut = (fundKey: string) =>
        transferList
          .filter((t) => t.fromFundKey === fundKey)
          .reduce((s, t) => s + t.amount, 0);

      // ── Mess Fund ──
      const mcSnap = await getDocs(collection(db, 'mess_fund_collections'));
      const meSnap = await getDocs(collection(db, 'mess_fund_expenses'));
      let mc = 0;
      const mcList: any[] = [];
      const meList: any[] = [];

      mcSnap.forEach((d) => {
        const data = d.data();
        mc += Number(data.amount ?? 0);
        mcList.push({
          id: d.id,
          amount:     Number(data.amount ?? 0),
          date:       data.date       ?? '',
          monthLabel: data.monthLabel ?? '',
          remarks:    data.remarks    ?? '',
        });
      });
      meSnap.forEach((d) => {
        const data = d.data();
        meList.push({
          id: d.id,
          amount:        Number(data.amount      ?? 0),
          date:          data.date               ?? '',
          category:      data.category           ?? '',
          categoryLabel: data.categoryLabel      ?? '',
          vendor:        data.vendor             ?? '',
          vendorId:      data.vendorId ?? data.linkedVendorId ?? '',
          billStatus:    data.billStatus         ?? '',
          dueAmount:     Number(data.dueAmount   ?? 0),
          paidAmount:    Number(data.paidAmount  ?? 0),
        });
      });

      setRawMessCol(mcList);
      setRawMessExp(meList);
      const messActuallyPaid = calcActuallyPaid(meList);
      const messVendorDue    = calcVendorDue(meList);
      const messPendingBills = meList.filter((e) => e.billStatus === 'Pending').length;
      const messTransferred  = getTransferredOut('mess_fund');

      // ── Training Fund ──
      const tcSnap = await getDocs(collection(db, 'training_fund_collections'));
      const teSnap = await getDocs(collection(db, 'training_fund_expenses'));
      let tc = 0;
      const tcList: any[] = [];
      const teList: any[] = [];

      tcSnap.forEach((d) => {
        const data = d.data();
        tc += Number(data.amount ?? 0);
        tcList.push({
          id:      d.id,
          amount:  Number(data.amount ?? 0),
          date:    data.date            ?? '',
          remarks: data.label ?? data.remarks ?? '',
        });
      });
      teSnap.forEach((d) => {
        const data = d.data();
        teList.push({
          id:            d.id,
          amount:        Number(data.amount     ?? 0),
          date:          data.date              ?? '',
          categoryLabel: data.itemName          ?? '',
          vendor:        data.vendor            ?? '',
          vendorId:      data.vendorId ?? data.linkedVendorId ?? '',
          billStatus:    data.billStatus        ?? '',
          dueAmount:     Number(data.dueAmount  ?? 0),
          paidAmount:    Number(data.paidAmount ?? 0),
        });
      });

      setRawTrainCol(tcList);
      setRawTrainExp(teList);
      const trainActuallyPaid = calcActuallyPaid(teList);
      const trainVendorDue    = calcVendorDue(teList);
      const trainPendingBills = teList.filter((e) => e.billStatus === 'Pending').length;
      const trainTransferred  = getTransferredOut('training_fund');

      // ── Company Assets Fund ──
      const acSnap = await getDocs(collection(db, 'company_assets_collections'));
      const aeSnap = await getDocs(collection(db, 'company_assets_expenses'));
      let ac = 0;
      const acList: any[] = [];
      const aeList: any[] = [];

      acSnap.forEach((d) => {
        const data = d.data();
        ac += Number(data.amount ?? 0);
        acList.push({
          id:      d.id,
          amount:  Number(data.amount ?? 0),
          date:    data.date           ?? '',
          remarks: data.label          ?? '',
        });
      });
      aeSnap.forEach((d) => {
        const data = d.data();
        aeList.push({
          id:            d.id,
          amount:        Number(data.amount     ?? 0),
          date:          data.date              ?? '',
          categoryLabel: data.itemName          ?? '',
          vendor:        data.vendor            ?? '',
          vendorId:      data.vendorId ?? data.linkedVendorId ?? '',
          billStatus:    data.billStatus        ?? '',
          dueAmount:     Number(data.dueAmount  ?? 0),
          paidAmount:    Number(data.paidAmount ?? 0),
        });
      });

      setRawAssetCol(acList);
      setRawAssetExp(aeList);
      const assetActuallyPaid = calcActuallyPaid(aeList);
      const assetVendorDue    = calcVendorDue(aeList);
      const assetPendingBills = aeList.filter((e) => e.billStatus === 'Pending').length;
      const assetTransferred  = getTransferredOut('company_assets_fund');

      // ── General Fund ──
      const gcSnap = await getDocs(collection(db, 'general_fund_collections'));
      const geSnap = await getDocs(collection(db, 'general_fund_expenses'));
      let gc = 0;
      const gcList: any[] = [];
      const geList: any[] = [];

      gcSnap.forEach((d) => {
        const data = d.data();
        gc += Number(data.amount ?? 0);
        gcList.push({
          id:      d.id,
          amount:  Number(data.amount ?? 0),
          date:    data.date            ?? '',
          remarks: data.label ?? data.remarks ?? '',
        });
      });
      geSnap.forEach((d) => {
        const data = d.data();
        geList.push({
          id:            d.id,
          amount:        Number(data.amount     ?? 0),
          date:          data.date              ?? '',
          categoryLabel: data.categoryLabel ?? data.category ?? '',
          vendor:        data.vendor            ?? '',
          vendorId:      data.vendorId          ?? '',
          billStatus:    data.billStatus        ?? '',
          dueAmount:     Number(data.dueAmount  ?? 0),
          paidAmount:    Number(data.paidAmount ?? 0),
        });
      });

      setRawGenCol(gcList);
      setRawGenExp(geList);
      const genActuallyPaid = calcActuallyPaid(geList);
      const genVendorDue    = calcVendorDue(geList);
      const genPendingBills = geList.filter((e) => e.billStatus === 'Pending').length;

      // ── Build Fund Summaries ──
      const fundList: FundSummary[] = [
        {
          key: 'mess_fund', label: 'Mess Fund', emoji: '🍽️',
          color: 'bg-orange-600', borderColor: 'border-orange-500',
          collection:     mc,
          expense:        meList.reduce((s, e) => s + e.amount, 0),
          totalOrders:    meList.reduce((s, e) => s + e.amount, 0),
          actuallyPaid:   messActuallyPaid,
          balance:        mc - messActuallyPaid - messTransferred,
          vendorDue:      messVendorDue,
          entries:        mcList.length + meList.length,
          pendingBills:   messPendingBills,
          transferredOut: messTransferred,
        },
        {
          key: 'training_fund', label: 'Training Essentials Fund', emoji: '🎓',
          color: 'bg-blue-700', borderColor: 'border-blue-500',
          collection:     tc,
          expense:        teList.reduce((s, e) => s + e.amount, 0),
          totalOrders:    teList.reduce((s, e) => s + e.amount, 0),
          actuallyPaid:   trainActuallyPaid,
          balance:        tc - trainActuallyPaid - trainTransferred,
          vendorDue:      trainVendorDue,
          entries:        tcList.length + teList.length,
          pendingBills:   trainPendingBills,
          transferredOut: trainTransferred,
        },
        {
          key: 'company_assets_fund', label: 'Company Assets Fund', emoji: '🏛️',
          color: 'bg-green-700', borderColor: 'border-green-600',
          collection:     ac,
          expense:        aeList.reduce((s, e) => s + e.amount, 0),
          totalOrders:    aeList.reduce((s, e) => s + e.amount, 0),
          actuallyPaid:   assetActuallyPaid,
          balance:        ac - assetActuallyPaid - assetTransferred,
          vendorDue:      assetVendorDue,
          entries:        acList.length + aeList.length,
          pendingBills:   assetPendingBills,
          transferredOut: assetTransferred,
        },
        {
          key: 'general_fund', label: 'General Fund', emoji: '💰',
          color: 'bg-slate-800', borderColor: 'border-slate-700',
          collection:     gc,
          expense:        geList.reduce((s, e) => s + e.amount, 0),
          totalOrders:    geList.reduce((s, e) => s + e.amount, 0),
          actuallyPaid:   genActuallyPaid,
          balance:        gc - genActuallyPaid,
          vendorDue:      genVendorDue,
          entries:        gcList.length + geList.length,
          pendingBills:   genPendingBills,
          transferredOut: 0,
        },
      ];
      setFunds(fundList);

      // ── Vendor Dues ──
      const vSnap  = await getDocs(collection(db, 'vendors'));
      const veSnap = await getDocs(collection(db, 'vendor_entries'));

      const vendorMap: Record<string, { name: string; categoryLabel: string }> = {};
      vSnap.forEach((d) => {
        const data = d.data();
        if (data.isActive !== false) {
          vendorMap[d.id] = {
            name:          data.name          ?? '',
            categoryLabel: data.categoryLabel ?? '',
          };
        }
      });

      const vDueMap: Record<string, VendorDueSummary> = {};
      veSnap.forEach((d) => {
        const data = d.data();
        const due  = Number(data.dueAmount ?? 0);
        if (due <= 0) return;
        const vId = data.vendorId ?? '';
        if (!vDueMap[vId]) {
          vDueMap[vId] = {
            vendorId:      vId,
            vendorName:    vendorMap[vId]?.name          ?? data.vendorName    ?? '',
            categoryLabel: vendorMap[vId]?.categoryLabel ?? data.categoryLabel ?? '',
            totalDue: 0,
            entries:  0,
          };
        }
        vDueMap[vId].totalDue += due;
        vDueMap[vId].entries  += 1;
      });

      setVendorDues(
        Object.values(vDueMap).sort((a, b) => b.totalDue - a.totalDue)
      );

      // ── Recent Activity ──
      const activities: RecentActivity[] = [];

      mcList.forEach((c) => activities.push({ id: c.id, type: 'collection', label: c.monthLabel || c.remarks || 'Mess Cutting', amount: c.amount, date: c.date, fund: '🍽️ Mess Fund' }));
      meList.forEach((e) => activities.push({ id: e.id, type: 'expense',    label: e.categoryLabel || e.category || 'Mess Expense', amount: e.amount, date: e.date, fund: '🍽️ Mess Fund' }));

      tcList.forEach((c) => activities.push({ id: c.id, type: 'collection', label: c.remarks || 'Training Collection', amount: c.amount, date: c.date, fund: '🎓 Training Fund' }));
      teList.forEach((e) => activities.push({ id: e.id, type: 'expense',    label: e.categoryLabel || 'Training Purchase', amount: e.amount, date: e.date, fund: '🎓 Training Fund' }));

      acList.forEach((c) => activities.push({ id: c.id, type: 'collection', label: c.remarks || 'Assets Cutting', amount: c.amount, date: c.date, fund: '🏛️ Assets Fund' }));
      aeList.forEach((e) => activities.push({ id: e.id, type: 'expense',    label: e.categoryLabel || 'Asset Purchase', amount: e.amount, date: e.date, fund: '🏛️ Assets Fund' }));

      gcList.forEach((c) => activities.push({ id: c.id, type: 'collection', label: c.remarks || 'General Collection', amount: c.amount, date: c.date, fund: '💰 General Fund' }));
      geList.forEach((e) => activities.push({ id: e.id, type: 'expense',    label: e.categoryLabel || 'General Expense', amount: e.amount, date: e.date, fund: '💰 General Fund' }));

      transferList.forEach((t) =>
        activities.push({
          id: t.id, type: 'transfer',
          label:  `Transfer: ${t.fromFundLabel} → ${t.toFundLabel}`,
          amount: t.amount, date: t.date, fund: '🔄 Transfer',
        })
      );

      activities.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setRecentActivity(activities.slice(0, 20));
    } catch (err) {
      console.error(err);
      setErrorMsg('Data load nahi hua. Refresh karo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ── Open fund detail modal ──
  const openFundDetail = (e: React.MouseEvent, fund: FundSummary) => {
    // CRITICAL: prevent any parent click handlers
    e.preventDefault();
    e.stopPropagation();

    setDetailFund(fund);
    if (fund.key === 'mess_fund') {
      setDetailCollections(rawMessCol);
      setDetailExpenses(rawMessExp);
    } else if (fund.key === 'training_fund') {
      setDetailCollections(rawTrainCol);
      setDetailExpenses(rawTrainExp);
    } else if (fund.key === 'company_assets_fund') {
      setDetailCollections(rawAssetCol);
      setDetailExpenses(rawAssetExp);
    } else {
      setDetailCollections(rawGenCol);
      setDetailExpenses(rawGenExp);
    }
  };

  const closeDetail = () => {
    setDetailFund(null);
    setDetailCollections([]);
    setDetailExpenses([]);
  };

  // ── Grand Totals ──
  const grandCollection   = funds.reduce((s, f) => s + f.collection,   0);
  const grandOrders       = funds.reduce((s, f) => s + f.totalOrders,  0);
  const grandActuallyPaid = funds.reduce((s, f) => s + f.actuallyPaid, 0);
  const grandBalance      = funds.reduce((s, f) => s + f.balance,      0);
  const totalVendDue      = vendorDues.reduce((s, v) => s + v.totalDue, 0);
  const totalPendBills    = funds.reduce((s, f) => s + f.pendingBills,  0);
  const totalFundVendDue  = funds.reduce((s, f) => s + f.vendorDue,    0);

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center text-xl">
            💼
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
              Funds Dashboard
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              4 Funds · Vendor Dues · Activity Log · Click fund card to see
              details
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchAllData}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── ERROR ── */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} />
          {errorMsg}
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="ml-auto"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <Loader2
            size={32}
            className="animate-spin mx-auto text-slate-600 mb-3"
          />
          <p className="text-sm font-bold text-slate-500">Loading funds...</p>
        </div>
      ) : (
        <>
          {/* ── GRAND TOTALS ── */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              {
                l: 'Grand Collection',
                v: formatCurrency(grandCollection),
                c: 'text-green-700',
                bg: 'bg-green-50',
                b: 'border-green-200',
              },
              {
                l: 'Total Orders',
                v: formatCurrency(grandOrders),
                c: 'text-orange-700',
                bg: 'bg-orange-50',
                b: 'border-orange-200',
                hint: 'Saman ka total',
              },
              {
                l: 'Actually Paid',
                v: formatCurrency(grandActuallyPaid),
                c: 'text-red-700',
                bg: 'bg-red-50',
                b: 'border-red-200',
                hint: 'Paisa gaya',
              },
              {
                l: 'Net Balance',
                v: formatCurrency(grandBalance),
                c: grandBalance >= 0 ? 'text-slate-900' : 'text-red-700',
                bg: grandBalance >= 0 ? 'bg-white' : 'bg-red-50',
                b: 'border-slate-200',
                hint: 'Cash in hand',
              },
              {
                l: 'Vendor Dues',
                v: formatCurrency(totalFundVendDue),
                c: totalFundVendDue > 0 ? 'text-red-700' : 'text-green-700',
                bg: totalFundVendDue > 0 ? 'bg-red-50' : 'bg-green-50',
                b: totalFundVendDue > 0 ? 'border-red-200' : 'border-green-200',
                hint: 'Vendor ko dena',
              },
              {
                l: 'Pending Bills',
                v: String(totalPendBills),
                c: totalPendBills > 0 ? 'text-amber-700' : 'text-green-700',
                bg: 'bg-amber-50',
                b: 'border-amber-200',
              },
            ].map((s) => (
              <div
                key={s.l}
                className={`${s.bg} border ${s.b} rounded-xl p-4 shadow-sm`}
              >
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                  {s.l}
                </p>
                <p className={`text-xl font-black ${s.c}`}>{s.v}</p>
                {'hint' in s && s.hint && (
                  <p className="text-[9px] text-slate-400 mt-0.5">{s.hint}</p>
                )}
              </div>
            ))}
          </div>

          {/* ── INFO BANNER ── */}
          <div className="bg-slate-50 border border-slate-200 rounded px-4 py-3 flex items-start gap-2">
            <CheckCircle2
              size={13}
              className="text-green-600 flex-shrink-0 mt-0.5"
            />
            <div className="text-[10px] text-slate-600 space-y-0.5">
              <p>
                <strong>Net Balance</strong> = Grand Collection − Actually Paid
                − Transferred Out
              </p>
              <p>
                <strong>Total Orders</strong> = Saman liya total ·{' '}
                <strong>Actually Paid</strong> = Jo paisa gaya ·{' '}
                <strong>Vendor Dues</strong> = Dena baki
              </p>
              <p>
                <strong>General Fund</strong> = Surplus transfer + Salary +
                Misc expenses ka central reserve
              </p>
            </div>
          </div>

          {/* ── FUND CARDS ── */}
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase mb-3 flex items-center gap-1.5">
              <Wallet size={11} /> Fund Breakdown — Click card to see details
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {funds.map((fund) => (
                // ── KEY FIX: button type="button" + e.stopPropagation in handler ──
                <button
                  key={fund.key}
                  type="button"
                  onClick={(e) => openFundDetail(e, fund)}
                  className={`text-left w-full cursor-pointer bg-white border-2 ${fund.borderColor} rounded-xl shadow-sm hover:shadow-lg hover:scale-[1.02] active:scale-100 transition-all group overflow-hidden`}
                >
                  {/* Card header */}
                  <div
                    className={`${fund.color} text-white px-4 py-3 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{fund.emoji}</span>
                      <p className="text-xs font-black uppercase text-white">
                        {fund.label}
                      </p>
                    </div>
                    <Eye
                      size={16}
                      className="text-white/60 group-hover:text-white transition-colors"
                    />
                  </div>

                  {/* Card body */}
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-[8px] text-green-500 font-bold uppercase">
                          Collection
                        </p>
                        <p className="text-xs font-black text-green-700">
                          {formatCurrency(fund.collection)}
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2 text-center">
                        <p className="text-[8px] text-orange-400 font-bold uppercase">
                          Orders
                        </p>
                        <p className="text-xs font-black text-orange-600">
                          {formatCurrency(fund.totalOrders)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-red-50 rounded-lg p-2 text-center">
                        <p className="text-[8px] text-red-400 font-bold uppercase">
                          Paid Out
                        </p>
                        <p className="text-xs font-black text-red-600">
                          {formatCurrency(fund.actuallyPaid)}
                        </p>
                      </div>
                      <div
                        className={`rounded-lg p-2 text-center ${
                          fund.vendorDue > 0 ? 'bg-amber-50' : 'bg-green-50'
                        }`}
                      >
                        <p className="text-[8px] font-bold uppercase text-slate-400">
                          Vendor Due
                        </p>
                        <p
                          className={`text-xs font-black ${
                            fund.vendorDue > 0
                              ? 'text-amber-700'
                              : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(fund.vendorDue)}
                        </p>
                      </div>
                    </div>

                    {fund.transferredOut > 0 && (
                      <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-200">
                        <p className="text-[8px] text-purple-500 font-bold uppercase">
                          Transferred Out
                        </p>
                        <p className="text-xs font-black text-purple-700">
                          {formatCurrency(fund.transferredOut)}
                        </p>
                      </div>
                    )}

                    <div
                      className={`rounded-xl p-2.5 flex items-center justify-between ${
                        fund.balance >= 0 ? 'bg-slate-50' : 'bg-red-100'
                      }`}
                    >
                      <p className="text-[9px] font-bold text-slate-500 uppercase">
                        Cash Balance
                      </p>
                      <p
                        className={`text-base font-black ${
                          fund.balance >= 0 ? 'text-slate-900' : 'text-red-700'
                        }`}
                      >
                        {fund.balance < 0 ? '−' : ''}
                        {formatCurrency(Math.abs(fund.balance))}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[8px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                        {fund.entries} entries
                      </span>
                      {fund.pendingBills > 0 && (
                        <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                          {fund.pendingBills} bills pending
                        </span>
                      )}
                      <span className="text-[8px] font-bold bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full ml-auto">
                        👆 Details
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── VENDOR DUES ── */}
          {vendorDues.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-red-600" />
                  <p className="text-[11px] font-black uppercase text-red-800">
                    Vendor Dues ({vendorDues.length} vendors)
                  </p>
                  <span className="text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                    Total: {formatCurrency(totalVendDue)}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 font-semibold">
                  Vendor Payment screen se pay karo
                </p>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {vendorDues.map((v) => (
                  <div
                    key={v.vendorId}
                    className="px-4 py-3 flex items-center justify-between hover:bg-red-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                        {FIXED_MESS_CATEGORIES.find(
                          (c) => c.label === v.categoryLabel
                        )?.emoji ?? '🏪'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">
                          {v.vendorName}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {v.categoryLabel} · {v.entries} pending entries
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-red-600">
                        {formatCurrency(v.totalDue)}
                      </p>
                      <p className="text-[9px] font-bold text-red-400">Due</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RECENT ACTIVITY ── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Clock size={14} className="text-slate-500" />
              <p className="text-[11px] font-black uppercase text-slate-600">
                Recent Activity (Last 20)
              </p>
            </div>
            {recentActivity.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Clock size={28} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm font-bold">Koi activity nahi</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                {recentActivity.map((act) => (
                  <div
                    key={`${act.type}_${act.id}`}
                    className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        act.type === 'collection'
                          ? 'bg-green-100'
                          : act.type === 'transfer'
                          ? 'bg-purple-100'
                          : 'bg-red-100'
                      }`}
                    >
                      {act.type === 'collection' ? (
                        <ArrowDownToLine size={12} className="text-green-600" />
                      ) : act.type === 'transfer' ? (
                        <ArrowRightLeft size={12} className="text-purple-600" />
                      ) : (
                        <ArrowUpFromLine size={12} className="text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {act.label}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {act.fund} · {formatDate(act.date)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-black flex-shrink-0 ${
                        act.type === 'collection'
                          ? 'text-green-700'
                          : act.type === 'transfer'
                          ? 'text-purple-700'
                          : 'text-red-600'
                      }`}
                    >
                      {act.type === 'collection'
                        ? '+'
                        : act.type === 'transfer'
                        ? '↔'
                        : '−'}
                      {formatCurrency(act.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── FUND DETAIL MODAL ── */}
      {detailFund && (
        <FundDetailModal
          fund={detailFund}
          collections={detailCollections}
          expenses={detailExpenses}
          onClose={closeDetail}
        />
      )}
    </div>
  );
};

export default FundsDashboard;