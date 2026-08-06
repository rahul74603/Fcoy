// src/features/subscription/types/subscription.types.ts

// ─────────────────────────────────────────────
// SUBSCRIPTION TYPES
// Monthly / 3 Months (Quarterly) / Yearly
// ─────────────────────────────────────────────

export type PlanDuration = 1 | 3 | 12; // months

export interface SubscriptionPlan {
  id: string;              // 'monthly' | 'quarterly' | 'yearly'
  name: string;            // 'Monthly Plan'
  durationMonths: PlanDuration;
  price: number;           // total price for whole duration (INR)
  isActive: boolean;       // hide/show plan
  badge?: string;          // 'POPULAR' | 'BEST VALUE'
  features: string[];      // bullet points shown on card
  updatedAt?: string;
  updatedBy?: string;
}

export interface UnitSubscription {
  planId: string;
  planName: string;
  durationMonths: number;
  amount: number;          // amount paid
  startDate: string;       // ISO
  endDate: string;         // ISO
  paymentMode: string;     // 'Cash' | 'UPI' | 'Bank Transfer' | 'PO' | 'Other'
  paymentRef: string;      // PO number / transaction id
  remarks: string;
  updatedAt: string;
  updatedBy: string;
}

export type HistoryAction =
  | 'ACTIVATED'
  | 'RENEWED'
  | 'EXTENDED'
  | 'CANCELLED'
  | 'PLAN_UPDATED';

export interface SubscriptionHistoryEntry {
  id: string;
  action: HistoryAction;
  planId: string;
  planName: string;
  amount: number;
  startDate: string;
  endDate: string;
  remarks: string;
  by: string;
  at: string;              // ISO
}

// ─────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────

export type SubscriptionStatus =
  | 'none'      // kabhi subscription liya hi nahi
  | 'active'    // chal raha hai
  | 'expiring'  // active hai lekin 30 din se kam bache
  | 'grace'     // expire ho gaya, grace period me (read-only)
  | 'expired';  // poori tarah khatam

export interface SubscriptionState {
  status: SubscriptionStatus;
  daysLeft: number;        // active: endDate tak ke din; grace: grace ke bache din (negative nahi)
  totalDays: number;       // poore period ke din
  usedPct: number;         // 0-100 progress bar ke liye
  graceDaysLeft: number;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

export const GRACE_DAYS = 30;         // expiry ke baad 30 din grace (data dikhega)
export const EXPIRING_SOON_DAYS = 30; // itne din bache to warning

// Default plans — pehli baar Firestore me auto-seed honge,
// uske baad CC inhe UI se easily edit kar sakta hai.
export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly Plan',
    durationMonths: 1,
    price: 5000,
    isActive: true,
    features: [
      'Saare modules unlocked',
      '5 user accounts tak',
      'Email support',
      'Monthly billing',
    ],
  },
  {
    id: 'quarterly',
    name: '3 Months Plan',
    durationMonths: 3,
    price: 13500,
    isActive: true,
    badge: 'POPULAR',
    features: [
      'Saare modules unlocked',
      '5 user accounts tak',
      'Priority email support',
      'Monthly se 10% sasta',
    ],
  },
  {
    id: 'yearly',
    name: 'Yearly Plan',
    durationMonths: 12,
    price: 48000,
    isActive: true,
    badge: 'BEST VALUE',
    features: [
      'Saare modules unlocked',
      'Unlimited user accounts',
      'Priority support + review',
      'Monthly se 20% sasta',
      'Full financial year cover',
    ],
  },
];

export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'PO', 'Cheque', 'Other'];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const formatDate = (iso: string): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export const formatINR = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN')}`;

/** Plan ka per-month rate */
export const perMonthRate = (plan: SubscriptionPlan): number =>
  Math.round(plan.price / plan.durationMonths);

/** Monthly plan ke mukable kitna % sasta */
export const savingsPct = (
  plan: SubscriptionPlan,
  monthlyPrice: number,
): number => {
  if (plan.durationMonths <= 1 || monthlyPrice <= 0) return 0;
  const full = monthlyPrice * plan.durationMonths;
  if (full <= 0) return 0;
  return Math.max(0, Math.round(((full - plan.price) / full) * 100));
};

/** Current subscription doc se poora status nikaalo */
export const computeSubscriptionState = (
  sub: UnitSubscription | null,
  now: Date = new Date(),
): SubscriptionState => {
  if (!sub || !sub.endDate) {
    return { status: 'none', daysLeft: 0, totalDays: 0, usedPct: 0, graceDaysLeft: 0 };
  }

  const start = new Date(sub.startDate);
  const end = new Date(sub.endDate);
  const graceEnd = addMonths(end, 0);
  graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);

  const msDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / msDay));
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / msDay);
  const usedPct = Math.min(
    100,
    Math.max(0, Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)),
  );
  const graceDaysLeft = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / msDay));

  if (now <= end) {
    return {
      status: daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'active',
      daysLeft, totalDays, usedPct, graceDaysLeft: GRACE_DAYS,
    };
  }
  if (now <= graceEnd) {
    return { status: 'grace', daysLeft: 0, totalDays, usedPct: 100, graceDaysLeft };
  }
  return { status: 'expired', daysLeft: 0, totalDays, usedPct: 100, graceDaysLeft: 0 };
};

export const STATUS_META: Record<SubscriptionStatus, { label: string; color: string; bg: string }> = {
  none:     { label: 'No Subscription', color: 'text-slate-600',  bg: 'bg-slate-100 border-slate-300' },
  active:   { label: 'Active',          color: 'text-green-700',  bg: 'bg-green-100 border-green-300' },
  expiring: { label: 'Expiring Soon',   color: 'text-amber-700',  bg: 'bg-amber-100 border-amber-300' },
  grace:    { label: 'Grace Period',    color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' },
  expired:  { label: 'Expired',         color: 'text-red-700',    bg: 'bg-red-100 border-red-300' },
};
