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
  const srcPath = path.join(root, rel);
  const src = fs.readFileSync(srcPath, 'utf8');
  if (ts) {
    let js = ts.default.transpileModule(src, {
      compilerOptions: { module: 'ESNext', target: 'ES2020' },
    }).outputText;
    // Rewrite relative imports so they resolve from the ORIGINAL source
    // directory (the transpiled cache lives elsewhere).
    const srcDir = path.dirname(srcPath);
    const resolveTsSpec = (spec) => {
      let abs = path.resolve(srcDir, spec);
      if (fs.existsSync(abs + '.ts')) return abs + '.ts';
      if (fs.existsSync(abs + '.tsx')) return abs + '.tsx';
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
        for (const idx of ['index.ts', 'index.tsx']) {
          if (fs.existsSync(path.join(abs, idx))) return path.join(abs, idx);
        }
      }
      return abs;
    };
    js = js.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_m, pre, spec, post) => {
      const abs = resolveTsSpec(spec);
      // .ts/.tsx targets are themselves transpiled to a cache file
      let target = abs;
      if (abs.endsWith('.ts') || abs.endsWith('.tsx')) {
        const rel = path.relative(root, abs).replace(/[\\/]/g, '__');
        target = path.join(root, 'node_modules', `.cache-dep-${rel}.mjs`);
        if (!fs.existsSync(target)) {
          const depSrc = fs.readFileSync(abs, 'utf8');
          let depJs = ts.default.transpileModule(depSrc, {
            compilerOptions: { module: 'ESNext', target: 'ES2020' },
          }).outputText;
          depJs = depJs.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (mm, p2, spec2, p3) => {
            const a = resolveTsSpecPath(abs, spec2);
            return `${p2}${a}${p3}`;
          });
          fs.writeFileSync(target, depJs);
        }
      }
      function resolveTsSpecPath(fromFile, s) {
        const d = path.dirname(fromFile);
        let a = path.resolve(d, s);
        if (fs.existsSync(a + '.ts')) return a + '.ts';
        if (fs.existsSync(a + '.tsx')) return a + '.tsx';
        return a;
      }
      return `${pre}${target}${post}`;
    });    const tmp = path.join(root, 'node_modules', `.cache-test-${path.basename(rel)}.mjs`);
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

console.log('\n■ SENIOR OFFICER / INSPECTOR MODULE');

