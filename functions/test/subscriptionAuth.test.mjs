// ═══════════════════════════════════════════════════════════════════════
// SUBSCRIPTION SERVER-SIDE AUTHORITY — UNIT TESTS
// ───────────────────────────────────────────────────────────────────────
// Pure logic tests — no emulator, no Java, no network. Run with:
//   node --test functions/test/subscriptionAuth.test.mjs
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStatus,
  evaluateSubscription,
  verifyOwnerKey,
  hashOwnerKey,
  generateSalt,
  normalizeRenewInput,
  renewSubscriptionServerSide,
  assertSubscriptionAllows,
  SubscriptionError,
  GRACE_DAYS,
} from '../subscriptionAuth.mjs';

const iso = (d) => d.toISOString();
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const sub = (endDate, extra = {}) => ({
  planId: 'monthly', planName: 'Monthly', endDate, startDate: iso(daysFromNow(-60)), ...extra,
});

// ─────────────────────────────────────────────
// STATUS / BOUNDARY CASES
// ─────────────────────────────────────────────

test('expiry in the future → active', () => {
  assert.equal(computeStatus(sub(iso(daysFromNow(90)))), 'active');
});

test('expiry within 30 days → expiring (still allowed)', () => {
  assert.equal(computeStatus(sub(iso(daysFromNow(10)))), 'expiring');
});

test('just past expiry → grace (still allowed)', () => {
  assert.equal(computeStatus(sub(iso(daysFromNow(-1)))), 'grace');
});

test('past expiry but inside grace window → grace', () => {
  assert.equal(computeStatus(sub(iso(daysFromNow(-(GRACE_DAYS - 1))))), 'grace');
});

test('beyond the grace window → expired', () => {
  assert.equal(computeStatus(sub(iso(daysFromNow(-(GRACE_DAYS + 5))))), 'expired');
});

test('expiry exactly now → still inside the period (not expired)', () => {
  const now = new Date();
  assert.equal(computeStatus(sub(iso(now)), now), 'expiring');
});

test('missing subscription → none', () => {
  assert.equal(computeStatus(null), 'none');
  assert.equal(computeStatus(undefined), 'none');
  assert.equal(computeStatus({}), 'none');
});

test('malformed endDate FAILS CLOSED (treated as expired)', () => {
  assert.equal(computeStatus(sub('not-a-date')), 'expired');
  assert.equal(computeStatus(sub('')), 'none'); // no endDate at all = never configured
});

// ─────────────────────────────────────────────
// ENFORCEMENT DECISION
// ─────────────────────────────────────────────

test('active company is allowed', () => {
  assert.equal(evaluateSubscription(sub(iso(daysFromNow(90)))).allowed, true);
});

test('grace company is allowed (business policy: read+work during grace)', () => {
  assert.equal(evaluateSubscription(sub(iso(daysFromNow(-2)))).allowed, true);
});

test('EXPIRED company is DENIED', () => {
  const v = evaluateSubscription(sub(iso(daysFromNow(-(GRACE_DAYS + 10)))));
  assert.equal(v.allowed, false);
  assert.equal(v.status, 'expired');
  assert.match(v.reason, /expired/i);
});

test('malformed licence is DENIED (fail closed)', () => {
  assert.equal(evaluateSubscription(sub('garbage')).allowed, false);
});

test('unconfigured licence does not lock a working company out', () => {
  // Company deployments run with subscription disabled; blocking 'none'
  // would break every existing install. Deliberate, documented decision.
  assert.equal(evaluateSubscription(null).allowed, true);
});

test('denial reason never leaks internals', () => {
  const v = evaluateSubscription(sub(iso(daysFromNow(-999))));
  assert.doesNotMatch(v.reason, /firestore|admin|uid|hash|salt|stack/i);
});

// ─────────────────────────────────────────────
// FAIL-CLOSED ON READ FAILURE
// ─────────────────────────────────────────────

test('licence read failure FAILS CLOSED', async () => {
  const brokenDb = {
    collection: () => ({ doc: () => ({ get: async () => { throw new Error('network'); } }) }),
  };
  await assert.rejects(
    () => assertSubscriptionAllows(brokenDb),
    (e) => e instanceof SubscriptionError && e.code === 'failed-precondition',
  );
});

test('expired licence blocks a protected operation', async () => {
  const db = {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: true, data: () => sub(iso(daysFromNow(-999))) }) }),
    }),
  };
  await assert.rejects(
    () => assertSubscriptionAllows(db),
    (e) => e instanceof SubscriptionError && e.code === 'permission-denied',
  );
});

test('active licence permits a protected operation', async () => {
  const db = {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: true, data: () => sub(iso(daysFromNow(60))) }) }),
    }),
  };
  const v = await assertSubscriptionAllows(db);
  assert.equal(v.allowed, true);
});

// ─────────────────────────────────────────────
// OWNER KEY (server-side verification)
// ─────────────────────────────────────────────

