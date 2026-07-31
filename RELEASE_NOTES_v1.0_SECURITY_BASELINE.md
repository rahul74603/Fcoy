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
| **Firestore Rules Version** | `v1.0` · content-hash `md5:ef8acd77cb43` |
| **Storage Rules Version** | `v1.0` · content-hash `md5:b34a6171d5aa` |
| **App Build** | tsc strict PASS · vite build PASS (11.14s, pre-existing chunk-size warning) |

> Hash-tip: future me `md5sum firestore.rules` ka output is hash se alag dikhe = rules me drift hua hai.

## Scope of This Release

| Item | Summary |
|---|---|
| Task 1 (`4a964a2`) | Leave approval security — `canManageLeaves` gate, 7 hook handlers + 6 UI points |
| Task 2 (`85e5803`) | `firestore.rules` — deny-by-default, 55/55 collections explicit, 10 reusable role helpers, append-only forensics, Task-1 server proof (`staff_leave` write = CC/Clerk) |
| Task 3 (`85e5803`) | `storage.rules` — trainee docs path CC/Clerk, 5MB cap, image/PDF only, synchronized role source |
| Owner decisions | D1: no-unauth-write (temporary) · D2: unitConfig/main public + secret-keys rule-blocked · D3: batches read all-auth |
| App-side change | Sirf `BatchContext.tsx` auth-gated listener (rules-readiness) — baaki `src/` zero change |

## Verification Evidence

| Gate | Result | Evidence |
|---|---|---|
| Emulator — Firestore suite (~70 assertions) | ⏳ PASS ☐ / FAIL ☐ | (local output yahan summarize/paste) |
| Emulator — Storage suite (7 blocks) | ⏳ PASS ☐ / FAIL ☐ | |
| Console Simulator — 10 scenarios (S1–S10) | ⏳ 10/10 expected | |
| Manual Smoke — 10 flows × 4 roles (M1–M10) | ⏳ 10/10 | |
| 48-hour watch — `error_logs` / `login_history` permission anomalies | ⏳ ZERO | |
| Deploy command used | `firebase deploy --only firestore:rules,storage` | |

## Known Limitations (is release me documented)

1. **Wrong-password attempts log nahi hote** (unauthenticated `login_history` write band hai — D1 owner decision). **Fix: Phase-2 Cloud Function (server-side logging) — mandatory.**
2. **Pre-auth browser errors** `error_logs` me nahi jaate (auth-required), console par dikhte hain.
3. **`/batches` route abhi ALL_ROLES hai** — Ustad screen khol sakta hai par write DB-level blocked hai; UI-gate **Task 4** ka scope.
4. Failed-login spike automation rule ko ab sirf post-auth failures milte hain (degraded, broken nahi).

## Rollback

| Method | Command / Path |
|---|---|
| **Console (instant)** | Firestore → Rules → Previous versions → Restore |
| **Git (2 min)** | `git revert 85e5803` → `firebase deploy --only firestore:rules,storage` |
| **Tag (3 min)** | `git checkout v1.0-security-rules` → inspect → `firebase deploy --only firestore:rules,storage` |
| **Pre-deploy backup file** | `backup-rules-YYYYMMDD.txt` (Step 4 checklist — deploy se PEHLE console rules copy karke save kiye the) |
| **App-side** | BatchContext change independent hai; revert optional |

**Rollback procedure:** ① Console se previous rules restore → ② 4 roles se quick smoke (login + ek action) → ③ incident note doc → ④ mujhe report.

## Next Planned Work (unlock order)

1. 🔒 **Task 4 — Role Permission Fixes** (`/batches` route tightening, residual action-gate sweep, reusable `usePermission` hook) — **sirf tab jab saare gates + 48h watch clear**
2. Phase 2: Error Boundary → Authentication Hardening (failed-login lockout + server-side login logging CF) → Cloud Functions → Audit Logs expansion

---
*Code-freeze discipline: is release ke baad bhi next code tabhi jab verification chain prove ho — Code → Test → Verify → Deploy → Observe → next feature.*
