# FCOY — Project & Module Overview

> **Purpose of this file:** give you the "big picture" you need before you
> open any screen. If someone asks *"What exactly is this product?"* — the
> answer is on this page.

---

## 1. What Is FCOY? (the one-line answer)

> **FCOY is a complete command-and-administration system for a training
> company — one place where the Commander, Clerk, Quarter Master,
> Instructor and Trainee all work, instead of registers, WhatsApp and
> Excel files.**

If you have 30 seconds, say this:

> "Ek training company chalane me roz 20 alag registers lagte hain — hazri,
> chutti, MI room, kit, funds, inspection. FCOY un sabko ek app me le aata
> hai. Har role ko sirf uska kaam dikhta hai, aur Commander ko sab kuch
> ek dashboard par."

---

## 2. The Problem It Solves

| Today (without FCOY) | With FCOY |
|---|---|
| Attendance, leave, MI room in separate paper registers | One system, all connected |
| Commander asks "kitne log absent hain?" and waits for a phone call | Dashboard shows it live |
| Clerk approves a sick report, then manually writes it into 3 registers | One approval updates absent register, MI register and notice board automatically |
| No record of who changed what | Every important action is logged with who / when / why |
| Trainee has to physically find the clerk to report sickness | Trainee submits from his own login; it lands in the clerk's inbox |
| Funds tracked in Excel, no audit trail | 4 separate funds with vendors, bills and payment history |

---

## 3. Who Uses It — Confirmed Roles

All roles below are **CONFIRMED** from `src/App.tsx` role constants and
`src/config/permissions.ts`.

| Role | Landing screen | What they own |
|---|---|---|
| **Company Commander (CC)** | `/commander` | Everything. Only role that can approve leave, manage users, and use the AI agent. |
| **Clerk** | `/clerk` | Trainees, documents, medical register, absent management, notices, trainee accounts |
| **Quarter Master (QM)** | `/quartermaster` | Inventory, kit issue, 4 funds, vendors, vendor payments |
| **Ustad (Instructor)** | `/ustad` | Training schedule, staff attendance, duties, subjects, tests |
| **Senior Officer / Inspector (SO)** | `/so-dashboard` | Inspections, findings, corrective-action verification |
| **Trainee / Trainee Senior** | `/trainee-dashboard` | Own portal — reports, notices, files, Today Special |
| **Developer / Master** | flag, not a role | Practice sandbox + company monitor (see caveat in §6) |

> **Important nuance:** Developer is **not** a role string. It is a boolean
> flag `isDeveloper` on the user document, and it is explicitly blocked for
> Trainee accounts. (`AuthContext.tsx`)

---

## 4. Module Map — Where The Real Depth Is

Measured by actual code size. Use this to decide **how much presentation
time each area deserves**.

| Module | Files | Lines | Presentation weight |
|---|---:|---:|---|
| `ustad` — staff, duty, leave, subjects, tests, deputation | 53 | 18,448 | **Heaviest module in the product** |
| `aiAgent` — tool-calling AI agent | 28 | 8,943 | Big WOW factor |
| `dashboard` — CC / Clerk / role dashboards | 9 | 6,229 | **Main demo screen** |
| `finance` — funds, vendors, payments | 9 | 5,976 | Strong buyer value |
| `students` — trainee registration, profile, browser | 12 | 5,042 | Core operations |
| `system` — settings, users, reports | 7 | 4,665 | Supporting |
| `developer` — practice sandbox, company monitor | 7 | 3,816 | Master-side only |
| `traineeModule` — trainee portal, reports, files | 8 | 3,568 | Nice differentiator |
| `quartermaster` | 2 | 3,175 | QM landing |
| `trainingFund` / `messFund` / `companyAssets` | 3 | 7,040 | The 4-fund system |
| `welfare` — demographics, festival planning | 9 | 2,487 | Unusual, memorable |
| `subscription` | 10 | 2,104 | Master-side only (see §6) |
| `inspection` — inspections & findings | 5 | 1,958 | Full lifecycle |
| `weekly` — weekly program | 1 | 1,827 | Supporting |
| `relegation` | 4 | 1,261 | Specialist workflow |
| `activity` — Today Special feed | 2 | 601 | Newest feature |
| `notifications` | 3 | 569 | Small code, high value |
| Others (medical, leaveMgmt, discipline, movement, joining, clearance, syllabus, mismatch, finalResult, periodAttendance, trainingSessions, auditLog, batch, auth, shared) | — | — | Supporting screens |

---

## 5. How The System Is Built (say this only if asked)

Keep this short in a sales presentation — buyers care about outcomes,
not stack. But have the facts ready:

- **Frontend:** React + TypeScript + Vite, Tailwind styling
- **Backend:** Firebase — Firestore (database), Firebase Auth (login),
  Firebase Storage (documents/photos), Cloud Functions (AI secrets)
