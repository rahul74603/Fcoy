# Module — Personnel & Trainee Life

**Priority: P0 (trainee reporting + document cell) / P1 (medical, absence, relegation).**

**Who:** Company Commander and Clerk own these screens. Trainees have a
read/submit-only portal.

**Source files:**
- `src/features/traineeModule/api/trainee.api.ts` — the reporting engine
- `src/features/traineeModule/screens/TraineeManagementScreen.tsx` (~900 L) — clerk inbox
- `src/features/traineeModule/screens/TraineeDashboard.tsx` — trainee portal
- `src/features/students/DocumentVerificationScreen.tsx` — document cell
- `src/features/medical/MedicalRegisterScreen.tsx` (419 L) — MI room
- `src/features/dashboard/AbsentManagement.tsx` (690 L) — absent register
- `src/features/relegation/*` — relegation workflow

**Verification:** CONFIRMED for the reporting → approval → multi-register
cascade (traced line by line).

---

## 1. The Big Idea

> "Trainee ki poori zindagi ek jagah — admission, documents, bimari,
> gair-hazri, chutti, relegation. Aur sabse badi baat: trainee khud apni
> baat system me daal sakta hai."

---

# PART A — ⭐ TRAINEE REPORTING (the WOW feature)

**This is the most impressive workflow in the entire product. Demo it.**

## 2. What The Trainee Sees

The trainee portal (`/trainee-dashboard`) has 7 tabs:
**Report · Today Special · Platoon View · Updates · Notice Board · Files ·
My Info**

On the **Report** tab, the trainee picks from **13 report kinds**, split
into two groups.

### Reports about a specific trainee (6)

| Kind | Icon | Becomes | Priority |
|---|---|---|---|
| Sick Report | 🤒 | absent type `S` | high |
| Hospital | 🏥 | absent type `H` | **urgent** |
| PT Miss | 🏃 | absent type `A` | medium |
| Rest (B/C rest) | 🛌 | absent type `R` | medium |
| Leave | ✈️ | absent type `L` | medium |
| Other | 📋 | — | medium |

### General reports — no trainee needs to be selected (7)

| Kind | Icon | Priority |
|---|---|---|
| General Information | ℹ️ | low |
| Urgent Help | 🚨 | **urgent** |
| Complaint | 📣 | high |
| Mess / Food | 🍽️ | medium |
| Kit / Equipment | 🎒 | medium |
| Maintenance (barrack, water, electricity, repair) | 🔨 | medium |
| Suggestion | 💡 | low |

Each kind carries a **Hindi hint** so the trainee knows exactly what it is
for — e.g. *"Bimar hain — MI Room jayenge"*, *"Barrack / paani / bijli /
repair"*.

**Why a buyer cares:**
> "Aaj rangroot ko kuch kehna ho to ustad dhoondho, ustad clerk se kahe,
> clerk register me likhe. Beech me baat gum ho jati hai. Yahan rangroot
> khud apne phone se bhej deta hai, aur clerk ke paas turant pahunch jati
> hai — likhit, timestamp ke saath."

---

## 3. ⭐⭐ The Cascade — one Approve, five registers updated

**This is the single best demo moment in FCOY.** When the Clerk approves a
trainee's sick report, the system performs **five writes automatically**:

```
TRAINEE  →  portal  →  "Sick Report", 3 din  →  submit
     ↓
Record created: status = pending, priority = high
     ↓
CLERK: /trainee-management → Updates tab → red badge with the pending count
     ↓
CLERK: reviews and clicks APPROVE
     ↓
════════ SYSTEM DOES ALL OF THIS, AUTOMATICALLY ════════
 1. Report marked approved (who approved, exact time)
 2. ABSENT REGISTER    → new entry, type 'S', dates, day count
 3. MEDICAL REGISTER   → new MI-room entry, category "Sick Report",
                         recommended days  (medical kinds only: S/H/R/M)
 4. TRAINEE RECORD     → live attendance code = 'S', medical status set,
                         reason + from/to dates stamped on the roll
 5. NOTICE BOARD       → an entry so the platoon can see it
 6. AUDIT LOG          → a full Hindi sentence describing exactly what happened
════════════════════════════════════════════════════════
     ↓
COMMANDER DASHBOARD: trainee now appears under the SICK filter,
                     and his health score drops (−15 for not present)
```

