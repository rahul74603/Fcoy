// ═══════════════════════════════════════════════════════════
// GLOBAL SEARCH — PERMISSION & ENTITY CONFIG
// ───────────────────────────────────────────────────────────
// Yeh file define karti hai ki:
//   1. Kaunse PAGES search mein aayenge (role ke hisaab se)
//   2. Kaunse DATA COLLECTIONS search mein aayenge (role ke hisaab se)
//
// RULE: Company Commander ko sab kuch dikhta hai.
//       Baaki roles ko sirf wahi entities/pages dikhte hain jinki
//       unhe App.tsx routes mein permission hai (mirrored here).
//
// Naya module add ho to yahan ek entry add karo — search apne aap
// use cover kar lega.
// ═══════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react';
import {
  Users, UserCog, Wallet, Receipt, Store, Layers, Calendar,
  Stethoscope, ClipboardList, FileText, ArrowLeftRight,
  GraduationCap, Package, CreditCard, Shield, Settings as SettingsIcon,
  BarChart3, PieChart, Archive, Bot, Activity, Target, CalendarDays,
  UserX, HeartHandshake, Banknote, BookOpen, Repeat, Building2,
} from 'lucide-react';

// ─────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────
export const ROLE = {
  CC: 'Company Commander',
  QM: 'Quarter Master',
  CLERK: 'Clerk',
  USTAD: 'Ustad',
} as const;

const ALL = [ROLE.QM, ROLE.CLERK, ROLE.USTAD]; // CC hamesha allowed (override)

/**
 * CC ko sab allowed hai (App.tsx / Sidebar ke hasAccess jaisa).
 * roles list mein CC likhna zaroori nahi — auto-include hota hai.
 */
export const canAccess = (roles: string[], userRole: string): boolean => {
  if (!userRole) return false;
  if (userRole === ROLE.CC) return true;
  return roles.includes(userRole);
};

// ─────────────────────────────────────────────
// PAGE (NAVIGATION) SEARCH ENTRIES
// ─────────────────────────────────────────────
export interface SearchPageEntry {
  id: string;
  title: string;
  keywords: string[]; // Hindi/Hinglish bhi
  path: string;
  icon: LucideIcon;
  roles: string[]; // CC auto-allowed
}

