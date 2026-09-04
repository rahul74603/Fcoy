# 98 — Security Rules Audit

**What this is:** a line-by-line read of `firestore.rules` (801 lines) and
`storage.rules` (80 lines), done independently of the module documentation.
Nothing was changed. This file exists so that when a buyer asks *"is our
data actually safe, or does the app just hide the buttons?"* you have a
verified answer instead of a hopeful one.

**Audited:** 2026-09-04 · **Method:** full read of both rule files, plus a
cross-check of every Firestore collection the app code actually touches
against every collection the rules cover.

**Read this with:** `99-DOCUMENTATION-AUDIT.md` §5 (the never-promise list).

---

## 1. The headline

> **These are real rules, not decoration.**

Most small business apps have one of two failure modes: either the rules
file says `allow read, write: if request.auth != null` (meaning *any*
logged-in person can read and rewrite *everything*), or it says
`if true` (meaning the whole database is public). **This project has
neither.** It has 78 individually-scoped collection rules and an explicit
default-deny at the bottom.

**Verified, and safe to say out loud:**

| Claim | Status |
|---|---|
| Every collection the app uses is explicitly covered by a rule | ✅ **VERIFIED** — 56 collections used in code, 0 uncovered |
| There is a default-deny catch-all | ✅ **VERIFIED** — `firestore.rules:797`, `storage.rules:76` |
| There is no `if request.auth != null` blanket write | ✅ **VERIFIED** — no authenticated-user catch-all exists |
| Only the Company Commander can approve leave | ✅ **VERIFIED** at the data layer, not just the UI |
| A user cannot promote themselves to Commander | ✅ **VERIFIED** — `protectedUserFieldsUnchanged()` |
| A trainee cannot approve their own report | ✅ **VERIFIED** — status forced to `pending` on create |
| Storage files are not public | ✅ **VERIFIED** — default-deny, plus per-tree rules |
| Uploads have a size and file-type limit | ✅ **VERIFIED** — 10 MB docs / 15 MB photos, images + PDF only |

---

## 2. The one thing you must say first

> ⚠️ **These rules have never been deployed.**

They exist in the repository. They are written. They are good. But until
the owner runs the deploy command, the **live database is running on
whatever rules were last pushed to Firebase** — which, on a default
Firebase project, is usually test-mode or a much weaker set.

**This is not a defect in the rules. It is an unfinished deployment step.**

```powershell
cd C:\Users\Rahul\Fcoy-new
firebase deploy --only firestore:rules,storage
```

**In a demo:** do not claim "your data is locked down" until this is run.
Say instead: *"Security rules are written and reviewed — they get deployed
with the system."* That is honest and it is still a strong statement.

**Second consequence:** until this runs, trainee-login screens (Today
Special, notice board, files) may look empty in a live demo, because the
currently-deployed rules do not know the `Trainee` role exists.

---

## 3. Defence in depth — what that actually means here

The rules file opens with the right idea, in its own words:

> *"The React UI ALSO hides controls, but hiding UI is NOT security —
> every sensitive operation is enforced here at the data layer."*

That distinction is worth explaining to a buyer in one sentence:

> *"Button chhupa dena suraksha nahi hai. Agar koi seedha database se baat
> karne ki koshish kare, to rules use wahin rok denge."*

Hiding a button stops an honest user from making a mistake. A rule stops a
determined one. This system does both.

---

## 4. Role model as enforced by the rules

Six roles are recognised **at the database layer**:

| Role | Helper | Tier |
|---|---|---|
| Company Commander | `isCC()` | Full authority |
| Clerk | `isClerk()` | `canManage()` with CC |
| Quarter Master | `isQM()` | `canFinance()` with CC |
| Ustad (instructor) | `isUstad()` | Staff read + own actions |
| Senior Officer / Inspector | `isSO()` | Supervisory, batch-scoped |
| Trainee | `isTrainee()` | Read-only + raise reports |

Two composite tiers do most of the work:

- **`canManage()`** = active **CC or Clerk** → the operations tier
- **`canFinance()`** = active **CC or Quarter Master** → money and stock

**A good detail to mention:** every tier check includes `isActive()`. A
**deactivated account is refused at the database**, not just at the login
screen. So when a person is transferred out and the Commander deactivates
them, their access ends immediately — even if they still have a valid
session open.

### Role-name tolerance

