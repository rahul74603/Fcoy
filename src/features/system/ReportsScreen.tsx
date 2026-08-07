// D:\ALL PROJECTS\BSF COYs\frontend\src\features\reports\ReportsScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Filter, FileSpreadsheet, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, X, Users, Package,
  Building2, BarChart3, TrendingUp,
  TrendingDown, Wallet, Activity, Printer,
  IndianRupee, AlertCircle, BoxSelect, UserCheck,
  Award, Target, Layers,
  ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { showDoc } from '../../utils/devDataFilter';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';
import { normalizePlatoon, PLATOON_OPTIONS } from '../../utils/platoon';

// ─── Staff Module Types ───────────────────
import type { Staff } from '../ustad/types/staff.types';
import type { StaffLeave, LeaveType } from '../ustad/types/leave.types';
import type { StaffAttendance } from '../ustad/types/attendance.types';
import type { StaffDuty, DutyType } from '../ustad/types/duty.types';
import type {
  Subject,
  StaffSubjectAssignment,
} from '../ustad/types/subject.types';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface TraineeData {
  id: string;
  chestNo: string;
  name: string;
  rank: string;
  platoon: string;
  section: string;
  attn: string;
  medStat: string;
  batchNumber: string;
  batchName: string;
  fatherName: string;
  mobileNo: string;
  district: string;
  state: string;
  bloodGroup: string;
  joinDate: string;
  issuedKitItems: any[];
  pendingRecoveryAmount: number;
}

interface FundCollection {
  id: string;
  amount: number;
  date: string;
  fundType: 'Mess' | 'Training' | 'Assets' | 'General';
  label: string;
  perHead: number;
  traineeCount: number;
  paymentMode: string;
  recordedBy: string;
  monthLabel?: string;
}

interface FundExpense {
  id: string;
  amount: number;
  itemName: string;
  category: string;
  vendor: string;
  vendorId: string;
  date: string;
  fundType: 'Mess' | 'Training' | 'Assets' | 'General';
  quantity: number;
  unitPrice: number;
  billStatus: string;
  dueAmount: number;
  paidAmount: number;
  paymentMode: string;
  remarks: string;
  assetStatus?: string;
}

interface VendorData {
  id: string;
  name: string;
  phone: string;
  categoryLabel: string;
  isActive: boolean;
}

