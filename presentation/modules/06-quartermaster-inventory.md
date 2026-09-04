# Module — Quarter Master: Inventory & Kit Issue

**Priority: P0 (kit issue) / P1 (inventory hub).**

**Who:** Company Commander and Quarter Master only (`QM_ROLES`). Clerks and
Ustads cannot open any of these screens.

**Source files:**
- `src/features/inventory/InventoryHubScreen.tsx` (84 L) — read-only hub
- `src/features/quartermaster/InventoryIssueScreen.tsx` (1,913 L) — kit issue
- `src/features/dashboard/QuarterMasterDashboard.tsx` (1,064 L)
- `src/features/quartermaster/MessBoySalaryScreen.tsx` (1,262 L)

**Verification:** CONFIRMED — including the atomic stock transaction, which
was traced line by line.

---

## 1. The Big Idea

> "Company ka saara saaman — permanent property alag, rangroot ka kit alag.
> Kaun sa saaman kitna aaya, kitna diya, kitna bacha, kiske paas hai — sab
> ek jagah, aur stock kabhi galat nahi ho sakta."

---

# PART A — INVENTORY HUB (`/inventory`)

## 2. A Deliberately Read-Only Screen

The Inventory Hub is a **view, not an editor**. Its own code comment says
so: *"Central read-only view over the two inventory ledgers. Mutations stay
in the specialised screens."* Every tab has an **"Open management screen"**
button that hands you off to the screen that can actually change things.

**Why a buyer cares:**
> "Dekhne ki jagah alag, badalne ki jagah alag. Galti se koi number badal
> nahi sakta. Jahan se badalna hai, wahi ek button se pahunch jaate ho."

## 3. Four Headline Numbers

| Stat | Meaning |
|---|---|
| 💰 **Asset valuation** | Total ₹ value of company property |
| ⚠️ **Low stock alerts** | Items at or below their minimum level |
| 👥 **Total issued items** | Units handed out to trainees |
| 🛡️ **Damaged units** | Damaged across the batch |

## 4. Three Ledgers (tabs)

| Tab | What it tracks | Columns |
|---|---|---|
| 🏛️ **Company Assets Ledger** | Permanent company property | Asset · Total purchased · **Active** · Damaged · Disposed · Valuation |
| 👟 **Training Kit Stock & Issue** | Trainee essentials | Item · Purchased · Issued · **Available** · Status |
| 📉 **Damage & Disposed Registry** | Loss, damage and disposal | filtered asset view |

**Two calculations worth quoting:**
- **Available = Purchased − Issued** (kit)
- **Active = Purchased − Damaged − Disposed** (assets)

Items at or below their minimum show a **LOW STOCK** badge; everything else
shows a green **OK**.

**What to say:**
> "Do alag cheezein alag rakhi gayi hain. Company ki permanent property —
> jaise furniture, equipment. Aur rangroot ka kit — joota, T-shirt, balti.
> Dono ka hisaab alag hota hai, isliye register bhi alag."

## 5. ⭐ Strict Batch Isolation

Every row is filtered by the currently selected batch. The screen states
this in the interface itself:
*"Header ke batch switcher se badlo — yahan do batches ka data kabhi mix
nahi hota."*

Legacy records that predate batch tagging are shown **only** when the
active batch is genuinely the active one — a deliberate safety rule.

**Why a buyer cares:**
> "Do batch ek saath chal rahe hain to unka saaman kabhi mix nahi hoga.
> Purane batch ka joota naye batch ke stock me nahi dikhega."

---

# PART B — ⭐⭐ KIT ISSUE (`/issue-kit`) — the technical showpiece

## 6. Fifteen Standard Training Items

Pre-defined so nobody has to type item names:

| Category | Items |
|---|---|
| 👞 **Footwear** (sized) | DM Shoes, PT Shoes, Ankle Shoes — sizes 5–13 |
| 👕 **Uniform** (sized) | PT T-Shirt — XS to XXXL |
| 🛏️ **Bedding** | Ground Sheet, Mosquito Net |
| 🍽️ **Mess items** | Plate, Glass, Mug, Mess Tin |
| 🪣 **Equipment** | Bucket, Water Bottle, Towel, Lock |

**Size-wise stock is tracked separately.** The system does not just know it
has 40 pairs of PT shoes — it knows how many size 8s are left.

**What to say:**
> "Sirf 'joote hain' nahi. Number 8 ke kitne bache hain, ye bhi pata hai.
> Kyunki asli dikkat yahi hoti hai — stock me joote hain, lekin us bande ke
> size ke nahi."

## 7. The Issue Flow

