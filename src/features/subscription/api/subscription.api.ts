// src/features/subscription/api/subscription.api.ts

import {
  collection, doc, getDocs, getDoc, setDoc, addDoc,
  query, orderBy, limit, deleteField,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import {
  SubscriptionPlan, UnitSubscription, SubscriptionHistoryEntry,
  HistoryAction, DEFAULT_PLANS, addMonths,
} from '../types/subscription.types';
import { verifyOwnerKey, hashOwnerKey, generateSalt } from '../utils/ownerKey';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from '../../../config/firebase';

let cachedFns: ReturnType<typeof getFunctions> | null = null;
function subscriptionFunctions() {
  if (cachedFns) return cachedFns;
  const region = (import.meta.env.VITE_FUNCTIONS_REGION as string | undefined) || 'us-central1';
  cachedFns = getFunctions(app, region);
  if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
    connectFunctionsEmulator(cachedFns, 'localhost', 5001);
  }
  return cachedFns;
}

// ─────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────
const PLANS_COL = 'subscriptionPlans';       // subscriptionPlans/{planId}
const CURRENT_DOC = 'subscription/current';  // subscription/current
const HISTORY_COL = 'subscriptionHistory';   // subscriptionHistory/{autoId}

// ─────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────

/**
 * Saare plans laao. Pehli baar collection khali ho to
 * DEFAULT_PLANS auto-seed ho jate hain — iske baad
 * CC UI se prices edit kar sakta hai.
 */
export const fetchPlans = async (): Promise<SubscriptionPlan[]> => {
  const snap = await getDocs(collection(db, PLANS_COL));

  if (snap.empty) {
    // First time — defaults seed karo
    await Promise.all(
      DEFAULT_PLANS.map(p =>
        setDoc(doc(db, PLANS_COL, p.id), { ...p, updatedAt: new Date().toISOString() }),
      ),
    );
    return DEFAULT_PLANS;
  }

  const plans: SubscriptionPlan[] = [];
  snap.forEach(d => plans.push({ ...(d.data() as SubscriptionPlan), id: d.id }));

  // Order: monthly → quarterly → yearly
  return plans.sort((a, b) => a.durationMonths - b.durationMonths);
};

