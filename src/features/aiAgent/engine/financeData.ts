// ═══════════════════════════════════════════════════════════════════════
// FINANCE READ DATA — fund balances + finance summary for the agent
// ───────────────────────────────────────────────────────────────────────
// Reuses the SAME accounting basis the fund screens use:
//   balance = collections (in) − expenses (out)
// Finance collections are GLOBAL (not batch scoped). Read-only.
// ═══════════════════════════════════════════════════════════════════════

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import { resolveDatePhrase, dateMatches } from './dateResolve';

const num = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

async function fetchAll(collectionName: string): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => showDoc(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

export interface FundBalance {
  fund: string;
  collections: number;
  expenses: number;
  recoveries: number;
  balance: number;
}

const FUNDS: { fund: string; collections: string[]; expenses: string[]; recoveries?: string[] }[] = [
  { fund: 'Mess Fund', collections: ['mess_fund_collections'], expenses: ['mess_fund_expenses'] },
  { fund: 'Training Fund', collections: ['training_fund_collections'], expenses: ['training_fund_expenses'], recoveries: ['training_fund_recoveries'] },
  { fund: 'Company Assets Fund', collections: ['company_assets_collections'], expenses: ['company_assets_expenses'] },
  { fund: 'General Fund', collections: ['general_fund_collections', 'collections'], expenses: ['general_fund_expenses', 'expenses'] },
];

export async function getFundBalance(fundName?: string): Promise<FundBalance[]> {
  const out: FundBalance[] = [];
  for (const f of FUNDS) {
    if (fundName && !f.fund.toLowerCase().includes(fundName.toLowerCase()) &&
        !fundName.toLowerCase().includes(f.fund.split(' ')[0].toLowerCase())) continue;
    let collections = 0;
    for (const c of f.collections) {
      const rows = await fetchAll(c);
      collections += rows.reduce((s, r) => s + num(r.amount), 0);
    }
    let expenses = 0;
    for (const c of f.expenses) {
      const rows = await fetchAll(c);
      expenses += rows.reduce((s, r) => s + num(r.amount), 0);
    }
    let recoveries = 0;
    for (const c of f.recoveries ?? []) {
      const rows = await fetchAll(c);
      recoveries += rows.reduce((s, r) => s + num(r.amount ?? r.paidAmount ?? r.recoveredAmount), 0);
    }
    out.push({ fund: f.fund, collections, expenses, recoveries, balance: collections - expenses });
  }
  return out;
}

export interface FinanceSummary {
  totalCollections: number;
  totalExpenses: number;
  netBalance: number;
  monthExpenses: number;
  monthCollections: number;
  topExpenses: { item: string; amount: number }[];
  vendorPaid: { vendor: string; paid: number }[];
  pendingPayments: number;
}

export async function getFinanceSummary(opts: { phrase?: string } = {}): Promise<FinanceSummary> {
  const resolved = opts.phrase ? resolveDatePhrase(opts.phrase) : null;

  const expenseCols = ['mess_fund_expenses', 'training_fund_expenses', 'company_assets_expenses', 'general_fund_expenses', 'expenses'];
  const collectCols = ['mess_fund_collections', 'training_fund_collections', 'company_assets_collections', 'general_fund_collections', 'collections'];

  let allExpenses: any[] = [];
  let allCollections: any[] = [];
  for (const c of expenseCols) allExpenses = allExpenses.concat(await fetchAll(c));
  for (const c of collectCols) allCollections = allCollections.concat(await fetchAll(c));

  const totalExpenses = allExpenses.reduce((s, r) => s + num(r.amount), 0);
  const totalCollections = allCollections.reduce((s, r) => s + num(r.amount), 0);

  // Month filtering (this month or resolved range)
  const inRange = (r: any) => {
    if (!resolved) return true;
    const day = String(r.date ?? r.expenseDate ?? r.createdAt ?? '').slice(0, 10);
    if (!day) return false;
    return dateMatches(resolved, day);
  };
  const thisMonth = resolveDatePhrase('this month');
  const monthExpenses = allExpenses
    .filter((r) => thisMonth ? dateMatches(thisMonth, String(r.date ?? r.expenseDate ?? '').slice(0, 10)) : false)
    .reduce((s, r) => s + num(r.amount), 0);
  const monthCollections = allCollections
    .filter((r) => thisMonth ? dateMatches(thisMonth, String(r.date ?? '').slice(0, 10)) : false)
    .reduce((s, r) => s + num(r.amount), 0);
  void inRange;

  const topExpenses = [...allExpenses]
    .sort((a, b) => num(b.amount) - num(a.amount))
    .slice(0, 8)
    .map((r) => ({ item: String(r.item ?? r.description ?? r.purpose ?? r.category ?? 'Expense'), amount: num(r.amount) }));

  // Vendor payments
  const vendorPayments = await fetchAll('vendor_payments');
  const vendorMap = new Map<string, number>();
  for (const v of vendorPayments) {
    const name = String(v.vendorName ?? v.vendor ?? 'Vendor');
    vendorMap.set(name, (vendorMap.get(name) ?? 0) + num(v.amount ?? v.paidAmount));
  }
  const vendorEntries = await fetchAll('vendor_entries');
  let pendingPayments = 0;
  for (const e of vendorEntries) {
    pendingPayments += num(e.dueAmount ?? 0) - num(e.paidAmount ?? 0);
  }

  return {
    totalCollections,
    totalExpenses,
    netBalance: totalCollections - totalExpenses,
    monthExpenses,
    monthCollections,
    topExpenses,
    vendorPaid: [...vendorMap.entries()].map(([vendor, paid]) => ({ vendor, paid })).sort((a, b) => b.paid - a.paid),
    pendingPayments,
  };
}
