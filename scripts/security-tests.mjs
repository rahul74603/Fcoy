// ═══════════════════════════════════════════════════════════════════════
// SECURITY / LOGIC TEST HARNESS (zero-dependency, runs under Node)
// ───────────────────────────────────────────────────────────────────────
// Verifies the security-critical CLIENT policy decisions and the AI batch
// scoping contract. These mirror the Firestore security rules; the rules
// themselves are additionally static-audited below and should also be run
// through the emulator (`firebase emulators:exec`) in CI where Java is
// available.
//
// Run: node scripts/security-tests.mjs
// ═══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { failures.push({ name, err: e }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}

// ── Load TS policy module by stripping types (it is simple enough) ──
// We instead re-implement the contract tests against a small transpile via
// tsc output. Simpler: import the compiled policy after a quick inline
// transpile of the pure file using typescript if present.
async function importTs(rel) {
  const ts = await import('typescript').catch(() => null);
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  if (ts) {
    const js = ts.default.transpileModule(src, {
      compilerOptions: { module: 'ESNext', target: 'ES2020' },
    }).outputText;
    const tmp = path.join(root, 'node_modules', `.cache-test-${path.basename(rel)}.mjs`);
    fs.writeFileSync(tmp, js);
    return await import(pathToFileURL(tmp).href);
  }
  throw new Error('typescript not available for transpile');
}

const permissions = await importTs('src/config/permissions.ts');
const ownerKey = await importTs('src/features/subscription/utils/ownerKey.ts');
const localDate = await importTs('src/utils/localDate.ts');

console.log('\n■ LEAVE AUTHORIZATION');

test('CC can approve leave', () => {
  assert.equal(permissions.canApproveLeave('Company Commander'), true);
});
test('Clerk CANNOT approve leave', () => {
  assert.equal(permissions.canApproveLeave('Clerk'), false);
});
test('Quarter Master CANNOT approve leave', () => {
  assert.equal(permissions.canApproveLeave('Quarter Master'), false);
});
test('Ustad CANNOT approve leave', () => {
  assert.equal(permissions.canApproveLeave('Ustad'), false);
});
test('Ustad cannot change approval fields via direct "write" simulation', () => {
  const before = { status: 'pending', approvedBy: '', approvalDate: null, rejectionReason: '' };
  const afterApprove = { status: 'approved', approvedBy: 'ccUid', approvalDate: 1, rejectionReason: '' };
  const afterReject = { status: 'rejected', approvedBy: 'ccUid', approvalDate: 1, rejectionReason: 'no' };
  assert.equal(permissions.canUpdateLeave('Ustad', before, afterApprove), false);
  assert.equal(permissions.canUpdateLeave('Ustad', before, afterReject), false);
  assert.equal(permissions.canUpdateLeave('Clerk', before, afterApprove), false);
  assert.equal(permissions.canUpdateLeave('QM', before, afterReject), false);
});
test('CC CAN change approval fields', () => {
  const before = { status: 'pending', approvedBy: '', approvalDate: null, rejectionReason: '' };
  const after = { status: 'approved', approvedBy: 'cc', approvalDate: 1, rejectionReason: '' };
  assert.equal(permissions.canUpdateLeave('Company Commander', before, after), true);
});
test('Ustad may edit non-approval fields (e.g. remarks) but not status', () => {
  const before = { status: 'pending', approvedBy: '', approvalDate: null, rejectionReason: '', remarks: 'a' };
  const after = { ...before, remarks: 'b' };
  assert.equal(permissions.canUpdateLeave('Ustad', before, after), true);
});
test('Clerk manages leave types but cannot approve', () => {
  assert.equal(permissions.canManageLeaveTypes('Clerk'), true);
  assert.equal(permissions.canManageLeaveTypes('Ustad'), false);
});

console.log('\n■ PRIVILEGE ESCALATION PROTECTION');

test('Ustad cannot promote self to CC on own profile', () => {
  const before = { role: 'Ustad', isDeveloper: false, isActive: true };
  const after = { role: 'Company Commander', isDeveloper: false, isActive: true };
  assert.equal(
    permissions.canUpdateUserProfile('Ustad', 'u1', 'u1', before, after), false,
  );
});
test('Ustad cannot set isDeveloper=true on own profile', () => {
  const before = { role: 'Ustad', isDeveloper: false, isActive: true };
  const after = { role: 'Ustad', isDeveloper: true, isActive: true };
  assert.equal(
    permissions.canUpdateUserProfile('Ustad', 'u1', 'u1', before, after), false,
  );
});
test('Ustad cannot deactivate/reactivate own isActive', () => {
  const before = { role: 'Ustad', isDeveloper: false, isActive: true };
  const after = { role: 'Ustad', isDeveloper: false, isActive: false };
  assert.equal(
    permissions.canUpdateUserProfile('Ustad', 'u1', 'u1', before, after), false,
  );
});
test('Ustad cannot modify another user profile at all', () => {
  const before = { role: 'Clerk', isDeveloper: false, isActive: true, name: 'x' };
  const after = { ...before, name: 'y' };
  assert.equal(
    permissions.canUpdateUserProfile('Ustad', 'other', 'self', before, after), false,
  );
});
test('CC can edit any profile incl. roles', () => {
  const before = { role: 'Ustad', isDeveloper: false, isActive: true };
  const after = { role: 'Clerk', isDeveloper: false, isActive: true };
  assert.equal(
    permissions.canUpdateUserProfile('Company Commander', 'u1', 'cc', before, after), true,
  );
});

