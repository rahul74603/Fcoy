# Module — The Ten Traced Registers

> **Why this document exists:** these ten routes were previously labelled
> **UI PRESENT — END-TO-END NOT VERIFIED** in the documentation package. They
> have now been traced. **Nine of the ten are fully working modules with a
> complete API layer** — and three of them are strong enough to demo.
>
> **Audit date:** 2026-09-04. All labels below supersede the earlier ones in
> `09-training-delivery.md` §7 and `99-DOCUMENTATION-AUDIT.md` §7.

---

## 1. Verdict Summary

| Route | Screen | API | Verdict |
|---|---|---|---|
| `/final-board` | 178 L | 90 L | ⭐ **CONFIRMED — demo-worthy** |
| `/welfare-demographics` | 454 L | 2,487 L module | ⭐ **CONFIRMED — demo-worthy** |
| `/mismatch-dashboard` | 145 L | 173 L engine | ⭐ **CONFIRMED — demo-worthy** |
| `/period-attendance` | 480 L | 81 L | **CONFIRMED** |
| `/discipline-register` | 409 L | 74 L | **CONFIRMED** |
| `/joining-workflow` | 237 L | 36 L | **CONFIRMED** |
| `/movement-register` | 249 L | 43 L | **CONFIRMED** |
| `/clearance` | 171 L | 58 L | **CONFIRMED** |
| `/training-sessions` | 208 L | 41 L | **CONFIRMED** |
| `/syllabus-tracking` | 217 L | 32 L | **CONFIRMED (basic)** |

**Every one has its own Firestore collection and full create/read/update/
delete.** None is a stub. The earlier "NOT VERIFIED" label was a gap in the
documentation, not a gap in the product.

**Access:** all are CC + Clerk (`STAFF_MANAGE_ROLES`), except
`/mismatch-dashboard` (**CC only**) and `/welfare-demographics`
(CC + Clerk + QM).

---

# ⭐ THE THREE WORTH DEMOING

---

## 2. ⭐⭐ Final Board (`/final-board`) — the course result engine

**Collection:** `finalResults` · **Priority: P0**

This is not a data-entry screen. It **computes** a trainee's final course
result from data already in the system.

### What it pulls together, automatically

Reading every test in `training_tests` plus the absence register, it produces:

| Output | How |
|---|---|
| Total marks / obtained / **percentage** | Summed across all completed tests (absent entries skipped) |
| **Subject-wise scores** | PT · Drill · Weapon · Firing · Written, split by test type |
| **FPT result** | Pass / Fail / Not Done |
| **Firing classification** | Pulled from the firing test's own classification |
| **Attendance %** | 100 minus total absent days |
| **Overall grade** | A+ ≥90 · A ≥80 · B+ ≥70 · B ≥60 · C ≥50 · D ≥40 · else F |
| **Recommendation** | ⬇ see below |

### The recommendation rule

| Result | Condition |
|---|---|
| **Unfit** | percentage < 40 **or** FPT failed |
| **Conditional** | percentage < 50 **or** attendance < 75% |
| **Fit for Duty** | everything else |

*(A fourth value, `Re-Test Required`, exists in the type and can be set.)*

### ⭐ Verified end-to-end

`/test-records` writes to `training_tests`. Final Board reads
`training_tests`. **The chain is real** — marks entered by an Ustad flow
into the final board with no re-entry.

**What to say:**
> "Course khatam. Ab final result banana hai — purane system me har
> rangroot ka har test dhoondh kar jodna padta tha, hafton ka kaam.
>
> Yahan system khud jod deta hai. Saare test, subject-wise score, FPT paas
> hua ya nahi, firing ki classification, hazri ka percentage — sab pehle se
> system me hai.
>
> Aur sabse aakhir me ek line: **Fit for Duty**. Ya agar FPT fail hai to
> **Unfit**. Ya agar hazri pachhattar percent se kam hai to **Conditional**.
> Niyam pehle se tay hain — har rangroot par ek jaisa lagta hai."

**Why a buyer cares:** this is the single most laborious clerical task of a
training course, and the place where favouritism is most often alleged. A
fixed rule applied identically to everyone is a governance improvement, not
just a time saving.

> ⚠️ Honest caveats: attendance % is `100 − absent days`, a simple
> approximation, not periods-attended ÷ periods-held. The pass thresholds
> are **hard-coded**, not configurable from settings. Do not promise a
> certificate generator — the result is saved and viewable, not printed as
> an official document.

---

## 3. ⭐⭐ Welfare & Festival Planner (`/welfare-demographics`)

**A 2,487-line module.** **Priority: P0 for a welfare-minded commander.**

### Two things in one screen

**a) Demographics.** Six live figures — Total Strength · In Current View ·
**States** · **Religions** · **Languages** · **Data Complete %** — with
bilingual labels (कुल · राज्य · धर्म · भाषाएँ · पूर्णता) and drill-down
filters.

