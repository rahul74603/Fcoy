# Workflow Catalog

> **What this file is:** the eight end-to-end journeys that show FCOY as a
> connected system rather than a collection of screens. Each is written in
> the same format:
>
> **USER → SCREEN → ACTION → SYSTEM RESPONSE → STATUS CHANGE → NEXT ROLE →
> FINAL RESULT**
>
> Every step is code-verified. The module document that proves it is cited
> under each workflow.

---

## Why Workflows Beat Feature Lists

A buyer can compare feature lists between vendors. He cannot compare
workflows, because most systems do not have any — they have screens, and a
human being carries the work between them.

**Say this early:**
> "Main aapko ek-ek screen nahi dikhaunga. Main aapko dikhaunga ki ek kaam
> shuru se aakhir tak kaise chalta hai — aur beech me kisi ko kuch yaad
> rakhne ki zaroorat nahi padti."

---

# WF-1 ⭐⭐ Trainee Falls Sick

**The flagship workflow. If you demo one thing, demo this.**
*Proof: `modules/04-personnel-trainees.md` §3*

| Stage | What happens |
|---|---|
| **USER** | Trainee (or a Trainee Senior on his behalf) |
| **SCREEN** | Trainee portal → Report tab |
| **ACTION** | Picks **🤒 Sick Report**, 3 days, writes the reason, submits |
| **SYSTEM RESPONSE** | Record created, priority **high**, marked `pending` |
| **STATUS CHANGE** | `pending` |
| **NEXT ROLE** | **Clerk** — `/trainee-management` → Updates tab shows a **red pending badge** |
| **ACTION** | Clerk reviews and clicks **Approve** |
| **SYSTEM RESPONSE** | Five automatic writes: absent register (`S`, dates, day count) · medical register (MI room, "Sick Report") · trainee live status (`attn = S`, medical status, reason, from/to) · notice board entry · audit log sentence |
| **STATUS CHANGE** | `pending → approved` |
| **NEXT ROLE** | **Commander** — the trainee appears under the **SICK** filter; his health score drops 15 points |
| **FINAL RESULT** | Five registers correct, one click, full audit trail |

**Alternative path:** Clerk rejects with a written reason → `rejected`,
audited, no registers touched.

**Say:**
> "Clerk ne ek button dabaya. Paanch register apne aap bhar gaye."

---

# WF-2 ⭐ Ustad Applies For Leave

*Proof: `modules/03-leave-management.md` §2–§3, `modules/10-staff-duty.md` §8*

| Stage | What happens |
|---|---|
| **USER** | Ustad |
| **SCREEN** | `/staff-leave` → Apply Leave |
| **ACTION** | Selects leave type, dates, reason, leave address, contact |
| **SYSTEM RESPONSE** | Auto leave number **LV-2026-001**, activity log entry |
| **STATUS CHANGE** | `pending` |
| **NEXT ROLE** | **Commander** — the bell shows **"Leave Approval Required"** (high priority) and deep-links to that exact leave |
| **ACTION** | Commander clicks **Approve** *(Clerk sees the leave but has no Approve button — triple-guarded)* |
| **SYSTEM RESPONSE** | Status + approver recorded · staff status → `leave` · **attendance auto-marked `leave` for every day in the range**, each with the reason and leave number · audit entry |
| **STATUS CHANGE** | `pending → approved` |
| **KNOCK-ON** | `/duty-management` now shows him **🏖️ On Leave (CL)** with dates — **cannot be assigned** |
| **NEXT ROLE** | Bell shows **"Staff Returning Soon"** 3 days before return |
| **ACTION** | Commander records the return: actual date, joining report yes/no, delay reason |
| **SYSTEM RESPONSE** | Staff status → `active` · return day marked `present` · audit entry |
| **FINAL RESULT** | Back on strength, attendance complete, duty availability restored, full trail |

**Say:**
> "Ek approval. Paanch screen apne aap sahi ho gaye."

---

# WF-3 ⭐ Kit Issue

*Proof: `modules/06-quartermaster-inventory.md` §7–§9*

