# 🛡️ F COY ERP — MASTER AUDIT REPORT (Module 11 & 12)

**Audit Date:** 30 July 2026
**Golden Rule Applied:** Har feature evidence-checked (code padh kar). Recommendation: **✅ KEEP / 🔄 UPDATE / ♻️ REFACTOR / ➕ ADD NEW**
**★ = Is audit ke saath hi implement ho gaya** — TSC clean ✅ Build pass ✅

---

# MODULE 11 — LEAVE MANAGEMENT

**Code base (evidence):**
- `src/features/ustad/types/leave.types.ts` (118 lines) — LeaveStatus, LeaveType, StaffLeave, LeaveBalance
- `src/features/ustad/api/leave.api.ts` (400 lines) — staff_leave + leave_types collections CRUD
- `src/features/ustad/hooks/useLeave.ts` (525 lines) — statistics, approve/reject/cancel/return flows
- `src/features/ustad/screens/LeaveManagementScreen.tsx` (~1,660 lines) — 5 tabs (★ overstay tab naya)
- Route: `/staff-leave` → **STAFF_VIEW_ROLES** (CC + Clerk + Ustad) | Sidebar: Leave Management under Staff section

## Feature-wise Audit

| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 1 | Leave Dashboard | ✅ | **🔄 UPDATE** — ★ overstay banner add hua; type-wise analytics abhi bhi backlog | 4 stat cards: On Leave Now / Pending / Returning Soon / This Month (`calculateStatistics` in useLeave.ts) |
| 2 | Leave Types (CL/ML/EL dynamic) | ✅ | **✅ KEEP AS IT IS** | Dynamic master: `addLeaveType`, `toggleLeaveTypeStatus`, maxDaysPerYear + isPaid — admin se JSON-ki tarah banate hain |
| 3 | Leave Request Form | ✅ | **🔄 UPDATE** — ★ pending-aware balance + ★ emergency contact; document upload backlog | Real-time balance bar + willExceed guard + progress bar exists in form |
| 4 | Leave Approval Workflow | 🟡 | **♻️ REFACTOR (backlog-High)** — single-level final approve; role-gate nahi | `approveLeave()` ek hi step mein approve karta hai. **CRITICAL FINDING:** screen mein Approve button sabko dikhta hai (route pe Ustad bhi allowed) — Clerk/Ustad bhi approve kar sakta hai |
| 5 | Leave Balance System | 🟡→✅ ★ | **♻️ REFACTORED ★** — pending days ab balance se ghata te hain | Pehle sirf APPROVED days count hote the (`calculateUsedDays`) → do concurrent pending requests se quota double-book ho sakta tha. ★ Ab `calculatePendingDays` bhi deduct hota hai |
| 6 | Leave Calendar | ❌ | **➕ ADD NEW (Medium)** — prompt ne "Available" bola tha lekin code mein koi calendar/tab view NAHI hai | TABS = all/pending/current/types (★ +overstay). Calendar grid kahin nahi. Nearest calendar = TrainingScheduleScreen weekly view (M12 ka) |
| 7 | Overstay Tracking | 🟡→✅ ★ | **➕ ADDED ★** | Pehle: approved leave toDate ke baad "current" list se gayab, staff.status 'leave' hi rehta tha — koi alert nahi. ★ Ab: `isOverstayed()` + `overstayDays()` helpers, 🚨 red banner (top), dedicated "Overstay (Late Return)" tab, card pe OVERSTAY X din badge, "Record Return" same tab se |
| 8 | Emergency Contact During Leave | ❌→✅ ★ | **➕ ADDED ★** | Pehle sirf `contactNumber` + `leaveAddress` (khud ka). ★ Ab: `emergencyContactName` + `emergencyContactRelation` (dropdown) + `emergencyContactPhone` (phone-validated input) — optional, backward compatible, card pe 🚨 display |
| 9 | Document Upload (Medical Certificate) | ❌ | **➕ ADD NEW (High)** — roadmap | Leave module mein koi attachment/storage code hi nahi. Trainee-document pattern (`documents/{regNo}/...` Storage) reuse hoga |
| 10 | Bulk Leave Entry & Approval | ❌ | **➕ ADD NEW (Medium)** — approval engine ke saath | Ek-ek entry hi hai; bulk approve nahi |

## Crucial Cross-Checks (evidence)

