# FCOY — Role Matrix

> **Purpose:** exactly what each role sees and can do. Use this when a buyer
> asks *"Clerk ko kya dikhega?"* or *"Kya QM trainee ka data dekh sakta hai?"*
>
> All rows verified against `src/App.tsx` route guards,
> `src/config/permissions.ts`, and `src/components/layout/Sidebar.tsx`.

---

## 1. The Roles That Actually Exist

| Role | How the system identifies it | Landing screen |
|---|---|---|
| **Company Commander** | `role === 'Company Commander'` | `/commander` |
| **Clerk** | `role === 'Clerk'` | `/clerk` |
| **Quarter Master** | `role === 'Quarter Master'` | `/quartermaster` |
| **Ustad** | `role === 'Ustad'` | `/ustad` |
| **Senior Officer / Inspector** | `role === 'Senior Officer / Inspector'` | `/so-dashboard` |
| **Trainee / Trainee Senior** | `role === 'Trainee'` (normalised) | `/trainee-dashboard` |
| **Developer / Master** | **flag** `isDeveloper === true` on the user doc | adds `/dev-practice` |
| *Unassigned* | fallback when no role is set | restricted |

**Two important nuances — CONFIRMED in `AuthContext.tsx`:**

1. **Developer is not a role.** It is a boolean flag layered on top of an
   existing role. A user is "Clerk **and** developer", never "a Developer".
2. **Trainees can never be developers.** The code explicitly blocks it:
   `isDeveloper && normalizeRole(role) !== 'Trainee'`. A trainee senior
   cannot slip into the developer sandbox.

Also confirmed: the app runs a **real-time listener on the user profile**,
so if a Commander changes someone's role or deactivates them, it takes
effect immediately — no re-login required.

---

## 2. Route Access Groups (the actual code constants)

From `src/App.tsx`:

| Constant | Members |
|---|---|
| `ALL_ROLES` | Company Commander, Quarter Master, Clerk, Ustad |
| `QM_ROLES` | Company Commander, Quarter Master |
| `CLERK_ROLES` | Company Commander, Clerk |
| `WELFARE_ROLES` | Company Commander, Clerk, Quarter Master |
| `STAFF_MANAGE_ROLES` | Company Commander, Clerk |
| `STAFF_VIEW_ROLES` | Company Commander, Clerk, Ustad |
| `SO_ROLES` | Company Commander, Senior Officer / Inspector |
| `SO_INSPECTIONS_ROLES` | Company Commander, Senior Officer / Inspector, Clerk, Quarter Master, Ustad |
| *(CC-only, inline)* | `['Company Commander']` |

> **Presentation line:** *"Har screen ka access group code me define hai,
> aur database rules me bhi. UI sirf mirror karta hai."*

---

## 3. Master Access Grid

✅ = full access · 👁 = view / limited · ❌ = no access

