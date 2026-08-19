# CLERK MODULE BLUEPRINT (Updated — August 2026)

## Responsibilities

Clerk = trainee administration. Finance/Inventory ka koi access nahi
(DB rules read tak deny karti hain).

---

## Batch

⚠️ **Clerk batch CREATE nahi karta** — ye Company Commander ka
exclusive right hai (context + firestore.rules दोनों enforce karte hain).
Clerk sirf: active batch dekhna + trainee registration par
`totalTrainees` counter update (onlyKeys rule).

---

## Trainee Management

Screens:
* **Trainee List** (`/trainees`) — poore batch ki list ek saath, photo,
  naam/father/reg/chest/platoon/village se partial search,
  Chest Pending / Assigned tabs, **inline chest assignment**
  (duplicate check + chestAssignedAt/By audit), row-level Full Report,
  Profile deep-link
* **Trainee Details / Profile** (`/profile`) — exact chest/reg search +
  `?search=` deep-link, registration form, edit modal, photo upload
  (Cloudinary; legacy base64 bhi renders), **Full Dossier report**

### Registration Fields
Required: Name, Father Name, DOB (18-30), Reg No (duplicate-checked),
Aadhaar, Mobile, Address (village→state), Blood Group, Joining, Platoon.
**Chest Number OPTIONAL** — trainees pehle aate hain, chest baad me.
Sensitive fields (Blood/Religion/Category/State) me koi silent default
nahi — "— Select —" se shuru hote hain.

### Chest Number Lifecycle (LOCKED)
Registration (pending) → arrival → assign (Trainee List/Profile se) →
uniqueness check (batch-scoped) → audit stamp → operational identity.

---

## Document Management (`/documents`)

21 document types, 7 categories (Identity/Education/Medical/
Verification/Photos/Financial/Recruitment). Required/optional toggle,
multiple files, front/back.

* Upload → **Cloudinary** (`documents/<regNo>/` folder; PDF/JPG/PNG/WEBP)
* Statuses: Pending / Uploaded / Verified / Rejected
* **Audit trail**: uploadedBy/At, verifiedBy/At, rejectedBy/At,
  rejectionReason (backward compatible — old docs bina fields ke valid)
* Upload fail = visible error (koi fake success nahi)
* Completion % + required counts trainee doc par save hote hain

---

## Medical Register (`/medical-register`)

Categories: Sick Report, Hospital Admit, B-Rest, C-Rest, Medical Board.
Statuses: Active / Fit-Discharged / **Void-Corrected**.

⚠️ Medical history **kabhi hard-delete nahi hoti** — galat entry Void
hoti hai (voidedAt/By/reason ke saath). Record create + trainee attn/
medStat sync ek atomic writeBatch me.

---

## Absent / Leave (`/absent-management`)

Types: A (Absent), L (Leave), S (Sick/MI), H (Hospital), R (Rest/Light
Duty). Trainee `attn` field = presence ka single source of truth
(return par 'P'). Medical-linked rows delete nahi hoti — Void.

---

## Weekly Programme (`/weekly-program`)

Week create/edit, day-wise sessions (time/subject/platoon/location/
assigned ustads), official A4 print (missing values = "—").

---

## Clerk Dashboard (`/clerk`) — Operational Command Center

1. Header: greeting + F Coy + batch + date + last-updated
2. Strength strip: Total / Active(%) / Hospital / Leave / Light Duty /
   Chest Pending — sab clickable (breakdown modals)
3. Find Trainee: instant search (chest/name/mobile/reg) w/ photo+status
4. **Needs Your Attention** (hero): CRITICAL/ACTION TODAY/PENDING —
   rejected docs, hospital review, leave returns today, missing weekly
   program, chest pending, doc gaps — har item par action button
5. Today's Program (sessions + ustad + location)
6. Document Control (completion % + immediate issues) +
   Medical & Availability (hospital since-dates, returns today)
7. Your Pending Work (sirf non-zero counts, clickable)
8. Recent Activity (real timestamps se) + Quick Actions
