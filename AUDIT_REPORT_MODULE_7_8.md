# 🛡️ F COY ERP — MASTER AUDIT REPORT (Module 7 & 8)

**Audit Date:** 30 July 2026
**Golden Rule Applied:** Kisi bhi existing feature ko remove/replace recommend nahi kiya gaya. Har feature pe: **Retain / Update / Refactor / Add New**
**Legend:** ✅ Available · 🟡 Partial · ❌ Missing | **★ = Is audit ke saath hi implement ho gaya**

---

# MODULE 7 — KIT ISSUE & RETURN MANAGEMENT

**Code base:** `InventoryIssueScreen.tsx` (~2,150 lines) + `stock_returns` ★ + trainee kit integration
**Note:** Ye module Module 6 (QM/Inventory) ke saath tightly integrated hai — kit = training essentials stock se issue hota hai. Ye design **sahi hai, Retain**.

## Feature-wise Audit

| # | Feature | Status | Recommendation |
|---|---------|--------|----------------|
| 1 | Kit Dashboard | ✅ | **Keep** — QM dashboard + Issue screen summary (6 cards) |
| 2 | Kit Templates | 🟡 | **Update** — FIXED_TRAINING_ITEMS hardcoded hai; DB-driven templates banana |
| 3 | Recruit Kit | ✅ | **Keep** — 14-item fixed recruit kit chal raha hai |
| 4 | Staff Kit | ❌ | **Add New** (Low) — abhi sirf trainee/recruit kit hai |
| 5 | Officer Kit | ❌ | **Add New** (Low) |
| 6 | Custom Kit | ✅ | **Keep** — custom items fund screens se + issue mein merge |
| 7 | Dynamic Kit Templates | ❌ | **Add New** (High) — `kit_templates` collection |
| 8 | Individual Item Issue | ✅ | **Keep** — cart se single item bhi |
| 9 | Complete Kit Issue | ✅ | **Keep** — saare items cart mein daal sakte hain |
| 10 | Partial Kit Issue | ✅ | **Keep** — subset issue, pending track hota hai |
| 11 | Pending Kit | ✅ | **Keep** — KitStatusPanel RECEIVED/PENDING + progress bar |
| 12 | Kit Completion % | ✅ | **Keep** — trainee profile + KitStatusPanel % |
| 13 | Auto Kit Calculation | ✅ | **Keep** — stock auto recompute post issue/return |
| 14 | Chest Number Based Issue | ✅ | **Keep** — chestNo search + slip pe chestNo |
| 15 | Batch Wise Issue | 🟡 | **Update** — batch-locked search hai; `issue_records` mein `batchId` add karna (backward compatible) |
| 16 | Platoon Wise Issue | 🟡 | **Update** — platoon record mein hai; platoon-wise report nahi |
| 17 | Size Wise Issue | ✅ | **Keep** — size required validation + size-wise stock |
| 18 | Uniform Size | ✅ | **Keep** — XS–XXXL |
| 19 | Shoe Size | ✅ | **Keep** — 5–13 |
| 20 | Cap Size | ❌ | **Add New** (Medium) — size list mein nahi |
| 21 | Belt Size | ❌ | **Add New** (Medium) |
| 22 | Issue Slip | ❌→✅ ★ | **Implemented** — auto slip post-issue, sarkari format, print |
| 23 | Issue Receipt | ❌→✅ ★ | **Implemented** — wahi slip = receipt (receiver signature block) |
| 24 | Issue History | ✅ | **Keep** — merged view + per-entry expand |
| 25 | Return Entry | ✅ ★ | **Keep** — Return modal (qty/condition/reason) |
| 26 | Complete Return | ✅ ★ | **Keep** — full qty return |
| 27 | Partial Return | ✅ ★ | **Keep** — qty 1..issued capped |
| 28 | Replacement Issue | 🟡 | **Update** — re-issue possible hai; `issueType: 'REPLACEMENT'` flag add karna (damaged-return ke baad suggest) |
| 29 | Lost Item Register | ❌ | **Add New** (High) — damaged=write-off hai; "Lost" aleg category + auto-recovery link |
| 30 | Damage During Return | ✅ ★ | **Keep** — condition=Damaged, reason mandatory, stock mein nahi aata |
| 31 | Condition Check | ✅ ★ | **Keep** — Good/Damaged toggle |
| 32 | Deposit System | ❌ | **Add New** (Low) — BSF TC mein rarely used |
| 33 | Security Deposit | ❌ | **Add New** (Low) |
| 34 | Approval Workflow | ❌ | **Add New** (Critical) — issue/write-off pe CC sign-off |
| 35 | Commander Approval | ❌ | **Add New** (Critical) |
| 36 | Quarter Master Approval | ❌ | **Add New** (High) |
| 37 | Issue Date | ✅ | **Keep** — issueDateISO har entry pe |
| 38 | Return Date | ✅ ★ | **Keep** — returnDateISO |
| 39 | Issue By | ✅ | **Keep** — issuedBy |
| 40 | Return Accepted By | ✅ ★ | **Keep** — returnedBy |
| 41 | Reason for Return | ✅ ★ | **Keep** — optional(Good)/mandatory(Damaged) |
| 42 | Reason for Replacement | ❌ | **Add New** (Medium) — replacement flag ke saath |
| 43 | Remarks | 🟡 | **Update** — issue pe remarks field add karna |
| 44 | Pending Return | 🟡 | **Update** — expected-return-date ka concept nahi; add karna hoga |
| 45 | Overdue Return | ❌ | **Add New** (Medium) — due date + overdue aging |
| 46 | Kit Verification | 🟡 | **Update** — physical kit check sheet nahi |
| 47 | Kit Audit | ❌ | **Add New** (High) — periodic kit audit workflow |
| 48 | Barcode Ready | 🟡 | **Update** — item id/slug stable hai; barcode field nahi |
| 49 | QR Ready | 🟡 | **Update** — slip No QR-ban sakta hai (slip pe print ★ done data-wise) |
| 50 | Search | ✅ | **Keep** — trainee + item + global search |
| 51 | Advanced Filters | 🟡 | **Update** — issue history filters (date/platoon) |
| 52 | Dashboard Cards | ✅ | **Keep** — 6 stock cards + Returns card ★ |
| 53 | Today's Issue | 🟡 | **Update** — data hai; card nahi |
| 54 | Today's Return | 🟡 | **Update** — data hai; card nahi |
| 55 | Pending Kit (dash) | ✅ | **Keep** — trainee profile alerts |
| 56 | Pending Return (dash) | ❌ | **Add New** (Medium) — due-date feature ke saath |
| 57 | Low Stock During Issue | ✅ | **Keep** — issue-time block + amber stock |
| 58 | Issue Report | 🟡 | **Update** — slip ★ per issue; consolidated printable report nahi |
| 59 | Return Report | 🟡 | **Update** — data + receipt ★; consolidated nahi |
| 60 | Pending Kit Report | 🟡 | **Update** — batch-wide print view nahi |
| 61 | Replacement Report | ❌ | **Add New** (Low) |
| 62 | Lost Item Report | ❌ | **Add New** (Medium) — Lost register ke saath |
| 63 | Batch Wise Report | 🟡 | **Update** — batchId add hone ke baad |
| 64 | Trainee Wise Report | 🟡 | **Update** — profile kit tab print nahi |
| 65 | Firestore Collections | ✅ | **Keep** — issue_records + stock_returns ★ |
| 66 | Data Relationships | ✅ | **Keep** — trainee ↔ issue ↔ stock computed |
| 67 | Security Rules | ❌ | **Add New** (Critical) — ruleset repo mein nahi |
| 68 | Role Based Access | ✅ | **Keep** — QM + CC only |
| 69 | Performance | 🟡 | **Refactor** — full-collection reads; indexes + pagination baad mein |
| 70 | Lazy Loading | 🟡 | **Update** — route-level code splitting pending |
| 71 | Audit Trail | ✅ | **Keep** — issuedBy/returnedBy + timestamps + slip no ★ |
| 72 | Activity Log | 🟡 | **Update** — unified ledger view pending |
| 73 | Cross: Trainee | ✅ | **Keep** — profile kit tab live |
| 74 | Cross: Inventory | ✅ | **Keep** — same engine |
| 75 | Cross: Finance | ✅ | **Keep** — purchases link; recovery link manual (by design) |
| 76 | Cross: Dashboard | ✅ | **Keep** |
| 77 | Cross: Reports | 🟡 | **Update** — printable kit reports pending |

