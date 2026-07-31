# 🚦 RULES DEPLOY-GATE CHECKLIST (Task 2 → Production)

> **Owner workflow (locked):** Local emulator tests → PASS output share → Console Simulator scenarios → Manual smoke (4 roles) → Staged deploy → 48h watch → tabhi Task 4.
> **Gate rule:** Har box tick hone ke bina production deploy NAHI. Kisi bhi step par FAIL aaye to poora output yahan paste karo — main turant fix dunga.

---

## STEP 0 — Prerequisites (ek baar)

```bash
java -version        # 11+ chahiye. Nahi hai to:
#   Ubuntu/Debian : sudo apt install default-jre
#   Windows       : https://adoptium.net → Temurin 17
#   Mac           : brew install --cask temurin

cd <Fcoy repo folder>
git checkout arena/019fb3d1-fcoy && git pull origin arena/019fb3d1-fcoy
npm install
npx firebase login   # (agar pehle se logged in nahi ho; test real project touch NAHI karta)
```

## STEP 1 — ☐ Emulator Test Suites (MANDATORY GATE #1)

```bash
npm run test:rules
```

**PASS expectation:**
```
✓ tests/rules/firestore.rules.test.ts (~35 tests)
✓ tests/rules/storage.rules.test.ts   (7 tests)
Test Files  2 passed (2) · Tests  ~42 passed (42)
```

| Result | Action |
|---|---|
| Sab PASS | Output yahan paste karo → Step 2 |
| FAIL aa jaye | **Deploy mat karna.** Full output paste karo — main fix karke naya commit dunga |
| `firebase: command not found` | `npm install` dobara; ya `npx firebase emulators:exec --only firestore,storage --project demo-fcoy "npx vitest run tests/rules"` |
| Java error | Step 0 ka Java install check |

---

## STEP 2 — ☐ Console Rules Simulator (MANDATORY GATE #2)

**Kahan:** Firebase Console → Firestore Database → **Rules** tab → `firestore.rules` ka content paste → **"Simulator"** button (deploy NAHI karna abhi — sirf simulate).

**⚠️ Zaroori nuance:** Hamari rules role `users/{uid}` doc se padhti hain — Simulator **real database** ke against evaluate karta hai. Isliye pehle Firestore → `users` collection kholkar **har role ka ek REAL uid note karo:**
`<cc-uid>` `<clerk-uid>` `<qm-uid>` `<ustad-uid>`

Har scenario me: Simulation type set karo → Location likho → Auth toggle ON/OFF + uid daalo → **Run** → Expected column match hona chahiye.

| # | Setup | Location | Expected | Kyon |
|---|---|---|---|---|
| S1 ⭐ | update, Auth=ON, uid=`<ustad-uid>` | `staff_leave/<koi-real-leave-id>` (data: `status:'approved'`) | **DENY** | Task-1 server proof |
| S2 | update, Auth=ON, uid=`<clerk-uid>` | wahi | **ALLOW** | Clerk approve legit |
| S3 | update, Auth=ON, uid=`<cc-uid>` | wahi | **ALLOW** | CC override |
| S4 | get, Auth=ON, uid=`<ustad-uid>` | `staff_leave/<id>` | **ALLOW** | view-only access |
| S5 | get, Auth=ON, uid=`<qm-uid>` | `trainees/<koi-real-trainee-id>` | **ALLOW** | kit-issue search |
| S6 | create, Auth=ON, uid=`<qm-uid>` | `trainees/test-doc` | **DENY** | trainee write = CC/Clerk |
| S7 | get, Auth=ON, uid=`<ustad-uid>` | `medicalRecords/<id>` | **DENY** | PII = CC/Clerk only |
| S8 | get, Auth=OFF | `unitConfig/main` | **ALLOW** | D2 public branding |
| S9 | create, Auth=OFF | `login_history/test` | **DENY** | D1 no-unauth-write |
| S10 | create, Auth=ON, uid=`<cc-uid>` | `unknown_collection/test` | **DENY** | catch-all (CC ke liye bhi) |