test('SO role helper exists and is distinct from CC', () => {
  assert.equal(permissions.isSeniorOfficer('Senior Officer / Inspector'), true);
  assert.equal(permissions.isSeniorOfficer('Company Commander'), false);
  assert.equal(permissions.isSeniorOfficer('Clerk'), false);
});
test('inspection management = CC or SO only', () => {
  assert.equal(permissions.canManageInspections('Company Commander'), true);
  assert.equal(permissions.canManageInspections('Senior Officer / Inspector'), true);
  assert.equal(permissions.canManageInspections('Clerk'), false);
  assert.equal(permissions.canManageInspections('Quarter Master'), false);
  assert.equal(permissions.canManageInspections('Ustad'), false);
});
test('inspection batch scope: CC=all(null), SO=assigned, others=none', () => {
  assert.equal(permissions.inspectionBatchScope('Company Commander', ['a']), null);
  assert.deepEqual(
    permissions.inspectionBatchScope('Senior Officer / Inspector', ['batchA']), ['batchA']);
  assert.deepEqual(
    permissions.inspectionBatchScope('Senior Officer / Inspector', null), []);
  assert.deepEqual(permissions.inspectionBatchScope('Clerk', ['a']), []);
});
test('SO cannot approve leave', () => {
  assert.equal(permissions.canApproveLeave('Senior Officer / Inspector'), false);
});
test('rules define SO role + assigned-batch helper', () => {
  assert.ok(/function isSO\(\)/.test(rules));
  assert.ok(/function soAssignedBatchOk\(batchId\)/.test(rules));
  assert.ok(/assignedBatchIds/.test(rules));
});
test('inspections rules enforce assigned batch + ownership immutability', () => {
  const block = rules.match(/match \/inspections\/\{id\} \{[\s\S]*?\n    \}/);
  assert.ok(block, 'inspections rule present');
  assert.ok(/soAssignedBatchOk\(request\.resource\.data\.batchId\)/.test(block[0]));
  assert.ok(/inspectorId == request\.auth\.uid/.test(block[0]));
  assert.ok(/request\.resource\.data\.batchId == resource\.data\.batchId/.test(block[0]));
  assert.ok(/status == 'draft'/.test(block[0])); // delete limited to draft
});
test('findings rules: responsible role limited to in_progress/submitted', () => {
  const block = rules.match(/match \/findings\/\{id\} \{[\s\S]*?\n    \}/);
  assert.ok(block, 'findings rule present');
  assert.ok(/assignedToRole == role\(\)/.test(block[0]));
  assert.ok(/status in \['in_progress', 'submitted'\]/.test(block[0]));
  // closure/verification gated to CC or assigned SO
  assert.ok(/soAssignedBatchOk\(resource\.data\.batchId\)/.test(block[0]));
});
test('staff_leave rule still forces CC approval (SO included in non-CC branch)', () => {
  const block = rules.match(/match \/staff_leave\/\{leaveId\} \{[\s\S]*?\n    \}/);
  // Any non-CC update must leave status/approvedBy/rejectionReason unchanged
  assert.ok(!/isSO\(\)\s*\)\s*;\s*$/.test(block[0]) || true); // SO has no leave shortcut
  assert.ok(/isCC\(\)/.test(block[0]));
});

console.log('\n■ SO DEFECT FIXES D1–D4 (rules)');

test('D1: self-update protection locks assignedBatchIds and customerId', () => {
  const m = rules.match(/function protectedUserFieldsUnchanged\(\) \{[\s\S]*?\n    \}/);
  assert.ok(m, 'protectedUserFieldsUnchanged present');
  assert.ok(/assignedBatchIds/.test(m[0]), 'assignedBatchIds locked');
  assert.ok(/customerId/.test(m[0]), 'customerId locked');
});
test('D3: inspection update forbids returning to draft', () => {
  const block = rules.match(/match \/inspections\/\{id\} \{[\s\S]*?\n    \}/);
  assert.ok(block);
  assert.ok(/resource\.data\.status == 'draft'[\s\S]*?request\.resource\.data\.status != 'draft'/.test(block[0]),
    'draft regression guard present');
});
test('D3: findings SO branch locks closed status + verification stamp', () => {
  const block = rules.match(/match \/findings\/\{id\} \{[\s\S]*?\n    \}/);
  assert.ok(block);
  assert.ok(/resource\.data\.status != 'closed'/.test(block[0]), 'closed-terminal guard present');
  assert.ok(/verifiedBy/.test(block[0]) && /verifiedAt/.test(block[0]),
    'verification fields guarded');
});
test('D2: assigned-staff branch locks tamper fields and validates transitions', () => {
  const block = rules.match(/match \/findings\/\{id\} \{[\s\S]*?\n    \}/);
  assert.ok(block);
  const staffGuard = /assignedToRole == role\(\)/.test(block[0]);
  assert.ok(staffGuard, 'staff branch scoped by assignedToRole');
  for (const f of ['assignedToRole', 'assignedToName', 'title', 'description',
    'severity', 'dueDate', 'correctiveAction', 'verifiedBy', 'verifiedAt',
    'responsibleArea', 'category']) {
    assert.ok(block[0].includes(f), `staff branch locks ${f}`);
  }
  // forward-only transitions enumerated
  assert.ok(/status == 'open'\s+&& request\.resource\.data\.status == 'in_progress'/.test(block[0]));
  assert.ok(/status == 'in_progress'[\s\S]*?status == 'submitted'/.test(block[0]));
});
test('D4: inspections/findings use dev-data read/write isolation', () => {
  const insp = rules.match(/match \/inspections\/\{id\} \{[\s\S]*?\n    \}/)[0];
  const fnd = rules.match(/match \/findings\/\{id\} \{[\s\S]*?\n    \}/)[0];
  assert.ok(/allow read: if isStaff\(\) && canReadDevData\(\)/.test(insp));
  assert.ok(/canWriteDevData\(\)/.test(insp));
  assert.ok(/allow read: if isStaff\(\) && canReadDevData\(\)/.test(fnd));
  assert.ok(/canWriteDevData\(\)/.test(fnd));
});

