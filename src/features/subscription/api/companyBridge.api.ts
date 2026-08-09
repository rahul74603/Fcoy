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
import { getFirestore, doc, setDoc, addDoc, collection, getDoc } from 'firebase/firestore';
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