| Stage | What happens |
|---|---|
| **USER** | Quarter Master |
| **SCREEN** | `/issue-kit` |
| **ACTION** | Searches by **chest number** → trainee card shows what he already has |
| **ACTION** | Adds items to the cart — item + **size** + quantity |
| **SYSTEM RESPONSE** | Cart shows RECEIVED / IN CART / PENDING per item |
| **ACTION** | Clicks Issue |
| **SYSTEM RESPONSE** | **One atomic transaction**: stock verified and decremented (size-wise) · issue ledger written with chest no, platoon, units, value, issuer, timestamp · trainee record updated. All-or-nothing. |
| **FAILURE PATH** | Insufficient stock → clear **`INSUFFICIENT STOCK`** message, **nothing is written** |
| **STATUS CHANGE** | Item moves PENDING → RECEIVED |
| **NEXT ROLE** | **Commander** — kit % and health score improve |
| **FINAL RESULT** | Stock, ledger and trainee record can never disagree |
| **DELIBERATELY NOT AUTOMATIC** | **No recovery is created.** The screen says so. Recovery is raised manually when it is genuinely due. |

---

# WF-4 ⭐⭐ Inspection Finding → Closure

**The closer for a senior officer.**
*Proof: `modules/11-inspections.md` §4–§5*

