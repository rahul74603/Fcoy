# 🎖️ BSF STC TEKANPUR — RANGROOT RECORD SYSTEM
## Master Task Tracker
### Branch: `arena/01a053ab-fcoy`
### Last Updated: 2026-09-01

---

## 📋 HOW TO USE THIS FILE
- ✅ = DONE
- 🔄 = IN PROGRESS
- ⏳ = PENDING
- ❌ = BLOCKED
- Each task has a unique ID (e.g., T-001)
- Work in ORDER — some tasks depend on others
- After each task: `git commit + push` with task ID in message

---

## PHASE 0: RENAME EXISTING FEATURES TO BSF TERMINOLOGY
> Existing features ko BSF ke hisab se rename karna — koi code change nahi, sirf labels

### T-001 ✅ Rename "Trainee" → "Rangroot" in UI labels
- File: `src/features/students/TraineeProfileScreen.tsx`
- Change: UI labels only (variable names can stay)
- Impact: Zero — cosmetic only

### T-002 ✅ Rename "Test Records" → "Pariksha Register" in sidebar
- File: `src/components/layout/Sidebar.tsx`
- Change: Sidebar menu label

### T-003 ✅ Rename "Medical Register" → "Chikitsa Register" in sidebar
- File: `src/components/layout/Sidebar.tsx`

### T-004 ✅ Rename "Document Verification" → "Dastavez Satyapan" in sidebar
- File: `src/components/layout/Sidebar.tsx`

### T-005 ✅ Rename "Absent Management" → "Anupasthiti Prabandhan" in sidebar
- File: `src/components/layout/Sidebar.tsx`

### T-006 ✅ Rename "Kit Management" → "Saaman Vitran" in sidebar
- File: `src/components/layout/Sidebar.tsx`

### T-007 ✅ Rename CC Dashboard → "Company Commander Dashboard (Sahayak)"
- File: `src/features/dashboard/CompanyCommanderDashboard.tsx`

### T-008 ✅ Rename SO Dashboard → "Senior Officer Dashboard (Nirikshak)"
- File: `src/features/inspection/screens/SOInspectionHub.tsx`

---

## PHASE 1: DISCIPLINE / CONDUCT REGISTER (Anushasan Register)
> Har rangroot ka discipline record — punishments, awards, commendations

### T-010 ✅ Create Firestore collection: `disciplineRecords`
- Fields: traineeId, batchId, type (Punishment/Award/Commendation/Warning),
  category, description, date, awardedBy, authority, status (Active/Completed/Expired),
  remarks, createdAt
- File: New file `src/features/discipline/types/discipline.types.ts`

### T-011 ✅ Create Discipline API (CRUD)
- File: New file `src/features/discipline/api/discipline.api.ts`
- Functions: addRecord, getRecords, updateRecord, deleteRecord

### T-012 ✅ Create Discipline Register Screen
- File: New file `src/features/discipline/screens/DisciplineRegisterScreen.tsx`
- Features: Add punishment/award, filter by trainee, filter by type,
  summary cards (total punishments, awards, active warnings)

### T-013 ✅ Add Discipline tab to Trainee Profile
- File: `src/features/students/TraineeProfileScreen.tsx`
- New tab: "⚖️ Anushasan" — shows all discipline records for that rangroot

### T-014 ✅ Add route + sidebar link
- Files: `src/App.tsx`, `src/components/layout/Sidebar.tsx`
- Route: `/discipline-register`
- Sidebar: Under Ustad/Clerk section

### T-015 ✅ Add discipline summary to CC Dashboard
- File: `src/features/dashboard/CompanyCommanderDashboard.tsx`
- Card: "X punishments this month, Y awards"

---

## PHASE 2: MOVEMENT / TRANSFER HISTORY (Sthanantar Register)
> Rangroot ka movement record — transfer, posting, detachment

### T-020 ✅ Create Firestore collection: `movementRecords`
- Fields: traineeId, batchId, type (Transfer/Posting/Detachment/Return),
  fromUnit, toUnit, fromPlace, toPlace, movementOrderNo, orderDate,
  movementDate, reportingDate, status (Ordered/Completed/Overdue),
  authority, remarks, createdAt

### T-021 ✅ Create Movement API (CRUD)
- File: New file `src/features/movement/api/movement.api.ts`

### T-022 ✅ Create Movement Register Screen
- File: New file `src/features/movement/screens/MovementRegisterScreen.tsx`
- Features: Add movement order, track status, overdue alerts

