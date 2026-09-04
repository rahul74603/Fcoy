# FCOY — Feature Catalog

> **Purpose:** every confirmed feature in the product, with a buyer-value
> priority. Use this to decide what to show and what to skip.
>
> Priority is based on **buyer impact**, not technical complexity.

| Priority | Meaning |
|---|---|
| **P0** | MUST SHOW — the demo fails without these |
| **P1** | VERY GOOD TO SHOW — show if time allows |
| **P2** | SUPPORTING — mention, do not dwell |
| **P3** | BACKGROUND — only if specifically asked |

Verification tags: **CONFIRMED** · **PARTIAL** · **UI PRESENT — END-TO-END NOT VERIFIED** · **NOT VERIFIED**

---

## P0 — Must Show

### 1. Company Commander Dashboard — whole company on one screen
**Route:** `/commander` · **Role:** CC · **CONFIRMED**

Reads 18 collections in one load and builds a single command view:
attention board, funds, today & tomorrow schedule, away roster,
platoon strength, full trainee roster with 11 filters.

**Buyer value:** replaces the morning phone-round. One screen answers
"kaun nahi hai, kyu nahi hai, aaj kya hai, paisa kahan hai".

**Demo:** open it, scroll top to bottom, click one metric card.
**Detail:** `modules/02-cc-dashboard.md`

---

### 2. Connected approval — one action updates every register
**Route:** `/trainee-management` (clerk inbox) · **Role:** Clerk, CC · **CONFIRMED**

When a clerk approves a trainee's sick/leave report, the system writes to
`absentRecords`, `medicalRecords` (if medical), `traineeNotices`, and
updates the trainee's live status on the `trainees` document — in one action.

**Buyer value:** this is the strongest single argument in the product.
Manual triple-entry into three registers disappears, and the three can
never disagree with each other.

**Demo:** trainee submits → clerk approves → show the record appearing in
absent register, MI register and notice board.

---

### 3. Trainee self-service portal
**Route:** `/trainee-dashboard` · **Role:** Trainee · **CONFIRMED**

Trainee logs in and gets 7 tabs: Report · Today Special · Platoon View ·
Updates · Notice Board · Files · My Info. He can raise a sick/PT-miss/leave
report for himself, or a senior can raise it for another trainee. General
(non-trainee-specific) reports also supported — mess, kit, maintenance.

**Buyer value:** the trainee no longer has to physically find the clerk.
Reports arrive digitally with a timestamp and an audit trail.

**Demo:** submit a sick report as a trainee, then switch to clerk.

---

### 4. Today Special — the daily company newspaper
**Route:** `/today` · **Role:** everyone including trainees · **CONFIRMED**

A single news-style feed of everything that happened on a chosen day,
built from 7 sources (3 audit-log collections + absent + medical +
reports + notices + files + relegations). Every card answers four
questions: **kab / kisne / kya / kyu**.

Features: headline digest strip, 9 category filters, search across
name/chest/reason/actor, date navigator for past days, urgent cards
ringed in red.

**Buyer value:** total transparency with zero extra paperwork. Nobody
writes this report — the system assembles it.

**Demo:** open `/today`, read a headline, filter to "MI / Hospital",
step back one day.

---

### 5. AI agent with real tools
**Route:** `/ai-agent` · **Role:** **Company Commander only** · **CONFIRMED**

Not a chatbot. A tool-calling agent with **30 registered tools** against
live company data:

| Read tools | Write tools |
|---|---|
| `query_data`, `join_data`, `get_trainee`, `get_staff_info`, `get_attendance`, `get_training_schedule`, `get_stock`, `get_fund_balance`, `get_finance_summary`, `get_inspections`, `get_company_operational_summary`, `system_overview`, `describe_schema`, `sample_values`, `find_entity`, `resolve_date`, `get_context` | `add_trainee`, `create_trainees`, `add_record`, `update_record`, `update_trainee`, `delete_record`, `assign_chest`, `record_expense`, `issue_inventory`, `create_inspection`, `create_finding`, `submit_corrective_action`, `verify_finding` |

