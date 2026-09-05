// ═══════════════════════════════════════════════════════════════════════
// RULES / SECRET STATIC AUDIT
// ───────────────────────────────────────────────────────────────────────
// Zero-dependency checks run at any time (no emulator/Java needed). It does
// NOT prove runtime behavior (that is what the emulator suite is for) but it
// fails fast if a class of regression is introduced:
//   - Firestore/Storage catch-all or missing default-deny
//   - leave approval fields not protected from non-CC
//   - frontend code referencing cloud-AI secret variables
//   - AI generic-write path able to touch inventory ledgers
//
// Run: node scripts/audit-rules.mjs
// ═══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let failures = 0;
const check = (cond, msg) => {
  if (cond) { console.log(`  ✓ ${msg}`); }
  else { failures += 1; console.log(`  ✗ ${msg}`); }
};

console.log('■ FIRESTORE RULES');
const fsRules = read('firestore.rules');
check(!/allow\s+read\s*,\s*write\s*:\s*if\s+signedIn\(\)/.test(fsRules),
  'no authenticated read/write catch-all');
check(/allow\s+read\s*,\s*write\s*:\s*if\s+false/.test(fsRules),
  'default-deny for unmatched collections');
check(/protectedUserFieldsUnchanged/.test(fsRules),
  'user role/isDeveloper/isActive fields protected');
check(/match \/staff_leave\/\{leaveId\}/.test(fsRules), 'staff_leave rule present');
const leaveBlock = fsRules.match(/match \/staff_leave\/\{leaveId\} \{[\s\S]*?\n    \}/);
check(!!leaveBlock, 'staff_leave block parseable');
if (leaveBlock) {
  check(/status == request\.resource\.data\.status/.test(leaveBlock[0]),
    'non-CC cannot change leave status');
  check(/approvedBy == request\.resource\.data\.approvedBy/.test(leaveBlock[0]),
    'non-CC cannot change approvedBy');
  check(/rejectionReason == request\.resource\.data\.rejectionReason/.test(leaveBlock[0]),
    'non-CC cannot change rejectionReason');
  check(/isCC\(\)/.test(leaveBlock[0]), 'CC path present for leave');
}
check(/match \/stock_ledgers/.test(fsRules), 'stock_ledgers collection governed');
check(/isDevData/.test(fsRules) && /canReadDevData/.test(fsRules),
  'dev/test data isolation rules present');
check(/match \/subscription\/\{docId\}/.test(fsRules), 'subscription write governed');

// ── SUBSCRIPTION SELF-RENEWAL BYPASS ──
// The Company Commander is the party the licence bills. If rules let a CC
// write subscription/current, they can set endDate far in the future from
// the browser console and licence enforcement is meaningless.
const subBlock = fsRules.match(/match \/subscription\/\{docId\}[\s\S]*?\n    \}/);
check(!!subBlock, 'subscription block parseable');
if (subBlock) {
  check(!/allow write: if isCC\(\)/.test(subBlock[0]),
    'CC cannot self-write the licence document');
  check(/firstRunOpen\(\)/.test(subBlock[0]),
    'first-run seeding window preserved');
  check(/allow read: if signedIn\(\)/.test(subBlock[0]),
    'licence remains readable for the login-time listener');
}
// ── TEST HARNESS SAFETY ──
// Rules tests must never run against the real project id.
const fsTest = read('functions/test/firestore.rules.test.mjs');
check(!/const PROJECT_ID = 'training-command-erp'/.test(fsTest),
  'rules tests do not hardcode the production project id');
check(/demo-/.test(fsTest), 'rules tests use a demo- project id (no production calls)');
const fnPkg = JSON.parse(read('functions/package.json'));
check(!/emulators:exec/.test(fnPkg.scripts['test:rules'] || ''),
  'test:rules does not nest an emulator inside a running one');