`roleKey()` lowercases the stored role, and each helper accepts several
spellings — `'Quarter Master'`, `'qm'`, `'quartermaster'`, `'quarter
master'` all resolve to Quarter Master. This is defensive: it means a
record typed slightly differently by hand does not silently lose the user
their access. Worth knowing, not worth demoing.

---

## 5. The rules that carry the most business weight

### 5.1 Leave approval — the flagship rule
**`firestore.rules:283-314`**

The comment above it calls it *"THE CRITICAL AUTHORIZATION RULE"*, and that
is fair.

- **Create:** any active staff member may apply, but the application
  **must** start with `status: 'pending'`, `approvedBy: ''`, and no
  approval date. You cannot file a pre-approved leave.
- **Update:** the Commander has full control. **Everyone else** — Clerk,
  Ustad, QM — may edit remarks but the rule requires that `status`,
  `approvedBy`, `approvalDate` and `rejectionReason` come back **exactly
  as they were**. A Clerk cannot approve leave. Not from the screen, not
  from a script, not from the Firebase console with a stolen token.
- **Delete:** Commander only.

> **Demo line:** *"Chutti sirf Company Commander manzoor kar sakta hai.
> Ye niyam screen me nahi, database me likha hai — Clerk chaahe bhi to
> nahi kar sakta."*

### 5.2 Privilege escalation is blocked
**`firestore.rules:162-168, 199-203`**

A user may edit their own profile, but `protectedUserFieldsUnchanged()`
requires that these come back untouched:

- `role` — cannot promote yourself
- `isDeveloper` — cannot grant yourself the developer sandbox
- `isActive` — cannot reactivate yourself after being deactivated
- `assignedBatchIds` — an SO cannot grant themselves more batches to inspect
- `customerId` — cannot reassign subscription ownership

Only the Commander branch bypasses this, via User Management.

> This is the single most important rule in the file, and it is correct.

### 5.3 A trainee cannot approve their own report
**`firestore.rules:493-524`**

The trainee-report flow is genuinely well guarded. On create, a trainee:

- must set `status: 'pending'` — no self-approval
- must set `submittedByUid` to **their own uid** — no impersonating another
  trainee
- must leave `appliedToAbsentId` / `appliedToMedicalId` / `appliedToNoticeId`
  **empty** — the client cannot pre-fabricate the approval side-effects
- must attach either a `traineeId` or mark it `isGeneral`

And then: **update is Clerk/CC only, delete is CC only.** A trainee cannot
edit or withdraw a report once submitted. That is deliberate — it preserves
the audit trail.

> **Demo line:** *"Rangroot report daal sakta hai. Manzoori nahi de sakta.
> Aur daalne ke baad badal bhi nahi sakta — record record rehta hai."*

### 5.4 Logs are append-only for everyone except the Commander
**`firestore.rules:395-401, 449-455, 595-602`**

All three logging collections (`auditLogs`, `staff_activity_logs`,
`activity_logs`) share one policy:

```
allow create: if isActive();          // anyone active may log
allow update, delete: if isCC();      // nobody may rewrite history
```

A Clerk can write a log entry. A Clerk **cannot** edit or delete one. This
is what makes the Lekha-Jokha register trustworthy.

> ⚠️ **Honesty caveat:** the Commander *can* delete log entries. That is a
> deliberate administrative escape hatch, not tamper-proofing. If a buyer
> asks *"can the record be altered?"*, the correct answer is: *"Koi bhi
> staff nahi mita sakta. Company Commander mita sakta hai — wo unka adhikaar
> hai."* Do not claim immutability.

### 5.5 Inspection findings — the most sophisticated rule in the file
**`firestore.rules:666-790`**

This section is unusually careful and worth understanding, because it is
the one place the rules model a **workflow**, not just a permission.

- **Batch scoping is enforced in the database.** An SO may only touch
  inspections and findings whose `batchId` appears in their own
  `assignedBatchIds`. Not a UI filter — a rule.
- **Ownership fields are immutable.** `batchId`, `createdBy`,
  `inspectionId` can never be changed after creation.
- **No draft regression.** Once an inspection leaves `draft` it can never
  return to `draft`. Since only drafts are deletable, this closes the
  *submit → revert to draft → delete* trick for erasing an inspection.
- **Closed findings stay closed.** A closed finding's `verifiedBy` and
  `verifiedAt` stamps can never be cleared or rewritten.