### T-023 ✅ Add Movement tab to Trainee Profile
- File: `src/features/students/TraineeProfileScreen.tsx`
- New tab: "🚶 Sthanantar" — shows all movement records

### T-024 ✅ Add route + sidebar link
- Route: `/movement-register`

---

## PHASE 3: LEAVE APPLICATION / SANCTION (Chhutti Prabandhan)
> Formal leave system — application, sanction, return, overstay tracking

### T-030 ✅ Create Firestore collection: `leaveApplications`
- Fields: traineeId, batchId, leaveType (Casual/Medical/Emergency/Special),
  fromDate, toDate, totalDays, reason, appliedTo, sanctionedBy,
  status (Applied/Sanctioned/Rejected/On Leave/Returned/Overstay),
  departureDate, returnDate, actualReturnDate, overstayDays,
  remarks, createdAt

### T-031 ✅ Create Leave API (CRUD + auto-status updates)
- File: New file `src/features/leave/api/leave.api.ts`
- Auto: If returnDate passed and not returned → mark Overstay

### T-032 ✅ Create Leave Management Screen
- File: New file `src/features/leave/screens/LeaveManagementScreen.tsx`
- Features: Apply leave, sanction/reject, track return, overstay alerts,
  leave balance per trainee

### T-033 ✅ Add Leave tab to Trainee Profile
- New tab: "✈️ Chhutti" — leave history, balance, overstay record

### T-034 ✅ Integrate with existing absentRecords
- When leave sanctioned → auto-create absentRecord type 'L'
- When returned → auto-close absentRecord

### T-035 ✅ Add route + sidebar link
- Route: `/leave-management`

---

## PHASE 4: PERIOD-WISE ATTENDANCE (Kaksha Upasthiti)
> Har subject, har period ka attendance — daily + weekly + monthly summary

### T-040 ✅ Create Firestore collection: `periodAttendance`
- Fields: traineeId, batchId, date, period (1st/2nd/3rd/4th/5th/6th/7th/8th),
  subject (PT/Drill/Weapon/Law/Tactics/Map Reading/etc),
  status (P/A/L/S/H/Duty), markedBy, remarks, createdAt

### T-041 ✅ Create Period Attendance API
- File: New file `src/features/periodAttendance/api/periodAttendance.api.ts`
- Bulk mark: Mark all trainees for a period at once

### T-042 ✅ Create Period Attendance Screen
- File: New file `src/features/periodAttendance/screens/PeriodAttendanceScreen.tsx`
- Features: Select date → select period → mark attendance for all trainees,
  daily summary, weekly summary, monthly percentage

### T-043 ✅ Add Attendance summary to Trainee Profile
- Update existing Attendance tab to show period-wise breakdown

### T-044 ✅ Add route + sidebar link
- Route: `/period-attendance`

---

## PHASE 5: TRAINING SYLLABUS TRACKING (Pathyakram Anurekhan)
> Kitna syllabus hua, kitna baaki — subject-wise progress

### T-050 ✅ Create Firestore collection: `trainingSyllabus`
- Fields: batchId, subject, topic, totalHours, completedHours,
  instructorId, status (Not Started/In Progress/Completed),
  startDate, endDate, remarks

### T-051 ✅ Create Syllabus API (CRUD + progress calc)
- File: New file `src/features/syllabus/api/syllabus.api.ts`

### T-052 ✅ Create Syllabus Tracking Screen
- File: New file `src/features/syllabus/screens/SyllabusTrackingScreen.tsx`
- Features: Subject-wise progress bars, add topics, mark complete,
  overall batch progress percentage

### T-053 ✅ Add route + sidebar link
- Route: `/syllabus-tracking`

---

## PHASE 6: FINAL BOARD / RESULT (Antim Board Parinaam)
> Passing out board, final grading, recommendation

### T-060 ✅ Create Firestore collection: `finalResults`
- Fields: traineeId, batchId, overallGrade, totalMarks, percentage,
  position, recommendation (Fit for Duty/Unfit/Conditional),
  passedOutDate, certificateNo, boardMembers[], remarks, createdAt

### T-061 ✅ Create Final Result API
- File: New file `src/features/finalResult/api/finalResult.api.ts`
- Auto-calculate: Aggregate all test results, FPT, firing, attendance %

### T-062 ✅ Create Final Board Screen
- File: New file `src/features/finalResult/screens/FinalBoardScreen.tsx`
- Features: Generate final result per trainee, batch-wise merit list,
  pass/fail summary, export to PDF/CSV