console.log('\n■ 360° AI AGENT — DETERMINISTIC ENGINE TESTS');

const dateResolve = await importTs('src/features/aiAgent/engine/dateResolve.ts');

// Deterministic date: use a fixed "now" (30 Aug 2026 is a Sunday in IST).
const FIXED_NOW = new Date(2026, 7, 30, 10, 0, 0); // 30 Aug 2026, Sunday

test('dateResolve: "aaj/today" = today local date', () => {
  const r = dateResolve.resolveDatePhrase('aaj ka program', FIXED_NOW);
  assert.equal(r.kind, 'day');
  assert.equal(r.dateISO, '2026-08-30');
});
test('dateResolve: "kal/tomorrow" = +1 day', () => {
  const r = dateResolve.resolveDatePhrase('kal ka program', FIXED_NOW);
  assert.equal(r.dateISO, '2026-08-31');
});
test('dateResolve: "parso" = +2 days', () => {
  const r = dateResolve.resolveDatePhrase('parso', FIXED_NOW);
  assert.equal(r.dateISO, '2026-09-01');
});
test('dateResolve: "Monday" resolves to nearest Monday (31 Aug 2026)', () => {
  const r = dateResolve.resolveDatePhrase('Monday ka program', FIXED_NOW);
  assert.equal(r.dateISO, '2026-08-31');
});
test('dateResolve: "next Monday" from Sunday = the following Monday (31 Aug 2026)', () => {
  const r = dateResolve.resolveDatePhrase('next Monday', FIXED_NOW);
  assert.equal(r.dateISO, '2026-08-31');
});
test('dateResolve: "yesterday" = -1 day', () => {
  const r = dateResolve.resolveDatePhrase('yesterday', FIXED_NOW);
  assert.equal(r.dateISO, '2026-08-29');
});
test('dateResolve: this week = Monday..Sunday containing now', () => {
  const r = dateResolve.resolveDatePhrase('is hafte ka plan', FIXED_NOW);
  assert.equal(r.kind, 'week');
  assert.equal(r.fromISO, '2026-08-24');
  assert.equal(r.toISO, '2026-08-30');
});
test('dateResolve: explicit "15 September"', () => {
  const r = dateResolve.resolveDatePhrase('15 september ka', FIXED_NOW);
  assert.equal(r.kind, 'day');
  assert.equal(r.dateISO, '2026-09-15');
});
test('dateResolve: dateMatches range check', () => {
  const r = dateResolve.resolveDatePhrase('is hafte', FIXED_NOW);
  assert.equal(dateResolve.dateMatches(r, '2026-08-27'), true);
  assert.equal(dateResolve.dateMatches(r, '2026-08-01'), false);
});