- **The assigned responder is boxed in.** A Clerk/QM/Ustad assigned a
  finding may move it `open → in_progress → submitted` and nothing else.
  They cannot change the severity, the due date, the corrective action,
  the title, the description, who it is assigned to, or the verification
  stamp. And they cannot close it — **only the inspector who raised it can
  verify and close.**

> **Demo line:** *"Jise kami sudhaarni hai, wo sirf 'kar diya' keh sakta
> hai. 'Theek ho gaya' bolne ka haq sirf inspection karne wale ko hai."*

This is separation of duties, correctly implemented. It is the strongest
single argument in the file that the rules were thought about rather than
generated.

### 5.6 Stock can never go negative
**`firestore.rules:579-590`**

```
allow write: if canFinance()
  && request.resource.data.balance is number
  && request.resource.data.balance >= 0;
```

The rule refuses any write that would leave a stock balance below zero —
including the size-level sub-collection. This backs up the atomic issue
transaction documented in `modules/06-quartermaster-inventory.md` with a
second, independent guarantee.

### 5.7 Money is fenced off
**`firestore.rules:532-558`**

Every one of the ~24 finance collections follows the same shape: **staff
may read, only `canFinance()` (CC or QM) may write.** An Ustad can see the
mess fund. An Ustad cannot touch it. There are no exceptions in the list —
that consistency is itself a good sign.

### 5.8 Storage: files are not public
**`storage.rules`**

Four trees, each scoped: `documents/`, `trainees/`, `traineeFiles/`,
`bills/`. Everything else is denied.

- **Uploads are limited** to 10 MB (docs/files/bills) or 15 MB (photos),
  and only images or PDF are accepted.
- The rules file contains a nice piece of self-awareness at line 33:
  a note that `&&` binds tighter than `||`, so the size check had to wrap
  *both* type branches — *"warna koi bhi PDF (chahe 500MB ka ho) pass ho
  jata."* That bug was found and fixed. It is fixed correctly.
- **Trainees can download, never upload.** `traineeFiles/` allows read to
  any active user but write only to CC/Clerk.

---

## 6. Coverage check — the number that matters

I extracted every Firestore collection referenced in `src/` and compared it
against every collection matched in the rules.

| | Count |
|---|---|
| Collections the app code actually uses | **56** |
| Collection rules written | **78** |
| **Collections used but NOT covered by a rule** | **0** ✅ |

**Zero uncovered.** This is the finding I most expected to go the other
way, and it did not. Every collection the app touches has a deliberate
rule. Nothing is falling through to default-deny by accident, and — more
importantly — nothing is falling through to an over-permissive catch-all,
because there isn't one.

The 22 extra rules are not dead. They cover collections referenced through
constants rather than string literals (`inspections`, `findings`,
`stock_ledgers`, `finalResults`, `trainingSyllabus` and the rest), plus
sub-collection paths and the master-deployment collections.

---

## 7. Observations worth knowing (not vulnerabilities)

These are honest notes. None of them is a hole, but a technical buyer might
ask, and you should not be surprised.

### 7.1 Batch isolation is client-side, by design
The rules say so openly at lines 16-21: staff can read any batch in their
own company, and the batch scope you see in the UI is enforced by the app,
not the database. **Cross-company isolation is achieved by giving each
company its own Firebase project.**

**This is a legitimate architecture** for a per-company deployment, and it
is documented rather than hidden. But be precise about what you promise:

- ✅ *"Har company ka apna alag database hota hai."*
- ❌ Do not say *"ek batch ka data doosre batch ka staff nahi dekh sakta."*
  A determined staff member could. The SO role **is** batch-locked in the
  rules; CC/Clerk/QM/Ustad are not.

### 7.2 `batches` is readable by any signed-in user
**Line 218.** Deliberate, and the comment explains why: the login screen
runs an unfiltered query, and filtering on `isDevData` would cause the
whole query to fail on mixed data. Batch names and dates are not sensitive.
Same reasoning applies to `config`, `unitConfig`, and `subscription`
(line 614 — needed so the license chip loads before the role does).

### 7.3 The first-run window
Several rules include `|| (signedIn() && firstRunOpen())` — before setup
completes, the first account can create a Commander profile and seed
subscription defaults. `firstRunOpen()` checks that `config/firstRun` does
not exist, and the wizard writes that marker at the end
(`FirstRunSetupScreen.tsx:200`), so the path closes permanently after one
successful run.

**Correctly designed.** One thing to be aware of operationally: the window
is open on a freshly created, not-yet-configured project. **Complete the
first-run wizard immediately after deploying a new company.** Do not
provision a project and leave it sitting unconfigured.

