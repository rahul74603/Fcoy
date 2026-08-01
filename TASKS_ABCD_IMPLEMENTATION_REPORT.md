# 📋 TASKS A·B·C·D + TASK-4 — IMPLEMENTATION REPORT

> **Date:** 01-Aug-2026 · **Branch:** `arena/019fb3d1-fcoy`
> **Owner instruction:** "A B C D ese hi kro ek ek kar k sab kuch" + "apne hisab se sab complete kr k push kr do — me pc par jaunga tab ek sath sab test kr lenge"
> **Har task: alag commit · tsc PASS · vite build PASS · GitHub push ho chuka**

---

## Commits (order me)

| # | Commit | Kya |
|---|---|---|
| A | `5283018` | Batch switch (Set Active) — reversible |
| B | `550c041` | Seed/Sync/Cleanup/Reset — Developer-only lock (Dev Mode) |
| C+D | `9af97f3` | Inventory damage counting + Damage Register + purchase date + hamesha-active |
| 4 | `fa86497` | `/batches` route tightening + reusable `usePermission` hook |
| docs | (is report ke saath) | Release notes: C-R1 hash v1.1 + limitation #3 resolved |

---

## Task A — Batch Switch (➕ ADD)

**Mang:** "batch me jakar batch switch karne ka option do taki koi detail dekhna ho to chala le"

**Kya bana:**
- `BatchContext.tsx` → `switchActiveBatch(batchId, userId)` — atomic `writeBatch`:
  1. current active batch → `completed` (archive, data safe)
  2. target batch → `active`
  3. `config/activeBatch` sync (saari screens isi ko follow karti hain)
- Safety: dev/test batch ko kabhi real active nahi banaya ja sakta (guard + error message).
- `BatchManagementScreen.tsx` → batch row click → detail panel → hara **【✓ Set Active】** button (sirf CC, sirf non-active real batch par) → confirmation modal (3 points: kya archive hoga, kya active hoga, **data delete NAHI hoga — reversible**).

**Test (PC):** Batch Management → purani completed batch row par click → detail panel → Set Active → Confirm → banner: "Batch X ab ACTIVE hai". Dobara wapas switch karke dekho — poora reversible. Batch Progress/Attendance ab nayi active batch dikhayengi.

---

## Task B — Seed Developer Lock (🔄 UPDATE)

**Mang:** "seed data wala system only Developer ko dikhe"

**Kya bana:**
- `SeedStaffData.tsx` → Sections 1–4 (Seed, Sync & Fix, Cleanup, ☢️ Nuclear Reset) + Logs ab `isDevMode()` gate ke andar.
- Dev Mode OFF par: **🔒 "Seed Tools Locked — Developer Only"** dashed panel.
- **DevTestLabSection hamesha visible** — Dev Mode ka ON/OFF toggle usi ke andar hai (warna lock ke andar chaabi reh jaati — chicken-and-egg).
- Pehle se maujood gates intact: route `/seed-staff` CC-only + `enableSeedTools` Firestore flag.

**Test (PC):** Dev Mode OFF → seed page → locked panel + Dev Test Lab dikhe. Dev Test Lab se Dev Mode ON → page reload → tools unlock. Dev Mode OFF → phir locked.

---

## Task C — Damage Counting + Damage Register (➕ ADD)

**Mang:** "agar 20 items hai 2 damage hai to damage me dikhe and 18 active dikhe"

**Important code-truth (Rule-3 evidence):** Stock math pehle se **sahi** tha — `currentStock = Purchased − Issued + GoodReturns`. Damaged item issue ke time hi stock se kat chuka hota hai (issue_records immutable ledger), isliye damage ko stock se dobara minus karna = **double-count bug**. Jo missing tha: **counting DIKHTI nahi thi.** Wahi fix kiya — math ko haath nahi lagaya.

**Kya bana (`InventoryIssueScreen.tsx`):**
- Naya **【⚠ Damage Register (Write-off)】** section (summary cards ke neeche, collapsible):
  - Header chip: `X items · Y entries`
  - Table: Date · Item · Size · Qty · Trainee (naam + Chest No.) · Reason · Returned By
  - Empty state: "✓ Abhi tak koi damaged item nahi"
