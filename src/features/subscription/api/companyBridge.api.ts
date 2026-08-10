// src/features/subscription/api/companyBridge.api.ts
// ═════════════════════════════════════════════════════════════
// ⚡ SYNC BRIDGE — MASTER APP (billing ledger) → COMPANY APP (live)
//
// Problem yeh thi: master aur company ke Firestore ALAG-ALAG projects hain
// (Isolation Kanun #5). Isliye master me renew karne se company app pe
// kuch dikhta nahi tha — dono duniya ke beech sirf SUBSCRIPTION ka rishta hai.
//
// Bridge ka kaam: har company app ke andar deploy-time pe ek special
// 'sync user' banta hai (owner-sync.<code>@fcoy-erp.internal) — uski creds
// master ke customer record me 'bridge' field me rehti hain. Master jab
// renew/extend/cancel karta hai to is file ke through SECONDARY Firebase
// app instance se company project me signIn karke 'subscription/current'
// likh deta hai — company app ka realtime onSnapshot turant update ho jata
// hai (2 second me LIVE ✓).
//
// Safety:
//   - Bridge sirf SUBSCRIPTION + PLANS likhta hai (company ka real data
//     master ko dikhta hi nahi — rules/scope dono taraf se alag).
//   - Creds sirf master project ke customers doc me (owner-only zone).
// ═════════════════════════════════════════════════════════════

import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, addDoc, collection, getDoc, getDocs } from 'firebase/firestore';
import { toJSDate } from '../../../utils/date.utils';
import { UnitSubscription, SubscriptionPlan } from '../types/subscription.types';

export interface CompanyBridge {
  projectId: string;
  apiKey: string;
  authDomain: string;
  appId: string;
  syncEmail: string;
  syncSecret: string;
}

