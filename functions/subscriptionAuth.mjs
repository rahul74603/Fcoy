// ═══════════════════════════════════════════════════════════════════════
// SUBSCRIPTION — SERVER-SIDE AUTHORITY
// ───────────────────────────────────────────────────────────────────────
// Pehle subscription poori tarah client-side thi:
//   • SubscriptionGate.tsx ek React component tha jo lock screen dikhata tha
//   • firestore.rules me `allow write: if isCC()` tha
//
// Dono milkar ek asli bypass bante the: Company Commander wahi banda hai
// jiski licence ye document control karta hai. Wo browser console se
// seedhe `endDate: 2099` likh sakta tha aur khud ko unlimited free licence
// de sakta tha. Owner key se koi fayda nahi tha — Firestore ne wo key kabhi
// dekhi hi nahi, wo sirf React state me check hoti thi.
//
// Ab:
//   • rules har client write mana karte hain
//   • renewal SIRF is module ke through hota hai (Admin SDK)
//   • owner key SERVER par verify hoti hai
//   • dates SERVER par calculate hoti hain — client se kabhi nahi li jaatin
//
// TENANCY NOTE: is project me `companyId` nahi hai. Har company ka apna
// alag Firebase project hota hai, isliye cross-company isolation project
// boundary se aati hai, rules se nahi. Yahan "company" = ye project.
// ═══════════════════════════════════════════════════════════════════════

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Grace period — client ke `GRACE_DAYS` se match karta hai. */
export const GRACE_DAYS = 30;

/** Jo statuses protected likhne ki ijazat dete hain. */
const WRITE_ALLOWED_STATUSES = new Set(['active', 'expiring', 'grace']);

export class SubscriptionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ─────────────────────────────────────────────
// OWNER KEY (server-side)
// ─────────────────────────────────────────────
// Client ke `hashOwnerKey` jaisa hi scheme, taaki purane documents chalte
// rahein: SHA-256 over `fcoy-owner:{salt}:{KEY_UPPERCASED}`.

export function hashOwnerKey(key, salt) {
  const normalized = String(key ?? '').trim().toUpperCase();
  return createHash('sha256')
    .update(`fcoy-owner:${salt}:${normalized}`, 'utf8')
    .digest('hex');
}

export function generateSalt() {
  return randomBytes(16).toString('hex');
}

/** Timing-safe hex compare — key guess karna aur mushkil ho jaata hai. */
function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Owner key verify karo — SERVER par.
 * Naya hashed scheme aur legacy plaintext dono support karta hai.
 */
export function verifyOwnerKey(presented, sub) {
  const candidate = String(presented ?? '').trim().toUpperCase();
  if (!candidate) return false;

  if (sub?.ownerKeyHash && sub?.ownerKeySalt) {
    return safeEqualHex(hashOwnerKey(candidate, sub.ownerKeySalt), sub.ownerKeyHash);
  }
  // Legacy plaintext — purane documents ke liye.
  if (sub?.ownerKey) return safeEqualHex(String(sub.ownerKey).toUpperCase(), candidate);

  // Na hash, na plaintext — koi key set hi nahi hai. FAIL CLOSED.
  return false;
}

// ─────────────────────────────────────────────
// STATE COMPUTATION (client ke computeSubscriptionState ka mirror)
// ─────────────────────────────────────────────

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Subscription document se status nikalo.
 * Client ki `computeSubscriptionState` se jaan-boojhkar same rakha gaya hai
 * taaki UI aur server ek hi baat kahein.
 *
 * Returns: 'none' | 'active' | 'expiring' | 'grace' | 'expired'
 */
export function computeStatus(sub, now = new Date()) {
  if (!sub || !sub.endDate || !sub.planId) return 'none';

  const end = new Date(sub.endDate);
  // Malformed date = bharosa nahi. FAIL CLOSED.
  if (Number.isNaN(end.getTime())) return 'expired';

  if (now <= end) {
    const msDay = 86400000;
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / msDay);
    return daysLeft <= 30 ? 'expiring' : 'active';
  }

  const graceEnd = new Date(end);
  graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);
  if (now <= graceEnd) return 'grace';

  return 'expired';
}