### 📊 MODULE 7 SCORES
| Metric | Score |
|---|---|
| Overall | **74/100** |
| Feature Completion | 74% |
| UI | 82 |
| Code | 78 |
| Database | 76 |
| Architecture | 72 |
| Security | 58 (rules missing) |
| Performance | 68 |
| Scalability | 64 |
| Government ERP | 72 (slip ★ ke baad strong) |

### Top 10 Existing Features Worth Keeping (M7)
1. Batch-locked chestNo trainee search
2. Size-wise negative-stock prevention
3. Merged issue history with expand
4. KitStatusPanel progress (RECEIVED/PENDING)
5. Return register with auto stock-restore ★
6. Auto stock computation (purchases−issues+returns)
7. Trainee profile kit tab integration
8. Manual-only recovery (no auto-charges — business rule sahi hai)
9. Custom items support
10. Issue/Return slip printing ★ (sarkari format)

### Top 10 Features That Need Updating (M7)
1. Kit templates → DB-driven
2. issue_records mein batchId
3. Replacement flag + reason
4. Overdue return (due date)
5. Today's Issue/Return cards
6. Consolidated printable registers
7. Remarks on issue
8. Unified kit ledger view
9. Platoon-wise issue report
10. Route lazy loading

### Top 10 Missing (M7)
1. **Approval workflow (CC sign-off) — Critical**
2. Security rules — Critical
3. Lost item register (+ auto-recovery link)
4. Kit audit workflow
5. Staff/Officer kits
6. Cap/Belt sizes
7. Pending-return dashboard widget
8. Deposit system
9. Barcode/QR scanning
10. Physical verification sheet