test('correct owner key verifies', () => {
  const salt = generateSalt();
  const doc = { ownerKeyHash: hashOwnerKey('ABC123', salt), ownerKeySalt: salt };
  assert.equal(verifyOwnerKey('ABC123', doc), true);
});

test('owner key is case-insensitive and trimmed (matches client scheme)', () => {
  const salt = generateSalt();
  const doc = { ownerKeyHash: hashOwnerKey('ABC123', salt), ownerKeySalt: salt };
  assert.equal(verifyOwnerKey('  abc123 ', doc), true);
});

test('wrong owner key is rejected', () => {
  const salt = generateSalt();
  const doc = { ownerKeyHash: hashOwnerKey('ABC123', salt), ownerKeySalt: salt };
  assert.equal(verifyOwnerKey('WRONG', doc), false);
});

test('empty owner key is rejected', () => {
  const salt = generateSalt();
  const doc = { ownerKeyHash: hashOwnerKey('ABC123', salt), ownerKeySalt: salt };
  assert.equal(verifyOwnerKey('', doc), false);
  assert.equal(verifyOwnerKey(null, doc), false);
});

test('a licence with NO key configured rejects everything (fail closed)', () => {
  assert.equal(verifyOwnerKey('anything', {}), false);
});

test('legacy plaintext owner key still verifies (backward compatible)', () => {
  assert.equal(verifyOwnerKey('OLDKEY', { ownerKey: 'OLDKEY' }), true);
  assert.equal(verifyOwnerKey('nope', { ownerKey: 'OLDKEY' }), false);
});

// ─────────────────────────────────────────────
// CLIENT TAMPERING
// ─────────────────────────────────────────────

test('client cannot omit the owner key', () => {
  assert.throws(() => normalizeRenewInput({ planId: 'monthly' }), SubscriptionError);
});

test('client cannot omit the plan', () => {
  assert.throws(() => normalizeRenewInput({ ownerKey: 'K' }), SubscriptionError);
});

test('client-supplied dates/amount are ignored by the input normalizer', () => {
  const input = normalizeRenewInput({
    planId: 'monthly', ownerKey: 'K',
    endDate: '2099-12-31', amount: 0, durationMonths: 999, status: 'active',
  });
  assert.deepEqual(Object.keys(input).sort(),
    ['ownerKey', 'paymentMode', 'paymentRef', 'planId', 'remarks']);
});

// ─────────────────────────────────────────────
// RENEWAL (server authority)
// ─────────────────────────────────────────────

function fakeDb({ current, plan }) {
  const writes = [];
  const docStub = (path) => ({
    get: async () => {
      if (path === 'subscription/current') {
        return { exists: !!current, data: () => current };
      }
      return { exists: !!plan, data: () => plan };
    },
  });
  return {
    writes,
    collection: (name) => ({
      doc: (id) => docStub(name === 'subscription' ? 'subscription/current' : `${name}/${id}`),
    }),
    batch: () => ({
      set: (ref, data) => writes.push(data),
      commit: async () => {},
    }),
  };
}

const CALLER = { uid: 'ccUid' };

test('renewal with a WRONG owner key is denied', async () => {
  const salt = generateSalt();
  const db = fakeDb({
    current: sub(iso(daysFromNow(-5)), { ownerKeyHash: hashOwnerKey('RIGHT', salt), ownerKeySalt: salt }),
    plan: { name: 'Monthly', durationMonths: 1, price: 1499, isActive: true },
  });
  await assert.rejects(
    () => renewSubscriptionServerSide(db, CALLER,
      normalizeRenewInput({ planId: 'monthly', ownerKey: 'WRONG' })),
    (e) => e instanceof SubscriptionError && e.code === 'permission-denied',
  );
});

test('renewal computes dates on the SERVER, ignoring anything the client sent', async () => {
  const salt = generateSalt();
  const db = fakeDb({
    current: sub(iso(daysFromNow(-5)), { ownerKeyHash: hashOwnerKey('K', salt), ownerKeySalt: salt }),
    plan: { name: 'Monthly', durationMonths: 1, price: 1499, isActive: true },
  });
  const res = await renewSubscriptionServerSide(db, CALLER,
    normalizeRenewInput({ planId: 'monthly', ownerKey: 'K', endDate: '2099-12-31' }));
  const end = new Date(res.endDate);
  // One month out, nowhere near 2099.
  assert.ok(end.getFullYear() < new Date().getFullYear() + 2, `unexpected endDate ${res.endDate}`);
});

test('renewal takes duration from the SERVER plan document', async () => {
  const salt = generateSalt();
  const db = fakeDb({
    current: sub(iso(daysFromNow(-5)), { ownerKeyHash: hashOwnerKey('K', salt), ownerKeySalt: salt }),
    plan: { name: 'Yearly', durationMonths: 12, price: 11999, isActive: true },
  });
  const res = await renewSubscriptionServerSide(db, CALLER,
    normalizeRenewInput({ planId: 'yearly', ownerKey: 'K' }));
  const months = (new Date(res.endDate).getFullYear() - new Date().getFullYear()) * 12
    + (new Date(res.endDate).getMonth() - new Date().getMonth());
  assert.ok(months >= 11 && months <= 13, `expected ~12 months, got ${months}`);
});