> S10 ka tip: agar Simulator CC ko bhi unknown collection allow dikhaye → catch-all rule deploy-hone par order/gap issue hai — ruk jao, mujhe batao.

## STEP 3 — ☐ Rules PUBLISH karna (sirf Step 1+2 PASS ke baad)

Console me **Publish** dabao YA CLI: `firebase deploy --only firestore:rules,storage`

## STEP 4 — ☐ Manual Smoke Test (MANDATORY GATE #3) — app kholo, har role se login

| # | Role | Flow | Pass condition |
|---|---|---|---|
| M1 | CC | Login → Commander dashboard | poora load (koi permission error nahi) |
| M2 | CC | System Health cockpit | pings + security stats aaye |
| M3 | Clerk | Trainee search → profile → document upload | Storage upload succeed |
| M4 | Clerk | Trainee attendance mark / staff-leave approve (pending ho to) | save succeed |
| M5 | Clerk | Batch page open + edit attempt | save succeed (Clerk manage) |
| M6 | QM | Kit issue flow → trainee search → issue | trainees list aaye + issue save |
| M7 | QM | Stock/returns page | balances aaye |
| M8 | Ustad | `/staff-leave` open | subtitle "view only", koi action button nahi |
| M9 | Ustad | Bell kholo → kisi notification par mark-read | readBy update succeed |
| M10 | Sab | Browser console (F12) kholo | `permission-denied` errors ZERO (pre-existing warnings ignore) |

**Koi bhi permission error dikhe → screenshot + console log paste karo. Fix rules-side hoga, app code nahi.**

### STEP 4.5 — ☐ GIT TAG (deploy + smoke PASS hone par — 48h watch SHURU hone se pehle)

Known-good security baseline ka pointer — future me Task 4/5/AI me kuch toote to isi par instant wapas:
```bash
git tag -a v1.0-security-rules -m "Known-good security baseline: firestore+storage rules live & smoke-verified (Task-1/2/3). Pre-Task-4."
git push origin v1.0-security-rules
```
Rollback use (kabhi zarurat pade to): `git checkout v1.0-security-rules` (inspect) ya `git revert` us point ke baad ke commits.
*(Optional second tag 48h clean watch ke baad: `v1.0-security-stable`.)*

## STEP 5 — ☐ 48-hour Watch (MANDATORY GATE #4)

- `error_logs` collection (System Health → Error Feed) me permission-denied spike?
- `login_history` me FAILED with reason `PERMISSION_DENIED`?
- Normal usage me CC/Clerk/QM/Ustad se daily kaam confirm.

---

## 🛟 BACKUP / ROLLBACK (deploy se PEHLE 2 minute ka kaam)

1. **Current rules bachao:** Console → Firestore → Rules → **poora current content copy** karke locally save karo: `backup-rules-YYYYMMDD.txt` (ye tumhara true rollback point hai — abhi jo deployed hai wahi baseline).
2. Git rollback: `git revert 85e5803` + `firebase deploy --only firestore:rules,storage`
3. Console rollback: Rules → **"Previous versions"** dropdown → pehla version → Restore (1-click, instant).
4. BatchContext change app-side independent hai — usko chhoone ki zarurat rollback me nahi.

---

## ✅ GO / NO-GO CRITERIA

| Gate | Status |
|---|---|
| Emulator suites PASS (local) | ☐ |
| Simulator 10/10 expected | ☐ |
| Smoke 10/10 (4 roles) | ☐ |
| Backup file saved | ☐ |
| **Git tag `v1.0-security-rules` created + pushed** | ☐ |
| 48h watch clean | ☐ |
| **`RELEASE_NOTES_v1.0_SECURITY_BASELINE.md`** ke ☐ fields fill + commit | ☐ |
| → **PRODUCTION STABLE + Task 4 unlock** | 🔒 |

**Process note (owner ka decision, main follow karta hoon):** Rules ke runtime verification ke bina koi naya code-task start nahi hoga — single moving target, instant root-cause.
