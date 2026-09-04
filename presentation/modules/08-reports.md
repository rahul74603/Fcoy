# Module — Reports Centre (`/reports`)

**Priority: P0 — the closing screen of every demo. Officers judge software
by what it can hand them on paper.**

**Who:** Company Commander, Clerk, Quarter Master and Ustad (`ALL_ROLES`).
Not trainees, not SO.

**Source file:** `src/features/system/ReportsScreen.tsx` (2,174 lines)

**Verification:** CONFIRMED — all 20 report generators traced.

---

## 1. The Big Idea

> "Bees taiyaar report. Ek click me Excel, ek click me print. Officer ne
> maanga, do minute me haath me."

---

## 2. Twenty Reports in Five Categories

### 📋 Trainee Management (4)
| Report | Contents |
|---|---|
| Master Trainee List | The full nominal roll |
| Daily Attendance | Attendance for a chosen day |
| Absent / Sick / Leave Report | Everyone away, with reasons |
| Batch Roster | Batch-wise strength |

### 📦 Inventory / Quarter Master (2)
| Report | Contents |
|---|---|
| Live Stock Report (Item-wise) | Purchased, issued, available per item |
| Kit Issue Register | Who received what, when |

### 💰 Finance — 4 Funds (4)
| Report | Contents |
|---|---|
| Fund Summary (All 4 Funds) | The consolidated picture |
| Collection Log | Every rupee received |
| Expense Log (with Item Names) | Every rupee spent — **with item names, not just amounts** |
| Vendor Dues Report | What is still owed, per vendor |

### 🎯 Training Performance (2)
| Report | Contents |
|---|---|
| FPT Results Report | Physical test results |
| Weekly Test Results | Weekly test performance |

### 👥 Staff Management — Instructors (8)
| Report | Contents |
|---|---|
| Staff Master List | Full staff nominal roll |
| Staff Status & Rank Summary | Strength by status and rank |
| Staff Attendance Report (Monthly) | Month-wise, year selectable |
| Leave Applications Report | All leave applications |
| Leave Balance Report (Yearly) | Yearly leave position |
| Duty Assignment Report | Who is on what duty |
| Subject Assignment Report | Which instructor teaches what |
| Instructor Category Summary | Instructor categories |

**What to say:**
> "Bees report — rangroot, stores, paisa, training aur staff. Har wo cheez
> jo mahine ke aakhir me officer maangta hai, pehle se bani hui hai. Koi
> naya format banane ki zaroorat nahi."

---

## 3. Two Output Formats

| Format | What happens |
|---|---|
| **EXCEL** | Downloads a `.csv` file, named with today's date — e.g. `Trainee_Master_2026-09-04.csv` |
| **PRINT** | Opens a formatted print view and **triggers the print dialog automatically** |

**Two quality details worth mentioning:**

1. **The CSV is written with a UTF-8 BOM.** In plain terms: Hindi and
   Devanagari text opens correctly in Excel instead of turning into
   gibberish. Someone tested this with real Hindi data.
2. **Print auto-fires.** You click Print and the dialog is already open.

**What to say:**
> "Excel me kholiye — Hindi bilkul saaf dikhegi, kabaad nahi. Ye chhoti
> baat lagti hai, lekin jo log Hindi me register likhte hain unke liye ye
> sabse badi baat hai."

---

## 4. Live Summary Bar

Above the reports sit eight live figures: **Trainees · Staff · Batches ·
Issues · Collections · Expenses · Balance · Vendor Due**.

Balance is colour-coded — green when positive, red when negative, with a
minus sign.

**Why a buyer cares:**
> "Report banane se pehle hi poori company ka summary upar dikh raha hai."

---

## 5. Report History

Every generated report is recorded with its **name, type, format and row
count**.

**What to say:**
> "Kaun si report kab bani, kitni rows thi — record rehta hai. Agar officer
> poochhe 'pichhle mahine wali report kahan hai', to pata chal jaata hai ki
> banayi gayi thi."

---

## 6. Filters

Reports respect the selected batch, and finance reports can be filtered by
fund (including a **💰 General Fund** option). Staff reports have their own
filter block, and the monthly staff attendance report takes a **month and
year**.

---

## 7. Module Report Buttons — reports where you are working

Beyond `/reports`, individual screens carry their own **module report**
button. The kit-issue screen, for example, exports stock items, purchased
units, issued units, available units, low-stock count and the selected
chest number — without leaving the screen.

**What to say:**
> "Report ke liye alag screen par jaana zaroori nahi. Jahan kaam kar rahe
> ho, wahin se report nikal sakti hai."

---

## 8. Demo Script (60 seconds — use this to close)

1. Open `/reports`. Point at the 20 report tiles. "Bees report, pehle se
   tayyar."
2. Point at the live summary bar. "Aur upar poori company ka haal."
3. Click **Master Trainee List → EXCEL**. The file downloads with today's
   date in its name.
4. **Open it.** Show the Hindi rendering correctly. This lands harder than
   any feature list.
5. Click **Fund Summary → PRINT**. The print dialog opens on its own.
6. Close with: *"Officer ne maanga, do minute me haath me. Aur poora record
   ki kaun si report kab bani."*

---

## 9. ⚠️ Do NOT Promise

- ❌ **"PDF export."** The formats are **CSV** and **browser print**. You
  can print-to-PDF from the browser dialog, but there is no server-side PDF
  generator. A `pdf.service.ts` file exists but is **not imported anywhere**
  — dead code. Never claim native PDF export.
- ❌ **"Scheduled or emailed reports."** Not implemented.
- ❌ **"Custom report builder."** The 20 reports are defined in code. Users
  cannot design new ones.
- ❌ **"Charts and graphs in reports."** Output is tabular.
- ❌ **"Digitally signed / letterhead reports."** The print view is
  formatted but not an official signed document.
- ❌ **"Report history across devices or users."** Do not claim it is a
  shared, permanent audit archive — for a true trail use the **Lekha-Jokha
  Register** (`/audit-log`).

---

## 10. Objection Handling

| They say | You say |
|---|---|
| "PDF chahiye" | "Print button se browser se hi PDF bana lijiye — ek extra click. Direct PDF export agle version me." Honest, and it does work. |
| "Apni report banani ho to?" | Twenty cover the standard requirements. A new format is a development change — do not promise self-service. |
| "Hindi me report aayegi?" | Yes — Hindi data exports correctly to Excel. Demo it; do not just say it. |
| "Har mahine apne aap ban jaaye?" | Not today. Manual generation only. |
