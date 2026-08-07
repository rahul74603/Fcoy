// D:\ALL PROJECTS\BSF COYs\frontend\src\features\dashboard\CompanyCommanderDashboard.tsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, AlertTriangle, Wallet, RefreshCw,
  ChevronRight, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, AlertCircle, Package, CreditCard, Activity,
  BarChart3, BookOpen, Eye, X, Loader2,
  FileText, Building2, BoxSelect, UserCheck, Calendar, Layers,
  Star, Zap, ArrowRight, Crosshair, Award, HeartPulse, LayoutDashboard,
  PackageMinus, IndianRupee, Search, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import {
  collection, getDocs, query, where
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { BatchProgressOverview } from './BatchProgressOverview';
import { CommanderInformationBoard } from './CommanderInformationBoard';
import { normalizePlatoon, PLATOON_OPTIONS } from '../../utils/platoon';


// ─── Staff Module API ───────────────────────
import { getStaffSummary } from '../../features/ustad/api/staff.api';
import { ReportButton } from '../../components/common/ReportButton';


// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const FIXED_TRAINING_ITEMS = [
  { name: 'DM Shoes', emoji: '👞', category: 'Footwear', hasSizes: true },
  { name: 'PT Shoes', emoji: '👟', category: 'Footwear', hasSizes: true },
  { name: 'Ankle Shoes', emoji: '🥾', category: 'Footwear', hasSizes: true },
  { name: 'PT T-Shirt', emoji: '👕', category: 'Uniform', hasSizes: true },
  { name: 'Ground Sheet', emoji: '🛏️', category: 'Bedding' },
  { name: 'Plate', emoji: '🍽️', category: 'Mess Item' },
  { name: 'Glass', emoji: '🥤', category: 'Mess Item' },
  { name: 'Bucket', emoji: '🪣', category: 'Equipment' },
  { name: 'Mug', emoji: '☕', category: 'Mess Item' },
  { name: 'Mess Tin', emoji: '🥫', category: 'Mess Item' },
  { name: 'Mosquito Net', emoji: '🦟', category: 'Bedding' },
  { name: 'Water Bottle', emoji: '💧', category: 'Equipment' },
  { name: 'Towel', emoji: '🧻', category: 'Equipment' },
  { name: 'Lock', emoji: '🔒', category: 'Equipment' },
];

const REQUIRED_DOCS = [
  'aadharCard', 'domicileCertificate', 'marksheet10th',
  'characterCertificate', 'medicalFitnessCert', 'eyeTestReport',
  'bloodGroupReport', 'policeVerification', 'noCriminalRecord',
  'passportPhoto', 'fullBodyPhoto', 'bankPassbook',
  'recruitmentAdmitCard', 'offerLetter',
];