// ─────────────────────────────────────────────
// ENFORCEMENT
// ─────────────────────────────────────────────

/**
 * Protected company operation ke liye licence valid hai ya nahi.
 *
 * FAIL-CLOSED: agar document padha na ja sake, ya malformed ho, to access
 * NAHI milta. Lekin 'none' ek alag maamla hai — jab tak owner ne pehli baar
 * plan set nahi kiya, subscription system practically band hota hai
 * (company deployments me VITE_SUBSCRIPTION_ENABLED bhi false rehta hai).
 * Isliye 'none' ko block karna existing kaam karti hui companies ko tod
 * dega. Ye jaan-boojhkar liya gaya decision hai, guess nahi.
 *
 * @returns {{ allowed: boolean, status: string, reason: string }}
 */
export function evaluateSubscription(sub, now = new Date()) {
  const status = computeStatus(sub, now);

  if (status === 'none') {
    return {
      allowed: true,
      status,
      reason: 'No licence configured — subscription enforcement not in effect.',
    };
  }

  if (WRITE_ALLOWED_STATUSES.has(status)) {
    return { allowed: true, status, reason: '' };
  }

  return {
    allowed: false,
    status,
    reason: 'Company licence expired. Renew karke dobara koshish karo.',
  };
}

/**
 * Firestore se licence padho aur enforce karo.
 * Read fail hua to FAIL CLOSED — protected operation ruk jaata hai.
 */
export async function assertSubscriptionAllows(adminDb, now = new Date()) {
  let snap;
  try {
    snap = await adminDb.collection('subscription').doc('current').get();
  } catch {
    throw new SubscriptionError(
      'failed-precondition',
      'Licence verify nahi ho paayi. Thodi der baad koshish karo.',
    );
  }

  const sub = snap.exists ? snap.data() : null;
  const verdict = evaluateSubscription(sub, now);

  if (!verdict.allowed) {
    throw new SubscriptionError('permission-denied', verdict.reason);
  }
  return verdict;
}

// ─────────────────────────────────────────────
// RENEWAL (Admin SDK — rules bypass hote hain, isliye validation yahin)
// ─────────────────────────────────────────────

/**
 * Renewal input validate karo.
 * Client sirf ye bhej sakta hai: planId, ownerKey, payment details.
 * Dates, amount aur plan ki duration SERVER plan document se aate hain —
 * client se kabhi nahi. Warna koi bhi 120-mahine ka "plan" bhej deta.
 */
export function normalizeRenewInput(data) {
  const d = data || {};
  const planId = String(d.planId ?? '').trim();
  const ownerKey = String(d.ownerKey ?? '');

  if (!planId) throw new SubscriptionError('invalid-argument', 'Plan choose karo.');
  if (!ownerKey.trim()) throw new SubscriptionError('invalid-argument', 'Owner key daalo.');

  return {
    planId,
    ownerKey,
    paymentMode: String(d.paymentMode ?? '').trim().slice(0, 40),
    paymentRef: String(d.paymentRef ?? '').trim().slice(0, 120),
    remarks: String(d.remarks ?? '').trim().slice(0, 500),
  };
}

/**
 * Licence renew karo — server par.
 *
 * Security properties:
 *   • owner key server par verify hoti hai (client ka jhooth bekaar)
 *   • plan aur uski duration Firestore ke plan doc se aati hai
 *   • startDate/endDate server clock se bante hain
 *   • amount plan se aata hai, client se nahi
 *   • history entry likhna is flow ka hissa hai, optional nahi
 */
