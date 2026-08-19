# QUARTER MASTER MODULE BLUEPRINT (Updated — August 2026)

## Role Purpose

QM = inventory, kit issue, 4 funds, vendors, bills, recoveries, salary.

⚠️ QM trainee records VIEW kar sakta hai; personal information EDIT
nahi — DB rule `onlyKeys` sirf kit fields allow karta hai:
`issuedKitItems, lastKitIssueDate, kitIssued, issuedItems,
pendingRecoveryAmount, shoeSize, dressSize, updatedAt`.

QM ke paas nahi: user management, settings, batch create, documents,
trainee personal edit.

---

## Item Master (dynamic — koi hardcoding nahi)

Single source of truth: `src/features/quartermaster/qmCatalog.ts`
(14 base kit items + sizes) **+** `training_custom_items` collection
(runtime custom items). Inventory Issue screen aur Trainee Profile
दोनों YAHI master use karte hain — drift impossible.
Item names/IDs kabhi mat badlo — purane issue_records inhi se match hote hain.

---

## Stock Calculation (authoritative)

```
Current Stock = Purchased (training_fund_expenses quantities)
              − Issued (issue_records TRAINING_ESSENTIALS items)
```

Dashboard ka Live Stock Position isi se derive hota hai. Koi doosra
parallel stock system nahi banana.

---

## Kit Issue Flow (atomic)

Search chest/reg → trainee load → items+size select → Issue →
**ek writeBatch me**: trainee.issuedKitItems update + issue_record
create (traineeId, chestNo, items, qty, value, issuedBy, batchId,
serverTimestamp). Beech me fail = दोनों rollback.

---

## Fund System — 4 Funds

Mess Fund · Training Fund · Company Assets · General Fund
(+ fund_transfers between funds)

### Balance Formula (authoritative — collections me implemented)
```
Balance = Total Collection − Actually Paid − Transferred Out
Actually Paid = vendor entries ka paidAmount + non-vendor ka amount
Vendor Due   = sum(dueAmount)
```
(Purane doc me galat '*' symbol tha — multiplication kabhi nahi tha.)

### Recovery (training_fund_recoveries)
Expected / Paid / Due per trainee, partial payments supported,
trainee.pendingRecoveryAmount increment/decrement se sync.
Categories dynamic — koi hardcoded list nahi.

### Mess Cutting
Rate configuration screen-level hai; per-head collection entries
mess_fund_collections me. Hardcoded ₹-figures business docs me sirf
examples hain — actual entries dynamic.

### Bills
Expense create karte waqt bill OPTIONAL (baad me upload ho sakta hai).
Bill files → Cloudinary. Statuses: Pending / Uploaded / Verified.

### Mess Boy Salary
mess_boys + mess_boy_salaries; monthly records, fund se linked.

---

## QM Dashboard (`/quartermaster`) — Command Center

Hierarchy: STOCK → ISSUE → RECOVERY → MONEY → BILLS → RISK → ACTION

1. Header: greeting + QM name + batch + date
2. Grand Totals: Collection / Orders / Actually Paid / Net Balance /
   Vendor Dues / Pending Bills
3. **Needs Your Attention**: CRITICAL (negative fund, vendor dues,
   out-of-stock with shortage counts), ACTION SOON (low stock ≤5,
   pending bills), PENDING (un-kitted trainees, recoveries) — har
   alert par action button; All Clear state
4. **Kit Issue Coverage**: X/N trainees kitted (%), Issues Today,
   Kit Pending → Issue Kit
5. Today's strip: Collection / Expense / Stock received / Issues
6. **Live Stock Position** (dynamic table): har item ka
   Purchased / Issued / Available / **Required** (jinhe abhi nahi mila)
   / **Shortage** (kitna aur chahiye) / Status
   (OUT OF STOCK / CRITICAL / LOW / HEALTHY) + Inventory Health %
7. 4 Fund cards → Quick stats → Vendor Dues + Stock Alerts + Recovery
8. Modules · Recent Activity (15) · Balance Formula card · Salary card

---

## Reports (QM-visible categories)

Trainee Management (kit ke liye), Inventory/QM, Finance — 4 Funds.
Clerk/Ustad in finance reports ko dekh hi nahi sakte (UI + DB दोनों).
