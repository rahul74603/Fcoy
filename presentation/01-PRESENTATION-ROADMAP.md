# FCOY — Presentation Roadmap

> **Purpose:** this is your running order. Open this file when you present.
> It tells you what to show, in what sequence, for how long, and what to say.
> Detailed slide scripts come in `02-SLIDES.md`; deep feature notes come in
> the module files.

---

## 1. Before You Start — Demo Prerequisites

Do this **30 minutes before** any live demo. A broken demo kills a sale
faster than a missing feature.

### 1.1 Accounts you need ready

| Login | Why you need it |
|---|---|
| **Company Commander** | 80% of the demo runs from here. Only CC can approve leave, use AI, manage users. |
| **Clerk** | To show the approval inbox and the trainee-report workflow |
| **Trainee** | To show the trainee portal and prove "trainee submits, clerk approves" |
| Quarter Master *(optional)* | Only if the buyer cares about stores/funds |

> Practise switching between them. Logging out and in mid-demo looks slow —
> keep two browsers or one normal + one incognito window open.

### 1.2 Data that must exist in the active batch

Your demo is only as good as your data. Make sure the active batch has:

- [ ] Trainees loaded with chest numbers, platoons, names
- [ ] **At least 2 people currently away** (one sick/MI, one on leave) —
      otherwise the away roster and status cards look empty
- [ ] **At least 1 pending leave request** — this is the notification hero
- [ ] **At least 1 pending trainee report** in the clerk inbox
- [ ] Some fund transactions so the finance cards are not zero
- [ ] A weekly programme entered so "Today & Tomorrow" shows something
- [ ] At least one inspection with an open finding

### 1.3 Technical checks