// ── READ-ONLY DEGRADATION WHEN EXPIRED ──
// Every business write must pass a licence check, so an expired company can
// read its data and renew but cannot mutate anything.
// ── EXPRESSION BUDGET (1000 per request) ──
// Every role() / roleKey() call expands to exists() + get(). The old role
// predicates called them up to FOUR times each, and the findings rule uses
// isCC()/isSO() three times each - the emulator hit "maximum of 1000
// expressions". Critically, several DENY tests then passed only because
// evaluation ABORTED rather than because the security logic ran, so the
// suite was reporting false green. Keep each predicate at one roleKey().
for (const fn of ['isCC', 'isClerk', 'isQM', 'isUstad', 'isSO', 'isTrainee']) {
  const blk = fsRules.match(new RegExp(`function ${fn}\\(\\)[\\s\\S]*?\\n    \\}`));
  check(!!blk, `${fn} block parseable`);
  if (blk) {
    // Count BOTH role() and roleKey(); each expands to exists() + get().
    const calls = (blk[0].match(/\browle?Key\(\)|\brole\(\)|\broleKey\(\)/g) || []).length;
    check(calls === 1, `${fn} evaluates the role lookup exactly once (found ${calls})`);
  }
}
const rk = fsRules.match(/function roleKey\(\)[\s\S]*?\n    \}/);
check(!!rk && !/\brole\(\)/.test(rk[0].replace(/roleKey\(\)/g, '')),
  'roleKey() reads the profile directly instead of calling role()');

check(/function licenceWritable\(\)/.test(fsRules), 'licenceWritable() helper exists');
// EXPRESSION BUDGET: rules abort at 1000 evaluated expressions per request.
// The findings/relegations rules already carry huge boolean chains, so the
// licence helper must stay minimal - exactly one exists() and one get().
const lw = fsRules.match(/function licenceWritable\(\)[\s\S]*?\n    \}/);
check(!!lw, 'licenceWritable block parseable');
if (lw) {
  const gets = (lw[0].match(/\bget\(/g) || []).length;
  const exs  = (lw[0].match(/\bexists\(/g) || []).length;
  check(gets <= 1, `licenceWritable performs at most one get() (found ${gets})`);
  check(exs  <= 1, `licenceWritable performs at most one exists() (found ${exs})`);
}
// Reads must never be gated on the licence - expired stays readable.
const crd = fsRules.match(/function canReadDevData\(\)[\s\S]*?\n    \}/);
check(!!crd && !/licenceWritable/.test(crd[0]),
  'read path is not licence-gated (expired company can still read)');
check(/endMillis/.test(fsRules),
  'rules compare endMillis (rules cannot parse the ISO endDate string)');
check(/2592000000/.test(fsRules), 'grace window matches GRACE_DAYS = 30');
// canWriteDevData() is the choke point every business write already used.
const cwd = fsRules.match(/function canWriteDevData\(\)[\s\S]*?\n    \}/);
check(!!cwd && /licenceWritable\(\)/.test(cwd[0]),
  'licence gate wired into canWriteDevData (covers the whole ERP)');
// Paths that MUST stay writable while expired (login / renewal / audit).
const subBlk = fsRules.match(/match \/subscription\/\{docId\}[\s\S]*?\n    \}/);
check(!!subBlk && !/licenceWritable\(\)/.test(subBlk[0]),
  'licence document itself is not licence-gated (renewal must work when expired)');
// The server must write the machine-readable field.
const subAuth = read('functions/subscriptionAuth.mjs');
check(/endMillis: end\.getTime\(\)/.test(subAuth), 'server writes endMillis on renewal');
check(/backfillEndMillis/.test(subAuth), 'backfill exists for pre-existing licences');