| Check | Result |
|-------|--------|
| Leave ↔ Staff status sync | ✅ hai — approve pe `updateStaffStatus('leave')`, return pe `'active'` (silent-skip safe) |
| Leave ↔ Attendance sync | ✅ hai — approve pe leave-days ki `markBulkAttendance('leave')`, return day 'present' auto-mark |
| Leave number | ✅ LV-YYYY-NNN auto (`generateLeaveNumber`) |
| Balance logic (old bug) | ❌→✅ ★ — pending applications ignore hoti thi = over-booking possible |
| Approval role-gate | ❌ — **CRITICAL pending item**: Approve/Reject buttons role-check ke bina render hote hain (UI-level; Firestore rules bhi nahi) |
| Batch scoping | ✅ `batchId`/`batchNumber` apply pe save hota hai, `getAllLeaves(batchId)` filter |
| Audit trail | ✅ `logActivity` har action pe (Applied/Approved/Rejected/Cancelled/Return) |
| Real-time sync | 🟡 — manual Refresh button hai; onSnapshot nahi (baaki ERP pattern jaisa) |

## 📊 MODULE 11 SCORES (evidence-based)

| Metric | Score | Note |
|---|---|---|
| Overall | **74/100** | prompt ne 82 bola; evidence pe 74 (calendar nahi hai, approval role-gate missing, docs nahi) |
| Completion | 72% (★ fixes ke baad) | pehle ~64% |
| UI | 82 | ★ overstay banner/tab + balance card strong |
| Code Quality | 78 | clean API/hook split; console.log cleanup pending |
| Database Quality | 76 | denormalization sahi; `leave_balances` collection nahi (computed balance — acceptable design) |
| Architecture | 80 | API → Hook → Screen layering consistent |
| Performance | 80 | getAllLeaves full read + client filter; N chhota hai to OK |
| Security | 62 | rules missing (common) + **UI role-gate missing on approve** |
| Scalability | 76 | year-wise balance computed; multi-year archive baad mein |
| Government ERP | 80 | ★ overstay + emergency contact se kafi behtar |

## Top 10 Existing (Worth Keeping) — M11
1. Dynamic Leave Type master (admin-configurable quota)
2. Real-time balance validation form ke andar (progress bar)
3. LeaveQuotaModal — full quota ledger + history per staff
4. Approve → auto staff-status + auto attendance sync
5. Return → auto reactivate + return-day present marking
6. Cancel → staff reactivation guard
7. Leave number auto-generation (LV-YYYY-NNN)
8. Activity log har transition pe
9. Batch-scoped leave filtering
10. Orphan-leave detection + cleanup guidance banner

## Top 10 To Update — M11
1. ★ ~~Pending-aware balance~~ (DONE)
2. Approve/Reject buttons → role-gate (sirf CC/Clerk) + Firestore rule (Critical backlog)
3. Leave calendar grid view
4. Dashboard type-wise analytics (CL/ML/EL breakdown)
5. onSnapshot real-time list (Refresh button hata sake)
6. console.log cleanup (`calculateStatistics` debug logs)
7. Multi-level approval (recommend → sanction) — sarkari chain
8. Date validations (fromDate >= today warning, past-leave allow for record-entry)
9. Leave print (sarkari leave application format, printDocuments.ts pattern)
10. Staff leave-history timeline view in StaffProfile

## Top 10 Missing — M11
1. ~~Overstay tracking~~ ★ (ab available)
2. ~~Emergency contact~~ ★ (ab available)
3. Medical certificate / document upload — High
4. Leave calendar — Medium
5. Bulk leave entry + bulk approval — Medium
6. Approval chain (2-level: recommend by Clerk, sanction by CC) — High
7. Leave application print (Hindi/English form) — Medium
8. Leave encashment record — Low
9. SMS/WhatsApp alert hooks — Future
10. AI leave-pattern insights — Future

## Top 10 Critical Problems — M11
1. **Approve button role-gated nahi** — Ustad/Clerk bhi approve kar sakta (UI + security rules dono) → backlog Critical
2. ~~Pending leaves quota se nahi ghatti~~ → ★ FIXED (double-booking guard)
3. ~~Overstay invisible~~ → ★ FIXED (banner + tab + badge)
4. ~~Emergency contact absent~~ → ★ FIXED
5. Document attachment nahi (medical proof mandatory hota hai govt mein)
6. Calendar view nahi
7. Firestore security rules pure project mein nahi (common)
8. Approval workflow single-level
9. No print of leave application
10. Full-collection read per fetch

---

# MODULE 12 — WEEKLY TRAINING PROGRAM

