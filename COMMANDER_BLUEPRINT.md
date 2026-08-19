# COMPANY COMMANDER BLUEPRINT (Updated — August 2026)

## Role

Company Commander = highest operational authority. Sab modules ka access
(DB-rules level par bhi). Catch-all rule ke through legacy collections
bhi sirf CC ko milte hain.

---

## Exclusive Rights (sirf CC)

* **Batch create / activate / complete** — transaction-safe (duplicate
  batch number concurrency me bhi impossible), numbering `max(seq)+1`
* User Management (`/users`):
  - Staff create (secondary auth session — CC ka login safe rehta hai)
  - **Change Password** (in-app, current password se — no Console)
  - **Full Delete** (Auth account + profile दोनों — no orphans)
  - **Repair Login** ("Profile missing" orphan accounts ka in-app fix)
  - Activate/Deactivate (normal lifecycle — delete rare)
* Settings (`/settings`), unitConfig/letterhead
* AI Agent (`/ai-agent`)
* Owner Admin Panel (`/dev-practice` — sirf isDeveloper accounts):
  Customers, Subscriptions sync, Company Monitor, Test Batch, Practice

---

## Commander Dashboard (`/commander`) — F COY COMMAND CENTER

Sab sections **collapsible** (header click → hide/show, space control):

1. **Company Strength Strip**: Total / Available(% bar) / Hospital /
   Leave / Light Duty / Absent / Attention count — har cell clickable →
   filtered roster
2. Company Information Board (full Welfare Demographics explorer —
   State/Religion/Language/Zone + filters + festival planner + roster)
3. Batch Progress Overview (default collapsed)
4. **Trainees Not On Field** — ~7 rows visible phir scroll, sticky
   header; `attn` = presence ka source of truth (return karte hi list
   se hat jata hai)
5. Platoon-wise Live Strength (per-platoon % bars)
6. Full Trainee Roster (filters: platoon/status/kit/docs/FPT/recovery,
   search, health score, profile modal)
7. Funds & Financial Overview (4 funds + transfers + detail modal)
8. Training Schedule (today + tomorrow, instructors)
9. Commander Attention Board (FPT fails, test fails, docs, kit,
   recovery, vendor dues panels)
10. Staff Management stats · Today's Instructors · All Modules access

---

## Permissions (DB-enforced)

View + manage: trainees, batches, documents, medical, weekly programme,
inventory, issues, all 4 funds, vendors, bills, recoveries, salary,
staff module, subjects, schedule, tests, reports, users, settings,
subscription (master).

---

## Reports (`/reports`)

CC ko saari categories: Trainee Management, Inventory/QM,
Finance (4 funds), Training Performance, Staff Management.
Print signature block: Prepared By / Checked-Verified By / Approved By (CC).
