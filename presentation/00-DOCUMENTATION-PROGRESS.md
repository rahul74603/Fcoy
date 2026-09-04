# Documentation Progress

## Overall Status

# ✅ DOCUMENTATION PACKAGE COMPLETE

**All 8 batches done, plus a follow-up verification pass. 23 files, ~6,900 lines.**

**Follow-up pass (2026-09-04):** the 10 routes previously marked
*UI PRESENT — END-TO-END NOT VERIFIED* were traced. **All 10 are confirmed
working modules** — see `modules/15-registers-and-lifecycle.md`. Labels
updated in `09-training-delivery.md` §7 and `99-DOCUMENTATION-AUDIT.md` §7;
three new demo options added to `06-WOW-FEATURES.md` and `02-SLIDES.md`.

Start here: `99-DOCUMENTATION-AUDIT.md` (what is safe to claim), then
`02-SLIDES.md` (the deck) and `01-PRESENTATION-ROADMAP.md` (demo prep).

---

## Completed Files

- [x] `presentation/00-DOCUMENTATION-PROGRESS.md` — this tracker
- [x] `presentation/01-PROJECT-OVERVIEW.md` — what FCOY is, module map, tech reality, verification legend
- [x] `presentation/01-PRESENTATION-ROADMAP.md` — full presentation flow, slide order, timing, demo prerequisites
- [x] `presentation/03-FEATURE-CATALOG.md` — 45 features, P0×7 / P1×13 / P2×20 / P3×5, plus a "never promise" table
- [x] `presentation/04-ROLE-MATRIX.md` — role × screen access grid, per-role notes, security story
- [x] `presentation/modules/02-cc-dashboard.md` — Commander dashboard deep dive (health score, 5 alert streams, 11 filters)
- [x] `presentation/modules/03-leave-management.md` — BOTH leave systems (staff + trainee), triple-guard, auto-attendance
- [x] `presentation/modules/04-personnel-trainees.md` — trainee reporting cascade, documents, medical, absence, relegation
- [x] `presentation/modules/05-notifications.md` — 7 derived sources, deep links, per-device read-state caveat
- [x] `presentation/modules/06-quartermaster-inventory.md` — inventory hub, 15 kit items, atomic stock transaction
- [x] `presentation/modules/07-finance-funds.md` — 4 funds, orders-vs-paid distinction, bill statuses, vendors
- [x] `presentation/modules/08-reports.md` — 20 reports, CSV+print, UTF-8 BOM Hindi detail
- [x] `presentation/modules/09-training-delivery.md` — 33 BSF subjects, 7 FPT events, 11 test types
- [x] `presentation/modules/10-staff-duty.md` — staff master, duty availability checker, auto-attendance chain, deputation
- [x] `presentation/modules/11-inspections.md` — 5-stage finding lifecycle, authorisation rules, compliance score
- [x] `presentation/modules/12-ai-agent.md` — 31 tools, 6 safety guards, 20 blocked collections
- [x] `presentation/modules/13-audit-today.md` — Lekha-Jokha Register + Today Special daily feed
- [x] `presentation/modules/14-company-master.md` — users, settings, subscription (COMPANY-LEVEL ONLY), master tools
- [x] `presentation/06-WOW-FEATURES.md` — top 10 ranked highlight reel + audience selection guide
- [x] `presentation/07-SMART-DETAILS.md` — 11 categories of polish that signal care
- [x] `presentation/05-WORKFLOW-CATALOG.md` — 8 end-to-end workflows in USER→SCREEN→ACTION→…→FINAL RESULT format
- [x] `presentation/02-SLIDES.md` — 24-slide deck with on-slide text + speaker notes + presenter's card
- [x] `presentation/99-DOCUMENTATION-AUDIT.md` — self-audit, consolidated never-promise list, orphan screens, known issues
- [x] `presentation/98-SECURITY-RULES-AUDIT.md` — full read of firestore.rules + storage.rules; 0 coverage gaps, but never deployed
- [x] `presentation/modules/15-registers-and-lifecycle.md` — the 10 traced registers (Final Board, Festival Planner, Mismatch Dashboard + 7 more)

