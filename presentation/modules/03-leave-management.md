# Module — Leave Management (Chhutti Prabandhan)

**Priority: P0 — the single strongest workflow story in the product.**

**Source files:**
- `src/features/ustad/hooks/useLeave.ts` (561 lines) — the logic
- `src/features/ustad/api/leave.api.ts` (386 lines)
- `src/features/ustad/screens/LeaveManagementScreen.tsx` (1,550 lines) — **staff leave**
- `src/features/leaveMgmt/*` (416 lines) — **trainee leave**

**Verification:** CONFIRMED (approval chain traced end-to-end, including
the automatic side-effects).

---

## ⚠️ Read This First — There Are TWO Leave Systems

This is the most important thing to understand before you demo. FCOY has
**two separate leave modules** for two different populations. They do not
share a database collection.

| | **Staff Leave** | **Trainee Leave** |
|---|---|---|
| Route | `/staff-leave` | `/leave-management` |
| For | Ustads, clerks, permanent staff | Rangroots / trainees under training |
| Collections | `staff_leave`, `leave_types` | `leaveApplications` |
| Who can open | CC, Clerk, Ustad (view) | CC, Clerk |
| Statuses | `pending → approved / rejected / cancelled` | `Applied → Recommended → Sanctioned → Departed → On Leave → Returned` (+ `Rejected`, `Overstay`, `Cancelled`) |
| Leave types | **Admin-defined, dynamic** | **Fixed list of 6 in code** |
| Approval automation | **Deep** — status, attendance, audit | **Light** — syncs to absent register |
| Maturity | Fully built | Simpler, register-style |

**What to say if a buyer notices:**
> "Staff aur trainee ki chhutti alag-alag chalti hai — kyunki niyam bhi
> alag hain. Staff ka leave balance aur attendance se juda hai; trainee ka
> absent register aur nominal roll se."

**Demo advice:** demo the **staff leave** flow (`/staff-leave`). It is the
richer story. Mention trainee leave exists; open it only if asked.

---

# PART A — STAFF LEAVE (`/staff-leave`) — the flagship flow

## 1. What The Screen Looks Like

**Four stat cards across the top:**

| Card | Meaning |
|---|---|
| 🏖️ **On Leave Now** | Staff currently away |
| ⏳ **Pending Approval** | Waiting on the Commander |
| 🔔 **Returning Soon** | Coming back within 3 days |
| 📅 **This Month** | Total leaves this month |

**Four tabs:**
`📋 All Leaves` · `⏳ Pending Approval` · `🏖️ Currently On Leave` ·
`⚙️ Leave Types`

> The **Leave Types** tab is hidden entirely unless the user is CC or Clerk
> — it is not just disabled, it is not rendered.

---

## 2. The Full Workflow

```
USTAD/CLERK  →  /staff-leave  →  "Apply Leave"
     ↓
SYSTEM: generates leave number LV-2026-001, status = pending
     ↓
SYSTEM: writes an activity log entry ("Leave Applied")
     ↓
COMMANDER: notification bell shows "Leave Approval Required"
           (high priority, deep-links straight to the pending tab)
     ↓
COMMANDER: opens /staff-leave → Pending tab → Approve
     ↓
SYSTEM DOES FOUR THINGS AUTOMATICALLY:
     1. status → approved, records approver name + date
     2. staff status → 'leave' (if the leave has already started)
     3. attendance marked 'leave' for EVERY DAY from-date to to-date
     4. audit log entry written
     ↓
STAFF is now visibly "on leave" everywhere in the system
     ↓
RETURN DAY → COMMANDER: "Record Return"
     ↓
SYSTEM AGAIN, AUTOMATICALLY:
     1. records actual return date, joining report, delay reason
     2. staff status → 'active'
     3. attendance for the return day marked 'present'
     4. audit log entry written
     ↓
FINAL RESULT: staff back on strength, complete paper trail, zero manual entry
```

---

## 3. ⭐ The WOW Moment — auto-attendance

**This is the line that sells the module.**

