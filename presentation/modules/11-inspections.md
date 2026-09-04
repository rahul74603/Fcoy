# Module — Inspections, Findings & Corrective Actions

**Priority: P0 — this is the module that makes FCOY look like a serious
institutional system rather than a record-keeping app.**

**Who:** Senior Officer / Inspector owns it. CC has full authority. Clerk,
QM and Ustad can open `/so-inspections` to work on actions **assigned to
them**.

**Source files:**
- `src/features/inspection/screens/SOInspectionHub.tsx` (721 L) — **the live screen**
- `src/features/inspection/api/inspection.api.ts` (334 L) — the rules
- `src/features/inspection/types/inspection.types.ts` (128 L)

**Verification:** CONFIRMED — every status transition and authorisation
check was traced.

> ⚠️ **Note for the demo:** both `/so-dashboard` and `/so-inspections`
> render the **same** `SOInspectionHub` screen. `SODashboard.tsx` and
> `SOInspectionsScreen.tsx` also exist in the codebase but are **not
> wired to any route**. Demo the hub; ignore the other two.

---

## 1. The Big Idea

The module's own header comment states its purpose better than any pitch:

> *"SO is a SUPERVISORY/inspection role — not another Company Commander.
> Flow: Inspect → Observe → Record findings → Assign corrective action →
> Follow up → Verify closure → Report to Commander."*

**What to say:**
> "Inspection ka matlab sirf kami dhoondhna nahi hai. Kami mili — ab kisko
> theek karni hai, kab tak karni hai, ho gayi ya nahi, aur kisne check
> karke band ki. Poora chakkar system me hai. Kaagaz par ye chakkar kabhi
> poora nahi hota."

---

## 2. Eleven Inspection Types

Training · Discipline · Attendance · Accommodation · Mess ·
**Kit / Turnout** · Documentation · Welfare · Administration · Safety ·
General

These are the real areas an inspecting officer covers. Point at
**Kit / Turnout** and **Accommodation** — nobody invents those.

---

## 3. Four Severity Levels

| Severity | Colour |
|---|---|
| 🔴 **Critical** | red |
| 🟠 **Major** | orange |
| 🟡 **Minor** | yellow |
| 🔵 **Observation** | blue |

**Observation** matters: not every remark is a fault. An inspecting officer
can note something without turning it into a black mark.

> "Har baat kami nahi hoti. Kabhi officer sirf ek observation likhna chahta
> hai. System me uske liye alag jagah hai."

---

## 4. ⭐⭐ The Five-Stage Finding Lifecycle

This is the heart of the module.

| Status | Label shown | Who moves it here |
|---|---|---|
| 🔴 `open` | **Open** | created by SO/CC |
| 🟠 `in_progress` | **In Progress** | **the assigned role** acknowledges (or SO/CC) |
| 🔵 `submitted` | **Submitted for Verification** | **the assigned role** says it is done |
| 🟢 `closed` | **Closed** | **SO/CC only** — verified |
| 🟠 `rework` | **Rework Required** | **SO/CC only** — rejected, with a reason |

### The full workflow

```
SO conducts an inspection of, say, the MESS
     ↓
SO records a FINDING:
   title, description, severity = major,
   responsible area = "Mess",
   ASSIGNED TO ROLE = Quarter Master,
   DUE DATE = 12 Sep,
   CORRECTIVE ACTION = what must actually be done
     ↓  status: OPEN
QUARTER MASTER opens /so-inspections and sees it in his list
     ↓
QM clicks "Start"  →  status: IN PROGRESS
     ↓
QM does the work, then submits  →  status: SUBMITTED FOR VERIFICATION
     (system records submittedBy + submittedAt)
     ↓
SO reviews. Two possible outcomes:
     ├── Satisfied  → CLOSED  (records verifiedBy, verifiedByName,
     │                         verifiedAt, closureRemarks)
     └── Not satisfied → REWORK (a written reworkReason is REQUIRED)
                          ↓
                       back to the QM, who works and submits again
```

**What to say — deliver this slowly:**
> "Officer ne mess me kami dekhi. Usne likhi — kis darje ki hai, kisko
> theek karni hai, kab tak. Quarter Master ko apne screen par dikh gayi.
> Usne kaam kiya, submit kiya. Ab officer verify karega.
>
> Agar theek nahi hua — officer rework bhej sakta hai, **lekin wajah likhni
> padegi**. System bina wajah ke reject karne nahi deta.
>
> Aur jab band hoti hai, to record me likha rehta hai kisne band ki, kab
> ki, aur kya remark diya."

---

## 5. 🔒 Authorisation — enforced in code, with Hindi error messages

The API refuses invalid moves and says why, in Hindi:

| Attempted move | Rule | Message thrown |
|---|---|---|
| Start work | assigned role, or SO/CC | *"sirf assigned role ya SO is finding pe kaam shuru kar sakta hai."* |
| Submit action | assigned role, or SO/CC | *"sirf assigned role corrective action submit kar sakta hai."* |
| Close / verify | **SO or CC only** | *"verification/closure sirf Senior Officer / Commander kar sakta hai."* |
| Request rework | **SO or CC only** | *"rework sirf Senior Officer / Commander request kar sakta hai."* |
| Any of the above, wrong batch | must be an assigned batch | *"is batch ki finding aapko assigned nahi hai."* |