---

## Current Batch

**Batch 8 — FINAL** (complete)

1. The slide deck
2. The documentation audit

*All 8 batches complete. Nothing pending.*

*Batch 1 — Foundation: complete.*
*Batch 2 — Catalog, roles, CC dashboard: complete.*
*Batch 3 — Leave, personnel, notifications: complete.*
*Batch 4 — QM/inventory, finance, reports: complete.*
*Batch 5 — Training delivery, staff/duty, inspections: complete.*
*Batch 6 — AI, audit/today, company/master: complete.*
*Batch 7 — WOW features, smart details, workflow catalog: complete.*

---

## Pending Files

- [ ] `presentation/05-WORKFLOW-CATALOG.md`
- [ ] `presentation/06-WOW-FEATURES.md`
- [ ] `presentation/07-SMART-DETAILS.md`
- [ ] `presentation/02-SLIDES.md`
- [ ] `presentation/modules/01-authentication.md`
- [ ] `presentation/modules/03-personnel-staff.md`
- [ ] `presentation/modules/04-leave-management.md`
- [ ] `presentation/modules/05-notifications.md`
- [ ] `presentation/modules/06-qm-inventory.md`
- [ ] `presentation/modules/07-finance-funds.md`
- [ ] `presentation/modules/08-ustad.md`
- [ ] `presentation/modules/09-inspections-findings.md`
- [ ] `presentation/modules/10-trainee-module.md`
- [ ] `presentation/modules/11-ai-agent.md`
- [ ] `presentation/modules/12-subscription.md`
- [ ] `presentation/modules/13-developer-master.md`
- [ ] `presentation/modules/14-today-special-audit.md`
- [ ] `presentation/99-DOCUMENTATION-AUDIT.md`

> Note: the final module file list will be adjusted as inspection continues.
> Files are created only for modules that actually exist in code.

---

## Modules Inspected (Batch 1)

Inspection so far was **breadth-first** — enough to build an accurate map.
Deep inspection happens in the batch that documents each module.

| Area | Depth | Notes |
|---|---|---|
| `src/App.tsx` (routing) | **Deep** | All 61 routes + role guards extracted |
| `src/config/permissions.ts` | **Deep** | Central UI permission policy read in full |
| `src/contexts/AuthContext.tsx` | Medium | Role normalisation, `isDeveloper`, live profile listener |
| `src/contexts/SubscriptionContext.tsx` | **Deep** | Read in full — unit vs customer subscription resolution |
| `src/features/notifications/*` | **Deep** | All 7 notification sources + types + click behaviour |
| `src/features/inspection/*` | Medium | Finding status lifecycle confirmed |
| `src/features/aiAgent/engine/tools.ts` | Medium | 30 tool names extracted |
| `src/features/ustad/hooks/useLeave.ts` | Medium | Approval authority guards confirmed |
| `src/features/dashboard/CompanyCommanderDashboard.tsx` | Shallow | Section titles only — deep dive pending |
| All `src/features/*` | Shallow | File/line counts collected for module map |

---

## Roles Inspected

Confirmed from `src/App.tsx` role constants + `src/config/permissions.ts`:

- [x] Company Commander — confirmed
- [x] Clerk — confirmed
- [x] Quarter Master — confirmed
- [x] Ustad — confirmed
- [x] Senior Officer / Inspector — confirmed (`SO_ROLES`)
- [x] Trainee / Trainee Senior — confirmed (separate portal, not in staff role constants)
- [x] Developer / Master — confirmed as a **flag** (`isDeveloper`), not a role string

Deep per-role documentation is pending (Batch 2, `04-ROLE-MATRIX.md`).

---

## Workflows Inspected

- [x] Leave apply → CC approve/reject (authority guards confirmed)
- [x] Inspection → finding → corrective action → verify → close (status values confirmed)
- [x] Trainee report → clerk approval → absent/MI/notice sync
- [x] Notification generation (derived, not stored)
- [ ] Inventory issue → ledger — not yet traced
- [ ] Finance expense → vendor payment — not yet traced
- [ ] Joining / clearance / relegation — not yet traced
- [ ] Company onboarding / first-run — not yet traced

