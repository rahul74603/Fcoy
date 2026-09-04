# WOW Features — The Ranked Highlight Reel

> **What this file is:** the ten moments in FCOY that make a buyer sit up.
> Every one is **code-verified** and cross-referenced to the module document
> that proves it.
>
> **How to use it:** if you have only five minutes, show WOW #1, #2 and #3.
> If you have twenty, show the top six. Never try to show all ten — the
> effect flattens.

---

## The Ranking Rule

These are ranked by **how visibly they solve a problem the buyer already
has**, not by technical difficulty. The atomic stock transaction is the
hardest thing in the codebase and it sits at #4, because a Commander feels
the trainee-report cascade more immediately than he feels a database
guarantee.

---

## 🥇 WOW #1 — One Approval, Five Registers

**Where:** Clerk approves a trainee report → `/trainee-management`
**Proof:** `modules/04-personnel-trainees.md` §3

A trainee submits a sick report from his phone. The clerk clicks **Approve
once**, and the system writes to **five places automatically**:

1. Absent register (with the correct code, dates and day count)
2. Medical register / MI room (for medical kinds only)
3. The trainee's live status on the nominal roll
4. The notice board
5. The Lekha-Jokha audit register

**The line:**
> "Clerk ne ek button dabaya. Paanch register apne aap bhar gaye. Purane
> system me ye paanch alag register the aur teen log likhte the."

**Why it wins:** it is visible, it takes fifteen seconds to demo, and every
single person in the room has personally suffered the problem it solves.

---

## 🥈 WOW #2 — The Duty Availability Checker

**Where:** `/duty-management` → Assign Duty
**Proof:** `modules/10-staff-duty.md` §4

Before you can assign a duty, the system checks **eight conditions** and
tells you, per person, in plain language, whether they can be assigned.
Someone on approved leave shows **"On Leave (CL) — from 04/09/2026 to
08/09/2026"** and simply cannot be selected. Someone already on duty shows
an **amber warning with the existing duty name and time** — allowed, but
flagged.

**The line:**
> "Purane system me duty laga dete the, aur agle din pata chalta tha ki wo
> bandaa to chutti par hai. Yahan system pehle hi rok deta hai. Aur jahan
> rokna nahi chahiye, wahan sirf chetavni deta hai — faisla aapka."

**Why it wins:** prevention, not a report about the failure afterwards.

---

## 🥉 WOW #3 — Auto-Attendance on Leave Approval

**Where:** Commander approves leave → `/staff-attendance`
**Proof:** `modules/03-leave-management.md` §3, `modules/10-staff-duty.md` §6

Approve a ten-day leave and the system marks attendance **for each of those
ten days**, automatically, with a written reason on every entry
(*"📋 Auto: Casual Leave (LV-2026-001)"*). On return, the return day is
marked present and the man goes back to active.

Open the attendance screen on any date and it is **already filled in**,
following a four-level priority chain — leave beats status, status beats
default, and a manual entry is never silently overwritten.

**The line:**
> "Clerk subah attendance screen kholta hai — register pehle se bhara hua
> hai, aur har entry me wajah likhi hai. Usko sirf wo badalne hain jo aaj
> bina bataye gayab hain. Bees minute ka kaam do minute me."

---

## 4️⃣ WOW #4 — Stock That Cannot Go Wrong

**Where:** `/issue-kit`
**Proof:** `modules/06-quartermaster-inventory.md` §8

Kit issue runs inside a single atomic transaction: stock counters, the
issue ledger and the trainee's record either **all** commit or **none** do.
Two QMs issuing the last pair of shoes at the same moment cannot both
succeed — one gets a clear `INSUFFICIENT STOCK` message.

**The line:**
> "Stock kabhi minus me nahi ja sakta. Aur agar beech me internet chala
> jaaye, to ya teenon cheezein hoti hain ya ek bhi nahi. Aadha-adhoora
> record kabhi nahi banega. Ye guarantee code me likhi hui hai."

**Use this only with technical buyers or an auditing officer.** With others
it lands flat.

---

## 5️⃣ WOW #5 — Order vs Actually Paid

**Where:** `/funds`
**Proof:** `modules/07-finance-funds.md` §3

Three separate numbers where most systems keep one: **Total Orders**
(*saman ka total*), **Actually Paid** (*paisa gaya*), and **Vendor Dues**
(*vendor ko dena*). The balance formula is printed on the screen itself.

**The line:**
> "Do lakh ka saaman order hua, lekin vendor ko sirf sattar hazaar diye.
> Purane register me dono ek jaise likhe jaate the — aur mahine ke aakhir
> me paisa kam pad jaata tha. Yahan teen alag sach, teen alag number. Aur
> formula screen par likha hai — kuch chhupa nahi hai."

---

## 6️⃣ WOW #6 — The Health Score

**Where:** `/commander`
**Proof:** `modules/02-cc-dashboard.md` §4

Every trainee gets a live 0–100 score computed from six real conditions —
attendance, documents, kit, FPT, weekly tests and pending recovery.

**The line:**
> "Ek number me pata chal jaata hai ki rangroot kis haal me hai. Commander
> ko paanch register kholne ki zaroorat nahi — jiska score kam hai, us par
> dhyan do."

Pair it with the **11 one-tap roster filters**: tap *DOCS PENDING*, tap
*FPT FAIL*, instant lists. That two-tap moment is the fastest "aha" in the
product.

---

## 7️⃣ WOW #7 — The Inspection Loop That Actually Closes

