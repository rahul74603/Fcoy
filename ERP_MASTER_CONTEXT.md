# BSF TRAINING COMMAND ERP — MASTER PROJECT CONTEXT

Last Updated: August 2026 (production-hardened build)

---

## Project Purpose

Single BSF Training Company ka complete ERP. Master deployment = **F Coy**
(`training-command-erp`). Har company ki apni **alag Firebase project +
alag app** hoti hai — koi cross-company data sharing nahi.

Master app OWNER ki apni app hai. Company apps (A Coy = `fcoy-erp-bcoy`,
etc.) customers ko bechi jaati hain aur master ke Owner Admin Panel se
manage hoti hain (subscription sync bridge ke through).

---

## Technology Stack

* Frontend: React 18 + TypeScript + Tailwind CSS + lucide-react
* Backend: Firebase (Firestore + Authentication)
* File Storage: **Cloudinary** (free tier, unsigned upload preset) —
  Firebase Storage NAHI use hota (Blaze/card requirement ki wajah se).
  Photos + documents Cloudinary par, URLs Firestore me.
* Hosting: Firebase Hosting (GitHub Actions auto-deploy on `main` push)
* Build: Vite · Checks: `npm run typecheck` / `npm run build`

---

## Trainee Identity (3-layer — FINAL)

1. **Firestore Document ID** — stable internal identity (sab references)
2. **Registration Number (regNo)** — permanent administrative ID,
   duplicate-checked at registration
3. **Chest Number (chestNo)** — operational identity.
   ⚠️ **Registration ke waqt OPTIONAL** (naye trainees pehle aate hain,
   chest numbers baad me allot hote hain). Assign hone par:
   * Batch ke andar UNIQUE (duplicate check registration + edit दोनों par)
   * Audit: `chestAssignedAt` + `chestAssignedBy`
   * Trainee List (`/trainees`) se inline assign hota hai
   * Clerk Dashboard par "Chest Pending" card/count

---

## User Roles (DB-enforced — firestore.rules)

### 1. Company Commander (CC)
Full authorized access. Batch create/activate SIRF CC karta hai.
User Management (create/password-change/full-delete/repair — sab app ke
andar, Firebase Console ki zaroorat nahi). Reports, Settings, sab modules.

### 2. Clerk
Trainee administration: registration (chest optional), profile edit,
Trainee List, documents (upload/verify/reject + audit trail), medical
register (Void — history kabhi delete nahi hoti), absent/leave, weekly
programme, staff (Ustad) admin, welfare demographics.
❌ Finance/Inventory — **DB rules read tak deny karti hain**.
❌ Batch create nahi (sirf totalTrainees counter update allowed).

### 3. Quarter Master (QM)
Inventory, kit issue (atomic: trainee + issue_record ek writeBatch me),
4 Funds (Mess/Training/Assets/General), vendors, bills, recoveries,
mess boy salary.
✅ Trainee par sirf kit fields update (`issuedKitItems`, `kitIssued`,
`pendingRecoveryAmount`, sizes...) — `onlyKeys` rule se enforced.
❌ Trainee personal data (name/aadhaar/address/documents) modify nahi.
❌ Batch create nahi.

### 4. Ustad (Instructor)
Read: trainees, staff, subjects, training schedule. Own leave apply.
Ustad Dashboard (`/ustad`) = Today's Training Command Center.
❌ Finance, documents, users, batch, subject master, attendance-marking,
duty, deputation — routes bhi denied, links bhi hidden.

### Dev/Owner account (`isDeveloper: true`)
Master app ka sandbox account. Practice mode (isDevData-tagged data),
Owner Admin Panel (`/dev-practice`), subscription-free.

Legacy role spellings (`cc`, `qm`, `clerk`, `instructor`) rules +
AuthContext dono me supported.

---

## Subscription Model (FINAL — NO GRACE)

* **Master app**: subscription lock KABHI nahi — CC/QM/Clerk/Ustad koi
  bhi account, hamesha khuli. Owner tools (Customers/Sync/Monitor) ON.
* **Company apps**: binary lock — plan ACTIVE → app chalegi;
  none/expired → **turant FULL LOCK**. Koi grace period NAHI.
* Renew: master Owner Panel se → sync bridge
  (`owner-sync.<code>@fcoy-erp.internal`) company project me
  subscription/current push karta hai. Bridge ka scope rules me strictly
  limited hai (sirf subscription collections write + monitor counts read).

---

## Security (production-hardened)

* `firestore.rules`: har collection (54+) ke explicit role-based rules.
  Global authenticated fallback REMOVED — catch-all ab CC-only.
* Role hamesha trusted `users/{uid}` doc se — client input kabhi nahi.
* Document ID = Auth UID (users collection ka rule). "Profile missing"
  wale orphan accounts CC khud **User Management → Repair Login** se
  theek karta hai.
* Inactive users (`isActive: false`) har jagah denied.
* Emulator test suite: `npm run test:rules` (47 checks — Section-49
  security matrix). Deploy se pehle chalana.
* `storage.rules` repo me hai par Firebase Storage bucket set up nahi
  (Cloudinary use hota hai) — deploy optional.

---

## Development Rules

* Koi hardcoded items/expenses/recoveries/categories nahi — QM item
  master `src/features/quartermaster/qmCatalog.ts` (single source of
  truth) + `training_custom_items` collection.
* Multi-step writes atomic (writeBatch/transaction): registration+counter,
  kit issue+record, medical+trainee status, batch create+archive+config.
* Medical/history records kabhi hard-delete nahi — `Void / Corrected`.
* Batch numbers: `max(sequence)+1` (count-based nahi — duplicate-safe).
* Har naya field backward compatible (old docs bina field ke valid).

---

## Current Status

Core system PRODUCTION-HARDENED. Saare 4 role dashboards redesigned
(operational command centers). Detail: `PROJECT_STATUS.md`.
