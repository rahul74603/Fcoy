// src/features/developer/api/customers.api.ts
// ─────────────────────────────────────────────
// 👑 OWNER API — Customers (CC Accounts) + Subscriptions
// Developer (Owner) yahan se:
//   1. Company Commander ka account banata hai (naya customer)
//   2. Auto Customer ID generate hoti hai (FCOY-2026-001...)
//   3. Subscription record ready hota hai — plan assign/renew/extend/cancel
//   4. Payment ka poora record (ledger) rehta hai
//   5. "Apply to Unit" → is app ka subscription turant apply
// ─────────────────────────────────────────────

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, where,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { db, auth } from '../../../config/firebase';
import {
  UnitSubscription, addMonths,
} from '../../subscription/types/subscription.types';
import { SubscriptionPlan } from '../../subscription/types/subscription.types';
import { CompanyBridge } from '../../subscription/api/companyBridge.api';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface Customer {
  id: string;               // doc id
  customerId: string;       // FCOY-2026-001
  unitName: string;         // 'F Coy'
  commanderName: string;
  email: string;
  phone: string;
  location: string;
  notes: string;
  status: 'active' | 'suspended';
  isLocalUnit: boolean;     // kya ye isi app/deployment ka CC hai
  authUid: string;
  companyCode?: string;     // deploy code (bcoy/ccoy...) — sync bridge se joda hua
  projectId?: string;       // us company app ka firebase project
  bridge?: CompanyBridge | null; // ⚡ SYNC BRIDGE creds (master-only, deploy script likhti hai)
  createdAt: string;
  createdBy: string;
}

export interface CustomerWithSub extends Customer {
  sub?: UnitSubscription | null;
}

export interface CreateCcForm {
  unitName: string;
  commanderName: string;
  email: string;
  password: string;
  phone: string;
  location: string;
  notes: string;
  isLocalUnit: boolean;
}

const CUSTOMERS_COL = 'customers';
const CUST_SUB_COL = 'customerSubscriptions';
const HISTORY_COL = 'subscriptionHistory';

