# FCOY ERP — DEEP DIVES

## DEEP DIVE A: MULTI-COMPANY ARCHITECTURE

### Model: Project-Level Isolation
Each company = separate Firebase project. Master app = owner/billing console.

### Company Creation Flow
1. Owner opens `/dev-practice` → Customers tab
2. Clicks "New Customer (CC Account Banao)"
3. Remote mode (default): Creates billing record only
4. Local mode: Creates Firebase Auth + Firestore profile in master app
5. Auto-generates Customer ID (FCOY-2026-001)
6. Customer appears in Subscriptions tab for plan assignment

### Company Bridge
`pushSubToCompany(bridge, subscription)` → secondary Firebase app instance → signs in with sync credentials → writes `subscription/current` → company's onSnapshot picks up change → secondary app deleted.

### Missing
- Company deletion workflow
- Company suspension workflow
- Cross-company data migration
- Company backup/restore

---

## DEEP DIVE B: SUBSCRIPTION SYSTEM

### Plans
| Plan | Amount | Duration | Notes |
|------|--------|----------|-------|
| Free Trial | ₹0 | 30 days | Default |
| Monthly | ₹499 | 30 days | |
| Half-Yearly | ₹2,499 | 180 days | |
| Yearly | ₹4,499 | 365 days | |
| Lifetime | ₹9,999 | 36500 days | ~100 years |

### Status Flow
`none → active → expiring → grace → expired`

### Enforcement: CLIENT-SIDE ONLY
SubscriptionGate.tsx is a React component. Server-side enforcement (Firestore rules checking subscription) is NOT implemented.

### SO and Subscription
SO has NO subscription authority. Only CC manages subscriptions.

---

## DEEP DIVE C: FILES/PHOTOS/DOCUMENTS

### Upload Inventory
| Upload | Storage | Code | Production |
|--------|---------|------|------------|
| Trainee photo | Firestore (base64) | TraineeProfileScreen | ✅ YES |
| Trainee documents | Firebase Storage | DocumentVerificationScreen | ✅ YES |
| Bills/receipts | Firestore (base64) | BillUploadWidget | ✅ YES |
| Inspection attachments | NOT IMPLEMENTED | — | ❌ |
| Staff documents | NOT IMPLEMENTED | — | ❌ |
| Medical documents | NOT IMPLEMENTED | — | ❌ |

### Storage Rules vs Code Mismatch
- `trainees/**` rules: code NEVER uploads here
- `bills/**` rules: code NEVER uploads here
- `documents/**` rules: code DOES upload here

---

## DEEP DIVE D: FIREBASE STORAGE

### What Uses Storage
Only `DocumentVerificationScreen.tsx` uploads to Firebase Storage.

### Storage Rules
- `documents/**`: isActive + validDocUpload + <10MB + image/PDF
- `trainees/**`: isActive + <15MB + image (NO CODE UPLOADS HERE)
- `bills/**`: isActive + validDocUpload + <10MB + image/PDF (NO CODE UPLOADS HERE)
- Default: DENIED

### Production Bucket
- Configured in `firebase.json` and `firebaseConfig`
- Bucket existence NOT VERIFIED from repository
- Requires Blaze plan

---

## DEEP DIVE E: NOTIFICATIONS

### Architecture
- Client-side polling (2-minute interval)
- Firestore `notifications` collection
- 11 notification types defined
- NotificationBell component in top bar

### Types
Leave request, leave approved, leave rejected, inspection scheduled, finding created, finding verified, finding closed, finding rework, duty assigned, duty changed, general

### Missing
- Push notifications (FCM)
- Email notifications
- Notification preferences
- Notification read/unread sync

---

## DEEP DIVE F: FRONTEND WORKFLOWS

### Trainee Registration
1. Clerk opens `/trainees`
2. Fills form (name, regNo, DOB, blood group, etc.)
3. Uploads photo (base64 → Firestore)
4. Saves to `trainees/{id}`

### Document Verification
1. Clerk opens `/documents`
2. Selects trainee
3. Uploads Aadhaar/certificate (Firebase Storage)
4. Marks verified/unverified

### Leave Management
1. Clerk creates leave request
2. CC sees in dashboard
3. CC approves/rejects
4. Notification created
5. Clerk sees status update

### Inspection Workflow
1. SO creates inspection (batch-scoped)
2. SO creates findings (open status)
3. Assigns corrective action to role
4. Ustad/CC submits corrective action (submitted status)
5. SO verifies (closed or rework)

---

## DEEP DIVE G: SECURITY

### Identity Source
All developer checks use `request.auth.token.email` — server-verified Firebase Auth JWT.

### Protected Fields
- `users/{uid}`: role, isDeveloper, isActive, assignedBatchIds, customerId
- `inspections/{id}`: batchId, createdBy, inspectorId
- `findings/{id}`: inspectionId, createdBy

### Default Deny
`match /{document=**} { allow read, write: if false; }` at bottom of rules.

### No Catch-All
No `allow read: if request.auth != null` anywhere.

---

## DEEP DIVE H: TESTS

### Test Suites
| Suite | Tests | Status |
|-------|-------|--------|
| Static audit | ~26 | ✅ ALL PASS |
| Staff provisioning | 17 | ✅ 17/17 PASS |
| Security tests | 84 | ⚠️ NOT RUN (needs typescript) |
| Firestore rules | 76 | ⚠️ NOT RUN (needs Java) |
| Storage rules | 8 | ⚠️ NOT RUN (needs Java) |

### Test Safety
- Emulator tests use local emulator
- `singleProjectMode: true` prevents production access
- Static tests do NOT connect to Firebase

---

## DEEP DIVE I: GIT STATE

### Branch
`arena/01a053ab-fcoy` — 5 commits ahead of main.

### Commits
1. `4478c0b` — Initial audit exploration
2. `9d904b5` — Security rules analysis
3. `85d3f6f` — Cloud Functions analysis
4. `1fd4af5` — Test suite analysis
5. `2a12868` — Final audit data collection

### Untracked Files
- `AUDIT_REPORT.md` (previous session)
- `AUDIT_01` through `AUDIT_08` (this session)

### No Production Changes
All commits are audit-only. No code changes, no security rule modifications, no Cloud Function changes.