test('a plan with an absurd duration is rejected', async () => {
  const salt = generateSalt();
  const db = fakeDb({
    current: sub(iso(daysFromNow(-5)), { ownerKeyHash: hashOwnerKey('K', salt), ownerKeySalt: salt }),
    plan: { name: 'Evil', durationMonths: 9999, price: 0, isActive: true },
  });
  await assert.rejects(
    () => renewSubscriptionServerSide(db, CALLER,
      normalizeRenewInput({ planId: 'evil', ownerKey: 'K' })),
    (e) => e instanceof SubscriptionError && e.code === 'invalid-argument',
  );
});

test('an inactive plan cannot be renewed onto', async () => {
  const salt = generateSalt();
  const db = fakeDb({
    current: sub(iso(daysFromNow(-5)), { ownerKeyHash: hashOwnerKey('K', salt), ownerKeySalt: salt }),
    plan: { name: 'Retired', durationMonths: 1, price: 0, isActive: false },
  });
  await assert.rejects(
    () => renewSubscriptionServerSide(db, CALLER,
      normalizeRenewInput({ planId: 'retired', ownerKey: 'K' })),
    (e) => e instanceof SubscriptionError && e.code === 'invalid-argument',
  );
});

test('renewal rotates the owner key so the old one cannot be replayed', async () => {
  const salt = generateSalt();
  const db = fakeDb({
    current: sub(iso(daysFromNow(-5)), { ownerKeyHash: hashOwnerKey('K', salt), ownerKeySalt: salt }),
    plan: { name: 'Monthly', durationMonths: 1, price: 1499, isActive: true },
  });
  const res = await renewSubscriptionServerSide(db, CALLER,
    normalizeRenewInput({ planId: 'monthly', ownerKey: 'K' }));
  assert.ok(res.nextOwnerKey && res.nextOwnerKey.length >= 8);
  assert.notEqual(res.nextOwnerKey, 'K');

  const written = db.writes.find(w => w.planId);
  assert.equal(verifyOwnerKey('K', written), false, 'old key must stop working');
  assert.equal(verifyOwnerKey(res.nextOwnerKey, written), true, 'new key must work');
});

test('renewal never returns the stored hash or salt', async () => {
  const salt = generateSalt();
  const db = fakeDb({
    current: sub(iso(daysFromNow(-5)), { ownerKeyHash: hashOwnerKey('K', salt), ownerKeySalt: salt }),
    plan: { name: 'Monthly', durationMonths: 1, price: 1499, isActive: true },
  });
  const res = await renewSubscriptionServerSide(db, CALLER,
    normalizeRenewInput({ planId: 'monthly', ownerKey: 'K' }));
  assert.equal(res.ownerKeyHash, undefined);
  assert.equal(res.ownerKeySalt, undefined);
});

test('renewal writes an immutable history entry', async () => {
  const salt = generateSalt();
  const db = fakeDb({
    current: sub(iso(daysFromNow(-5)), { ownerKeyHash: hashOwnerKey('K', salt), ownerKeySalt: salt }),
    plan: { name: 'Monthly', durationMonths: 1, price: 1499, isActive: true },
  });
  await renewSubscriptionServerSide(db, CALLER,
    normalizeRenewInput({ planId: 'monthly', ownerKey: 'K' }));
  const history = db.writes.find(w => w.action === 'RENEWED');
  assert.ok(history, 'history entry must be written');
  assert.equal(history.by, 'ccUid');
  assert.ok(history.at);
});

test('renewing an unexpired licence keeps the remaining days', async () => {
  const salt = generateSalt();
  const futureEnd = iso(daysFromNow(20));
  const db = fakeDb({
    current: sub(futureEnd, { ownerKeyHash: hashOwnerKey('K', salt), ownerKeySalt: salt }),
    plan: { name: 'Monthly', durationMonths: 1, price: 1499, isActive: true },
  });
  const res = await renewSubscriptionServerSide(db, CALLER,
    normalizeRenewInput({ planId: 'monthly', ownerKey: 'K' }));
  // New end must be ~1 month AFTER the old end, not after today.
  assert.ok(new Date(res.endDate) > new Date(futureEnd));
});

test('renewal is impossible when no licence exists at all', async () => {
  const db = fakeDb({ current: null, plan: { name: 'M', durationMonths: 1, price: 1, isActive: true } });
  await assert.rejects(
    () => renewSubscriptionServerSide(db, CALLER,
      normalizeRenewInput({ planId: 'monthly', ownerKey: 'K' })),
    (e) => e instanceof SubscriptionError && e.code === 'failed-precondition',
  );
});