// ─────────────────────────────────────────────
// CUSTOMER ID GENERATOR — FCOY-2026-001
// ─────────────────────────────────────────────
const nextCustomerId = async (): Promise<string> => {
  const snap = await getDocs(collection(db, CUSTOMERS_COL));
  let max = 0;
  snap.forEach(d => {
    const cid = (d.data() as { customerId?: string }).customerId ?? '';
    const m = cid.match(/-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  const year = new Date().getFullYear();
  return `FCOY-${year}-${String(max + 1).padStart(3, '0')}`;
};

// ─────────────────────────────────────────────
// LIST CUSTOMERS (+ their subscriptions)
// ─────────────────────────────────────────────
export const listCustomersWithSub = async (): Promise<CustomerWithSub[]> => {
  const snap = await getDocs(collection(db, CUSTOMERS_COL));
  const customers: CustomerWithSub[] = [];
  for (const d of snap.docs) {
    const c = { id: d.id, ...(d.data() as Omit<Customer, 'id'>) };
    const subSnap = await getDoc(doc(db, CUST_SUB_COL, c.customerId));
    customers.push({ ...c, sub: subSnap.exists() ? (subSnap.data() as UnitSubscription) : null });
  }
  return customers.sort((a, b) => a.customerId.localeCompare(b.customerId));
};

// ─────────────────────────────────────────────
// CREATE REMOTE CUSTOMER (billing-only) — 🌐
// Nayi company (B Coy, C Coy...) jiski APNI alag app hogi.
// ⚠️ Is app me uska LOGIN/auth user NAHI banta — warna wo
// is app ke database (local unit ka data) dekh leta.
// Yahan sirf: customers record + subscription-ready + history.
// CC login unki APP me banta hai (Delivery Playbook step 3).
// ─────────────────────────────────────────────
export interface RemoteCustomerForm {
  unitName: string;
  commanderName: string;
  email: string;
  phone: string;
  location: string;
  notes: string;
}

export const createRemoteCustomer = async (
  form: RemoteCustomerForm,
  byName: string,
): Promise<{ customerId: string }> => {
  const customerId = await nextCustomerId();
  const now = new Date().toISOString();

  await addDoc(collection(db, CUSTOMERS_COL), {
    customerId,
    unitName: form.unitName,
    commanderName: form.commanderName,
    email: form.email,
    phone: form.phone,
    location: form.location,
    notes: form.notes,
    status: 'active',
    isLocalUnit: false, // 🌐 REMOTE — is app ka ghar NAHI
    authUid: '',        // koi login nahi (billing record only)
    createdAt: now,
    createdBy: byName,
  } satisfies Omit<Customer, 'id'>);

  await addDoc(collection(db, HISTORY_COL), {
    action: 'ACCOUNT_CREATED',
    customerId,
    planId: '', planName: `${form.unitName} — remote customer record (billing-only)`, amount: 0,
    startDate: '', endDate: '',
    remarks: `Customer ID ${customerId} assigned · 🌐 apni alag app (login yahan NAHI banaya gaya — safety)`, by: byName, at: now,
  });

  return { customerId };
};

// ─────────────────────────────────────────────
// CREATE CC ACCOUNT (customer)
// Auth user banta hai + users doc + customers doc
// + subscription record (NO PLAN) + history entry
// ─────────────────────────────────────────────
export const createCcAccount = async (
  form: CreateCcForm,
  devUser: { uid: string; email: string | null; name: string },
  devPassword: string,
): Promise<{ customerId: string }> => {
  const devEmail = devUser.email ?? '';
  const byName = devUser.name || devEmail;

  // 1. Firebase Auth user (is step ke baad session new user pe chala jata hai)
  const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
  const ccUid = cred.user.uid;

  const customerId = await nextCustomerId();
  const now = new Date().toISOString();

  // 2. users doc (role CC — isDeveloper false)
  await setDoc(doc(db, 'users', ccUid), {
    name: form.commanderName,
    email: form.email,
    phone: form.phone,
    designation: `Company Commander — ${form.unitName}`,
    role: 'Company Commander',
    isActive: true,
    isDeveloper: false,
    customerId,
    unitName: form.unitName,
    createdBy: devUser.uid,
    createdAt: now,
  });

  // 3. customers doc
  await setDoc(doc(db, CUSTOMERS_COL, ccUid), {
    customerId,
    unitName: form.unitName,
    commanderName: form.commanderName,
    email: form.email,
    phone: form.phone,
    location: form.location,
    notes: form.notes,
    status: 'active',
    isLocalUnit: form.isLocalUnit,
    authUid: ccUid,
    createdAt: now,
    createdBy: byName,
  } satisfies Omit<Customer, 'id'>);

  // 4. History — account created (subscription ready for plans)
  await addDoc(collection(db, HISTORY_COL), {
    action: 'ACCOUNT_CREATED',
    customerId,
    planId: '', planName: `${form.unitName} — CC account created`, amount: 0,
    startDate: '', endDate: '',
    remarks: `Customer ID ${customerId} assigned`, by: byName, at: now,
  });

  // 5. Dev ko wapas login karo (auth session switch ho gayi thi)
  await signInWithEmailAndPassword(auth, devEmail, devPassword);

  return { customerId };
};

// ─────────────────────────────────────────────
// HISTORY (per customer)
// ─────────────────────────────────────────────
export interface CustHistoryEntry {
  id: string;
  action: string;
  customerId?: string;
  planName: string;
  amount: number;
  startDate: string;
  endDate: string;
  remarks: string;
  by: string;
  at: string;
}

export const fetchCustomerHistory = async (customerId: string): Promise<CustHistoryEntry[]> => {
  const q = query(collection(db, HISTORY_COL), where('customerId', '==', customerId));
  const snap = await getDocs(q);
  const list: CustHistoryEntry[] = [];
  snap.forEach(d => list.push({ id: d.id, ...(d.data() as Omit<CustHistoryEntry, 'id'>) }));
  return list.sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 50);
};

// ─────────────────────────────────────────────
// ASSIGN / RENEW PLAN to customer
// applyToUnit=true → is app ka subscription भी turant apply
// ─────────────────────────────────────────────
export interface AssignOptions {
  paymentMode: string;
  paymentRef: string;
  remarks: string;
  applyToUnit: boolean;
}

export const assignPlanToCustomer = async (
  customer: CustomerWithSub,
  plan: SubscriptionPlan,
  by: string,
  opts: AssignOptions,
): Promise<UnitSubscription> => {
  const now = new Date();
  let start = now;
  let action = 'ASSIGNED';

  // Renew — bache hue din carry forward
  if (customer.sub?.endDate) {
    const prevEnd = new Date(customer.sub.endDate);
    if (prevEnd > now) { start = prevEnd; action = 'RENEWED'; }
    else action = 'RENEWED';
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

  // Customer ka subscription record
  await setDoc(doc(db, CUST_SUB_COL, customer.customerId), sub);

  // 🏠 Is app (unit) pe APPLY
  if (opts.applyToUnit) {
    await setDoc(doc(db, 'subscription', 'current'), sub);
  }

  await addDoc(collection(db, HISTORY_COL), {
    action,
    customerId: customer.customerId,
    planId: plan.id, planName: plan.name, amount: plan.price,
    startDate: sub.startDate, endDate: sub.endDate,
    remarks: `${opts.remarks || opts.paymentRef}${opts.applyToUnit ? ' · ✓ Applied to unit app' : ''}`,
    by, at: now.toISOString(),
  });

  return sub;
};

// ─────────────────────────────────────────────
// QUICK EXTEND / CANCEL (customer)
// ─────────────────────────────────────────────
export const extendCustomerSub = async (
  customer: CustomerWithSub,
  months: number,
  by: string,
  applyToUnit: boolean,
): Promise<UnitSubscription> => {
  if (!customer.sub) throw new Error('Pehle koi plan assign karo');
  const end = addMonths(new Date(customer.sub.endDate), months);
  const updated: UnitSubscription = {
    ...customer.sub,
    endDate: end.toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  await setDoc(doc(db, CUST_SUB_COL, customer.customerId), updated);
  if (applyToUnit) await setDoc(doc(db, 'subscription', 'current'), updated);
  await addDoc(collection(db, HISTORY_COL), {
    action: 'EXTENDED', customerId: customer.customerId,
    planId: updated.planId, planName: updated.planName, amount: 0,
    startDate: updated.startDate, endDate: updated.endDate,
    remarks: `+${months} month(s)${applyToUnit ? ' · ✓ Applied to unit app' : ''}`,
    by, at: new Date().toISOString(),
  });
  return updated;
};

export const cancelCustomerSub = async (
  customer: CustomerWithSub,
  by: string,
  applyToUnit: boolean,
): Promise<UnitSubscription> => {
  if (!customer.sub) throw new Error('Pehle koi plan assign karo');
  const updated: UnitSubscription = {
    ...customer.sub,
    endDate: new Date().toISOString(),
    remarks: 'Cancelled by Owner',
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  await setDoc(doc(db, CUST_SUB_COL, customer.customerId), updated);
  if (applyToUnit) await setDoc(doc(db, 'subscription', 'current'), updated);
  await addDoc(collection(db, HISTORY_COL), {
    action: 'CANCELLED', customerId: customer.customerId,
    planId: updated.planId, planName: updated.planName, amount: 0,
    startDate: updated.startDate, endDate: updated.endDate,
    remarks: `Cancelled by owner${applyToUnit ? ' · applied to unit app' : ''}`,
    by, at: new Date().toISOString(),
  });
  return updated;
};

// ─────────────────────────────────────────────
// TOGGLE CUSTOMER STATUS (suspend/activate)
// ─────────────────────────────────────────────
export const setCustomerStatus = async (
  customer: Customer,
  status: 'active' | 'suspended',
): Promise<void> => {
  await setDoc(doc(db, CUSTOMERS_COL, customer.id), { status }, { merge: true });
};

// ═════════════════════════════════════════════════════════════
// ⚡ FIRST COMPANY QUICK SETUP (Owner ne order kiya)
// Ek click me 4 kaam:
//   1. CC user ko company se LINK (users doc → customerId + unitName)
//   2. customers record create/update — isLocalUnit = TRUE
//      (⚠️ RULE: is app me sirf EK local unit hoti hai —
//       baaki customers ka isLocalUnit auto FALSE ho jata hai)
//   3. users doc — role/designation sync
//   4. Monthly plan assign + is app pe APPLY (subscription/current)
// ═════════════════════════════════════════════════════════════
export interface CcUserLite {
  uid: string;
  name: string;
  email: string;
  customerId: string | null;
  unitName: string | null;
}

/** users collection se saare CC logins (developer chhoda ke) — quick setup dropdown ke liye */
export const listCcUsers = async (): Promise<CcUserLite[]> => {
  const snap = await getDocs(collection(db, 'users'));
  const out: CcUserLite[] = [];
  snap.forEach(d => {
    const u = d.data() as Record<string, unknown>;
    if (u['isDeveloper'] === true) return;
    if (String(u['role'] ?? '') !== 'Company Commander') return;
    out.push({
      uid: d.id,
      name: String(u['name'] ?? ''),
      email: String(u['email'] ?? ''),
      customerId: u['customerId'] != null ? String(u['customerId']) : null,
      unitName: u['unitName'] != null ? String(u['unitName']) : null,
    });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
};

export interface QuickSetupInput {
  ccUid: string;
  ccName: string;
  ccEmail: string;
  unitName: string; // e.g. 'A Coy (Alpha Company)'
  phone?: string;
}

export const setupFirstCompany = async (
  input: QuickSetupInput,
  plan: SubscriptionPlan,
  by: string,
): Promise<{ customerId: string; sub: UnitSubscription }> => {
  const now = new Date().toISOString();

  // 1. Is CC ka customer record pehle se hai?
  const custSnap = await getDocs(collection(db, CUSTOMERS_COL));
  let customerId: string | null = null;
  let customerDocId: string | null = null;
  const demoteOthers: Promise<unknown>[] = [];
  custSnap.forEach(d => {
    const c = d.data() as Customer;
    if (c.authUid === input.ccUid) {
      customerId = c.customerId;
      customerDocId = d.id;
    } else if (c.isLocalUnit === true) {
      // ⚠️ GOLDEN RULE: is app me sirf EK company ka ghar hai
      demoteOthers.push(
        setDoc(doc(db, CUSTOMERS_COL, d.id), { isLocalUnit: false }, { merge: true }),
      );
    }
  });
  if (!customerId) customerId = await nextCustomerId();
  await Promise.all(demoteOthers);

  // 2. customers record
  if (customerDocId) {
    await setDoc(doc(db, CUSTOMERS_COL, customerDocId), {
      unitName: input.unitName,
      commanderName: input.ccName,
      email: input.ccEmail,
      status: 'active',
      isLocalUnit: true, // 🏠 THIS UNIT
    }, { merge: true });
  } else {
    await setDoc(doc(db, CUSTOMERS_COL, input.ccUid), {
      customerId,
      unitName: input.unitName,
      commanderName: input.ccName,
      email: input.ccEmail,
      phone: input.phone ?? '',
      location: '',
      notes: '1st company — Owner quick setup',
      status: 'active',
      isLocalUnit: true, // 🏠 THIS UNIT
      authUid: input.ccUid,
      createdAt: now,
      createdBy: by,
    } satisfies Omit<Customer, 'id'>);
  }

  // 3. CC users doc LINK — SubscriptionContext isi customerId se uska plan dhundhta hai
  await setDoc(doc(db, 'users', input.ccUid), {
    customerId,
    unitName: input.unitName,
    designation: `Company Commander — ${input.unitName}`,
    role: 'Company Commander',
    isActive: true,
  }, { merge: true });

  // 4. Plan assign + IS APP PE APPLY (subscription/current turant set)
  const custWithSub: CustomerWithSub = {
    id: customerDocId ?? input.ccUid,
    customerId,
    unitName: input.unitName,
    commanderName: input.ccName,
    email: input.ccEmail,
    phone: input.phone ?? '',
    location: '',
    notes: '1st company — Owner quick setup',
    status: 'active',
    isLocalUnit: true,
    authUid: input.ccUid,
    createdAt: now,
    createdBy: by,
  };
  const sub = await assignPlanToCustomer(custWithSub, plan, by, {
    paymentMode: 'Owner Setup',
    paymentRef: 'FIRST-COMPANY-QUICK-SETUP',
    remarks: `Quick setup — ${input.unitName} is ${by} ki 1st company`,
    applyToUnit: true,
  });

  return { customerId, sub };
};

// ─────────────────────────────────────────────
// 🧪 MASTER = TESTING COMPANY (naya model)
// Master app (training-command-erp) me ab KOI real company nahi —
// yeh sirf Owner Panel + TEST-77 sandbox hai.
// Ye function: unitConfig rename + saare "THIS UNIT" flags hatata hai.
// Idempotent: jitni baar chalao, safe.
// ─────────────────────────────────────────────
export const makeMasterTestingCompany = async (): Promise<string> => {
  // 1. Letterhead -> TESTING COMPANY
  await setDoc(doc(db, 'unitConfig', 'main'), {
    parentUnit: 'INTERNAL (Owner Use Only)',
    companyName: 'MASTER COY',
    companyShort: 'MASTER',
    location: 'Sandbox',
    commanderName: 'Developer (Owner)',
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // 2. Koi bhi customer "THIS UNIT" mark nahi rahega
  const custSnap = await getDocs(query(collection(db, CUSTOMERS_COL), where('isLocalUnit', '==', true)));
  const ops: Promise<unknown>[] = [];
  custSnap.forEach(d => ops.push(
    setDoc(doc(db, CUSTOMERS_COL, d.id), { isLocalUnit: false }, { merge: true }),
  ));
  await Promise.all(ops);

  return `MASTER app ab MASTER COY ban gayi! Letterhead rename ho gaya + ${custSnap.size} "THIS UNIT" flag(s) remove. ` +
    `A Coy ab bilkul NORMAL company hai - jab uska sale aaye to apni alag app banegi (deploy kit se). ` +
    `Ek baar LOGOUT/LOGIN + hard refresh (Ctrl+Shift+R) kar lo - har jagah TESTING dikhega.`;
};