// ── ADMIN SDK INITIALISATION ──
// Production logs showed "The default Firebase app does not exist" from
// createStaffAccount. Every admin-SDK accessor must route through one
// idempotent initialiser rather than an inline getApps() check.
const fnSrc = read('functions/index.js');
// firebase-admin v12 under ESM can resolve firebase-admin/app and
// firebase-admin/firestore to separate module instances with separate
// default-app registries, so the default app is not reliably shared.
// Production failed with "The default Firebase app does not exist" until
// the App instance was passed explicitly. Never go back to a bare
// getFirestore()/getAuth() with no argument.
check(/function adminApp\(\)/.test(fnSrc), 'adminApp() returns an explicit App instance');
check(/getFirestore\(adminApp\(\)\)/.test(fnSrc),
  'getFirestore receives the App explicitly (no default-app lookup)');
check(/getAuth\(adminApp\(\)\)/.test(fnSrc),
  'getAuth receives the App explicitly (no default-app lookup)');
// Strip comments first: the explanatory text mentions the very pattern
// being banned, which would otherwise trip the check.
const codeOnly = (src) => src.split('\n')
  .filter((l) => !l.trim().startsWith('//')).join('\n');
for (const f of ['functions/index.js', 'functions/backup.mjs']) {
  const src = codeOnly(read(f));
  check(!/getFirestore\(\)/.test(src), `${f}: no bare getFirestore() call`);
  check(!/[^n]getAuth\(\)/.test(src), `${f}: no bare getAuth() call`);
  check(!/getStorage\(\)/.test(src), `${f}: no bare getStorage() call`);
}

// ── AI KEY PLACEHOLDERS ──
// A deploy resolves every declared secret, so projects that never used AI
// must store a placeholder to deploy at all. That placeholder must never be
// treated as a usable key.
const fnIdx = read('functions/index.js');
check(/AI_KEY_PLACEHOLDERS/.test(fnIdx), 'placeholder AI keys are recognised');
check(/\.filter\(isRealKey\)/.test(fnIdx),
  'groq/gemini key collection filters out placeholders');

// ── UI MUST MATCH THE RULES ──
// The rules let an EXPIRED company read its data and renew while denying
// mutations. If SubscriptionGate hard-locks on 'expired' the UI contradicts
// that and the customer cannot reach their own records or the renew screen.
const gate = read('src/features/subscription/components/SubscriptionGate.tsx');
check(!/status === 'none' \|\| state\.status === 'expired'/.test(gate),
  'SubscriptionGate does not hard-lock an expired company (read-only policy)');
check(/const locked = state\.status === 'none'/.test(gate),
  'SubscriptionGate hard-locks only a never-activated install');

// ── FIRST-RUN LATCH ──
// firstRunOpen() gates subscription/current, subscriptionPlans, unitConfig
// and bootstrap CC creation. `allow write` includes DELETE, so if a CC can
// delete config/firstRun they re-open all of it and the licence fix is void.
const cfgBlock = fsRules.match(/match \/config\/\{docId\}[\s\S]*?\n    \}/);
check(!!cfgBlock, 'config block parseable');
if (cfgBlock) {
  const cfgCode = cfgBlock[0].split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  check(!/allow write:/.test(cfgCode),
    'config/{docId} has no blanket write covering the firstRun latch');
  check(/allow update, delete: if docId != 'firstRun'/.test(cfgBlock[0]),
    'config/firstRun cannot be updated or deleted (one-way latch)');
}

const histBlock = fsRules.match(/match \/subscriptionHistory\/\{id\}[\s\S]*?\n    \}/);
check(!!histBlock, 'subscriptionHistory block parseable');
if (histBlock) {
  check(/allow update, delete: if false/.test(histBlock[0]),
    'billing history is append-only (nobody may rewrite it)');
}

// ── SERVER-SIDE ENFORCEMENT MUST EXIST ──
const fnIndex = read('functions/index.js');
check(/renewSubscription/.test(fnIndex), 'server-side renewal callable exists');
check(/assertSubscriptionAllows/.test(fnIndex), 'server-side licence check wired into functions');
check(/assertAiAuthorizedAndLicensed/.test(fnIndex),
  'AI callables gated on licence (paid third-party spend)');