const DOC_LABELS: Record<string, string> = {
  aadharCard: 'Aadhar Card',
  domicileCertificate: 'Domicile Certificate',
  marksheet10th: '10th Marksheet',
  characterCertificate: 'Character Certificate',
  medicalFitnessCert: 'Medical Fitness',
  eyeTestReport: 'Eye Test Report',
  bloodGroupReport: 'Blood Group Report',
  policeVerification: 'Police Verification',
  noCriminalRecord: 'No Criminal Record',
  passportPhoto: 'Passport Photo',
  fullBodyPhoto: 'Full Body Photo',
  bankPassbook: 'Bank Passbook',
  recruitmentAdmitCard: 'Admit Card',
  offerLetter: 'Offer Letter',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TRAINING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ROUTES: Record<string, string> = {
  trainees: '/profile',
  issueKit: '/issue-kit',
  documents: '/documents',
  weeklyProgram: '/weekly-program',
  fptTracker: '/test-records',
  weeklyTest: '/test-records',
  medicalRegister: '/medical-register',
  absentMgmt: '/absent-management',
  messFund: '/mess-fund',
  trainingFund: '/training-fund',
  companyAssets: '/company-assets-fund',
  generalFund: '/general-fund',
  vendorPayment: '/vendor-payments',
  fundsDashboard: '/funds',
  messBoySalary: '/mess-boy-salary',
  reports: '/reports',
  quartermaster: '/quartermaster',
  // ─── Staff Module Routes ─────────────────
  staff: '/staff',
  staffAttendance: '/staff-attendance',
  staffLeave: '/staff-leave',
  dutyManagement: '/duty-management',
  subjects: '/subjects',
  subjectAssignment: '/subject-assignment',
};

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface FundInfo {
  key: string;
  label: string;
  emoji: string;
  color: string;
  borderColor: string;
  collection: number;
  actuallyPaid: number;
  transferredOut: number;
  balance: number;
  vendorDue: number;
  totalOrders: number;
  pendingBills: number;
  entries: number;
}

interface FundRawData {
  collections: { id: string; amount: number; date: string; remarks?: string; monthLabel?: string }[];
  expenses: {
    id: string; amount: number; date: string; category?: string;
    categoryLabel?: string; vendor?: string; billStatus?: string;
    dueAmount?: number; paidAmount?: number; vendorId?: string;
  }[];
}

interface TraineeInfo {
  id: string;
  name: string;
  chestNo: string;
  regNo: string;
  platoon: string;
  rank: string;
  fatherName: string;
  rifleNo: string;
  attn: string;
  docsComplete: boolean;
  issuedKitItems: any[];
  documents: any;
  fptResult: string;
  weeklyExamResult: string;
  sickReports: number;
  batchId: string;
}

// ── NEW: AbsentRecord type for dashboard ──
interface AbsentRecordDash {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  platoon: string;
  type: string;
  reason: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: string;
  remarks: string;
}

interface ProgramSession {
  time: string;
  subject: string;
  customSubject: string;
  platoon: string;
  location: string;
  assignedPersons: { rank: string; name: string }[];
  lectureDetails?: { topic: string; description: string; duration: string; materials: string };
}

interface DaySchedule {
  day: string;
  sessions: ProgramSession[];
}

interface AlertItem {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  platoon: string;
  type: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const normalizeName = (v: string) => (v || '').trim().toLowerCase();
const fmtCurrency = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
const fmtTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateStr = (s: string) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
};

// ── Absent type label + color ──
const ABSENT_TYPE_MAP: Record<string, { label: string; shortLabel: string; color: string; bgColor: string; icon: string }> = {
  'A': { label: 'Absent (Unauthorized)', shortLabel: 'Absent', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', icon: '🚫' },
  'L': { label: 'Leave', shortLabel: 'Leave', color: 'text-amber-700', bgColor: 'bg-amber-100 border-amber-300', icon: '✈️' },
  'S': { label: 'Sick / MI Room', shortLabel: 'Sick', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300', icon: '🤒' },
  'H': { label: 'Hospital Admitted', shortLabel: 'Hospital', color: 'text-purple-700', bgColor: 'bg-purple-100 border-purple-300', icon: '🏥' },
  'R': { label: 'B/C Rest (Light Duty)', shortLabel: 'Rest', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300', icon: '🛌' },
  'M': { label: 'Medical Appointment', shortLabel: 'Med Appt', color: 'text-teal-700', bgColor: 'bg-teal-100 border-teal-300', icon: '🩺' },
};

const getAbsentTypeInfo = (type: string) =>
  ABSENT_TYPE_MAP[type] || { label: type, shortLabel: type, color: 'text-slate-600', bgColor: 'bg-slate-100 border-slate-300', icon: '❓' };

const calcActuallyPaid = (expList: any[]): number =>
  expList.reduce((s, e) => {
    if (e.vendorId) return s + Number(e.paidAmount ?? 0);
    return s + Number(e.amount ?? 0);
  }, 0);

const calcVendorDue = (expList: any[]): number =>
  expList.reduce((s, e) => s + Number(e.dueAmount ?? 0), 0);

const getTransferredOut = (fundKey: string, transfers: any[]): number =>
  transfers.filter(t => t.fromFundKey === fundKey).reduce((s, t) => s + Number(t.amount ?? 0), 0);

const todayDayName = DAY_NAMES[new Date().getDay()];
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrowDayName = DAY_NAMES[tomorrowDate.getDay()];

const calcHealthScore = (
  t: TraineeInfo,
  allItems: any[],
  fptMap: Record<string, any>,
  testMap: Record<string, any>,
  pendingRec: any[]
): number => {
  let score = 100;
  if (t.attn !== 'P') score -= 15;
  if (!t.docsComplete) score -= 20;
  const kitPct = allItems.length > 0 ? ((t.issuedKitItems?.length || 0) / allItems.length) * 100 : 100;
  if (kitPct < 100) score -= Math.round((100 - kitPct) * 0.15);
  const fpt = fptMap[t.id];
  if (fpt && !fpt.passed) score -= 20;
  const test = testMap[t.id];
  if (test && test.failCount > 0) score -= Math.min(test.failCount * 5, 15);
  const rec = pendingRec.find(r => r.traineeId === t.id);
  if (rec) score -= 10;
  return Math.max(0, Math.min(100, score));
};

// ─────────────────────────────────────────────
// FUND DETAIL MODAL
// ─────────────────────────────────────────────
const FundDetailModal: React.FC<{
  fund: FundInfo;
  rawData: FundRawData;
  onClose: () => void;
  onNavigate: (route: string) => void;
}> = ({ fund, rawData, onClose, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'expenses'>('collections');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const { collections, expenses } = rawData;
  const totalVendorDue = calcVendorDue(expenses);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeIn"
      onClick={handleBackdrop}
    >
      <div
        className="bg-white shadow-2xl max-w-3xl w-full rounded-2xl overflow-hidden max-h-[90vh] flex flex-col animate-slideUp"
        onClick={e => e.stopPropagation()}
      >
        <div className={`${fund.color} text-white px-5 py-4 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{fund.emoji}</span>
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-white">{fund.label}</p>
              <p className="text-white/60 text-[10px]">Detailed Fund View</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); onNavigate(ROUTES.fundsDashboard); }}
              className="text-[10px] font-bold text-white/80 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors border border-white/20">
              Full Dashboard →
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-0 border-b border-slate-200 flex-shrink-0">
          {[
            { l: 'Total Collection', v: fmtCurrency(fund.collection), c: 'text-green-700', bg: 'bg-green-50' },
            { l: 'Total Orders', v: fmtCurrency(fund.totalOrders), c: 'text-orange-700', bg: 'bg-orange-50' },
            { l: 'Actually Paid', v: fmtCurrency(fund.actuallyPaid), c: 'text-red-700', bg: 'bg-red-50' },
            { l: 'Cash Balance', v: (fund.balance < 0 ? '−' : '') + fmtCurrency(Math.abs(fund.balance)), c: fund.balance >= 0 ? 'text-slate-900' : 'text-red-700', bg: 'bg-white' },
          ].map(s => (
            <div key={s.l} className={`${s.bg} px-4 py-3 text-center border-r border-slate-100 last:border-0`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase">{s.l}</p>
              <p className={`text-base font-black mt-0.5 ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>

        {fund.transferredOut > 0 && (
          <div className="bg-purple-50 border-b border-purple-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <ArrowRightLeft size={12} className="text-purple-600 flex-shrink-0" />
            <p className="text-[10px] text-purple-700 font-bold">
              Transferred to General Fund: <strong>{fmtCurrency(fund.transferredOut)}</strong>
            </p>
          </div>
        )}
        {totalVendorDue > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <AlertTriangle size={12} className="text-amber-600 flex-shrink-0" />
            <p className="text-[10px] text-amber-700 font-bold">
              Vendor Pending Due: <strong>{fmtCurrency(totalVendorDue)}</strong> —{' '}
              <button type="button" onClick={(e) => { e.stopPropagation(); onNavigate(ROUTES.vendorPayment); }}
                className="underline hover:text-amber-900">
                Vendor Payment screen se clear karo
              </button>
            </p>
          </div>
        )}

        <div className="flex border-b border-slate-200 flex-shrink-0">
          {(['collections', 'expenses'] as const).map(t => (
            <button key={t} type="button" onClick={(e) => { e.stopPropagation(); setActiveTab(t); }}
              className={`px-6 py-2.5 text-[11px] font-black uppercase border-b-2 transition-colors ${
                activeTab === t ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {t === 'collections' ? `Collections (${collections.length})` : `Expenses (${expenses.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'collections' ? (
            collections.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ArrowDownToLine size={32} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm font-bold">Koi collection nahi</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {collections.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(c => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-green-50/50">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{c.monthLabel || c.remarks || 'Collection'}</p>
                      <p className="text-[10px] text-slate-400">{fmtDateStr(c.date)}</p>
                    </div>
                    <span className="text-sm font-black text-green-700">+{fmtCurrency(c.amount)}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            expenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ArrowUpFromLine size={32} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm font-bold">Koi expense nahi</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {expenses.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
                  <div key={e.id} className="px-4 py-3 flex items-center justify-between hover:bg-red-50/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {e.categoryLabel || e.category || 'Expense'}{e.vendor ? ` · ${e.vendor}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[10px] text-slate-400">{fmtDateStr(e.date)}</p>
                        {e.billStatus && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                            e.billStatus === 'Pending' ? 'bg-amber-100 text-amber-700'
                            : e.billStatus === 'Received' ? 'bg-blue-100 text-blue-700'
                            : e.billStatus === 'Verified' ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                          }`}>{e.billStatus}</span>
                        )}
                        {(e.dueAmount ?? 0) > 0 && (
                          <span className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            Due: {fmtCurrency(e.dueAmount!)}
                          </span>
                        )}
                        {e.vendorId && (e.dueAmount ?? 0) <= 0 && (
                          <span className="text-[8px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">✓ Paid</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className="text-sm font-black text-red-600">−{fmtCurrency(e.amount)}</span>
                      {e.vendorId && (e.paidAmount ?? 0) !== e.amount && (
                        <p className="text-[9px] text-green-600 font-bold">Paid: {fmtCurrency(e.paidAmount ?? 0)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <p className="text-[9px] text-slate-400 font-mono">Press ESC to close</p>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white px-4 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// ABSENT DETAIL MODAL — NEW
// ─────────────────────────────────────────────
const AbsentDetailModal: React.FC<{
  records: AbsentRecordDash[];
  traineeName: string;
  chestNo: string;
  platoon: string;
  attn: string;
  onClose: () => void;
}> = ({ records, traineeName, chestNo, platoon, attn, onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const typeInfo = getAbsentTypeInfo(attn);
  const activeRecord = records.find(r => r.status === 'Active');
  const historyRecords = records.filter(r => r.status !== 'Active' || r.id !== activeRecord?.id);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fadeIn"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white shadow-2xl max-w-2xl w-full rounded-2xl overflow-hidden max-h-[85vh] flex flex-col animate-slideUp"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
              {typeInfo.icon}
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase">{traineeName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded font-mono">Chest: {chestNo}</span>
                <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded">Platoon: {platoon || '—'}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${typeInfo.bgColor} ${typeInfo.color}`}>
                  {typeInfo.shortLabel}
                </span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Current / Active Absence */}
          {activeRecord ? (
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Current Absence (Active)
              </h3>
              <div className={`rounded-xl border-2 p-4 space-y-3 ${typeInfo.bgColor}`}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Absence Type</p>
                    <p className={`text-sm font-black mt-0.5 ${typeInfo.color}`}>{typeInfo.icon} {typeInfo.label}</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Total Days</p>
                    <p className="text-sm font-black mt-0.5 text-slate-800">{activeRecord.totalDays || 1} Days</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Calendar size={9} /> From Date
                    </p>
                    <p className="text-xs font-black mt-0.5 text-slate-800">{fmtDateStr(activeRecord.fromDate)}</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Calendar size={9} /> Expected Return
                    </p>
                    <p className="text-xs font-black mt-0.5 text-slate-800">{fmtDateStr(activeRecord.toDate)}</p>
                  </div>
                </div>
                <div className="bg-white/70 rounded-lg p-3">
                  <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <FileText size={9} /> Reason / Permission
                  </p>
                  <p className="text-xs font-bold mt-0.5 text-slate-800">{activeRecord.reason || '— Not Specified —'}</p>
                </div>
                {activeRecord.remarks && (
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Remarks / Notes</p>
                    <p className="text-xs font-bold mt-0.5 text-slate-700">{activeRecord.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <AlertCircle size={20} className="mx-auto text-amber-400 mb-1.5" />
              <p className="text-xs font-bold text-amber-700">
                Trainee ka attn field '{attn}' hai, lekin AbsentRecords mein Active record nahi mila.
              </p>
              <p className="text-[10px] text-amber-600 mt-1">
                Absent Management screen se record update karein.
              </p>
            </div>
          )}

          {/* History */}
          {historyRecords.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                Past Absence History ({historyRecords.length} records)
              </h3>
              <div className="space-y-2">
                {historyRecords.map(r => {
                  const ti = getAbsentTypeInfo(r.type);
                  return (
                    <div key={r.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{ti.icon}</span>
                          <span className={`text-[10px] font-bold ${ti.color}`}>{ti.shortLabel}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{fmtDateStr(r.fromDate)} → {fmtDateStr(r.toDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500">{r.totalDays || 1} days</span>
                          <span className="text-[9px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">Returned</span>
                        </div>
                      </div>
                      {r.reason && <p className="text-[10px] text-slate-500 mt-1 ml-6">{r.reason}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {records.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-xs font-bold text-slate-400">Koi record nahi mila</p>
              <p className="text-[10px] text-slate-300 mt-1">Absent Management screen se record add karein</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <p className="text-[9px] text-slate-400 font-mono">Press ESC to close</p>
          <button type="button" onClick={onClose}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white px-4 py-1.5 rounded-lg border border-slate-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────
const ProgressBar: React.FC<{
  value: number; max: number; color?: string; height?: number; showLabel?: boolean; label?: string;
}> = ({ value, max, color = 'bg-green-500', height = 6, showLabel = true, label }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
          <span className="text-[9px] font-black text-slate-700">{value}/{max} ({Math.round(pct)}%)</span>
        </div>
      )}
      <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
        <div className={`${color} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%`, height: '100%' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// COLLAPSIBLE SECTION
// ─────────────────────────────────────────────
const CollapsibleSection: React.FC<{
  title: string; subtitle?: string; icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  urgentCount?: number; defaultOpen?: boolean;
  headerRight?: React.ReactNode; children: React.ReactNode;
  accentColor?: string;
}> = ({ title, subtitle, icon, action, urgentCount, defaultOpen = true, headerRight, children, accentColor = 'border-l-military-700' }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300 border-l-4 ${accentColor}`}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
        <div className="flex items-center gap-3">
          {icon && <span className="text-slate-500">{icon}</span>}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{title}</p>
              {urgentCount !== undefined && urgentCount > 0 && (
                <span className="text-[9px] font-black bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                  {urgentCount}
                </span>
              )}
            </div>
            {subtitle && <p className="text-[9px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {action && (
            <span role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); action.onClick(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); action.onClick(); } }}
              className="flex items-center gap-1 text-[10px] font-bold text-military-700 hover:text-military-900 uppercase tracking-wide bg-military-50 hover:bg-military-100 px-3 py-1.5 rounded-lg border border-military-200 transition-colors cursor-pointer">
              {action.label} <ArrowRight size={10} />
            </span>
          )}
          <div className={`transform transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
            <ChevronDown size={16} className="text-slate-400" />
          </div>
        </div>
      </button>
      <div className={`transition-all duration-300 ease-in-out ${open ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="px-5 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// ALERT PANEL
// ─────────────────────────────────────────────
const AlertPanel: React.FC<{
  title: string; icon: React.ReactNode; items: AlertItem[];
  accentColor: string; maxShow?: number; onViewAll?: () => void;
}> = ({ title, icon, items, accentColor, maxShow = 4, onViewAll }) => {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items : items.slice(0, maxShow);
  const highCount = items.filter(i => i.severity === 'high').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accentColor}`}>{icon}</div>
          <div>
            <span className="text-[11px] font-black text-slate-700 uppercase">{title}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-bold text-slate-400">{items.length} total</span>
              {highCount > 0 && (
                <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">{highCount} urgent</span>
              )}
            </div>
          </div>
        </div>
        {items.length > maxShow && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase flex items-center gap-0.5 bg-slate-50 px-2 py-1 rounded-lg">
            {expanded ? 'Less' : `+${items.length - maxShow}`}
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center">
          <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={20} className="text-green-400" />
          </div>
          <p className="text-[10px] text-green-600 font-bold">All Clear! ✅</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
          {displayItems.map((item, idx) => (
            <div key={`${item.id}_${idx}`}
              className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-default">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    item.severity === 'high' ? 'bg-red-500 animate-pulse'
                    : item.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <span className="text-[10px] font-mono font-black text-military-800 bg-military-50 px-1.5 py-0.5 rounded border border-military-100">
                    {item.chestNo}
                  </span>
                  <span className="text-[10px] font-bold text-slate-700 truncate">{item.traineeName}</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5 truncate ml-[22px]">{item.detail}</p>
              </div>
              <span className={`text-[8px] font-bold px-2 py-1 rounded-lg ml-2 flex-shrink-0 ${
                item.severity === 'high' ? 'bg-red-50 text-red-600 border border-red-200'
                : item.severity === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}>{item.type}</span>
            </div>
          ))}
        </div>
      )}
      {onViewAll && items.length > 0 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onViewAll(); }}
          className="w-full px-4 py-2.5 text-[9px] font-bold text-military-600 hover:text-military-800 border-t border-slate-100 hover:bg-military-50/50 uppercase flex items-center justify-center gap-1 transition-colors">
          View All Details <ChevronRight size={10} />
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// TRAINEE PROFILE MODAL
// ─────────────────────────────────────────────
const TraineeProfileModal: React.FC<{
  trainee: TraineeInfo;
  fptRecords: any[];
  weeklyTests: any[];
  medicalRecords: any[];
  recoveries: any[];
  allTrainingItems: any[];
  healthScore: number;
  onClose: () => void;
}> = ({ trainee, fptRecords, weeklyTests, medicalRecords, recoveries, allTrainingItems, healthScore, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'kit' | 'fpt' | 'tests' | 'medical' | 'recovery'>('overview');
  const [expandedFptId, setExpandedFptId] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const docStatuses = REQUIRED_DOCS.map(key => {
    const d = trainee.documents?.[key];
    return {
      key, label: DOC_LABELS[key] || key,
      status: d?.status || (d?.fileName ? 'Uploaded' : 'Pending'),
      isRequired: d?.isRequired !== false,
    };
  });
  const docsDone = docStatuses.filter(d => d.status === 'Uploaded' || d.status === 'Verified').length;
  const docsRequired = docStatuses.filter(d => d.isRequired).length;

  const issuedNames = (trainee.issuedKitItems || []).map((i: any) => normalizeName(i.itemName));
  const kitTotal = allTrainingItems.length;
  const kitIssued = allTrainingItems.filter((i: any) => issuedNames.includes(normalizeName(i.name))).length;

  const fptList = fptRecords.sort((a: any, b: any) => (b.weekNumber || 0) - (a.weekNumber || 0));
  const everFptPassed = fptList.some((r: any) => r.result === 'Pass');
  const bestFptPct = fptList.length > 0 ? Math.max(...fptList.map((r: any) => r.percentage || 0)) : 0;

  const testList = weeklyTests.sort((a: any, b: any) => (b.weekNumber || 0) - (a.weekNumber || 0));
  const testsPassed = testList.filter((r: any) => r.result === 'Pass').length;
  const testsFailed = testList.filter((r: any) => r.result === 'Fail').length;

  const medAll = medicalRecords;
  const medActive = medAll.filter((r: any) => r.status === 'Active');

  const traineeRecoveries = recoveries.filter((r: any) => r.traineeId === trainee.id && r.status !== 'Paid');
  const recoveryDue = traineeRecoveries.reduce((s: number, r: any) => s + (r.dueAmount || 0), 0);

  const attnMap: Record<string, { text: string; cls: string; bg: string }> = {
    'P': { text: 'Present', cls: 'text-green-700', bg: 'bg-green-100' },
    'A': { text: 'Absent', cls: 'text-red-700', bg: 'bg-red-100' },
    'L': { text: 'Leave', cls: 'text-amber-700', bg: 'bg-amber-100' },
    'S': { text: 'Sick', cls: 'text-orange-700', bg: 'bg-orange-100' },
    'H': { text: 'Hospital', cls: 'text-purple-700', bg: 'bg-purple-100' },
    'R': { text: 'B/C Rest', cls: 'text-blue-700', bg: 'bg-blue-100' },
    'M': { text: 'Medical Appt', cls: 'text-teal-700', bg: 'bg-teal-100' },
  };
  const attn = attnMap[trainee.attn] || attnMap['P'];
  const scoreColor = healthScore >= 80 ? '#22c55e' : healthScore >= 60 ? '#f59e0b' : '#ef4444';

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <Eye size={11} />, count: null },
    { key: 'documents', label: 'Docs', icon: <FileText size={11} />, count: `${docsDone}/${docsRequired}` },
    { key: 'kit', label: 'Kit', icon: <Package size={11} />, count: `${kitIssued}/${kitTotal}` },
    { key: 'fpt', label: 'FPT', icon: <Crosshair size={11} />, count: String(fptList.length) },
    { key: 'tests', label: 'Tests', icon: <Award size={11} />, count: String(testList.length) },
    { key: 'medical', label: 'Medical', icon: <HeartPulse size={11} />, count: medActive.length > 0 ? String(medActive.length) : null },
    { key: 'recovery', label: 'Recovery', icon: <CreditCard size={11} />, count: recoveryDue > 0 ? fmtCurrency(recoveryDue) : null },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-start justify-center p-4 pt-6 overflow-y-auto animate-fadeIn"
      onClick={handleBackdropClick}>
      <div className="bg-white shadow-2xl max-w-4xl w-full rounded-2xl overflow-hidden animate-slideUp mb-6"
        onClick={e => e.stopPropagation()}>

        <div className="bg-gradient-to-r from-military-900 via-military-800 to-military-900 text-white px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg width={64} height={64} className="-rotate-90">
                  <circle cx={32} cy={32} r={26} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={5} />
                  <circle cx={32} cy={32} r={26} fill="none" stroke={scoreColor} strokeWidth={5} strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={2 * Math.PI * 26 - (healthScore / 100) * 2 * Math.PI * 26} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black" style={{ color: scoreColor }}>{healthScore}</span>
                </div>
              </div>
              <div>
                <p className="text-lg font-black uppercase tracking-wider text-white">{trainee.rank || 'RCT'} {trainee.name}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded font-mono border border-white/20">Chest: {trainee.chestNo}</span>
                  <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded font-mono border border-white/20">Reg: {trainee.regNo || '—'}</span>
                  <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded border border-white/20">Platoon: {trainee.platoon || '—'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[10px] font-black px-3 py-1 rounded-full ${attn.bg} ${attn.cls}`}>{attn.text}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
            {[
              { label: 'Health', value: `${healthScore}/100`, color: healthScore >= 80 ? 'text-green-400' : healthScore >= 60 ? 'text-amber-400' : 'text-red-400' },
              { label: 'FPT', value: everFptPassed ? `Pass ${bestFptPct}%` : fptList.length > 0 ? 'Not Passed' : '—', color: everFptPassed ? 'text-green-400' : 'text-red-400' },
              { label: 'Tests', value: `${testsPassed}P / ${testsFailed}F`, color: testsFailed === 0 ? 'text-green-400' : 'text-amber-400' },
              { label: 'Docs', value: `${docsDone}/${docsRequired}`, color: docsDone >= docsRequired ? 'text-green-400' : 'text-amber-400' },
              { label: 'Kit', value: `${kitIssued}/${kitTotal}`, color: kitIssued >= kitTotal ? 'text-green-400' : 'text-amber-400' },
              { label: 'Recovery', value: recoveryDue > 0 ? fmtCurrency(recoveryDue) : 'Clear', color: recoveryDue > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-lg px-2 py-1.5 text-center border border-white/10">
                <p className="text-[8px] font-bold text-white/50 uppercase">{s.label}</p>
                <p className={`text-[10px] font-black mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} type="button"
              onClick={(e) => { e.stopPropagation(); setActiveTab(t.key); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-black uppercase border-b-2 whitespace-nowrap transition-all ${
                activeTab === t.key ? 'border-military-700 text-military-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {t.icon} <span>{t.label}</span>
              {t.count && (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeTab === t.key ? 'bg-military-100 text-military-700' : 'bg-slate-100 text-slate-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[50vh] overflow-y-auto bg-slate-50/30">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Personal Details</h4>
                <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-2.5">
                  {[
                    { l: 'Full Name', v: `${trainee.rank || 'RCT'} ${trainee.name}`, icon: '👤' },
                    { l: "Father's Name", v: trainee.fatherName || '—', icon: '👨' },
                    { l: 'Chest No', v: trainee.chestNo, icon: '#️⃣' },
                    { l: 'Registration', v: trainee.regNo || '—', icon: '📋' },
                    { l: 'Platoon', v: trainee.platoon || '—', icon: '🏷️' },
                    { l: 'Rifle No', v: trainee.rifleNo || '—', icon: '🔫' },
                    { l: 'Sick Reports', v: String(trainee.sickReports || 0), icon: '🏥' },
                  ].map(f => (
                    <div key={f.l} className="flex items-center justify-between text-[11px] border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-slate-500 font-semibold flex items-center gap-1.5"><span>{f.icon}</span> {f.l}</span>
                      <span className="font-bold text-slate-800">{f.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Status Overview</h4>
                <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-3">
                  <ProgressBar value={docsDone} max={docsRequired} label="Documents"
                    color={docsDone >= docsRequired ? 'bg-green-500' : 'bg-amber-500'} />
                  <ProgressBar value={kitIssued} max={kitTotal} label="Kit Items"
                    color={kitIssued >= kitTotal ? 'bg-green-500' : 'bg-blue-500'} />
                  <ProgressBar value={healthScore} max={100} label="Health Score"
                    color={healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-red-500'} />
                </div>
                {medActive.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-red-700 uppercase mb-1.5">🏥 Active Medical</p>
                    {medActive.map((m: any) => (
                      <p key={m.id} className="text-[10px] text-red-600">• {m.category}: {m.diagnosis}</p>
                    ))}
                  </div>
                )}
                {traineeRecoveries.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-amber-700 uppercase mb-1.5">💳 Pending Recovery</p>
                    {traineeRecoveries.map((r: any) => (
                      <p key={r.id} className="text-[10px] text-amber-600">• {r.label}: {fmtCurrency(r.dueAmount)} due</p>
                    ))}
                  </div>
                )}
                {medActive.length === 0 && traineeRecoveries.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <CheckCircle2 size={24} className="mx-auto text-green-400 mb-1.5" />
                    <p className="text-[11px] text-green-700 font-bold">No Issues — All Clear! 🎉</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-1.5">
              <div className="mb-3">
                <ProgressBar value={docsDone} max={docsRequired} label="Overall Document Progress"
                  color={docsDone >= docsRequired ? 'bg-green-500' : 'bg-blue-500'} height={8} />
              </div>
              {docStatuses.map(d => (
                <div key={d.key} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                  d.status === 'Verified' ? 'bg-green-50 border-green-200'
                  : d.status === 'Uploaded' ? 'bg-blue-50 border-blue-200'
                  : d.status === 'Rejected' ? 'bg-red-50 border-red-200'
                  : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    {d.status === 'Verified' ? <CheckCircle2 size={14} className="text-green-500" />
                    : d.status === 'Uploaded' ? <Eye size={14} className="text-blue-500" />
                    : d.status === 'Rejected' ? <XCircle size={14} className="text-red-500" />
                    : <AlertCircle size={14} className="text-slate-300" />}
                    <span className="text-[11px] font-bold text-slate-700">{d.label}</span>
                    {d.isRequired && <span className="text-[8px] text-red-500 font-black">REQUIRED</span>}
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg ${
                    d.status === 'Verified' ? 'bg-green-600 text-white'
                    : d.status === 'Uploaded' ? 'bg-blue-600 text-white'
                    : d.status === 'Rejected' ? 'bg-red-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                  }`}>{d.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'kit' && (
            <div className="space-y-1.5">
              <div className="mb-3">
                <ProgressBar value={kitIssued} max={kitTotal} label="Kit Issue Progress"
                  color={kitIssued >= kitTotal ? 'bg-green-500' : 'bg-indigo-500'} height={8} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {allTrainingItems.map((item: any) => {
                  const issued = (trainee.issuedKitItems || []).find(
                    (i: any) => normalizeName(i.itemName) === normalizeName(item.name)
                  );
                  return (
                    <div key={item.name} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
                      issued ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {issued ? <CheckCircle2 size={13} className="text-green-500" /> : <XCircle size={13} className="text-red-400" />}
                        <span className="text-base">{item.emoji}</span>
                        <div>
                          <span className="text-[10px] font-bold text-slate-700">{item.name}</span>
                          <span className="text-[8px] text-slate-400 ml-1.5">{item.category}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${
                        issued ? 'bg-green-600 text-white' : 'bg-red-100 text-red-600'
                      }`}>{issued ? '✓ Received' : 'Pending'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'fpt' && (
            fptList.length === 0 ? (
              <div className="text-center py-10">
                <Crosshair size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-[11px] text-slate-400 font-bold">No FPT records</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fptList.map((r: any, idx: number) => {
                  const rowId = String(r.id || `fpt-${idx}`);
                  const isOpen = expandedFptId === rowId;
                  const resultIsPass = r.result === 'Pass';
                  const events = Array.isArray(r.events) ? r.events : [];
                  return (
                    <div key={rowId} className={`rounded-xl border overflow-hidden ${
                      resultIsPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedFptId(isOpen ? null : rowId);
                        }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                          <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">W{r.weekNumber || '—'}</span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-slate-800 truncate">
                              FPT Attempt · {r.obtainedMarks ?? r.marks ?? 0}/{r.totalMarks ?? '—'} marks
                            </p>
                            <p className="text-[9px] text-slate-500">
                              Date: {r.testDate || r.date || '—'} · Events: {events.length || 'N/A'} · Click for details
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg flex-shrink-0 ${
                          resultIsPass ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}>{r.percentage ?? 0}% {resultIsPass ? 'PASS ✅' : 'FAIL ❌'}</span>
                      </button>

                      {isOpen && (
                        <div className="border-t border-white/70 bg-white px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                            {[
                              ['Result', r.result || '—'],
                              ['Obtained', `${r.obtainedMarks ?? r.marks ?? 0}/${r.totalMarks ?? '—'}`],
                              ['Percentage', `${r.percentage ?? 0}%`],
                              ['Passing', r.totalPassingMarks ?? r.passingMarks ?? '—'],
                              ['Events Passed', r.eventsPassed ?? '—'],
                              ['Events Failed', r.eventsFailed ?? '—'],
                              ['Overall Pass %', r.overallPassPercent ? `${r.overallPassPercent}%` : '—'],
                              ['Remarks', r.remarks || '—'],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                                <p className="text-[8px] font-black text-slate-400 uppercase">{label}</p>
                                <p className="text-[10px] font-bold text-slate-800 mt-0.5 break-words">{String(value)}</p>
                              </div>
                            ))}
                          </div>

                          {events.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Event-wise details</p>
                              {events.map((ev: any, evIdx: number) => (
                                <div key={`${rowId}-event-${evIdx}`} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                                  ev.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                }`}>
                                  <div>
                                    <p className="text-[10px] font-black text-slate-800">{ev.name || `Event ${evIdx + 1}`}</p>
                                    <p className="text-[9px] text-slate-500">
                                      Passing: {ev.passingMarks ?? '—'} · Max: {ev.maxMarks ?? '—'}
                                      {ev.runningGrade ? ` · Grade: ${ev.runningGrade}` : ''}
                                    </p>
                                  </div>
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                                    ev.passed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                  }`}>
                                    {ev.marks ?? 0}/{ev.maxMarks ?? '—'} {ev.passed ? 'PASS' : 'FAIL'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'tests' && (
            testList.length === 0 ? (
              <div className="text-center py-10">
                <Award size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-[11px] text-slate-400 font-bold">No test records</p>
              </div>
            ) : (
              <div className="space-y-2">
                {testList.map((r: any, idx: number) => {
                  const rowId = String(r.id || `test-${idx}`);
                  const isOpen = expandedTestId === rowId;
                  const resultIsPass = r.result === 'Pass';
                  return (
                    <div key={rowId} className={`rounded-xl border overflow-hidden ${
                      resultIsPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTestId(isOpen ? null : rowId);
                        }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                          <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-lg flex-shrink-0">W{r.weekNumber || '—'}</span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 truncate">{r.testName || 'Weekly Test'}</p>
                            <p className="text-[9px] text-slate-500">
                              {r.subject || '—'} · {r.testDate || '—'} · {r.obtainedMarks ?? r.marks ?? 0}/{r.totalMarks ?? '—'} marks
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg flex-shrink-0 ${
                          resultIsPass ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}>{r.percentage ?? 0}% {resultIsPass ? 'PASS ✅' : 'FAIL ❌'}</span>
                      </button>

                      {isOpen && (
                        <div className="border-t border-white/70 bg-white px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                              ['Test Name', r.testName || 'Weekly Test'],
                              ['Subject', r.subject || '—'],
                              ['Result', r.result || '—'],
                              ['Date', r.testDate || '—'],
                              ['Obtained Marks', r.obtainedMarks ?? r.marks ?? 0],
                              ['Total Marks', r.totalMarks ?? '—'],
                              ['Percentage', `${r.percentage ?? 0}%`],
                              ['Remarks', r.remarks || '—'],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                                <p className="text-[8px] font-black text-slate-400 uppercase">{label}</p>
                                <p className="text-[10px] font-bold text-slate-800 mt-0.5 break-words">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'medical' && (
            medAll.length === 0 ? (
              <div className="text-center py-10">
                <HeartPulse size={32} className="mx-auto text-green-300 mb-2" />
                <p className="text-[11px] text-green-600 font-bold">Medically Fit! ✅</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {medAll.map((r: any) => (
                  <div key={r.id} className={`px-4 py-3 rounded-xl border ${
                    r.status === 'Active' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">{r.category}: {r.diagnosis}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${
                        r.status === 'Active' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                      }`}>{r.status === 'Active' ? '● Active' : '✓ Fit'}</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1">{r.date} {r.remarks || ''}</p>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'recovery' && (
            traineeRecoveries.length === 0 ? (
              <div className="text-center py-10">
                <CreditCard size={32} className="mx-auto text-green-300 mb-2" />
                <p className="text-[11px] text-green-600 font-bold">No pending recovery! ✅</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {traineeRecoveries.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800">{r.label}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        Expected: {fmtCurrency(r.expectedAmount)} · Paid: {fmtCurrency(r.paidAmount)}
                      </p>
                    </div>
                    <span className="text-sm font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-200">
                      {fmtCurrency(r.dueAmount)} due
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[9px] text-slate-400 font-mono">Press ESC to close</p>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white px-4 py-1.5 rounded-lg border border-slate-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════
export const CompanyCommanderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const go = useCallback((route: string) => { navigate(route); }, [navigate]);

  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  // ── State ──
  const [trainees, setTrainees] = useState<TraineeInfo[]>([]);
  const [fptRecords, setFptRecords] = useState<any[]>([]);
  const [weeklyTests, setWeeklyTests] = useState<any[]>([]);
  const [allMedical, setAllMedical] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [recoveries, setRecoveries] = useState<any[]>([]);
  const [funds, setFunds] = useState<FundInfo[]>([]);
  const [vendorDues, setVendorDues] = useState<any[]>([]);
  const [allTrainingItems, setAllTrainingItems] = useState<any[]>([]);

  // ── NEW: Absent Records for dashboard ──
  const [absentRecords, setAbsentRecords] = useState<AbsentRecordDash[]>([]);
  // ─── Staff Module Stats ──────────────────────
const [staffSummary, setStaffSummary] = useState({
  total: 0,
  active: 0,
  onLeave: 0,
  onTD: 0,
  inHospital: 0,
  onCourse: 0,
  inactive: 0,
});
const [staffLoading, setStaffLoading] = useState(false);

  // ── Fund raw data ──
  const [fundRawDataMap, setFundRawDataMap] = useState<Record<string, FundRawData>>({});

  // ── UI State ──
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [rosterFilter, setRosterFilter] = useState<string>('ALL');
  const [selectedTrainee, setSelectedTrainee] = useState<TraineeInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL / 1000);
  const [platoonFilter, setPlatoonFilter] = useState<string>('ALL');
  const rosterSectionRef = useRef<HTMLDivElement>(null);

  // ── Fund Detail Modal ──
  const [selectedFund, setSelectedFund] = useState<FundInfo | null>(null);

  // ── NEW: Absent Detail Modal ──
  const [absentModalTrainee, setAbsentModalTrainee] = useState<TraineeInfo | null>(null);

  // Auto-refresh countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setAutoRefreshCountdown(prev => {
        if (prev <= 1) { fetchAllData(); return AUTO_REFRESH_INTERVAL / 1000; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── FETCH ──
  const fetchAllData = useCallback(async () => {
    if (!activeBatch) { setLoading(false); return; }
    setLoading(true);
    setErrorMsg('');

    try {
      const [
        traineesSnap, absentSnap, medicalSnap,
        fptSnap, testSnap, programSnap,
      ] = await Promise.all([
        getDocs(query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id))),
        // ── FIX: fetch ALL absent records (not just Active) for dashboard ──
        getDocs(query(collection(db, 'absentRecords'), where('batchId', '==', activeBatch.id))),
        getDocs(query(collection(db, 'medicalRecords'), where('batchId', '==', activeBatch.id))),
        getDocs(query(collection(db, 'fptRecords'), where('batchId', '==', activeBatch.id))),
        getDocs(query(collection(db, 'weeklyTestRecords'), where('batchId', '==', activeBatch.id))),
        getDocs(query(collection(db, 'weeklyPrograms'), where('batchId', '==', activeBatch.id))),
      ]);

      const [
        messColSnap, messExpSnap, trainColSnap, trainExpSnap,
        assetColSnap, assetExpSnap, genColSnap, genExpSnap,
        transferSnap, recoverySnap, veSnap, customItemSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'mess_fund_collections')),
        getDocs(collection(db, 'mess_fund_expenses')),
        getDocs(collection(db, 'training_fund_collections')),
        getDocs(collection(db, 'training_fund_expenses')),
        getDocs(collection(db, 'company_assets_collections')),
        getDocs(collection(db, 'company_assets_expenses')),
        getDocs(collection(db, 'general_fund_collections')),
        getDocs(collection(db, 'general_fund_expenses')),
        getDocs(collection(db, 'fund_transfers')),
        getDocs(collection(db, 'training_fund_recoveries')),
        getDocs(collection(db, 'vendor_entries')),
        getDocs(collection(db, 'training_custom_items')),
      ]);

      // ── Trainees ──
      const traineeList: TraineeInfo[] = [];
      traineesSnap.forEach(d => {
        const data = d.data();
        traineeList.push({
          id: d.id, name: data.name ?? '', chestNo: data.chestNo ?? '',
          regNo: data.regNo ?? '', platoon: normalizePlatoon(data.platoon), rank: data.rank ?? 'RCT',
          fatherName: data.fatherName ?? '', rifleNo: data.rifleNo ?? '',
          attn: data.attn ?? 'P', docsComplete: data.docsComplete ?? false,
          issuedKitItems: data.issuedKitItems ?? [], documents: data.documents ?? {},
          fptResult: data.fptResult ?? '', weeklyExamResult: data.weeklyExamResult ?? '',
          sickReports: data.sickReports ?? 0, batchId: data.batchId ?? '',
        });
      });
      traineeList.sort((a, b) => (a.chestNo || '').localeCompare(b.chestNo || ''));
      setTrainees(traineeList);

      // ── NEW: Absent Records — ALL records (Active + Returned) ──
      const absList: AbsentRecordDash[] = [];
      absentSnap.forEach(d => {
        const data = d.data();
        absList.push({
          id: d.id,
          traineeId: data.traineeId ?? '',
          traineeName: data.traineeName ?? '',
          chestNo: data.chestNo ?? '',
          regNo: data.regNo ?? '',
          platoon: data.platoon ?? '',
          type: data.type ?? 'A',
          reason: data.reason ?? '',
          fromDate: data.fromDate ?? '',
          toDate: data.toDate ?? '',
          totalDays: data.totalDays ?? 1,
          status: data.status ?? 'Active',
          remarks: data.remarks ?? '',
        });
      });
      setAbsentRecords(absList);

      const medList: any[] = [];
      medicalSnap.forEach(d => medList.push({ id: d.id, ...d.data() }));
      setAllMedical(medList);

      const fptList: any[] = [];
      fptSnap.forEach(d => fptList.push({ id: d.id, ...d.data() }));
      setFptRecords(fptList);

      const testList: any[] = [];
      testSnap.forEach(d => testList.push({ id: d.id, ...d.data() }));
      setWeeklyTests(testList);

      const progList: any[] = [];
      programSnap.forEach(d => progList.push({ id: d.id, ...d.data() }));
      progList.sort((a, b) => new Date(b.fromDate || 0).getTime() - new Date(a.fromDate || 0).getTime());
      setPrograms(progList);

      const recList: any[] = [];
      recoverySnap.forEach(d => recList.push({ id: d.id, ...d.data() }));
      const traineeIds = new Set(traineeList.map(t => t.id));
      setRecoveries(recList.filter(r => traineeIds.has(r.traineeId)));

      const transfers: any[] = [];
      transferSnap.forEach(d => transfers.push({ ...d.data() }));

      const buildRaw = (colSnap: any, expSnap: any): FundRawData => {
        const cols: FundRawData['collections'] = [];
        const exps: FundRawData['expenses'] = [];
        colSnap.forEach((d: any) => {
          const data = d.data();
          cols.push({ id: d.id, amount: Number(data.amount ?? 0), date: data.date ?? '', monthLabel: data.monthLabel ?? data.label ?? '', remarks: data.remarks ?? data.label ?? '' });
        });
        expSnap.forEach((d: any) => {
          const data = d.data();
          exps.push({ id: d.id, amount: Number(data.amount ?? 0), date: data.date ?? '', category: data.category ?? '', categoryLabel: data.categoryLabel ?? data.itemName ?? '', vendor: data.vendor ?? '', vendorId: data.vendorId ?? data.linkedVendorId ?? '', billStatus: data.billStatus ?? '', dueAmount: Number(data.dueAmount ?? 0), paidAmount: Number(data.paidAmount ?? 0) });
        });
        return { collections: cols, expenses: exps };
      };

      const rawMess = buildRaw(messColSnap, messExpSnap);
      const rawTrain = buildRaw(trainColSnap, trainExpSnap);
      const rawAsset = buildRaw(assetColSnap, assetExpSnap);
      const rawGen = buildRaw(genColSnap, genExpSnap);

      setFundRawDataMap({ mess_fund: rawMess, training_fund: rawTrain, company_assets_fund: rawAsset, general_fund: rawGen });

      const buildFund = (key: string, label: string, emoji: string, color: string, borderColor: string, colData: FundRawData): FundInfo => {
        const col = colData.collections.reduce((s, c) => s + c.amount, 0);
        const paid = calcActuallyPaid(colData.expenses);
        const due = calcVendorDue(colData.expenses);
        const transferred = getTransferredOut(key, transfers);
        const pendingBills = colData.expenses.filter(e => e.billStatus === 'Pending').length;
        const totalOrders = colData.expenses.reduce((s, e) => s + e.amount, 0);
        return { key, label, emoji, color, borderColor, collection: col, actuallyPaid: paid, transferredOut: transferred, balance: col - paid - transferred, vendorDue: due, totalOrders, pendingBills, entries: colData.collections.length + colData.expenses.length };
      };

      setFunds([
        buildFund('mess_fund', 'Mess Fund', '🍽️', 'bg-orange-600', 'border-orange-500', rawMess),
        buildFund('training_fund', 'Training Essentials Fund', '🎓', 'bg-blue-700', 'border-blue-500', rawTrain),
        buildFund('company_assets_fund', 'Company Assets Fund', '🏛️', 'bg-green-700', 'border-green-600', rawAsset),
        buildFund('general_fund', 'General Fund', '💰', 'bg-slate-800', 'border-slate-700', rawGen),
      ]);

      const vDueMap: Record<string, any> = {};
      veSnap.forEach(d => {
        const data = d.data();
        const due = Number(data.dueAmount ?? 0);
        if (due <= 0) return;
        const vId = data.vendorId ?? '';
        if (!vDueMap[vId]) vDueMap[vId] = { vendorId: vId, vendorName: data.vendorName ?? '', categoryLabel: data.categoryLabel ?? '', totalDue: 0, entries: 0 };
        vDueMap[vId].totalDue += due;
        vDueMap[vId].entries += 1;
      });
      setVendorDues(Object.values(vDueMap).sort((a: any, b: any) => b.totalDue - a.totalDue));

      const items = [...FIXED_TRAINING_ITEMS];
      customItemSnap.forEach(d => {
        const data = d.data();
        items.push({ name: data.name ?? '', emoji: data.emoji ?? '📦', category: data.category ?? 'Other', hasSizes: data.hasSizes ?? false });
      });
      setAllTrainingItems(items);

               // ─── Fetch Staff Summary (batch-wise) ────
      try {
        setStaffLoading(true);
        if (activeBatch?.id) {
          const staffData = await getStaffSummary(activeBatch.id);

          // 🆕 CROSS-CHECK WITH ACTIVE LEAVES
          const leavesSnap = await getDocs(
            query(
              collection(db, 'staff_leave'),
              where('status', '==', 'approved')
            )
          );

          const today = new Date();
          today.setHours(12, 0, 0, 0);

          const currentlyOnLeaveCount = leavesSnap.docs.filter(d => {
            const data = d.data();
            const fromDate = data.fromDate?.toDate();
            const toDate = data.toDate?.toDate();
            if (!fromDate || !toDate) return false;
            return today >= fromDate && today <= toDate && !data.returnDate;
          }).length;

          // Use max of staff.status count or active leaves count
          const actualOnLeave = Math.max(staffData.onLeave, currentlyOnLeaveCount);

          setStaffSummary({
            ...staffData,
            onLeave: actualOnLeave,
          });
        }
      } catch (staffErr) {
        console.warn('Staff summary fetch error:', staffErr);
      } finally {
        setStaffLoading(false);
      }

      setLastRefresh(new Date());
      setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL / 1000);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      setErrorMsg('Data load error. Refresh karein.');
    } finally {
      setLoading(false);
    }
  }, [activeBatch]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ── COMPUTED ──
  // Single status source: summary cards, away table and roster filters all use this normalized code.
  const getTraineeAttnCode = (attnValue?: string): 'P' | 'A' | 'S' | 'H' | 'L' | 'R' | 'M' => {
    const v = String(attnValue || 'P').toLowerCase();
    if (v === 'a' || v.includes('absent')) return 'A';
    if (v === 's' || v.includes('sick')) return 'S';
    if (v === 'h' || v.includes('hospital')) return 'H';
    if (v === 'l' || v.includes('leave') || v.includes('away')) return 'L';
    if (v === 'r' || v.includes('rest')) return 'R';
    if (v === 'm' || v.includes('medical')) return 'M';
    return 'P';
  };

  const getMedicalAttnCode = (category?: string): 'S' | 'H' | 'R' | 'M' => {
    if (category === 'Hospital Admit') return 'H';
    if (category === 'B-Rest' || category === 'C-Rest') return 'R';
    if (category === 'Medical Board') return 'M';
    return 'S';
  };

  const getDashboardAttnCode = (trainee: TraineeInfo): 'P' | 'A' | 'S' | 'H' | 'L' | 'R' | 'M' => {
    const activeMed = allMedical.find((m: any) => m.traineeId === trainee.id && m.status === 'Active');
    if (activeMed) return getMedicalAttnCode(activeMed.category);
    return getTraineeAttnCode(trainee.attn);
  };

  const totalTrainees = trainees.length;
  const presentToday = trainees.filter(t => getDashboardAttnCode(t) === 'P').length;
  const absentCount = trainees.filter(t => getDashboardAttnCode(t) === 'A').length;
  const sickCount = trainees.filter(t => getDashboardAttnCode(t) === 'S').length;
  const leaveCount = trainees.filter(t => getDashboardAttnCode(t) === 'L').length;
  const restCount = trainees.filter(t => getDashboardAttnCode(t) === 'R').length;
  const hospitalCount = trainees.filter(t => getDashboardAttnCode(t) === 'H').length;
  const medApptCount = trainees.filter(t => getDashboardAttnCode(t) === 'M').length;


  const docsCompleteCount = trainees.filter(t => t.docsComplete).length;
  const docsPendingCount = totalTrainees - docsCompleteCount;
  const kitFullCount = trainees.filter(t => t.issuedKitItems && t.issuedKitItems.length >= allTrainingItems.length).length;
  const kitPendingCount = totalTrainees - kitFullCount;

  const platoons = useMemo(() => ['ALL', ...PLATOON_OPTIONS], []);

  // FPT Analysis
  const fptTraineeMap: Record<string, any> = {};
  fptRecords.forEach(r => {
    if (!fptTraineeMap[r.traineeId]) fptTraineeMap[r.traineeId] = { name: r.traineeName, chestNo: r.chestNo, platoon: r.platoon, passed: false, bestPct: 0, attempts: 0 };
    fptTraineeMap[r.traineeId].attempts++;
    if (r.result === 'Pass') fptTraineeMap[r.traineeId].passed = true;
    if ((r.percentage || 0) > fptTraineeMap[r.traineeId].bestPct) fptTraineeMap[r.traineeId].bestPct = r.percentage || 0;
  });
  const fptNeverPassed = Object.entries(fptTraineeMap).filter(([, d]) => !d.passed);

  // Test Analysis
  const testTraineeMap: Record<string, any> = {};
  weeklyTests.forEach(r => {
    if (!testTraineeMap[r.traineeId]) testTraineeMap[r.traineeId] = { name: r.traineeName, chestNo: r.chestNo, platoon: r.platoon, failCount: 0, totalTests: 0 };
    testTraineeMap[r.traineeId].totalTests++;
    if (r.result === 'Fail') testTraineeMap[r.traineeId].failCount++;
  });
  const testFailers = Object.entries(testTraineeMap).filter(([, d]) => d.failCount > 0).sort(([, a], [, b]) => b.failCount - a.failCount);

  const pendingRecoveries = recoveries.filter(r => r.status !== 'Paid');

  const totalFundCollection = funds.reduce((s, f) => s + f.collection, 0);
  const totalFundPaid = funds.reduce((s, f) => s + f.actuallyPaid, 0);
  const totalFundBalance = funds.reduce((s, f) => s + f.balance, 0);
  const totalVendorDue = funds.reduce((s, f) => s + f.vendorDue, 0);

  // Program
  const todayStr = new Date().toISOString().split('T')[0];
  const activeProgram = programs.find(p => p.fromDate <= todayStr && p.toDate >= todayStr) || programs[0] || null;
  const todaySchedule: ProgramSession[] = [];
  const tomorrowSchedule: ProgramSession[] = [];
  if (activeProgram?.schedule) {
    const todayDayData = activeProgram.schedule.find((d: DaySchedule) => d.day === todayDayName);
    const tomorrowDayData = activeProgram.schedule.find((d: DaySchedule) => d.day === tomorrowDayName);
    if (todayDayData) todaySchedule.push(...todayDayData.sessions);
    if (tomorrowDayData) tomorrowSchedule.push(...tomorrowDayData.sessions);
  }

  // NOTE: ye helper yahan (upar) define hona zaroori hai —
  // todayInstructorAssignments isko turant use karta hai.
  // `const` arrow function hoist nahi hoti, warna
  // "Cannot access 'getSubjectDisplay' before initialization" crash aata hai.
  const getSubjectDisplay = (s: ProgramSession) =>
    s.subject === 'Other (Manual)' && s.customSubject ? s.customSubject : s.subject;

  const todayInstructorAssignments = todaySchedule.flatMap((session, sessionIndex) =>
    (session.assignedPersons || [])
      .filter(person => person.name?.trim())
      .map(person => ({
        id: `${sessionIndex}_${person.rank}_${person.name}_${session.time}`,
        rank: person.rank || 'Instructor',
        name: person.name,
        time: session.time,
        subject: getSubjectDisplay(session),
        platoon: session.platoon || 'All Platoons',
        location: session.location || 'Training Area',
      }))
  );

  const unassignedTodaySessions = todaySchedule.filter(session =>
    !(session.assignedPersons || []).some(person => person.name?.trim())
  );

  // Alerts
  const fptFailAlerts: AlertItem[] = fptNeverPassed.map(([id, d]) => ({
    id, traineeId: id, traineeName: d.name, chestNo: d.chestNo, platoon: d.platoon,
    type: 'FPT Fail', detail: `Best: ${d.bestPct}% in ${d.attempts} attempt(s)`,
    severity: d.attempts >= 3 ? 'high' : d.attempts >= 2 ? 'medium' : 'low',
  }));
  const testFailAlerts: AlertItem[] = testFailers.map(([id, d]) => ({
    id, traineeId: id, traineeName: d.name, chestNo: d.chestNo, platoon: d.platoon,
    type: 'Test Fail', detail: `${d.failCount}/${d.totalTests} tests failed`,
    severity: d.failCount >= 3 ? 'high' : d.failCount >= 2 ? 'medium' : 'low',
  }));
  const docsAlerts: AlertItem[] = trainees.filter(t => !t.docsComplete).map(t => {
    const reqDocs = REQUIRED_DOCS.filter(key => t.documents?.[key]?.isRequired !== false);
    const done = reqDocs.filter(key => { const dc = t.documents?.[key]; return dc?.status === 'Uploaded' || dc?.status === 'Verified'; }).length;
    return {
      id: t.id, traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, platoon: t.platoon,
      type: 'Docs', detail: `${done}/${reqDocs.length} required docs`,
      severity: done === 0 ? 'high' as const : done < reqDocs.length / 2 ? 'medium' as const : 'low' as const,
    };
  });
  const recoveryAlerts: AlertItem[] = pendingRecoveries.map(r => ({
    id: r.id, traineeId: r.traineeId, traineeName: r.traineeName, chestNo: r.chestNo, platoon: '',
    type: 'Recovery', detail: `${r.label}: ${fmtCurrency(r.dueAmount)} due`,
    severity: r.dueAmount > 1000 ? 'high' as const : 'medium' as const,
  }));
  const kitAlerts: AlertItem[] = trainees
    .filter(t => !t.issuedKitItems || t.issuedKitItems.length < allTrainingItems.length)
    .map(t => {
      const missing = allTrainingItems.filter(item =>
        !(t.issuedKitItems || []).some((i: any) => normalizeName(i.itemName) === normalizeName(item.name))
      );
      return {
        id: t.id, traineeId: t.id, traineeName: t.name, chestNo: t.chestNo, platoon: t.platoon,
        type: 'Kit', detail: `${missing.length} items missing`,
        severity: missing.length >= 5 ? 'high' as const : missing.length >= 2 ? 'medium' as const : 'low' as const,
      };
    });

  const totalAlerts = fptFailAlerts.length + testFailAlerts.length + docsAlerts.length + recoveryAlerts.length + kitAlerts.length;

  // ── NEW: Absent records grouped by traineeId ──
  const absentRecordsByTrainee = useMemo(() => {
    const map: Record<string, AbsentRecordDash[]> = {};
    absentRecords.forEach(r => {
      if (!map[r.traineeId]) map[r.traineeId] = [];
      map[r.traineeId].push(r);
    });
    return map;
  }, [absentRecords]);

  const activeMedicalByTrainee = useMemo(() => {
    const map: Record<string, any> = {};
    allMedical.forEach((m: any) => {
      if (m.status !== 'Active') return;
      if (!map[m.traineeId]) map[m.traineeId] = m;
    });
    return map;
  }, [allMedical]);

  // Roster filter
  const filteredTrainees = trainees.filter(t => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.chestNo.toLowerCase().includes(q) && !(t.regNo || '').toLowerCase().includes(q)) return false;
    }
    if (platoonFilter !== 'ALL' && t.platoon !== platoonFilter) return false;
    const attnCode = getDashboardAttnCode(t);
    if (rosterFilter === 'ALL') return true;
    if (rosterFilter === 'PRESENT') return attnCode === 'P';
    if (rosterFilter === 'ABSENT') return attnCode === 'A';
    if (rosterFilter === 'SICK') return attnCode === 'S' || attnCode === 'H';
    if (rosterFilter === 'REST') return attnCode === 'R';
    if (rosterFilter === 'LEAVE') return attnCode === 'L';
    if (rosterFilter === 'MED_APPT') return attnCode === 'M';
    if (rosterFilter === 'NO_KIT') return !t.issuedKitItems || t.issuedKitItems.length < allTrainingItems.length;
    if (rosterFilter === 'DOCS_PENDING') return !t.docsComplete;
    if (rosterFilter === 'FPT_FAIL') return fptNeverPassed.some(([id]) => id === t.id);
    if (rosterFilter === 'RECOVERY') return pendingRecoveries.some(r => r.traineeId === t.id);
    return true;
  });

  const getTraineeHealthScore = (t: TraineeInfo) =>
    calcHealthScore(t, allTrainingItems, fptTraineeMap, testTraineeMap, pendingRecoveries);


  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const handleFundClick = (e: React.MouseEvent, fund: FundInfo) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFund(fund);
  };

  const focusRoster = (filter: string) => {
    setRosterFilter(filter);
    setSearchQuery('');
    setTimeout(() => rosterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // ═══════════════════════════════════════
  // AWAY PANEL — full detail of all non-present trainees
  // ═══════════════════════════════════════
  const awayTrainees = trainees.filter(t => getDashboardAttnCode(t) !== 'P');

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div className="max-w-[1600px] mx-auto space-y-5 pb-10">

      {/* ═══ HEADER ═══ */}
      <div className="bg-gradient-to-r from-military-900 via-military-800 to-military-900 rounded-2xl px-6 py-5 shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">{greeting}, Commander</p>
            <h1 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Star size={18} className="text-amber-400" />
              </div>
              Company Commander Dashboard
            </h1>
            <p className="text-[10px] text-white/50 font-medium mt-1 ml-10">
              Complete company overview — Trainees · Funds · Training · Medical · Documents
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeBatch && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                <p className="text-[8px] text-white/50 font-bold uppercase">Active Batch</p>
                <p className="text-[11px] font-black text-white flex items-center gap-1.5">
                  <Layers size={11} className="text-amber-400" />
                  {activeBatch.batchNumber} {activeBatch.batchName || ''}
                </p>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20 text-center">
              <p className="text-[8px] text-white/50 font-bold uppercase">Auto Refresh</p>
              <p className="text-[11px] font-mono font-bold text-white">
                {Math.floor(autoRefreshCountdown / 60)}:{String(autoRefreshCountdown % 60).padStart(2, '0')}
              </p>
            </div>
            <button type="button" onClick={fetchAllData} disabled={loading}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 text-[10px] font-bold uppercase rounded-xl border border-white/20 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
        <ReportButton />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 ml-10 flex-wrap">
          <span className="text-[10px] font-mono text-white/70 bg-white/10 px-3 py-1 rounded-lg border border-white/10">
            📅 {fmtDate(new Date())} · {todayDayName}
          </span>
          <span className="text-[10px] font-mono text-white/70 bg-white/10 px-3 py-1 rounded-lg border border-white/10">
            🕐 Last: {fmtTime(lastRefresh)}
          </span>
          {activeProgram && (
            <span className="text-[10px] font-mono text-amber-300 bg-amber-500/20 px-3 py-1 rounded-lg border border-amber-400/30">
              📋 {activeProgram.weekName}
            </span>
          )}
        </div>
      </div>

      {!hasBatch && (
        <div className="bg-red-900/90 border border-red-600 px-5 py-4 flex items-center gap-3 rounded-2xl">
          <AlertCircle size={20} className="text-red-300 animate-pulse" />
          <div>
            <p className="text-xs font-black text-red-200 uppercase">No Active Batch!</p>
            <p className="text-[10px] text-red-300/70 mt-0.5">Pehle Batch Management mein jaake batch activate karo.</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-2xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-3"><AlertTriangle size={16} /><span className="font-semibold">{errorMsg}</span></div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 font-bold text-xs bg-red-100 w-6 h-6 rounded-full flex items-center justify-center">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-military-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 size={28} className="animate-spin text-military-600" />
          </div>
          <p className="text-sm font-bold text-slate-500">Loading company data...</p>
        </div>
      ) : hasBatch && (
        <>
          <CommanderInformationBoard />

          <BatchProgressOverview />

          {/* ═══ STRENGTH & AWAY DETAIL — moved UP ═══ */}
          {/* ═══ AWAY / ATTENTION ROSTER — intentionally kept prominent ═══ */}
          <div className="overflow-hidden rounded-2xl border-2 border-red-200 bg-white shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-gradient-to-r from-red-50 to-amber-50 px-5 py-4">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-red-700">Live attention roster</p><h2 className="mt-1 text-sm font-black uppercase text-slate-800">Trainees Not On Field ({awayTrainees.length}) — Full Details</h2><p className="mt-1 text-[10px] text-slate-500">Who is away, why, and expected return</p></div>
              <button type="button" onClick={() => go(ROUTES.absentMgmt)} className="rounded-lg bg-red-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-red-700">Manage Absences →</button>
            </div>
            {awayTrainees.length === 0 ? <div className="p-8 text-center text-sm font-bold text-emerald-700">✓ All trainees are on field.</div> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-900 text-white"><tr>{['#','Chest','Name','Platoon','Status','Reason / Permission','From','Expected Return','Days','Remarks'].map(h => <th key={h} className="px-3 py-3 text-left text-[9px] font-black uppercase whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-red-100">{awayTrainees.map((t, idx) => { const code = getDashboardAttnCode(t); const info = getAbsentTypeInfo(code); const recs = absentRecordsByTrainee[t.id] || []; const rec = recs.find(r => r.status === 'Active') || recs[0]; const medical = activeMedicalByTrainee[t.id]; const reason = rec?.reason || medical?.diagnosis || medical?.category || 'Not recorded'; const rowColor = code === 'H' ? 'bg-purple-50/80 border-l-4 border-l-purple-500' : code === 'A' ? 'bg-red-50/80 border-l-4 border-l-red-500' : 'bg-amber-50/80 border-l-4 border-l-amber-500'; return <tr key={t.id} className={`${rowColor} hover:brightness-95`}><td className="px-3 py-3 font-black text-slate-400">{idx + 1}</td><td className="px-3 py-3 font-mono font-black">{t.chestNo || '—'}</td><td className="px-3 py-3 font-black text-slate-800 whitespace-nowrap">{t.rank || 'RCT'} {t.name}</td><td className="px-3 py-3">{t.platoon || '—'}</td><td className="px-3 py-3"><span className={`rounded-lg px-2 py-1 text-[9px] font-black ${info.bgColor} ${info.color}`}>{info.icon} {info.shortLabel}</span></td><td className="max-w-[180px] px-3 py-3 font-bold text-slate-700">{reason}</td><td className="px-3 py-3 font-mono text-[10px]">{rec?.fromDate || medical?.date || '—'}</td><td className="px-3 py-3 font-mono text-[10px] text-blue-700">{rec?.toDate || '—'}</td><td className="px-3 py-3 font-black text-red-600">{rec?.totalDays ? `${rec.totalDays}d` : '—'}</td><td className="max-w-[140px] px-3 py-3 text-[10px] text-slate-600">{rec?.remarks || '—'}</td></tr>; })}</tbody></table></div>}
          </div>

          {/* ═══ CLEAN ROSTER BOARD ═══ */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-widest text-military-600">Roster command board</p><h2 className="mt-1 text-sm font-black uppercase text-slate-800">Platoon-wise live strength</h2></div><button onClick={() => focusRoster('ALL')} className="rounded-lg bg-military-800 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-military-700">Open full roster →</button></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{platoons.filter(p => p !== 'ALL').map(p => { const members = trainees.filter(t => t.platoon === p); const presentCount = members.filter(t => getDashboardAttnCode(t) === 'P').length; const pct = members.length ? Math.round(presentCount / members.length * 100) : 0; return <button key={p} onClick={() => focusRoster(p)} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-military-400 hover:bg-white hover:shadow-md"><div className="flex items-center justify-between"><span className="text-xs font-black text-slate-800">{p}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${pct >= 90 ? 'bg-green-100 text-green-700' : pct >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{pct}%</span></div><div className="mt-3 h-2 rounded-full bg-slate-200"><div className={`h-full rounded-full ${pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div><div className="mt-3 flex justify-between text-[10px] font-bold"><span className="text-slate-600">{members.length} total</span><span className="text-green-700">{presentCount} present</span><span className="text-red-600">{members.length - presentCount} away</span></div></button>; })}</div>
          </div>

          {/* ═══ TRAINEE ROSTER — moved UP ═══ */}
          <div ref={rosterSectionRef}>
          <CollapsibleSection
            title="Full Trainee Roster"
            subtitle="Click any trainee to view full profile · Non-present rows clickable for absence details"
            icon={<Users size={14} />}
            headerRight={
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">
                  ✓ {presentToday} Present
                </span>
               
              
                {(searchQuery || platoonFilter !== 'ALL' || rosterFilter !== 'ALL') && (
                  <span className="text-[9px] font-bold bg-military-100 text-military-700 px-2 py-1 rounded-lg">
                    {filteredTrainees.length} shown
                  </span>
                )}
              </div>
            }
            accentColor="border-l-military-600"
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <input type="text" placeholder="Search name, chest, reg..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="w-full text-xs border border-slate-200 pl-8 pr-3 py-2 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-military-300 transition-all" />
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Platoon:</span>
                {platoons.map(p => (
                  <button key={p} type="button"
                    onClick={(e) => { e.stopPropagation(); setPlatoonFilter(p); }}
                    className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all ${platoonFilter === p ? 'bg-military-700 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1.5 mb-3 overflow-x-auto flex-wrap">
              {([
                { key: 'ALL', label: `All (${totalTrainees})`, color: 'bg-military-700' },
                { key: 'PRESENT', label: `Present (${presentToday})`, color: 'bg-green-600' },
                { key: 'ABSENT', label: `Absent (${absentCount})`, color: 'bg-red-600' },
                { key: 'SICK', label: `Sick/Hosp (${sickCount + hospitalCount})`, color: 'bg-amber-600' },
                { key: 'REST', label: `Rest (${restCount})`, color: 'bg-purple-600' },
                { key: 'LEAVE', label: `Leave (${leaveCount})`, color: 'bg-blue-600' },
                { key: 'MED_APPT', label: `Med Appt (${medApptCount})`, color: 'bg-teal-600' },
                { key: 'FPT_FAIL', label: `FPT Fail (${fptNeverPassed.length})`, color: 'bg-orange-600' },
                { key: 'DOCS_PENDING', label: `Docs Pending (${docsPendingCount})`, color: 'bg-cyan-600' },
                { key: 'NO_KIT', label: `Kit Pending (${kitPendingCount})`, color: 'bg-indigo-600' },
                { key: 'RECOVERY', label: `Recovery (${pendingRecoveries.length})`, color: 'bg-pink-600' },
              ]).map(tab => (
                <button key={tab.key} type="button"
                  onClick={(e) => { e.stopPropagation(); setRosterFilter(tab.key); }}
                  className={`px-2.5 py-1.5 text-[9px] font-black uppercase rounded-xl whitespace-nowrap transition-all ${rosterFilter === tab.key ? `${tab.color} text-white shadow-md` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-auto max-h-[480px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['#', 'Chest', 'Name', 'Platoon', 'Status', 'Health', 'FPT', 'Tests', 'Docs', 'Kit', 'Recovery', 'Absence Info'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[9px] font-bold text-slate-400 uppercase text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTrainees.slice(0, 100).map((t, idx) => {
                      const hs = getTraineeHealthScore(t);
                      const attnCode = getDashboardAttnCode(t);
                      const isAway = attnCode !== 'P';
                      const typeInfo = getAbsentTypeInfo(attnCode);
                      const attnCls = attnCode === 'P' ? 'bg-green-100 text-green-700'
                        : attnCode === 'A' ? 'bg-red-100 text-red-700'
                        : attnCode === 'S' ? 'bg-orange-100 text-orange-700'
                        : attnCode === 'H' ? 'bg-purple-100 text-purple-700'
                        : attnCode === 'L' ? 'bg-blue-100 text-blue-700'
                        : attnCode === 'R' ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-teal-100 text-teal-700';
                      const rowHighlight = attnCode === 'P'
                        ? 'bg-green-50/30 border-l-4 border-l-green-400'
                        : attnCode === 'A'
                        ? 'bg-red-50/75 border-l-4 border-l-red-500'
                        : attnCode === 'S'
                        ? 'bg-orange-50/75 border-l-4 border-l-orange-500'
                        : attnCode === 'H'
                        ? 'bg-purple-50/80 border-l-4 border-l-purple-500'
                        : attnCode === 'L'
                        ? 'bg-blue-50/75 border-l-4 border-l-blue-500'
                        : attnCode === 'R'
                        ? 'bg-indigo-50/75 border-l-4 border-l-indigo-500'
                        : 'bg-teal-50/75 border-l-4 border-l-teal-500';
                      const recovery = pendingRecoveries.find(r => r.traineeId === t.id);
                      const hsColor = hs >= 80 ? 'text-green-600 bg-green-50' : hs >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

                      // Absent record for this trainee
                      const traineeAbsRecs = absentRecordsByTrainee[t.id] || [];
                      const activeAbsRec = traineeAbsRecs.find(r => r.status === 'Active') || null;
                      const activeMedRec = activeMedicalByTrainee[t.id] || null;
                      const displayAbsRec = activeAbsRec || (activeMedRec ? {
                        reason: activeMedRec.diagnosis || activeMedRec.category,
                        fromDate: activeMedRec.date,
                        toDate: activeMedRec.date,
                      } : null);

                      return (
                        <tr
                          key={t.id}
                          className={`hover:brightness-95 cursor-pointer transition-colors ${rowHighlight}`}
                          onClick={() => {
                            if (isAway) {
                              setAbsentModalTrainee(t);
                            } else {
                              setSelectedTrainee(t);
                            }
                          }}
                        >
                          <td className="px-3 py-2.5 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-[10px] font-mono font-black text-military-800 bg-military-50 border border-military-100 px-2 py-0.5 rounded-lg">{t.chestNo}</span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800 max-w-[130px] truncate text-[11px]">{t.name}</td>
                          <td className="px-3 py-2.5 text-slate-500 text-[10px]">{t.platoon || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${attnCls}`}>
                              {isAway ? `${typeInfo.icon} ${attnCode}` : '✓ P'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${hsColor}`}>{hs}</span>
                          </td>
                                                    <td className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                go('/test-records');
                              }}
                              title="Click to see all FPT results"
                              className="cursor-pointer"
                            >
                              {t.fptResult === 'Pass' ? (
                                <span className="text-[9px] text-green-600 hover:bg-green-50 px-1 py-0.5 rounded">✅ Pass</span>
                              ) : t.fptResult === 'Fail' ? (
                                <span className="text-[9px] text-red-600 hover:bg-red-50 px-1 py-0.5 rounded">❌ Fail</span>
                              ) : (
                                <span className="text-slate-300 text-[9px]">—</span>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                go('/test-records');
                              }}
                              title="Click to see all test results"
                              className="cursor-pointer"
                            >
                              {t.weeklyExamResult === 'Pass' ? (
                                <span className="text-[9px] text-green-600 hover:bg-green-50 px-1 py-0.5 rounded">✅ Pass</span>
                              ) : t.weeklyExamResult === 'Fail' ? (
                                <span className="text-[9px] text-red-600 hover:bg-red-50 px-1 py-0.5 rounded">❌ Fail</span>
                              ) : (
                                <span className="text-slate-300 text-[9px]">—</span>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {t.docsComplete ? <CheckCircle2 size={13} className="text-green-500 mx-auto" /> : <AlertCircle size={13} className="text-amber-400 mx-auto" />}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {(t.issuedKitItems?.length ?? 0) >= allTrainingItems.length ? <CheckCircle2 size={13} className="text-green-500 mx-auto" /> : <PackageMinus size={13} className="text-red-400 mx-auto" />}
                          </td>
                          <td className="px-3 py-2.5">
                            {recovery ? <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">{fmtCurrency(recovery.dueAmount)}</span> : <span className="text-[9px] text-green-500">✓</span>}
                          </td>
                          {/* ── NEW: Absence Info column ── */}
                          <td className="px-3 py-2.5 max-w-[160px]">
                            {isAway ? (
                              displayAbsRec ? (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-700 truncate" title={displayAbsRec.reason}>
                                    {displayAbsRec.reason || '—'}
                                  </p>
                                  <p className="text-[8px] text-slate-400 font-mono">
                                    {fmtDateStr(displayAbsRec.fromDate)} → {fmtDateStr(displayAbsRec.toDate)}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-[8px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded">
                                  ⚠ No Record
                                </span>
                              )
                            ) : (
                              <span className="text-[9px] text-green-500">On Field</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredTrainees.length > 100 && (
                  <div className="px-4 py-3 text-center border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={(e) => { e.stopPropagation(); go(ROUTES.trainees); }}
                      className="text-[10px] font-bold text-military-600 bg-military-50 px-4 py-1.5 rounded-lg border border-military-200 hover:bg-military-100 transition-colors">
                      +{filteredTrainees.length - 100} more → View Full Roster
                    </button>
                  </div>
                )}
                {filteredTrainees.length === 0 && (
                  <div className="p-8 text-center">
                    <Users size={28} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No trainees match</p>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>
          </div>

          {/* ═══ FUNDS ═══ */}
          <CollapsibleSection
            title="Funds & Financial Overview"
            subtitle="4 Funds — Click card to see details"
            icon={<Wallet size={14} />}
            action={{ label: 'Full Funds Dashboard', onClick: () => go(ROUTES.fundsDashboard) }}
            accentColor="border-l-amber-500"
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {funds.map(fund => {
                const pctUsed = fund.collection > 0 ? Math.round((fund.actuallyPaid / fund.collection) * 100) : 0;
                return (
                  <button key={fund.key} type="button" onClick={(e) => handleFundClick(e, fund)}
                    className={`text-left bg-white border-2 ${fund.borderColor} rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-100 transition-all group overflow-hidden w-full`}>
                    <div className={`${fund.color} text-white px-4 py-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{fund.emoji}</span>
                        <p className="text-xs font-black uppercase text-white leading-tight">{fund.label}</p>
                      </div>
                      <Eye size={14} className="text-white/60 group-hover:text-white transition-colors" />
                    </div>
                    <div className="px-3 pt-3">
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className={`h-full rounded-full transition-all duration-1000 ${pctUsed > 90 ? 'bg-red-500' : pctUsed > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(pctUsed, 100)}%` }} />
                      </div>
                      <p className="text-[8px] text-slate-400 mt-0.5 text-right">{pctUsed}% utilized</p>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <p className="text-[8px] text-green-500 font-bold uppercase">Collection</p>
                          <p className="text-xs font-black text-green-700">{fmtCurrency(fund.collection)}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2 text-center">
                          <p className="text-[8px] text-red-400 font-bold uppercase">Paid Out</p>
                          <p className="text-xs font-black text-red-600">{fmtCurrency(fund.actuallyPaid)}</p>
                        </div>
                      </div>
                      {fund.transferredOut > 0 && (
                        <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-200">
                          <p className="text-[8px] text-purple-500 font-bold uppercase">Transferred Out</p>
                          <p className="text-xs font-black text-purple-700">{fmtCurrency(fund.transferredOut)}</p>
                        </div>
                      )}
                      {fund.vendorDue > 0 && (
                        <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-200">
                          <p className="text-[8px] text-amber-500 font-bold uppercase">⚠ Vendor Due</p>
                          <p className="text-xs font-black text-amber-700">{fmtCurrency(fund.vendorDue)}</p>
                        </div>
                      )}
                      <div className={`rounded-xl p-2.5 flex items-center justify-between ${fund.balance >= 0 ? 'bg-slate-50' : 'bg-red-100'}`}>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Balance</p>
                        <p className={`text-base font-black ${fund.balance >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
                          {fund.balance < 0 ? '−' : ''}{fmtCurrency(Math.abs(fund.balance))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[8px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{fund.entries} entries</span>
                        {fund.pendingBills > 0 && (
                          <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{fund.pendingBills} bills pending</span>
                        )}
                        <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full ml-auto">👆 Details</span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Net Total Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                    <Zap size={10} className="text-amber-400" /> Net All Funds
                  </p>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-green-400">+ Collection</span>
                      <span className="font-black text-green-400">{fmtCurrency(totalFundCollection)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-400">− Paid Out</span>
                      <span className="font-black text-red-400">{fmtCurrency(totalFundPaid)}</span>
                    </div>
                    <div className="border-t border-slate-600 pt-2 flex justify-between font-black text-sm">
                      <span className="text-white">= Balance</span>
                      <span className={totalFundBalance >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {totalFundBalance < 0 ? '−' : ''}{fmtCurrency(Math.abs(totalFundBalance))}
                      </span>
                    </div>
                  </div>
                </div>
                {totalVendorDue > 0 && (
                  <div className="mt-3 bg-red-500/20 rounded-lg px-3 py-2 border border-red-500/30">
                    <p className="text-[9px] text-red-300 font-bold flex items-center gap-1">
                      <AlertTriangle size={10} /> Vendor Due: {fmtCurrency(totalVendorDue)}
                    </p>
                  </div>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); go(ROUTES.fundsDashboard); }}
                  className="mt-3 w-full text-[9px] font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 py-2 rounded-lg transition-colors border border-white/10">
                  Open Full Dashboard →
                </button>
              </div>
            </div>
          </CollapsibleSection>

          {/* ═══ TRAINING SCHEDULE ═══ */}
          <CollapsibleSection title="Training Schedule" subtitle="Today & Tomorrow"
            icon={<Calendar size={14} />}
            action={{ label: 'Weekly Program', onClick: () => go(ROUTES.weeklyProgram) }}
            accentColor="border-l-blue-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'TODAY', day: todayDayName, date: todayStr, sessions: todaySchedule, accent: 'from-military-800 to-military-700', badge: 'bg-green-500' },
                { label: 'TOMORROW', day: tomorrowDayName, date: tomorrowDate.toISOString().split('T')[0], sessions: tomorrowSchedule, accent: 'from-slate-700 to-slate-600', badge: 'bg-blue-500' },
              ].map(block => (
                <div key={block.label} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className={`bg-gradient-to-r ${block.accent} text-white px-5 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${block.badge} animate-pulse`} />
                      <div>
                        <p className="text-xs font-black text-white uppercase">{block.label} — {block.day}</p>
                        <p className="text-[9px] text-white/50 font-mono">{block.date}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-white bg-white/15 px-2.5 py-1 rounded-lg">{block.sessions.length} sessions</span>
                  </div>
                  {!TRAINING_DAYS.includes(block.day) ? (
                    <div className="p-8 text-center"><p className="text-2xl mb-1">🛌</p><p className="text-xs font-bold text-slate-400">Off Day</p></div>
                  ) : block.sessions.length === 0 ? (
                    <div className="p-8 text-center"><Calendar size={28} className="mx-auto text-slate-200 mb-2" /><p className="text-[10px] text-slate-400 font-bold">No schedule</p></div>
                  ) : (
                    <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                      {block.sessions.map((s, i) => (
                        <div key={i} className="px-4 py-3 hover:bg-slate-50/80 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[9px] font-mono font-black text-military-700 bg-military-50 px-2 py-1 rounded-lg border border-military-100">{s.time}</span>
                              <span className="text-[11px] font-black text-slate-800">{getSubjectDisplay(s)}</span>
                            </div>
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-bold">{s.platoon}</span>
                          </div>
                          {(s.location || s.assignedPersons?.some(p => p.name)) && (
                            <div className="flex items-center gap-3 mt-1.5 ml-[52px] text-[9px] text-slate-400">
                              {s.location && <span>📍 {s.location}</span>}
                              {s.assignedPersons?.length > 0 && s.assignedPersons[0].name && (
                                <span>👤 {s.assignedPersons.map(p => `${p.rank || ''} ${p.name}`.trim()).filter(Boolean).join(', ')}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* ═══ ALERTS ═══ */}
          <CollapsibleSection title="Commander Attention Board" subtitle="Items requiring immediate action"
            icon={<AlertTriangle size={14} />} urgentCount={totalAlerts} accentColor="border-l-red-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <AlertPanel title="FPT Not Passed" icon={<Crosshair size={14} className="text-white" />}
                items={fptFailAlerts} accentColor="bg-orange-500" onViewAll={() => go(ROUTES.fptTracker)} />
              <AlertPanel title="Weekly Test Failures" icon={<Award size={14} className="text-white" />}
                items={testFailAlerts} accentColor="bg-amber-500" onViewAll={() => go(ROUTES.weeklyTest)} />
              <AlertPanel title="Documents Incomplete" icon={<FileText size={14} className="text-white" />}
                items={docsAlerts} accentColor="bg-blue-500" onViewAll={() => go(ROUTES.documents)} />
              <AlertPanel title="Kit Items Missing" icon={<Package size={14} className="text-white" />}
                items={kitAlerts} accentColor="bg-red-500" onViewAll={() => go(ROUTES.issueKit)} />
              <AlertPanel title="Recovery Pending" icon={<CreditCard size={14} className="text-white" />}
                items={recoveryAlerts} accentColor="bg-purple-500" onViewAll={() => go(ROUTES.trainingFund)} />
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center">
                      <Building2 size={14} className="text-white" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black text-slate-700 uppercase">Vendor Dues</span>
                      <p className="text-[9px] text-slate-400">{vendorDues.length} vendors · {fmtCurrency(totalVendorDue)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); go(ROUTES.vendorPayment); }}
                    className="text-[9px] font-bold text-red-600 uppercase bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors">
                    Pay →
                  </button>
                </div>
                {vendorDues.length === 0 ? (
                  <div className="p-6 text-center">
                    <CheckCircle2 size={20} className="text-green-400 mx-auto mb-2" />
                    <p className="text-[10px] text-green-600 font-bold">All Clear!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
                    {vendorDues.slice(0, 5).map((v: any) => (
                      <button key={v.vendorId} type="button"
                        onClick={(e) => { e.stopPropagation(); go(ROUTES.vendorPayment); }}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left">
                        <div>
                          <p className="text-[10px] font-bold text-slate-700">{v.vendorName}</p>
                          <p className="text-[9px] text-slate-400">{v.categoryLabel} · {v.entries} entries</p>
                        </div>
                        <span className="text-xs font-black text-red-600">{fmtCurrency(v.totalDue)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* ═══════════════════════════════════════════════
              🆕 STAFF MANAGEMENT MODULE STATS
          ═══════════════════════════════════════════════ */}
          <CollapsibleSection
            title="Staff Management — Instructors Overview"
            subtitle="Live stats from Staff Management Module"
            icon={<Shield size={14} />}
            action={{
              label: 'Manage Staff',
              onClick: () => go('/staff'),
            }}
            accentColor="border-l-blue-600"
            defaultOpen={true}
          >
            {staffLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* ── Stats Grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    {
                      label: 'Total Staff',
                      value: staffSummary.total,
                      icon: '👥',
                      color: 'bg-slate-700 text-white',
                      dot: '',
                    },
                    {
                      label: 'Active',
                      value: staffSummary.active,
                      icon: '✅',
                      color: 'bg-green-50 border border-green-200 text-green-800',
                      dot: 'bg-green-500',
                    },
                    {
                      label: 'On Leave',
                      value: staffSummary.onLeave,
                      icon: '🏖️',
                      color: staffSummary.onLeave > 0
                        ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                        : 'bg-green-50 border border-green-200 text-green-700',
                      dot: staffSummary.onLeave > 0 ? 'bg-yellow-500' : 'bg-green-500',
                    },
                    {
                      label: 'Temp Duty',
                      value: staffSummary.onTD,
                      icon: '🚗',
                      color: staffSummary.onTD > 0
                        ? 'bg-blue-50 border border-blue-200 text-blue-800'
                        : 'bg-green-50 border border-green-200 text-green-700',
                      dot: staffSummary.onTD > 0 ? 'bg-blue-500' : 'bg-green-500',
                    },
                    {
                      label: 'Hospital',
                      value: staffSummary.inHospital,
                      icon: '🏥',
                      color: staffSummary.inHospital > 0
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : 'bg-green-50 border border-green-200 text-green-700',
                      dot: staffSummary.inHospital > 0 ? 'bg-red-500' : 'bg-green-500',
                    },
                    {
                      label: 'On Course',
                      value: staffSummary.onCourse,
                      icon: '📖',
                      color: staffSummary.onCourse > 0
                        ? 'bg-purple-50 border border-purple-200 text-purple-800'
                        : 'bg-green-50 border border-green-200 text-green-700',
                      dot: staffSummary.onCourse > 0 ? 'bg-purple-500' : 'bg-green-500',
                    },
                    {
                      label: 'Inactive',
                      value: staffSummary.inactive,
                      icon: '⭕',
                      color: 'bg-gray-50 border border-gray-200 text-gray-600',
                      dot: 'bg-gray-400',
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`rounded-xl p-3 text-center ${stat.color}`}
                    >
                      <p className="text-xl mb-1">{stat.icon}</p>
                      <p className="text-2xl font-black">{stat.value}</p>
                      <p className="text-[9px] font-bold uppercase opacity-80 mt-0.5">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── Quick Actions ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {[
                    {
                      label: 'Staff List',
                      path: '/staff',
                      icon: '👤',
                      color: 'bg-blue-600 hover:bg-blue-700',
                    },
                    {
                      label: 'Attendance',
                      path: '/staff-attendance',
                      icon: '✅',
                      color: 'bg-green-600 hover:bg-green-700',
                    },
                    {
                      label: 'Leave Mgmt',
                      path: '/staff-leave',
                      icon: '🏖️',
                      color: 'bg-yellow-600 hover:bg-yellow-700',
                    },
                    {
                      label: 'Duty Mgmt',
                      path: '/duty-management',
                      icon: '🎖️',
                      color: 'bg-red-600 hover:bg-red-700',
                    },
                    {
                      label: 'Subjects',
                      path: '/subjects',
                      icon: '📚',
                      color: 'bg-purple-600 hover:bg-purple-700',
                    },
                    {
                      label: 'Assignment',
                      path: '/subject-assignment',
                      icon: '📋',
                      color: 'bg-indigo-600 hover:bg-indigo-700',
                    },
                  ].map((btn) => (
                    <button
                      key={btn.path}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        go(btn.path);
                      }}
                      className={`
                        ${btn.color} text-white rounded-xl
                        px-3 py-2.5 text-[10px] font-bold
                        uppercase tracking-wide
                        flex items-center justify-center gap-2
                        transition-colors shadow-sm
                        hover:shadow-md
                      `}
                    >
                      <span>{btn.icon}</span>
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* ── Warning if staff issues ── */}
                {(staffSummary.onLeave > 0 ||
                  staffSummary.inHospital > 0 ||
                  staffSummary.onTD > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                    <AlertCircle
                      size={16}
                      className="text-amber-500 flex-shrink-0 mt-0.5"
                    />
                    <div className="flex flex-wrap gap-2">
                      {staffSummary.onLeave > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-yellow-100 px-2 py-1 rounded-lg">
                          🏖️ {staffSummary.onLeave} staff on leave
                        </span>
                      )}
                      {staffSummary.inHospital > 0 && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-1 rounded-lg">
                          🏥 {staffSummary.inHospital} in hospital
                        </span>
                      )}
                      {staffSummary.onTD > 0 && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-lg">
                          🚗 {staffSummary.onTD} on temp duty
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── No Staff State ── */}
                {staffSummary.total === 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                    <p className="text-3xl mb-2">👥</p>
                    <p className="text-sm font-bold text-slate-500">
                      No staff added yet
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Staff Management module mein jaake instructors add karo
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        go('/staff');
                      }}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      + Add First Staff Member
                    </button>
                  </div>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* ═══ TODAY INSTRUCTORS + VENDOR DUES ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleSection
              title={`Today's Ustad / Staff Duties (${todayInstructorAssignments.length})`}
              subtitle="Aaj kis instructor ki kaunsi class hai — Weekly Program se live"
              icon={<Shield size={14} />}
              action={{ label: 'Training Schedule', onClick: () => go('/weekly-program') }}
              accentColor="border-l-indigo-500"
            >
              {todaySchedule.length === 0 ? (
                <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Calendar size={22} className="text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-black text-blue-800 uppercase">Aaj ka weekly program blank hai</p>
                      <p className="text-[10px] text-blue-700 mt-1">
                        Weekly Program me aaj ki classes add karo, yahan instructor-wise duty automatically dikhegi.
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); go('/weekly-program'); }}
                        className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700"
                      >
                        Open Weekly Program →
                      </button>
                    </div>
                  </div>
                </div>
              ) : todayInstructorAssignments.length === 0 ? (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-black text-amber-800 uppercase">Classes hain, par ustad assigned nahi</p>
                    <p className="text-[10px] text-amber-700 mt-1">
                      {unassignedTodaySessions.length} session(s) me instructor/ustad missing hai. Weekly Program me assigned persons भरो.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto">
                    {todaySchedule.map((session, idx) => (
                      <div key={`${session.time}_${idx}`} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="text-[11px] font-black text-slate-800">{getSubjectDisplay(session)}</p>
                          <p className="text-[9px] text-slate-500">{session.time} · {session.platoon || 'All Platoons'} · {session.location || 'Training Area'}</p>
                        </div>
                        <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">No Ustad</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-black text-indigo-700">{todaySchedule.length}</p>
                      <p className="text-[9px] font-bold text-indigo-600 uppercase">Classes</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-black text-green-700">{todayInstructorAssignments.length}</p>
                      <p className="text-[9px] font-bold text-green-600 uppercase">Assignments</p>
                    </div>
                    <div className={`${unassignedTodaySessions.length > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'} border rounded-xl p-3 text-center`}>
                      <p className={`text-lg font-black ${unassignedTodaySessions.length > 0 ? 'text-red-700' : 'text-slate-600'}`}>{unassignedTodaySessions.length}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Unassigned</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                      {todayInstructorAssignments.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); go('/weekly-program'); }}
                          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-indigo-50/60 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black">👤</span>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 truncate">{item.rank} {item.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{item.subject}</p>
                              <p className="text-[9px] text-slate-400">{item.location}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] font-mono font-black text-military-700 bg-military-50 border border-military-100 px-2 py-1 rounded-lg">{item.time}</p>
                            <p className="text-[9px] text-slate-500 mt-1">{item.platoon}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title={`Vendor Dues (${vendorDues.length})`} subtitle={`Total: ${fmtCurrency(totalVendorDue)}`}
              icon={<Building2 size={14} />}
              action={{ label: 'Pay', onClick: () => go(ROUTES.vendorPayment) }}
              accentColor="border-l-red-500">
              {vendorDues.length === 0 ? (
                <div className="p-6 text-center bg-green-50 rounded-xl">
                  <CheckCircle2 size={28} className="mx-auto text-green-400 mb-2" />
                  <p className="text-xs font-bold text-green-600">No vendor dues! 🎉</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50 max-h-64 overflow-y-auto">
                  {vendorDues.map((v: any) => (
                    <button key={v.vendorId} type="button"
                      onClick={(e) => { e.stopPropagation(); go(ROUTES.vendorPayment); }}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50/30 transition-colors text-left">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{v.vendorName}</p>
                        <p className="text-[9px] text-slate-400">{v.categoryLabel} · {v.entries} entries</p>
                      </div>
                      <span className="text-sm font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-200">{fmtCurrency(v.totalDue)}</span>
                    </button>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>

          {/* ═══ ALL MODULES ═══ */}
          <CollapsibleSection title="All Modules — Quick Access" subtitle="CC Full Authority"
            icon={<BookOpen size={14} />} accentColor="border-l-purple-500" defaultOpen={false}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {[
                { label: 'QM Dashboard', icon: LayoutDashboard, gradient: 'from-military-600 to-military-800', route: ROUTES.quartermaster },
                { label: 'Trainees', icon: Users, gradient: 'from-blue-500 to-blue-700', route: ROUTES.trainees },
                { label: 'Documents', icon: FileText, gradient: 'from-cyan-500 to-cyan-700', route: ROUTES.documents },
                { label: 'Weekly Program', icon: Calendar, gradient: 'from-teal-500 to-teal-700', route: ROUTES.weeklyProgram },
                { label: 'Test Records', icon: Crosshair, gradient: 'from-purple-500 to-purple-700', route: '/test-records' },
                { label: 'Medical', icon: HeartPulse, gradient: 'from-red-500 to-red-700', route: ROUTES.medicalRegister },
                { label: 'Absent Mgmt', icon: Activity, gradient: 'from-purple-500 to-purple-700', route: ROUTES.absentMgmt },
                { label: 'Kit Issue', icon: BoxSelect, gradient: 'from-indigo-500 to-indigo-700', route: ROUTES.issueKit },
                { label: 'Mess Fund', icon: IndianRupee, gradient: 'from-orange-400 to-orange-600', route: ROUTES.messFund },
                { label: 'Training Fund', icon: IndianRupee, gradient: 'from-blue-400 to-blue-600', route: ROUTES.trainingFund },
                { label: 'Assets Fund', icon: IndianRupee, gradient: 'from-green-500 to-green-700', route: ROUTES.companyAssets },
                { label: 'Funds Dashboard', icon: Wallet, gradient: 'from-slate-600 to-slate-800', route: ROUTES.fundsDashboard },
                { label: 'Vendor Payment', icon: CreditCard, gradient: 'from-amber-500 to-amber-600', route: ROUTES.vendorPayment },
                { label: 'Mess Salary', icon: UserCheck, gradient: 'from-teal-400 to-teal-600', route: ROUTES.messBoySalary },
                { label: 'Reports', icon: BarChart3, gradient: 'from-military-500 to-military-700', route: ROUTES.reports },                 // ─── Staff Module ────────────────────────
                { label: 'Staff List', icon: Shield, gradient: 'from-blue-600 to-blue-800', route: ROUTES.staff },
                { label: 'Staff Attend.', icon: UserCheck, gradient: 'from-green-500 to-green-700', route: ROUTES.staffAttendance },
                { label: 'Staff Leave', icon: Activity, gradient: 'from-yellow-500 to-yellow-700', route: ROUTES.staffLeave },
                { label: 'Duty Mgmt', icon: Crosshair, gradient: 'from-red-500 to-red-700', route: ROUTES.dutyManagement },
              ].map(mod => {
                const Icon = mod.icon;
                return (
                  <button key={mod.route + mod.label} type="button"
                    onClick={(e) => { e.stopPropagation(); go(mod.route); }}
                    className="flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-lg hover:border-slate-300 hover:-translate-y-1 active:scale-95 transition-all group">
                    <div className={`w-10 h-10 bg-gradient-to-br ${mod.gradient} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-wide text-center leading-tight">{mod.label}</p>
                  </button>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 py-3 px-2">
            <span className="flex items-center gap-1.5">
              <Star size={10} className="text-amber-400" />
              Company Commander · Full Authority · BSF COY System
            </span>
            <span className="font-mono">Updated: {fmtTime(lastRefresh)} · {fmtDate(lastRefresh)}</span>
          </div>
        </>
      )}

      {/* ═══ FUND DETAIL MODAL ═══ */}
      {selectedFund && fundRawDataMap[selectedFund.key] && (
        <FundDetailModal
          fund={selectedFund}
          rawData={fundRawDataMap[selectedFund.key]}
          onClose={() => setSelectedFund(null)}
          onNavigate={(route) => { setSelectedFund(null); go(route); }}
        />
      )}

      {/* ═══ TRAINEE PROFILE MODAL ═══ */}
      {selectedTrainee && (
        <TraineeProfileModal
          trainee={selectedTrainee}
          fptRecords={fptRecords.filter(r => r.traineeId === selectedTrainee.id)}
          weeklyTests={weeklyTests.filter(r => r.traineeId === selectedTrainee.id)}
          medicalRecords={allMedical.filter(r => r.traineeId === selectedTrainee.id)}
          recoveries={recoveries}
          allTrainingItems={allTrainingItems}
          healthScore={getTraineeHealthScore(selectedTrainee)}
          onClose={() => setSelectedTrainee(null)}
        />
      )}

      {/* ═══ ABSENT DETAIL MODAL ═══ */}
      {absentModalTrainee && (
        <AbsentDetailModal
          records={absentRecordsByTrainee[absentModalTrainee.id] || []}
          traineeName={absentModalTrainee.name}
          chestNo={absentModalTrainee.chestNo}
          platoon={absentModalTrainee.platoon}
          attn={absentModalTrainee.attn}
          onClose={() => setAbsentModalTrainee(null)}
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default CompanyCommanderDashboard;