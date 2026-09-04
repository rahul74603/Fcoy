# Module — Training Delivery

**Priority: P0 (test records) / P1 (schedule, subjects, batch progress).**

**Who:** Company Commander and Clerk manage; Ustad views schedule, subjects
and batch progress.

**Source files:**
- `src/features/ustad/screens/TestRecordsScreen.tsx` (2,196 L) — the biggest
  single screen in the product
- `src/features/ustad/types/testRecord.types.ts` — subjects, FPT events, grades
- `src/features/ustad/screens/BatchProgressScreen.tsx` (997 L)
- `src/features/ustad/screens/TrainingScheduleScreen.tsx` (706 L)
- `src/features/ustad/screens/SubjectAssignmentScreen.tsx` (531 L)
- `src/features/ustad/screens/SubjectMasterScreen.tsx` (413 L)
- Plus `/period-attendance`, `/syllabus-tracking`, `/training-sessions`,
  `/final-board`, `/weekly-program`

**Verification:** CONFIRMED for test records, subjects, FPT events and
grades. The related screens in §7 have also now been traced and confirmed —
see `modules/15-registers-and-lifecycle.md`.

---

## 1. The Big Idea

> "Kaun sa vishay, kis ustad ne, kis din, kis platoon ko padhaya — aur us
> rangroot ne kaisa kiya. Poora training record ek jagah."

---

## 2. ⭐ 33 BSF Subjects — built in, not typed in

The system ships with the actual BSF training syllabus already loaded —
**33 subjects**, including:

| | |
|---|---|
| General Training · Drill · Ceremonial Drill | Weapon Training (WT) |
| Physical Training (PT) | Firing (Theory) · Firing (Practical) |
| Field Craft & Tactics · Map Reading | Internal Security (IS) |
| Border Management | BSF Act & Rules · IPC / CrPC · Law & Procedure |
| Counter Insurgency (CI) · Anti Infiltration | NBC Defence |
| Explosives & IED | First Aid & Hygiene |
| Wireless & Communication | Field Punishment Training (FPT) |
| Battle Obstacle Course (BOC) | **Human Rights** |
| Accounts & Store Procedure | Guard Duty & Sentry |
| Ambush & Patrolling | Riot Control / Mob Handling |
| Swimming · Cross Country | Rock Craft / Rope Work |
| Games & Sports Theory | |

**This is the strongest "they understand us" moment in the whole demo.**

**What to say:**
> "Ye list humne banai nahi — ye BSF ki asli training list hai. Tetees
> vishay, pehle se system me. Aapko kuch type nahi karna. Aur dekhiye —
> Human Rights bhi hai, Accounts & Store Procedure bhi. Jo log ye software
> bana rahe hain, unhone asli syllabus dekha hai."

Point at **Human Rights** specifically. It is the detail that proves the
list was not invented.

---

## 3. ⭐ FPT — Seven Events, 100 Marks

The **Field Punishment Training / physical test** ships with its real event
structure:

| Event | Max marks | Passing marks |
|---|---|---|
| **1.6 KM Run** | 20 | 10 |
| Long Jump | 15 | 8 |
| High Jump | 15 | 8 |
| Rope Climbing | 15 | 8 |
| Push Ups | 10 | 5 |
| Sit Ups | 10 | 5 |
| Chin Ups | 15 | 8 |
| **Total** | **100** | — |

Marks are entered **per event, per trainee**, and each event shows its own
**PASS / FAIL** — so you can see that a man cleared everything except rope
climbing, not just that he "failed FPT".

**Events are editable.** An instructor can add or remove events and change
max/passing marks for a particular test.

**What to say:**
> "Rangroot FPT me fail hua — theek hai, lekin kis event me fail hua? Yahan
> saaf dikhta hai. Rope climbing me atka hai, baaki sab paas hai. Ab ustad
> ko pata hai kis par mehnat karani hai."

### Running Grades (FPT only)

The 1.6 km run gets its own grade band: **🏆 Excellent · ⭐ Very Good ·
Good · Fail**, with a **grade distribution chart** across the batch.

> "Poore batch ki running grade ka distribution ek graph me. Kitne
> excellent, kitne fail — ek nazar me."

---

## 4. Eleven Test Types

`drill` · `weapon` · `firing` · `pt` · **`fpt`** · `map_reading` ·
`field_craft` · `battle_craft` · `first_aid` · `weekly` (written) ·
`custom`

Each type has its own label, icon, code and colour. Test status runs
`scheduled → in_progress → completed`, plus `cancelled`.
Grades: **A+ · A · B+ · B · C · D · F**.