When the Commander approves a 10-day leave, the system loops day by day
from the start date to the end date and **marks attendance as "leave" for
each of those ten days automatically**. On return, the return day is marked
"present" automatically.

**What to say:**
> "Ek click. Commander ne approve kiya — aur dus din ki attendance apne
> aap 'leave' mark ho gayi. Staff ka status bhi badal gaya. Register me
> alag se kuch likhne ki zaroorat nahi. Wapas aane par ek click, aur wo
> phir se 'present' aur 'active' ho gaya."

**Why a buyer cares:** this is where manual registers always break. Someone
approves the leave but forgets the attendance sheet, and at month-end the
numbers do not tally. Here they cannot disagree — one action writes both.

**A quality detail worth pointing out:** the code uses a **local business
date**, with an explicit comment that using UTC would shift the date to
"yesterday" in Indian time. Someone thought carefully about IST.

---

## 4. 🔒 The Security Story — triple-guarded approval

**Only the Company Commander can approve, reject, or record a return.**
This is enforced at three independent levels:

1. **UI** — the buttons are not rendered for other roles
2. **Handler guard** — `useLeave.ts` throws before touching the database:
   *"Authorization: sirf Company Commander hi leave approve kar sakte hain."*
3. **Firestore rules** — the fields `status`, `approvedBy`,
   `approvedByName`, `approvalDate` and `rejectionReason` are protected at
   the database level

**Demo move (very effective):** log in as Clerk, open `/staff-leave`, show
the pending leave — **no Approve button**. Then log in as Commander, same
screen, button is there.

**What to say:**
> "Clerk chutti dekh sakta hai, lekin approve nahi kar sakta. Aur ye sirf
> button chhupane ki baat nahi — agar koi database ko seedha request bhi
> bheje, rules mana kar denge. Chutti ka adhikar sirf Commander ke paas
> hai, aur system me likha hua hai."

---

## 5. Configurable Leave Types (P1)

Unlike trainee leave, **staff leave types are created by the admin**, not
hard-coded. Each type has:

- Name (e.g. "Casual Leave") and code (e.g. "CL")
- Max days per year
- Paid / unpaid flag
- Active / inactive toggle
- Description

Types can be **deactivated rather than deleted**, so historic leaves keep
their labels.

**Why a buyer cares:**
> "Har unit ke leave rules thode alag hote hain. Yahan aap apne leave types
> khud bana sakte ho — naam, code, saal me kitne din, paid hai ya nahi.
> Aur purana type band karna ho to delete mat karo, sirf inactive kar do —
> purane record surakshit rehte hain."

**Who can do it:** CC and Clerk only (`canManageLeaveTypes`).

---

## 6. Return Recording — the honesty features

When recording a return, the Commander enters:

| Field | Why it matters |
|---|---|
| **Actual return date** | Compared against the expected date |
| **Joining report submitted?** | Yes/no checkbox — a real administrative requirement |
| **Delay reason** | Filled in when the return was late |

**What to say:**
> "Sirf 'wapas aa gaya' likhna kaafi nahi hota. System poochta hai —
> joining report di ya nahi, aur agar der se aaya to kyun. Ye wahi sawaal
> hain jo register me poochne padte hain, bas ab chhoot nahi sakte."

---

## 7. Other Confirmed Capabilities

| Capability | Verified |
|---|---|
| Auto leave number `LV-{year}-{serial}` | ✅ |
| Reject with a mandatory reason | ✅ (CC only) |
| Cancel an application | ✅ |
| Filter: all / pending / current | ✅ |
| Batch-scoped leave list | ✅ |
| "Returning Soon" = next 3 days | ✅ |
| Every action written to the activity log | ✅ |
| Leave address + contact number captured | ✅ |
| Denormalised name, rank, force number on the record | ✅ (list loads fast) |

---

## 8. ⚠️ Do NOT Promise

- ❌ **"Automatic leave balance deduction."** A `LeaveBalance` type exists
  with `entitled / taken / pending / balance`, but **no calculation was
  found** wiring it up. `maxDaysPerYear` is stored on the leave type but is
  not enforced as a running balance. **NOT VERIFIED — do not demo a balance.**
