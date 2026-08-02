# 📌 RELEASE NOTES — v1.0 SECURITY BASELINE

> **Status:** ⏳ TEMPLATE — gates clear hote hi ☐-marked values fill hongi.
> **Purpose:** Known-good security baseline ka permanent record. 2-3 mahine baad bhi bug-ka-source dhundhna ho to yahi starting point hai.

---

## Release Identity

| Field | Value |
|---|---|
| **Git Tag** | `v1.0-security-rules` (⏳ Step 4.5 par create hoga) |
| **Rules Commit** | `85e5803` (firestore+storage rules + suites) |
| **Deploy-Gate Commit** | `b03a39e` (checklist + tag instructions) |
| **Deploy Date & Time** | ⏳ __________ (IST fill karo jab Step 3 publish ho) |
| **Firestore Rules SHA-256** | `v1.0` · `f752f7ef43a288f6ebb618ce621fb10649ef2cac038f836d74a4351dbef510d3` |
| **Firestore Rules SHA-256 (CURRENT — C-R1 corrected)** | `v1.1` · `7e3cf53713799999356052b898aca5414811a794a5c0804344c231db19773c30` · commit `59278e9` · 3 runtime-proven missing collections add hue (`batch_progress`, `config`, `training_tests`) · **purana (v1.0) hash ab drift maana jayega** · ⏳ deploy pending (PC se `firebase deploy --only firestore`) |
| **Storage Rules SHA-256** | `v1.0` · `eeeb5d8e65637f88036795cc1ecf5d05a1e325910d793118586049b03a421add` |
| **App Build** | tsc strict PASS · vite build PASS (11.14s, pre-existing chunk-size warning) |

> Hash-tip (integrity): `sha256sum firestore.rules` ka output upar wale SHA-256 se alag dikhe = rules me drift hua hai (approve-ki-gayi baseline se hatke kuch badla).

## Deployment Approval Record

*Future deployments isi pattern par track honge: SECURITY-002, SECURITY-003 …*

| Field | Value |
|---|---|
| Change ID | `SECURITY-001` |
| Baseline | Security Baseline v1.0 |
| Risk Level | High (entire-DB access layer change; rollback < 2 min) |
| Rollback Tested | ⏳ Yes ☐ / No ☐ *(owner-refined: "Yes" = POORA loop verified — ① previous rules restore ho ② 2–3 critical smoke (login + read + write) rollback ke baad PASS ho ③ original rules dubara restore karke forward-deploy confirm ho. Sirf button dabana = not tested.)* |
| Approved By | ⏳ __________ |
| Approved On | ⏳ __________ (IST) |

## Scope of This Release

| Item | Summary |
|---|---|
| Task 1 (`4a964a2`) | Leave approval security — `canManageLeaves` gate, 7 hook handlers + 6 UI points |
| Task 2 (`85e5803`) | `firestore.rules` — deny-by-default, 55/55 collections explicit, 10 reusable role helpers, append-only forensics, Task-1 server proof (`staff_leave` write = CC/Clerk) |
| Task 3 (`85e5803`) | `storage.rules` — trainee docs path CC/Clerk, 5MB cap, image/PDF only, synchronized role source |
| Owner decisions | D1: no-unauth-write (temporary) · D2: unitConfig/main public + secret-keys rule-blocked · D3: batches read all-auth |
| App-side change | Sirf `BatchContext.tsx` auth-gated listener (rules-readiness) — baaki `src/` zero change |

## Verification Evidence (Deploy Approval Record)

*Kisi ko baad me ye na poochna pade ki "kis basis par deploy approve hua tha" — har claim 3-layer verified: source code (file+line) + automated test + real runtime behavior. Tabhi "verified" maana jayega.*