### T-063 ✅ Add Final Result tab to Trainee Profile
- New tab: "🏆 Antim Parinaam" — final grade, merit, certificate

### T-064 ✅ Add route + sidebar link
- Route: `/final-board`

---

## PHASE 7: CLEARANCE SYSTEM (Klirans Prabandhan)
> Passing out se pehle clearance — kit return, docs, mess, library, etc.

### T-070 ✅ Create Firestore collection: `clearanceRecords`
- Fields: traineeId, batchId, items: [{department, status, clearedBy, date}],
  overallStatus (Pending/In Progress/Cleared), remarks, createdAt
- Departments: Kit Store, Mess, Medical, Documents, Library, Arms Room,
  QM Store, Sports, Training, Discipline

### T-071 ✅ Create Clearance API
- File: New file `src/features/clearance/api/clearance.api.ts`

### T-072 ✅ Create Clearance Screen
- File: New file `src/features/clearance/screens/ClearanceScreen.tsx`
- Features: Checklist per trainee, mark each department cleared,
  overall clearance status, pending alerts

### T-073 ✅ Add route + sidebar link
- Route: `/clearance`

---

## PHASE 8: JOINING WORKFLOW (Bharti Prakriya)
> Rangroot ka joining lifecycle — Selected → Reported → Verified → Joined

### T-080 ✅ Add joining fields to trainee document
- Fields: recruitmentCenter, selectionDate, joiningDate, reportingDate,
  reportingTime, joiningAuthority, movementOrderNo, receptionStatus,
  initialMedicalStatus, oathTaken, joiningStatus
- File: Update `src/features/students/TraineeProfileScreen.tsx`

### T-081 ✅ Create Joining Workflow Screen
- File: New file `src/features/joining/screens/JoiningWorkflowScreen.tsx`
- Features: Pipeline view (Selected → Called → Reported → Verified →
  Medically Fit → Joined → Allocated), bulk import from recruitment list

### T-082 ✅ Add route + sidebar link
- Route: `/joining-workflow`

---

## PHASE 9: AUDIT LOG (Lekha-Jokha Register)
> Kaun kya change kiya — immutable history

### T-090 ✅ Create Firestore collection: `auditLogs`
- Fields: userId, userName, userRole, action (Create/Update/Delete),
  collection, documentId, fieldChanged, oldValue, newValue,
  timestamp, ipAddress

### T-091 ✅ Create Audit Log utility
- File: New file `src/services/auditLog.service.ts`
- Function: logChange(params) — call after every save/update/delete

### T-092 ✅ Create Audit Log Screen (CC only)
- File: New file `src/features/audit/screens/AuditLogScreen.tsx`
- Features: Filter by user, date, collection, action type

### T-093 ✅ Add route + sidebar link (CC only)
- Route: `/audit-log`

---

## PHASE 10: DATA MISMATCH DASHBOARD (Bemel Dashboard)
> Auto-detect missing/inconsistent data across all records

### T-100 ✅ Create Mismatch Detection Engine
- File: New file `src/features/mismatch/engine/mismatchEngine.ts`
- Checks:
  - Name mismatch across collections
  - DOB mismatch
  - Service No duplicate
  - Chest No duplicate
  - Batch mismatch
  - Medical fitness missing
  - Document pending
  - Attendance below threshold
  - Marks missing
  - Training incomplete
  - Clearance pending
  - Kit not returned

### T-101 ✅ Create Mismatch Dashboard Screen
- File: New file `src/features/mismatch/screens/MismatchDashboardScreen.tsx`
- Features: Auto-scan all records, show "X Records Need Attention",
  filter by severity (Critical/High/Medium/Low), fix suggestions

### T-102 ✅ Add to CC Dashboard
- Card: "🔴 X Records Need Attention" — click opens mismatch dashboard

### T-103 ✅ Add route + sidebar link (CC only)
- Route: `/mismatch-dashboard`

---

## PHASE 11: ENHANCE EXISTING FEATURES

### T-110 ✅ Enhance Trainee Profile — Add all new tabs
- Tabs to add: Anushasan, Sthanantar, Chhutti, Antim Parinaam
- File: `src/features/students/TraineeProfileScreen.tsx`

### T-111 ✅ Enhance CC Dashboard — Add summary cards
- Cards: Discipline stats, Leave stats, Syllabus progress,
  Mismatch alerts, Clearance status
- File: `src/features/dashboard/CompanyCommanderDashboard.tsx`