- Item dropdown card me: `Purchased: 20 · Issued: 5 · **Damaged: 2**` (red) + stock chip ab **`N Active`**.
- 20 items → 2 damage → register me 2 dikhenge, stock chip **18 Active** dikhayegi (agar 2 hi issued the).

**Test (PC):** Stock/Issue screen → trainee search → koi item return karo condition **Damaged** + reason → Damage Register me entry turant aaye (Refresh Stock dabao).

---

## Task D — Purchase Date + Hamesha Active (➕ ADD)

**Mang:** "inventory stock hamesha active rahengi only purchase date ke sath"

**Kya bana:**
- `purchasedMap` me `latestDate` tracking (`training_fund_expenses.date` ISO field).
- Item dropdown card me **`Last Purchase: 26 Jul 2026`** (purple).
- Header note: **"Inventory batch-independent — hamesha active, purchase date ke saath badhti rahegi"**.
- Formula clarified: `Stock = Purchased − Issued + Good Returns`.

**Test (PC):** Training Fund se koi naya purchase add karo → Stock screen item card par Last Purchase date update ho.

---

## Task 4 — Role Permission Fixes (code complete)

**Scope (release-notes se):** `/batches` route tightening + reusable hook. Residual sweep jaan-boojhkar incremental (blind-change = break risk).

**Kya bana:**
- `src/hooks/usePermission.ts` (NEW) — ROLES consts, `canAny()` (CC auto-override), `only()` strict, ready combos (`canManageBatches` etc.). Ye hook ka **pehla consumer** `BatchManagementScreen` hai.
- `App.tsx` `/batches`: `ALL_ROLES` → `CLERK_ROLES` — **Ustad/QM ko ab "Access Denied"**; CC+Clerk chalega (Clerk ka Batch-View legit hai; writes andar CC-gated + rules-level).
- `globalSearch/searchConfig.ts` — `p-batches` roles sync.
- Sidebar pehle se sirf CC+Clerk ko link dikhati thi — change ki zaroorat nahi padi (verified).

**Test (PC):** CC/Clerk login → /batches chale; (agar test Ustad/QM account ho) /batches URL seedha kholne par Access Denied aaye.

---

## 🖥️ PC PAR EK-SAATH TEST — STEP BY STEP

PowerShell kholo, ye paste karo:

```powershell
cd C:\Users\Rahul\Fcoy
git pull origin arena/019fb3d1-fcoy
firebase deploy --only firestore
npm run dev
```

**Expected:** pull me "Fast-forward" + naye commits dikhen; deploy me "✔ Deploy complete!"; dev server `http://localhost:5173`.

> ⚠️ `firebase deploy` zaroori hai — C-R1 rules correction (Batch Progress fix) abhi sirf code me hai.

**Phir browser me ye 7 checks (CC login se):**

| # | Check | Expected |
|---|---|---|
| 1 | Batch Management → purani batch row-click → **Set Active** | confirm modal → switch → success banner; wapas bhi ho |
| 2 | Dev Mode OFF → seed page | 🔒 locked panel + Dev Test Lab dikhe |
| 3 | Dev Test Lab → Dev Mode ON | reload → seed tools unlock |
| 4 | Stock screen → Damage Register section | section + chip counts dikhen |
| 5 | Kisi item ka damaged return (reason ke saath) | register me entry + item card red "Damaged: N" |
| 6 | Item dropdown | `N Active` chip + purple `Last Purchase` date |
| 7 | Batch Progress screen | "No Active Batch" error GAYAB (rules deploy ke baad) |

**Agar kuch toote:** `git log --oneline -6` ka photo bhejo + jo error aaye wo paste karo. Har task ka rollback simple hai: `git revert <commit>` → push.

---

*Golden Rule follow hua: ✅ KEEP existing flows · 🔄 UPDATE gates/display · ➕ ADD new features — koi working feature remove/break nahi hua. Har commit se pehle `tsc --noEmit` + `vite build` PASS.*
