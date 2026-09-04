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