**b) ⭐ The Festival Planner.** A built-in **festival calendar for 2026–27**
(41 entries) that matches festivals to the trainees who actually observe
them, by **religion and home state**, and shows **how many days away** each
one is.

Each festival carries a **welfare note written for a unit**, for example:
> *"Poori company — Flag hoisting, special lunch, sweets distribution."*

The tab badge counts festivals within **90 days** that have eligible
trainees. Plans can be exported.

The calendar file states its own purpose — extra ration and sweets, special
mess menu, leave roster planning, and arranging phone or video calls home.

**And it is honest about lunar dates:**
> *"Lunar festivals (Eid, Muharram, Milad) ki dates chaand dikhne par 1 din
> aage-peeche ho sakti hain — TENTATIVE maan kar unit HQ se confirm karein."*

**What to say — this lands with senior officers:**
> "Ye screen sirf ginti nahi hai. Company me kaun se rajya ke log hain,
> kaun si bhasha bolte hain, kaun sa tyohaar manate hain — sab dikhta hai.
>
> Aur Festival Planner batata hai ki agle teen mahine me kaun sa tyohaar aa
> raha hai, kitne log manayenge, aur us din kya intezaam karna hai —
> mithai, mess ka special menu, ghar phone karne ka arrangement.
>
> Jawaan apne ghar se door hai. Uska tyohaar yaad rakhna afsar ka kaam hai.
> Ab system yaad dilata hai."

> ⚠️ Present it as a **planning aid**. It does not book leave, order
> rations or send anything automatically.

---

## 4. ⭐ Mismatch Dashboard (`/mismatch-dashboard`) — CC only

**Engine:** `mismatchEngine.ts` (173 L) · **Priority: P1**

The system audits **its own data** and reports what is wrong — with a
suggested fix for every issue.

### What it checks

| Category | Checks |
|---|---|
| **Identity** | Name · Regt No · Chest No · DOB · Father's name missing |
| **Medical** | Blood group missing · active medical records to review |
| **Contact** | Mobile number · **emergency contact** missing |
| **Documents** | Count of unverified documents |
| **Attendance** | Absent days over threshold (10) · period attendance **< 75% (High)** and **< 50% (Critical)** |
| **Training** | FPT not attempted · **FPT all attempts failed** · firing not done |
| **Data Integrity** | ⭐ **Duplicate chest numbers** · **duplicate regimental numbers** |

Four severity levels — Critical · High · Medium · Low — and **every issue
carries a suggestion**, e.g. *"Below 75% threshold — warning needed"*,
*"Fix duplicate chest numbers immediately"*, *"Remedial training needed"*.

**What to say:**
> "Ye screen system apne aap ko check karne ke liye chalata hai. Kiska blood
> group nahi bhara, kiska emergency contact khaali hai, kis do rangroot ka
> chest number ek jaisa ho gaya.
>
> Aur sirf problem nahi batata — har problem ke saath likha hai kya karna
> hai.
>
> Duplicate chest number pakadna sabse zaroori hai. Wo galti mahine baad
> pata chalti hai, aur tab tak dono ka record mil chuka hota hai."

**Why a buyer cares:** every other system tells you what you entered. This
one tells you what you *failed* to enter — before an inspection does.

---

# THE OTHER SEVEN — solid, working registers

---

## 5. Period Attendance (`/period-attendance`)

**Collection:** `periodAttendance` · **480-line screen**

Attendance **per period**, not just per day.

- **10 periods:** Morning PT · 1st–8th Period · Evening Games
- **17 subjects:** PT · Drill · Weapon Training · Firing · Law · Tactics ·
  Map Reading · Field Craft · Battle Craft · First Aid · Communication ·
  Computer · Swimming · Games · Parade · Route March · Other
- **8 status codes:** ✅ P · ❌ A · ✈️ L · 🏥 S · 🏨 H · 🛡️ Duty · 📋 TD ·
  **👥 BP (Body Pair)**
- **10 preset absence reasons:** Without Leave · Sick Report · Family
  Problem · Personal Work · Medical Appointment · Hospital Visit · Duty
  Leave · Authorized Absence · Late Coming · Other
- **Five views:** Mark · Daily · Weekly · Monthly · Absent report
- Bulk marking; queries by date, by range and by trainee

**Point at "Body Pair."** It is a real BSF training concept. Nobody
inventing a generic attendance module puts it in.

**Feeds:** the mismatch dashboard's period-attendance percentage checks.

> ⚠️ Not verified: whether the timetable auto-populates the subject for each
> period. Treat it as manual selection.

---

## 6. Discipline Register (`/discipline-register`)

**Collection:** `disciplineRecords` · **409-line screen**

**Five record types — and note that three are positive:**
**Punishment · 🏅 Award · 🏅 Commendation · Warning · Restriction**

