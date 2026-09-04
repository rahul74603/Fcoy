# Documentation Progress

## Overall Status

**BATCH 6 COMPLETE — WAITING FOR USER CONFIRMATION (YES / OK / NEXT)**

Batches 1–5 confirmed by user and closed.

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

---

## Current Batch

**Batch 6 — AI, Audit & Company/Master Side** (complete)

1. AI agent module
2. Lekha-Jokha Register & Today Special module
3. Company setup, users, settings & subscription module

*Batch 1 — Foundation: complete.*
*Batch 2 — Catalog, roles, CC dashboard: complete.*
*Batch 3 — Leave, personnel, notifications: complete.*
*Batch 4 — QM/inventory, finance, reports: complete.*
*Batch 5 — Training delivery, staff/duty, inspections: complete.*

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

**Batch 7 — The Presentation Layer** (all module docs are now done)

1. `presentation/06-WOW-FEATURES.md` — the ranked highlight reel drawn from
   every module written so far
2. `presentation/07-SMART-DETAILS.md` — the small touches that signal care
   (Hindi labels, empty states, IST date handling, UTF-8 BOM, ESC to close,
   deactivate-don't-delete, honest banners)
3. `presentation/05-WORKFLOW-CATALOG.md` — end-to-end workflows in the
   USER → SCREEN → ACTION → SYSTEM RESPONSE → STATUS CHANGE → NEXT ROLE →
   FINAL RESULT format

Then **Batch 8 (final)**: `presentation/02-SLIDES.md` and
`presentation/99-DOCUMENTATION-AUDIT.md`.

No new code inspection required — Batch 7 is synthesis of the 13 module
documents already written.

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

2026-09-04 — Batch 6 complete (AI agent, audit/today, company/master)
