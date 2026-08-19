# PROJECT STATUS — BSF TRAINING COMMAND ERP (F COY)

Last Updated: August 2026

Current Phase: **PRODUCTION-HARDENED — READY FOR STAGING/INTERNAL USE**

(Purana "v0.1 Alpha / Not Production Ready" status obsolete hai.)

---

# COMPLETED ✅

## Security Hardening
- Role-based `firestore.rules` — 54+ collections explicit, global
  authenticated fallback removed, catch-all CC-only
- QM trainee updates `onlyKeys` (kit fields only); finance collections
  Clerk/Ustad ke liye read tak denied
- Batch create/activate CC-only (context + DB दोनों level par)
- Sync-bridge identity (`owner-sync.*@fcoy-erp.internal`) strictly scoped
- Emulator security suite: `npm run test:rules` — 47/47 passing
- Inactive-user lockout, role self-escalation blocked

## Clerk Module
- Trainee Registration (chest OPTIONAL, regNo duplicate-check,
  sensitive fields bina default ke — "— Select —")
- **Trainee List** (`/trainees`): full batch ek saath, naam/partial
  search, photo column, Chest Pending/Assigned tabs, inline chest
  assign (uniqueness + audit), row-level Full Report
- Trainee Profile: search + deep-link (`/profile?search=`), edit,
  photo (Cloudinary + legacy base64), **Full Dossier report** (10
  sections: personal→kit→medical→absent→FPT→tests→recovery→documents)
- Document Cell: Cloudinary uploads, audit trail (uploadedBy/verifiedBy/
  rejectedBy/rejectionReason), no fake-success on failure
- Medical Register: Void/Corrected (no hard delete), atomic status sync
- Absent/Leave management, Weekly Programme, Welfare Demographics
- **Clerk Dashboard**: Operational Command Center (strength strip,
  Needs Attention hero, today's program, document control, medical &
  availability, pending work, recent activity, quick search)

## Quarter Master Module
- Inventory + Kit Issue (atomic writeBatch), centralized item master
  (`qmCatalog.ts` + dynamic custom items)
- 4 Funds (Mess/Training/Assets/General), transfers, vendors, bills,
  recoveries, mess boy salary
- **QM Dashboard**: Command Center — Needs Attention (negative funds/
  vendor dues/shortage forecast), Kit Coverage panel, **Live Stock
  Position** (Purchased/Issued/Available/Required/Shortage per item),
  today's money strip, grand totals, fund cards, recent activity

## Commander Module
- **CC Dashboard**: Command Center — Company Strength Strip (clickable),
  collapsible sections everywhere, Not-On-Field roster (7-row scroll,
  attn = source of truth), platoon board, full roster w/ filters,
  funds, training schedule, attention board, staff stats
- Company Information Board = full Welfare Demographics explorer
- User Management: create staff, **Change Password / Full Delete /
  Repair Login** — sab in-app (Firebase Console ki zaroorat nahi)
- Batch Management: CC-only, transaction-safe, max+1 numbering,
  isDevData-only dev-batch deletion (name-based deletion REMOVED)

## Ustad Module
- **Ustad Dashboard** (`/ustad`): Today's Training Command Center —
  status cards, NOW/NEXT session highlight, today's schedule,
  attention items, strength bars, upcoming days, quick actions
- Staff/Leave/Schedule/Tests/Batch Progress screens
- Sidebar/search/notifications role-aligned (no ACCESS DENIED links)

## Reports
- Role-scoped categories (Clerk/Ustad ko finance nahi — UI + DB)
- Per-type verifier label (QM sirf inventory/finance reports par)
- Trainee Full Dossier printable report

## Storage / Uploads
- **Cloudinary** (`src/services/cloudinary.ts`) — photos + documents.
  Free, no card. Fallback: photo base64. Firebase Storage NOT used.

## Subscription (FINAL)
- **No grace period** — active ya locked, bas
- Master app: never locks (all roles free)
- Company apps: lock enforced; renew via master sync bridge

## Infra / Tooling
- GitHub Actions: typecheck → build → deploy (main push)
- `deploy/` scripts: Deploy-Company, New-CompanyApp, Update-AllApps,
  **Reset-Password** (owner tool)
- npm scripts: `typecheck`, `lint`, `test:rules`

---

# KNOWN REMAINING ITEMS 🔶

1. Storage rules deployed nahi (bucket hi nahi — Cloudinary use hota
   hai). Cloudinary file DELETE client se possible nahi (unsigned) —
   sirf Firestore reference hatta hai.
2. AI Agent keys (Groq/Gemini) client bundle me hain — quota risk,
   proxy recommended (future).
3. Chest uniqueness DB-rules level par nahi (app-level check) —
   current trust model me acceptable.
4. First-run wizard trust boundary client-side (rules firstRun ke baad
   self-provisioning band kar deti hain).
5. Weekly Programme subjects/areas constants hardcoded (working —
   dynamic masters future me agar business ko chahiye).

---

# DATABASE COLLECTIONS (ACTUAL — sab implemented)

users, batches, trainees, config, unitConfig,
weeklyPrograms, medicalRecords, absentRecords, udhariRecords,
fptRecords, weeklyTestRecords, training_tests,
issue_records, item_master, training_custom_items,
mess_fund_collections/expenses, training_fund_collections/expenses/
recoveries, company_assets_collections/expenses/custom_items,
general_fund_collections/expenses, fund_transfers,
vendors, vendor_entries, vendor_payments, bills,
mess_boys, mess_boy_salaries, mess_custom_categories,
staff, staff_subjects, staff_attendance, staff_duty, staff_leave,
leave_types, duty_types, deputation_records, staff_activity_logs,
subject_master, training_schedule, batch_progress,
subscription, subscriptionPlans, subscriptionHistory,
customers, customerSubscriptions, devTools, activity_logs
(+ legacy: collections, expenses, recoveries)

---

# IMPORTANT BUSINESS RULES (LOCKED)

1. Chest Number = operational identity; registration me OPTIONAL,
   baad me assign (unique per batch + audited)
2. Registration Number = permanent admin ID (duplicate-checked)
3. Batch create/activate = SIRF Company Commander
4. Clerk ↛ finance/inventory (DB-enforced)
5. QM ↛ trainee personal data (kit fields only)
6. Ustad = training info only
7. Koi hardcoded items/categories nahi — dynamic masters
8. Medical history kabhi delete nahi — Void/Corrected
9. Subscription: master free hamesha; company apps binary lock (no grace)
10. Har company = alag Firebase project, data isolation total

---

# VERSION

Production-hardened build · August 2026
Branch of record: see git history (arena/* working branches → main)