**What to say — say it slowly:**
> "Clerk ne ek baar approve kiya. Absent register, MI room register,
> trainee ka live status, notice board, aur lekha-jokha — paanchon apne aap
> update ho gaye. Purane system me ye paanch alag register the, aur teen
> log likhte the."

**The detail that closes deals:** the audit entry is a readable Hindi
sentence, not a code. For example:
*"045 Ramesh Kumar ki 'Bukhar' report approve ki (S · 2026-09-04 se
2026-09-06, 3 din). Wajah: tez bukhar. Absent register + MI register +
notice board update hua."*

> **Say this:** *"Ye kisi programmer ke liye nahi likha. Ye us officer ke
> liye likha hai jo chhe mahine baad poochega — ye entry kyun hui thi?"*

---

## 4. The General-Report Branch (a genuinely thoughtful detail)

A general report (mess, maintenance, complaint, suggestion) has **no
trainee attached**, so creating an absence record would be wrong. The code
handles this explicitly: general reports **skip** the absent and medical
registers entirely and go **straight to the notice board** as a published
notice — plus an audit entry.

**Why this matters:**
> "System samajhta hai ki mess ki shikayat aur bimari ki report ek jaisi
> nahi hoti. Shikayat kisi ko absent nahi karti — wo seedha notice board
> par jaati hai."

---

## 5. Trainee Senior — reporting on behalf of others

A **Trainee Senior** can raise a report for any trainee in the batch. The
system records the `onBehalf` flag and the submitting user's ID.

**What to say:**
> "Agar rangroot itna bimar hai ki khud nahi bhej sakta, to senior uske
> liye bhej deta hai. Lekin record me saaf likha rehta hai — kisne bheji.
> Jawabdehi kahin nahi jaati."

---

## 6. The Clerk's Inbox (`/trainee-management`)

Five tabs:

| Tab | Contents |
|---|---|
| **Accounts** | Create and manage trainee login accounts |
| **Updates** | The report inbox — carries a **live pending-count badge** |
| **Notices** | Publish notices, target all / a platoon / named trainees |
| **Files** | Send documents to trainees or platoons |
| **Relegation** | Legacy read-only view *(see caveat below)* |

**The badge is the detail to point at:**
> "Clerk ko dhoondhna nahi padta. Tab par laal number dikhta hai — aaj
> kitni report pending hain."

Reports can be **approved** or **rejected with a written reason**. Both are
audited.

---

## 7. Notices & Files — targeted delivery

Notices support: `targetPlatoon` (all or one platoon), specific
`targetTraineeIds`, priority (`normal` / `important` / `urgent`), category,
and an active/inactive flag.

**Why a buyer cares:**
> "Notice sirf usi platoon ko dikhega jiske liye hai. Aur file sirf usi
> rangroot ko milegi jise bheji gayi hai. Sab kuch sabko dikhana zaroori
> nahi."

---

# PART B — DOCUMENT CELL (`/documents`)

## 8. Twenty Document Types, Six Categories

**P0 feature.** The system tracks **20 defined document types**, grouped:

| Category | Documents |
|---|---|
| **Identity** (5) | Aadhar (front & back), PAN, Voter ID, Domicile / Mool Niwas, Caste certificate |
| **Education** (4) | 10th marksheet, 12th marksheet, Graduation, Character certificate |
| **Medical** (3) | Medical fitness certificate, Eye test report, Blood group report |
| **Verification** (3) | Police verification, No criminal record, NOC from previous employer |
| **Photos** (2) | Passport photo, Full body standing photo |
| **Financial** (1) | Bank passbook / cancelled cheque |
| **Recruitment** (2) | BSF recruitment admit card, Appointment / offer letter |

Each type carries two flags: **required by default (yes/no)** and
**multiple files allowed (yes/no)** — Aadhar takes front and back, a PAN
card takes one.

**What to say:**
> "Bees dastavez, har ek ka apna khaana. Kaunsa zaroori hai aur kaunsa
> nahi — pehle se set hai. Clerk ko yaad rakhne ki zaroorat nahi ki kya
> maangna hai."

**And the payoff:**
> "Commander ke dashboard par 'Documents Pending' filter hai. Ek tap —
> jinke documents adhoore hain, unki list. Pehle ye list banane me aadha
> din lagta tha."