**Security:** per `.env.example`, production AI keys live in Firebase Cloud
Functions secrets — the browser never sees them. **CONFIRMED.**

**Buyer value:** the Commander can ask a plain-language question instead of
navigating menus, and can get work done by instruction.

**Demo:** ask "aaj kitne trainee absent hain?" then "chest 1002 ke baare
me sab batao".

---

### 6. Notifications that take you to the record
**Component:** notification bell (top bar, all screens) · **CONFIRMED**

Seven live-derived notification types:

| Type | Trigger |
|---|---|
| `leave_pending` | A leave request is awaiting CC decision |
| `leave_returning_soon` | Staff returning within 3 days |
| `duty_assigned` | Duties scheduled for today |
| `staff_hospital` | Staff currently in hospital |
| `schedule_upcoming` | Training sessions coming up |
| `deputation_new` | Active deputations |
| `trainee_report_pending` | Trainee report waiting for clerk |

Clicking a notification **navigates to the relevant record**. **CONFIRMED.**

**Important honesty note — PARTIAL:** notifications are **computed live**,
not stored in a collection. Read/unread state is kept in browser
`localStorage` (`bsf_read_notifications`), so it is **per device**, not per
user account. Mobile push notification: **NOT VERIFIED — do not promise.**

---

### 7. Leave management with real approval authority
**Routes:** `/staff-leave`, `/leave-management` · **CONFIRMED**

Only Company Commander can approve, reject or mark return. This is
guarded in **three independent layers**:

1. UI — the approve control is not rendered for other roles
2. Handler — `useLeave.ts` throws on unauthorised invocation
3. Firestore rules — protect `status`, `approvedBy`, `approvedByName`,
   `approvalDate`, `rejectionReason` (`LEAVE_APPROVAL_FIELDS`)

Approving also updates the staff member's status; cancelling an approved
leave reactivates them. **CONFIRMED.**

**Buyer value:** proves the product models *authority*, not just data entry.

---

## P1 — Very Good To Show

### 8. Inspection → Finding → Corrective Action → Verification → Closure
**Route:** `/so-inspections` (also `/so-dashboard`) · **Roles:** SO, CC, Clerk, QM, Ustad · **CONFIRMED**

Finding status lifecycle confirmed in code:
`open` → `in_progress` → `submitted` → `closed`, with a **`rework`** path
when verification fails.

Ownership rules confirmed: CC can act on anything; SO can edit/delete only
findings they created and only while `open` or `rework`; drafts can only be
edited by their creator.

**Buyer value:** a genuine closed-loop quality process, not just a checklist.

> ⚠️ Demo `/so-inspections` only. The files `SODashboard.tsx` and
> `SOInspectionsScreen.tsx` are **older, unwired versions** — the live
> screen for both routes is `SOInspectionHub`.

---

### 9. Four-fund finance system
**Routes:** `/funds`, `/mess-fund`, `/training-fund`, `/company-assets-fund`, `/general-fund` · **Role:** QM, CC · **CONFIRMED**

Four independent funds, each with collections and expenses. Plus
`fund_transfers` between funds and `training_fund_recoveries` for pending
recoveries. The CC dashboard surfaces all four at a glance.

**Buyer value:** replaces multiple Excel files with an auditable ledger.

---

### 10. Vendor management & payments
**Routes:** `/vendors`, `/vendor-payments` · **Role:** QM, CC · **CONFIRMED**

Vendor entries with `paidAmount` and `dueAmount` tracked separately;
the QM dashboard shows "Actually Paid", "Paid Out", "Pending Bills",
"Bills to verify".

**Buyer value:** you always know what you owe.

---

### 11. Quarter Master dashboard
**Route:** `/quartermaster` · **CONFIRMED** (1,064 lines)

Confirmed cards: Grand Collection · Collection · Expected · Actually Paid ·
Paid Out · Balance · Net Balance · Cash in hand · Pending Bills ·
Bills to verify · Kit Issues · Mess Boy Salary.

---