Status: `Active → Completed`, plus `Expired` and `Revoked`. Categories and
punishment types are defined lists. Records can be pulled per batch or per
trainee.

**What to say:**
> "Register sirf saza ka nahi hai. Award aur commendation bhi isi me darj
> hote hain. Kyunki rangroot ka record dono taraf ka hona chahiye.
>
> Aur 'Revoked' bhi ek status hai — agar saza wapas li gayi to record me
> dikhta hai ki li gayi thi aur hataayi gayi. Mitaya nahi jaata."

---

## 7. Joining Workflow (`/joining-workflow`)

**Collection:** `joiningRecords` · **A seven-stage pipeline**

**Selected → Called → Reported → Verified → Medically Fit → Joined →
Allocated**

Each stage has its own icon and colour. Overall status: Active · Completed ·
**Dropped** · **Transferred**.

**What to say:**
> "Naya batch aane se pehle hi kaam shuru ho jaata hai. Kisko bulaya, kaun
> aaya, kiska verification hua, kaun medically fit nikla, kiska platoon
> allot hua — saat stage, har banda kis stage par hai wo saaf dikhta hai.
>
> Aur jo beech me chala gaya — 'Dropped' — wo bhi record me rehta hai."

---

## 8. Movement Register (`/movement-register`)

**Collection:** `movementRecords`

**Six movement types:** Transfer · Posting · Detachment · Return ·
Temporary Duty · Course
**Four statuses:** Ordered · Completed · **Overdue** · Cancelled

Queries per batch and per trainee.

> "Kaun kahan gaya, kis order se, wapas aaya ya nahi. Aur jo wapas nahi
> aaya — **Overdue** likha aata hai."

---

## 9. Clearance (`/clearance`)

**Collection:** `clearanceRecords`

The no-dues process, across **ten departments**:
Kit Store · Mess · Medical · Documents · Library · Arms Room · QM Store ·
Sports · Training · Discipline

Each department is individually **Pending · Cleared · Exempted**, and
**bulk clearance records can be created for a whole batch at once**.

**What to say:**
> "Course khatam hone par no-dues. Dus vibhag, har ek ka alag status. Aur
> poore batch ke liye ek saath bane — har rangroot ka form alag se banane
> ki zaroorat nahi.
>
> 'Exempted' bhi ek option hai. Kabhi kisi ko koi cheez issue hi nahi hui —
> to usko clear karne ka sawaal nahi. System sach likhta hai."

---

## 10. Training Sessions Log (`/training-sessions`)

**Seven session types:** Theory · Practical · Drill · Firing · Field ·
Map Reading · First Aid

Records subject, topic and instructor, with search and type filters — the
day-to-day record of what was actually taught, as opposed to what was
scheduled.

---

## 11. Syllabus Tracking (`/syllabus-tracking`)

**Collection:** `trainingSyllabus`

Topics per batch with a three-state status: **Not Started · In Progress ·
Completed**, over a defined subject list.

> ⚠️ **The most basic of the ten** (32-line API). It is a topic checklist.
> **Do not promise an automatic syllabus-completion percentage** driven by
> the training schedule — status is set manually.

---

## 12. Demo Guidance

**Add to your demo only if the audience fits:**

| Audience | Add this |
|---|---|
| Commander / welfare-minded officer | **Festival Planner** (§3) — high emotional impact |
| Senior officer, end of course | **Final Board** (§2) |
| Careful / sceptical buyer | **Mismatch Dashboard** (§4) — "system apne aap ko check karta hai" |
| Ustad / training staff | **Period Attendance** (§5) — point at Body Pair |
| Administrative buyer | **Clearance** (§9) and **Joining Workflow** (§7) |

**Do not add all ten.** The main demo (`02-SLIDES.md`) is already full.
Treat these as answers to *"aur kya hai?"*, not as core content.

---

## 13. ⚠️ Do NOT Promise

- ❌ **"Configurable pass/fail thresholds"** on the Final Board — grade
  bands and the Unfit/Conditional rules are hard-coded.
- ❌ **"Certificate or mark-sheet generation"** from the Final Board.
- ❌ **"Automatic syllabus completion %"** driven by the timetable (§11).
- ❌ **"Period attendance auto-fills from the training schedule"** — not
  verified.
- ❌ **"The Festival Planner orders rations / books leave / sends
  greetings."** It plans; humans act. Festival dates for lunar festivals are
  **tentative by the calendar's own admission**.
- ❌ **"The Mismatch Dashboard fixes issues automatically."** It reports and
  suggests. All fixes are manual.
- ❌ **"Clearance blocks a trainee's departure until all ten departments
  clear."** No enforcement gate was traced — it is a register, not a lock.
- ❌ **"Joining workflow sends call letters."** Stage tracking only.
