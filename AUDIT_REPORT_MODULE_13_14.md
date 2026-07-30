# 🛡️ F COY ERP — MASTER AUDIT REPORT (Module 13 & 14)

**Audit Date:** 31 July 2026
**Golden Rule Applied:** Har feature evidence-checked (code padh kar). Recommendation: **✅ KEEP / 🔄 UPDATE / ♻️ REFACTOR / ➕ ADD NEW**
**★ = Is audit ke saath hi implement ho gaya** — TSC clean ✅ Build pass ✅

---

# MODULE 13 — EXAMINATION & ASSESSMENT

**Code base (evidence):**
- `src/features/ustad/screens/TestRecordsScreen.tsx` (~2,100 lines) — unified test system
- `src/features/ustad/types/testRecord.types.ts` (356 lines) — 11 test types, grades, FPT events
- `src/features/ustad/api/testRecord.api.ts` (316 lines) — `training_tests` collection + auto-publish to `weeklyTestRecords`/`fptRecords` + trainee auto-update
- `src/features/ustad/hooks/useTestRecords.ts` (188 lines) — activity logging included
- Route: `/test-records` → **STAFF_MANAGE_ROLES** (CC + Clerk) | Sidebar: "FPT / Weekly Test Records"

## Feature-wise Audit

### Dashboard
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 1 | Examination Dashboard | ✅ | **✅ KEEP** | 5 summary cards: Total Tests / Passed / Failed / Completed / Test Types + pass-rate |
| 2 | Assessment Dashboard | 🟡 | **🔄 UPDATE** | Analytics panel toggle hai (week stats, top failers, running grades, type-wise); dedicated assessment page nahi |
| 3 | Exam Calendar | 🟡 | **🔄 UPDATE (Medium)** | `testDate` + scheduled status hai, lekin calendar-grid view nahi. List = date-sorted |
| 4 | Upcoming Exams | 🟡 | **🔄 UPDATE** | `status: 'scheduled'` tests list mein dikhte hain, dedicated "upcoming" section nahi |

### Examination
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 5 | Written Test | ✅ | **✅ KEEP** | `weekly` type + 31 BSF subjects list |
| 6 | Practical Test | ✅ | **✅ KEEP** | weapon/map_reading/field_craft/battle_craft/first_aid types |
| 7 | Physical Test | ✅ | **✅ KEEP** | `pt` + `fpt` (7 default events + running grades) |
| 8 | Firing Test | ✅ | **✅ KEEP** | `firing` type dedicated |
| 9 | Obstacle Test | 🟡 | **🔄 UPDATE (Low)** | BOC subject hai; dedicated `obstacle` TestType nahi — `custom` se cover hota |
| 10 | Drill Test | ✅ | **✅ KEEP** | `drill` type |
| 11 | Subject Wise Exams | ✅ | **✅ KEEP** | `subjectCode` + BSF_SUBJECTS (31 subjects) |
| 12 | Custom Exam Types | ✅ | **✅ KEEP** | `custom` type + custom testName; FPT events bhi editable |

### Marks Management
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 13 | Marks Entry | ✅ | **✅ KEEP** | Per-trainee modal entry, search-in-modal, marks↔% auto-sync |
| 14 | Bulk Marks Entry | ✅ | **✅ KEEP** | `showBulkModal` — sab trainees ek saath grid entry |
| 15 | Auto Total | ✅ | **✅ KEEP** | FPT events se total auto-sum (`updateFPTEventMark`) |
| 16 | Auto Percentage | ✅ | **✅ KEEP** | `saveTestResults` percent compute; passingMarks↔passingPercent bi-sync |
| 17 | Grade System | ✅ | **✅ KEEP** | `calculateGrade` A+→F + FPT running grades (Excellent/VG/Good/Fail) |
| 18 | Pass / Fail Logic | ✅ | **✅ KEEP** | passingMarks threshold; FPT pe overallPassPercent + per-event pass |
| 19 | Rank Calculation | ❌→✅ ★ | **➕ ADDED ★** | Pehle koi rank nahi tha. ★ Ab: dense-rank (same marks = same rank) — details panel mein 🥇🥈🥉 badges + merit sheet mein rank column |
| 20 | Merit List | ❌→✅ ★ | **➕ ADDED ★** | ★ "Merit" button har completed test card pe → sarkari Result Sheet + Merit List print (rank-wise table, topper highlight, absent list, failed list, signature blocks) |

