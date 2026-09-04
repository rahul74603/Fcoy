# Module — Finance: The Four Funds & Vendors

**Priority: P0 — for a Quarter Master or an auditing officer, this is the
whole product.**

**Who:** Company Commander and Quarter Master only (`QM_ROLES`). No clerk,
ustad or trainee can open any finance screen.

**Source files:**
- `src/features/finance/FundsDashboard.tsx` (1,151 L)
- `src/features/trainingFund/TrainingFundScreen.tsx` (2,814 L)
- `src/features/finance/generalFund/GeneralFundScreen.tsx` (1,608 L)
- `src/features/finance/vendors/VendorPaymentScreen.tsx` (1,416 L)
- `src/features/finance/vendors/VendorManagementScreen.tsx` (979 L)
- `src/features/finance/vendors/VendorBillFormat.tsx` (410 L)
- `src/features/finance/shared/*` — bill preview, utils, constants

**Total: ~8,800 lines.** This is the deepest module in FCOY after training.

**Verification:** CONFIRMED — every formula below was read out of the code.

---

## 1. The Big Idea

> "Char alag-alag fund, har ek ka apna hisaab. Kitna aaya, kitna saaman
> liya, kitna paisa asal me gaya, kitna vendor ko dena baki hai, aur haath
> me kitna bacha. Har number ke peeche bill lagta hai."

---

## 2. The Four Funds

| Fund | Purpose | Route |
|---|---|---|
| 🍽️ **Mess Fund** | Food, mess cutting, mess expenses | `/mess-fund` |
| 🎓 **Training Essentials Fund** | Trainee kit and training items | `/training-fund` |
| 🏛️ **Company Assets Fund** | Permanent company property | `/company-assets-fund` |
| 💰 **General Fund** | Central reserve: surplus transfers, salaries, misc | `/general-fund` |

Each fund keeps **two ledgers** — a collections ledger and an expenses
ledger. Eight collections in total, plus a `fund_transfers` ledger.

The dashboard at **`/funds`** sits over all four.

**What to say:**
> "Paisa alag-alag maqsad ka alag rehta hai. Mess ka paisa training me
> nahi ja sakta bina record ke. Aur General Fund central reserve hai — jab
> kisi fund me surplus bachta hai wo yahan aata hai."

---

## 3. ⭐ Six Headline Numbers — and the honest one in the middle

The `/funds` dashboard opens with six figures. **The third one is the
selling point.**

| # | Card | Hindi hint on screen | Meaning |
|---|---|---|---|
| 1 | **Grand Collection** | — | Total money received across all four funds |
| 2 | **Total Orders** | *Saman ka total* | Value of everything ordered |
| 3 | **Actually Paid** | **"Paisa gaya"** | Money that has genuinely left |
| 4 | **Net Balance** | **"Cash in hand"** | What is actually left |
| 5 | **Vendor Dues** | *Vendor ko dena* | Still owed to suppliers |
| 6 | **Pending Bills** | — | Count of bills not yet received |

### The distinction that closes the sale

**"Total Orders" ≠ "Actually Paid".**

Most registers record what was *ordered* and quietly assume it was paid.
FCOY separates them. The calculation is explicit in code:

- If an expense is **against a vendor**, only the **`paidAmount`** counts
  as actually paid
- If it is a direct expense with no vendor, the **full amount** counts
- The unpaid remainder becomes **Vendor Due**

And the balance formula is printed **on the screen itself** for anyone to
check:

> **Net Balance = Grand Collection − Actually Paid − Transferred Out**

**What to say — this is the most persuasive line in the finance demo:**
> "Do lakh ka saaman order hua. Lekin vendor ko abhi sirf sattar hazaar
> diye. Purane register me dono ek jaise likhe jaate the, aur mahine ke
> aakhir me pata chalta tha ki paisa kam pad gaya. Yahan teen alag number
> hain — kitna order hua, kitna asal me gaya, aur kitna dena baki hai. QM
> ko hamesha sach dikhta hai."

**And the transparency point:**
> "Formula screen par likha hua hai. Kuch chhupa nahi hai. Koi bhi officer
> khud jodh kar dekh sakta hai."

---

## 4. Per-Fund Detail

Each of the four fund cards shows: collection, expense, total orders,
actually paid, **balance**, vendor due, entry count, pending bills, and
**transferred out**.

Clicking a fund opens a **detail modal** with two tabs —
**Collections** and **Expenses** — each with its own count. The modal
closes on **ESC** and shows the entry count in its footer.

**Small polish worth pointing at:** when a fund has no collections the
screen says **"Koi collection nahi"** in Hindi, not a blank table.

---

## 5. Fund Transfers

A dedicated `fund_transfers` ledger records movement between funds, and
every transfer is **subtracted from the source fund's balance** — it does
not silently vanish.

