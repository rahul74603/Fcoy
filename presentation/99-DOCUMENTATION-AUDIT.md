# Documentation Audit

> **What this file is:** the honest self-assessment of this documentation
> package. What was verified and how, what was not, what must never be
> claimed, and what is known to be broken.
>
> **Read this before you present anything.** If a claim appears nowhere in
> this package, do not make it.

**Audited:** 2026-09-04 · **Re-audited:** 2026-09-04 (follow-up pass)
**Repository:** `rahul74603/Fcoy`, branch `arena/01a06802-fcoy`
**Package:** 23 files, ~6,600 lines

> **Follow-up pass result:** the 10 routes previously listed as *UI PRESENT —
> END-TO-END NOT VERIFIED* have been traced. **All 10 are working modules**
> with their own collections and full CRUD; three are demo-worthy. They are
> documented in `modules/15-registers-and-lifecycle.md`, and §7 below has
> been rewritten accordingly. This was a documentation gap, not a product gap.

---

## 1. Method

Every claim in this package was checked against **source code**, not against
documentation, comments alone, or the 26 pre-existing `.md` files in the
repository root.

**What counted as proof:**
- The route exists and is reachable in `src/App.tsx`
- The screen is imported and rendered
- The data path was traced — read query or write call
- Constants, formulas and status lists were read from the file that defines them

**What did NOT count as proof:**
- A code comment describing intent
- A claim in an existing root-level `.md` file
- A type definition with no implementation behind it
- A file that exists but is never imported

**Why that last rule matters:** the repository contains **46 files that are
never imported by anything**. Several look like complete features. They are
not reachable by any user.

---

## 2. What The Package Contains

| File | Purpose |
|---|---|
| `00-DOCUMENTATION-PROGRESS.md` | Batch tracker |
| `01-PROJECT-OVERVIEW.md` | What FCOY is, module map, tech reality |
| `01-PRESENTATION-ROADMAP.md` | Demo flow, timings, prerequisites, FAQ |
| `02-SLIDES.md` | The 24-slide deck with speaker notes |
| `03-FEATURE-CATALOG.md` | 45 features graded P0–P3 |
| `04-ROLE-MATRIX.md` | Role × screen access grid + security story |
| `05-WORKFLOW-CATALOG.md` | 8 end-to-end workflows |
| `06-WOW-FEATURES.md` | Top 10 ranked highlight reel |
| `07-SMART-DETAILS.md` | 11 categories of polish |
| `modules/02` – `modules/15` | 14 module deep-dives |
| `99-DOCUMENTATION-AUDIT.md` | This file |

---

## 3. Verification Legend Used Throughout

| Tag | Meaning |
|---|---|
| **CONFIRMED** | Traced in code end-to-end |
| **PARTIAL** | Implemented but incomplete, or with caveats |
| **UI PRESENT — END-TO-END NOT VERIFIED** | Screen exists; full effect not traced |
| **NOT VERIFIED** | Could not be confirmed — never present as working |

---

## 4. Coverage By Module

| Module | Level | Notes |
|---|---|---|
| Commander dashboard | **CONFIRMED** | 18 collections, health formula, 5 alert arrays, 11 filters |
| Leave (staff) | **CONFIRMED** | Approval chain + auto-attendance traced line by line |
| Leave (trainee) | **CONFIRMED** | Simpler; absent-register sync traced |
| Trainee reporting | **CONFIRMED** | All 5 cascade writes traced |
| Documents | **CONFIRMED** | 20 types, 7 categories read from source |
| Medical register | **CONFIRMED** | Two-way mapping + de-duplication |
| Absent management | **CONFIRMED** | 6 types, bilingual labels |
| Relegation | **PARTIAL** | Two implementations; one has a known bug (§8) |
| Notifications | **CONFIRMED** | All 7 sources traced to live queries |
| Inventory / kit issue | **CONFIRMED** | Atomic transaction read in full |
| Finance / funds | **CONFIRMED** | All formulas read from source |
| Reports | **CONFIRMED** | All 20 generators traced |
| Training / tests | **CONFIRMED** | 33 subjects, 7 FPT events, 11 test types |
| The 10 lifecycle registers | **CONFIRMED** | Traced in the follow-up pass — see `modules/15` |
| Staff / duty / deputation | **CONFIRMED** | Availability checker + priority chain traced |
| Inspections | **CONFIRMED** | Every transition and auth check traced |
| AI agent | **CONFIRMED** | 31 tools, block list, confirmation mechanism |
| Audit log | **PARTIAL** | Works, but coverage is not universal (§8) |
| Today Special | **CONFIRMED** | 9 kinds, digest generator |
| Users / settings | **CONFIRMED** | |
| Subscription | **CONFIRMED** | Flag, 5 states, grace period |

---