**Confirmed:** file preview inside the app (no download needed to view).

---

# PART C — MEDICAL REGISTER (`/medical-register`)

## 9. The MI Room Register

**Five medical categories:** Sick Report · Hospital Admit · B-Rest ·
C-Rest · Medical Board.
**Two statuses:** `Active` and `Fit / Discharged`.

Each record holds: date, category, diagnosis, ward number, recommended
days, remarks.

### The two-way mapping (a real engineering detail worth mentioning)

The system keeps the medical register and the attendance roll in step, in
both directions:

| Medical category | Attendance code | Medical status |
|---|---|---|
| Hospital Admit | `H` | Hospital |
| B-Rest / C-Rest | `R` | B-Rest / C-Rest |
| Medical Board | `M` | Medical Board |
| Sick Report | `S` | (sick) |

**What to say:**
> "MI room me entry hui — trainee ki hazri apne aap 'H' ho gayi. Aur agar
> absent register me 'H' likha gaya, to MI room register me bhi entry
> ban jaati hai. Dono taraf. Do register kabhi alag nahi hote."

**Also confirmed:** the screen **de-duplicates** — before creating a record
from an absence entry it checks whether a matching record already exists.
No double entries.

---

# PART D — ABSENT MANAGEMENT (`/absent-management`)

## 10. Six Absence Types, Bilingual Labels

| Code | Label (as shown) |
|---|---|
| `A` | Absent (बिना बताए) |
| `L` | Leave (छुट्टी पर) |
| `S` | Sick / MI Room (बीमार) |
| `H` | Hospitalized (अस्पताल) |
| `R` | Rest / Excused (आराम) |
| `M` | Medical Appointment |

Labels are **bilingual in the interface itself** — English plus Devanagari.
Point this out: it was built for the people who actually use it.

**Type-wise counts** are shown for each code — active and total. The screen
is the single source for "kaun aaj company me nahi hai, aur kyun".

---

# PART E — RELEGATION

## 11. Status Flow

`pending → approved → completed`, plus `cancelled`.

Relegation moves a trainee from one batch to another (typically after
injury or a failed test). Both the source and destination batch can see
the record.

> ### ⚠️ Two implementations exist — important for the demo
>
> - `src/features/relegation/*` reached via **`/relegation`** is the
>   **authoritative** one. Demo this.
> - The **Relegation tab inside `/trainee-management`** is a **legacy,
>   read-only** view. Do not click Approve/Complete there.
>
> **PARTIAL — known open issue:** the legacy view has a data-format
> mismatch on `remainingSubjects` (saved as a comma-separated string, read
> as a list) which can blank the tab. **Avoid that tab in a live demo.**

---

## 12. Demo Script (3 minutes — the strongest run in the product)

1. **Login as a trainee.** Show the 7 tabs. "Ye rangroot ka phone hai."
2. Report tab → **Sick Report** → 3 days → reason → submit.
3. **Login as Clerk.** `/trainee-management` → Updates tab already carries
   a **red badge**. "Clerk ko dhoondhna nahi pada."
4. Open the report, click **Approve**. Pause. *"Ab ek-ek karke dekhte hain
   kya hua."*
5. `/absent-management` → the entry is there, type `S`.
6. `/medical-register` → MI-room entry is there, "Sick Report".
7. `/commander` → tap the **SICK** filter → he is in the list, health score
   dropped.
8. `/audit-log` → the full Hindi sentence.
9. Land it: **"Clerk ne ek button dabaya. Paanch jagah update hui. Aur
   chhe mahine baad bhi pata chalega ki kisne, kab, kyun kiya."**

---

## 13. ⚠️ Do NOT Promise

- ❌ **"Trainee 360 profile screen."** `Trainee360Screen` (838 lines)
  exists in the codebase but is **not connected to any route**. It cannot
  be opened. Never show it in a slide.
- ❌ **"SMS/WhatsApp alert to the clerk on a new report."** In-app only.
- ❌ **"Automatic OCR / document verification."** Documents are uploaded
  and viewed by a human. There is no auto-verification.
- ❌ **"Document expiry reminders."** Not verified.
- ❌ **"Trainee can edit or withdraw a submitted report."** Not verified.
- ❌ **"Biometric or face attendance."** Does not exist.
- ❌ Do not demo the legacy relegation tab (see §11).
