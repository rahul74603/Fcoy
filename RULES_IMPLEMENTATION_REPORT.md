# TASK 2 — FIRESTORE + STORAGE SECURITY RULES · IMPLEMENTATION REPORT

> **Date:** 31-Jul-2026 · **Branch:** `arena/019fb3d1-fcoy` · **Mode:** STRICT (deny-by-default, least-privilege, reusable helpers, no feature break)
> **Owner decisions:** D1-FINAL (❌ no unauth write — temporary, Phase-2 CF mandatory) · D2 ✅ unitConfig/main public (branding only, secret-keys BLOCKED by rule) · D3 ✅ batches read all-auth.
> **Pre-checks (owner point #5):** query/index patterns verified BEFORE writing rules — `collectionGroup`=0, root listeners audited, bell-generator QM reach audited, log fields audited.

---

## 1. FILES CREATED / MODIFIED

| File | Action | Purpose |
|---|---|---|
| `firestore.rules` | ➕ NEW (10 helpers, 56 match blocks, 89 allow rules, catch-all deny) | Server-side enforcement — har rule per Hinglish comment ke saath |
| `storage.rules` | ➕ NEW (4 helpers, 3 match blocks) | Trainee docs path scoped to CC/Clerk, 5MB + image/PDF guard |
| `firebase.json` | 🔄 UPDATE | firestore/storage targets + emulators config (8080/9199/4000) |
| `firestore.indexes.json` | ➕ NEW (empty base) | Design composite-index-free hai; base file tracking ke liye |
| `package.json` | 🔄 UPDATE | devDeps: `@firebase/rules-unit-testing@^5.0.1` (firebase@12 peer), `firebase-tools@^13`, `vitest@^2` + script `test:rules` |
| `src/contexts/BatchContext.tsx` | 🔄 UPDATE (additive, documented) | **Rules-readiness fix:** batches listener ab `onAuthStateChanged` ke andar attach hota hai — pre-auth deny se dead-subscription nahi hoti; logged-in flow identical |
| `tests/rules/firestore.rules.test.ts` | ➕ NEW (~35 test blocks / ~70 assertions) | Matrix ki har row: allow + deny |
| `tests/rules/storage.rules.test.ts` | ➕ NEW (7 test blocks) | Path/type/size/role coverage |
| App code (baaki `src/`) | **ZERO changes** | Queries, writes, flows — sab untouched |

## 2. DESIGN (owner requirements mapping)

| Requirement | Implementation |
|---|---|
| Deny by default | Akhiri `match /{document=**} { allow read, write: if false; }` + storage `{allPaths=**}` deny |
| Least privilege | Matrix = actual route×role×ops scan (evidence-driven); Ustad write-surface ≈ 0; QM read sirf jahan evidence (trainees/kit) |
| Reusable helpers | `isCommander/isClerk/isQM/isUstad/isClerkOrCC/isQMOrCC/isAnyStaff/hasProfile/userRole` — role strings EK jagah; storage mirrors via cross-service lookup |
| Firestore↔Storage sync | Same `users/{uid}.role` source, same CC/Clerk scope on `documents/**` |
| Har rule explained | Har match block ke upar comment: collection + role + KYON (route evidence) |
| Append-only forensics | `login_history`, `staff_activity_logs`, `search_logs`, `error_logs` → update/delete `if false` (CC bhi nahi) |
| Existing features safe | Pre-flight audit: sab 5 onSnapshot listeners `trainees` (covered), unitConfig handler exists, D2 public read se login branding safe, BatchContext boot-fix |
| D2 secret-guard | `unitConfig` write par `!keys().hasAny(['password','apiKey','secrets','privateKey','token'])` — CC bhi secret save nahi kar sakta |
| Task-1 server proof | `staff_leave` write = `isClerkOrCC()` → Ustad approve **DB-level par block** |

## 3. SECURITY MATRIX SUMMARY (55/55 collections explicit — coverage audit PASS)

| Scope | Read | Write |
|---|---|---|
| users | self + CC | CC |
| login_history | CC | auth-create, schema-locked, append-only |
| activity/search/error logs | CC | auth-create, append-only |
| trainees domain | CC/Clerk/QM(trainees only) | CC/Clerk |
| staff domain (staff/ustads/duty/leave/types/deputation) | **all staff** (QM bell evidence) | CC/Clerk ⭐ |
| staff_attendance | CC/Clerk | CC/Clerk |
| training/exam | all staff | CC/Clerk |
| medical | CC/Clerk | CC/Clerk |
| inventory | CC/QM | CC/QM |
| finance (19 coll.) | CC/QM | CC/QM |
| udhariRecords | CC/QM/Clerk(read-only) | CC/QM |
| mess ops | CC/QM | CC/QM |
| notifications | all auth | create=auth; update=sirf apna readBy; delete=CC |
| batches (D3) | all staff | CC/Clerk |
| dropdown_masters/system_config | all auth | CC |
| unitConfig/main (D2) | **public** | CC + secret-keys blocked |
| system_counters/automation_runs | CC | CC |
| **catch-all** | ❌ | ❌ |

## 4. VERIFICATION RESULTS

| Check | Output |
|---|---|
| TypeScript strict (BatchContext change included) | `tsc --noEmit` → **exit 0** |
| Vite build | **✓ built in 11.14s** (sirf pre-existing chunk-size warning) |
| npm deps | 544 added; `@firebase/rules-unit-testing@3.0.4` REJECTED (peer firebase@^10) → **@5.0.1** (peer ^12) selected |
| Rules structure audit (python) | braces balanced ✓, 57+3 match blocks, har allow conditional ✓, 55/55 collections covered ✓ |
| Emulator attempt (this sandbox) | **`Error: Could not spawn 'java -version'`** — sandbox me Java runtime nahi (apt/jvm unavailable). CLI+config parse SUCCESS |

### ⚠️ EMULATOR TESTS — tumhari machine par (mandatory gate)
Firestore emulator Java-based hai; yahan run impossible. Tumhare laptop/PC par:
```bash
npm install          # devDeps pull karega (firebase-tools, vitest, rules-unit-testing)
npm run test:rules   # emulator boot + dono suites
# Expect: Test Files 2 passed | Tests ~42 passed
```
**Deploy gate (tumhara rule #8):** production deploy SIRF tab jab ye PASS ho — main PASS ke bina deploy recommend nahi kar raha.

## 5. ROLLBACK
- Rules abhi **deploy hi nahi hui** → rollback ka sawaal nahi.
- Deploy ke baad: Firebase Console → Rules → previous version restore (1-click) YA `git revert` + `firebase deploy --only firestore:rules,storage`.
- BatchContext change revert bhi independent aur safe hai (old root-listener behavior par wapas).

## 6. KNOWN ACCEPTED TEMPORARY LOSSES (documented)
1. **Wrong-password attempts** (unauth) ab log nahi honge — D1-FINAL; Phase-2 Task-7 Cloud Function = mandatory fix.
2. **Pre-auth browser errors** ab `error_logs` me nahi jayenge (auth required) — negligible UX impact (console par dikhta rahega).
3. **QM/Ustad ka kisi denied write par UI error** dikhega (pehle silently succeed hota tha — jo khud bug tha, jese /batches ALL_ROLES). UI-level polish Task-4 scope.

## 7. NEXT (Task 3 preview — Storage Rules already done as part of this task)
Per implementation order, Task 3 (Storage Rules) is already COMPLETE within this task (synchronized delivery per owner instruction). Next in line: **Task 4 — Role Permission Fixes** (e.g., /batches route group tightening + any residual action-gates).

## Correction Log
- **C-R1 (31-Jul-2026, runtime evidence):** 3 code-used collections audit se chhoot gaye the (catch-all deny): `batch_progress` (BatchProgress api — COLLECTION const indirection; live symptom = "No Active Batch"), `config` (BatchContext `config/activeBatch`), `training_tests` (ReportsScreen safeFetch + backup). Roles: batch_progress read anyStaff / write CC+Clerk+Ustad · config read anyStaff / write clerkCC · training_tests clerkCC full. **Legacy old-rule names re-verified DEAD (0 code usage) → deny-by-default correct:** training_material, training_exam, training_results, staff_performance, staff_notifications, dailyDeployments, dailyAssignments, ustadDailyStatus.