const aiGated = (fnIndex.match(/assertAiAuthorizedAndLicensed\(request\)/g) || []).length;
check(aiGated >= 4, `all AI callables licence-gated (found ${aiGated})`);
check(/await assertSubscriptionAllows\(getDb\(\)\);[\s\S]{0,400}normalizeStaffInput/.test(fnIndex),
  'staff provisioning gated on licence');
check(/match \/customers/.test(fsRules), 'customers/bridge collections governed');

console.log('\n■ STORAGE RULES');
const stRules = read('storage.rules');
check(/allow read, write: if false/.test(stRules), 'storage default-deny present');
check(/allow delete: if isCC\(\)/.test(stRules), 'storage deletes restricted to CC');
// NULL GUARD: storage `write` covers DELETE, and request.resource is null on
// a delete. Touching request.resource.size/contentType there throws a rules
// evaluation error (emulator: "line [36] Null value error"). Every size or
// contentType test must be preceded by a null check.
const stLines = stRules.split('\n');
let guardMissing = 0;
stLines.forEach((l, i) => {
  if (!/request\.resource\.(size|contentType)/.test(l)) return;
  // Look back a few lines for the guard within the same expression.
  const win = stLines.slice(Math.max(0, i - 4), i + 1).join('\n');
  if (!/request\.resource != null/.test(win)) guardMissing++;
});
check(guardMissing === 0,
  `storage size/type checks are null-guarded for deletes (${guardMissing} unguarded)`);

console.log('\n■ FRONTEND SECRET EXPOSURE');
// Production frontend code must not read cloud-AI secrets.
const config = read('src/features/aiAgent/config/ai.config.ts');
check(/pineconeKey:\s*''/.test(config), 'Pinecone key never read in client config');
// The only place that may mention VITE_*_API_KEY is the dev opt-in list.
const clientSecretReads = ['src/features/aiAgent/scripts/syncToPinecone.ts']
  .map(p => { try { return read(p); } catch { return ''; } })
  .filter(src => /AI_CONFIG\.pineconeKey|process\.env\.|VITE_PINECONE_API_KEY/.test(src));
check(clientSecretReads.length === 0,
  'Pinecone client code does not read a browser secret');

// Functions backend holds secrets server-side.
const backend = read('functions/index.js');
check(/defineSecret\('GROQ_API_KEY'\)/.test(backend), 'GROQ secret defined server-side');
check(/defineSecret\('GEMINI_API_KEY'\)/.test(backend), 'GEMINI secret defined server-side');
check(/defineSecret\('PINECONE_API_KEY'\)/.test(backend), 'PINECONE secret defined server-side');
check(/assertAiAuthorized/.test(backend) && /role/.test(backend),
  'backend verifies Firestore role server-side');
check(!/admin\.\w+\(\)\.collection/.test(backend.replace(/db\.collection\('users'\)\.doc\(uid\)/, '')),
  'backend is not a generic Firestore proxy (only role lookup)');

console.log('\n■ AI WRITE GUARDS');
const tools = read('src/features/aiAgent/engine/tools.ts');
check(/'issue_records'/.test(tools) && /GENERIC_WRITE_BLOCKED[\s\S]*issue_records/.test(tools),
  'AI generic writes blocked from issue_records');
check(/'stock_ledgers'/.test(tools) && /GENERIC_WRITE_BLOCKED[\s\S]*stock_ledgers/.test(tools),
  'AI generic writes blocked from stock_ledgers');
check(/FORBIDDEN_KIT_FIELDS/.test(tools),
  'AI update_trainee cannot mutate kit/issue fields');
check(/record delete sirf Company Commander/.test(tools),
  'AI delete restricted to CC');

console.log(`\\n══════════════════════════════════════`);
if (failures) { console.log(`AUDIT FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All static security audits passed.');