export const SEARCH_PAGES: SearchPageEntry[] = [
  // ── Company Commander ──
  { id: 'p-commander', title: 'Commander Dashboard', keywords: ['commander', 'dashboard', 'home', 'cc'], path: '/commander', icon: Shield, roles: [] },
  { id: 'p-ai', title: 'AI Agent', keywords: ['ai', 'agent', 'chat', 'bot', 'poochho'], path: '/ai-agent', icon: Bot, roles: [] },
  { id: 'p-reports', title: 'Reports Center', keywords: ['report', 'reports', 'reporting'], path: '/reports', icon: BarChart3, roles: [] },
  { id: 'p-settings', title: 'Settings', keywords: ['setting', 'settings', 'config'], path: '/settings', icon: SettingsIcon, roles: [] },
  { id: 'p-users', title: 'User Management', keywords: ['user', 'users', 'login', 'account', 'permission', 'access'], path: '/users', icon: Users, roles: [] },

  // ── Quarter Master ──
  { id: 'p-qm', title: 'QM Dashboard', keywords: ['qm', 'quartermaster', 'quarter master', 'dashboard'], path: '/quartermaster', icon: Archive, roles: [ROLE.QM] },
  { id: 'p-issue', title: 'Inventory / Kit Issue', keywords: ['kit', 'issue', 'inventory', 'stock', 'saman', 'distribution'], path: '/issue-kit', icon: Package, roles: [ROLE.QM] },
  { id: 'p-messboy', title: 'Mess Boy Salary', keywords: ['mess boy', 'salary', 'cook', 'bawarchi', 'tankhwah'], path: '/mess-boy-salary', icon: Banknote, roles: [ROLE.QM] },
  { id: 'p-funds', title: 'Funds Dashboard', keywords: ['fund', 'funds', 'paisa', 'money'], path: '/funds', icon: PieChart, roles: [ROLE.QM] },
  { id: 'p-messfund', title: 'Mess Fund', keywords: ['mess', 'khana', 'ration', 'mess fund'], path: '/mess-fund', icon: Wallet, roles: [ROLE.QM] },
  { id: 'p-trainingfund', title: 'Training Fund', keywords: ['training fund', 'training kharcha'], path: '/training-fund', icon: GraduationCap, roles: [ROLE.QM] },
  { id: 'p-assetsfund', title: 'Company Assets Fund', keywords: ['assets', 'company assets', 'furniture', 'chair'], path: '/company-assets-fund', icon: Building2, roles: [ROLE.QM] },
  { id: 'p-generalfund', title: 'General Fund', keywords: ['general fund', 'general kharcha'], path: '/general-fund', icon: Wallet, roles: [ROLE.QM] },
  { id: 'p-vendors', title: 'Vendor Management', keywords: ['vendor', 'supplier', 'dukandar', 'bill', 'due', 'baaki'], path: '/vendors', icon: Store, roles: [ROLE.QM] },
  { id: 'p-vpay', title: 'Vendor Payments', keywords: ['vendor payment', 'payment', 'bhugtan'], path: '/vendor-payments', icon: CreditCard, roles: [ROLE.QM] },

  // ── Clerk ──
  { id: 'p-clerk', title: 'Clerk Dashboard', keywords: ['clerk', 'dashboard', 'lipik'], path: '/clerk', icon: Activity, roles: [ROLE.CLERK] },
  { id: 'p-profile', title: 'Trainee Details / Profile', keywords: ['trainee', 'profile', 'recruit', 'rangroot', 'jawan', 'student'], path: '/profile', icon: Users, roles: [ROLE.CLERK] },
  { id: 'p-docs', title: 'Document Cell', keywords: ['document', 'documents', 'kagaz', 'verification'], path: '/documents', icon: FileText, roles: [ROLE.CLERK] },
  { id: 'p-medical', title: 'MI Room & Medical', keywords: ['medical', 'mi room', 'doctor', 'hospital', 'bimari', 'ilaj'], path: '/medical-register', icon: Stethoscope, roles: [ROLE.CLERK] },
  { id: 'p-weekly', title: 'Weekly Program', keywords: ['weekly program', 'program', 'saptahik'], path: '/weekly-program', icon: CalendarDays, roles: [ROLE.CLERK] },
  { id: 'p-absent', title: 'Absent / Leave / Medical', keywords: ['absent', 'leave', 'chhutti', 'gair hazir'], path: '/absent-management', icon: UserX, roles: [ROLE.CLERK] },
  { id: 'p-tests', title: 'FPT / Weekly Test Records', keywords: ['test', 'exam', 'fpt', 'pariksha', 'marks'], path: '/test-records', icon: ClipboardList, roles: [ROLE.CLERK] },
  { id: 'p-subjects', title: 'Subject Master', keywords: ['subject', 'subjects', 'vishay'], path: '/subjects', icon: BookOpen, roles: [ROLE.CLERK] },
  { id: 'p-subassign', title: 'Subject Assignment', keywords: ['subject assignment', 'assign'], path: '/subject-assignment', icon: BookOpen, roles: [ROLE.CLERK] },
  { id: 'p-staffatt', title: 'Staff Attendance', keywords: ['staff attendance', 'hazri', 'attendance'], path: '/staff-attendance', icon: ClipboardList, roles: [ROLE.CLERK] },
  { id: 'p-duty', title: 'Duty Management', keywords: ['duty', 'duties'], path: '/duty-management', icon: ClipboardList, roles: [ROLE.CLERK] },
  { id: 'p-deputation', title: 'Deputation Register', keywords: ['deputation', 'udhari', 'attachment'], path: '/deputation', icon: Repeat, roles: [ROLE.CLERK] },

  // ── Ustad / Staff View ──
  { id: 'p-ustad', title: 'Ustad Dashboard', keywords: ['ustad', 'instructor', 'dashboard'], path: '/ustad', icon: Target, roles: [ROLE.USTAD] },
  { id: 'p-staff', title: 'Staff List', keywords: ['staff', 'ustad', 'instructor', 'teacher'], path: '/staff', icon: UserCog, roles: [ROLE.CLERK, ROLE.USTAD] },
  { id: 'p-schedule', title: 'Training Schedule', keywords: ['schedule', 'timetable', 'period', 'class'], path: '/training-schedule', icon: Calendar, roles: [ROLE.CLERK, ROLE.USTAD] },
  { id: 'p-leave', title: 'Leave Management', keywords: ['staff leave', 'chhutti', 'leave'], path: '/staff-leave', icon: Calendar, roles: [ROLE.CLERK, ROLE.USTAD] },
  { id: 'p-batchprog', title: 'Batch Progress', keywords: ['batch progress', 'progress'], path: '/batch-progress', icon: BarChart3, roles: [ROLE.CLERK, ROLE.USTAD] },

  // ── Common / Welfare ──
  { id: 'p-batches', title: 'All Batches', keywords: ['batch', 'batches', 'course'], path: '/batches', icon: Layers, roles: ALL },
  { id: 'p-welfare', title: 'Welfare & Demographics', keywords: ['welfare', 'demographics', 'festival', 'tyohar'], path: '/welfare-demographics', icon: HeartHandshake, roles: [ROLE.CLERK, ROLE.QM] },
];