| Stage | What happens |
|---|---|
| **USER** | Senior Officer / Inspector |
| **SCREEN** | `/so-inspections` |
| **ACTION** | Creates an inspection (type **Mess**, today's date) |
| **ACTION** | Records a finding: severity **Major**, responsible area, **assigned to Quarter Master**, **due date**, corrective action |
| **STATUS CHANGE** | `open` |
| **NEXT ROLE** | **Quarter Master** — sees it in his own list on `/so-inspections` |
| **ACTION** | QM marks **Start** |
| **STATUS CHANGE** | `open → in_progress` |
| **ACTION** | QM does the work and **Submits** |
| **SYSTEM RESPONSE** | Records `submittedBy` and `submittedAt` |
| **STATUS CHANGE** | `in_progress → submitted` |
| **NEXT ROLE** | **SO** — "Verification Pending" count rises |
| **ACTION A** | **Verified** → `closed`, recording verifier name, time and closure remarks |
| **ACTION B** | **Rework** → `rework`, **a written reason is mandatory** — the system refuses without it |
| **LOOP** | Rework returns to the QM, who works and submits again |
| **FINAL RESULT** | **Compliance %** updates. Overdue items surface automatically at the top. |

**The rule to state out loud:**
> "Jo bandaa kaam karta hai wo khud apna kaam verified nahi kar sakta."

---

# WF-5 Money Goes Out

*Proof: `modules/07-finance-funds.md` §3, §6–§7*

| Stage | What happens |
|---|---|
| **USER** | Quarter Master |
| **SCREEN** | `/training-fund` (or any of the four funds) |
| **ACTION** | Records an expense — item, amount, vendor, **bill status**, bill upload |
| **SYSTEM RESPONSE** | Bill image compressed and stored · if against a vendor, only the **paid amount** counts as *Actually Paid*; the remainder becomes **Vendor Due** |
| **STATUS CHANGE** | Bill: `Pending → Received → Verified` (or explicitly `No Bill`) |
| **NEXT SCREEN** | `/funds` — Grand Collection, Total Orders, Actually Paid, Net Balance, Vendor Dues and Pending Bills all move |
| **NEXT ROLE** | **Commander** sees the same four fund figures on his dashboard |
| **ACTION** | Later, a **partial or full payment** is recorded on `/vendor-payments` |
| **STATUS CHANGE** | `Pending → Partial → Paid` |
| **FINAL RESULT** | Order, payment and outstanding are three separate, honest numbers — and a bill is attached |

---

# WF-6 Duty Assignment

*Proof: `modules/10-staff-duty.md` §4*

| Stage | What happens |
|---|---|
| **USER** | Commander or Clerk |
| **SCREEN** | `/duty-management` → Assign Duty |
| **SYSTEM RESPONSE** | **Before you choose anyone**, every staff member is checked against eight conditions and labelled |
| **BLOCKED** | Inactive · Hospital · On Course · Attachment · Deputed Out · **On Leave (with exact dates from the approved leave record)** |
| **WARNED** | Already on duty — shows the existing duty name and time, assignment still allowed |
| **CLEAR** | ✅ Available |
| **ACTION** | Assigns a duty type (admin-defined) |
| **NEXT ROLE** | Bell shows **"N Duties Today"**, deep-linking to `/duty-management` |
| **FINAL RESULT** | Clash prevented before it happens, not discovered the next morning |

---

# WF-7 FPT Test Day

*Proof: `modules/09-training-delivery.md` §3, §5*

| Stage | What happens |
|---|---|
| **USER** | Clerk or Commander |
| **SCREEN** | `/test-records` |
| **ACTION** | Creates an **FPT** test — the seven events arrive pre-filled (1.6 km run 20/10, long jump 15/8, and so on) |
| **ACTION** | Enters marks **per event, per trainee** |
| **SYSTEM RESPONSE** | Per-event PASS/FAIL · overall result · running grade for the 1.6 km run · batch-wide grade distribution |
| **STATUS CHANGE** | Test `scheduled → in_progress → completed` |
| **SYSTEM RESPONSE** | Results grouped **Failed → Absent → Passed**, plus a **Top Failers** list |
| **NEXT ROLE** | **Commander** — failures appear in the **FPT FAIL** alert stream and roster filter; each failure costs the trainee 20 health points |
| **FINAL RESULT** | Not just "he failed FPT" — *which event* he failed, so the Ustad knows what to work on |

---

# WF-8 A New Company Goes Live

*Proof: `modules/14-company-master.md`*

| Stage | What happens |
|---|---|
| **USER** | Implementer |
| **SCREEN** | `/first-run` — unguarded by design, because no user exists yet |
| **ACTION** | Initial company setup |
| **NEXT** | Commander account created |
| **SCREEN** | `/users` — Commander creates Clerk, QM, Ustad and SO accounts |
| **DETAIL** | Choosing **Senior Officer / Inspector** reveals the **batch assignment** field — that list controls everything the SO can see |
| **SCREEN** | `/batches` — the batch is created; **every module is scoped to it** |
| **SYSTEM RESPONSE** | Inventory, finance and inspections all isolate by batch. Two batches never mix. |
| **SUBSCRIPTION** | **Company-level only, and OFF by default** — no banner, no gate, no lock inside the company app |
| **FINAL RESULT** | A live company where each role sees exactly its own work |

---

## Workflow Selection Guide

| Time | Run these |
|---|---|
| **5 minutes** | WF-1 only. It is the whole product in miniature. |
| **20 minutes** | WF-1 → WF-2 → WF-3 → WF-4 |
| **45 minutes** | All eight, in the order above |
| **Senior officer** | WF-4 → WF-1 → WF-5 |
| **Quarter Master** | WF-3 → WF-5 |
| **Clerk** | WF-1 → WF-2 |

---

## The Two Sentences That Tie It Together

Use these to close any workflow demo:

> "Dhyan dijiye — beech me kisi ne kuch yaad nahi rakha. Ek aadmi ne apna
> kaam kiya, aur agle aadmi ke screen par kaam apne aap pahunch gaya."

> "Aur har kadam par record hai — kisne kiya, kab kiya, kyun kiya."

---

## ⚠️ Workflow Demo Discipline

- **Set up your data first.** A workflow demo on empty data is worse than
  no demo. See `01-PRESENTATION-ROADMAP.md` for prerequisites.
- **Use multiple logins.** The role switch *is* the demonstration. WF-1 and
  WF-2 lose most of their power from a single account.
- **Do not narrate the software. Narrate the person.** *"Ab clerk apne
  screen par..."* — not *"ab hum trainee management screen kholte hain"*.
- **Pause after the automatic step.** Let them notice the five registers
  before you explain them.
- **Never invent a step the system does not perform.** If a workflow needs
  a human to carry something between screens, say so — that honesty is what
  makes the automatic steps believable.