interface VendorEntryData {
  id: string;
  vendorId: string;
  vendorName: string;
  categoryLabel: string;
  fundKey: string;
  items: any[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  entryDate: string;
}

interface IssueRecord {
  id: string;
  chestNo: string;
  traineeName: string;
  platoon: string;
  issuedItems: any[];
  totalItemsIssued: number;
  totalValue: number;
  issuedBy: string;
  issueDateISO: string;
  issueSource: string;
}

interface AbsentRecord {
  id: string;
  chestNo: string;
  traineeName: string;
  type: string;
  status: string;
  reason: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  batchId: string;
  platoon: string;
}

interface FPTRecord {
  id: string;
  traineeId: string;
  weekNumber: number;
  testDate: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  result: string;
}

interface WeeklyTestRecord {
  id: string;
  traineeId: string;
  weekNumber: number;
  testName: string;
  subject: string;
  testDate: string;        
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  result: string;
}

interface BatchData {
  id: string;
  batchNumber: string;
  batchName: string;
  status: string;
  totalTrainees: number;
}

interface GeneratedReport {
  id: string;
  reportName: string;
  reportType: string;
  generatedBy: string;
  date: string;
  format: 'EXCEL' | 'PRINT';
  recordCount: number;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const formatCurrency = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : '—';
const todayISO = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// ─────────────────────────────────────────────
// CSV / PRINT GENERATORS
// ─────────────────────────────────────────────
const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${todayISO()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const printReport = (title: string, headers: string[], rows: string[][], summary?: string) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { margin: 12mm; size: A4 landscape; }
        body { font-family: 'Arial', sans-serif; font-size: 10px; color: #1a1a1a; }
        .header { text-align: center; border-bottom: 3px double #1f2937; padding-bottom: 8px; margin-bottom: 12px; }
        .header h1 { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; margin: 0; color: #1f2937; }
        .header h2 { font-size: 13px; font-weight: 700; margin: 4px 0 0; color: #4b5563; }
        .header .subtitle { font-size: 10px; color: #6b7280; margin-top: 4px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 10px; color: #6b7280; padding: 6px 10px; background: #f3f4f6; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1f2937; color: white; padding: 7px 6px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 900; }
        td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9.5px; }
        tr:nth-child(even) { background: #f9fafb; }
        .summary { margin-top: 12px; padding: 10px 12px; background: #fef3c7; border-left: 4px solid #f59e0b; font-size: 10px; font-weight: bold; color: #78350f; }
        .footer { margin-top: 18px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 6px; }
        .stamp { margin-top: 30px; display: flex; justify-content: space-between; padding: 0 30px; }
        .stamp div { text-align: center; width: 180px; }
        .stamp .line { border-top: 1.5px solid #1f2937; margin-top: 40px; padding-top: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        @media print { button { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BSF — Training Centre Command ERP</h1>
        <h2>${title}</h2>
        <div class="subtitle">CONFIDENTIAL · For Official Use Only</div>
      </div>
      <div class="meta">
        <span><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        <span><strong>Time:</strong> ${nowTime()}</span>
        <span><strong>Total Records:</strong> ${rows.length}</span>
      </div>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      ${summary ? `<div class="summary">📊 SUMMARY: ${summary}</div>` : ''}
      <div class="stamp">
        <div><div class="line">Prepared By</div></div>
        <div><div class="line">Verified By (QM)</div></div>
        <div><div class="line">Approved By (CC)</div></div>
      </div>
      <div class="footer">
        Generated by BSF COY Management System · ${new Date().toLocaleString('en-IN')} · This is a system-generated report
      </div>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `;
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export const ReportsScreen: React.FC = () => {
  const { user } = useAuth();
  const { currentBatch: activeBatch } = useBatch(); // ⛓️ STRICT: selected batch follow
  const recordedBy = user?.email ?? 'System';

  // ── DATA STATES ──
  const [trainees, setTrainees] = useState<TraineeData[]>([]);
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [collections, setCollections] = useState<FundCollection[]>([]);
  const [expenses, setExpenses] = useState<FundExpense[]>([]);
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [vendorEntries, setVendorEntries] = useState<VendorEntryData[]>([]);
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [absents, setAbsents] = useState<AbsentRecord[]>([]);
  const [fptRecords, setFptRecords] = useState<FPTRecord[]>([]);
  const [weeklyTests, setWeeklyTests] = useState<WeeklyTestRecord[]>([]);

  const [transferredOut, setTransferredOut] = useState<Record<string, number>>({});

    // ─── STAFF MODULE DATA STATES ────────────
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffLeaves, setStaffLeaves] = useState<StaffLeave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendance[]>([]);
  const [staffDuties, setStaffDuties] = useState<StaffDuty[]>([]);
  const [, setDutyTypes] = useState<DutyType[]>([]);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectAssignments, setSubjectAssignments] = useState<StaffSubjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── FILTERS ──
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(todayISO());
  const [filterPlatoon, setFilterPlatoon] = useState('All');
  const [filterBatch, setFilterBatch] = useState('All');
  useEffect(() => {
    if (activeBatch && filterBatch === 'All') setFilterBatch(activeBatch.batchNumber);
  }, [activeBatch?.batchNumber]);
  const [filterFund, setFilterFund] = useState<'All' | 'Mess' | 'Training' | 'Assets' | 'General'>('All');
  // ─── Staff Filters ────────────────────────
  const [filterStaffStatus, setFilterStaffStatus] = useState<string>('All');
  const [filterLeaveStatus, setFilterLeaveStatus] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const belongsToActiveBatch = (data: any) => Boolean(activeBatch && data.batchId === activeBatch.id);

  // ─── SAFE COLLECTION FETCHER ─────────────
  const safeFetch = async (collName: string) => {
    try {
      const snap = await getDocs(collection(db, collName));
      // 🧪 dev-tagged docs non-dev users ko nahi dikhenge
      return snap.docs.filter(d => showDoc(d.data() as Record<string, unknown>));
    } catch (err) {
      console.warn(`Collection ${collName} fetch failed:`, err);
      return [];
    }
  };

  // ─── FETCH ALL DATA ─────────────────────
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // ── TRAINEES ──
      const tDocs = (await safeFetch('trainees')).filter(d => belongsToActiveBatch(d.data()));
      const tList: TraineeData[] = tDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          chestNo: data.chestNo ?? '',
          name: data.name ?? '',
          rank: data.rank ?? 'RCT',
          platoon: normalizePlatoon(data.platoon),
          section: data.section ?? '-',
          attn: data.attn ?? 'P',
          medStat: data.medStat ?? 'SHAPE-1',
          batchNumber: data.batchNumber ?? '',
          batchName: data.batchName ?? '',
          fatherName: data.fatherName ?? '',
          mobileNo: data.mobileNo ?? '',
          district: data.district ?? '',
          state: data.state ?? '',
          bloodGroup: data.bloodGroup ?? '',
          joinDate: data.joinDate ?? '',
          issuedKitItems: data.issuedKitItems ?? [],
          pendingRecoveryAmount: Number(data.pendingRecoveryAmount ?? 0),
        };
      });
      setTrainees(tList);

      // ── BATCHES ──
      const bDocs = await safeFetch('batches');
      const bList: BatchData[] = bDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          batchNumber: data.batchNumber ?? '',
          batchName: data.batchName ?? '',
          status: data.status ?? '',
          totalTrainees: Number(data.totalTrainees ?? 0),
        };
      });
      setBatches(bList);

      // ── COLLECTIONS (4 funds merged) ──
      const allCols: FundCollection[] = [];

      const mcDocs = await safeFetch('mess_fund_collections');
      mcDocs.forEach(d => {
        const data = d.data();
        if (!belongsToActiveBatch(data)) return;
        allCols.push({
          id: d.id, fundType: 'Mess',
          amount: Number(data.amount ?? 0),
          date: data.date ?? '',
          label: data.monthLabel ?? data.label ?? 'Mess Cutting',
          perHead: Number(data.perHead ?? 0),
          traineeCount: Number(data.traineeCount ?? 0),
          paymentMode: data.paymentMode ?? 'Cash',
          recordedBy: data.recordedBy ?? '',
          monthLabel: data.monthLabel ?? '',
        });
      });

      const tcDocs = await safeFetch('training_fund_collections');
      tcDocs.forEach(d => {
        const data = d.data();
        if (!belongsToActiveBatch(data)) return;
        allCols.push({
          id: d.id, fundType: 'Training',
          amount: Number(data.amount ?? 0),
          date: data.date ?? '',
          label: data.label ?? 'Training Collection',
          perHead: Number(data.perHead ?? 0),
          traineeCount: Number(data.traineeCount ?? 0),
          paymentMode: data.paymentMode ?? 'Cash',
          recordedBy: data.recordedBy ?? '',
        });
      });

      const acDocs = await safeFetch('company_assets_collections');
      acDocs.forEach(d => {
        const data = d.data();
        if (!belongsToActiveBatch(data)) return;
        allCols.push({
          id: d.id, fundType: 'Assets',
          amount: Number(data.amount ?? 0),
          date: data.date ?? '',
          label: data.label ?? 'Assets Cutting',
          perHead: Number(data.perHead ?? 0),
          traineeCount: Number(data.traineeCount ?? 0),
          paymentMode: data.paymentMode ?? 'Cash',
          recordedBy: data.recordedBy ?? '',
        });
      });

      const gcDocs = await safeFetch('general_fund_collections');
      gcDocs.forEach(d => {
        const data = d.data();
        if (!belongsToActiveBatch(data)) return;
        allCols.push({
          id: d.id, fundType: 'General',
          amount: Number(data.amount ?? 0),
          date: data.date ?? '',
          label: data.label ?? data.remarks ?? 'General Collection',
          perHead: Number(data.perHead ?? 0),
          traineeCount: Number(data.traineeCount ?? 0),
          paymentMode: data.paymentMode ?? 'Cash',
          recordedBy: data.recordedBy ?? '',
        });
      });

      allCols.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCollections(allCols);

      // ── EXPENSES (4 funds merged) ──
      const allExps: FundExpense[] = [];

      const meDocs = await safeFetch('mess_fund_expenses');
      meDocs.forEach(d => {
        const data = d.data();
        allExps.push({
          id: d.id, fundType: 'Mess',
          amount: Number(data.amount ?? 0),
          itemName: data.categoryLabel ?? data.category ?? 'Mess Item',
          category: data.categoryLabel ?? '',
          vendor: data.vendor ?? '',
          vendorId: data.vendorId ?? '',
          date: data.date ?? '',
          quantity: 1,
          unitPrice: Number(data.amount ?? 0),
          billStatus: data.billStatus ?? 'Pending',
          dueAmount: Number(data.dueAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
          paymentMode: data.paymentMode ?? '',
          remarks: data.remarks ?? '',
        });
      });

      const teDocs = await safeFetch('training_fund_expenses');
      teDocs.forEach(d => {
        const data = d.data();
        if (!belongsToActiveBatch(data)) return;
        allExps.push({
          id: d.id, fundType: 'Training',
          amount: Number(data.amount ?? 0),
          itemName: data.itemName ?? 'Training Item',
          category: 'Training Essentials',
          vendor: data.vendor ?? '',
          vendorId: data.vendorId ?? '',
          date: data.date ?? '',
          quantity: Number(data.quantity ?? 1),
          unitPrice: Number(data.unitPrice ?? 0),
          billStatus: data.billStatus ?? 'Pending',
          dueAmount: Number(data.dueAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
          paymentMode: data.paymentMode ?? '',
          remarks: data.remarks ?? '',
        });
      });

      const aeDocs = await safeFetch('company_assets_expenses');
      aeDocs.forEach(d => {
        const data = d.data();
        if (!belongsToActiveBatch(data)) return;
        allExps.push({
          id: d.id, fundType: 'Assets',
          amount: Number(data.amount ?? 0),
          itemName: data.itemName ?? 'Asset Item',
          category: 'Company Assets',
          vendor: data.vendor ?? '',
          vendorId: data.vendorId ?? '',
          date: data.date ?? '',
          quantity: Number(data.quantity ?? 1),
          unitPrice: Number(data.unitPrice ?? 0),
          billStatus: data.billStatus ?? 'Pending',
          dueAmount: Number(data.dueAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
          paymentMode: data.paymentMode ?? '',
          remarks: data.remarks ?? '',
          assetStatus: data.assetStatus ?? 'Active',
        });
      });

      const geDocs = await safeFetch('general_fund_expenses');
      geDocs.forEach(d => {
        const data = d.data();
        if (!belongsToActiveBatch(data)) return;
        allExps.push({
          id: d.id, fundType: 'General',
          amount: Number(data.amount ?? 0),
          itemName: data.itemName ?? data.categoryLabel ?? 'General Expense',
          category: data.categoryLabel ?? data.category ?? '',
          vendor: data.vendor ?? '',
          vendorId: data.vendorId ?? '',
          date: data.date ?? '',
          quantity: 1,
          unitPrice: Number(data.amount ?? 0),
          billStatus: data.billStatus ?? 'Pending',
          dueAmount: Number(data.dueAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
          paymentMode: data.paymentMode ?? '',
          remarks: data.remarks ?? '',
        });
      });

      allExps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(allExps);

      // ── VENDORS ──
      const vDocs = await safeFetch('vendors');
      const vList: VendorData[] = vDocs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name ?? '',
            phone: data.phone ?? '',
            categoryLabel: data.categoryLabel ?? '',
            isActive: data.isActive !== false,
          };
        })
        .filter(v => v.isActive);
      setVendors(vList);

      // ── VENDOR ENTRIES ──
      const veDocs = await safeFetch('vendor_entries');
      const veList: VendorEntryData[] = veDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          vendorId: data.vendorId ?? '',
          vendorName: data.vendorName ?? '',
          categoryLabel: data.categoryLabel ?? '',
          fundKey: data.fundKey ?? '',
          items: data.items ?? [],
          totalAmount: Number(data.totalAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
          dueAmount: Number(data.dueAmount ?? 0),
          status: data.status ?? 'Pending',
          entryDate: data.entryDate ?? '',
        };
      });
      setVendorEntries(veList);

      // ── ISSUE RECORDS ──
      const isDocs = await safeFetch('issue_records');
      const isList: IssueRecord[] = isDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          chestNo: data.chestNo ?? '',
          traineeName: data.traineeName ?? '',
          platoon: data.platoon ?? '',
          issuedItems: data.issuedItems ?? data.items ?? [],
          totalItemsIssued: Number(data.totalItemsIssued ?? 0),
          totalValue: Number(data.totalValue ?? 0),
          issuedBy: data.issuedBy ?? '',
          issueDateISO: data.issueDateISO ?? data.date ?? '',
          issueSource: data.issueSource ?? data.issueType ?? '',
        };
      });
      isList.sort((a, b) => new Date(b.issueDateISO).getTime() - new Date(a.issueDateISO).getTime());
      setIssues(isList);

      // ── ABSENT RECORDS ──
      const arDocs = await safeFetch('absentRecords');
      const arList: AbsentRecord[] = arDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          chestNo: data.chestNo ?? '',
          traineeName: data.traineeName ?? '',
          type: data.type ?? '',
          status: data.status ?? '',
          reason: data.reason ?? '',
          fromDate: data.fromDate ?? '',
          toDate: data.toDate ?? '',
          totalDays: Number(data.totalDays ?? 0),
          batchId: data.batchId ?? '',
          platoon: data.platoon ?? '',
        };
      });
      arList.sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime());
      setAbsents(arList);

      // ── FPT RECORDS ──
      const fpDocs = await safeFetch('fptRecords');
      const fpList: FPTRecord[] = fpDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          traineeId: data.traineeId ?? '',
          weekNumber: Number(data.weekNumber ?? 0),
          testDate: data.testDate ?? '',
          obtainedMarks: Number(data.obtainedMarks ?? 0),
          totalMarks: Number(data.totalMarks ?? 0),
          percentage: Number(data.percentage ?? 0),
          result: data.result ?? '',
        };
      });
      setFptRecords(fpList);

      // ── WEEKLY TEST RECORDS ──
      const wtDocs = await safeFetch('weeklyTestRecords');
      const wtList: WeeklyTestRecord[] = wtDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          traineeId: data.traineeId ?? '',
          weekNumber: Number(data.weekNumber ?? 0),
          testName: data.testName ?? '',
          subject: data.subject ?? '',
          testDate: data.testDate ?? '',   
          obtainedMarks: Number(data.obtainedMarks ?? 0),
          totalMarks: Number(data.totalMarks ?? 0),
          percentage: Number(data.percentage ?? 0),
          result: data.result ?? '',
        };
      });
      setWeeklyTests(wtList);

      // ── FUND TRANSFERS ──
      const ftDocs = await safeFetch('fund_transfers');
      const transferMap: Record<string, number> = {
        mess_fund: 0, training_fund: 0,
        company_assets_fund: 0, general_fund: 0
      };
      ftDocs.forEach(d => {
        const data = d.data();
        const fromKey = data.fromFundKey ?? '';
        if (fromKey && transferMap[fromKey] !== undefined) {
          transferMap[fromKey] += Number(data.amount ?? 0);
        }
      });
      setTransferredOut(transferMap);

            // ═══════════════════════════════════════
      // 🆕 STAFF MODULE DATA FETCH
      // ═══════════════════════════════════════

      // ── STAFF PROFILES ──
      const stDocs = await safeFetch('staff');
      const stList: Staff[] = stDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          batchId: data.batchId ?? '',
          batchNumber: data.batchNumber ?? '',
          forceNumber: data.forceNumber ?? '',
          name: data.name ?? '',
          rank: data.rank ?? '',
          mobile: data.mobile ?? '',
          email: data.email ?? '',
          company: data.company ?? '',
          category: data.category ?? '',
          battalion: data.battalion ?? '',
          dateOfJoining: data.dateOfJoining?.toDate() ?? null,
          dateOfPosting: data.dateOfPosting?.toDate() ?? null,
          experienceYears: Number(data.experienceYears ?? 0),
          qualification: data.qualification ?? '',
          bloodGroup: data.bloodGroup ?? '',
          emergencyContact: data.emergencyContact ?? { name: '', relation: '', mobile: '', address: '' },
          status: data.status ?? 'active',
          photoURL: data.photoURL ?? '',
          remarks: data.remarks ?? '',
          createdAt: data.createdAt?.toDate() ?? null,
          updatedAt: data.updatedAt?.toDate() ?? null,
          createdBy: data.createdBy ?? '',
        };
      });
      setStaffList(stList);

      // ── STAFF LEAVES ──
      const slDocs = await safeFetch('staff_leave');
      const slList: StaffLeave[] = slDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          leaveNumber: data.leaveNumber ?? '',
          staffId: data.staffId ?? '',
          staffName: data.staffName ?? '',
          forceNumber: data.forceNumber ?? '',
          rank: data.rank ?? '',
          leaveTypeId: data.leaveTypeId ?? '',
          leaveTypeName: data.leaveTypeName ?? '',
          leaveTypeCode: data.leaveTypeCode ?? '',
          fromDate: data.fromDate?.toDate() ?? null,
          toDate: data.toDate?.toDate() ?? null,
          numberOfDays: Number(data.numberOfDays ?? 0),
          reason: data.reason ?? '',
          leaveAddress: data.leaveAddress ?? '',
          contactNumber: data.contactNumber ?? '',
          status: data.status ?? 'pending',
          appliedAt: data.appliedAt?.toDate() ?? null,
          appliedBy: data.appliedBy ?? '',
          approvedBy: data.approvedBy ?? '',
          approvedByName: data.approvedByName ?? '',
          approvalDate: data.approvalDate?.toDate() ?? null,
          rejectionReason: data.rejectionReason ?? '',
          returnDate: data.returnDate?.toDate() ?? null,
          joiningReportSubmitted: Boolean(data.joiningReportSubmitted ?? false),
          delayReason: data.delayReason ?? '',
          remarks: data.remarks ?? '',
        };
      });
      setStaffLeaves(slList);

      // ── LEAVE TYPES ──
      const ltDocs = await safeFetch('leave_types');
      const ltList: LeaveType[] = ltDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? '',
          code: data.code ?? '',
          maxDaysPerYear: Number(data.maxDaysPerYear ?? 0),
          isPaid: Boolean(data.isPaid ?? true),
          isActive: Boolean(data.isActive ?? true),
          description: data.description ?? '',
          createdAt: data.createdAt?.toDate() ?? null,
        };
      });
      setLeaveTypes(ltList);

      // ── STAFF ATTENDANCE ──
      const saDocs = await safeFetch('staff_attendance');
      const saList: StaffAttendance[] = saDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          staffId: data.staffId ?? '',
          staffName: data.staffName ?? '',
          forceNumber: data.forceNumber ?? '',
          date: data.date?.toDate() ?? null,
          status: data.status ?? 'present',
          remarks: data.remarks ?? '',
          markedBy: data.markedBy ?? '',
          markedAt: data.markedAt?.toDate() ?? null,
          updatedAt: data.updatedAt?.toDate() ?? null,
        };
      });
      setStaffAttendance(saList);

      // ── STAFF DUTIES ──
      const sdDocs = await safeFetch('staff_duty');
      const sdList: StaffDuty[] = sdDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          dutyTypeId: data.dutyTypeId ?? '',
          dutyTypeName: data.dutyTypeName ?? '',
          staffId: data.staffId ?? '',
          staffName: data.staffName ?? '',
          forceNumber: data.forceNumber ?? '',
          rank: data.rank ?? '',
          date: data.date?.toDate() ?? null,
          startTime: data.startTime ?? '',
          endTime: data.endTime ?? '',
          venue: data.venue ?? '',
          status: data.status ?? 'assigned',
          remarks: data.remarks ?? '',
          assignedBy: data.assignedBy ?? '',
          assignedAt: data.assignedAt?.toDate() ?? null,
          completedAt: data.completedAt?.toDate() ?? null,
          transferredTo: data.transferredTo ?? '',
          transferReason: data.transferReason ?? '',
        };
      });
      setStaffDuties(sdList);

      // ── DUTY TYPES ──
      const dtDocs = await safeFetch('duty_types');
      const dtList: DutyType[] = dtDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? '',
          description: data.description ?? '',
          isActive: Boolean(data.isActive ?? true),
          createdAt: data.createdAt?.toDate() ?? null,
        };
      });
      setDutyTypes(dtList);

      // ── SUBJECTS ──
      const subjDocs = await safeFetch('subject_master');
      const subjList: Subject[] = subjDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? '',
          code: data.code ?? '',
          category: data.category ?? '',
          description: data.description ?? '',
          isActive: Boolean(data.isActive ?? true),
          createdAt: data.createdAt?.toDate() ?? null,
          updatedAt: data.updatedAt?.toDate() ?? null,
          createdBy: data.createdBy ?? '',
        };
      });
      setSubjects(subjList);

      // ── SUBJECT ASSIGNMENTS ──
      const ssDocs = await safeFetch('staff_subjects');
      const ssList: StaffSubjectAssignment[] = ssDocs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          staffId: data.staffId ?? '',
          staffName: data.staffName ?? '',
          forceNumber: data.forceNumber ?? '',
          subjectId: data.subjectId ?? '',
          subjectName: data.subjectName ?? '',
          subjectCode: data.subjectCode ?? '',
          assignedDate: data.assignedDate?.toDate() ?? null,
          assignedBy: data.assignedBy ?? '',
          isActive: Boolean(data.isActive ?? true),
          remarks: data.remarks ?? '',
          createdAt: data.createdAt?.toDate() ?? null,
        };
      });
      setSubjectAssignments(ssList);

    } catch (err) {
      console.error(err);
      setError('Data load error. Refresh karein.');
    } finally {
      setLoading(false);
    }
  }, [activeBatch?.id]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ─── HELPERS FOR REPORTS ────────────────
  const addToHistory = (name: string, type: string, format: 'EXCEL' | 'PRINT', count: number) => {
    setGeneratedReports(prev => [{
      id: `RPT-${Date.now()}`,
      reportName: name, reportType: type,
      generatedBy: recordedBy, date: new Date().toISOString(),
      format, recordCount: count,
    }, ...prev]);
  };

  const filterByDate = <T extends { date?: string; fromDate?: string; entryDate?: string; issueDateISO?: string; testDate?: string }>(
    items: T[],
    dateField: keyof T = 'date' as keyof T
  ): T[] => {
    if (!dateFrom && !dateTo) return items;
    return items.filter(item => {
      const d = String(item[dateField] ?? '').split('T')[0];
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  };

  // ═══════════════════════════════════════════
  // REPORT GENERATORS
  // ═══════════════════════════════════════════

  // 1. MASTER TRAINEE LIST
  const generateTraineeMaster = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('trainee_master');
    let filtered = trainees;
    if (filterPlatoon !== 'All') filtered = filtered.filter(t => t.platoon === filterPlatoon);
    if (filterBatch !== 'All') filtered = filtered.filter(t => t.batchNumber === filterBatch);

    const headers = ['S.No', 'Chest No', 'Rank', 'Name', 'Father', 'Batch', 'Platoon', 'Section', 'Blood', 'Mobile', 'District', 'State', 'Med Status'];
    const rows = filtered.map((t, i) => [
      String(i + 1), t.chestNo, t.rank, t.name, t.fatherName,
      t.batchNumber, t.platoon, t.section, t.bloodGroup,
      t.mobileNo, t.district, t.state, t.medStat
    ]);
    const summary = `Total Trainees: ${filtered.length} | Batches: ${new Set(filtered.map(t => t.batchNumber)).size} | Platoons: ${new Set(filtered.map(t => t.platoon)).size}`;
    const title = `Master Trainee List ${filterBatch !== 'All' ? `— Batch ${filterBatch}` : ''}`;

    if (format === 'EXCEL') downloadCSV('Trainee_Master', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Trainee', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 2. ATTENDANCE REPORT
  const generateAttendance = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('attendance');
    let filtered = trainees;
    if (filterPlatoon !== 'All') filtered = filtered.filter(t => t.platoon === filterPlatoon);
    if (filterBatch !== 'All') filtered = filtered.filter(t => t.batchNumber === filterBatch);

    const headers = ['S.No', 'Chest No', 'Rank', 'Name', 'Batch', 'Platoon', 'Attendance', 'Medical'];
    const rows = filtered.map((t, i) => [
      String(i + 1), t.chestNo, t.rank, t.name, t.batchNumber, t.platoon, t.attn, t.medStat
    ]);

    const present = filtered.filter(t => t.attn === 'P').length;
    const absent = filtered.filter(t => t.attn === 'A').length;
    const sick = filtered.filter(t => t.attn === 'SICK' || t.attn === 'S').length;
    const leave = filtered.filter(t => t.attn === 'L').length;
    const pct = filtered.length > 0 ? Math.round((present / filtered.length) * 100) : 0;
    const summary = `Total: ${filtered.length} | Present: ${present} | Absent: ${absent} | Sick: ${sick} | Leave: ${leave} | Attendance %: ${pct}%`;
    const title = `Daily Attendance Report — ${new Date().toLocaleDateString('en-IN')}`;

    if (format === 'EXCEL') downloadCSV('Attendance_Report', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Attendance', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 3. ABSENT / SICK REPORT
  const generateAbsentReport = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('absent');
    const filtered = filterByDate(absents, 'fromDate');
    const headers = ['S.No', 'Chest No', 'Name', 'Type', 'From Date', 'To Date', 'Days', 'Reason', 'Status'];
    const rows = filtered.map((a, i) => [
      String(i + 1), a.chestNo, a.traineeName, a.type,
      formatDate(a.fromDate), formatDate(a.toDate), String(a.totalDays),
      a.reason || '—', a.status
    ]);
    const active = filtered.filter(a => a.status === 'Active').length;
    const summary = `Total Records: ${filtered.length} | Active: ${active} | Total Days Lost: ${filtered.reduce((s, a) => s + a.totalDays, 0)}`;
    const title = 'Absent / Sick / Leave Report';

    if (format === 'EXCEL') downloadCSV('Absent_Report', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Absent', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 4. KIT ISSUE REGISTER (with item names)
  const generateKitIssueRegister = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('kit_issue');
    const filtered = filterByDate(issues, 'issueDateISO');

    const headers = ['S.No', 'Date', 'Chest No', 'Trainee Name', 'Platoon', 'Item Name', 'Size', 'Qty', 'Issued By'];
    const rows: string[][] = [];
    let sno = 1;
    filtered.forEach(iss => {
      iss.issuedItems.forEach((item: any) => {
        rows.push([
          String(sno++), formatDate(iss.issueDateISO), iss.chestNo, iss.traineeName,
          iss.platoon, item.itemName ?? '', item.assignedSize ?? '—',
          String(item.quantity ?? 1), iss.issuedBy
        ]);
      });
    });

    const totalValue = filtered.reduce((s, i) => s + i.totalValue, 0);
    const summary = `Total Issues: ${filtered.length} | Items: ${rows.length} | Unique Trainees: ${new Set(filtered.map(i => i.chestNo)).size} | Value: ${formatCurrency(totalValue)}`;
    const title = 'Kit Issue Register — Trainee Wise';

    if (format === 'EXCEL') downloadCSV('Kit_Issue_Register', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Kit Issue', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 5. ITEM-WISE STOCK REPORT (from training_fund_expenses + issue_records)
  const generateStockReport = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('stock');

    // Build stock map: item -> { purchased, issued, current }
    const stockMap: Record<string, { purchased: number; issued: number; value: number; vendor: string }> = {};

    expenses.filter(e => e.fundType === 'Training' || e.fundType === 'Assets').forEach(exp => {
      const key = exp.itemName.trim();
      if (!key) return;
      if (!stockMap[key]) stockMap[key] = { purchased: 0, issued: 0, value: 0, vendor: '' };
      stockMap[key].purchased += exp.quantity;
      stockMap[key].value += exp.amount;
      if (exp.vendor && !stockMap[key].vendor) stockMap[key].vendor = exp.vendor;
    });

    issues.forEach(iss => {
      iss.issuedItems.forEach((item: any) => {
        const key = String(item.itemName ?? '').trim();
        if (!key) return;
        if (!stockMap[key]) stockMap[key] = { purchased: 0, issued: 0, value: 0, vendor: '' };
        stockMap[key].issued += Number(item.quantity ?? 1);
      });
    });

    const headers = ['S.No', 'Item Name', 'Vendor', 'Purchased', 'Issued', 'Current Stock', 'Total Value', 'Status'];
    const rows = Object.entries(stockMap)
      .sort(([, a], [, b]) => (b.purchased - b.issued) - (a.purchased - a.issued))
      .map(([name, data], i) => {
        const current = Math.max(0, data.purchased - data.issued);
        const status = current === 0 ? 'OUT OF STOCK' : current <= 5 ? 'LOW STOCK' : 'OK';
        return [
          String(i + 1), name, data.vendor || '—',
          String(data.purchased), String(data.issued), String(current),
          formatCurrency(data.value), status
        ];
      });

    const totalValue = Object.values(stockMap).reduce((s, d) => s + d.value, 0);
    const outOfStock = rows.filter(r => r[7] === 'OUT OF STOCK').length;
    const lowStock = rows.filter(r => r[7] === 'LOW STOCK').length;
    const summary = `Total Items: ${rows.length} | Total Value: ${formatCurrency(totalValue)} | Out of Stock: ${outOfStock} | Low Stock: ${lowStock}`;
    const title = 'Live Inventory Stock Report (Item-wise)';

    if (format === 'EXCEL') downloadCSV('Stock_Report', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Stock', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 6. COLLECTION REPORT (all funds)
  const generateCollectionReport = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('collection');
    let filtered = filterByDate(collections);
    if (filterFund !== 'All') filtered = filtered.filter(c => c.fundType === filterFund);

    const headers = ['S.No', 'Date', 'Fund', 'Label', 'Per Head', 'Trainees', 'Amount', 'Mode', 'Recorded By'];
    const rows = filtered.map((c, i) => [
      String(i + 1), formatDate(c.date), c.fundType, c.label,
      c.perHead > 0 ? `₹${c.perHead}` : '—',
      c.traineeCount > 0 ? String(c.traineeCount) : '—',
      formatCurrency(c.amount), c.paymentMode, c.recordedBy
    ]);

    const total = filtered.reduce((s, c) => s + c.amount, 0);
    const byFund = ['Mess', 'Training', 'Assets', 'General'].map(f => {
      const amt = filtered.filter(c => c.fundType === f).reduce((s, c) => s + c.amount, 0);
      return `${f}: ${formatCurrency(amt)}`;
    }).join(' | ');
    const summary = `Total Collections: ${filtered.length} | Total Amount: ${formatCurrency(total)} | ${byFund}`;
    const title = `Fund Collection Report ${filterFund !== 'All' ? `— ${filterFund} Fund` : '— All Funds'}`;

    if (format === 'EXCEL') downloadCSV('Collection_Report', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Collection', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 7. EXPENSE REPORT (all funds, with item names)
  const generateExpenseReport = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('expense');
    let filtered = filterByDate(expenses);
    if (filterFund !== 'All') filtered = filtered.filter(e => e.fundType === filterFund);

    const headers = ['S.No', 'Date', 'Fund', 'Item Name', 'Category', 'Vendor', 'Qty', 'Unit Price', 'Total', 'Paid', 'Due', 'Bill Status', 'Mode'];
    const rows = filtered.map((e, i) => [
      String(i + 1), formatDate(e.date), e.fundType, e.itemName,
      e.category || '—', e.vendor || '—',
      String(e.quantity), `₹${e.unitPrice}`,
      formatCurrency(e.amount), formatCurrency(e.paidAmount),
      formatCurrency(e.dueAmount), e.billStatus, e.paymentMode || '—'
    ]);

    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const totalPaid = filtered.reduce((s, e) => s + e.paidAmount, 0);
    const totalDue = filtered.reduce((s, e) => s + e.dueAmount, 0);
    const pendingBills = filtered.filter(e => e.billStatus === 'Pending').length;
    const summary = `Total Expenses: ${filtered.length} | Total Amount: ${formatCurrency(total)} | Paid: ${formatCurrency(totalPaid)} | Due: ${formatCurrency(totalDue)} | Pending Bills: ${pendingBills}`;
    const title = `Fund Expense Report ${filterFund !== 'All' ? `— ${filterFund} Fund` : '— All Funds'}`;

    if (format === 'EXCEL') downloadCSV('Expense_Report', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Expense', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 8. VENDOR DUES REPORT
  const generateVendorDues = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('vendor_dues');

    // Aggregate by vendor
    const vendorMap: Record<string, { name: string; category: string; total: number; paid: number; due: number; entries: number }> = {};

    vendorEntries.forEach(ve => {
      if (ve.dueAmount <= 0) return;
      if (!vendorMap[ve.vendorId]) {
        const v = vendors.find(x => x.id === ve.vendorId);
        vendorMap[ve.vendorId] = {
          name: v?.name ?? ve.vendorName,
          category: v?.categoryLabel ?? ve.categoryLabel,
          total: 0, paid: 0, due: 0, entries: 0
        };
      }
      vendorMap[ve.vendorId].total += ve.totalAmount;
      vendorMap[ve.vendorId].paid += ve.paidAmount;
      vendorMap[ve.vendorId].due += ve.dueAmount;
      vendorMap[ve.vendorId].entries += 1;
    });

    const headers = ['S.No', 'Vendor Name', 'Category', 'Entries', 'Total', 'Paid', 'Due'];
    const rows = Object.entries(vendorMap)
      .sort(([, a], [, b]) => b.due - a.due)
      .map(([, v], i) => [
        String(i + 1), v.name, v.category, String(v.entries),
        formatCurrency(v.total), formatCurrency(v.paid), formatCurrency(v.due)
      ]);

    const totalDue = Object.values(vendorMap).reduce((s, v) => s + v.due, 0);
    const summary = `Total Vendors with Dues: ${rows.length} | Total Outstanding: ${formatCurrency(totalDue)}`;
    const title = 'Vendor Dues — Outstanding Payments';

    if (format === 'EXCEL') downloadCSV('Vendor_Dues', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Vendor Dues', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 9. FUND SUMMARY REPORT
  const generateFundSummary = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('fund_summary');

    const funds = ['Mess', 'Training', 'Assets', 'General'] as const;
    const fundKeyMap: Record<string, string> = {
      Mess: 'mess_fund', Training: 'training_fund',
      Assets: 'company_assets_fund', General: 'general_fund'
    };

    const headers = ['Fund', 'Collection', 'Total Orders', 'Actually Paid', 'Transferred Out', 'Cash Balance', 'Vendor Due'];
    const rows = funds.map(f => {
      const col = collections.filter(c => c.fundType === f).reduce((s, c) => s + c.amount, 0);
      const fundExps = expenses.filter(e => e.fundType === f);
      const expTotal = fundExps.reduce((s, e) => s + e.amount, 0);
      const actuallyPaid = fundExps.reduce((s, e) => {
        if (e.vendorId) return s + e.paidAmount;
        return s + e.amount;
      }, 0);
      const transferred = transferredOut[fundKeyMap[f]] ?? 0;
      const balance = col - actuallyPaid - transferred;
      const vendorDue = fundExps.reduce((s, e) => s + e.dueAmount, 0);

      return [
        f + ' Fund',
        formatCurrency(col), formatCurrency(expTotal),
        formatCurrency(actuallyPaid), formatCurrency(transferred),
        formatCurrency(balance), formatCurrency(vendorDue)
      ];
    });

    // Grand totals
    const grandCol = collections.reduce((s, c) => s + c.amount, 0);
    const grandExp = expenses.reduce((s, e) => s + e.amount, 0);
    const grandPaid = expenses.reduce((s, e) => {
      if (e.vendorId) return s + e.paidAmount;
      return s + e.amount;
    }, 0);
    const grandTransfer = Object.values(transferredOut).reduce((s, v) => s + v, 0);
    const grandBalance = grandCol - grandPaid;
    const grandDue = expenses.reduce((s, e) => s + e.dueAmount, 0);

    rows.push([
      'TOTAL (ALL FUNDS)',
      formatCurrency(grandCol), formatCurrency(grandExp),
      formatCurrency(grandPaid), formatCurrency(grandTransfer),
      formatCurrency(grandBalance), formatCurrency(grandDue)
    ]);

    const summary = `Total Collection: ${formatCurrency(grandCol)} | Total Expense: ${formatCurrency(grandExp)} | Net Balance: ${formatCurrency(grandBalance)} | Vendor Dues: ${formatCurrency(grandDue)}`;
    const title = 'Company Fund Summary — All 4 Funds';

    if (format === 'EXCEL') downloadCSV('Fund_Summary', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Fund Summary', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 10. FPT RESULTS REPORT
  const generateFPTReport = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('fpt');
    const filtered = filterByDate(fptRecords, 'testDate');

    // Join with trainees
    const headers = ['S.No', 'Chest No', 'Name', 'Platoon', 'Week', 'Date', 'Obtained', 'Total', 'Percentage', 'Result'];
    const rows = filtered.map((r, i) => {
      const t = trainees.find(x => x.id === r.traineeId);
      return [
        String(i + 1), t?.chestNo ?? '—', t?.name ?? '—', t?.platoon ?? '—',
        `W${r.weekNumber}`, formatDate(r.testDate),
        String(r.obtainedMarks), String(r.totalMarks),
        `${r.percentage}%`, r.result
      ];
    });

    const passed = filtered.filter(r => r.result === 'Pass').length;
    const failed = filtered.filter(r => r.result === 'Fail').length;
    const avgPct = filtered.length > 0
      ? Math.round(filtered.reduce((s, r) => s + r.percentage, 0) / filtered.length)
      : 0;
    const summary = `Total Tests: ${filtered.length} | Passed: ${passed} | Failed: ${failed} | Average: ${avgPct}%`;
    const title = 'FPT (Field Physical Test) Results';

    if (format === 'EXCEL') downloadCSV('FPT_Results', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'FPT', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 11. WEEKLY TEST RESULTS
  const generateWeeklyTestReport = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('weekly');
    const filtered = filterByDate(weeklyTests, 'testDate');


    const headers = ['S.No', 'Chest No', 'Name', 'Week', 'Test Name', 'Subject', 'Obtained', 'Total', '%', 'Result'];
    const rows = filtered.map((r, i) => {
      const t = trainees.find(x => x.id === r.traineeId);
      return [
        String(i + 1), t?.chestNo ?? '—', t?.name ?? '—',
        `W${r.weekNumber}`, r.testName, r.subject,
        String(r.obtainedMarks), String(r.totalMarks),
        `${r.percentage}%`, r.result
      ];
    });

    const passed = filtered.filter(r => r.result === 'Pass').length;
    const summary = `Total Tests: ${filtered.length} | Passed: ${passed} | Failed: ${filtered.length - passed}`;
    const title = 'Weekly Test Results';

    if (format === 'EXCEL') downloadCSV('Weekly_Tests', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Weekly Test', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 12. BATCH ROSTER
  const generateBatchRoster = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('batch');
    const headers = ['S.No', 'Batch No', 'Batch Name', 'Status', 'Total Trainees', 'Actual Count'];
    const rows = batches.map((b, i) => {
      const actualCount = trainees.filter(t => t.batchNumber === b.batchNumber).length;
      return [
        String(i + 1), b.batchNumber, b.batchName, b.status,
        String(b.totalTrainees), String(actualCount)
      ];
    });
    const summary = `Total Batches: ${batches.length} | Active: ${batches.filter(b => b.status === 'active').length} | Total Trainees: ${trainees.length}`;
    const title = 'Batch Roster Report';

    if (format === 'EXCEL') downloadCSV('Batch_Roster', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Batch', format, batches.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };
  // ═══════════════════════════════════════════════════════════
  // 🆕 STAFF MODULE REPORT GENERATORS
  // ═══════════════════════════════════════════════════════════

  const formatDateOnly = (d: Date | null) =>
    d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // 13. STAFF MASTER LIST
  const generateStaffMaster = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('staff_master');
    let filtered = staffList;
    if (filterStaffStatus !== 'All') {
      filtered = filtered.filter(s => s.status === filterStaffStatus);
    }

    const headers = ['S.No', 'Force No', 'Rank', 'Name', 'Mobile', 'Company', 'Blood Group', 'Experience', 'Qualification', 'Status', 'Joining Date'];
    const rows = filtered.map((s, i) => [
      String(i + 1),
      s.forceNumber,
      s.rank,
      s.name,
      s.mobile,
      s.company || '—',
      s.bloodGroup || '—',
      `${s.experienceYears} yrs`,
      s.qualification || '—',
      s.status.toUpperCase(),
      formatDateOnly(s.dateOfJoining),
    ]);

    const active = filtered.filter(s => s.status === 'active').length;
    const onLeave = filtered.filter(s => s.status === 'leave').length;
    const summary = `Total Staff: ${filtered.length} | Active: ${active} | On Leave: ${onLeave} | Ranks: ${new Set(filtered.map(s => s.rank)).size}`;
    const title = `Staff Master List ${filterStaffStatus !== 'All' ? `— ${filterStaffStatus.toUpperCase()}` : ''}`;

    if (format === 'EXCEL') downloadCSV('Staff_Master', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Staff', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 14. STAFF ATTENDANCE MONTHLY
  const generateStaffAttendance = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('staff_attendance');

    // Filter by selected month/year
    const monthAttendance = staffAttendance.filter(a => {
      if (!a.date) return false;
      return a.date.getMonth() === selectedMonth - 1 && a.date.getFullYear() === selectedYear;
    });

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    // Aggregate per staff
    const summary: Record<string, {
      staffName: string;
      forceNumber: string;
      rank: string;
      present: number;
      absent: number;
      leave: number;
      td: number;
      hospital: number;
      course: number;
      weeklyOff: number;
    }> = {};

    // Initialize for all staff
    staffList.filter(s => s.status !== 'inactive').forEach(s => {
      summary[s.id] = {
        staffName: s.name,
        forceNumber: s.forceNumber,
        rank: s.rank,
        present: 0, absent: 0, leave: 0, td: 0,
        hospital: 0, course: 0, weeklyOff: 0,
      };
    });

    // Count from records
    monthAttendance.forEach(a => {
      if (!summary[a.staffId]) return;
      switch (a.status) {
        case 'present': summary[a.staffId].present++; break;
        case 'absent': summary[a.staffId].absent++; break;
        case 'leave': summary[a.staffId].leave++; break;
        case 'td': summary[a.staffId].td++; break;
        case 'hospital': summary[a.staffId].hospital++; break;
        case 'course': summary[a.staffId].course++; break;
        case 'weekly_off': summary[a.staffId].weeklyOff++; break;
      }
    });

    const headers = ['S.No', 'Force No', 'Rank', 'Name', 'Present', 'Absent', 'Leave', 'TD', 'Hospital', 'Course', 'W/O', 'Attendance %'];
    const rows = Object.values(summary).map((s, i) => {
      const workingDays = daysInMonth - s.weeklyOff;
      const pct = workingDays > 0 ? Math.round((s.present / workingDays) * 100) : 0;
      return [
        String(i + 1),
        s.forceNumber,
        s.rank,
        s.staffName,
        String(s.present),
        String(s.absent),
        String(s.leave),
        String(s.td),
        String(s.hospital),
        String(s.course),
        String(s.weeklyOff),
        `${pct}%`,
      ];
    });

    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('en-IN', { month: 'long' });
    const totalPresent = Object.values(summary).reduce((s, x) => s + x.present, 0);
    const totalAbsent = Object.values(summary).reduce((s, x) => s + x.absent, 0);
    const summaryText = `Month: ${monthName} ${selectedYear} | Days: ${daysInMonth} | Total Staff: ${rows.length} | Total Present Days: ${totalPresent} | Total Absent Days: ${totalAbsent}`;
    const title = `Staff Attendance Report — ${monthName} ${selectedYear}`;

    if (format === 'EXCEL') downloadCSV(`Staff_Attendance_${monthName}_${selectedYear}`, headers, rows);
    else printReport(title, headers, rows, summaryText);
    addToHistory(title, 'Staff Attendance', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 15. LEAVE APPLICATIONS REPORT
  const generateLeaveReport = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('leave_report');
    let filtered = staffLeaves;
    if (filterLeaveStatus !== 'All') {
      filtered = filtered.filter(l => l.status === filterLeaveStatus);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(l => {
        if (!l.fromDate) return false;
        const d = l.fromDate.toISOString().split('T')[0];
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
    }

    const headers = ['S.No', 'Leave No', 'Force No', 'Rank', 'Name', 'Leave Type', 'From Date', 'To Date', 'Days', 'Reason', 'Status', 'Approved By'];
    const rows = filtered.map((l, i) => [
      String(i + 1),
      l.leaveNumber,
      l.forceNumber,
      l.rank,
      l.staffName,
      `${l.leaveTypeName} (${l.leaveTypeCode})`,
      formatDateOnly(l.fromDate),
      formatDateOnly(l.toDate),
      String(l.numberOfDays),
      l.reason || '—',
      l.status.toUpperCase(),
      l.approvedByName || '—',
    ]);

    const pending = filtered.filter(l => l.status === 'pending').length;
    const approved = filtered.filter(l => l.status === 'approved').length;
    const rejected = filtered.filter(l => l.status === 'rejected').length;
    const totalDays = filtered.filter(l => l.status === 'approved').reduce((s, l) => s + l.numberOfDays, 0);
    const summary = `Total Applications: ${filtered.length} | Approved: ${approved} | Pending: ${pending} | Rejected: ${rejected} | Total Approved Days: ${totalDays}`;
    const title = `Staff Leave Report ${filterLeaveStatus !== 'All' ? `— ${filterLeaveStatus.toUpperCase()}` : ''}`;

    if (format === 'EXCEL') downloadCSV('Staff_Leave', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Leave', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 16. LEAVE BALANCE REPORT
  const generateLeaveBalance = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('leave_balance');

    const currentYear = new Date().getFullYear();

    // Calculate leave taken per staff per type
    const balanceMap: Record<string, Record<string, number>> = {};

    staffLeaves
      .filter(l => l.status === 'approved' && l.fromDate?.getFullYear() === currentYear)
      .forEach(l => {
        if (!balanceMap[l.staffId]) balanceMap[l.staffId] = {};
        if (!balanceMap[l.staffId][l.leaveTypeId]) balanceMap[l.staffId][l.leaveTypeId] = 0;
        balanceMap[l.staffId][l.leaveTypeId] += l.numberOfDays;
      });

    const activeLeaveTypes = leaveTypes.filter(lt => lt.isActive);

    const headers = ['S.No', 'Force No', 'Rank', 'Name', ...activeLeaveTypes.flatMap(lt => [`${lt.code} Used`, `${lt.code} Bal`])];

    const rows = staffList
      .filter(s => s.status !== 'inactive')
      .map((s, i) => {
        const row = [String(i + 1), s.forceNumber, s.rank, s.name];
        activeLeaveTypes.forEach(lt => {
          const used = balanceMap[s.id]?.[lt.id] ?? 0;
          const balance = Math.max(0, lt.maxDaysPerYear - used);
          row.push(String(used), String(balance));
        });
        return row;
      });

    const summary = `Year: ${currentYear} | Total Staff: ${rows.length} | Leave Types: ${activeLeaveTypes.length} | Total Approved Leave Days: ${Object.values(balanceMap).flatMap(m => Object.values(m)).reduce((s, v) => s + v, 0)}`;
    const title = `Staff Leave Balance Report — ${currentYear}`;

    if (format === 'EXCEL') downloadCSV('Leave_Balance', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Leave Balance', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 17. DUTY ASSIGNMENT REPORT
  const generateDutyReport = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('duty_report');
    let filtered = staffDuties;

    if (dateFrom || dateTo) {
      filtered = filtered.filter(d => {
        if (!d.date) return false;
        const dStr = d.date.toISOString().split('T')[0];
        if (dateFrom && dStr < dateFrom) return false;
        if (dateTo && dStr > dateTo) return false;
        return true;
      });
    }

    const headers = ['S.No', 'Date', 'Duty Type', 'Force No', 'Rank', 'Name', 'Timing', 'Venue', 'Status', 'Remarks'];
    const rows = filtered.map((d, i) => [
      String(i + 1),
      formatDateOnly(d.date),
      d.dutyTypeName,
      d.forceNumber,
      d.rank,
      d.staffName,
      d.startTime && d.endTime ? `${d.startTime} - ${d.endTime}` : '—',
      d.venue || '—',
      d.status.toUpperCase(),
      d.remarks || '—',
    ]);

    const completed = filtered.filter(d => d.status === 'completed').length;
    const assigned = filtered.filter(d => d.status === 'assigned').length;
    const transferred = filtered.filter(d => d.status === 'transferred').length;
    const summary = `Total Duties: ${filtered.length} | Completed: ${completed} | Assigned: ${assigned} | Transferred: ${transferred} | Duty Types Used: ${new Set(filtered.map(d => d.dutyTypeName)).size}`;
    const title = 'Staff Duty Assignment Report';

    if (format === 'EXCEL') downloadCSV('Staff_Duty', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Duty', format, filtered.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 18. SUBJECT ASSIGNMENT REPORT
  const generateSubjectAssignment = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('subject_assignment');

    const activeAssignments = subjectAssignments.filter(a => a.isActive);

    const headers = ['S.No', 'Force No', 'Rank', 'Instructor Name', 'Subject Code', 'Subject Name', 'Assigned Date', 'Remarks'];
    const rows = activeAssignments.map((a, i) => [
      String(i + 1),
      a.forceNumber,
      staffList.find(s => s.id === a.staffId)?.rank ?? '—',
      a.staffName,
      a.subjectCode,
      a.subjectName,
      formatDateOnly(a.assignedDate),
      a.remarks || '—',
    ]);

    const uniqueInstructors = new Set(activeAssignments.map(a => a.staffId)).size;
    const uniqueSubjects = new Set(activeAssignments.map(a => a.subjectId)).size;
    const summary = `Total Assignments: ${rows.length} | Instructors: ${uniqueInstructors} | Subjects: ${uniqueSubjects} | Available Subjects: ${subjects.filter(s => s.isActive).length}`;
    const title = 'Instructor — Subject Assignment Report';

    if (format === 'EXCEL') downloadCSV('Subject_Assignments', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Subject Assignment', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 19. INSTRUCTOR CATEGORY SUMMARY
  const generateInstructorSummary = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('instructor_summary');

    // Group by subject category via assignments
    const categoryMap: Record<string, {
      instructors: Set<string>;
      subjects: Set<string>;
    }> = {};

    subjectAssignments.filter(a => a.isActive).forEach(a => {
      const subj = subjects.find(s => s.id === a.subjectId);
      const cat = subj?.category || 'Uncategorized';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { instructors: new Set(), subjects: new Set() };
      }
      categoryMap[cat].instructors.add(a.staffId);
      categoryMap[cat].subjects.add(a.subjectId);
    });

    const headers = ['S.No', 'Category', 'Subjects Count', 'Instructors Count', 'Instructor Names'];
    const rows = Object.entries(categoryMap).map(([cat, data], i) => {
      const instructorNames = staffList
        .filter(s => data.instructors.has(s.id))
        .map(s => `${s.rank} ${s.name}`)
        .join(', ');
      return [
        String(i + 1),
        cat,
        String(data.subjects.size),
        String(data.instructors.size),
        instructorNames || '—',
      ];
    });

    const totalInstructors = new Set(subjectAssignments.filter(a => a.isActive).map(a => a.staffId)).size;
    const summary = `Total Categories: ${rows.length} | Total Active Instructors: ${totalInstructors} | Total Subjects: ${subjects.filter(s => s.isActive).length}`;
    const title = 'Instructor Category Summary Report';

    if (format === 'EXCEL') downloadCSV('Instructor_Categories', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Instructor Summary', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };

  // 20. STAFF STATUS SUMMARY
  const generateStaffStatusSummary = (format: 'EXCEL' | 'PRINT') => {
    setGenerating('staff_status');

    const statusCounts = {
      active: staffList.filter(s => s.status === 'active').length,
      leave: staffList.filter(s => s.status === 'leave').length,
      td: staffList.filter(s => s.status === 'td').length,
      hospital: staffList.filter(s => s.status === 'hospital').length,
      course: staffList.filter(s => s.status === 'course').length,
      attachment: staffList.filter(s => s.status === 'attachment').length,
      inactive: staffList.filter(s => s.status === 'inactive').length,
    };

    // Rank-wise breakdown
    const rankMap: Record<string, number> = {};
    staffList.forEach(s => {
      rankMap[s.rank] = (rankMap[s.rank] ?? 0) + 1;
    });

    const headers = ['Category', 'Count', 'Percentage'];
    const total = staffList.length;
    const rows: string[][] = [
      ['Total Staff', String(total), '100%'],
      ['Active', String(statusCounts.active), `${Math.round((statusCounts.active / total) * 100)}%`],
      ['On Leave', String(statusCounts.leave), `${Math.round((statusCounts.leave / total) * 100)}%`],
      ['Temporary Duty', String(statusCounts.td), `${Math.round((statusCounts.td / total) * 100)}%`],
      ['Hospital', String(statusCounts.hospital), `${Math.round((statusCounts.hospital / total) * 100)}%`],
      ['On Course', String(statusCounts.course), `${Math.round((statusCounts.course / total) * 100)}%`],
      ['Attachment', String(statusCounts.attachment), `${Math.round((statusCounts.attachment / total) * 100)}%`],
      ['Inactive', String(statusCounts.inactive), `${Math.round((statusCounts.inactive / total) * 100)}%`],
    ];

    // Add separator
    rows.push(['— RANK BREAKDOWN —', '', '']);
    Object.entries(rankMap)
      .sort(([, a], [, b]) => b - a)
      .forEach(([rank, count]) => {
        rows.push([rank, String(count), `${Math.round((count / total) * 100)}%`]);
      });

    const summary = `Total Personnel: ${total} | Active: ${statusCounts.active} | Away: ${total - statusCounts.active - statusCounts.inactive} | Unique Ranks: ${Object.keys(rankMap).length}`;
    const title = 'Staff Status & Rank Summary';

    if (format === 'EXCEL') downloadCSV('Staff_Status_Summary', headers, rows);
    else printReport(title, headers, rows, summary);
    addToHistory(title, 'Staff Status', format, rows.length);
    setSuccess(`${title} generated!`);
    setGenerating(null);
  };
  // ─── COMPUTED ───────────────────────────
  // Always show the four permanent platoons; never expose legacy A/B/C labels.
  const platoons = [...PLATOON_OPTIONS];
  const batchNumbers = [...new Set(trainees.map(t => t.batchNumber).filter(Boolean))];

  const totalCol = collections.reduce((s, c) => s + c.amount, 0);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPaid = expenses.reduce((s, e) => {
    if (e.vendorId) return s + e.paidAmount;
    return s + e.amount;
  }, 0);
  const balance = totalCol - totalPaid;
  const totalDue = expenses.reduce((s, e) => s + e.dueAmount, 0);
  const pendingBills = expenses.filter(e => e.billStatus === 'Pending').length;

  // ─── REPORT CARDS CONFIG ────────────────
  const reportCards = [
    {
      category: 'Trainee Management',
      icon: <Users size={16} />,
      headerBg: 'bg-blue-50',
      reports: [
        {
          name: 'Master Trainee List',
          desc: `${trainees.length} trainees across ${batches.length} batches`,
          icon: <Users size={14} className="text-blue-600" />,
          onExcel: () => generateTraineeMaster('EXCEL'),
          onPrint: () => generateTraineeMaster('PRINT'),
          count: trainees.length,
        },
        {
          name: 'Daily Attendance',
          desc: `${trainees.filter(t => t.attn === 'P').length} present · ${trainees.filter(t => t.attn === 'A').length} absent`,
          icon: <UserCheck size={14} className="text-green-600" />,
          onExcel: () => generateAttendance('EXCEL'),
          onPrint: () => generateAttendance('PRINT'),
          count: trainees.length,
          urgent: trainees.filter(t => t.attn === 'A').length > 0,
        },
        {
          name: 'Absent / Sick / Leave Report',
          desc: `${absents.length} total records · ${absents.filter(a => a.status === 'Active').length} active`,
          icon: <AlertTriangle size={14} className="text-red-600" />,
          onExcel: () => generateAbsentReport('EXCEL'),
          onPrint: () => generateAbsentReport('PRINT'),
          count: absents.length,
          urgent: absents.filter(a => a.status === 'Active').length > 0,
        },
        {
          name: 'Batch Roster',
          desc: `${batches.length} batches · ${batches.filter(b => b.status === 'active').length} active`,
          icon: <Layers size={14} className="text-indigo-600" />,
          onExcel: () => generateBatchRoster('EXCEL'),
          onPrint: () => generateBatchRoster('PRINT'),
          count: batches.length,
        },
      ],
    },
    {
      category: 'Inventory / Quarter Master',
      icon: <Package size={16} />,
      headerBg: 'bg-slate-50',
      reports: [
        {
          name: 'Live Stock Report (Item-wise)',
          desc: `Auto-calculated from Purchases − Issues`,
          icon: <Package size={14} className="text-slate-700" />,
          onExcel: () => generateStockReport('EXCEL'),
          onPrint: () => generateStockReport('PRINT'),
          count: expenses.filter(e => e.fundType === 'Training' || e.fundType === 'Assets').length,
        },
        {
          name: 'Kit Issue Register',
          desc: `${issues.length} issue records · ${new Set(issues.map(i => i.chestNo)).size} trainees`,
          icon: <BoxSelect size={14} className="text-indigo-600" />,
          onExcel: () => generateKitIssueRegister('EXCEL'),
          onPrint: () => generateKitIssueRegister('PRINT'),
          count: issues.length,
        },
      ],
    },
    {
      category: 'Finance — 4 Funds',
      icon: <IndianRupee size={16} />,
      headerBg: 'bg-green-50',
      reports: [
        {
          name: 'Fund Summary (All 4 Funds)',
          desc: `Balance: ${formatCurrency(balance)} | Due: ${formatCurrency(totalDue)}`,
          icon: <Wallet size={14} className="text-green-700" />,
          onExcel: () => generateFundSummary('EXCEL'),
          onPrint: () => generateFundSummary('PRINT'),
          count: 4,
          urgent: balance < 0,
        },
        {
          name: 'Collection Log',
          desc: `${collections.length} entries · Total: ${formatCurrency(totalCol)}`,
          icon: <ArrowDownToLine size={14} className="text-green-600" />,
          onExcel: () => generateCollectionReport('EXCEL'),
          onPrint: () => generateCollectionReport('PRINT'),
          count: collections.length,
        },
        {
          name: 'Expense Log (with Item Names)',
          desc: `${expenses.length} entries · Spent: ${formatCurrency(totalExp)} · Bills Pending: ${pendingBills}`,
          icon: <ArrowUpFromLine size={14} className="text-red-600" />,
          onExcel: () => generateExpenseReport('EXCEL'),
          onPrint: () => generateExpenseReport('PRINT'),
          count: expenses.length,
          urgent: pendingBills > 0,
        },
        {
          name: 'Vendor Dues Report',
          desc: `Total Due: ${formatCurrency(totalDue)} across ${vendors.length} vendors`,
          icon: <Building2 size={14} className="text-amber-600" />,
          onExcel: () => generateVendorDues('EXCEL'),
          onPrint: () => generateVendorDues('PRINT'),
          count: vendorEntries.filter(v => v.dueAmount > 0).length,
          urgent: totalDue > 0,
        },
      ],
    },
        {
      category: 'Training Performance',
      icon: <Target size={16} />,
      headerBg: 'bg-orange-50',
      reports: [
        {
          name: 'FPT Results Report',
          desc: `${fptRecords.length} tests · Pass: ${fptRecords.filter(r => r.result === 'Pass').length}`,
          icon: <Target size={14} className="text-orange-600" />,
          onExcel: () => generateFPTReport('EXCEL'),
          onPrint: () => generateFPTReport('PRINT'),
          count: fptRecords.length,
        },
        {
          name: 'Weekly Test Results',
          desc: `${weeklyTests.length} tests · Pass: ${weeklyTests.filter(r => r.result === 'Pass').length}`,
          icon: <Award size={14} className="text-amber-600" />,
          onExcel: () => generateWeeklyTestReport('EXCEL'),
          onPrint: () => generateWeeklyTestReport('PRINT'),
          count: weeklyTests.length,
        },
      ],
    },
    // ═══════════════════════════════════════════════════════
    // 🆕 STAFF MANAGEMENT SECTION
    // ═══════════════════════════════════════════════════════
    {
      category: 'Staff Management — Instructors',
      icon: <UserCheck size={16} />,
      headerBg: 'bg-purple-50',
      reports: [
        {
          name: 'Staff Master List',
          desc: `${staffList.length} instructors · ${staffList.filter(s => s.status === 'active').length} active`,
          icon: <Users size={14} className="text-purple-600" />,
          onExcel: () => generateStaffMaster('EXCEL'),
          onPrint: () => generateStaffMaster('PRINT'),
          count: staffList.length,
        },
        {
          name: 'Staff Status & Rank Summary',
          desc: `Complete breakdown by status and rank`,
          icon: <BarChart3 size={14} className="text-indigo-600" />,
          onExcel: () => generateStaffStatusSummary('EXCEL'),
          onPrint: () => generateStaffStatusSummary('PRINT'),
          count: staffList.length,
        },
        {
          name: 'Staff Attendance Report (Monthly)',
          desc: `Month-wise attendance summary · ${staffAttendance.length} total records`,
          icon: <UserCheck size={14} className="text-green-600" />,
          onExcel: () => generateStaffAttendance('EXCEL'),
          onPrint: () => generateStaffAttendance('PRINT'),
          count: staffAttendance.length,
        },
        {
          name: 'Leave Applications Report',
          desc: `${staffLeaves.length} applications · ${staffLeaves.filter(l => l.status === 'pending').length} pending · ${staffLeaves.filter(l => l.status === 'approved').length} approved`,
          icon: <AlertCircle size={14} className="text-yellow-600" />,
          onExcel: () => generateLeaveReport('EXCEL'),
          onPrint: () => generateLeaveReport('PRINT'),
          count: staffLeaves.length,
          urgent: staffLeaves.filter(l => l.status === 'pending').length > 0,
        },
        {
          name: 'Leave Balance Report (Yearly)',
          desc: `Year ${new Date().getFullYear()} · Per staff leave-type wise balance`,
          icon: <TrendingUp size={14} className="text-blue-600" />,
          onExcel: () => generateLeaveBalance('EXCEL'),
          onPrint: () => generateLeaveBalance('PRINT'),
          count: staffList.length,
        },
        {
          name: 'Duty Assignment Report',
          desc: `${staffDuties.length} duty records · ${staffDuties.filter(d => d.status === 'assigned').length} pending`,
          icon: <Activity size={14} className="text-red-600" />,
          onExcel: () => generateDutyReport('EXCEL'),
          onPrint: () => generateDutyReport('PRINT'),
          count: staffDuties.length,
        },
        {
          name: 'Subject Assignment Report',
          desc: `${subjectAssignments.filter(a => a.isActive).length} active assignments · ${subjects.filter(s => s.isActive).length} subjects`,
          icon: <Award size={14} className="text-indigo-600" />,
          onExcel: () => generateSubjectAssignment('EXCEL'),
          onPrint: () => generateSubjectAssignment('PRINT'),
          count: subjectAssignments.filter(a => a.isActive).length,
        },
        {
          name: 'Instructor Category Summary',
          desc: `Category-wise instructor & subject breakdown`,
          icon: <Layers size={14} className="text-teal-600" />,
          onExcel: () => generateInstructorSummary('EXCEL'),
          onPrint: () => generateInstructorSummary('PRINT'),
          count: new Set(subjects.map(s => s.category)).size,
        },
      ],
    },
  ];

  // ─── RENDER ─────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-slate-700 mx-auto mb-3" />
          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Loading data from Firebase...</p>
          <p className="text-[10px] text-slate-400 mt-1">All collections being fetched safely</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 size={22} className="text-slate-700" />
            Central Reports Generation
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Trainee · Inventory · Finance · Performance — All Reports with Item Names & Vendor Details
          </p>
        </div>
        <button onClick={fetchAllData} disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Data
        </button>
      </div>

      {/* ALERTS */}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={14} /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* QUICK STATS */}
            <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
        {[
          { label: 'Trainees', value: trainees.length, icon: <Users size={14} />, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Staff', value: staffList.length, icon: <UserCheck size={14} />, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Batches', value: batches.length, icon: <Layers size={14} />, color: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: 'Issues', value: issues.length, icon: <BoxSelect size={14} />, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Collections', value: formatCurrency(totalCol), icon: <TrendingUp size={14} />, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Expenses', value: formatCurrency(totalExp), icon: <TrendingDown size={14} />, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Balance', value: `${balance < 0 ? '−' : ''}${formatCurrency(balance)}`, icon: <Wallet size={14} />, color: balance >= 0 ? 'text-green-700' : 'text-red-700', bg: balance >= 0 ? 'bg-green-50' : 'bg-red-50' },
          { label: 'Vendor Due', value: formatCurrency(totalDue), icon: <AlertCircle size={14} />, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} border border-slate-200 rounded p-2.5 text-center`}>
            <div className="flex items-center justify-center gap-1 mb-1 text-slate-400">{stat.icon}</div>
            <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-slate-200 rounded p-3">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Filter size={11} /> Report Filters (Apply to relevant reports)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-slate-700" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-slate-700" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Batch</label>
            <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
              className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-slate-700 bg-white">
              <option value="All">All Batches</option>
              {batchNumbers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Platoon</label>
            <select value={filterPlatoon} onChange={e => setFilterPlatoon(e.target.value)}
              className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-slate-700 bg-white">
              <option value="All">All Platoons</option>
              {platoons.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
                    <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fund Type</label>
            <select value={filterFund} onChange={e => setFilterFund(e.target.value as any)}
              className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-slate-700 bg-white">
              <option value="All">All 4 Funds</option>
              <option value="Mess">🍽️ Mess Fund</option>
              <option value="Training">🎓 Training Fund</option>
              <option value="Assets">🏛️ Assets Fund</option>
              <option value="General">💰 General Fund</option>
            </select>
          </div>
        </div>

        {/* ── STAFF FILTERS ROW ── */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider mb-2">
            👥 Staff Report Filters
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Staff Status</label>
              <select value={filterStaffStatus} onChange={e => setFilterStaffStatus(e.target.value)}
                className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-purple-700 bg-white">
                <option value="All">All Statuses</option>
                <option value="active">✅ Active</option>
                <option value="leave">🏖️ On Leave</option>
                <option value="td">🚗 Temp Duty</option>
                <option value="hospital">🏥 Hospital</option>
                <option value="course">📖 On Course</option>
                <option value="inactive">⭕ Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Leave Status</label>
              <select value={filterLeaveStatus} onChange={e => setFilterLeaveStatus(e.target.value)}
                className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-purple-700 bg-white">
                <option value="All">All Leave Status</option>
                <option value="pending">⏳ Pending</option>
                <option value="approved">✅ Approved</option>
                <option value="rejected">❌ Rejected</option>
                <option value="cancelled">🚫 Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Month (Attendance)</label>
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-purple-700 bg-white">
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Year (Attendance)</label>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-purple-700 bg-white">
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* REPORT CARDS */}
      <div className="space-y-4">
        {reportCards.map(section => (
          <div key={section.category} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className={`px-4 py-3 ${section.headerBg} border-b border-slate-200 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">{section.icon}</span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{section.category}</h3>
                <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border">
                  {section.reports.length} reports
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {section.reports.map(report => (
                <div key={report.name} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">{report.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black text-slate-800">{report.name}</p>
                        {report.urgent && (
                          <span className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full animate-pulse">
                            ⚠ ACTION
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {report.count} records
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{report.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <button
                      onClick={report.onExcel}
                      disabled={generating !== null}
                      className="flex items-center gap-1.5 bg-green-700 text-white px-3 py-1.5 text-[10px] font-black uppercase rounded hover:bg-green-800 disabled:opacity-40 transition-colors"
                    >
                      {generating ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
                      Excel
                    </button>
                    <button
                      onClick={report.onPrint}
                      disabled={generating !== null}
                      className="flex items-center gap-1.5 bg-slate-800 text-white px-3 py-1.5 text-[10px] font-black uppercase rounded hover:bg-slate-700 disabled:opacity-40 transition-colors"
                    >
                      {generating ? <Loader2 size={11} className="animate-spin" /> : <Printer size={11} />}
                      Print
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* HISTORY */}
      {generatedReports.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-purple-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-purple-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Session Report History
              </h3>
              <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                {generatedReports.length} generated
              </span>
            </div>
            <button onClick={() => setGeneratedReports([])}
              className="text-[10px] font-bold text-slate-400 hover:text-red-600 uppercase">
              Clear All
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-60 overflow-auto">
            {generatedReports.map(rpt => (
              <div key={rpt.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    rpt.format === 'EXCEL' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    {rpt.format === 'EXCEL'
                      ? <FileSpreadsheet size={12} className="text-green-600" />
                      : <Printer size={12} className="text-blue-600" />
                    }
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-800">{rpt.reportName}</p>
                    <p className="text-[9px] text-slate-400">
                      {formatDate(rpt.date)} · {rpt.recordCount} records · by {rpt.generatedBy}
                    </p>
                  </div>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                  rpt.format === 'EXCEL' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {rpt.format}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

            <div className="text-center text-[10px] text-slate-400 py-2 border-t border-slate-100">
        BSF COY Management System · Reports Module · Live Data from Firestore
        <br />
        {trainees.length} trainees · {staffList.length} instructors · {expenses.length} expenses · {staffLeaves.length} leave records · {staffDuties.length} duty records
      </div>
    </div>
  );
};

export default ReportsScreen;