- **Security:** Firestore security rules are the real boundary.
  `src/config/permissions.ts` mirrors them in the UI, and its own header
  comment says it is *"NOT the security boundary"* — the rules are.
- **Offline behaviour:** a service worker (`public/sw.js`) caches static
  assets; HTML is always fetched from network.

---

## 6. Three Honesty Notes — Read Before You Present

These matter. If you claim them wrongly in front of a technical buyer you
will lose credibility.

### 6.1 Subscription is a MASTER-side feature and is OFF by default
**CONFIRMED** — `src/features/subscription/subscription.config.ts` +
`src/App.tsx`.

`SUBSCRIPTION_ENABLED` is `true` only when the env var
`VITE_SUBSCRIPTION_ENABLED === 'true'`. `.env.example` states plainly that
company deployments should leave it unset, and only the master build turns
it on. When the flag is off:

- `/subscription` and `/company-monitor` **redirect to `/login`**
- their sidebar links are hidden

**How to present it:** *"Subscription is the vendor's control panel, not
something the customer company sees. One subscription per company —
never per user."* This is exactly the model the buyer expects for SaaS.

### 6.2 Notifications are calculated live, not stored
**CONFIRMED** — `src/features/notifications/useNotifications.ts`.

The bell does not read a `notifications` collection. It scans 7 real data
sources every refresh and builds the list on the fly. Two consequences to
be honest about:

- ✅ Notifications can never go stale or out of sync with real data
- ⚠️ Read/unread is stored in **localStorage**, so it is **per-device**, not
  per-user-account

**How to present it:** *"Notification hamesha live data se banti hai —
kabhi purani ya galat nahi hoti."* (Do not claim push notifications to
mobile phones. That is **NOT VERIFIED**.)

### 6.3 Some files in the repo are not wired into the app
**CONFIRMED** — see `AUDIT-HISTORY.md` in the repo root.

46 files exist in the codebase that are never imported anywhere, including
`Trainee360Screen.tsx`, `SODashboard.tsx` and `SOInspectionsScreen.tsx`.

**Do not demo or promise these.** Only screens reachable through a route in
`src/App.tsx` are real product.

---

## 7. Route Reality Check

**61 routes CONFIRMED** in `src/App.tsx`.

Almost all are protected by `allowedRoles`. Only these have no role guard
(any signed-in user):

| Route | Why |
|---|---|
| `/` , `/login` , `*` | Entry / auth / fallback |
| `/first-run` | Initial company setup |
| `/trainee-dashboard` | Trainee portal — trainees are not in staff role constants |
| `/today` | Today Special — intentionally visible to everyone including trainees |
| `/dev-practice` | Developer sandbox |
| `/purchase` | **Redirect only** → `/funds`. Not a real screen. |
| `/mess-recovery` | To be verified in a later batch |

---

## 8. The Five Things That Make Buyers Say "Yes"

Ranked by demo impact. Full detail comes in `06-WOW-FEATURES.md`.

1. **One approval updates everything** — clerk approves a sick report and
   the absent register, MI register, notice board and trainee's live status
   all update together. **CONFIRMED.**
2. **AI agent that actually does work** — 30 tools including write actions,
   restricted to the Commander. **CONFIRMED.**
3. **Commander sees the whole company on one screen** — attention board,
   funds, today & tomorrow schedule, away roster, drill-down cards.
   **CONFIRMED.**
4. **Full inspection lifecycle** — inspection → finding → corrective action
   → verification → closure, with rework loop. **CONFIRMED.**
5. **Today Special daily feed** — who went where, who did what, when and
   why, in one news-style page visible to everyone. **CONFIRMED.**

---

## 9. Verification Legend

Every claim in this documentation package carries one of these:

| Tag | Meaning |
|---|---|
| **CONFIRMED** | Traced in code end-to-end. Safe to demo and promise. |
| **PARTIAL** | Implemented but with caveats. Explain the caveat. |
| **UI PRESENT — END-TO-END NOT VERIFIED** | Screen exists; full downstream effect not traced. Show, don't promise. |
| **NOT VERIFIED** | Could not be confirmed. **Do not mention in a sales presentation.** |

---

## 10. Where To Go Next

| You want to… | Open |
|---|---|
| Plan the actual presentation | `01-PRESENTATION-ROADMAP.md` |
| Find every feature with priority | `03-FEATURE-CATALOG.md` *(Batch 2)* |
| Know what each role sees | `04-ROLE-MATRIX.md` *(Batch 2)* |
| Deep dive the main demo screen | `modules/02-cc-dashboard.md` *(Batch 2)* |
| See what still needs verification | `99-DOCUMENTATION-AUDIT.md` *(final batch)* |
