// ═══════════════════════════════════════════════════════════════════════
// Unit tests for staff provisioning authorization/validation logic.
// Pure Node — Admin SDK is mocked so no emulator is required. The live
// callable (CC-only through the emulator) is exercised separately by
// staffProvisioning.runtime.test.mjs against a running emulator.
// Run: node test/staffProvisioning.test.mjs
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import {
  assertCallerIsCommander, normalizeStaffInput, provisionStaff, ProvisioningError,
} from '../staffProvisioning.mjs';

let passed = 0;
const tests = [];
const t = (name, fn) => tests.push({ name, fn });

async function main() {
  for (const { name, fn } of tests) {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  }
  console.log(`\nSTAFF PROVISIONING UNIT TESTS: ${passed} passed, 0 failed`);
}
const cc = { uid: 'ccUid', role: 'Company Commander', isActive: true };
const makeAdmin = (failProfileWrite = false) => {
  const created = [];
  const deleted = [];
  const profiles = new Map();
  const auth = {
    async createUser({ email, password, displayName }) {
      if (email === 'dup@x.com') {
        const e = new Error('email exists'); e.code = 'auth/email-already-exists'; throw e;
      }
      const uid = 'u' + (created.length + 1);
      created.push({ uid, email, password, displayName });
      return { uid };
    },
    async deleteUser(uid) { deleted.push(uid); },
  };
  const db = {
    collection() {
      return {
        doc(uid) {
          return {
            async set(data) {
              if (failProfileWrite) throw new Error('firestore down');
              profiles.set(uid, data);
            },
          };
        },
      };
    },
  };
  return { auth, db, created, deleted, profiles };
};

// ── caller authorization ──
t('CC active caller is authorized', () => {
  assert.doesNotThrow(() => assertCallerIsCommander(cc));
});
t('missing profile denied', () => {
  assert.throws(() => assertCallerIsCommander(null), /not found/);
});
t('deactivated CC denied', () => {
  assert.throws(() => assertCallerIsCommander({ ...cc, isActive: false }), /deactivated/);
});
for (const role of ['Clerk', 'Quarter Master', 'Ustad', 'Senior Officer / Inspector']) {
  t(`${role} caller is denied`, () => {
    assert.throws(() => assertCallerIsCommander({ role, isActive: true }), /Company Commander/);
  });
}

// ── input validation ──
t('valid CC-created Clerk input normalized; isDeveloper not accepted', () => {
  const r = normalizeStaffInput({ name: 'A', email: 'A@X.COM', password: 'secret1', role: 'Clerk', isDeveloper: true });
  assert.equal(r.email, 'a@x.com');
  assert.equal(r.role, 'Clerk');
  assert.equal(r.assignedBatchIds.length, 0);
  assert.ok(!('isDeveloper' in r)); // never carried through
});
t('invalid role rejected (privilege escalation attempt)', () => {
  assert.throws(() => normalizeStaffInput({ name: 'A', email: 'a@x.com', password: 'secret1', role: 'SuperAdmin' }), /Invalid role/);
});
t('SO gets assignedBatchIds; other roles get empty array', () => {
  const so = normalizeStaffInput({ name: 'A', email: 'a@x.com', password: 'secret1', role: 'Senior Officer / Inspector', assignedBatchIds: ['b1', 'b2'] });
  assert.deepEqual(so.assignedBatchIds, ['b1', 'b2']);
  const clerk = normalizeStaffInput({ name: 'A', email: 'a@x.com', password: 'secret1', role: 'Clerk', assignedBatchIds: ['b1'] });
  assert.deepEqual(clerk.assignedBatchIds, []); // ignored for non-SO
});
t('SO assignedBatchIds coerced to strings only', () => {
  const so = normalizeStaffInput({ name: 'A', email: 'a@x.com', password: 'secret1', role: 'Senior Officer / Inspector', assignedBatchIds: ['b1', 2, { evil: true }, ''] });
  assert.deepEqual(so.assignedBatchIds, ['b1', '2', '[object Object]']);
});
t('missing/short password rejected', () => {
  assert.throws(() => normalizeStaffInput({ name: 'A', email: 'a@x.com', password: '123', role: 'Clerk' }), /at least 6/);
});
t('bad email rejected', () => {
  assert.throws(() => normalizeStaffInput({ name: 'A', email: 'nope', password: 'secret1', role: 'Clerk' }), /valid email/);
});
t('missing name rejected', () => {
  assert.throws(() => normalizeStaffInput({ email: 'a@x.com', password: 'secret1', role: 'Clerk' }), /Name/);
});

// ── provisioning end to end (mocked admin) ──
t('CC provisions a Clerk: auth user + safe profile (isDeveloper forced false, no customerId)', async () => {
  const admin = makeAdmin();
  const input = normalizeStaffInput({ name: 'N', email: 'n@x.com', password: 'secret1', role: 'Clerk', customerId: 'other-company', isDeveloper: true });
  const res = await provisionStaff(admin.auth, admin.db, { uid: 'ccUid' }, input);
  assert.equal(admin.created.length, 1);
  assert.equal(res.email, 'n@x.com');
  const profile = admin.profiles.get(res.uid);
  assert.equal(profile.role, 'Clerk');
  assert.equal(profile.isActive, true);
  assert.equal(profile.isDeveloper, false);           // forced false
  assert.equal('customerId' in profile, false);         // never from client
  assert.equal(profile.createdBy, 'ccUid');
});
t('duplicate email -> already-exists, nothing created twice', async () => {
  const admin = makeAdmin();
  const input = normalizeStaffInput({ name: 'D', email: 'dup@x.com', password: 'secret1', role: 'Clerk' });
  await assert.rejects(() => provisionStaff(admin.auth, admin.db, { uid: 'ccUid' }, input), (e) => e.code === 'already-exists');
  assert.equal(admin.profiles.size, 0);
});
t('profile write failure rolls back the orphan auth account', async () => {
  const admin = makeAdmin(true); // firestore set throws
  const input = normalizeStaffInput({ name: 'N', email: 'n@x.com', password: 'secret1', role: 'Clerk' });
  await assert.rejects(() => provisionStaff(admin.auth, admin.db, { uid: 'ccUid' }, input), /create nahi/);
  assert.equal(admin.deleted.length, 1);                 // orphan removed
  assert.equal(admin.profiles.size, 0);
});



// run after all tests above have registered
main().catch((e) => { console.error('TEST FAILURE:', e); process.exit(1); });