### 12. Inventory & kit issue
**Routes:** `/inventory`, `/issue-kit` · **Role:** QM, CC ·
**UI PRESENT — END-TO-END NOT VERIFIED**

Screens exist and are routed. The full issue → ledger/history trace has
**not yet been verified** (scheduled for Batch 4). Show the screens; do not
promise ledger behaviour until confirmed.

---

### 13. Staff / personnel management
**Routes:** `/staff`, `/staff-attendance`, `/duty-management`, `/deputation`, `/subjects`, `/subject-assignment` · **CONFIRMED**

The `ustad` module is the **largest in the product** (53 files, 18,448
lines). Confirmed activity types being logged include: Staff Added /
Updated / Deleted, Duty Assigned / Transferred, Subjects Assigned,
Attendance Updated, Bulk Attendance Marked, Class Scheduled, Test Created,
Results Saved, Personnel Deputed Out, Marked Returned, Leave
Applied / Rejected / Cancelled.

**Buyer value:** the instructor side is not an afterthought — it is the
deepest part of the system.

---

### 14. Trainee browser with operational filters
**Route:** `/profile` · **Role:** Clerk, CC · **CONFIRMED**

All-trainees browser with 14 operational filters, searchable, leading into
the individual trainee profile.

---

### 15. Medical / MI Room register
**Route:** `/medical-register` · **Role:** Clerk, CC · **CONFIRMED**

Categories confirmed in code: MI Room · Hospital Admit · B-Rest / C-Rest ·
Medical Board. Records carry diagnosis, ward, recommended days, and drive
the trainee's live availability status.

---

### 16. Absent management
**Route:** `/absent-management` · **Role:** Clerk, CC · **CONFIRMED**

Absent types confirmed: `A` Absent · `L` Leave · `S` Sick · `H` Hospital ·
`R` Rest · `M` Medical appointment. Marking a return resets the trainee to
present and `SHAPE-1`.

---

### 17. Welfare & demographics with festival planning
**Route:** `/welfare-demographics` · **Role:** CC, Clerk, QM · **CONFIRMED**

Breakdown by religion, state, language, platoon; festival planner with
eligible-trainee counts and estimated budget; CSV export and printable A4
report. Also embedded inside the CC dashboard as the "Company Information
Board".

**Buyer value:** genuinely unusual. Memorable in a demo because no
competitor shows festival-based welfare planning.

---

### 18. Files distribution to trainees
**Route:** `/trainee-management` → Files tab (clerk) · `/trainee-dashboard` → Files tab (trainee) · **CONFIRMED**

Clerk uploads PDFs/images (weekly programme, syllabus, orders, results,
forms, study material). Targeting: whole batch, one platoon, or specific
selected trainees. Pin important files. Trainee sees only what was sent
to him.

---

### 19. Relegation / RelID register
**Route:** `/relegation` · **Role:** Clerk, CC · **CONFIRMED**

Status lifecycle: `awaiting_rejoin` → `rejoined` / `cancelled`. Writes
`trainingStatus: 'relegated'` plus `relegateId` onto the trainee record.

> Note: a read-only legacy view also exists in the trainee-management
> screen. `/relegation` is the authoritative register.

---

### 20. Audit log (Lekha-Jokha)
**Route:** `/audit-log` · **Role:** **CC only** · **CONFIRMED**

Searchable log with action filters (Create/Update/Delete/Login/Export) and
counts. Records who changed what, when, with a description.

> ⚠️ **PARTIAL:** three separate audit collections exist in the codebase
> (`staff_activity_logs`, `auditLogs`, `activity_logs`). This screen reads
> `auditLogs` only. The `/today` feed is the one place that reads all three.

---

## P2 — Supporting