**Code base (evidence):**
- `src/features/weekly/WeeklyProgramScreen.tsx` (~1,950 lines) — `weeklyPrograms` collection, full builder + A4 print
- `src/features/ustad/screens/TrainingScheduleScreen.tsx` (~780 lines) — `training_schedule` collection, daily/weekly views
- `src/features/ustad/screens/SubjectMasterScreen.tsx` + `SubjectAssignmentScreen.tsx` — subjects master + staff mapping
- `src/features/ustad/screens/BatchProgressScreen.tsx` + `batchProgress.api.ts` — subject-wise progress tracking
- `src/features/ustad/screens/TestRecordsScreen.tsx` — weekly tests + FPT results (performance data ready)
- Routes: `/weekly-program` (CLERK_ROLES), `/training-schedule` (STAFF_VIEW), `/subjects` + `/subject-assignment` (STAFF_MANAGE), `/batch-progress` (STAFF_VIEW)

## Feature-wise Audit

| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 1 | Training Dashboard | 🟡 | **🔄 UPDATE** — dedicated training analytics page nahi; UstadDashboard live hai (M1-4 ★), BatchProgress cards hain. Analytics depth low | No `training_dashboard` screen |
| 2 | Weekly Program | ✅ | **✅ KEEP AS IT IS** | WeeklyProgramScreen: create/edit/delete/list + week meta (ADM NCO/SO, tea break, roll call, distribution). Batch-locked |
| 3 | Program Builder | ✅ | **♻️ IMPROVED ★** (conflict engine) + staffId-link backlog | Drag nahi, par accordion editor + inline date + auto displayDateRange strong. Persons abhi free-text (staffId linked nahi) |
| 4 | Subject Master | ✅ | **🔄 UPDATE** — DB-driven hai; WeeklyProgram hardcoded list use karta hai (merge pending) | `SubjectMasterScreen` + `subject.api` (code/category/active) |
| 5 | Dynamic Subjects (PT/Drill/WT…) | ✅ | **✅ KEEP** — 14 subjects + "Other (Manual)" fallback + category-wise BatchProgress defaults | WeeklyProgram SUBJECTS const + quick-add sets |
| 6 | Instructor/Ustad Allocation | ✅→🔥 ★ | **♻️ REFACTORED ★** — conflict detection engine add hua | Pehle: same ustad same time pe 2 classes — zero check. ★ Ab: `findInstructorConflicts()` — pure-week scan, same-day + overlapping-time + same-person → inline red warning per session + save-block confirm + summary panel |
| 7 | Training Calendar | ✅ | **✅ KEEP** | TrainingScheduleScreen weekly 7-day grid + daily timeline view. Status colors sahi |
| 8 | Attendance Integration | 🟡 | **🔄 UPDATE (backlog)** — schedule-linked class attendance nahi | staff leave↔attendance sync hai (M11); trainee daily hazri hai (M10 ★); lekin training_schedule se hazri link nahi |
| 9 | Training Progress Tracking | 🟡 | **♻️ REFACTOR (backlog-High)** | BatchProgressScreen: manual hours/classes entry + oval cards + milestones. Schedule se auto-count nahi hota (completed classes → progress auto-sync pending) |
| 10 | Rescheduling System | 🟡→✅ ★ | **🔄 UPDATED ★** | Pehle: weekly-program edit ✅ tha, lekin training_schedule mein sirf status buttons (+delete). ★ Ab: **Edit/Reschedule modal** (same form prefilled, conflict-check with self-exclude, denormalized names sync, activity log) + **Postpone button** (`postponed` status type pehle se tha, UI mein pehli baar) |

## Crucial Cross-Checks (evidence)

| Check | Result |
|-------|--------|
| A4 Print (govt format) | ✅ — WeeklyProgramPrint: DAY&DATE / TIME / PDS / CODE / SUBJECT / METHOD / AREA / RESPONSIBILITY + IG/STC header/footer |
| Edit mode | ✅ weekly program mein pehle se (isEditMode flag, sanitize payloads) |
| Multi-person per session | ✅ PersonMultiSelect (rank dropdown + datalist of ustads) |
| Lecture details | ✅ topic/duration/materials conditional fields |
| Training schedule conflict check | ✅ pehle se — `checkScheduleConflict` API + 500ms debounce in form (ustadId-based, overlaps blocked) |
| Weekly program conflict check | ❌→✅ ★ — ab implemented |
| Schedule edit/reschedule | ❌→✅ ★ — ab implemented |
| Postpone status | 🟡→✅ ★ — type tha, button nahi tha; ab hai |
| Schedule API denorm sync | ❌→✅ ★ — updateSchedule extras (ustad/subject name) |
| Batch lock | ✅ dono screens pe batch-required guard |
| Activity logs | ✅ schedule add/update ★ log hota hai |

