# Module — Staff, Attendance, Duty & Deputation

**Priority: P0 (duty management) / P1 (staff master, attendance, deputation).**

**Who:** CC and Clerk manage. Ustad can view the staff list and the
training schedule.

**Source files:**
- `src/features/ustad/screens/DutyManagementScreen.tsx` (1,098 L)
- `src/features/ustad/screens/AttendanceScreen.tsx` (894 L)
- `src/features/ustad/screens/DeputationScreen.tsx` (768 L)
- `src/features/ustad/screens/StaffManagementScreen.tsx` (458 L)

**Verification:** CONFIRMED — the availability checker and the attendance
priority chain were both traced in full.

---

## 1. The Big Idea

> "Company me kaun hai, kaun nahi, aur kaun kaam ke liye available hai —
> system khud jaanta hai. Duty dete waqt aapko yaad rakhne ki zaroorat
> nahi."

---

# PART A — STAFF MASTER (`/staff`)

## 2. Six Staff Statuses

| Status | Icon | Meaning |
|---|---|---|
| ✅ **Active** | | On strength and available |
| 🏖️ **On Leave** | | Away on sanctioned leave |
| 🚗 **TD** | | Temporary Duty |
| 🏥 **Hospital** | | Admitted |
| 📖 **Course** | | Attending a course |
| ⭕ **Inactive** | | Off strength |

Plus two deputation states used elsewhere: **deputed out** and
**attachment**.

The screen opens with a **live count for every status** and lets you filter
by status in one tap.

**What to say:**
> "Company Commander ko subah ek hi sawaal hota hai — aaj mere paas kitne
> log hain. Yahan ek line me jawab hai: kitne active, kitne chutti par,
> kitne aspatal me, kitne course par."

---

# PART B — ⭐⭐ DUTY MANAGEMENT (`/duty-management`) — the showpiece

## 3. Three Tabs

📋 **Today's Duties** · ➕ **Assign Duty** · ⚙️ **Duty Types**

Duty types are **admin-defined**, not hard-coded. Stats across the top:
**Total Assigned · Completed · Pending · Transferred**.

---

## 4. ⭐⭐ The Availability Checker — the best "smart" feature in FCOY

**When you go to assign a duty, the system checks eight things before it
lets you pick a man.** Every staff member is shown with a live availability
badge and a plain-language reason.

### Blocked — cannot be assigned

| Badge | Reason shown |
|---|---|
| ⭕ **Inactive** | "Staff is inactive" |
| 🏥 **Hospital** | "Currently in hospital" |
| 📖 **On Course** | "Attending course" |
| 🔗 **Attachment** | "On attachment" |
| ↗️ **Deputed Out** | "Deputed to another unit" |
| 🏖️ **On Leave (CL)** | "On Casual Leave from 04/09/2026 to 08/09/2026" |

### Warning — allowed, but flagged

| Badge | Reason shown |
|---|---|
| 🎖️ **On Duty (Guard)** | "Already assigned to Guard at 06:00" |

### Clear

| Badge | |
|---|---|
| ✅ **Available** | assign freely |

**The leave check is the clever part.** It does not just look at a status
flag — it searches the actual **approved leave records** and checks whether
the date you are assigning **falls inside** an approved leave period. And
it sets the comparison time to midday specifically to avoid timezone edge
cases.

**What to say — this is a top-three demo moment:**
> "Purane system me kya hota tha? Commander duty laga deta tha, aur agle
> din pata chalta tha ki wo bandaa to chutti par hai. Phir aakhri waqt par
> kisi aur ko dhoondho.
>
> Yahan system pehle hi rok deta hai. Dekhiye — is aadmi ke saamne likha
> hai: chutti par hai, chaar September se aath September tak. Duty dene ka
> option hi nahi hai.
>
> Aur agar kisi ki pehle se duty lagi hai, to rokta nahi — chetavni deta
> hai. 'Ye pehle se guard duty par hai, subah chhe baje se.' Faisla aapka,
> lekin jaankari poori."

**Why a buyer cares:** duty clashes are the single most common daily
administrative failure in any unit. This is prevention, not a report about
it afterwards.

---

# PART C — ⭐ STAFF ATTENDANCE (`/staff-attendance`)

## 5. Two Tabs

📅 **Daily Attendance** · 📊 **Monthly Report**

## 6. ⭐ Auto-Filled Attendance — a four-level priority chain

Open the screen for any date and **the register is already filled in**. The
code follows a strict priority order:

| Priority | Condition | Auto status | Auto remark written |
|---|---|---|---|
| **1** | Approved leave covering this date | `leave` | "📋 Auto: Casual Leave (LV-2026-001)" |
| **2** | Staff status = hospital | `hospital` | "🏥 Auto: Staff in hospital" |
| **2** | Staff status = TD | `td` | "🚗 Auto: On Temporary Duty" |
| **2** | Staff status = course | `course` | "📖 Auto: On Course" |
| **2** | Staff status = attachment | `attachment` | "🔗 Auto: On Attachment" |
| **2** | Deputed out / on deputation | `td` | "🎖️ Auto: On Deputation" |
| **3** | Already marked manually | keeps the existing entry | — |
| **4** | Nothing applies | `present` | — |

**Leave always wins.** The code comment says so explicitly: *"Active Leave
(highest priority) → Always override."*

**What to say:**
> "Clerk subah attendance screen kholta hai — aur register pehle se bhara
> hua hai. Jo chutti par hai wo 'leave', jo aspatal me hai wo 'hospital',
> jo course par hai wo 'course'. Aur har entry ke saath likha hai ki system
> ne kyun bhara — chutti ka number tak.
>
> Clerk ko sirf wo badalne hain jo aaj bina bataye gayab hain. Baaki sab
> apne aap. Roz ka bees minute ka kaam do minute me."

**And the safety line:**
> "Agar clerk ne khud kuch mark kar diya hai, to system usko nahi badalta.
> Aadmi ka faisla upar rehta hai — sirf chutti ka record usse bhi upar
> hai, kyunki wo Commander ne approve kiya hai."

There is also a **"Mark All Present"** button for the common case, and
bulk saving.

---

# PART D — DEPUTATION (`/deputation`)

## 7. Four Views

| Tab | Meaning |
|---|---|
| 📋 **All Records** | Everything |
| ↙ **Incoming (Liya)** | Staff borrowed from another unit |
| ↗ **Outgoing (Diya)** | Staff sent to another unit |
| ✅ **Returned** | Completed deputations |

Each carries a live count of active records.

**Why a buyer cares:**
> "Deputation ka hisaab hamesha gadbad hota hai — kisko bheja, kisko liya,
> kaun wapas aaya. Yahan chaar list hain: liya, diya, wapas aaya, aur poora
> record. Aur jo bandaa deputation par gaya hai, use duty milna apne aap
> band ho jaata hai."

The link back to duty is the point — deputation is not a separate register
that everyone forgets. It changes availability immediately.

---

## 8. How It All Connects

```
COMMANDER approves an Ustad's 5-day leave
        ↓
staff status → 'leave'
        ↓
ATTENDANCE for those 5 days auto-marked 'leave'
   with the remark "Auto: Casual Leave (LV-2026-003)"
        ↓
DUTY MANAGEMENT now shows him as 🏖️ On Leave — CANNOT be assigned
        ↓
NOTIFICATION BELL shows "Staff Returning Soon" 3 days before he is back
        ↓
COMMANDER records his return
        ↓
status → 'active', return-day attendance → 'present'
        ↓
DUTY MANAGEMENT shows ✅ Available again
```

**Say this out loud during the demo:**
> "Ek approval. Paanch screen apne aap sahi ho gaye. Kisi ne kuch aur nahi
> likha."

---

## 9. Demo Script (2 minutes — pair it with the leave demo)

1. As Commander, approve an Ustad's leave (from the leave module demo).
2. Go to `/staff-attendance`. **Already marked "leave"** with the auto
   remark showing the leave number.
3. Go to `/staff`. His status is now **🏖️ On Leave**; the count changed.
4. Go to `/duty-management` → **Assign Duty**. Find him in the list.
   **The badge says "On Leave (CL)" with the exact dates, and he cannot be
   selected.** Pause here — this is the moment.
5. Pick someone who already has a duty. Show the **amber warning** with the
   existing duty name and time. "Rokta nahi — batata hai."
6. Land it: *"Commander ko yaad rakhne ki zaroorat nahi. System yaad rakhta
   hai."*

---

## 10. ⚠️ Do NOT Promise

- ❌ **"Automatic duty roster generation / fair rotation."** Assignment is
  manual. The system *checks* availability; it does not *choose* people.
- ❌ **"Duty swap or handover workflow."** A `transferred` status exists on
  the stats bar, but a full swap workflow is **NOT VERIFIED**.
- ❌ **"Biometric or geo-fenced attendance."** Does not exist.
- ❌ **"Attendance regularisation / approval chain."** Attendance is marked
  by CC/Clerk directly.
- ❌ **"Staff can see or mark their own attendance."** `/staff-attendance`
  is CC + Clerk only.
- ❌ **"Overtime or duty-hours accounting."** Not implemented.
- ❌ **"Deputation letters generated."** Records only, no document output.