| # | Feature | Route | Status |
|---|---|---|---|
| 21 | Clerk dashboard — strength, absent, docs, FPT/test failures, Ustad len-den | `/clerk` | **CONFIRMED** |
| 22 | Batch management & active batch switching | `/batches` | **CONFIRMED** |
| 23 | Weekly programme builder | `/weekly-program` | **CONFIRMED** (1,827 lines) |
| 24 | Training schedule | `/training-schedule` | **CONFIRMED** |
| 25 | Period attendance | `/period-attendance` | **CONFIRMED** |
| 26 | FPT & weekly test records | `/test-records` | **CONFIRMED** |
| 27 | Document cell | `/documents` | **CONFIRMED** |
| 28 | Reports centre | `/reports` | **CONFIRMED** |
| 29 | User management | `/users` | **CONFIRMED** — CC only |
| 30 | Settings | `/settings` | **CONFIRMED** — CC only |
| 31 | Batch progress overview | `/batch-progress` | **CONFIRMED** |
| 32 | Syllabus tracking | `/syllabus-tracking` | **CONFIRMED** |
| 33 | Discipline register | `/discipline-register` | **CONFIRMED** |
| 34 | Movement register | `/movement-register` | **CONFIRMED** |
| 35 | Joining workflow | `/joining-workflow` | **CONFIRMED** |
| 36 | Clearance | `/clearance` | **CONFIRMED** |
| 37 | Final result board | `/final-board` | **CONFIRMED** |
| 38 | Training sessions | `/training-sessions` | **CONFIRMED** |
| 39 | Mess boy salary | `/mess-boy-salary` | **CONFIRMED** |
| 40 | Mismatch dashboard (data integrity) | `/mismatch-dashboard` | **CONFIRMED** — CC only |

---

## P3 — Background / Master-side

### 41. Subscription (company-level)
**Route:** `/subscription` · **Role:** CC · **PARTIAL — feature-flagged**

One subscription **per company**, never per user. Resolution order
confirmed in `SubscriptionContext.tsx`:
1. `subscription/current` document (unit-level)
2. else `customerSubscriptions/{user.customerId}` (customer-level)

Status computed to `daysLeft`, `totalDays`, `usedPct`, `graceDaysLeft`,
re-checked hourly. Developer accounts bypass subscription entirely.

> ⚠️ **Gated by `VITE_SUBSCRIPTION_ENABLED === 'true'`, which is OFF by
> default in company builds.** With the flag off, this route redirects to
> `/login` and the sidebar link is hidden. **Do not click it in a demo
> unless you are on a master build.**

### 42. Company monitor (master control panel)
**Route:** `/company-monitor` · **Role:** CC + flag · **PARTIAL — same flag**

Customer/company oversight for the vendor side.

### 43. Developer practice sandbox
**Route:** `/dev-practice` · **CONFIRMED**

`isDeveloper` flag on the user document; explicitly blocked for Trainee
accounts. Practice banner shown while active. Seed tools for master/test
batches.

### 44. First-run setup
**Route:** `/first-run` · **UI PRESENT — END-TO-END NOT VERIFIED**

### 45. Service-worker asset caching
`public/sw.js` — caches static assets, always fetches HTML from network.
**CONFIRMED.** Offline *editing* is **NOT VERIFIED**.

---

## Explicitly NOT VERIFIED — Never Promise These

| Claim | Reality |
|---|---|
| Mobile push notifications | `fcm.service.ts` exists but is **never imported**. Do not promise. |
| Email / SMS alerts | No implementation found. |
| Offline data entry | Service worker caches assets only. |
| CSV bulk import | `csvImport.service.ts` exists but is **never imported** into any screen. |
| PDF generation | `pdf.service.ts` exists but is **never imported**. (Welfare print uses its own printer.) |
| Trainee 360° screen | `Trainee360Screen.tsx` exists but is **never routed**. Superseded by the upgraded trainee profile. |
| Per-user subscription | Does not exist by design — subscription is company-level. |

> These come from the orphan-file audit in `AUDIT-HISTORY.md` (repo root):
> 46 files exist in the codebase that no screen imports.

---

## Feature Count Summary

| Priority | Count |
|---|---:|
| P0 | 7 |
| P1 | 13 |
| P2 | 20 |
| P3 | 5 |
| **Total documented** | **45** |
| Explicitly excluded (not verified) | 7 |