### Top 10 Critical Problems (M7)
1. Rules ke bina Firestore open risk
2. Issue pe koi approval nahi — QM directly issue kar deta hai
3. Lost items ka register nahi (financial loss track nahi hota)
4. Batch context issue_records mein nahi (audit mushkil)
5. Full-collection reads har refresh
6. item_master dead legacy (confusion) — ya to use karo ya formally deprecate karo
7. Consolidated kit registers print nahi hote
8. Replacement vs fresh issue distinguish nahi
9. Overdue tracking absent
10. Unified activity timeline nahi

### Top 10 Future Enhancements (M7)
1. Mobile QR scan for issue/return
2. Kit audit scheduler + variance report
3. Auto recovery suggestion on Lost/Damaged
4. Size-exchange wizard (return+issue single flow)
5. Platoon-wise bulk issue
6. Kit readiness % per batch (CC widget)
7. E-sign on slips
8. Offline issue queue (sync later)
9. AI demand forecast (stockEngine data se)
10. Photo evidence on damaged returns

---

# MODULE 8 — FINANCE & FUND MANAGEMENT

**Code base:** `FundsDashboard.tsx` + 4 fund screens + `vendors/*` + `MessBoySalaryScreen` + `BillUploadWidget/BillPreviewModal`

## Feature-wise Audit