**Two structural rules on top:**
- An SO can edit or delete only findings **he created**, and only while the
  status is `open` or `rework`
- A draft inspection can only be edited by its creator

**What to say:**
> "Jo bandaa kaam karta hai wo khud apna kaam 'verified' nahi kar sakta.
> Verify sirf officer karega. Ye purana usool hai — aur yahan software me
> lagaya gaya hai, sirf bharose par nahi chhoda."

---

## 6. ⭐ Batch Assignment — an SO only sees his own batches

An SO user carries an **`assignedBatchIds`** list. Every read and every
write is filtered by it. If an SO has no batches assigned, the screen tells
him exactly what to do:

> *"Aapko koi batch assigned nahi hai. Company Commander se
> **assignedBatchIds** me batch add karwayein."*

**Why a buyer cares:**
> "Ek inspecting officer ko sirf apne batch dikhte hain. Doosre batch ka
> data usko dikhta hi nahi — na padh sakta hai, na likh sakta hai. Ye
> database ke level par lagi hai."

---

## 7. ⭐ The Compliance Score

Eight live stat cards:

| Card | Meaning |
|---|---|
| **Assigned Batches** | How many batches this SO covers |
| 🔴 **Open Findings** | Everything not yet closed |
| 🟠 **Critical Open** | Critical findings still open |
| ⏰ **Overdue Actions** | Past their due date — *"past due date"* |
| 🔵 **Verification Pending** | Submitted, waiting on the SO |
| 📅 **Total Inspections** | Inspections conducted |
| 👥 **Trainee Strength** | Company strength |
| ✅ **Compliance** | **% of findings closed** — *"findings closed"* |

**Compliance = closed findings ÷ total findings, as a percentage.** With no
findings at all it shows 100%.

**What to say — this is the closing line for senior officers:**
> "Ek number. Compliance chauhattar percent. Matlab jitni kamiyan mili
> thin, unme se chauhattar percent band ho chuki hain.
>
> Aur uske bagal me — chaar kaam apni tareekh nikal chuke hain. Kisi ne
> chhupaya nahi, system khud bata raha hai. Ye wahi number hai jo senior
> officer ko chahiye hota hai, aur jo aaj tak kisi register me nahi milta."

---

## 8. Overdue Section — the system chases, not the officer

When anything is past its due date, a dedicated **"Overdue Corrective
Actions"** section appears with an amber accent and the exact count:
*"N actions past due date"*.

> "Officer ko yaad rakhne ki zaroorat nahi ki kis kaam ki tareekh nikal
> gayi. System sabse upar laal karke dikha deta hai."

Plus a search box across **subject, inspector and finding**.

---

## 9. Assignment Targets

A finding can be assigned to any of the five real roles: **Company
Commander · Clerk · Quarter Master · Ustad · Senior Officer / Inspector**.
It also records a `responsibleArea` (Mess, Training, Documentation, etc.)
alongside the role.

**Why this matters:** the finding lands in a real person's screen, not in a
register that someone has to remember to read.

---

## 10. Demo Script (2 minutes — use this as the closer for senior officers)

1. Log in as **SO**. Open `/so-inspections`. Let the eight stat cards land.
2. Point at **Compliance %** and **Overdue Actions**. Deliver the §7 line.
3. Create an inspection — type **Mess**, today's date.
4. Add a finding: severity **Major**, assign to **Quarter Master**, due in
   3 days, write the corrective action.
5. **Log in as QM.** Open `/so-inspections`. The finding is in his list.
   "Usko dhoondhna nahi pada."
6. QM marks it **In Progress**, then **Submitted**.
7. **Back to SO.** "Verification Pending" is now 1.
8. Click **Rework** — try to submit without a reason. **It refuses.**
   Show the Hindi message. This is a strong beat.
9. Write a reason, send it back. Then submit again and **Close** it with
   closure remarks.
10. Point at **Compliance %** — it has moved.
11. Land it: *"Kami mili, kaam hua, officer ne check kiya, band hui. Aur
    poora record hai ki kisne kya kiya. Ye chakkar kaagaz par kabhi poora
    nahi hota."*

---

## 11. ⚠️ Do NOT Promise

- ❌ **"Photo evidence attached to findings."** Not verified in the finding
  structure. Do not promise inspection photographs.
- ❌ **"Automatic escalation when a finding goes overdue."** Overdue items
  are **highlighted**, not escalated to anyone automatically.
- ❌ **"Email/SMS to the assigned role."** In-app only, and inspection
  findings are **not** among the seven notification-bell sources — the
  assignee sees them on `/so-inspections`.
- ❌ **"Inspection report PDF / signed inspection note."** Not verified.
- ❌ **"Inspection checklists or templates."** Types exist; pre-built
  checklists do not.
- ❌ **"Recurring / scheduled inspections."** Not implemented.
- ❌ Do not demo `SODashboard.tsx` or `SOInspectionsScreen.tsx` — they are
  unrouted (see the note at the top).