/** Plan ka price / details update karo (easy management) */
export const savePlan = async (
  plan: SubscriptionPlan,
  updatedBy: string,
): Promise<void> => {
  await setDoc(doc(db, PLANS_COL, plan.id), {
    ...plan,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
};

// ─────────────────────────────────────────────
// CURRENT SUBSCRIPTION
// ─────────────────────────────────────────────

export const fetchCurrentSubscription = async (): Promise<UnitSubscription | null> => {
  const snap = await getDoc(doc(db, 'subscription', 'current'));
  return snap.exists() ? (snap.data() as UnitSubscription) : null;
};

export interface ActivateOptions {
  paymentMode: string;
  paymentRef: string;
  remarks: string;
  /** Renew me true — naya period purane endDate se shuru hoga (din waste nahi) */
  continueFromCurrentEnd?: boolean;
  currentEndDate?: string;
}

/**
 * Plan activate / renew karo.
 * - Fresh: aaj se shuru
 * - Renew (continueFromCurrentEnd): purani endDate ke agle din se
 */
export const activatePlan = async (
  plan: SubscriptionPlan,
  by: string,
  opts: ActivateOptions,
): Promise<UnitSubscription> => {
  const now = new Date();

  let start = now;
  let action: HistoryAction = 'ACTIVATED';

  if (opts.continueFromCurrentEnd && opts.currentEndDate) {
    const prevEnd = new Date(opts.currentEndDate);
    if (prevEnd > now) {
      start = prevEnd;                 // purane din bache hain — wahi se aage
      action = 'RENEWED';
    } else {
      action = 'RENEWED';              // expire ke baad renew — aaj se
    }
  }

  const end = addMonths(start, plan.durationMonths);

  const sub: UnitSubscription = {
    planId: plan.id,
    planName: plan.name,
    durationMonths: plan.durationMonths,
    amount: plan.price,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    paymentMode: opts.paymentMode,
    paymentRef: opts.paymentRef,
    remarks: opts.remarks,
    updatedAt: now.toISOString(),
    updatedBy: by,
  };

  try {
    await setDoc(doc(db, 'subscription', 'current'), sub);
  } catch (err) { throw licenceWriteError(err); }
  await logHistory({
    action, planId: plan.id, planName: plan.name, amount: plan.price,
    startDate: sub.startDate, endDate: sub.endDate,
    remarks: opts.remarks || opts.paymentRef, by,
  });

  return sub;
};

/** Current endDate me N mahine add karo (quick extend) */
export const extendSubscription = async (
  sub: UnitSubscription,
  months: number,
  by: string,
  remarks: string,
): Promise<UnitSubscription> => {
  const end = addMonths(new Date(sub.endDate), months);
  const updated: UnitSubscription = {
    ...sub,
    endDate: end.toISOString(),
    remarks: remarks || sub.remarks,
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  try {
    await setDoc(doc(db, 'subscription', 'current'), updated);
  } catch (err) { throw licenceWriteError(err); }
  await logHistory({
    action: 'EXTENDED', planId: sub.planId, planName: sub.planName, amount: 0,
    startDate: sub.startDate, endDate: updated.endDate,
    remarks: `+${months} month(s) — ${remarks}`, by,
  });
  return updated;
};

/** Subscription hatao / band karo */
export const cancelSubscription = async (
  sub: UnitSubscription,
  by: string,
  remarks: string,
): Promise<void> => {
  await setDoc(doc(db, 'subscription', 'current'), {
    ...sub,
    endDate: new Date().toISOString(), // abhi se band
    remarks: remarks || 'Cancelled',
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  });
  await logHistory({
    action: 'CANCELLED', planId: sub.planId, planName: sub.planName, amount: 0,
    startDate: sub.startDate, endDate: new Date().toISOString(),
    remarks, by,
  });
};

// ─────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────

export const logHistory = async (
  entry: Omit<SubscriptionHistoryEntry, 'id' | 'at'>,
): Promise<void> => {
  await addDoc(collection(db, HISTORY_COL), {
    ...entry,
    at: new Date().toISOString(),
  });
};

export const fetchHistory = async (max = 50): Promise<SubscriptionHistoryEntry[]> => {
  const q = query(collection(db, HISTORY_COL), orderBy('at', 'desc'), limit(max));
  const snap = await getDocs(q);
  const list: SubscriptionHistoryEntry[] = [];
  snap.forEach(d => list.push({ ...(d.data() as Omit<SubscriptionHistoryEntry, 'id'>), id: d.id }));
  return list;
};

/** Firestore cleanup helper (plan update ke waqt) */
export const clearField = deleteField;

export { CURRENT_DOC, PLANS_COL, HISTORY_COL };

// ─────────────────────────────────────────────
// 🔑 OWNER RENEWAL (payment ke baad, owner key se)
// Expired ho chuki ho to AAJ se fresh period start hota hai;
// warna existing endDate ke aage extend hota hai.
// ─────────────────────────────────────────────
/**
 * Owner renewal — ab SERVER par hota hai.
 *
 * Pehle ye poora flow browser me chalta tha: owner key yahin verify hoti thi
 * aur phir client seedhe `subscription/current` par likh deta tha. Kyunki
 * rules kehte the `allow write: if isCC()`, Company Commander — yaani wahi
 * banda jiski licence hai — console se `endDate: 2099` likhkar khud ko
 * unlimited licence de sakta tha. Owner key ka koi matlab nahi tha:
 * Firestore ne wo key kabhi dekhi hi nahi, wo sirf React me check hoti thi.
 *
 * Ab rules har client write mana karte hain aur ye callable Admin SDK par
 * chalta hai: key server par verify hoti hai, plan/duration/amount server ke
 * plan document se aate hain, aur dates server clock se bante hain.
 */
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ CLIENT-SIDE LICENCE WRITES AB BLOCKED HAIN
// ───────────────────────────────────────────────────────────────────────
// firestore.rules ab `subscription/current` par har client write mana karta
// hai. Wajah: Company Commander wahi party hai jiski licence ye document
// control karta hai — pehle wo browser console se apni hi expiry aage
// badha sakta tha.
//
// Neeche ke helpers (activatePlan / extendSubscription / cancelSubscription)
// ab Firestore se permission-denied paayenge. Inhe jaan-boojhkar HATAYA
// NAHI gaya — SubscriptionScreen (App Owner ka master tool) inhe use karta
// hai, aur inka error ab saaf batata hai ki kya karna hai. Renewal ka asli
// raasta `renewWithOwnerKey()` hai, jo server callable par jaata hai.
// ═══════════════════════════════════════════════════════════════════════

/** Rules-denied write ko samajhne layak message me badlo. */
const licenceWriteError = (err: unknown): Error => {
  const code = String((err as { code?: string })?.code ?? '');
  if (code === 'permission-denied') {
    return new Error(
      'Licence ab client se badli nahi ja sakti (security). Owner key ke saath '
      + 'renewal panel use karo — wo server par verify hoti hai.',
    );
  }
  return err instanceof Error ? err : new Error(String(err));
};

export const renewWithOwnerKey = async (
  ownerKey: string,
  months: number,
  paymentMode: string,
  paymentRef: string,
): Promise<{ endDate: string; nextOwnerKey?: string }> => {
  // Client sirf planId bhejta hai; duration/price server plan doc se aate hain.
  const plans = await fetchPlans();
  const plan = plans.find(p => p.durationMonths === months) ?? plans[0];
  if (!plan) throw new Error('Koi plan define nahi mila (subscriptionPlans khaali).');

  const callable = httpsCallable<
    { planId: string; ownerKey: string; paymentMode: string; paymentRef: string },
    { planId: string; planName: string; startDate: string; endDate: string; nextOwnerKey: string }
  >(subscriptionFunctions(), 'renewSubscription');

  try {
    const res = await callable({ planId: plan.id, ownerKey, paymentMode, paymentRef });
    return { endDate: res.data.endDate, nextOwnerKey: res.data.nextOwnerKey };
  } catch (e: any) {
    const code = e?.code ?? '';
    if (code === 'permission-denied') throw new Error(e?.message ?? 'Owner key GALAT hai.');
    if (code === 'invalid-argument' || code === 'failed-precondition') {
      throw new Error(e?.message ?? 'Renewal ki details galat hain.');
    }
    if (code === 'unauthenticated') throw new Error('Pehle login karo.');
    if (code === 'not-found' || /not.?found/i.test(e?.message ?? '')) {
      throw new Error('Renewal function deploy nahi hua. Chalao: firebase deploy --only functions');
    }
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      throw new Error('Server abhi reachable nahi. Thodi der baad koshish karo.');
    }
    throw new Error(e?.message ?? 'Renew fail ho gaya');
  }
};