### Assessment
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 21 | Daily Assessment | 🟡 | **🔄 UPDATE (Low)** | testDate daily possible hai; "daily assessment" dedicated cadence nahi |
| 22 | Weekly Assessment | ✅ | **✅ KEEP** | `weekNumber` field + week-wise analytics table |
| 23 | Monthly Assessment | 🟡 | **🔄 UPDATE (Medium)** | Month aggregation analytics nahi |
| 24 | Final Assessment | ❌ | **➕ ADD NEW (High)** | End-of-batch final exam + composite scoring nahi |

### Performance
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 25 | Subject Wise Performance | ✅ | **✅ KEEP** | typeStats — type-wise pass-rate cards |
| 26 | Platoon Wise Performance | ❌→✅ ★ | **➕ ADDED ★** | ★ Analytics mein Platoon-wise table (position 🥇, pass/fail, pass-rate bar, avg%) |
| 27 | Batch Wise Performance | ✅ | **✅ KEEP** | Sab batchId-scoped |
| 28 | Individual Performance | 🟡→✅ ★ | **🔄 UPDATED ★** | Pehle sirf "Most Failed" table thi; ★ ab Top Performers cards (avg% top-5) bhi |
| 29 | Weak Subject Detection | 🟡→✅ ★ | **➕ ADDED ★** | weakAreas field pehle se tha; ★ ab **auto-detection**: pass-rate < 50% subjects red alert panel mein ("extra classes schedule karein") |
| 30 | Top Performer | ❌→✅ ★ | **➕ ADDED ★** | ★ Top-5 performers podia cards + merit sheet mein 🏆 topper line |

### Reports
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 31 | Marksheet | ❌→🟡 ★ | **➕ ADDED ★ (consolidated)** | ★ Result sheet sab trainees ka consolidated marksheet hai; per-trainee individual marksheet backlog |
| 32 | Result Sheet | ❌→✅ ★ | **➕ ADDED ★** | `buildTestResultHtml` — govt format (unit/coy header, max/pass marks, examiner, pass-rate, signatures) |
| 33 | Merit List | ❌→✅ ★ | **➕ ADDED ★** | Same document — dense-rank table medals ke saath |
| 34 | Failed Candidates | ❌→✅ ★ | **➕ ADDED ★** | Report ke andar dedicated "⚠ FAILED CANDIDATES — improvement required" section + absent section |
| 35 | Improvement Report | 🟡 | **🔄 UPDATE (Medium)** | Failed-list + weak-subjects ★ se input ready; consolidated "improvement plan" print backlog |
| 36 | Performance Graph | 🟡 | **🔄 UPDATE (Medium)** | Progress bars hain; recharts trend charts backlog |

### Search & Filters
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 37 | Chest Number | ✅ | **✅ KEEP** | results modal mein chest/name search |
| 38 | Batch | ✅ | **✅ KEEP** | batch-scoped |
| 39 | Platoon | 🟡 | **🔄 UPDATE (Medium)** | Results mein platoon data + ★ platoon analytics; test-list pe platoon filter nahi |
| 40 | Subject | 🟡 | **🔄 UPDATE (Medium)** | Type filter hai; subject-code filter nahi |
| 41 | Exam Type | ✅ | **✅ KEEP** | Filter tabs (All + 11 types, count badges) |

### Integration
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 42 | Trainee | ✅ | **✅ KEEP** | `saveTestResults` → `trainees.fptResult/fptScore/weeklyExamResult/weeklyExamMarks` auto-update |
| 43 | Weekly Training | ❌ | **➕ ADD NEW (Medium)** | weeklyPrograms se test week link nahi |
| 44 | Attendance | 🟡 | **🔄 UPDATE (High)** | Test-absent sirf result mein hai; `trainee_attendance` hazri pe reflect nahi hota |
| 45 | Reports | ✅ | **✅ KEEP** | Auto-publish to `weeklyTestRecords` + `fptRecords` (backward compat), `_autoPublishedFrom` tag |
| 46 | Dashboard | 🟡 | **🔄 UPDATE** | CC dashboard mein exam widget nahi; BatchProgress se loose link |