## 5. 🚫 The Consolidated Never-Promise List

Every item below was gathered from the "Do NOT Promise" section of a module
document. **This is the single most useful page in the package.**

### Does not exist at all

| Claim | Reality |
|---|---|
| Mobile push notifications | `fcm.service.ts` exists but is **never imported** — dead code |
| SMS or email alerts | Not implemented anywhere |
| Native PDF export | `pdf.service.ts` is **never imported**. CSV + browser print only |
| Bulk user import from CSV | `csvImport.service.ts` is **never imported** |
| Bank integration / reconciliation | Not implemented |
| GST / TDS / tax computation | Not implemented |
| Biometric or geo-fenced attendance | Not implemented |
| Barcode / QR scanning | Not implemented |
| SSO / Active Directory / LDAP | Not implemented |
| Two-factor authentication | Not verified |
| Voice input to the AI | Not verified |
| Offline mode | Not verified — do not promise |

### Exists but weaker than it sounds

| Claim | Reality |
|---|---|
| "Automatic leave balance deduction" | A `LeaveBalance` type exists; **no calculation found**. Do not demo a balance. |
| "Every action is audited" | **Three** logging systems; only `auditLogs` has a UI. Coverage is good for trainee reports, files and leave — **not universal** |
| "Configurable health score" | Weights are hard-coded. Not a settings slider |
| "Real-time notifications" | 2-minute refresh cycle. Say "within two minutes" |
| "Notifications sync across devices" | Read-state is per-device (localStorage) |
| "Multi-level leave approval" | Single step: pending → approved by CC |
| "Overstay auto-detection" | A stored field on trainee leave, not a proven alarm |
| "Automatic purchase orders" | Low stock is an **alert only** |
| "Automatic recovery from trainees" | Explicitly manual by design — the screen says so |
| "Budget limits / overspend blocking" | Funds simply show red |
| "Expense approval workflow" | QM records directly; no CC counter-approval traced |
| "Auto-escalation of overdue findings" | Highlighted, not escalated to anyone |
| "Custom report builder" | 20 reports defined in code |
| "Scheduled / emailed reports" | Manual generation only |
| "Self-service role creation" | Roles are code constants |
| "Automatic duty roster generation" | System *checks* availability; humans choose |
| "Photo evidence on findings" | Not verified |
| "Certificates / mark sheets" | No generator |

### Commercial

| Claim | Reality |
|---|---|
| Per-user or per-role pricing | **Never.** Company-level only |
| The default plan prices | ₹1,499 / ₹3,999 / ₹11,999 are **seeded defaults**, editable in the UI. Confirm commercial terms before quoting |
| Online payment / auto-renewal | Handled master-side, not by a gateway in the app |
| Custom branding per company | Not verified |

---

## 6. 🚫 Screens That Exist But Cannot Be Opened

**46 files are never imported.** Never demo, screenshot or describe these:

| File | Size | Why it matters |
|---|---|---|
| `Trainee360Screen.tsx` | 838 L | Looks like a complete trainee profile. **No route.** Tempting and dangerous |
| `SODashboard.tsx` | 259 L | Both SO routes render `SOInspectionHub` instead |
| `SOInspectionsScreen.tsx` | 516 L | Same |
| `AdminDashboard.tsx` | — | Unrouted |
| 13 × `aiAgent/*` | — | Of 28 aiAgent files, 13 are orphans |
| `services/pdf.service.ts` | — | Source of the false "PDF export" claim |
| `services/fcm.service.ts` | — | Source of the false "push notifications" claim |
| `services/csvImport.service.ts` | — | Source of the false "bulk import" claim |
| `services/audit.service.ts` | — | Superseded by `auditLog.service.ts` |

**Rule:** if you cannot navigate to it in the running app, it does not exist
for presentation purposes.

---

## 7. Previously Unverified Routes — now CONFIRMED

All ten routes that carried the *UI PRESENT — END-TO-END NOT VERIFIED* label
have been traced. Every one has a dedicated Firestore collection and a
complete API layer. **None was a stub.**

| Route | Collection | Verdict |
|---|---|---|
| `/final-board` | `finalResults` | ⭐ **CONFIRMED — demo-worthy** |
| `/welfare-demographics` | trainee data + festival calendar | ⭐ **CONFIRMED — demo-worthy** |
| `/mismatch-dashboard` | derived (engine) | ⭐ **CONFIRMED — demo-worthy** |
| `/period-attendance` | `periodAttendance` | **CONFIRMED** |
| `/discipline-register` | `disciplineRecords` | **CONFIRMED** |
| `/joining-workflow` | `joiningRecords` | **CONFIRMED** |
| `/movement-register` | `movementRecords` | **CONFIRMED** |
| `/clearance` | `clearanceRecords` | **CONFIRMED** |
| `/training-sessions` | sessions | **CONFIRMED** |
| `/syllabus-tracking` | `trainingSyllabus` | **CONFIRMED (basic)** |