| Item | Evidence |
|---|---|
| Git Commit | `85e5803` (rules+suites) · `b03a39e` (checklist/tag) · `7f12028` (release notes) |
| Git Tag | `v1.0-security-rules` (⏳ Step 4.5 par create hoga) |
| Emulator Tests | ✅ **PASS — 75/75 (2 files)** · 02-Aug-2026 05:39 IST · firebase-tools 15.25.1 + fresh emulator v1.22.0 · exit code 0 · tested rules SHA-256 = `7e3cf537…` = deploy-pending v1.1 (byte-identical — beech ke commits sirf tests/UI chhuwe) |
| Rules Simulator (S1–S10) | ⏳ PASS ☐ / FAIL ☐ · timestamp: __________ |
| Smoke Tests (M1–M10, 4 roles) | ⏳ PASS ☐ / FAIL ☐ · timestamp: __________ |
| Build | ✅ PASS (vite 11.14s, commit `85e5803` par) |
| TypeScript | ✅ PASS (strict, exit 0, commit `85e5803` par) |
| Reviewer | ⏳ __________ (name/initials — jo gates run + approve kare) |
| Approval Date | ⏳ __________ (date & time IST) |
| 48h Observation | ⏳ CLEAN (no PERMISSION_DENIED spike / regression) |

**3-layer principle (frozen doctrine):** koi bhi AI/agent report final proof NAHI — har claim tabhi "verified" jab ① source code (file+line), ② automated test (emulator suite), ③ real runtime behavior (simulator + smoke) teeno agree karein.

## Known Limitations (is release me documented)

1. **Wrong-password attempts log nahi hote** (unauthenticated `login_history` write band hai — D1 owner decision). **Fix: Phase-2 Cloud Function (server-side logging) — mandatory.**
2. **Pre-auth browser errors** `error_logs` me nahi jaate (auth-required), console par dikhte hain.
3. ~~**`/batches` route abhi ALL_ROLES hai**~~ ✅ **RESOLVED (Task 4, commit `fa86497`)** — route ab CC+Clerk only; Ustad/QM ko "Access Denied" milega; globalSearch bhi sync. *Write actions pehle se screen-level CC-gated + rules-level the.*
4. Failed-login spike automation rule ko ab sirf post-auth failures milte hain (degraded, broken nahi).

## Rollback

| Method | Command / Path |
|---|---|
| **Console (instant)** | Firestore → Rules → Previous versions → Restore |
| **Git (2 min)** | `git revert 85e5803` → `firebase deploy --only firestore:rules,storage` |
| **Tag (3 min)** | `git checkout v1.0-security-rules` → inspect → `firebase deploy --only firestore:rules,storage` |
| **Pre-deploy backup file** | ✅ **`backups/firestore-rules-pre-task2-backup-2026-07-31.rules`** — owner ne 31-Jul-2026 ko console rules tab se verbatim copy karke bheja; repo me committed (rollback text hamesha available). Console → Firestore → Rules → ye pura text paste → Publish = instant rollback. WARNING: ye purane rules "any logged-in user = full access" hain — sirf temporary rollback ke liye. |
| **App-side** | BatchContext change independent hai; revert optional |

**Rollback procedure (owner-refined full loop):** ① Console/Git/Tag/backup se previous rules restore → ② 2–3 critical smoke (login + read + write) rollback ke baad expected PASS verify → ③ original rules dubara restore karke forward-deployment confirm → ④ incident note doc → ⑤ mujhe report. *(Recovery verified nahi = rollback tested nahi.)*

## Next Planned Work (unlock order)

1. ✅ **Task 4 — Role Permission Fixes (CODE COMPLETE, commit `fa86497`)** — `/batches` route tightening + globalSearch sync + reusable `src/hooks/usePermission.ts` hook (pehla consumer: BatchManagementScreen). Baaki screens ka action-gate sweep jaan-boojhkar incremental rakha gaya hai (sab kuch ek saath badalna = blind-break risk). Owner ke "apne hisaab se sab complete karo" instruction par gates se pehle code push hua hai — deploy/test PC par verify hoga.
2. Phase 2: Error Boundary → Authentication Hardening (failed-login lockout + server-side login logging CF) → Cloud Functions → Audit Logs expansion

---
*Code-freeze discipline: is release ke baad bhi next code tabhi jab verification chain prove ho — Code → Test → Verify → Deploy → Observe → next feature.*