| # | Feature | Status | Recommendation |
|---|---------|--------|----------------|
| 1 | Finance Dashboard | ✅ | **Keep** — FundsDashboard rich hai |
| 2 | Fund Management | ✅ | **Keep** — 4 funds with balances |
| 3 | General Fund | ✅ | **Keep** |
| 4 | Training Fund | ✅ | **Keep** — + recovery UI bhi |
| 5 | Mess Fund | ✅ | **Keep** — per-head cutting |
| 6 | Special Fund | 🟡 | **Update** — General fund isse cover karta hai; alag "special" nahi |
| 7 | Dynamic Fund Types | ❌ | **Add New** (Medium) — abhi 4 fixed |
| 8 | Income Entry | ✅ | **Keep** — collections with remarks |
| 9 | Expense Entry | ✅ | **Keep** — category + vendor + paid/due |
| 10 | Recovery Entry | ✅ | **Keep** — recoveries + training recovery UI |
| 11 | Recovery Categories | 🟡 | **Update** — reason free-text; category master nahi |
| 12 | Dynamic Financial Types | ❌ | **Add New** (Medium) |
| 13 | Dynamic Income Categories | 🟡 | **Update** — label free-text |
| 14 | Dynamic Expense Categories | ✅ | **Keep** — `mess_custom_categories` + training/assets custom items |
| 15 | Ledger System | 🟡 | **Refactor** — fund detail modal mein entries milti hain; proper ledger view nahi |
| 16 | Cash Book | 🟡 | **Update** — activity timeline ≈ day book; format/print nahi |
| 17 | Day Book | 🟡 | **Update** — date-wise filter + print chahiye |
| 18 | Transaction History | ✅ | **Keep** — recent activity (20) + fund modals |
| 19 | Opening Balance | ❌ | **Add New** (High) — opening balance entry nahi |
| 20 | Closing Balance | 🟡 | **Keep+Update** — live balance hai (auto); date-wise closing nahi |
| 21 | Auto Balance Calculation | ✅ | **Keep** — collections − paid − transfers |
| 22 | Per Head Recovery | ✅ | **Keep** — perHead × traineeCount auto (mess cutting) |
| 23 | Mess Recovery | ✅ | **Keep** — mess cutting + recoveries |
| 24 | Mess Boy Salary | ✅ | **Keep** — attendance×wage auto + **balance check pre-payment** (excellent) |
| 25 | Auto Salary Calculation | ✅ | **Keep** |
| 26 | Daily Wage Calculation | ✅ | **Keep** |
| 27 | Monthly Calculation | ✅ | **Keep** — monthLabel |
| 28 | Advance Payment | 🟡 | **Update** — vendor payments partial; advance flag nahi |
| 29 | Refund | ❌ | **Add New** (Medium) |
| 30 | Fine | 🟡 | **Update** — recoveries reason se chalta hai; type nahi |
| 31 | Penalty | 🟡 | **Update** — same as fine |
| 32 | Receipt Generation | ❌→✅ ★ | **Implemented** — Money Receipt print (collection rows) |
| 33 | Voucher Generation | ❌→✅ ★ | **Implemented** — Payment/Salary/Vendor/Transfer vouchers |
| 34 | Expense Approval | ❌ | **Add New** (Critical) |
| 35 | Income Approval | ❌ | **Add New** (High) |
| 36 | Approval Workflow | ❌ | **Add New** (Critical) |
| 37 | Commander Approval | ❌ | **Add New** (Critical) |
| 38 | Supporting Documents | ✅ | **Keep** — bill attachments |
| 39 | Bill Upload | ✅ | **Keep** — BillUploadWidget (base64 compress) |
| 40 | Invoice Upload | ✅ | **Keep** |
| 41 | Search | ✅ | **Keep** — fund screens + global search |
| 42 | Advanced Filters | 🟡 | **Update** — date-range/category filters add |
| 43 | Financial Dashboard Cards | ✅ | **Keep** — fund cards + vendor dues card |
| 44 | Today's Income | ❌→✅ ★ | **Implemented** — Aaj Ki Aamdani card |
| 45 | Today's Expense | ❌→✅ ★ | **Implemented** — Aaj Ka Kharcha card |
| 46 | Current Balance | ✅ | **Keep** — per fund + grand total |
| 47 | Pending Recovery | ✅ | **Keep** — due tracking (vendor dues + trainee recoveries count) |
| 48 | Pending Approval | ❌ | **Add New** (Critical — approval engine ke saath) |
| 49 | Charts | ❌ | **Add New** (High) — no charts in funds |
| 50 | Monthly Income | 🟡 | **Update** — data monthLabel se; chart nahi |
| 51 | Monthly Expense | 🟡 | **Update** |
| 52 | Recovery Analysis | 🟡 | **Update** |
| 53 | Fund Wise Analysis | ✅ | **Keep** — fund-wise cards + modal |
| 54 | Cash Book Report | ❌ | **Add New** (High) |
| 55 | Ledger Report | 🟡 | **Update** — print add karna |
| 56 | Recovery Report | 🟡 | **Update** |
| 57 | Expense Report | 🟡 | **Update** — printable nahi |
| 58 | Income Report | 🟡 | **Update** |
| 59 | Fund Report | ✅ | **Keep** — fund detail modal |
| 60 | Monthly Report | ❌ | **Add New** (High) |
| 61 | Yearly Report | ❌ | **Add New** (Medium) |
| 62 | PDF Export | 🟡 | **Update** — ★ print (browser→PDF) receipts ke liye; bulk export nahi |
| 63 | Excel Export | ❌ | **Add New** (High) |
| 64 | Firestore Structure | ✅ | **Keep** — fund-wise collections clean |
| 65 | Financial Collections | ✅ | **Keep** — 8 fund collections + transfers + recoveries + vendors |
| 66 | Security Rules | ❌ | **Add New** (Critical) |
| 67 | Role Based Permissions | ✅ | **Keep** — QM+CC |
| 68 | Audit Trail | 🟡 | **Update** — entries pe createdBy? kuch mein hai; sab transactions pe user-stamp chahiye |
| 69 | Activity Log | ✅ | **Keep** — recent activity timeline |
| 70 | Performance | 🟡 | **Refactor** — full reads; date-indexed queries baad mein |
| 71 | Scalability | 🟡 | **Refactor** — yearly archive strategy |
| 72 | Cross: Trainee | ✅ | **Keep** — chest-linked recoveries |
| 73 | Cross: Inventory | ✅ | **Keep** — purchases = stock in |
| 74 | Cross: Mess | ✅ | **Keep** — mess fund + mess boys |
| 75 | Cross: Reports | 🟡 | **Update** — printable reports pending |
| 76 | Cross: Dashboard | ✅ | **Keep** — QM/CC dashboards fund numbers |