- ❌ **"Email or SMS to the applicant on approval."** Notification is
  in-app only, and it is the *Commander* who is notified of pending leave —
  not the applicant on approval.
- ❌ **"Multi-level approval chain."** Staff leave is single-step:
  pending → approved by CC. (Trainee leave has a `Recommended` status, but
  it is a label, not an enforced routing step.)
- ❌ **"Overstay auto-detection for staff."** Overstay is a **trainee**
  leave status. Staff leave records a *delay reason* manually.
- ❌ **"Leave calendar / roster planning view."** Not verified.

---

# PART B — TRAINEE LEAVE (`/leave-management`)

## 9. What It Is

A register-style screen — **✈️ Chhutti Prabandhan** — for rangroot leave.

**Five stat cards:** 📋 Total · ⏳ Pending · ✈️ On Leave · 🚨 **Overstay** ·
✅ Returned

**Six leave types, fixed in code, with Hindi labels:**

| Type | Label | Max days |
|---|---|---|
| Casual | Samanya Chhutti | 30 |
| Medical | Chikitsa Chhutti | 90 |
| Emergency | Aapatkalin | 10 |
| Special | Vishesh | 15 |
| Earned | Arjit | 30 |
| Maternity | Maternity | 180 |

**Nine-stage status ladder:** Applied → Recommended → Sanctioned →
Departed → On Leave → Returned, plus Rejected / Overstay / Cancelled.

---

## 10. The One Automation Worth Showing

When a trainee leave is saved as **Sanctioned** or **On Leave**, the system
automatically creates a matching entry in the **absent register** with
type `L`, linked back to the leave application.

**Why this matters:**
> "Trainee ki chutti sanction hui — wo turant absent register me 'L' ke
> saath aa gaya. Commander ke dashboard par bhi LEAVE filter me dikhega.
> Do jagah likhne ki zaroorat nahi."

**Also captured:** departure date, expected return, **actual return**, and
**overstay days** — the numbers a unit actually needs.

---

## 11. Trainee Leave — Do NOT Promise

- ❌ Trainees cannot apply for leave themselves from their portal in this
  screen's flow — the clerk records it. *(A trainee can raise a `leave`
  **report** from the portal, which is a different, lighter path — see the
  personnel module.)*
- ❌ **Overstay days are a stored field, not a proven auto-calculating
  alarm.** Show the field; do not claim the system chases overstays.
- ❌ No enforcement of the `maxDays` limits — they are display metadata.

---

## 12. Demo Script (2 minutes)

1. **Login as Ustad.** `/staff-leave` → Apply Leave → fill 5 days casual →
   submit. Point at the auto leave number.
2. **Login as Clerk.** Same screen, same leave visible — *no Approve
   button.* Pause here. This lands the security point.
3. **Login as Commander.** Bell already shows "Leave Approval Required".
   Click it — it deep-links to the pending tab.
4. Approve. Say: *"Ab dekho kya-kya apne aap hua."*
5. Open `/staff-attendance` — **all five days already marked "leave"**.
6. Open `/staff` — that person's status is now "leave".
7. Open `/audit-log` — the approval is recorded with name and time.
8. Close with: *"Ek click, chaar jagah update. Aur poora record ki kisne
   kiya."*

---

## 13. Objection Handling

| They say | You say |
|---|---|
| "Balance track hota hai?" | Be honest: leave types carry a yearly limit, and every leave is on record — but an automatic running balance is not live today. Do not fake it. |
| "Approval me do level chahiye" | Today it is single-step, CC only. Note it as a requirement; do not claim it works. |
| "Staff ko pata kaise chalega?" | The record updates instantly and the leave shows in their list. Do not promise SMS. |
| "Agar galti se approve ho gaya?" | Cancel exists, and every action is in the audit log with the name of who did it. |
| "Attendance manually change kar sakte hain?" | Yes — `/staff-attendance` is CC + Clerk. Auto-marking is a starting point, not a lock. |