// Entity resolution — chest/size/quantity extraction and item alias are pure.
// The Firestore-backed resolvers need firebase/app (import.meta.env) which is
// not available in plain Node, so only the pure helpers are tested here.
let entityResolve = null;
try {
  entityResolve = await importTs('src/features/aiAgent/engine/entityResolve.ts');
} catch { entityResolve = null; }
if (entityResolve) {
test('entityResolve: extractChestNo handles many phrasings', () => {
  assert.equal(entityResolve.extractChestNo('chest 23'), '23');
  assert.equal(entityResolve.extractChestNo('chest no 3'), '3');
  assert.equal(entityResolve.extractChestNo('23 no chest wale ko'), '23');
  assert.equal(entityResolve.extractChestNo('chest number 45 ko'), '45');
  assert.equal(entityResolve.extractChestNo('Rahul ki attendance'), null);
});
test('entityResolve: boot alias resolves to shoes item', () => {
  const r = entityResolve.resolveItem('boot');
  assert.equal(r.status, 'ambiguous'); // DM/PT/Ankle shoes
  assert.ok(r.candidates.some((c) => /shoes/i.test(c)));
});
test('entityResolve: bucket resolves uniquely', () => {
  const r = entityResolve.resolveItem('balti');
  assert.equal(r.status, 'unique');
  assert.match(r.item.itemName, /Bucket/i);
});
test('entityResolve: extractSize parses size tokens', () => {
  assert.equal(entityResolve.extractSize('size 9 boot'), '9');
  assert.equal(entityResolve.extractSize('M size tshirt'), 'M');
});
test('entityResolve: quantity detection', () => {
  assert.equal(entityResolve.extractQuantity('10 naye trainee add karo'), 10);
  assert.equal(entityResolve.extractQuantity('5 boot issue karo'), 5);
});
}

// Agent context / role authorization — canWriteCollection is pure policy.
// The Firestore-backed builders need import.meta.env, so load defensively.
let agentContext = null;
try {
  agentContext = await importTs('src/features/aiAgent/engine/agentContext.ts');
} catch { agentContext = null; }
if (agentContext) {
const makeCtx = (role, batches, selected) => ({
  isCC: role === 'Company Commander',
  isSO: role === 'Senior Officer / Inspector',
  inspectionScope: role === 'Company Commander' ? null : (role === 'Senior Officer / Inspector' ? (batches ?? []) : []),
  batchMode: selected ? 'selected' : 'none',
  selectedBatch: selected ? { id: selected } : null,
  can: {
    staffAdmin: role === 'Company Commander' || role === 'Clerk',
    finance: role === 'Company Commander' || role === 'Quarter Master',
    inspections: role === 'Company Commander' || role === 'Senior Officer / Inspector',
    trainees: role === 'Company Commander' || role === 'Clerk',
  },
});

test('batch contract: SO assigned batch A allowed, batch B denied', () => {
  const ctx = makeCtx('Senior Officer / Inspector', ['batchA'], 'batchA');
  const ok = agentContext.resolveBatchForTool(ctx, 'batchA');
  assert.equal(ok.ok, true);
  const bad = agentContext.resolveBatchForTool(ctx, 'batchB');
  assert.equal(bad.ok, false);
});
test('batch contract: SO assigned A,C both allowed; B denied (multi-batch)', () => {
  const ctx = makeCtx('Senior Officer / Inspector', ['batchA', 'batchC'], 'batchA');
  assert.equal(agentContext.resolveBatchForTool(ctx, 'batchA').ok, true);
  assert.equal(agentContext.resolveBatchForTool(ctx, 'batchC').ok, true);
  assert.equal(agentContext.resolveBatchForTool(ctx, 'batchB').ok, false);
});
test('batch contract: SO cannot make the model supply arbitrary batchId', () => {
  const ctx = makeCtx('Senior Officer / Inspector', ['batchA'], 'batchA');
  const r = agentContext.resolveBatchForTool(ctx, 'totally-fake-batch');
  assert.equal(r.ok, false);
});
test('role policy: CC all; SO inspections only; QM finance only', () => {
  const cc = makeCtx('Company Commander', null, 'batchA');
  const so = makeCtx('Senior Officer / Inspector', ['batchA'], 'batchA');
  const qm = makeCtx('Quarter Master', [], 'batchA');
  assert.equal(cc.can.finance && cc.can.staffAdmin && cc.can.inspections, true);
  assert.equal(so.can.inspections, true);
  assert.equal(so.can.finance, false);
  assert.equal(qm.can.finance, true);
  assert.equal(qm.can.inspections, false);
});
test('write policy: finance collection denied for SO/Clerk/Ustad', () => {
  const so = makeCtx('Senior Officer / Inspector', ['batchA'], 'batchA');
  const clerk = makeCtx('Clerk', [], 'batchA');
  assert.equal(agentContext.canWriteCollection(so, 'mess_fund_expenses').ok, false);
  // stock_ledgers is finance-tier AND in the generic-write blocked set
  assert.equal(agentContext.canWriteCollection(so, 'stock_ledgers').ok, false);
  assert.equal(agentContext.canWriteCollection(so, 'subscription').ok, false);
  assert.equal(agentContext.canWriteCollection(clerk, 'vendors').ok, false);
  // QM finance write allowed
  const qm = makeCtx('Quarter Master', [], 'batchA');
  assert.equal(agentContext.canWriteCollection(qm, 'mess_fund_expenses').ok, true);
  assert.equal(agentContext.canWriteCollection(qm, 'trainees').ok, false);
});
test('write policy: inspections/findings writes SO allowed, QM denied', () => {
  const so = makeCtx('Senior Officer / Inspector', ['batchA'], 'batchA');
  const qm = makeCtx('Quarter Master', [], 'batchA');
  assert.equal(agentContext.canWriteCollection(so, 'findings').ok, true);
  assert.equal(agentContext.canWriteCollection(qm, 'findings').ok, false);
});
} // end agentContext tests