### Technical
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 47 | Firestore Structure | ✅ | **✅ KEEP** | single `training_tests` doc per test with embedded results — fast reads, sane size (<200 trainees) |
| 48 | Role Based Access | ✅ | **✅ KEEP** | STAFF_MANAGE_ROLES; Ustad ko abhi view nahi (by design) |
| 49 | Audit Trail | 🟡 | **🔄 UPDATE** | createdBy + logActivity on create/status; results-save pe activity log detail add ho sakti |
| 50 | Activity Log | ✅ | **✅ KEEP** | `logActivity` in useTestRecords |
| 51 | Performance | 🟡 | **🔄 UPDATE** | `getTestsByBatch` full-batch fetch client-sort — batch scale pe OK |
| 52 | Security | 🟡 | **🔄 UPDATE (Critical-common)** | Firestore rules poore project mein missing |
| 53 | Scalability | ✅ | **✅ KEEP** | per-test doc model scales fine |

## 📊 MODULE 13 SCORES
| Metric | Score |
|---|---|
| Overall | **74/100** |
| Completion | 72% (★ ke baad; pehle ~58%) |
| UI | 82 |
| Code Quality | 80 |
| Database Quality | 80 |
| Architecture | 78 |
| Performance | 78 |
| Security | 60 |
| Scalability | 78 |
| Government ERP | 76 (★ result-sheet/merit print se strong; approval + rules pending) |

### Top 10 Existing Features Worth Keeping (M13)
1. 11 test types + custom type (pure BSF syllabus cover)
2. FPT events engine (7 defaults + editable + running grades Excellent/VG/Good/Fail)
3. Bulk marks entry grid (poori company ek saath)
4. Auto percentage + auto grade + pass/fail (zero manual calc)
5. marks↔percent bi-directional sync in create form
6. Auto-publish to legacy collections (backward compat genius move)
7. Trainee profile auto-update (fptResult/weeklyExamMarks)
8. Week-wise analytics + Most-Failed trainees table
9. Multiple instructors per test
10. Duplicate test check (batch+name+week)

### Top 10 Features To Update (M13)
1. ★ ~~Rank + Merit~~ (DONE)
2. ★ ~~Platoon/Top/Weak analytics~~ (DONE)
3. Test-absent → trainee hazri sync (High)
4. Exam calendar grid view
5. Platoon/subject filters on test list
6. Final assessment (composite end-of-batch)
7. Per-trainee individual marksheet (batch ka saara record ek page)
8. Recharts trend graphs (week pass-rate line)
9. Monthly assessment aggregation
10. Activity log detail on results-save

### Top 10 Missing (M13)
1. ~~Rank calculation~~ ★
2. ~~Merit list~~ ★
3. ~~Weak subject auto-detection~~ ★
4. Final assessment engine — High
5. Individual cumulative marksheet — High
6. Exam calendar — Medium
7. Test↔weeklyProgram linkage — Medium
8. Test-absent hazri sync — High
9. Re-test scheduling for failed — Medium
10. Question bank / syllabus coverage tracker — Future

### Top 10 Critical Problems (M13)
1. ~~Merit/rank kahi nahi tha (sarkari result = rank list!)~~ → ★ FIXED
2. ~~Print result sheet absent~~ → ★ FIXED
3. ~~Platoon comparison impossible~~ → ★ FIXED
4. ~~Weak subjects manual analysis maang te the~~ → ★ FIXED (auto)
5. Final assessment missing (pass-out ke liye critical)
6. Test-absent hazri se link nahi (attendance mismatch risk)
7. Security rules missing (common)
8. No CC approval/verification stamp on results
9. Results-edit pe old publish records orphan rehte hain (weeklyTestRecords mein duplicates possible)
10. Individual report card missing

### Top 10 Future Enhancements (M13)
1. Composite final scorecard (all tests weighted → pass-out merit)
2. Per-trainee transcript print (saare tests + graph)
3. Question-bank with auto written-test papers
4. Re-test workflow (failed → scheduled retest → improvement delta)
5. Attendance-aware test scheduling (hazri ★ se absent auto-flag)
6. CC result-signing workflow (DRAFT → PUBLISHED)
7. AI weak-area prediction per trainee
8. Platoon-vs-platoon competition leaderboard
9. SMS/WhatsApp result to parents (record)
10. OMR-scan import for written tests