- [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`)
- [ ] Storage rules deployed if you plan to demo file upload
- [ ] Internet is working — this is a live Firebase app
- [ ] Browser zoom at 100%, sidebar visible, no dev console open

> ⚠️ **If `SUBSCRIPTION_ENABLED` is off in your build**, `/subscription`
> and `/company-monitor` will redirect to login. Either turn the flag on in
> a master build for that part of the demo, or present subscription by
> explanation rather than by clicking. Do not click a link and get bounced
> to the login screen in front of a buyer.

---

## 2. Three Presentation Lengths

Pick based on your audience and time slot.

### 2.1 The 5-Minute Pitch (elevator / first meeting)

| # | Show | Time |
|---|---|---|
| 1 | The problem — registers, phone calls, Excel | 30s |
| 2 | CC Dashboard — the whole company on one screen | 2m |
| 3 | The connected approval — clerk approves once, everything updates | 1.5m |
| 4 | AI agent — ask it a question, it answers from live data | 1m |

**Close with:** *"Ye sab ek hi system me hai, aur har role ko sirf uska
kaam dikhta hai."*

### 2.2 The 20-Minute Demo (serious buyer)

Sections 1 → 9 of the full flow below. Skip Master/Developer.

### 2.3 The Full 45-Minute Walkthrough (decision meeting)

The complete flow below, all 14 sections.

---

## 3. The Full Presentation Flow

Ordered by **buyer impact**, not by code structure. Each section links to
its detailed module file (created in later batches).

---

### Section 1 — The Problem (no screen, 1 min)

Do not open the app yet. Set up the pain first.

**Say:**
> "Ek training company me roz ka kaam 20 registers me bantaa hai — hazri,
> chutti, MI room, kit, funds, inspection. Commander ko kuch bhi jaanna ho
> to phone karna padta hai. Aur agar koi galti ho jaye, to pata hi nahi
> chalta ki kisne ki."

**Why start here:** the buyer must feel the problem before they value the
solution.

---

### Section 2 — Login & Role-Based Experience (2 min) · P0

**Screen:** `/login` → land on `/commander`

**Show:**
- Log in as Commander → full sidebar appears
- Point at the sidebar: sections for CC, QM, Ustad, Clerk
- Then say you will log in as Clerk later and the sidebar will be different

**Say:**
> "Ek hi app hai, lekin har role ko sirf uska kaam dikhta hai. Clerk ko
> funds nahi dikhte, QM ko trainee documents nahi dikhte. Ye sirf screen
> chhupana nahi hai — database level par bhi rules lagi hain."

**Value:** security + simplicity in one point.
**Module file:** `modules/01-authentication.md`

---

### Section 3 — CC Dashboard: The Hero Screen (5 min) · P0

**Screen:** `/commander`

This is your most important screen. Spend real time here.

**Show, in this order:**
1. **Commander Attention Board** — items needing action right now
2. **Today & Tomorrow** — what is scheduled
3. **Away roster** — who is not on field, why, until when
4. **Funds overview** — 4 funds at a glance
5. **Click a metric card** → drill down into the detail

**Say:**
> "Commander subah app kholta hai aur 10 second me poori company ka haal
> pata chal jata hai — kaun nahi hai, kyu nahi hai, aaj kya training hai,
> paisa kahan hai. Har card clickable hai, andar poori detail milti hai."

**WOW moment:** clicking a card and drilling into detail.
**Module file:** `modules/02-cc-dashboard.md`

---

### Section 4 — Notifications: The System Tells You (2 min) · P0

**Screen:** notification bell in the top bar (any screen)

**Show:**
- Open the bell → pending leave, today's duties, staff in hospital,
  pending trainee reports
- **Click a notification** → it navigates straight to the record

**Say:**
> "Commander ko dhoondhna nahi padta — system khud batata hai ki kya
> pending hai. Aur notification par click karo to seedha usi record par
> pahunch jaate ho."

**Honest line if a technical buyer asks:**
> "Notifications live data se banti hain, isliye kabhi purani ya galat
> nahi hoti."

**CONFIRMED sources (7):** pending leave · returning soon · today's duties ·
staff in hospital · upcoming schedules · active deputations · pending
trainee reports.

**Module file:** `modules/05-notifications.md`

---

### Section 5 — Leave Management: A Real Approval Workflow (4 min) · P0

**Screen:** `/staff-leave` → `/leave-management`

**Show:**
1. A pending leave request with duration and reason
2. The approving authority guard — **only CC can approve**
3. Approve it → status changes → staff status updates

**Say:**
> "Chutti ki application, uska duration, wajah — sab yahin. Approve karne
> ka haq sirf Commander ke paas hai. Ye teen jagah lock hai: button
> chhupa hua hai, code me guard hai, aur database rules me bhi. Clerk
> chahe to bhi approve nahi kar sakta."

**Why buyers love this:** it proves the product understands *authority*,
not just data entry.

**Module file:** `modules/04-leave-management.md`

---

### Section 6 — The Connected Approval (4 min) · P0 · **BIGGEST WOW**

**Screens:** `/trainee-dashboard` (trainee) → `/trainee-management` (clerk)

This is the single most persuasive demo in the product. Rehearse it.

**Show:**
1. Log in as **trainee** → submit a sick report (chest no, reason, dates)
2. Log in as **clerk** → the report is waiting in the inbox
3. Click **Approve**
4. Now show the result in **three different places**:
   - Absent register has the record
   - MI/Medical register has the record
   - Notice board shows it
   - The trainee's live status changed

**Say:**
> "Ye sabse important cheez hai. Purane system me clerk ko ye teen alag
> registers me haath se likhna padta tha — aur ek jagah likhna bhool jao to
> record galat ho jata hai. Yahan ek approval, aur sab jagah apne aap
> update ho gaya."

**Module file:** `modules/10-trainee-module.md`

---

### Section 7 — Today Special: The Daily Newspaper (3 min) · P0

**Screen:** `/today`

**Show:**
- The "Aaj ki khabar" headline strip
- Scroll the feed — each card shows **kab / kisne / kya / kyu**
- Filter by category, search a name
- Move the date back a day — history is there too

**Say:**
> "Ye company ka roz ka akhbaar hai. Kaun kaha gaya, kisne kya kiya, kab
> kiya, aur kyu kiya — sab ek page par. Ye sabko dikhta hai, trainee ko
> bhi. Aur kal ka bhi dekh sakte ho."

**Value:** transparency + accountability without anyone writing a report.
**Module file:** `modules/14-today-special-audit.md`

---

### Section 8 — AI Agent: Ask The System Anything (4 min) · P0 · **WOW**

**Screen:** `/ai-agent` (Company Commander only)

**Show:**
1. Ask a **read** question: *"Aaj kitne trainee absent hain?"*
2. Ask something needing a join: *"Chest 1002 ke baare me sab batao"*
3. Mention it can also **do** things, not just answer

**Say:**
> "Ye sirf chatbot nahi hai. Ise company ke live data tak pahunch hai —
> 30 alag kaam kar sakta hai. Poochh sakte ho, aur kaam bhi kara sakte ho.
> Aur ye sirf Commander ke login me hai."

**CONFIRMED:** 30 registered tools including write actions
(`add_trainee`, `record_expense`, `issue_inventory`, `create_finding`,
`submit_corrective_action`, `verify_finding`). CC-only route.

**Security line for technical buyers:**
> "AI ki keys browser me nahi hoti — server side Cloud Functions me rehti
> hain."

**Module file:** `modules/11-ai-agent.md`

---

### Section 9 — Inspections → Findings → Closure (3 min) · P1

**Screen:** `/so-inspections`

**Show:**
- An inspection with findings
- A finding's status journey: `open → in_progress → submitted → closed`
- The **rework** path when work is not acceptable

**Say:**
> "Inspection sirf list banane ke liye nahi hai. Har finding kisi ko assign
> hoti hai, wo kaam karke submit karta hai, aur verify hone ke baad hi
> close hoti hai. Kaam theek na ho to wapas rework me chali jati hai."

**Value:** this is a genuine closed-loop quality process — rare in
competing products.

**Module file:** `modules/09-inspections-findings.md`

---

### Section 10 — Quarter Master: Stores & Kit (3 min) · P1

**Screen:** `/quartermaster` → `/inventory` → `/issue-kit`

**Show:** stock levels, kit issue to a trainee, resulting history

**Say:**
> "QM ka poora stores yahin hai — kitna stock hai, kisko kya issue hua,
> kab hua."

**Module file:** `modules/06-qm-inventory.md`
**Status:** issue → ledger trace **pending verification** (Batch 4)

---

### Section 11 — Finance: Four Separate Funds (3 min) · P1

**Screen:** `/funds` → pick one fund → `/vendors` → `/vendor-payments`

**Show:** the 4 funds (mess, training, company assets, general), a fund's
collections and expenses, vendor dues

**Say:**
> "Char alag fund hain, har ek ka apna hisaab. Vendor ko kitna diya, kitna
> baaki hai — sab record me hai. Excel ki zaroorat nahi."

**Module file:** `modules/07-finance-funds.md`

---

### Section 12 — Ustad / Training Operations (3 min) · P1

**Screen:** `/ustad` → `/training-schedule` → `/staff-attendance` → `/duty-management`

**Say:**
> "Instructor side ka poora kaam — schedule, hazri, duty, subject, test."

**Note for you:** this is the **largest module in the product** (18k lines).
If the buyer is training-focused, expand this section and shorten finance.

**Module file:** `modules/08-ustad.md`

---

### Section 13 — Records, History & Accountability (2 min) · P2

**Screens:** `/audit-log` (CC only) · `/reports` · `/profile`

**Say:**
> "Har important kaam ka record rehta hai — kisne kiya, kab kiya, kyu kiya.
> Commander kabhi bhi dekh sakta hai."

**Module file:** `modules/14-today-special-audit.md`

---

### Section 14 — Multi-Company & Subscription (2 min) · P2

**Screen:** `/company-monitor` and `/subscription` — **master build only**

⚠️ **Handle with care.** These routes redirect to `/login` when
`SUBSCRIPTION_ENABLED` is off, which is the default for company builds.

**Say (explanation, not necessarily a click):**
> "Har company ka apna alag system hota hai — uska data poori tarah alag.
> Subscription company level par hoti hai, ek company ka ek plan. Per-user
> charge nahi hai. Ye control panel hamare paas rehta hai, customer ke paas
> nahi."

**Module file:** `modules/12-subscription.md` + `modules/13-developer-master.md`

---

### Closing — Business Value (1 min, no screen)

**Say:**
> "Teen cheezein yaad rakhiye. Ek — Commander ko poori company ek screen par
> dikhti hai. Do — ek approval se saare register apne aap update ho jate
> hain, haath se likhna khatam. Teen — har kaam ka record rehta hai, kisne
> kiya aur kyu kiya. Baaki sab iske upar bana hai."

---

## 4. Quick Reference — Screen Cheat Sheet

Print this. It is your map during a live demo.

| What you want to show | Route | Role needed |
|---|---|---|
| Command overview | `/commander` | CC |
| Clerk workspace | `/clerk` | Clerk, CC |
| QM workspace | `/quartermaster` | QM, CC |
| Instructor workspace | `/ustad` | Ustad, CC |
| Inspections & findings | `/so-inspections` | SO, CC, Clerk, QM, Ustad |
| Daily news feed | `/today` | Anyone |
| Trainee portal | `/trainee-dashboard` | Trainee |
| Trainee approvals inbox | `/trainee-management` | Clerk, CC |
| Leave | `/staff-leave`, `/leave-management` | Ustad/CC view, CC approves |
| Funds | `/funds` | QM, CC |
| Vendors | `/vendors`, `/vendor-payments` | QM, CC |
| Inventory | `/inventory`, `/issue-kit` | QM, CC |
| Trainee browser | `/profile` | Clerk, CC |
| Medical register | `/medical-register` | Clerk, CC |
| Absent management | `/absent-management` | Clerk, CC |
| AI agent | `/ai-agent` | **CC only** |
| Audit log | `/audit-log` | **CC only** |
| Users | `/users` | **CC only** |
| Welfare & demographics | `/welfare-demographics` | CC, Clerk, QM |
| Subscription / company monitor | `/subscription`, `/company-monitor` | **CC + flag on** |

---

## 5. Demo Rules — Learned The Hard Way

1. **Never click a link you have not tested that morning.** Especially
   subscription routes with the flag off.
2. **Never demo on an empty batch.** Empty states look like a broken product.
3. **Do not open the browser dev console.** Warnings look like bugs.
4. **If something errors, move on immediately.** Do not debug live.
   Say *"Ye data is demo batch me nahi hai"* and continue.
5. **Do not promise anything tagged NOT VERIFIED** in these docs.
   Particularly: mobile push notifications, email/SMS alerts, offline
   editing. None of those are confirmed.
6. **Let the buyer drive for 2 minutes near the end.** Hand over the mouse.
   Nothing sells like them clicking around successfully themselves.

---

## 6. Answers To Likely Questions

| Question | Honest answer |
|---|---|
| "Kya ye mobile par chalta hai?" | Browser-based, responsive UI. **Native mobile app: NOT VERIFIED.** |
| "Internet band ho to?" | Static assets cached by service worker, but it is a live database app — **offline editing NOT VERIFIED.** |
| "Data kis ka hai?" | Firebase project per deployment; company data is isolated. |
| "Kitne users?" | Subscription is **per company**, not per user. |
| "AI ki cost?" | Keys are server-side in Cloud Functions; local ERP commands work without cloud AI. |
| "Purana data import ho jayega?" | A CSV import service file exists but is **not wired into the UI — NOT VERIFIED.** Do not promise it. |
| "Kya trainee sab kuch dekh sakta hai?" | No. Trainee sees his own portal, notices meant for him, and the Today Special feed. |
| "Audit trail hai?" | Yes — `/audit-log` for CC, plus the Today Special feed for everyone. |

---

## 7. Where To Go Next

| Need | File |
|---|---|
| Every feature with P0–P3 priority | `03-FEATURE-CATALOG.md` *(Batch 2)* |
| Role × permission grid | `04-ROLE-MATRIX.md` *(Batch 2)* |
| Slide-by-slide script | `02-SLIDES.md` *(Batch 7)* |
| WOW feature deep dives | `06-WOW-FEATURES.md` *(Batch 7)* |
| What is still unverified | `99-DOCUMENTATION-AUDIT.md` *(final batch)* |