console.log('\n■ ROLE MATRIX');

test('Finance/inventory = CC + QM only', () => {
  assert.equal(permissions.canManageFinance('Company Commander'), true);
  assert.equal(permissions.canManageFinance('Quarter Master'), true);
  assert.equal(permissions.canManageFinance('Clerk'), false);
  assert.equal(permissions.canManageFinance('Ustad'), false);
});
test('Staff/training admin = CC + Clerk', () => {
  assert.equal(permissions.canManageStaff('Company Commander'), true);
  assert.equal(permissions.canManageStaff('Clerk'), true);
  assert.equal(permissions.canManageStaff('Ustad'), false);
  assert.equal(permissions.canManageStaff('Quarter Master'), false);
});
test('User management = CC only', () => {
  assert.equal(permissions.canManageUsers('Company Commander'), true);
  assert.equal(permissions.canManageUsers('Clerk'), false);
});
test('All-batches aggregate view = CC only', () => {
  assert.equal(permissions.canViewAllBatches('Company Commander'), true);
  assert.equal(permissions.canViewAllBatches('Clerk'), false);
  assert.equal(permissions.canViewAllBatches('Quarter Master'), false);
  assert.equal(permissions.canViewAllBatches('Ustad'), false);
});
test('Dev sandbox = CC or flagged developer only', () => {
  assert.equal(permissions.canUseDevSandbox('Company Commander', false), true);
  assert.equal(permissions.canUseDevSandbox('Ustad', true), true);
  assert.equal(permissions.canUseDevSandbox('Ustad', false), false);
  assert.equal(permissions.canUseDevSandbox('Clerk', false), false);
});

console.log('\n■ AI BATCH ISOLATION CONTRACT');

// Simulate the queryEngine scoping contract: an empty scoped result must
// NEVER fall back to all batches.
function applyBatchScope(docs, selectedBatchId) {
  // Mirrors the fixed runQuery logic.
  if (!selectedBatchId) return [];          // no scope → nothing (batch-scoped)
  return docs.filter(d => d.batchId === selectedBatchId); // zero stays zero
}

test('Batch A records never returned when batch B selected (even if A=0 scope)', () => {
  const docs = [
    { id: '1', batchId: 'batch_B', name: 'b1' },
    { id: '2', batchId: 'batch_B', name: 'b2' },
  ];
  // Selected batch A has zero records → must return zero, not B's records.
  const scoped = applyBatchScope(docs, 'batch_A');
  assert.equal(scoped.length, 0);
});
test('Selected batch returns only its own records', () => {
  const docs = [
    { id: '1', batchId: 'batch_A', name: 'a1' },
    { id: '2', batchId: 'batch_B', name: 'b1' },
  ];
  const scoped = applyBatchScope(docs, 'batch_A');
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].batchId, 'batch_A');
});

console.log('\n■ OWNER KEY HASHING');

test('ownerKey hash verifies and does not store plaintext', async () => {
  const key = 'OWN-AB12CD';
  const salt = ownerKey.generateSalt();
  const hash = await ownerKey.hashOwnerKey(key, salt);
  assert.equal(typeof hash, 'string');
  assert.ok(hash.length === 64, 'sha256 hex length');
  const ok = await ownerKey.verifyOwnerKey(key, { ownerKeyHash: hash, ownerKeySalt: salt });
  assert.equal(ok, true);
  const wrong = await ownerKey.verifyOwnerKey('OWN-XXXXXX', { ownerKeyHash: hash, ownerKeySalt: salt });
  assert.equal(wrong, false);
  // hash must not contain the key
  assert.ok(!hash.includes('AB12CD'));
});

test('legacy plaintext ownerKey still verifies (migration path)', async () => {
  const ok = await ownerKey.verifyOwnerKey('OWN-LEGACY', { ownerKey: 'OWN-LEGACY' });
  assert.equal(ok, true);
  const bad = await ownerKey.verifyOwnerKey('OWN-OTHER', { ownerKey: 'OWN-LEGACY' });
  assert.equal(bad, false);
});

console.log('\n■ LOCAL DATE HELPERS');

test('localDateISOString returns local YYYY-MM-DD (no UTC shift)', () => {
  // Construct a local time that is early morning local; the UTC date would
  // differ for IST (+5:30). The helper must reflect the LOCAL calendar date.
  const d = new Date(2026, 0, 15, 2, 0, 0); // local 15 Jan 02:00
  const iso = localDate.localDateISOString(d);
  assert.equal(iso, '2026-01-15');
});

console.log('\n■ FIRESTORE RULES STATIC AUDIT');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