---

# MODULE 14 — MEDICAL MANAGEMENT

**Code base (evidence):**
- `src/features/medical/MedicalRegisterScreen.tsx` (~560 lines) — MI Room register
- Collections: `medicalRecords` + `absentRecords` bridge (S/H/R/M) + trainees (`attn`/`medStat`/`medicalStatus`)
- Trainee master fields: `bloodGroup`, `height`, `weight`, `chest` measurement ✅ (registration mein)
- Route: `/medical-register` (Clerk section — "MI Room & Medical")

## Feature-wise Audit

### Medical Dashboard
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 1 | Medical Summary | ✅ | **✅ KEEP** | 3 cards: Hospital Admitted / Light Duty / Total Active |
| 2 | Sick Trainees | ✅ | **✅ KEEP** | Active list (red-tinted rows) + absentRecords merged view |
| 3 | Hospital Cases | ✅ | **✅ KEEP** | Hospital Admit category + ward no |
| 4 | Fitness Status | ✅ | **✅ KEEP** | Active / Fit-Discharged + SHAPE-1 restore on Mark Fit |

### Medical Profile
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 5 | Blood Group | ✅ | **✅ KEEP** | trainees.bloodGroup (registration) |
| 6 | Height | ✅ | **✅ KEEP** | trainees.height |
| 7 | Weight | ✅ | **✅ KEEP** | trainees.weight |
| 8 | BMI | ❌ | **➕ ADD NEW (Low)** | height/weight hai lekin BMI compute/display kahi nahi |
| 9 | Vision | ❌ | **➕ ADD NEW (Medium)** | koi vision field nahi |
| 10 | Allergies | ❌ | **➕ ADD NEW (Medium)** | koi allergies field nahi |
| 11 | Medical History | 🟡 | **🔄 UPDATE** | Per-trainee medical records = history hai (★ filter se dekh sakte); consolidated profile-view nahi |

### Medical Records
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 12 | Daily Sick Report | ✅→🔥 ★ | **🔄 UPDATED ★** | Sick Report category pehle se; ★ ab **printable Daily Sick Parade State** (aaj ke naye cases + saare active cases category-wise + strength% + signature blocks) |
| 13 | Medical Examination | ❌→✅ ★ | **➕ ADDED ★** | ★ Naya `Medical Exam` category — record-only (duty status UNCHANGED rehta: exam ≠ sick) |
| 14 | Injury Register | ❌→✅ ★ | **➕ ADDED ★** | ★ Naya `Injury (Training)` category — attendance 'S' sync + orange badge |
| 15 | Hospital Referral | ✅ | **✅ KEEP** | Hospital Admit + wardNo (referred hospital) |
| 16 | Medical Certificate | ❌ | **➕ ADD NEW (High)** | Certificate upload/print nahi |
| 17 | Fitness Certificate | ❌ | **➕ ADD NEW (High)** | "Fit to join" print per trainee nahi (Mark Fit action hai, document nahi) |

### Medicine Management
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 18 | Medicine Stock | ❌ | **➕ ADD NEW (High)** | Koi medicine inventory nahi |
| 19 | Medicine Issue | ❌ | **➕ ADD NEW (High)** | Issue register nahi |
| 20 | Prescription | ❌ | **➕ ADD NEW (Medium)** | remarks text mein plausible; dedicated nahi |
| 21 | Treatment History | 🟡 | **🔄 UPDATE** | Records + remarks = treatment trail; medicine-level nahi |

### Medical Leave
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 22 | Medical Leave Entry | ✅ | **✅ KEEP** | S/H/R/M absentRecords bridge (bi-directional view) |
| 23 | Medical Approval | ❌ | **➕ ADD NEW (High)** | Koi approval nahi — clerk direct mark kar deta hai |
| 24 | Recovery Status | ✅ | **✅ KEEP** | Mark Fit + smart re-check (aur active cases? to attn P nahi hoga!) |
| 25 | Fit To Join | ✅ | **✅ KEEP** | attn P + medStat SHAPE-1 restore |