**Firing gets special treatment** — the system distinguishes three register
kinds (**Grouping & Zeroing**, **Classification**, **Tactical**) and
records rounds issued, target type and firing position.

**What to say:**
> "Firing ka register alag hota hai — grouping alag, classification alag.
> System ye farak jaanta hai. Kitne rounds issue hue, kis position se
> chalaya — sab record me."

---

## 5. Results & Analysis

Results are grouped into three lists: **Failed · Absent · Passed** —
failures first, deliberately.

The screen also shows a **Top Failers** section.

**Why a buyer cares:**
> "Screen sabse pehle wo dikhata hai jo fail hue. Kyunki kaam wahin karna
> hai. Aur 'Top Failers' se pata chalta hai kaun baar-baar fail ho raha
> hai — usko extra attention chahiye."

Failures also feed the Commander's dashboard: **FPT Fail** and **Test Fail**
are two of the five alert streams, and each failure reduces that trainee's
health score.

---

## 6. Subjects & Assignment

| Screen | Purpose |
|---|---|
| `/subjects` — Subject Master | Maintain the subject list |
| `/subject-assignment` | Map instructors to subjects |
| `/training-schedule` | Build the training timetable |
| `/batch-progress` | Track how far a batch has come |
| `/weekly-program` | The weekly programme (Clerk) |

Two reports exist for this area: **Subject Assignment Report** and
**Instructor Category Summary**.

**What to say:**
> "Kaun sa ustad kaun sa vishay padhata hai — likha hua hai. Naya ustad
> aaye to pata chal jaata hai kaunsa vishay khaali pada hai."

---

## 7. Related Screens — now traced (label upgraded)

These routes were previously marked *UI PRESENT — END-TO-END NOT VERIFIED*
in this document. **They have since been traced and are CONFIRMED working
modules**, each with its own collection and full CRUD:

| Route | Screen | Verdict |
|---|---|---|
| `/final-board` | Final Board | ⭐ **CONFIRMED — computes the course result automatically. Demo-worthy.** |
| `/period-attendance` | Period Attendance | **CONFIRMED** — 10 periods, 17 subjects, 8 status codes |
| `/training-sessions` | Session Log | **CONFIRMED** — 7 session types |
| `/syllabus-tracking` | Syllabus Tracking | **CONFIRMED (basic)** — manual topic checklist |
| `/joining-workflow` | Joining Workflow | **CONFIRMED** — 7-stage pipeline |
| `/clearance` | Clearance | **CONFIRMED** — 10-department no-dues |
| `/discipline-register` | Discipline Register | **CONFIRMED** — punishments **and** awards |
| `/movement-register` | Movement Register | **CONFIRMED** — 6 types, overdue tracking |

**Full detail: `modules/15-registers-and-lifecycle.md`.**

⭐ **The Final Board is worth adding to a demo.** It reads the same
`training_tests` collection that `/test-records` writes to — verified
end-to-end — and computes percentage, subject-wise scores, FPT result,
firing classification, attendance %, an overall grade and a
**Fit for Duty / Conditional / Unfit** recommendation.

---

## 8. Demo Script (90 seconds)

1. `/test-records`. Point at the test type list. "Gyaarah tarah ke test."
2. Open the **subject list**. Scroll it slowly. Let them read the names.
   Stop at **Human Rights**. Deliver the §2 line.
3. Create an **FPT** test. Show the **seven events with marks already
   filled in** — 1.6 km run 20, long jump 15, and so on.
4. Enter marks for one trainee. Show the **per-event PASS/FAIL**.
5. Show the **running grade distribution** for the batch.
6. Scroll to **Failed** and **Top Failers**. "Screen sabse pehle problem
   dikhata hai."
7. Jump to `/commander` → tap the **FPT FAIL** filter. Same man is there.
8. Land it: *"Ustad ne marks bhare. Commander ko alag se batana nahi pada."*

---

## 9. ⚠️ Do NOT Promise

- ❌ **"Automatic grade calculation against BSF standards."** Passing marks
  are defaults you can edit — not a certified standard engine.
- ❌ **"Trainee sees his own marks."** The trainee portal shows notices,
  files and reports. Marks visibility is **NOT VERIFIED**.
- ❌ **"Certificates or mark sheets generated."** The Final Board computes
  and saves a result, but there is no certificate generator. Reports export
  as CSV/print.
- ❌ **"Syllabus completion percentage is live."** `/syllabus-tracking` is a
  manual topic checklist — status is set by hand, not driven by the timetable.
- ❌ **"Attendance per period is linked to the timetable automatically."**
  `/period-attendance` works, but auto-population from the schedule is not
  verified — treat subject selection as manual.
- ❌ **"Historical comparison across batches."** Not verified.