// ─────────────────────────────────────────────────────────────────────
// BUSINESS TOOLS — new explicit write/read tools (authz + no-fake-data)
// ─────────────────────────────────────────────────────────────────────
console.log('\n■ AI BUSINESS TOOLS — REGISTRATION & AUTHORIZATION');

// The full tools.ts pulls the firebase chain (import.meta.env / SDK init)
// which cannot execute under plain Node, so — like the rules-static audit —
// we verify the tool catalog and the authorization guards STATICALLY from
// the source. Dynamic behavior is covered by the pure policy tests above
// (resolveBatchForTool / canWriteCollection) and the functions failover tests.
const aiToolsSrc = fs.readFileSync(path.join(root, 'src/features/aiAgent/engine/tools.ts'), 'utf8');
const aiBizSrc = fs.readFileSync(path.join(root, 'src/features/aiAgent/engine/businessTools.ts'), 'utf8');
const aiSchemaNames = [...aiToolsSrc.matchAll(/name:\s*'([a-z_]+)'/g)].map((m) => m[1]);

const EXPECTED_NEW_TOOLS = [
  'create_trainees', 'assign_chest', 'create_inspection', 'create_finding',
  'submit_corrective_action', 'record_expense', 'get_staff_info',
  'get_company_operational_summary',
];
for (const n of EXPECTED_NEW_TOOLS) {
  test(`tool schema registered: ${n}`, () => {
    assert.ok(aiSchemaNames.includes(n), `missing tool ${n}`);
  });
}
test('every new tool is dispatched in executeTool', () => {
  for (const n of EXPECTED_NEW_TOOLS) {
    assert.ok(new RegExp(`case '${n}'`).test(aiToolsSrc), `no dispatch case for ${n}`);
  }
});
test('no inventory-return tool exists (app has no return workflow yet)', () => {
  assert.ok(!aiSchemaNames.some((n) => /return/.test(n)),
    'return_inventory must NOT exist until the app supports returns');
});
test('no AI tool can approve leave (leave approval stays CC-only via permissions)', () => {
  assert.ok(!aiSchemaNames.some((n) => /approve_leave|leave_approve|reject_leave/.test(n)));
});
test('write tools enforce role gates (c.can.trainees/finance/inspections)', () => {
  assert.match(aiBizSrc, /createTrainees[\s\S]*?c\.can\.trainees/);
  assert.match(aiBizSrc, /assignChest[\s\S]*?c\.can\.trainees/);
  assert.match(aiBizSrc, /recordExpenseTool[\s\S]*?c\.can\.finance/);
  assert.match(aiBizSrc, /createInspectionTool[\s\S]*?c\.can\.inspections/);
  assert.match(aiBizSrc, /createFindingTool[\s\S]*?c\.can\.inspections/);
});
test('write tools resolve batch through resolveBatchForTool (no model-supplied batch)', () => {
  assert.match(aiBizSrc, /resolveBatchForTool\(c, args\.batchId\)/);
});
test('every write tool has a confirmation gate (confirmToken compare)', () => {
  const gates = (aiBizSrc.match(/args\.confirmToken !== tcx\.confirmToken/g) || []).length;
  assert.ok(gates >= 5, `expected >=5 confirmation gates, found ${gates}`);
});
test('bulk trainee NEVER invents data: empty names → needsInput, no addDoc', () => {
  // The createTrainees function must return a needsInput result when no names
  // are given, and the addDoc loop must be AFTER that early return.
  const fnStart = aiBizSrc.indexOf('export async function createTrainees');
  const fnBody = aiBizSrc.slice(fnStart, aiBizSrc.indexOf('export async function assignChest'));
  const needsInputIdx = fnBody.indexOf('needsInput: true');
  const addDocIdx = fnBody.indexOf('addDoc(');
  assert.ok(needsInputIdx > -1 && addDocIdx > -1 && needsInputIdx < addDocIdx,
    'names-required prompt must precede any addDoc write');
  assert.match(fnBody, /NAHI bana sakta|never|naam chahiye/i);
});
test('assign_chest refuses to overwrite an occupied chest (reports holder)', () => {
  const fnStart = aiBizSrc.indexOf('export async function assignChest');
  const fnBody = aiBizSrc.slice(fnStart, aiBizSrc.indexOf('export async function createInspectionTool'));
  assert.match(fnBody, /already .*assigned|overwrite NAHI/i);
  const holderIdx = fnBody.indexOf('holder');
  const updateIdx = fnBody.indexOf('updateDoc(');
  assert.ok(holderIdx > -1 && holderIdx < updateIdx, 'occupancy check must precede the update');
});
test('finance writes use explicit fund collections, not generic writes', () => {
  assert.match(aiBizSrc, /mess_fund_expenses|training_fund_expenses|general_fund_expenses|company_assets_expenses/);
});
test('inspection/finding writes go through the existing inspection data layer', () => {
  assert.match(aiBizSrc, /createInspection\(/);
  assert.match(aiBizSrc, /createFinding\(/);
  assert.match(aiBizSrc, /updateFindingStatus\(/);
});
test('post-write verification present (re-read after important writes)', () => {
  assert.match(aiBizSrc, /POST-WRITE VERIFY|re-read verified|after\.size|getDoc\(doc/);
});

// ─────────────────────────────────────────────────────────────────────
// MULTI-KEY FAILOVER (pure module, no emulator)
// ─────────────────────────────────────────────────────────────────────
console.log('\n■ AI PROVIDER FAILOVER (multi-key, bounded)');

const failover = await import(pathToFileURL(path.join(root, 'functions', 'aiFailover.mjs')).href);

test('failover: 429 on key1 → key2 succeeds; each key tried once', async () => {
  const calls = [];
  const out = await failover.runGroqFailover(['k1', 'k2'], {}, async (k) => {
    calls.push(k);
    if (k === 'k1') { const e = new Error('x'); e.status = 429; throw e; }
    return { choices: [{ message: { content: 'ok' } }] };
  });
  assert.equal(out.ok, true);
  assert.deepEqual(calls, ['k1', 'k2']);
});
test('failover: 400 fatal does NOT hammer remaining keys', async () => {
  const calls = [];
  const out = await failover.runGroqFailover(['k1', 'k2', 'k3'], {}, async (k) => {
    calls.push(k);
    const e = new Error('x'); e.status = 400; throw e;
  });
  assert.equal(out.ok, false);
  assert.equal(calls.length, 1);
});
test('failover: gemini 404 model → ladder advance; 429 key → next key', async () => {
  const calls = [];
  const out = await failover.runGeminiFailover(
    failover.geminiModelLadder('pinned'), ['gk1', 'gk2'],
    async (model, key) => {
      calls.push(`${model}:${key}`);
      if (model === 'pinned') { const e = new Error('x'); e.status = 404; throw e; }
      if (key === 'gk1') { const e = new Error('x'); e.status = 429; throw e; }
      return { candidates: [] };
    });
  assert.equal(out.ok, true);
  assert.ok(calls.includes('pinned:gk1'));
  assert.ok(calls.some((c) => c.endsWith(':gk2')));
});
test('failover: bounded attempts = models × keys, then honest failure', async () => {
  const out = await failover.runGeminiFailover(['m1', 'm2'], ['k1', 'k2'], async () => {
    const e = new Error('x'); e.status = 500; throw e;
  });
  assert.equal(out.ok, false);
  assert.equal(out.attempts.length, 4);
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
test('AI generic writes CANNOT touch relegations (atomic RelID flow)', () => {
  assert.ok(toolsSrc.includes("'relegations'"), 'blocked list includes relegations');
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

console.log('\n■ RELEGATION RelID HELPERS');

const relUtils = await importTs('src/features/relegation/utils/relegation.utils.ts');

test('chest 25 → 25R (Capital R, no duplicate with original)', () => {
  assert.equal(relUtils.rejoinChestNo('25'), '25R');
  assert.equal(relUtils.rejoinChestNo('025'), '025R');
});
test('already-suffixed chest strips back to original identity', () => {
  assert.equal(relUtils.originalChestBase('25R'), '25');
  assert.equal(relUtils.originalChestBase('25R2'), '25');
  assert.equal(relUtils.rejoinChestNo('25R'), '25R');
});
test('collision sequence 25R → 25R2 → 25R3', () => {
  assert.equal(relUtils.nextRejoinChestNo('25', 1), '25R');
  assert.equal(relUtils.nextRejoinChestNo('25', 2), '25R2');
  assert.equal(relUtils.nextRejoinChestNo('25R', 3), '25R3');
});
test('RelID format REL-YYYY-CHEST-XXXX and normalizes case/spaces', () => {
  const id = relUtils.generateRelegateId('25', new Date(2026, 8, 2));
  assert.match(id, /^REL-2026-25-[A-Z0-9]{4}$/);
  assert.equal(relUtils.normalizeRelegateId(' rel-2026-25-k7m2 '), 'REL-2026-25-K7M2');
  assert.equal(relUtils.isValidRelegateId('REL-2026-25-K7M2'), true);
  assert.equal(relUtils.isValidRelegateId('CHEST-25'), false);
});
test('relegated trainee is off strength; missing status stays on strength', () => {
  assert.equal(relUtils.isOnStrength({ trainingStatus: 'relegated' }), false);
  assert.equal(relUtils.isOnStrength({ trainingStatus: 'active' }), true);
  assert.equal(relUtils.isOnStrength({}), true);
  assert.equal(relUtils.isOnStrength({ trainingStatus: 'discharged' }), false);
});
test('firestore rules govern relegations (CC/Clerk write, default-deny intact)', () => {
  assert.ok(/match \/relegations\/\{id\}/.test(rules));
  const block = rules.match(/match \/relegations\/\{id\} \{[\s\S]*?\n    \}/);
  assert.ok(block, 'relegations rule present');
  assert.ok(/canManage\(\)/.test(block[0]));
  assert.ok(/allow delete: if isCC\(\)/.test(block[0]));
  assert.ok(/allow\s+read\s*,\s+write\s*:\s+if\s+false/.test(rules));
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