---

## Important Discoveries

1. **Subscription is MASTER-only and OFF by default.**
   `SUBSCRIPTION_ENABLED` comes from `VITE_SUBSCRIPTION_ENABLED === 'true'`.
   In normal company deployments the flag is unset, so `/subscription` and
   `/company-monitor` **redirect to `/login`** and their sidebar links are
   hidden. This must be presented honestly — it is a master/vendor-side
   control panel, not a per-company billing screen.

2. **Notifications are DERIVED, not stored.**
   There is no `notifications` collection being written by the app.
   `useNotifications.ts` computes them live from 7 real data sources
   (pending leave, returning soon, today's duties, staff in hospital,
   upcoming schedules, active deputations, pending trainee reports).
   Read/unread state is kept in **localStorage** (`bsf_read_notifications`),
   so it is per-device, not per-user-account.

3. **Leave approval authority is triple-guarded** — UI affordance,
   handler guard in `useLeave.ts`, and Firestore rules on the
   `LEAVE_APPROVAL_FIELDS`. Excellent security talking point.

4. **AI agent is a real tool-calling agent, not a chatbot.**
   30 tools registered in `engine/tools.ts`, including **write** tools
   (`add_trainee`, `record_expense`, `issue_inventory`, `create_finding`,
   `submit_corrective_action`, `verify_finding`, `update_record`,
   `delete_record`). Access restricted to Company Commander only.

5. **AI secrets are server-side.** Per `.env.example`, production AI keys
   live in Firebase Cloud Functions secrets; the browser calls callable
   functions and never sees the keys. Good security talking point.

6. **Two "SO" screen generations coexist.** `SOInspectionHub` is the live
   screen serving both `/so-dashboard` and `/so-inspections`.
   `SODashboard.tsx` and `SOInspectionsScreen.tsx` are older, now-unwired
   files. Do not demo or document the old two.

7. **Trainee portal is a separate experience.** `/trainee-dashboard` and
   `/today` are the only feature routes with no `allowedRoles` guard — any
   signed-in user including trainees. Trainees do not use the staff sidebar.

8. **Module weight ranking** (by lines of code) gives a good sense of where
   the real product depth is: `ustad` (18.4k) > `aiAgent` (8.9k) >
   `dashboard` (6.2k) > `finance` (6.0k) > `students` (5.0k).

---

## Partial Features

To be confirmed with deeper inspection in later batches:

- `/purchase` route is a **redirect to `/funds`** — not a real purchase screen.
- `SODashboard.tsx` / `SOInspectionsScreen.tsx` — files exist but are not routed.
- 46 orphan files exist in the codebase (never imported). See
  `AUDIT-HISTORY.md` in repo root. These must **not** be presented as features.

---

## Unverified Features

Nothing has been documented as working without code evidence yet.
Anything not yet traced is listed under "Workflows Inspected" as unchecked.

---

## Next Batch

**None — the package is complete.**

Re-audit only when the code changes. See `99-DOCUMENTATION-AUDIT.md` §11
for when and how.

Highest-value follow-up work, if anyone wants to continue:
1. ~~Trace the 10 unverified routes~~ — **DONE (follow-up pass)**
2. ~~An independent audit of `firestore.rules`~~ — **DONE**, see
   `98-SECURITY-RULES-AUDIT.md`
3. ~~Fix the `/ustad` placeholder and the legacy relegation bug~~ — **DONE
   2026-09-04.** `/ustad` is now a real read-only dashboard; the relegation
   `remainingSubjects` crash was already fixed by the `asList()` helper and
   was re-verified. This was the only pass that changed app code.

---

## Verification Legend Used In All Files

| Tag | Meaning |
|---|---|
| **CONFIRMED** | Traced in code end-to-end |
| **PARTIAL** | Implemented but incomplete or with caveats |
| **UI PRESENT — END-TO-END NOT VERIFIED** | Screen exists, full effect not traced |
| **NOT VERIFIED** | Could not be confirmed — do not present as working |

---

## Last Updated

2026-09-04 — Batch 8 complete. PACKAGE FINISHED.