const openCompany = async (bridge: CompanyBridge) => {
  const app: FirebaseApp = initializeApp(
    {
      apiKey: bridge.apiKey,
      authDomain: bridge.authDomain,
      projectId: bridge.projectId,
      appId: bridge.appId,
    },
    `bridge-${bridge.projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );
  const a = getAuth(app);
  await signInWithEmailAndPassword(a, bridge.syncEmail, bridge.syncSecret);
  const db2 = getFirestore(app);
  return { app, a, db2 };
};

/**
 * ⚡ Company app ke 'subscription/current' pe master wala sub PUSH karo.
 * merge:true — ownerKey jaise company-side fields safe rehte hain.
 * Saath me plan catalog bhi push hota hai (price mismatch kabhi nahi hoga).
 */
export const pushSubToCompany = async (
  bridge: CompanyBridge,
  sub: UnitSubscription,
  opts: { note: string; plans?: SubscriptionPlan[] },
): Promise<void> => {
  const { app, a, db2 } = await openCompany(bridge);
  try {
    const nowIso = new Date().toISOString();
    await setDoc(
      doc(db2, 'subscription', 'current'),
      {
        ...sub,
        updatedAt: nowIso,
        updatedBy: `MASTER-SYNC (${sub.updatedBy || 'Owner'})`,
      },
      { merge: true },
    );
    await addDoc(collection(db2, 'subscriptionHistory'), {
      action: 'MASTER_SYNC',
      planId: sub.planId,
      planName: sub.planName,
      amount: sub.amount,
      startDate: sub.startDate,
      endDate: sub.endDate,
      remarks: opts.note,
      by: sub.updatedBy || 'Owner',
      at: nowIso,
    });
    // Plan catalog bhi sync — dono apps me price HAMESHA same
    if (opts.plans && opts.plans.length > 0) {
      for (const p of opts.plans) {
        await setDoc(doc(db2, 'subscriptionPlans', p.id), { ...p }, { merge: true });
      }
    }
    await signOut(a);
  } finally {
    await deleteApp(app);
  }
};

/** Bridge health-check — company app ka current sub padhke batao (UI status ke liye) */
export const checkCompanyBridge = async (bridge: CompanyBridge): Promise<string> => {
  const { app, a, db2 } = await openCompany(bridge);
  try {
    const snap = await getDoc(doc(db2, 'subscription', 'current'));
    await signOut(a);
    if (!snap.exists()) return 'LIVE · company app me abhi koi subscription doc nahi (NO PLAN state)';
    const d = snap.data() as Partial<UnitSubscription>;
    return `LIVE · company app: ${d.planName || 'NO PLAN'} · valid till ${d.endDate ? d.endDate.slice(0, 10) : '—'}`;
  } finally {
    await deleteApp(app);
  }
};

// ═════════════════════════════════════════════════════════════
// 🏢 COMPANY SNAPSHOT (READ-ONLY) — Company Monitor ke liye
// Master app se company app ka LIVE dashboard summary laata hai.
// SIRF padhta hai — company ka data master kabhi nahi badalta.
// ═════════════════════════════════════════════════════════════

export interface CompanySnapshot {
  trainees: number;
  staff: number;
  onLeaveNow: number;
  pendingLeaves: number;
  pendingLeaveNames: string[];
  dutyToday: number;
  tests: number;
  recentTests: { name: string; date: string; pass: number; fail: number }[];
  batches: { id: string; name: string; status: string }[];
  planName: string | null;
  planValidTill: string | null;
  fetchedAt: string;
}

export const fetchCompanySnapshot = async (bridge: CompanyBridge): Promise<CompanySnapshot> => {
  const { app, a, db2 } = await openCompany(bridge);
  try {
    // Ek collection fail ho jaye to baaki data phir bhi dikhe
    const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); } catch { return fallback; }
    };
    const docsOf = async (col: string) =>
      safe(async () => (await getDocs(collection(db2, col))).docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) })), [] as Record<string, unknown>[]);

    const [trainees, staffArr, leaves, duties, tests, batches, subSnap] = await Promise.all([
      docsOf('trainees'),
      docsOf('staff'),
      docsOf('staff_leave'),
      docsOf('staff_duty'),
      docsOf('training_tests'),
      docsOf('batches'),
      safe(async () => await getDoc(doc(db2, 'subscription', 'current')), null),
    ]);

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const pending = leaves.filter(l => (l.status as string) === 'pending');
    const onLeave = leaves.filter(l => {
      if ((l.status as string) !== 'approved') return false;
      const from = toJSDate(l.fromDate); const to = toJSDate(l.toDate);
      if (!from || !to) return false;
      from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999);
      return l.returnDate ? false : today >= from && today <= to;
    });

    const dutyToday = duties.filter(d => {
      const dd = toJSDate(d.date);
      if (!dd) return false;
      dd.setHours(0, 0, 0, 0);
      return dd.getTime() === today.getTime() && (d.status as string) !== 'completed';
    });

    const sortedTests = [...tests].sort((x, y) =>
      (toJSDate(y.testDate)?.getTime() ?? 0) - (toJSDate(x.testDate)?.getTime() ?? 0));

    const sub = subSnap && subSnap.exists() ? (subSnap.data() as Record<string, unknown>) : null;

    return {
      trainees: trainees.length,
      staff: staffArr.length,
      onLeaveNow: onLeave.length,
      pendingLeaves: pending.length,
      pendingLeaveNames: pending.slice(0, 6).map(l => `${(l.rank as string) ? l.rank + ' ' : ''}${(l.staffName as string) || '—'}`),
      dutyToday: dutyToday.length,
      tests: tests.length,
      recentTests: sortedTests.slice(0, 3).map(t => ({
        name: (t.testName as string) || '—',
        date: toJSDate(t.testDate)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) ?? '—',
        pass: Number(t.passCount ?? 0), fail: Number(t.failCount ?? 0),
      })),
      batches: batches.map(b => ({ id: b.id as string, name: ((b.batchName || b.batchNumber || b.id) as string), status: (b.status as string) || '—' })),
      planName: (sub?.planName as string) ?? null,
      planValidTill: (sub?.endDate as string)?.slice(0, 10) ?? null,
      fetchedAt: new Date().toLocaleTimeString('en-IN'),
    };
  } finally {
    try { await signOut(a); } catch { /* noop */ }
    await deleteApp(app);
  }
};
