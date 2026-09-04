# Module — Notifications (the Bell)

**Priority: P1 — small screen area, disproportionately large demo impact.**

**Who:** everyone who logs in sees the bell in the top bar. What appears
inside it depends on their data and role.

**Source files:**
- `src/features/notifications/useNotifications.ts` (302 lines) — the engine
- `src/features/notifications/NotificationBell.tsx` (218 lines) — the UI
- `src/features/notifications/notification.types.ts` (49 lines)

**Verification:** CONFIRMED (all seven sources traced to live queries).

---

## 1. The Big Idea — and the honest architecture

> "Bell ek to-do list hai, inbox nahi."

FCOY's notifications are **derived live from the actual data**, not stored
as messages in a table. Every two minutes the app asks the database seven
questions — *is any leave pending? is anyone returning soon? are there
duties today?* — and builds the list fresh from the answers.

**Why this is a strength, and how to say it:**
> "Ye purane message nahi hain jo pade rehte hain. Har baar system asli
> data se khud banata hai. Matlab notification kabhi jhooth nahi bolti —
> agar chutti approve ho gayi, wo notification apne aap gayab ho jaati hai.
> Koi 'clear' karne ki zaroorat nahi."

**The trade-off, stated honestly:** because nothing is stored, there is no
notification *history*. The bell shows what needs doing **now**.

---

## 2. The Seven Live Sources

| # | Notification | Priority | Trigger | Tapping it opens |
|---|---|---|---|---|
| 1 | 🏖️ **Leave Approval Required** | **high** | A staff leave is pending | `/staff-leave` — pending tab, that exact leave |
| 2 | 🔔 **Staff Returning Soon** | high if ≤1 day, else medium | Approved leave ends within 3 days | `/staff-leave` |
| 3 | 🎖️ **N Duties Today** | medium | Duties assigned for today | `/duty-management` |
| 4 | 🏥 **Staff in Hospital** | **high** | Any staff currently in hospital | `/staff` |
| 5 | 📅 **N Classes Today** | medium | Training classes scheduled today | `/training-schedule` |
| 6 | 🔄 **Active Deputations** | low | Deputation records currently active | `/deputation` |
| 7 | 🤒 **N Trainee Reports Pending** | **high** | Unapproved trainee reports | `/clerk` |

Each message is written in plain language with the real numbers in it —
for example *"HC Ramesh Kumar applied for 5 days Casual Leave"*, or
*"3 Trainee Reports Pending — Bimari / PT miss — Clerk dashboard se check
karke approve karo"*.

**What to say:**
> "Notification me sirf 'kuch hua hai' nahi likha. Naam likha hai, kitne
> din likhe hain, aur kya karna hai wo bhi likha hai."

---

## 3. ⭐ Deep Linking — the detail people notice

Every notification carries a link, and tapping it takes you **exactly**
where the work is. The pending-leave notification does not just open the
leave screen — it opens the **pending tab** with **that leave** selected.

**Demo move:** as Commander, click the leave notification and land straight
on the Approve button. Say:
> "Ek tap se seedha kaam par. Menu me dhoondhna nahi pada."

---

## 4. Smart Sorting

The list is sorted by **priority first (high → medium → low)**, then by
time.

**Why a buyer cares:**
> "Aspatal me bharti staff aur ek suggestion — dono ek jaise nahi ho sakte.
> Zaroori cheez hamesha upar rehti hai."

---

## 5. Automatic Refresh

The bell refreshes itself **every 2 minutes**, and there is a manual
refresh button inside the panel.

**What to say:**
> "Page reload karne ki zaroorat nahi. Har do minute me apne aap taaza ho
> jaata hai."

---

## 6. The Bell UI

| Element | Behaviour |
|---|---|
| Bell icon | Turns **red** when there is anything unread |
| Badge | Shows the unread count; caps at **99+** |
| Panel header | "N new" |
| **Mark all read** | Appears only when something is unread |
| **Clear all** | Clears the current list |
| Refresh | Manual re-check |
| Per-item click | Marks that item read **and** navigates to its link |
| Empty state | A clean "nothing pending" panel |

Each type has its own icon and colour — hospital is red, duty is purple,
leave is yellow. **12 notification types** are defined with distinct
styling.

---

## 7. ⚠️ Read-State Is Per Device — say this plainly

Read/unread state is stored in the **browser's local storage**
(`bsf_read_notifications`), not in the database.

**What this means:** if the Commander marks notifications read on his
laptop, they will still show unread on his phone.

**How to present it honestly if asked:**
> "Padhne ka nishaan abhi us device par rehta hai jahan aapne padha. Phone
> aur laptop ke beech sync nahi hota. Isse kaam par asar nahi padta —
> notification khud to asli data se banti hai — lekin ye ek chhoti si baat
> hai jo agle version me theek hogi."

Do not hide this. If a buyer discovers it during a pilot, honesty now costs
nothing and lying costs the deal.

---

## 8. Where This Fits In The Workflow

```
USTAD applies for leave
     ↓
Record written to the database
     ↓
Within 2 minutes (or on next login) the COMMANDER'S BELL
recalculates and shows "Leave Approval Required" — high priority, top of list
     ↓
COMMANDER taps → lands directly on that pending leave
     ↓
Approves
     ↓
Next refresh: the notification is GONE — because the underlying
condition no longer exists. Nobody dismissed it.
```

**That last step is the whole pitch.** Say it out loud during the demo.

---

## 9. Demo Script (45 seconds)

1. As Commander, point at the **red badge**. "Aaj itne kaam pending hain."
2. Open the panel. "Sabse upar zaroori cheez — dekhiye, aspatal aur chutti
   sabse upar hain, suggestion neeche."
3. Tap the leave notification → **lands on the Approve button**. "Seedha
   kaam par."
4. Approve.
5. Hit refresh in the bell. **The notification is gone.**
6. Land it: *"Maine use hataya nahi. Kaam khatam hua, isliye wo khud chala
   gaya. Ye list kabhi purani nahi hoti."*

---

## 10. ⚠️ Do NOT Promise

- ❌ **"Push notifications on the phone."** There is no verified push
  delivery. A `fcm.service.ts` file exists in the codebase but is **not
  imported anywhere** — it is dead code. Never demo or promise mobile push.
- ❌ **"Email or SMS alerts."** Not implemented.
- ❌ **"Notification history / archive."** Nothing is stored, so there is
  no history to show.
- ❌ **"Per-user notification preferences."** No settings screen for this.
- ❌ **"Real-time / instant notification."** It refreshes on a 2-minute
  cycle. Say "within two minutes", not "instantly".
- ❌ **"Notifications sync across devices."** Read-state does not (§7).

---

## 11. Objection Handling

| They say | You say |
|---|---|
| "Phone par alert aayega?" | Honest: "Abhi app ke andar. Phone par push agle version me." Never fake it. |
| "Purani notifications kahan dekhein?" | "Notification list nahi, to-do list hai. Purana record dekhna ho to Lekha-Jokha Register (`/audit-log`) me sab kuch hai." — this is a **strong** redirect, use it. |
| "Kya main apni notifications choose kar sakta hoon?" | Not today. They are driven by role and data. |
| "Kitni der me aayegi?" | "Do minute ke andar, ya login karte hi." |