```
QM  →  /issue-kit  →  search by CHEST NUMBER
     ↓
Trainee card appears — name, chest no, what he already has
     ↓
QM adds items to a CART (item + size + quantity)
     ↓
Cart shows RECEIVED / IN CART / PENDING status per item
     ↓
QM clicks Issue
     ↓
════ ONE ATOMIC TRANSACTION ════
 · stock counters verified, then decremented
 · trainee record updated with issued items + issue date
 · an entry written to the issue ledger (issue_records)
   with chest no, platoon, items, units, value, issued-by, timestamp
════════════════════════════════
     ↓
Commander's dashboard: this trainee's KIT % improves,
and his health score rises accordingly
```

## 8. ⭐ The Atomic Transaction — the engineering proof point

This is the strongest technical claim in the whole product, and it is real.
The code comment states it plainly:

> *"The stock counters are verified & decremented inside a Firestore
> transaction. The trainee update and the issue-ledger write are staged in
> the SAME transaction, so either everything commits (counters + ledger +
> trainee) or nothing does — and two simultaneous issues can never drive
> stock below zero."*

**What to say (say this to any technical buyer):**
> "Do QM ek saath, do alag computer se, aakhri jodi joote issue kar rahe
> hain. Purane system me dono ko mil jaate — register me galat. Yahan ek ko
> milega, doosre ko saaf message aayega: **INSUFFICIENT STOCK**. Stock kabhi
> minus me nahi ja sakta. Ye guarantee code me likhi hui hai."

And the second half:
> "Aur agar beech me internet chala jaaye — to ya to teenon cheezein hoti
> hain (stock kam, trainee update, ledger entry), ya ek bhi nahi hoti.
> Aadha-adhoora record kabhi nahi banega."

**Why a buyer cares:** every store register in the world has the same
disease — the physical stock and the written stock stop matching. This is a
structural fix, not a promise to be careful.

## 9. ⚠️ Manual Recovery Only — an honest design choice, shown in the UI

The screen carries a visible blue banner: **"Manual Recovery Only"**, with
the explanation that **no recovery is auto-created** when kit is issued.
Recovery entries are created deliberately from the Recovery section.

**How to present this — it is a strength, not a gap:**
> "Kit dene se apne aap paisa nahi kat-ta. Kyunki har kit ki recovery nahi
> hoti — kabhi issue hota hai, kabhi replacement, kabhi damage. Isliye
> system khud faisla nahi karta. Recovery tabhi banti hai jab QM khud
> banata hai. Aur ye baat screen par likhi hui hai, chhupi nahi hai."

The interface repeats it at the point of action: *"Ready · Trainee profile
update hoga · Recovery auto-create nahi hogi"* and *"Assets excluded · No
auto recovery"*.

## 10. Kit Screen Stats

Top row: **Total Items · In Stock · Sized Items · Low Stock · Total Units**
Per-trainee: **Kit Items · Received · Pending**

A one-click **module report** exports stock items, purchased units, issued
units, available units, low-stock count and the selected chest number.

---

# PART C — MESS BOY SALARY (`/mess-boy-salary`)

## 11. Monthly Salary Register

A 1,262-line screen tracking mess-boy salaries **month by month**, with a
simple two-state status: **Paid** / **Pending**, and a month picker.

Salary payments flow into the fund figures, so a paid salary reduces the
balance shown on the funds dashboard. (See the finance module.)

**What to say:**
> "Mess boy ki tankhwah bhi usi hisaab-kitaab ka hissa hai. Kis mahine
> kisko diya, kitna baki hai — aur wo paisa fund me se apne aap ghata
> dikhta hai."

---

## 12. Demo Script (2 minutes)

1. `/inventory` → point at the four stats. "Ek nazar me poora store."
2. Switch tab to **Training Kit Stock & Issue**. Find a **LOW STOCK** badge.
   "System khud bata raha hai kya khatam ho raha hai."
3. Click **Open management screen** → lands on `/issue-kit`.
4. Search a **chest number**. Trainee card appears with what he already has.
5. Add PT Shoes → **pick a size**. Pause here: *"Size-wise stock alag
   track hota hai."*
6. Issue. Success message names the trainee and chest number.
7. Point at the **Manual Recovery Only** banner. "System chupke se paisa
   nahi kaat-ta."
8. Go to `/commander` → that trainee's kit percentage has moved.
9. Close with the atomic-transaction line (§8).

---

## 13. ⚠️ Do NOT Promise

- ❌ **"Barcode or QR scanning."** Not implemented. Search is by chest number.
- ❌ **"Automatic purchase orders when stock is low."** Low stock is an
  **alert only** — no reordering.
- ❌ **"Kit return / recovery on relegation or discharge."** Not verified.
- ❌ **"Recovery is deducted automatically."** The opposite is true and the
  screen says so (§9).
- ❌ **"Serial-number tracking for individual assets."** Assets are tracked
  by name and quantity, not per unit.
- ❌ **"Photographs of issued kit."** Not verified.
- ❌ Do not call the Inventory Hub an inventory *management* screen — it is
  read-only by design.