**Full detail: `modules/15-registers-and-lifecycle.md`**, including new
"Do NOT Promise" items for each.

**Three notable finds from this pass:**

1. **Final Board computes the course result automatically** from
   `training_tests` + `absentRecords` — percentage, subject-wise scores,
   FPT result, firing classification, attendance %, grade band, and a
   **Fit for Duty / Conditional / Unfit** recommendation. The write→read
   chain from `/test-records` is verified.
2. **A Festival Planner** with a 41-entry 2026–27 calendar that matches
   festivals to trainees by religion and home state, with welfare notes and
   a 90-day lookahead.
3. **The Mismatch Dashboard runs 15+ data-integrity checks**, including
   duplicate chest and regimental numbers, each with a suggested fix.

**Remaining unverified:** none of the previously listed routes. The only
outstanding verification gap is the Firestore rules audit (§10.3).

---

## 8. ⚠️ Known Issues — check before any live demo

| # | Issue | Impact | Action |
|---|---|---|---|
| 1 | **`/ustad` is a 20-line placeholder** reading "Weekly Training Program Will Be Displayed Here" | An Ustad's landing screen is empty | **Never open `/ustad` in a demo.** Show `/training-schedule`, `/staff-attendance`, `/duty-management` instead |
| 2 | **Legacy relegation tab bug** — `remainingSubjects` is saved as a comma-string but read as a list, which can blank the tab | White screen risk on camera | **Do not open the Relegation tab inside `/trainee-management`.** Use `/relegation` |
| 3 | **Firestore rules have never been deployed by the owner** | Trainee-visible data (Today Special, files, notices) may appear empty for a trainee login | **Deploy rules before any demo involving a trainee login.** See §9 |
| 4 | Two relegation implementations coexist | Confusion | `features/relegation/*` is authoritative; the `traineeModule` one is legacy read-only |
| 5 | Three parallel audit systems | Audit coverage is not universal | Phrase audit claims narrowly (§5) |
| 6 | Availability engine `src/features/shared/availability.ts` exists but is **not wired** into the CC/Clerk dashboards | A built capability is not visible | Do not present it as a feature |
| 7 | AI depends on an external provider with rate limits | Live demo can fail | Demo AI **last**; keep screenshots |

---

## 9. Pre-Demo Checklist

**Technical**
- [ ] **Deploy Firestore and Storage rules** — issue #3 above
- [ ] All role logins tested **today**, not last week
- [ ] Network verified at the venue
- [ ] AI questions rehearsed; screenshots saved as backup

**Data**
- [ ] At least one **pending trainee report** waiting for the Clerk
- [ ] At least one **pending staff leave** waiting for the Commander
- [ ] At least one **open inspection finding** assigned to the QM
- [ ] Trainees with varied states — present, sick, docs pending, FPT failed
- [ ] Some fund entries with **Pending** bills and a **Partial** vendor payment
- [ ] Kit stock with at least one **LOW STOCK** item

**Discipline**
- [ ] Read the **Do NOT Promise** section of every module you plan to show
- [ ] Know your three WOW features for this specific audience
- [ ] `/ustad` and the legacy relegation tab are off-limits

---

## 10. Confidence Statement

**What this package gets right:** every feature described as working was
traced in code. Every formula, status list, subject list and constant was
read from the file that defines it. Every module ends with an explicit list
of what must not be claimed.

**Where it is weakest:**
1. ~~Ten routes are marked UI PRESENT — NOT VERIFIED.~~ **Resolved in the
   follow-up pass — all ten are confirmed (§7).**
2. Audit coverage was assessed by sampling call sites, not exhaustively.
3. Firestore security rules were **not** line-by-line audited. The claim
   "the database enforces this" rests on the app's own layered design and
   the comments in `permissions.ts`. **An independent rules audit is
   recommended before making strong security claims to a security-conscious
   buyer.**
4. Nothing here was verified against a **running** instance with real data —
   this is a code audit, not a QA pass.

**What that means for you:** present the CONFIRMED items with full
confidence. Present PARTIAL items with their caveats attached. Never present
NOT VERIFIED items at all.

---

## 11. Maintenance

This package describes the code as of **2026-09-04**, branch
`arena/01a06802-fcoy`.

**Re-audit when:** a module is significantly changed, a new route is added,
an orphan file is wired up, or any known issue in §8 is fixed.

**When you fix something in §8**, update the module document, this audit,
and — if it changes what you can safely demo — `02-SLIDES.md`.

**The one rule that keeps this package valuable:** documentation that
overstates the product is worse than no documentation, because it converts
a careful team into an unreliable one. If you are unsure whether something
works, the correct entry is **NOT VERIFIED**.