### 📊 MODULE 8 SCORES
| Metric | Score |
|---|---|
| Overall | **73/100** |
| Feature Completion | 73% |
| UI | 80 |
| Code | 76 |
| Database | 80 |
| Architecture | 74 |
| Security | 56 (rules + approvals missing) |
| Performance | 66 |
| Scalability | 64 |
| Government ERP | 70 (vouchers ★ ke baad) |

### Top 10 Existing Features Worth Keeping (M8)
1. Auto balance computation (collections − paid − transfers)
2. Per-head mess recovery (perHead × trainees)
3. Mess boy salary with **pre-payment balance guard**
4. Vendor due engine (paid/due per bill)
5. Fund transfer system
6. Bill preview (zoom/rotate/download)
7. Bill upload with auto-compression
8. Fund detail modal (collections+expenses)
9. Recent activity timeline (5 types unified)
10. Receipt/Voucher printing ★ (amount-in-words sarkari format)

### Top 10 Features That Need Updating (M8)
1. Cash book / day book (date filter + print)
2. Ledger printable format
3. Recovery categories (master list)
4. Audit stamps on all transactions (createdBy)
5. Advance payment flag
6. Date-range filters
7. Charts on fund dashboard
8. Fine/Penalty transaction types
9. Excel export
10. Yearly archive/closing

### Top 10 Missing (M8)
1. **Approval workflow (expense/income CC sign-off) — Critical**
2. Security rules — Critical
3. Opening balance entries
4. Monthly reports (auto)
5. Excel/PDF bulk export
6. Cash book report
7. Pending approval dashboard
8. Refund flow
9. Dynamic fund types
10. Yearly reports

### Top 10 Critical Problems (M8)
1. Koi approval nahi — QM directly expenses post kar deta hai (govt audit flag)
2. Rules absent → financial data risk
3. Opening balances set nahi kar sakte (migration issue)
4. Transactions edit/delete pe audit trail kamzor
5. Negative balance possible at entry level? (salary guard hai, expense pe nahi — inconsistent)
6. Bill images base64 Firestore mein (doc size limit ~1MB) — Storage migration needed later
7. No period closing (month lock)
8. Cash book format govt-standard nahi
9. No export endpoints
10. Fund types hardcoded

### Top 10 Future Enhancements (M8)
1. Approval engine (pending_approvals + CC screen)
2. Auto monthly closing + lock
3. Excel/CSV exports everywhere
4. Cash book printed format (IAFA-style)
5. Budget vs actual tracking
6. Fund-wise charts (recharts reuse)
7. Recovery aging report
8. Vendor ledger statement print
9. Double-entry readiness (debit/credit narration)
10. FY-wise archive

---

# 🏆 FINAL COMPARISON

| Module | Completion % | Existing Features | Features to Update | New Features Required | Ready for Production |
|---|---|---|---|---|---|
| 7. Kit Issue & Return | **74%** | 28 strong (issue/return/sizes/stock/slip ★) | 21 | 16 new (approval critical) | 🟡 Almost — approval + rules ke baad |
| 8. Finance & Funds | **73%** | 30 strong (funds/vendors/salary/vouchers ★) | 22 | 17 new (approval + opening bal + exports) | 🟡 Almost — approval + rules ke baad |

