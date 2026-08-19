# AI CONTEXT — BSF TRAINING COMMAND ERP (F COY)

> Ye file AI assistants / naye developers ke liye single-read context hai.
> Updated: August 2026 (production-hardened build).
> Detail ke liye padhein: ERP_MASTER_CONTEXT.md, PROJECT_STATUS.md,
> CLERK_BLUEPRINT.md, COMMANDER_BLUEPRINT.md, QM_BLUEPRINT.md.

---

## SYSTEM KYA HAI

Single BSF Training Company ERP (React + TS + Tailwind + Firebase).
Master app = F Coy (`training-command-erp`) — OWNER ki apni app.
Company apps (A Coy = `fcoy-erp-bcoy`...) = alag Firebase projects,
customers ko bechi jaati hain, master ke Owner Panel se manage hoti hain.

Uploads (photos/documents) = **Cloudinary** (Firebase Storage NAHI —
Blaze/card avoid karne ke liye). URLs Firestore me save hote hain.

---

## LOCKED BUSINESS RULES (kabhi mat todna)

1. **Batch create/activate = SIRF Company Commander** (Clerk nahi)
2. **Chest Number registration me OPTIONAL** — baad me assign hota hai;
   assign par batch-unique + audited (chestAssignedAt/By)
3. Trainee identity: Firestore docId (internal) → regNo (admin) →
   chestNo (operational)
4. Clerk ↛ finance/inventory (DB rules read tak deny)
5. QM ↛ trainee personal data (onlyKeys: sirf kit fields)
6. Ustad = training info only
7. Medical history kabhi hard-delete nahi — Void/Corrected
8. Koi hardcoded items/categories nahi — qmCatalog.ts + dynamic collections
9. Subscription: master app NEVER locks; company apps binary lock
   (active ya locked — **NO grace period**)
10. Har naya field backward-compatible (old docs valid rehne chahiye)

---

## ROLES (firestore.rules me enforced)

| Role | Access |
|---|---|
| Company Commander | Sab kuch + users/settings/batch + catch-all |
| Clerk | Trainees/docs/medical/absent/weekly/staff-admin/welfare |
| Quarter Master | Inventory/issue/4-funds/vendors/bills/recovery/salary + trainee kit-fields only |
| Ustad | Read training data + own leave; dashboard `/ustad` |
| isDeveloper | Master sandbox + Owner Panel (`/dev-practice`), sub-free |
| Sync bridge (`owner-sync.*@fcoy-erp.internal`) | Sirf subscription push + monitor counts read |

Legacy role strings (cc/qm/clerk/instructor) supported.

---

## KEY SCREENS / ROUTES

| Route | Kya hai |
|---|---|
| /commander | CC Command Center (strength strip, collapsible sections, roster) |
| /clerk | Clerk Operational Command Center |
| /quartermaster | QM Command Center (Live Stock Position + shortage) |
| /ustad | Ustad Today's Training Command Center |
| /trainees | Trainee List — full batch, name search, inline chest assign |
| /profile | Trainee registration/profile/edit + Full Dossier report |
| /documents | Document Cell (Cloudinary + audit trail) |
| /medical-register | Medical (Void, no delete) |
| /absent-management | Daily tracking (attn = source of truth) |
| /weekly-program | Weekly programme + A4 print |
| /batches | Batch mgmt (CC-only create) |
| /users | User mgmt (create/password/full-delete/repair — in-app) |
| /reports | Role-scoped report center |
| /dev-practice | Owner Admin Panel (customers/sync/monitor/practice) |

---

## CRITICAL IMPLEMENTATION FACTS

* **Atomic writes**: registration+batch counter, kit issue+record,
  medical+trainee status, batch create+archive+config — writeBatch/txn
* **Stock formula**: purchased(training_fund_expenses) − issued(issue_records)
* **Fund balance**: collection − actuallyPaid − transferredOut
* **attn field** = presence ka single source of truth ('P' = present;
  return flows attn='P' set karte hain)
* **Batch numbering**: max(sequence)+1 (count-based nahi)
* Dev data sirf `isDevData: true` tag se pehchana jata hai (name-based
  deletion REMOVED — kabhi wapas mat lana)
* Rules testing: `npm run test:rules` (emulator, 47 checks)
* Scripts: typecheck / lint / build / test:rules;
  deploy/ me Deploy-Company, Update-AllApps, Reset-Password (owner)

---

## AI AGENT (master-only, CC route)

Local ERP query engine + Groq/Gemini fallback (keys .env me, rotation).
collectionRegistry.ts me collections ka schema-knowledge. Pinecone
optional (default off). Detail: AI_AGENT_BLUEPRINT.md.

---

## JO NAHI KARNA (common mistakes)

* Chest Number ko registration me mandatory mat banao
* firestore.rules me global signedIn() fallback wapas mat lao
* Firebase Storage par shift mat karo (Cloudinary hi use hota hai)
* Grace period wapas mat lao (binary lock final hai)
* Master app par subscription lock mat lagao
* collection/field names casually rename mat karo — pehle saare usages
* Medical records delete mat karo — Void karo
* Hardcoded item/category lists mat banao