### T-112 ✅ Enhance Firing Register — Add target photo upload
- Feature: Upload photo of physical target paper with each firing session
- File: `src/features/ustad/screens/TestRecordsScreen.tsx`

### T-113 ✅ Add CSV/PDF Export to all registers
- Firing Register, Discipline, Attendance, Final Result
- File: `src/services/export.service.ts`

---

## 📊 PROGRESS TRACKER

| Phase | Description | Tasks | Done | Status |
|-------|-------------|-------|------|--------|
| 0 | BSF Terminology Rename | 8 | 8 | ✅ |
| 1 | Discipline Register | 6 | 6 | ✅ |
| 2 | Movement/Transfer | 5 | 5 | ✅ |
| 3 | Leave Management | 6 | 6 | ✅ |
| 4 | Period Attendance | 5 | 5 | ✅ |
| 5 | Syllabus Tracking | 4 | 4 | ✅ |
| 6 | Final Board/Result | 5 | 5 | ✅ |
| 7 | Clearance System | 4 | 4 | ✅ |
| 8 | Joining Workflow | 3 | 3 | ✅ |
| 9 | Audit Log | 4 | 4 | ✅ |
| 10 | Mismatch Dashboard | 4 | 4 | ✅ |
| 11 | Enhance Existing | 4 | 4 | ✅ |
| **TOTAL** | | **58** | **58** | **100%** |

---

## 🔧 EXISTING FEATURES — STATUS (DO NOT BREAK)

| Feature | Status | File |
|---------|--------|------|
| Trainee Profile (TABBED) | ✅ Working | TraineeProfileScreen.tsx |
| Test Records (11 types) | ✅ Working | TestRecordsScreen.tsx |
| Firing Range Register | ✅ Working | TestRecordsScreen.tsx |
| Medical Register | ✅ Working | MedicalRegisterScreen.tsx |
| Absent Management | ✅ Working | AbsentManagementScreen.tsx |
| Document Verification | ✅ Working | DocumentVerificationScreen.tsx |
| Kit Management | ✅ Working | KitManagementScreen.tsx |
| Batch Management | ✅ Working | BatchManagementScreen.tsx |
| CC Dashboard | ✅ Working | CompanyCommanderDashboard.tsx |
| SO Inspection Hub | ✅ Working | SOInspectionHub.tsx |
| Welfare | ✅ Working | WelfareDemographicsScreen.tsx |
| Mess Fund | ✅ Working | MessFundScreen.tsx |
| General Fund | ✅ Working | GeneralFundScreen.tsx |
| Training Fund | ✅ Working | TrainingFundScreen.tsx |
| Vendor Management | ✅ Working | VendorManagementScreen.tsx |
| Trainee 360° | ✅ Working | Trainee360Screen.tsx |
| Sidebar (role-based) | ✅ Working | Sidebar.tsx |
| Search by Name | ✅ Working | useTraineeSearch.ts |

---

## 📝 NOTES FOR NEXT AGENT

1. **NEVER break existing features** — always ADD new code, don't modify working code
2. **Use BSF terminology** in UI labels (Hindi + English mix)
3. **Each new module = new folder** under `src/features/`
4. **Each new collection = new Firestore collection** — don't modify existing ones
5. **After each task**: `git add -A && git commit -m "T-XXX: description" && git push`
6. **Update this file** after each task: change ⏳ to ✅
7. **Build test after every 3 tasks**: `npm run build`
8. **Deploy after every phase**: `npm run build && firebase deploy --only hosting`
9. **Firestore indexes**: Add composite indexes if new queries need them
10. **Existing absentRecords** integration: Leave system MUST sync with absentRecords

---

# ═══════════════════════════════════════════════════════════
# PHASE 12-19: AUDIT-BASED DEEP IMPROVEMENTS
# Based on external audit (ChatGPT + manual review)
# These tasks STRENGTHEN existing modules — don't break them
# ═══════════════════════════════════════════════════════════

---

## PHASE 12: CANONICAL TRAINEE TYPE (Schema Normalization)
> 🔴 CRITICAL — Current `student.types.ts` is outdated. Rich UI exists but type model is thin.
> Goal: Create proper TypeScript domain model matching actual Firestore data.

### T-120 ✅ Create canonical `trainee.types.ts`
- File: New file `src/features/students/types/trainee.types.ts`
- Must include ALL fields actually used in Firestore + UI
- **DO NOT modify existing code** — just create the type file