## Priority Buckets
| Critical | 🚨 Approval workflow (M7+M8 dono), Security Rules, Opening balance, Negative-balance guard on expenses |
| High | Dynamic kit templates, Lost item register, Kit audit, batchId on issue_records, Cash book, Excel export, Charts, Monthly reports, Staff kit... |
| Medium | Cap/Belt sizes, Overdue returns, Replacement flag, Refund flow, Recovery categories, Dynamic fund types, Yearly reports |
| Low | Deposit system, Staff/Officer kits, Barcode/QR, Replacement report, Special fund split |

---

# 📌 FINAL IMPLEMENTATION STRATEGY

### ✅ KEEP AS IT IS (kuch mat chhedo)
- Batch-locked chestNo issue + negative-stock prevention
- Auto stock computation + return auto-restore ★
- Fund auto-balance engine + vendor due engine
- Per-head recovery + salary balance-guard
- Bill upload/preview widgets
- Recent activity unified timeline

### 🔄 UPDATE EXISTING (chhote, safe additions)
- `issue_records` + `batchId` field (additive)
- Replacement flag + issue remarks
- Today's issue/return cards (issue screen)
- Recovery category master; advance flag
- Date-range filters; ledger print via ★ printDocuments helper reuse
- Charts (recharts already in package.json!)

### ♻️ REFACTOR EXISTING (structure, baad mein)
- Fund screens mein shared transaction-table component extract (DRY)
- Bill images base64 → Firebase Storage migration (doc-size risk)
- Route-level lazy loading (bundle 2.3MB → split)
- Paginated queries bade collections pe

### ➕ ADD NEW FEATURE (priority order)
1. **Approval engine** — `pending_approvals` {module, action, payload, requestedBy, status} + CC approval screen (M7 issue/write-off, M8 expense/income)
2. **Security rules** (Firestore + Storage) — sabse pehle!
3. Opening balance entries per fund
4. kit_templates collection (dynamic kits)
5. Lost item register (+ recovery link)
6. Cash book / monthly report generators (★ print helper reuse)
7. Excel export utility
8. Expense negative-balance guard (salary guard jaisa)

---

# 🗺️ STEP-BY-STEP ROADMAP (breaking kiye bina)

**Step 0 ★ Done** — Return register, slips, vouchers, today cards, verification trail
**Step 1** Security Rules (rules sabke neeche foundation hai)
**Step 2** Approval engine (pending_approvals + CC screen) — M7/M8 dono plug-in
**Step 3** Expense balance-guard + createdBy stamps (consistency)
**Step 4** Opening balance entry per fund
**Step 5** kit_templates + template-based complete-kit issue
**Step 6** Lost register + auto-recovery suggestion
**Step 7** Cash book + monthly report (print reuse) + date filters
**Step 8** Charts (recharts) on Funds + QM dashboards
**Step 9** Excel export utility
**Step 10** Bill images → Storage migration + Month-end lock
**Step 11** Route lazy loading + pagination (performance pass)

> Har step independently shippable hai — existing flows ko touch kiye bina aage badhta hai.

---

# ✅ IS AUDIT KE SAATH IMPLEMENT HUA

| # | Feature | Module | Files | Type |
|---|---------|--------|-------|------|
| ★1 | **Kit Issue Slip** — auto post-issue, sarkari format (slip no, unit header, items, values, amount-in-words, 3 signature blocks), new-window print | 7 | `InventoryIssueScreen.tsx`, `printDocuments.ts` (new shared) | 🔄 Update existing |
| ★2 | **Kit Return Receipt** — return ke baad printable receipt (condition + reason) | 7 | same | 🔄 Update existing |
| ★3 | **Money Receipt generation** — har collection row pe print | 8 | `FundsDashboard.tsx` | 🔄 Update existing |
| ★4 | **Payment/Salary/Vendor/Transfer Vouchers** — 4 voucher types, proper title+signatures | 8 | same | 🔄 Update existing |
| ★5 | **Aaj Ki Aamdani / Aaj Ka Kharcha** cards | 8 | same | 🔄 Update existing |
| ★6 | Shared `printDocuments.ts` (numberToWordsINR + gov format) — future reports isi pe | 7+8 | new shared helper | ➕ Foundation |

> Koi delete/replace nahi — golden rule followed. TSC clean ✅ Build pass ✅