// ─────────────────────────────────────────────
// DATA (FIRESTORE) SEARCH ENTITIES
// ─────────────────────────────────────────────
type DocData = Record<string, any>;

export interface SearchEntityConfig {
  id: string;
  collection: string;
  label: string;
  icon: LucideIcon;
  roles: string[]; // CC auto-allowed
  maxFetch: number;
  /** priority fields — pehle inme match dekha jayega (baaki sab fields bhi scan hote hain) */
  searchFields: string[];
  title: (d: DocData) => string;
  subtitle: (d: DocData) => string;
  badge?: (d: DocData) => string | null;
  route: (userRole: string) => string;
}

const s = (v: any): string => (v === null || v === undefined || v === '' ? '' : String(v));

/** Firestore value display helper */
const fmt = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    try { return v.toDate().toLocaleDateString('en-GB'); } catch { return ''; }
  }
  if (typeof v === 'object' && typeof v.seconds === 'number') {
    try { return new Date(v.seconds * 1000).toLocaleDateString('en-GB'); } catch { return ''; }
  }
  const str = String(v);
  // ISO date detect
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB');
  }
  return str;
};

const inr = (v: any): string => {
  const n = Number(v);
  if (isNaN(n) || v === null || v === undefined || v === '') return '';
  return '₹' + n.toLocaleString('en-IN');
};

const join = (...parts: (string | null | undefined)[]): string =>
  parts.filter((p) => p && p.trim()).join(' · ');

// ─── Finance entity helper (4 funds same shape) ───
const fundExpense = (
  id: string, collection: string, label: string, path: string,
): SearchEntityConfig => ({
  id, collection, label, icon: Receipt,
  roles: [ROLE.QM],
  maxFetch: 800,
  searchFields: ['itemName', 'category', 'vendor', 'amount'],
  title: (d) => join(s(d.itemName || d.label), inr(d.amount)) || '(Expense)',
  subtitle: (d) => join(s(d.category), s(d.vendor), fmt(d.date), d.dueAmount ? `Due: ${inr(d.dueAmount)}` : ''),
  badge: (d) => (Number(d.dueAmount) > 0 ? 'DUE' : null),
  route: () => path,
});