### Reports
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 26 | Medical Report | ❌→✅ ★ | **➕ ADDED ★** | ★ Daily Sick Parade State print (sarkari format) |
| 27 | Sick Report | ❌→✅ ★ | **➕ ADDED ★** | ★ same document |
| 28 | Hospital Report | 🟡 | **🔄 UPDATE** | ★ report mein Hospital section aa jaata; standalone hospital-register print backlog |
| 29 | Injury Report | 🟡 ★ | **🔄 UPDATE** | ★ Injury category + report section; standalone backlog |
| 30 | Fitness Report | 🟡 | **🔄 UPDATE** | Fit/Discharged records hain; SHAPE-wise summary print nahi |

### Search (★ pehle BILKUL nahi tha — sirf poori list!)
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 31 | Chest Number | ❌→✅ ★ | **➕ ADDED ★** | ★ search bar (chest/name/diagnosis) |
| 32 | Name | ❌→✅ ★ | **➕ ADDED ★** | ★ same |
| 33 | Batch | ✅ | **✅ KEEP** | batch-scoped |
| 34 | Disease | ❌→✅ ★ | **➕ ADDED ★** | ★ diagnosis text search |
| 35 | Medical Status | ❌→✅ ★ | **➕ ADDED ★** | ★ status + category + platoon dropdown filters |

### Integration
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 36 | Trainee | ✅ | **✅ KEEP** | attn/medStat/medicalStatus sync (★ exam pe safe skip) |
| 37 | Leave | ✅ | **✅ KEEP** | absentRecords bi-dir merge — kaafi mature |
| 38 | Attendance | ✅ | **✅ KEEP** | attn codes P/A/L/S/H/R/M consistent |
| 39 | Reports | ❌→✅ ★ | **➕ ADDED ★** | ★ printDocuments pattern reuse |
| 40 | Dashboard | 🟡 | **🔄 UPDATE** | CC dashboard medical widget add karna |

### Technical
| # | Feature | Status | Recommendation | Evidence |
|---|---------|--------|----------------|----------|
| 41 | Firestore Collections | ✅ | **✅ KEEP** | medicalRecords batch-scoped + absent bridge |
| 42 | Storage | ❌ | **➕ ADD NEW (Medium)** | certificate uploads ke liye |
| 43 | Security Rules | ❌ | **➕ ADD NEW (Critical-common)** | missing |
| 44 | Role Based Access | ✅ | **✅ KEEP** | Clerk-managed route |
| 45 | Audit Trail | ❌→✅ ★ | **➕ ADDED ★** | ★ createdBy/createdByName on entry + fitMarkedBy/fitMarkedAt on Mark Fit (pehle kuch nahi tha!) |
| 46 | Activity Log | 🟡 | **🔄 UPDATE** | staff activityLog api alag; medical entries unified log mein nahi |
| 47 | Performance | ✅ | **✅ KEEP** | 2 queries, batch-scoped |
| 48 | Scalability | ✅ | **✅ KEEP** | |

## 📊 MODULE 14 SCORES
| Metric | Score |
|---|---|
| Overall | **66/100** |
| Completion | 64% (★ ke baad; pehle ~50%) |
| UI | 76 |
| Code Quality | 72 |
| Database Quality | 74 |
| Architecture | 70 (in-component Firestore calls; API layer nahi — ustad-module pattern se alag) |
| Performance | 80 |
| Security | 58 |
| Scalability | 74 |
| Government ERP | 68 (★ sick-state print + audit stamps se behtar; certificate/approval/medicine stock pending) |

### Top 10 Existing Features Worth Keeping (M14)
1. absentRecords ↔ medicalRecords bi-directional merge (genius!)
2. Mark Fit smart logic (aur active cases ho to attn P nahi hota — data safety)
3. SHAPE-1 restore on discharge
4. attn + medStat + medicalStatus tri-sync on entry
5. Delete pe bhi status re-check (consistency guard)
6. Category color badges + Active red-tint rows
7. Ward no + recommended days conditional fields
8. Batch-locked screen
9. Duplicate absent merge (exists check per trainee+date+category)
10. Trainee dropdown chest-sorted

### Top 10 Features To Update (M14)
1. ★ ~~Search & filters~~ (DONE)
2. ★ ~~Audit stamps~~ (DONE)
3. ★ ~~Sick report print~~ (DONE)
4. Medical approval flow (clerk → CC/medical officer) — High
5. BMI auto-display (height/weight se compute) — Low
6. Per-trainee medical profile page (blood/ht/wt + history timeline)
7. Medicine stock (ration-store pattern reuse: receive − issue = stock) — High
8. Fitness certificate per-trainee print (Mark Fit ke saath) — High
9. CC dashboard medical widget — Medium
10. Screen ko API/hook pattern mein move (architecture consistency) — Low