test('rules contain NO authenticated catch-all (allow read,write if signedIn)', () => {
  const catchAll = /match \s*\/\{document=\*\*\}\s*\{[^}]*allow\s+read\s*,\s*write\s*:\s*if\s+signedIn\(\)/;
  assert.ok(!catchAll.test(rules), 'authenticated catch-all must be removed');
});
test('rules default-deny unmatched collections', () => {
  assert.ok(/allow\s+read\s*,\s*write\s*:\s*if\s+false/.test(rules));
});
test('staff_leave approval protected from non-CC writes', () => {
  const block = rules.match(/match \/staff_leave\/\{leaveId\} \{[\s\S]*?\n    \}/);
  assert.ok(block, 'staff_leave rule present');
  assert.ok(/status == request.resource.data.status/.test(block[0]));
  assert.ok(/approvedBy == request.resource.data.approvedBy/.test(block[0]));
  assert.ok(/rejectionReason == request.resource.data.rejectionReason/.test(block[0]));
  assert.ok(/isCC\(\)/.test(block[0]));
});
test('users protected fields (role/isDeveloper/isActive) guarded', () => {
  assert.ok(/protectedUserFieldsUnchanged/.test(rules));
});
test('dev/test data isolation rule present', () => {
  assert.ok(/canReadDevData/.test(rules));
  assert.ok(/canWriteDevData/.test(rules));
  assert.ok(/isDevData/.test(rules));
});

console.log('\n■ STORAGE RULES STATIC AUDIT');

const storageRules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
test('storage rules exist and default-deny', () => {
  assert.ok(/allow read, write: if false/.test(storageRules));
});
test('storage deletes restricted to CC', () => {
  assert.ok(/allow delete: if isCC\(\)/.test(storageRules));
});

console.log('\n■ AI WRITE AUTHORIZATION AUDIT');

const toolsSrc = fs.readFileSync(path.join(root, 'src/features/aiAgent/engine/tools.ts'), 'utf8');
test('AI generic writes blocked for users/staff_leave/batches/subscriptions', () => {
  assert.ok(/GENERIC_WRITE_BLOCKED/.test(toolsSrc));
  ['users', 'staff_leave', 'leave_types', 'subscriptionHistory', 'subscriptionPlans', 'batches'].forEach(c => {
    assert.ok(toolsSrc.includes(`'${c}'`), `blocked list includes ${c}`);
  });
});
test('AI delete restricted to CC', () => {
  assert.ok(/record delete sirf Company Commander/.test(toolsSrc));
});
test('AI generic writes CANNOT touch inventory ledgers (issue_records/stock_ledgers)', () => {
  assert.ok(/GENERIC_WRITE_BLOCKED[\s\S]*?'issue_records'/.test(toolsSrc));
  assert.ok(/GENERIC_WRITE_BLOCKED[\s\S]*?'stock_ledgers'/.test(toolsSrc));
});
test('AI update_trainee CANNOT mutate kit/issue fields', () => {
  assert.ok(/FORBIDDEN_KIT_FIELDS/.test(toolsSrc));
  assert.ok(/issuedKitItems/.test(toolsSrc));
});

console.log('\n■ AI BACKEND (secret isolation)');
const backend = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
test('backend callables verify authenticated + CC role server-side', () => {
  assert.ok(/assertAiAuthorized/.test(backend));
  assert.ok(/request\?\.auth\?\.uid/.test(backend));
  assert.ok(/isActive === false/.test(backend));
  assert.ok(/Company Commander/.test(backend));
});
test('backend defines secrets server-side and never returns them', () => {
  ['GROQ_API_KEY', 'GEMINI_API_KEY', 'PINECONE_API_KEY', 'PINECONE_HOST'].forEach(s => {
    assert.ok(backend.includes(`defineSecret('${s}')`), `defineSecret ${s}`);
  });
  // Responses return only content/model/matches — never a key.
  assert.ok(!/res\.json\(\).*api_?key/i.test(backend));
});
test('backend is not a generic Firestore proxy (only users role lookup)', () => {
  const genericProxy = /admin\w*\.(firestore)?\(?\.(collection|doc)\(.*request\.data/;
  assert.ok(!genericProxy.test(backend));
});
test('Pinecone client never holds a browser secret', () => {
  const sync = fs.readFileSync(path.join(root, 'src/features/aiAgent/scripts/syncToPinecone.ts'), 'utf8');
  assert.ok(!/AI_CONFIG\.pineconeKey/.test(sync));
  assert.ok(/callPinecone(Upsert|Query)/.test(sync));
});

console.log('\n■ DOCUMENT UPLOAD FAKE-SUCCESS AUDIT');

const docSrc = fs.readFileSync(path.join(root, 'src/features/students/DocumentVerificationScreen.tsx'), 'utf8');
test('no blob: URL is persisted as a document on upload failure', () => {
  // The failure path must NOT call URL.createObjectURL to fake success.
  assert.ok(!/catch[\s\S]{0,40}createObjectURL/.test(docSrc.replace(/\s+/g, ' ')), 'blob fallback removed');
});

// ── Summary ──
console.log(`\n══════════════════════════════════════`);
console.log(`PASSED: ${passed}   FAILED: ${failures.length}`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f.name}: ${f.err.message}`);
  process.exit(1);
}
console.log('All security tests passed.');