### 7.4 Storage rules do not normalise role names
`firestore.rules` accepts `'qm'`, `'QM'`, `'Quarter Master'`.
`storage.rules:28-30` compares against the exact strings only
(`role() == 'Quarter Master'`). So a user whose stored role is `'qm'` would
pass Firestore checks but be refused a **file upload**.

**Not a security hole** — it fails *closed*, which is the safe direction.
But it could show up as a confusing "upload failed" for one user. Worth
recording; not worth mentioning in a sales demo.

### 7.5 Storage `userDoc()` has no existence guard
`storage.rules:19-21` calls `firestore.get(...)` without first checking the
document exists. If an authenticated user has no `users/{uid}` profile, the
rule errors rather than returning false — which Firebase treats as a
denial. Again **fails closed**, and Firestore's equivalent helper
(`userDocExists()`, line 39) does guard properly.

### 7.6 Deleting a profile does not delete the login
Noted honestly at lines 206-207: removing the Firestore user document does
not remove the Firebase Authentication account — that needs a backend.
**This is why "deactivate, don't delete" is the right practice**, and it is
already the documented one. A deactivated user is refused everywhere by
`isActive()`, so the outcome is correct.

---

## 8. What to say, and what never to say

### ✅ Say this
- *"Har collection ka apna niyam hai. Jo likha nahi, wo band hai."*
- *"Chutti manzoor karna sirf Company Commander ke haath me hai — database
  ke level par."*
- *"Koi apne aap ko Commander nahi bana sakta."*
- *"Rangroot report daal sakta hai, manzoori nahi de sakta."*
- *"Staff log likh sakta hai, mita nahi sakta."*
- *"Jo kami sudhaar raha hai wo khud verify nahi kar sakta."*
- *"Stock kabhi minus me nahi ja sakta — do jagah se roka gaya hai."*
- *"Files public nahi hain. Upload par size aur type dono ki seema hai."*
- *"Deactivate kiya hua account database se hi mana ho jata hai."*

### ❌ Never say this
- ❌ **"Rules deployed and live"** — they are **not deployed yet**. Say
  "written and reviewed, deployed with the system."
- ❌ **"Records can never be altered"** — the Commander can delete log
  entries. Say "no staff member can."
- ❌ **"One batch's staff cannot see another batch"** — only the SO role is
  batch-locked. CC/Clerk/QM/Ustad are not.
- ❌ **"Encrypted"** — these are access-control rules. Firebase encrypts at
  rest as a platform, but this project implements no application-level
  encryption. Do not use the word.
- ❌ **"Penetration tested" / "audited" / "certified"** — this is an
  internal code review, which is what it says on the tin. It is not a
  third-party security certification.
- ❌ **"Multi-tenant with database-level company isolation"** — isolation
  comes from **separate Firebase projects per company**, not from rules.
  Say it that way; it is a perfectly good answer.

---

## 9. Verdict

| Area | Rating |
|---|---|
| Collection coverage | ✅ Complete — 0 gaps |
| Default deny | ✅ Present in both files |
| Privilege escalation | ✅ Blocked |
| Approval authority (leave) | ✅ Enforced at data layer |
| Trainee self-approval | ✅ Blocked |
| Log tampering by staff | ✅ Blocked |
| Separation of duties (inspections) | ✅ Genuinely well modelled |
| Stock integrity | ✅ Double-guarded |
| File storage | ✅ Scoped, size- and type-limited |
| Deactivated accounts | ✅ Refused at data layer |
| Batch isolation within a company | ⚠️ Client-side by design (SO excepted) |
| Storage role normalisation | ⚠️ Inconsistent — fails closed |
| **Deployment** | ❌ **Never deployed — do this first** |

**Overall:** the rules are the strongest part of the codebase reviewed so
far. They are consistent, commented with real reasoning, and they encode
business rules — not just role checks. Several sections (findings
lifecycle, trainee reports, leave approval) show a level of care that is
uncommon at this project size.

**The one action item is not a fix. It is a deploy.**

---

## 10. Scope of this audit

- **Read-only.** No rule was changed. No app code was touched.
- Both rule files read in full; collection coverage cross-checked against
  `src/`.
- **Not done:** running the Firebase rules emulator test suite; live
  penetration testing; a review of Firebase Authentication settings,
  App Check, or API-key restrictions. Those sit outside the rules files and
  would need separate work.
- No claim here should be described as a third-party security certification.