### Top 10 Missing (M14)
1. ~~Injury register~~ ★
2. ~~Medical examination record~~ ★
3. ~~Daily sick parade state print~~ ★
4. Medicine stock + issue register — High
5. Medical certificate upload — High
6. Fitness certificate print — High
7. Medical approval — High
8. Vision/allergies fields — Medium
9. Per-trainee medical timeline — Medium
10. Monthly medical summary board — Medium

### Top 10 Critical Problems (M14)
1. ~~Koi search/filter nahi — 500 records mein dhoondhna impossible~~ → ★ FIXED
2. ~~Audit trail zero (kya kab kisne entry ki — pata nahi)~~ → ★ FIXED
3. ~~Sarkari sick parade state print nahi~~ → ★ FIXED
4. ~~Injury (training) alag register nahi (audit question)~~ → ★ FIXED
5. Medicine ka hisaab hi nahi (stock/issue/expiry) — biggest remaining gap
6. Certification documents absent
7. Approval-less entries (clerk direct medical mark kar sakta hai)
8. Security rules missing (common)
9. Medical data sensitive hai — role-scoping doctor/medic ke liye nahi
10. BMI/vision/allergy missing (recruitment medical standards)

### Top 10 Future Enhancements (M14)
1. Medicine store (batch/expiry/stock alerts) — M6 stock pattern reuse
2. Per-trainee medical folder (certs + history + vitals)
3. Medicine issue slip print (kit-slip ★ pattern)
4. SHAPE classification board (SHAPE-1/2/Temp/Perm unfit register)
5. Monthly MI report (disease-wise, platoon-wise, man-days lost)
6. Sick parade morning auto-list (hazri ★ + medical merge)
7. Medicine expiry alerts + low-stock warnings
8. Smart medical alerts (3+ sick same platoon = outbreak flag)
9. Hospital referral tracking (referred → admitted → returned chain)
10. AI: injury hotspot detection (kaunse training event pe injuries — schedule link)

---

# 🏆 FINAL COMPARISON

| Module | Completion % | Existing Features | Update Required | New Features Required | Production Ready |
|---|---|---|---|---|---|
| 13. Examination & Assessment | **72%** | 24 | 15 (5 ★ done) | 9 (4 ★ done) | 🟡 Final assessment + hazri sync ke baad |
| 14. Medical Management | **64%** | 18 | 12 (5 ★ done) | 15 (5 ★ done) | ❌ Medicine stock + certificates ke bina nahi |

## PRIORITY TABLE
| Bucket | Items |
|---|---|
| **Critical** | Security rules (common) · ★ Rank/Merit/Result print · ★ Medical audit stamps · ★ Medical search · Final assessment engine |
| **High** | Test-absent → hazri sync · Medicine stock register · Medical approval · Fitness certificate print · Medical certificate upload · Individual marksheet |
| **Medium** | Exam calendar · Platoon/subject test filters · Per-trainee medical timeline · BMI display · Monthly assessments · Hospital/Injury standalone reports · Vision/allergy fields · CC exam-result sign-off |
| **Low** | Recharts graphs · Architecture move (medical API layer) · Obstacle dedicated type · Weekly-program test link · SMS/WhatsApp hooks |

---

# 📌 FINAL IMPLEMENTATION STRATEGY

### ✅ KEEP AS IT IS
- Unified test engine (types/FPT/bulk/auto-calc/auto-publish)
- absentRecords↔medical bridge + Mark-Fit smart guard + tri-sync
- Grade system + week analytics + duplicate check
- Batch locks + role routes + activity logs

### 🔄 UPDATE EXISTING
- ★ Test analytics panel (platoon/top/weak)
- ★ Medical dashboard table (days-since, createdBy, category colors)
- Test-absent hazri sync (backlog)
- Medical screen → API layer consistency (backlog)

### ♻️ REFACTOR EXISTING
- koi existing structure galat nahi mila is scope mein — dono modules short-term stable hain