## 📊 MODULE 12 SCORES (evidence-based)

| Metric | Score | Note |
|---|---|---|
| Overall | **78/100** | prompt ne 85 bola; evidence pe 78 (conflict ★ + reschedule ★ ke baad; dashboard ded. nahi, progress manual) |
| Completion | 76% | pehle ~68% |
| UI | 85 | A4-print fidelity + military theme strong point |
| Code Quality | 80 | sanitize/undefined-safe payloads mature |
| Database Quality | 80 | denorm + weeklyPrograms self-contained (print ke liye sahi) |
| Architecture | 82 | weekly feature alag folder; schedule ustad module mein — acceptable |
| Performance | 82 | date-range indexed queries schedule mein |
| Security | 60 | rules missing (common); weekly program write role-gated ✓ UI pe |
| Scalability | 80 | batch-scoped sab; week history grows fine |
| Government ERP | 85 | print = exact govt format; conflict guard ★ audit-friendly |

## Top 10 Existing (Worth Keeping) — M12
1. A4-landscape print = exact govt weekly programme format
2. WeeklyProgram edit-mode with full sanitize (undefined-safe — mature code)
3. training_schedule ustad-conflict check (debounced, overlap math)
4. Daily + Weekly dual views with status workflow (scheduled→in_progress→completed)
5. Subject master + staff assignment matrices (multi-subject)
6. BatchProgress oval progress cards + milestones
7. PersonMultiSelect — multi-instructor per period with rank optgroups
8. Lecture details conditional capture (topic/duration/materials)
9. Test records (weekly tests + FPT) — performance data foundation
10. Batch-locked writes everywhere