const fundCollection = (
  id: string, collection: string, label: string, path: string,
): SearchEntityConfig => ({
  id, collection, label, icon: Wallet,
  roles: [ROLE.QM],
  maxFetch: 800,
  searchFields: ['label', 'amount', 'fundType'],
  title: (d) => join(s(d.label || d.fundType || 'Collection'), inr(d.amount)),
  subtitle: (d) => join(fmt(d.date), d.traineeCount ? `${d.traineeCount} trainees` : '', d.perHead ? `Per head: ${inr(d.perHead)}` : ''),
  route: () => path,
});

// ═══════════════════════════════════════════
// ENTITIES LIST — ORDER = DISPLAY ORDER
// ═══════════════════════════════════════════
export const SEARCH_ENTITIES: SearchEntityConfig[] = [

  // ────────── TRAINEE DOMAIN ──────────
  {
    id: 'trainees', collection: 'trainees', label: 'Trainees', icon: Users,
    roles: [ROLE.CLERK, ROLE.QM],
    maxFetch: 1500,
    searchFields: ['name', 'chestNo', 'regNo', 'fatherName', 'mobileNo', 'state', 'district', 'village', 'platoon', 'batchNumber', 'bloodGroup'],
    title: (d) => join(s(d.name), d.chestNo ? `(#${d.chestNo})` : ''),
    subtitle: (d) => join(s(d.fatherName) && `S/o ${d.fatherName}`, s(d.platoon) && `Plt: ${d.platoon}`, s(d.state), d.batchNumber && `Batch: ${d.batchNumber}`),
    badge: (d) => s(d.attn) || null,
    // QM kit issue karta hai → uske liye trainee result kit-issue screen pe khulega
    route: (role) => (role === ROLE.QM ? '/issue-kit' : '/profile'),
  },
  {
    id: 'absentRecords', collection: 'absentRecords', label: 'Absent / Leave Records', icon: UserX,
    roles: [ROLE.CLERK],
    maxFetch: 800,
    searchFields: ['traineeName', 'chestNo', 'reason', 'type', 'status', 'platoon'],
    title: (d) => join(s(d.traineeName), d.chestNo ? `(#${d.chestNo})` : ''),
    subtitle: (d) => join(`Type: ${s(d.type)}`, s(d.reason), `${fmt(d.fromDate)} → ${fmt(d.toDate)}`, d.totalDays ? `${d.totalDays} din` : ''),
    badge: (d) => s(d.status) || null,
    route: () => '/absent-management',
  },
  {
    id: 'medicalRecords', collection: 'medicalRecords', label: 'Medical / MI Room', icon: Stethoscope,
    roles: [ROLE.CLERK],
    maxFetch: 800,
    searchFields: ['traineeName', 'chestNo', 'complaint', 'diagnosis', 'treatment', 'status'],
    title: (d) => join(s(d.traineeName), s(d.complaint) && `— ${d.complaint}`),
    subtitle: (d) => join(s(d.diagnosis), s(d.treatment), fmt(d.date)),
    badge: (d) => s(d.status) || null,
    route: () => '/medical-register',
  },
  {
    id: 'fptRecords', collection: 'fptRecords', label: 'FPT Results', icon: ClipboardList,
    roles: [ROLE.CLERK],
    maxFetch: 800,
    searchFields: ['traineeName', 'chestNo', 'overallStatus', 'status'],
    title: (d) => join(s(d.traineeName), d.chestNo ? `(#${d.chestNo})` : ''),
    subtitle: (d) => join(d.totalMarks ? `Marks: ${d.totalMarks}` : '', fmt(d.date)),
    badge: (d) => s(d.overallStatus || d.status) || null,
    route: () => '/test-records',
  },
  {
    id: 'weeklyTestRecords', collection: 'weeklyTestRecords', label: 'Weekly Test Records', icon: BookOpen,
    roles: [ROLE.CLERK],
    maxFetch: 800,
    searchFields: ['traineeName', 'chestNo', 'subject', 'status'],
    title: (d) => join(s(d.traineeName), s(d.subject) && `— ${d.subject}`),
    subtitle: (d) => join(d.marks !== undefined && d.totalMarks !== undefined ? `Marks: ${d.marks}/${d.totalMarks}` : '', fmt(d.date)),
    badge: (d) => s(d.status) || null,
    route: () => '/test-records',
  },
  {
    id: 'batches', collection: 'batches', label: 'Batches', icon: Layers,
    roles: ALL,
    maxFetch: 200,
    searchFields: ['batchNumber', 'batchName', 'status', 'description'],
    title: (d) => join(s(d.batchNumber), s(d.batchName)),
    subtitle: (d) => join(`${fmt(d.startDate)} → ${fmt(d.endDate)}`, d.totalTrainees ? `${d.totalTrainees} trainees` : ''),
    badge: (d) => (s(d.status) || '').toUpperCase() || null,
    route: () => '/batches',
  },

  // ────────── STAFF / TRAINING DOMAIN ──────────
  {
    id: 'staff', collection: 'staff', label: 'Staff / Instructors', icon: UserCog,
    roles: [ROLE.CLERK, ROLE.USTAD],
    maxFetch: 500,
    searchFields: ['name', 'rank', 'forceNo', 'mobileNo', 'status'],
    title: (d) => join(s(d.rank), s(d.name)),
    subtitle: (d) => join(s(d.forceNo) && `Force No: ${d.forceNo}`, s(d.mobileNo)),
    badge: (d) => (s(d.status) || '').toUpperCase() || null,
    route: () => '/staff',
  },
  {
    id: 'staff_leave', collection: 'staff_leave', label: 'Staff Leave', icon: Calendar,
    roles: [ROLE.CLERK, ROLE.USTAD],
    maxFetch: 500,
    searchFields: ['staffName', 'leaveType', 'status', 'reason'],
    title: (d) => join(s(d.staffName), s(d.leaveType) && `— ${d.leaveType}`),
    subtitle: (d) => join(`${fmt(d.fromDate)} → ${fmt(d.toDate)}`, d.totalDays ? `${d.totalDays} din` : ''),
    badge: (d) => (s(d.status) || '').toUpperCase() || null,
    route: () => '/staff-leave',
  },
  {
    id: 'staff_attendance', collection: 'staff_attendance', label: 'Staff Attendance', icon: ClipboardList,
    roles: [ROLE.CLERK],
    maxFetch: 800,
    searchFields: ['staffName', 'staffId', 'status'],
    title: (d) => s(d.staffName) || '(Attendance)',
    subtitle: (d) => join(fmt(d.date), s(d.status)),
    route: () => '/staff-attendance',
  },
  {
    id: 'staff_duty', collection: 'staff_duty', label: 'Staff Duty', icon: ClipboardList,
    roles: [ROLE.CLERK],
    maxFetch: 500,
    searchFields: ['staffName', 'dutyTypeId', 'status'],
    title: (d) => s(d.staffName) || '(Duty)',
    subtitle: (d) => join(s(d.dutyTypeId), fmt(d.date), s(d.status)),
    route: () => '/duty-management',
  },
  {
    id: 'deputation_records', collection: 'deputation_records', label: 'Deputation Records', icon: Repeat,
    roles: [ROLE.CLERK],
    maxFetch: 300,
    searchFields: ['staffName', 'fromCoy', 'toCoy', 'reason', 'status'],
    title: (d) => s(d.staffName) || '(Deputation)',
    subtitle: (d) => join(`${s(d.fromCoy)} → ${s(d.toCoy)}`, s(d.reason)),
    badge: (d) => s(d.status) || null,
    route: () => '/deputation',
  },
  {
    id: 'udhariRecords', collection: 'udhariRecords', label: 'Udhari (Legacy)', icon: ArrowLeftRight,
    roles: [ROLE.CLERK],
    maxFetch: 300,
    searchFields: ['ustadName', 'fromCoy', 'toCoy', 'status', 'direction'],
    title: (d) => s(d.ustadName) || '(Udhari)',
    subtitle: (d) => join(`${s(d.fromCoy)} → ${s(d.toCoy)}`, s(d.direction)),
    badge: (d) => s(d.status) || null,
    route: () => '/deputation',
  },
  {
    id: 'training_schedule', collection: 'training_schedule', label: 'Training Schedule', icon: CalendarDays,
    roles: [ROLE.CLERK, ROLE.USTAD],
    maxFetch: 800,
    searchFields: ['subject', 'instructor', 'time', 'status'],
    title: (d) => join(s(d.subject), s(d.instructor) && `— ${d.instructor}`),
    subtitle: (d) => join(s(d.time), fmt(d.date), s(d.status)),
    route: () => '/training-schedule',
  },
  {
    id: 'weeklyPrograms', collection: 'weeklyPrograms', label: 'Weekly Programs', icon: CalendarDays,
    roles: [ROLE.CLERK],
    maxFetch: 200,
    searchFields: ['weekName'],
    title: (d) => s(d.weekName) || '(Weekly Program)',
    subtitle: (d) => join(`${fmt(d.fromDate)} → ${fmt(d.toDate)}`),
    route: () => '/weekly-program',
  },

  // ────────── FINANCE DOMAIN (4 FUNDS + VENDORS) ──────────
  {
    id: 'issue_records', collection: 'issue_records', label: 'Kit Issue Records', icon: Package,
    roles: [ROLE.QM],
    maxFetch: 800,
    searchFields: ['traineeName', 'chestNo', 'platoon', 'issuedBy'],
    title: (d) => join(s(d.traineeName), d.chestNo ? `(#${d.chestNo})` : ''),
    subtitle: (d) => join(d.totalItemsIssued ? `${d.totalItemsIssued} items` : '', inr(d.totalValue), fmt(d.issueDateISO), s(d.issuedBy) && `By: ${d.issuedBy}`),
    route: () => '/issue-kit',
  },
  {
    id: 'recoveries', collection: 'recoveries', label: 'Recoveries', icon: Banknote,
    roles: [ROLE.QM],
    maxFetch: 500,
    searchFields: ['traineeName', 'chestNo', 'reason', 'status'],
    title: (d) => join(s(d.traineeName), inr(d.amount)),
    subtitle: (d) => join(s(d.reason), fmt(d.date)),
    badge: (d) => s(d.status) || null,
    route: () => '/funds',
  },

  fundCollection('mess_fund_collections', 'mess_fund_collections', 'Mess Collections', '/mess-fund'),
  fundExpense('mess_fund_expenses', 'mess_fund_expenses', 'Mess Expenses', '/mess-fund'),
  fundCollection('training_fund_collections', 'training_fund_collections', 'Training Collections', '/training-fund'),
  fundExpense('training_fund_expenses', 'training_fund_expenses', 'Training Purchases', '/training-fund'),
  {
    id: 'training_fund_recoveries', collection: 'training_fund_recoveries', label: 'Training Recoveries', icon: Banknote,
    roles: [ROLE.QM],
    maxFetch: 400,
    searchFields: ['chestNo', 'amount'],
    title: (d) => join(d.chestNo ? `Chest #${d.chestNo}` : '(Recovery)', inr(d.amount)),
    subtitle: (d) => fmt(d.date),
    route: () => '/training-fund',
  },
  fundCollection('company_assets_collections', 'company_assets_collections', 'Assets Collections', '/company-assets-fund'),
  fundExpense('company_assets_expenses', 'company_assets_expenses', 'Assets Purchases', '/company-assets-fund'),
  fundCollection('general_fund_collections', 'general_fund_collections', 'General Collections', '/general-fund'),
  fundExpense('general_fund_expenses', 'general_fund_expenses', 'General Expenses', '/general-fund'),

  // Legacy / generic finance
  fundCollection('collections', 'collections', 'Collections (Legacy)', '/funds'),
  fundExpense('expenses', 'expenses', 'Expenses (Legacy)', '/funds'),
  {
    id: 'fund_transfers', collection: 'fund_transfers', label: 'Fund Transfers', icon: ArrowLeftRight,
    roles: [ROLE.QM],
    maxFetch: 300,
    searchFields: ['fromFund', 'toFund', 'amount'],
    title: (d) => join(`${s(d.fromFund)} → ${s(d.toFund)}`, inr(d.amount)),
    subtitle: (d) => fmt(d.date),
    route: () => '/funds',
  },
  {
    id: 'vendors', collection: 'vendors', label: 'Vendors', icon: Store,
    roles: [ROLE.QM],
    maxFetch: 400,
    searchFields: ['name', 'phone', 'categoryLabel'],
    title: (d) => s(d.name) || '(Vendor)',
    subtitle: (d) => join(s(d.categoryLabel), s(d.phone)),
    badge: (d) => (d.isActive === false ? 'INACTIVE' : null),
    route: () => '/vendors',
  },
  {
    id: 'vendor_entries', collection: 'vendor_entries', label: 'Vendor Bills / Dues', icon: Receipt,
    roles: [ROLE.QM],
    maxFetch: 600,
    searchFields: ['vendorName', 'status', 'totalAmount'],
    title: (d) => join(s(d.vendorName), inr(d.totalAmount)),
    subtitle: (d) => join(`Paid: ${inr(d.paidAmount)}`, Number(d.dueAmount) > 0 ? `Due: ${inr(d.dueAmount)}` : 'Paid ✓', fmt(d.entryDate)),
    badge: (d) => (Number(d.dueAmount) > 0 ? 'DUE' : null),
    route: () => '/vendors',
  },
  {
    id: 'vendor_payments', collection: 'vendor_payments', label: 'Vendor Payments', icon: CreditCard,
    roles: [ROLE.QM],
    maxFetch: 500,
    searchFields: ['vendorName', 'amount', 'paymentMode'],
    title: (d) => join(s(d.vendorName), inr(d.amount)),
    subtitle: (d) => join(s(d.paymentMode), fmt(d.date)),
    route: () => '/vendor-payments',
  },
  {
    id: 'bills', collection: 'bills', label: 'Bills', icon: FileText,
    roles: [ROLE.QM],
    maxFetch: 400,
    searchFields: ['vendor', 'amount'],
    title: (d) => join(s(d.vendor) || '(Bill)', inr(d.amount)),
    subtitle: (d) => fmt(d.date),
    route: () => '/vendors',
  },
  {
    id: 'mess_boys', collection: 'mess_boys', label: 'Mess Boys', icon: Users,
    roles: [ROLE.QM],
    maxFetch: 200,
    searchFields: ['name', 'salary'],
    title: (d) => s(d.name) || '(Mess Boy)',
    subtitle: (d) => join(d.salary ? `Salary: ${inr(d.salary)}` : ''),
    badge: (d) => (d.isActive === false ? 'INACTIVE' : null),
    route: () => '/mess-boy-salary',
  },
  {
    id: 'mess_boy_salaries', collection: 'mess_boy_salaries', label: 'Mess Boy Salaries', icon: Banknote,
    roles: [ROLE.QM],
    maxFetch: 300,
    searchFields: ['name', 'monthLabel', 'totalSalary'],
    title: (d) => join(s(d.name), inr(d.totalSalary)),
    subtitle: (d) => join(s(d.monthLabel), d.totalDays ? `${d.totalDays} din` : ''),
    route: () => '/mess-boy-salary',
  },

  // ────────── SYSTEM (CC ONLY) ──────────
  {
    id: 'users', collection: 'users', label: 'System Users', icon: Shield,
    roles: [], // sirf CC (auto)
    maxFetch: 200,
    searchFields: ['name', 'email', 'role', 'designation', 'phone'],
    title: (d) => s(d.name) || s(d.email) || '(User)',
    subtitle: (d) => join(s(d.role), s(d.designation), s(d.email)),
    badge: (d) => (d.isActive === false ? 'DISABLED' : null),
    route: () => '/users',
  },
];