export async function renewSubscriptionServerSide(adminDb, caller, input, now = new Date()) {
  const subRef = adminDb.collection('subscription').doc('current');
  const snap = await subRef.get();
  const current = snap.exists ? snap.data() : null;

  // ── Owner key ──
  // Agar abhi tak koi licence hi nahi hai to koi key set nahi hui — pehli
  // baar activation setup wizard se hota hai, yahan se nahi.
  if (!current) {
    throw new SubscriptionError(
      'failed-precondition',
      'Abhi koi licence set nahi hai. Pehli baar activation App Owner karta hai.',
    );
  }
  if (!verifyOwnerKey(input.ownerKey, current)) {
    throw new SubscriptionError('permission-denied', 'Owner key galat hai.');
  }

  // ── Plan (server-side source of truth) ──
  const planSnap = await adminDb.collection('subscriptionPlans').doc(input.planId).get();
  if (!planSnap.exists) {
    throw new SubscriptionError('invalid-argument', 'Ye plan maujood nahi hai.');
  }
  const plan = planSnap.data() || {};
  const durationMonths = Number(plan.durationMonths);
  if (!Number.isFinite(durationMonths) || durationMonths <= 0 || durationMonths > 60) {
    throw new SubscriptionError('invalid-argument', 'Plan ki duration galat hai.');
  }
  if (plan.isActive === false) {
    throw new SubscriptionError('invalid-argument', 'Ye plan ab available nahi hai.');
  }

  // ── Dates: SERVER clock. Bache hue din barbaad nahi hote. ──
  const prevEnd = current?.endDate ? new Date(current.endDate) : null;
  const start = prevEnd && !Number.isNaN(prevEnd.getTime()) && prevEnd > now ? prevEnd : now;
  const end = addMonths(start, durationMonths);

  // ── Owner key rotate karo taaki purani key dobara na chale ──
  const salt = generateSalt();
  const rotatedKey = randomBytes(6).toString('hex').toUpperCase();

  const sub = {
    planId: input.planId,
    planName: String(plan.name ?? input.planId),
    durationMonths,
    amount: Number(plan.price) || 0,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    // Machine-readable mirror of endDate. Firestore rules cannot parse an
    // ISO string into a timestamp (no Date.parse equivalent), so the rules
    // compare this epoch-ms field against request.time.toMillis() to decide
    // whether an expired company is read-only. endDate stays the UI field;
    // both are always written together, server-side.
    endMillis: end.getTime(),
    paymentMode: input.paymentMode,
    paymentRef: input.paymentRef,
    remarks: input.remarks,
    updatedAt: now.toISOString(),
    updatedBy: caller.uid,
    ownerKeyHash: hashOwnerKey(rotatedKey, salt),
    ownerKeySalt: salt,
  };

  const historyRef = adminDb.collection('subscriptionHistory').doc();
  const batch = adminDb.batch();
  batch.set(subRef, sub);
  batch.set(historyRef, {
    action: 'RENEWED',
    planId: sub.planId,
    planName: sub.planName,
    amount: sub.amount,
    startDate: sub.startDate,
    endDate: sub.endDate,
    remarks: input.remarks || input.paymentRef || '',
    by: caller.uid,
    at: now.toISOString(),
  });
  await batch.commit();

  // Nayi key SIRF is ek response me return hoti hai — kahin readable nahi.
  return {
    planId: sub.planId,
    planName: sub.planName,
    startDate: sub.startDate,
    endDate: sub.endDate,
    nextOwnerKey: rotatedKey,
  };
}

/**
 * endMillis backfill.
 *
 * Licences written before the read-only-degradation change have endDate but
 * no endMillis. licenceWritable() treats a missing endMillis as "cannot
 * evaluate → allow", so such a company keeps working (fail-open by design —
 * clients cannot write subscription/current anyway, so the field cannot be
 * stripped to unlock writes). This backfill turns enforcement on for those
 * documents without waiting for the next renewal.
 *
 * Idempotent: if endMillis is already present and correct, nothing happens.
 */
export async function backfillEndMillis(adminDb) {
  const ref = adminDb.collection('subscription').doc('current');
  const snap = await ref.get();
  if (!snap.exists) return { updated: false, reason: 'no licence document' };

  const data = snap.data() || {};
  if (typeof data.endMillis === 'number') {
    return { updated: false, reason: 'already present' };
  }
  if (!data.endDate) return { updated: false, reason: 'no endDate to convert' };

  const ms = new Date(data.endDate).getTime();
  if (Number.isNaN(ms)) return { updated: false, reason: 'endDate is malformed' };

  await ref.set({ endMillis: ms }, { merge: true });
  return { updated: true, endMillis: ms };
}
