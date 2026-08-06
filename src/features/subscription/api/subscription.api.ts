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

  await setDoc(doc(db, 'subscription', 'current'), sub);
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
  await setDoc(doc(db, 'subscription', 'current'), updated);
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