| Screen | Route | CC | Clerk | QM | Ustad | SO | Trainee |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Command & overview** |
| Commander dashboard | `/commander` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Clerk dashboard | `/clerk` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| QM dashboard | `/quartermaster` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Ustad dashboard | `/ustad` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Today Special | `/today` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trainee portal | `/trainee-dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| All batches | `/batches` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Trainee operations** |
| Trainee browser / profile | `/profile` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Document cell | `/documents` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Medical / MI room | `/medical-register` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Absent management | `/absent-management` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Relegation / RelID | `/relegation` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Trainee reports & accounts | `/trainee-management` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Welfare & demographics | `/welfare-demographics` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Weekly programme | `/weekly-program` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Training & staff** |
| Staff list | `/staff` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Training schedule | `/training-schedule` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Batch progress | `/batch-progress` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Staff leave | `/staff-leave` | ✅ | ✅ | ❌ | 👁 | ❌ | ❌ |
| Leave management | `/leave-management` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mark attendance | `/staff-attendance` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Duty management | `/duty-management` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Deputation | `/deputation` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Subject master / assignment | `/subjects`, `/subject-assignment` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Period attendance | `/period-attendance` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Test records | `/test-records` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Syllabus tracking | `/syllabus-tracking` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Training sessions | `/training-sessions` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Final board | `/final-board` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Joining / clearance | `/joining-workflow`, `/clearance` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Discipline / movement | `/discipline-register`, `/movement-register` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Stores & finance** |
| Inventory | `/inventory` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Kit issue | `/issue-kit` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Funds dashboard | `/funds` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| The 4 individual funds | `/mess-fund` etc. | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Vendors / payments | `/vendors`, `/vendor-payments` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Mess boy salary | `/mess-boy-salary` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Inspections** |
| Inspection dashboard | `/so-dashboard` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Inspections & findings | `/so-inspections` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Command-only** |
| AI agent | `/ai-agent` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Audit log | `/audit-log` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| User management | `/users` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Settings | `/settings` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mismatch dashboard | `/mismatch-dashboard` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reports centre | `/reports` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Master-side (flag-gated)** |
| Subscription | `/subscription` | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Company monitor | `/company-monitor` | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Practice console | `/dev-practice` | flag | flag | flag | flag | flag | ❌ |

⚠️ = CC **and** `VITE_SUBSCRIPTION_ENABLED=true`. Otherwise redirects to `/login`.

---

## 4. Role-by-Role Presentation Notes

### 4.1 Company Commander — "sees everything, decides everything"

**Exclusive powers (nobody else can do these) — CONFIRMED:**

| Power | Where |
|---|---|
| Approve / reject / return leave | `canApproveLeave()` — CC only |
| Create users, set roles, activate/deactivate | `/users` |
| Use the AI agent | `/ai-agent` |
| View the audit log | `/audit-log` |
| Change system settings | `/settings` |
| View cross-batch "All Batches" aggregates | `canViewAllBatches()` — CC only |
| Data-integrity mismatch dashboard | `/mismatch-dashboard` |

**What to say:**
> "Commander ka login poora system kholta hai. Lekin sabse important —
> chutti approve karne ka haq sirf isi ke paas hai, aur AI agent bhi sirf
> isi ko milta hai."

**Best demo screens:** `/commander` → notification bell → `/ai-agent`

---

### 4.2 Clerk — "runs the trainees"

Owns the entire trainee lifecycle: registration, documents, medical,
absence, notices, trainee accounts, relegation, weekly programme.

**Cannot:** touch funds, inventory, vendors, users, AI, audit log, or
approve staff leave.

**What to say:**
> "Clerk ke paas trainee ka poora kaam hai — admission se lekar documents,
> MI room, chutti aur notice tak. Lekin paisa aur stores uske paas nahi
> hain. Ye jaan-boojh kar alag rakhe gaye hain."

**Best demo screens:** `/clerk` → `/trainee-management` (approval inbox) →
`/medical-register`

---

### 4.3 Quarter Master — "runs the money and the stores"

Owns inventory, kit issue, all four funds, vendors, vendor payments,
mess boy salary.

**Cannot:** see trainee documents, medical records, staff leave, users,
AI or audit log.

**What to say:**
> "QM ke paas stores aur char fund hain. Trainee ka personal data usko
> nahi dikhta — role separation database level par lagi hai."

**Best demo screens:** `/quartermaster` → `/funds` → `/vendor-payments`

---

### 4.4 Ustad (Instructor) — "runs the training on the ground"

Sees: staff list, training schedule, batch progress, subjects, subject
assignment, own leave, deputation register, duty management, assigned
corrective actions.

> ✅ **FIXED (2026-09-04).** `/ustad` was previously a 20-line placeholder
> reading *"Weekly Training Program Will Be Displayed Here"*. It is now a
> **real, live dashboard** and is safe to open in a demo.
>
> It answers one question — *"Aaj mera kya kaam hai?"* — using data that
> already existed: today's training periods (the Ustad's own classes are
> highlighted), today's duty roster, staff strength (available / leave /
> TD / hospital / course), who is on approved leave right now, and the next
> six days of scheduled periods. Every tile links through to the real
> working screen.
>
> **It is strictly read-only.** Nothing can be edited from here — the
> footer says so. All changes still happen in `/training-schedule`,
> `/staff-attendance`, `/duty-management`, `/deputation`.
>
> Ironically, the `ustad` **module** is the largest in the product
> (18,448 lines) — the depth is real, only the landing page is empty.

**What to say (if asked about the landing page):**
> "Ustad ka landing dashboard abhi simple hai — asli kaam schedule,
> attendance aur duty screens me hai. Ye dashboard next release me
> populate hoga."

**Best demo screens:** `/training-schedule` → `/staff-attendance` →
`/duty-management`

---

### 4.5 Senior Officer / Inspector — "quality and compliance"

A narrow, focused role: inspections and findings only.

**Ownership rules — CONFIRMED in `SOInspectionHub`:**
- CC can act on any inspection or finding
- SO can edit/delete only findings **they created**, and only while status
  is `open` or `rework`
- A draft inspection can only be edited by its creator

**What to say:**
> "Inspector ka role bilkul focused hai — sirf inspection aur findings.
> Aur wo doosre ki finding ko chhed nahi sakta."

**Best demo screen:** `/so-inspections`

---

### 4.6 Trainee / Trainee Senior — "self-service, nothing else"

Own portal only, 7 tabs: Report · Today Special · Platoon View · Updates ·
Notice Board · Files · My Info.

**Confirmed capabilities:**
- Raise a report for himself
- A **Trainee Senior** can raise a report on behalf of any trainee in the
  batch (`onBehalf` flag, `submittedByUid` recorded)
- Raise a **general** report (mess, kit, maintenance, complaint) with no
  trainee attached
- See only notices targeted at him or his group
- Download only files sent to him or his platoon
- See the Today Special feed

**Cannot:** approve anything, see staff data, funds, or other trainees'
documents.

**What to say:**
> "Trainee ko sirf apna portal dikhta hai. Wo report bhej sakta hai, notice
> aur file dekh sakta hai — approve kuch nahi kar sakta. Aur senior trainee
> doosron ke liye bhi report bhej sakta hai, lekin record me likha rehta hai
> ki kisne bheji."

**Best demo:** submit a sick report, then switch to clerk and approve it.

---

### 4.7 Developer / Master — "sandbox and oversight"

- `isDeveloper` flag adds the Practice Console (`/dev-practice`) and a
  visible practice banner
- Developer accounts **bypass subscription entirely** (no subscription
  reads at all) — **CONFIRMED** in `SubscriptionContext.tsx`
- Seed tools for master and test batches
- Blocked for Trainee accounts by design

> Present this as *"hamara side ka tool"*, not a customer feature.

---

## 5. The Security Story (say this to technical buyers)

Three honest, verifiable points:

1. **Two layers, not one.** `src/config/permissions.ts` drives the UI, and
   its own header comment states it is *"NOT the security boundary — the
   rules in firestore.rules are."* Hiding a button is not the protection;
   the database rules are.

2. **Leave approval is triple-guarded.** UI affordance → handler guard in
   `useLeave.ts` (throws on unauthorised call) → Firestore rules protecting
   `status`, `approvedBy`, `approvedByName`, `approvalDate`,
   `rejectionReason`. Even a hand-crafted request is rejected.

3. **Role changes apply instantly.** A live listener on the user profile
   means deactivating a user or changing their role takes effect without
   waiting for them to log out.

**What to say:**
> "Screen chhupana security nahi hoti. Yahan har role ka access database
> rules me likha hai. Clerk agar seedha request bhi bheje to database mana
> kar dega."

---

## 6. Quick Answers

| Question | Answer |
|---|---|
| "Clerk chutti approve kar sakta hai?" | No. Only Company Commander. Triple-guarded. |
| "QM trainee ka medical dekh sakta hai?" | No. Not in `CLERK_ROLES`. |
| "Ustad kisi ki attendance badal sakta hai?" | `/staff-attendance` is `STAFF_MANAGE_ROLES` = CC + Clerk. Ustad views, does not manage. |
| "Trainee doosre trainee ka data dekh sakta hai?" | Platoon view shows names and duty status only — no documents or personal records. |
| "SO doosre ki finding delete kar sakta hai?" | No. Only findings they created, only while `open` or `rework`. |
| "Kitne subscriptions chahiye?" | One per company. Never per user. |
| "Naya role add kar sakte hain?" | Role strings are code constants — that is a development change, not a settings toggle. **Do not promise self-service role creation.** |