### ➕ ADD NEW FEATURE (order mein)
1. ★ ~~Merit/Rank/Result print~~ · ★ ~~Medical search/filters~~ · ★ ~~Sick state print~~ · ★ ~~Audit stamps~~ · ★ ~~Injury/Exam categories~~ (ALL DONE)
2. Final assessment engine (composite scorecard)
3. Medicine stock register (M6 stock pattern: receive − issue + expiry)
4. Fitness/Medical certificate generation (per-trainee print)
5. Medical approval flow + exam-result CC sign-off
6. Per-trainee transcript + medical timeline pages

---

# 🗺️ PHASED ROADMAP

**Phase 1 – Stabilization (★ DONE is audit mein):** Result/Merit print, weak-subject detection, medical search, audit stamps, injury/exam categories, safe duty-sync guard
**Phase 2 – Enhancement:** Final assessment, medicine stock, certificate prints, exam-result sign-off, medical approval, platoon/subject filters
**Phase 3 – Intelligence:** Per-trainee transcript & medical timeline, monthly MI summary, re-test workflow with improvement delta, trend graphs
**Phase 4 – Future Ready:** AI weak-area prediction, injury-hotspot analytics, outbreak early-warning, question bank + auto papers, OMR import

---

# 🛡️ FINAL SAFETY LIST

**Never Remove:** Unified test engine · FPT running grades · auto-publish legacy bridge · absent↔medical merge · Mark-Fit smart guard · attn/medStat sync · batch locks
**Safe To Refactor:** Medical screen → API/hook split · test analytics computations (extract to engine file jab aur charts aayein)
**Must Add (remaining):** Final assessment · medicine stock · certificate prints/uploads · medical approval · hazri sync for test-absent · security rules (common)
**Future Version:** AI assessment analytics · predictive performance · smart medical alerts · enterprise reporting pack

---

# ✅ IS AUDIT KE SAATH IMPLEMENT HUA (★)

| # | Feature | Module | Type | Files |
|---|---------|--------|------|-------|
| ★1 | **Dense-Rank system** — same marks = same rank; details panel mein 🥇🥈🥉 badges per row (absent ko rank nahi) | 13 | ➕ Add New | `TestRecordsScreen.tsx` |
| ★2 | **Merit List / Result Sheet print** — govt format: rank table, topper, pass-rate, failed + absent sections, signature blocks ("Merit" button completed test card pe) | 13 | ➕ Add New | `printDocuments.ts` (+`buildTestResultHtml`), `TestRecordsScreen.tsx` |
| ★3 | **Platoon-wise Performance** — position medals, pass-rate bars, avg% | 13 | ➕ Add New | `TestRecordsScreen.tsx` analytics |
| ★4 | **Top Performers** — top-5 podia cards (overall avg%) | 13 | ➕ Add New | `TestRecordsScreen.tsx` |
| ★5 | **Weak Subject auto-detection** — pass-rate < 50% subjects red alert ("extra classes schedule karein") | 13 | ➕ Add New | `TestRecordsScreen.tsx` |
| ★6 | **Medical Search & Filters** — chest/naam/diagnosis search + category/status/platoon dropdowns + live count | 14 | ➕ Add New | `MedicalRegisterScreen.tsx` |
| ★7 | **Daily Sick Parade State print** — date picker, aaj ke naye cases + saare active category-wise, strength%, signatures | 14 | ➕ Add New | `printDocuments.ts` (+`buildSickReportHtml`), `MedicalRegisterScreen.tsx` |
| ★8 | **Injury (Training) + Medical Exam categories** — exam pe duty-status sync safe-skip, injury normal 'S' sync, naye badge colors | 14 | ➕ Add New | `MedicalRegisterScreen.tsx` |
| ★9 | **Medical audit trail** — createdBy/createdByName/createdAt on entry; fitMarkedBy/At on discharge; row pe "by X" display | 14 | ➕ Add New | `MedicalRegisterScreen.tsx` |
| ★10 | **Day-counter** — active case "Day N" badge (chronic case instantly dikhe) | 14 | ➕ Add New | `MedicalRegisterScreen.tsx` |

> **Golden rule verify:** koi feature remove/replace nahi. Purane tests bina rank ke the — wo automatically merit sheet + rank pa gaye (computed on read). Purane medical records bina createdBy ke — gracefully display hota hai. Migration: **zero**. TSC clean ✅ Vite build pass ✅