### T-121 ✅ Create `trainee.mapper.ts` utility
- File: New file `src/features/students/utils/trainee.mapper.ts`
- Functions: `firestoreToTrainee(raw: any): Trainee`, `traineeToFirestore(t: Trainee): any`

### T-122 ✅ Add uniqueness validation rules
- regNo: UNIQUE across all trainees
- chestNo: UNIQUE within active batch
- File: `src/features/students/utils/trainee.validation.ts`

---

## PHASE 13: ATTENDANCE DEEP INTEGRATION
> 🔴 CRITICAL — Period attendance exists but not linked to profile summary.

### T-130 ✅ Link periodAttendance to Trainee Profile Attendance tab
- Fetch from `periodAttendance` collection for this trainee
- Show: total periods, present, absent, %, subject-wise breakdown

### T-131 ✅ Add attendance threshold alerts to Bemel Dashboard
- Check: trainees below 75% attendance from periodAttendance

### T-132 ✅ Add monthly attendance summary to CC Dashboard
- Card: "Average attendance this month: X%"

---

## PHASE 14: LEAVE LIFECYCLE DEEPENING
> 🟠 HIGH — Leave system exists but needs full lifecycle.

### T-140 ✅ Add leave recommendation step
- New status: 'Recommended' between Applied and Sanctioned

### T-141 ✅ Add departure tracking
- When status = Sanctioned → show "Mark Departed" button

### T-142 ✅ Add return with overstay auto-detection
- When return date passed + not returned → auto-mark Overstay

### T-143 ✅ Add leave balance tracking
- Per trainee: total entitled, used, remaining by type

---

## PHASE 15: TRAINING SESSION ENGINE
> 🔴 CRITICAL — Syllabus tracking exists but no session-level recording.

### T-150 ✅ Create Firestore collection: `trainingSessions`
### T-151 ✅ Create Training Session API
### T-152 ✅ Create Training Session Log Screen
### T-153 ✅ Link sessions to syllabus progress
### T-154 ✅ Add route + sidebar link

---

## PHASE 16: EXAM/MARKS HISTORY ENGINE
> 🟠 HIGH — Tests exist but need proper attempt history.

### T-160 ✅ Add re-test support to training_tests
### T-161 ✅ Add subject-wise marks summary to profile
### T-162 ✅ Add grade calculation engine

---

## PHASE 17: DISCIPLINE + MEDICAL HISTORY DEEPENING
> 🟠 MEDIUM — Both exist but need case-history depth.

### T-170 ✅ Add discipline case workflow (Incident → Inquiry → Decision → Closure)
### T-171 ✅ Add medical event timeline to profile
### T-172 ✅ Add injury tracking

---

## PHASE 18: MOVEMENT → CLEARANCE → POSTING LIFECYCLE
> 🟠 MEDIUM — Individual modules exist but not linked as lifecycle.

### T-180 ✅ Link movement to clearance
### T-181 ✅ Add individual trainee completion states
### T-182 ✅ Add posting/relieving workflow
### T-183 ✅ Create lifecycle timeline view in profile

---

## PHASE 19: PROFILE COMPONENT SPLIT
> ⚠️ MEDIUM — TraineeProfileScreen.tsx is ~100KB. Needs splitting.

### T-190 ✅ Extract registration form into separate component
### T-191 ✅ Extract each profile tab into separate component
### T-192 ✅ Create shared profile layout component

---

## 📊 AUDIT PHASES PROGRESS TRACKER

| Phase | Description | Tasks | Done | Status |
|-------|-------------|-------|------|--------|
| 12 | Canonical Trainee Type | 3 | 3 | ✅ |
| 13 | Attendance Deep Integration | 3 | 3 | ✅ |
| 14 | Leave Lifecycle Deepening | 4 | 4 | ✅ |
| 15 | Training Session Engine | 5 | 5 | ✅ |
| 16 | Exam/Marks History | 3 | 3 | ✅ |
| 17 | Discipline + Medical Deepening | 3 | 3 | ✅ |
| 18 | Movement → Clearance → Posting | 4 | 4 | ✅ |
| 19 | Profile Component Split | 3 | 3 | ✅ |
| **AUDIT TOTAL** | | **28** | **28** | **100%** |

---

## 📊 GRAND TOTAL

| Category | Tasks | Done | Status |
|----------|-------|------|--------|
| Phase 0-11 (Original) | 58 | 58 | ✅ 100% |
| Phase 12-19 (Audit) | 28 | 28 | ✅ 100% |
| **GRAND TOTAL** | **86** | **86** | **100%** |