**Why a buyer cares:**
> "Agar mess fund ka surplus general fund me bheja, to mess fund ka balance
> apne aap kam ho jaata hai aur record me likha rehta hai ki kahan gaya.
> Paisa idhar-udhar nahi ho sakta."

---

## 6. ⭐ Bill Discipline — four statuses

Every expense carries a bill status:

| Status | Colour | Meaning |
|---|---|---|
| ⏳ **Pending** | amber | Bill not yet received |
| 📩 **Received** | blue | Bill in hand, not yet checked |
| ✅ **Verified** | green | Bill checked and accepted |
| ⬜ **No Bill** | grey | Explicitly recorded as having no bill |

The count of pending bills is a **headline number** on the dashboard.

**What to say:**
> "Har kharch ke saath bill ka status juda hai. Aur sabse achhi baat —
> 'No Bill' bhi ek option hai. Kabhi-kabhi sach me bill nahi hota. System
> aapse jhooth nahi bulwata, wo record karta hai ki bill nahi tha."

**Confirmed extras:** bills can be **uploaded and previewed inside the
app** (`BillPreviewModal`), images are **compressed automatically** before
storage, and there are enforced size limits (5 MB files, 800 KB PDFs).

---

## 7. Vendor Management (`/vendors`) & Payments (`/vendor-payments`)

- Vendors are stored with name, category and an active/inactive flag —
  **deactivate rather than delete**, so history survives
- Payments are filtered by status: **All / Pending / Partial / Paid**
  (defaults to **Pending** — you open the screen already looking at work)
- **Partial payments are first-class.** A bill can be half-paid; the
  remainder stays as vendor due
- Vendor dues are aggregated per vendor **and** per fund
- `VendorBillFormat.tsx` (410 lines) produces a **printable bill format**

**What to say:**
> "Vendor ko poora paisa ek saath dena zaroori nahi. Aadha diya to system
> jaanta hai ki aadha baki hai — aur wo number dashboard par upar dikhta
> hai. Bhoolne ka sawaal hi nahi."

---

## 8. QM Dashboard (`/quartermaster`)

A 1,064-line command view for the Quarter Master, with the same vocabulary
used consistently everywhere: Grand Collection · Collection · Expected ·
Actually Paid · Paid Out · Balance · Net Balance · Cash in hand · Pending ·
Pending Bills · Bills to verify · Kit Issues · Mess Boy Salary.

**Point at the language, not just the numbers:**
> "Poore system me ek hi bhasha hai. 'Paisa gaya' ka matlab har screen par
> ek hi hai. Naye QM ko sikhane me aadha ghanta lagta hai."

---

## 9. Mess Categories

The mess fund uses a **fixed category list** in code
(`FIXED_MESS_CATEGORIES`), with a separate set of vendor-facing mess
category keys — so mess spending is classified consistently instead of
free-typed every month.

---

## 10. Demo Script (2 minutes)

1. `/funds`. Let the six numbers land. Say nothing for two seconds.
2. Point at **Total Orders** and then **Actually Paid**. Deliver the §3
   line — order vs payment. **This is the moment.**
3. Point at the formula printed on screen. "Chhupa kuch nahi hai."
4. Click a fund → modal opens with Collections / Expenses tabs.
5. Show an expense with a **Pending** bill status. "Bill abhi aaya nahi."
6. Press **ESC** to close. Small, but people notice.
7. `/vendor-payments` → it opens on **Pending** already. Show a **Partial**
   payment.
8. Land it: *"Kitna aaya, kitna order hua, kitna gaya, kitna dena baki hai,
   aur kitna bacha — paanch alag sach, paanch alag number."*

---

## 11. Objection Handling

| They say | You say |
|---|---|
| "Audit ke liye chalega?" | Every entry has a date, an amount, a bill status and an uploaded bill. Bills can be previewed in-app and reports exported. |
| "Balance galat ho gaya to?" | The formula is on screen and every entry is listed. Trace it back yourself. |
| "Bank se connect hota hai?" | **No.** Honest answer: no bank integration. Entries are recorded, not fetched. |
| "GST / tax calculation?" | Not implemented. Do not promise. |
| "Kya QM paisa chhupa sakta hai?" | Every entry is scoped to a batch and carries who and when. And CC sees all four funds too. |

---

## 12. ⚠️ Do NOT Promise

- ❌ **"Bank integration or auto-reconciliation."** Does not exist.
- ❌ **"GST, TDS or tax computation."** Not implemented.
- ❌ **"Approval workflow for expenses."** An expense is recorded by the QM;
  there is no verified CC counter-approval step before it is saved.
- ❌ **"Budget limits or overspend blocking."** Not verified — nothing stops
  a fund going negative; it simply shows red.
- ❌ **"Automatic recovery from trainees."** Explicitly the opposite —
  recovery is manual by design (see the QM/inventory module).
- ❌ **"Digital signature on bills."** Not verified.
- ❌ Do not quote "Total Orders" as spending. Use **Actually Paid**.