## Top 10 To Update — M12
1. ★ ~~Instructor conflict (weekly program)~~ (DONE)
2. ★ ~~Reschedule/Edit UI training schedule~~ (DONE)
3. WeeklyProgram subjects → Subject Master se merge (hardcoded list abhi)
4. Persons → staffId-linked allocation (free-text abhi; dropdown-person from `staff` with id)
5. Training Progress auto-sync (completed schedule sessions → hours/classes)
6. Dedicated Training Dashboard (per-subject completion + today's classes + ustad workload)
7. Weekly program approval by CC (print se pehle DRAFT/APPROVED stamp)
8. Copy-week feature (agla week = pichhla week + edits) — planner time-saver
9. Period-vs-hazri linkage (class attendance tab)
10. Instructor workload report (per ustad weekly periods count)

## Top 10 Missing — M12
1. ~~Conflict detection in weekly builder~~ ★ (ab available)
2. ~~Reschedule UI~~ ★ (ab available)
3. Training Dashboard (dedicated analytics)
4. Auto progress sync (schedule → batch_progress)
5. Subject-wise lesson library / syllabus master
6. Copy-from-previous-week
7. Weekly program approval stamp (DRAFT → APPROVED → PRINTED)
8. Trainee performance scorecard per subject (test data se)
9. Ustad workload balance report
10. Holiday/ rainy-day auto adjustments

## Top 10 Critical Problems — M12
1. ~~Weekly builder mein double-booking possible~~ → ★ FIXED (conflict engine + save guard)
2. ~~Schedule edit impossible (delete-recreate)~~ → ★ FIXED
3. ~~Postpone status dead (no UI)~~ → ★ FIXED
4. Progress 100% manual hai — schedule ke saath sync nahi (data-integrity risk)
5. Persons free-text → spelling mismatch se conflict miss ho sakta (★ name-normalize kiya hai, staffId merge next step)
6. Dedicated training dashboard nahi
7. Approval/DRAFT stamp nahi (print = final doc, govt mein DRAFT watermark chahiye)
8. Security rules missing (common)
9. Subject list do jagah maintain hoti hai (master + hardcoded)
10. No per-trainee skill progression linking

---

# 🏆 FINAL COMPARISON

| Module | Completion % | Existing Features | Update Required | New Features Required | Production Ready |
|---|---|---|---|---|---|
| 11. Leave Management | **72%** | 14 | 10 (4 ★ done) | 8 (2 ★ done) | 🟡 Role-gate + rules ke baad |
| 12. Weekly Training Program | **76%** | 16 | 11 (3 ★ done) | 7 (2 ★ done) | 🟡 Dashboard + approval stamp ke baad |

> Note: User-prompt ke claimed scores (M11: 82, M12: 85) se evidence-based scores neeche hain kyunki prompt ne "Leave Calendar: Available" aur "Overstay: Partial" jaisi cheezein claim ki thin jo code mein exact match nahi karti thi (calendar = missing tha). Ab ★ fixes ke baad gap bhi kam ho gaya.

## Priority Table

| Bucket | Items |
|---|---|
| **Critical** | Approve role-gate (UI + Firestore rules) · ★ Pending-balance fix · ★ Overstay tracking · ★ Weekly conflict engine · ★ Schedule reschedule |
| **High** | Leave document upload · 2-level approval chain · Progress auto-sync · Training dashboard · StaffId-linked persons |
| **Medium** | Leave calendar · Leave print format · Copy-week · Subject master merge · Bulk leave entry · DRAFT watermark |
| **Low** | onSnapshot real-time lists · console cleanup · Leave encashment · SMS/WhatsApp hooks |

---

# 📌 FINAL IMPLEMENTATION STRATEGY (IS AUDIT KE BASIS PE)

### ✅ KEEP AS IT IS
- Leave type master, quota modal, leave↔status↔attendance sync engine
- Weekly program A4 print + edit/sanitize architecture
- Training schedule conflict API + daily/weekly views
- Batch lock, activity logs, role-based routes

### 🔄 UPDATE EXISTING
- ★ Leave balance engine (pending-aware)
- ★ Schedule updateSchedule API (denorm extras)
- Approve buttons role-gate (backlog Critical — next step)
- Subject list merge (weekly program ← master)

### ♻️ REFACTOR EXISTING
- Progress tracking → schedule-driven sync (backlog)
- Approval workflow → 2-level chain (backlog, saare modules common)

### ➕ ADD NEW FEATURE
- ★ Overstay tracking system (banner/tab/badge)
- ★ Emergency contact during leave
- ★ Instructor conflict detection engine (weekly builder)
- (Backlog) Leave doc upload, leave calendar, training dashboard, copy-week

---

# ✅ IS AUDIT KE SAATH IMPLEMENT HUA (★)

| # | Feature | Module | Type | Files |
|---|---------|--------|------|-------|
| ★1 | **Pending-aware Leave Balance** — pending applications bhi quota se deduct; form mein "+ Pending: N" tag; double-booking impossible | 11 | ♻️ Refactor (safe) | `LeaveManagementScreen.tsx` |
| ★2 | **Overstay Tracking System** — `isOverstayed`/`overstayDays` helpers, 🚨 top banner (slice-4 names), dedicated tab + count badge, per-card "OVERSTAY X din" red badge, Record Return same tab se | 11 | ➕ Add New | `LeaveManagementScreen.tsx` |
| ★3 | **Emergency Contact During Leave** — name/relation (dropdown)/phone fields, optional + backward compatible, card display | 11 | ➕ Add New | `leave.types.ts`, `leave.api.ts`, `LeaveManagementScreen.tsx`, `ReportsScreen.tsx` (mapping sync) |
| ★4 | **Instructor Conflict Detection Engine** (weekly program) — time-parser ("0530-0650"/"05:30-06:50"/"0530 TO 0650"), same-day + overlap + same-person scan, inline red session warning, summary panel, save pe confirm-guard | 12 | ➕ Add New | `WeeklyProgramScreen.tsx` |
| ★5 | **Schedule Edit / Reschedule + Postpone** — same modal edit-mode (prefilled, self-excluded conflict check), denormalized ustad/subject sync, activity-log, postponed status button (type pehle se tha — UI first time) | 12 | 🔄 Update | `TrainingScheduleScreen.tsx`, `useSchedule.ts`, `schedule.api.ts` |

> **Golden rule verify:** koi existing feature remove/replace nahi hua. Saare changes additive hain; purane docs (bina emergencyContact / bina conflicts) bina migration ke kaam karte rahenge (defaults `''` / empty). TSC clean ✅ Vite build pass ✅

---

# 🗺️ NEXT ROADMAP (suggested order)

**Step 1 (Critical):** Approve/Reject role-gate + Firestore security rules (pure ERP common)
**Step 2:** Leave document upload (Storage pattern reuse) + Leave print form
**Step 3:** Training Progress auto-sync from completed schedule sessions
**Step 4:** Weekly program copy-week + staffId-linked persons
**Step 5:** Dedicated Training Dashboard + leave calendar
