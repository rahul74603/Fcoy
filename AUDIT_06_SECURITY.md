# FCOY ERP — SECURITY AUDIT

## FIRESTORE RULES (629 lines)

### Helper Functions

| Function | Definition | Notes |
|----------|-----------|-------|
| `signedIn()` | `request.auth != null` | |
| `userDoc()` | `get(users/{uid}).data` | Graceful if doc missing |
| `role()` | `userDoc().role` | Returns undefined if no doc |
| `isCC()` | `role() == 'Company Commander'` | |
| `isClerk()` | `role() == 'Clerk'` | |
| `isQM()` | `role() == 'Quarter Master'` | |
| `isUstad()` | `role() == 'Ustad'` | |
| `isSO()` | `role() == 'Senior Officer / Inspector'` | |
| `isStaff()` | role in [CC, Clerk, QM, Ustad, SO] | |
| `isActive()` | `userDoc().isActive != false` | True if doc missing |
| `canManage()` | `isActive() && (isCC() \|\| isClerk())` | UNCHANGED from original |
| `canFinance()` | `isActive() && (isCC() \|\| isQM())` | UNCHANGED from original |
| `isDeveloper()` | `userDoc().isDeveloper == true` | Requires Firestore doc |
| `isDeveloperEmail()` | email matches `(?i)^developer@acoy\.com$` | No Firestore doc needed |
| `canUseDevSandbox()` | `isCC() \|\| isDeveloper() \|\| isDeveloperEmail()` | |
| `canReadDevData()` | `!resourceIsDev() \|\| canUseDevSandbox()` | |
| `canWriteDevData()` | `!requestIsDev() \|\| canUseDevSandbox()` | |

### Key Security Properties

| Property | Status |
|----------|--------|
| Default deny | ✅ `match /{document=**} { allow read, write: if false; }` |
| No catch-all authenticated read | ✅ Verified |
| No catch-all authenticated write | ✅ Verified |
| Protected user fields | ✅ role, isDeveloper, isActive, assignedBatchIds, customerId |
| Leave approval CC-only | ✅ status/approvedBy/rejectionReason/approvalDate locked |
| SO batch-scoped | ✅ `assignedBatchIds` check |
| Inspection immutability | ✅ batchId/createdBy/inspectorId locked |
| Finding lifecycle | ✅ open→in_progress→submitted→closed/rework, no regression |
| Dev data isolation | ✅ `isDevData` tag, invisible to non-dev users |
| First-run bootstrap | ✅ Closed after `config/firstRun` exists |

### Developer Access Summary

| Collection | Developer Can | Normal Users |
|-----------|--------------|-------------|
| `users` | Read, create own, update own | Read (isStaff), create (CC/firstRun), update (CC/self) |
| `devTools` | Read/write | Denied |
| All other collections | Via `canManage()`/`canFinance()` (CC role in profile) | Standard role-based |

## STORAGE RULES (80 lines)

| Path | Read | Write | Delete | Size | Type |
|------|------|-------|--------|------|------|
| `documents/**` | isActive OR devEmail | (CC/Clerk/QM OR devEmail) AND validDocUpload | CC OR devEmail | <10MB | image/* OR PDF |
| `trainees/**` | isActive OR devEmail | (CC/Clerk/QM OR devEmail) AND <15MB AND image/* | CC OR devEmail | <15MB | image/* |
| `bills/**` | isActive OR devEmail | (CC/QM OR devEmail) AND validDocUpload | CC OR devEmail | <10MB | image/* OR PDF |
| `/**` (default) | DENIED | DENIED | DENIED | — | — |

### PDF Size Fix
Original had operator precedence bug: PDFs had NO size limit. Fixed with parentheses.

## CLOUD FUNCTIONS AUTHORIZATION

| Function | Auth Check | Developer Bypass |
|----------|-----------|-----------------|
| `assertAiAuthorized()` | Firestore profile role === 'Company Commander' | `developer@acoy.com` bypasses profile/role check |
| `assertCallerIsCommander()` | Firestore profile role === 'Company Commander' | `developer@acoy.com` bypasses profile/role check |

### Identity Source
All developer checks use `request.auth.token.email` — server-verified Firebase Auth JWT. Cannot be forged by client.

## CROSS-COMPANY ISOLATION
Each company = separate Firebase project. No shared database. No cross-company data access possible.