**Where:** `/so-inspections`
**Proof:** `modules/11-inspections.md` §4, §7

A finding travels **open → in progress → submitted → verified/closed**,
with rework as a real path back. **The person who did the work cannot
verify their own work.** Rework requires a written reason — the system
refuses to reject silently. And a single **Compliance %** shows how many
findings are closed.

**The line:**
> "Kami mili, kisko theek karni hai wo tay hua, kaam hua, officer ne check
> kiya, band hui. Poora chakkar. Kaagaz par ye chakkar kabhi poora nahi
> hota — kyunki follow-up kisi ko yaad nahi rehta."

**This is the closer for a senior officer.**

---

## 8️⃣ WOW #8 — The AI That Knows What It Must Not Do

**Where:** `/ai-agent`
**Proof:** `modules/12-ai-agent.md` §3

Thirty-one tools, and **twenty collections the AI can never write to**, no
matter what anyone types. It cannot approve leave. It cannot create users.
It cannot touch the stock ledger. It cannot delete its own audit trail.
Every impactful write asks for confirmation first.

**The line:**
> "AI ko sab kuch dena aasaan hai. Usko sahi tarah se rokna mushkil hai.
> Humne wo mushkil kaam kiya hai."

**Demo it last, and rehearse your questions.** See the module's demo
warnings.

---

## 9️⃣ WOW #9 — Everyone Sees The Same Day

**Where:** `/today` — Today Special
**Proof:** `modules/13-audit-today.md` Part B

Nine kinds of activity in one feed, with a Hindi digest written from the
real counts. **Every role can open it — including trainees.**

**The line:**
> "Company me afwah tab failti hai jab kisi ko pata nahi hota ki hua kya
> hai. Yahan Commander, clerk aur rangroot — sab ek hi page dekh rahe hain.
> Ye sirf software ki baat nahi, ye company chalane ka tareeka hai."

---

## 🔟 WOW #10 — The Register That Speaks Hindi

**Where:** `/audit-log` — Lekha-Jokha Register
**Proof:** `modules/13-audit-today.md` Part A

Audit entries are readable sentences, not machine codes:

> *"045 Ramesh Kumar ki 'Bukhar' report approve ki (S · 04-09 se 06-09,
> 3 din). Wajah: tez bukhar. Absent register + MI register + notice board
> update hua."*

**The line:**
> "Ye kisi programmer ke liye nahi likhi gayi. Ye us officer ke liye likhi
> hai jo chhe mahine baad poochega — ye kya hua tha?"

⚠️ Remember the honest caveat: coverage is good for trainee reports, files
and leave — **not universal**. Do not claim "har cheez ka record hai".

---

## Honourable Mentions

Worth pointing at if the moment arises, but do not build a beat around them:

| Feature | Where | One line |
|---|---|---|
| **33 real BSF subjects** built in | `/test-records` | "Human Rights bhi hai — ye list humne banai nahi" |
| **FPT's 7 events, per-event pass/fail** | `/test-records` | "Rope climbing me atka hai, baaki sab paas" |
| **Size-wise kit stock** | `/issue-kit` | "Number 8 ke kitne bache hain, ye bhi pata hai" |
| **30-day grace period** on licence expiry | — | "Kaam ek din late payment se atakna nahi chahiye" |
| **Hindi exports to Excel correctly** | `/reports` | Demo it, don't say it |
| **Notification deep links** | bell | One tap lands on the Approve button |
| **Trainee Senior can report on behalf** | trainee portal | "Record me likha rehta hai kisne bheji" |
| **Deactivate, don't delete** | `/users` | History survives a transfer |
| ⭐ **Final Board auto-computes the course result** | `/final-board` | "Fit for Duty / Conditional / Unfit — niyam sabke liye ek jaise" |
| ⭐ **Festival Planner** | `/welfare-demographics` | "Jawaan ka tyohaar yaad rakhna afsar ka kaam hai — ab system yaad dilata hai" |
| ⭐ **Mismatch Dashboard** | `/mismatch-dashboard` | "System apne aap ko check karta hai — duplicate chest number bhi pakadta hai" |

> These last three were traced after the main pass and are documented in
> `modules/15-registers-and-lifecycle.md`. Any of them can replace a
> weaker beat if the audience fits — Festival Planner for a welfare-minded
> commander, Final Board at end-of-course, Mismatch Dashboard for a sceptic.

---

## Choosing Your Three

| Audience | Show these |
|---|---|
| **Company Commander** | #1 cascade · #6 health score · #3 auto-attendance |
| **Senior / inspecting officer** | #7 inspection loop · #10 audit register · #5 order-vs-paid |
| **Quarter Master** | #5 order-vs-paid · #4 atomic stock · size-wise kit |
| **Clerk** | #1 cascade · #3 auto-attendance · #9 Today Special |
| **Technical evaluator** | #4 atomic stock · #8 AI guardrails · role security (`04-ROLE-MATRIX.md` §5) |
| **Sceptic in the room** | #10 audit register · **Mismatch Dashboard** · then hand them the "Do NOT promise" lists |
| **Welfare-minded officer** | **Festival Planner** · #9 Today Special · #1 cascade |

---

## ⚠️ The Discipline That Makes This Work

Every WOW above is real. That is the only reason the list has value.

**Do not add to it.** The moment you demo something the code does not do,
you have converted a verified highlight reel into a sales pitch, and the
first pilot will expose it. Each module document ends with a **"Do NOT
Promise"** section — read the relevant one before you present that module.
