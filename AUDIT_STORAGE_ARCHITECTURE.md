# FCOY ERP — COMPLETE FILE STORAGE ARCHITECTURE AUDIT

**Branch:** `arena/01a053ab-fcoy`
**HEAD:** `2a12868`
**Date:** 2026-08-31
**Mode:** READ-ONLY AUDIT — NO CODE CHANGES

---

## PHASE 1 — FIND EVERY FILE UPLOAD

### Upload Inventory

| # | Feature | UI Screen | Source File | Function | Firebase Storage? | Firestore? | Pinecone? | Current Path/Key | File Type | Max Size | Metadata | Display | Delete | Upload Role | Read Role | Delete Role | Rules Cover? | Base64 in Firestore? | Migration? |
|---|---------|-----------|-------------|----------|-------------------|------------|-----------|------------------|----------|----------|----------|---------|--------|-------------|-----------|-------------|--------------|----------------------|------------|
| 1 | Trainee Photo | TraineeProfileScreen | `src/features/students/TraineeProfileScreen.tsx` | `compressImageToBase64()` → `updateDoc()` | **NO** | **YES** | NO | `trainees/{id}.photoURL` field | JPG/PNG/WEBP | 15MB input → ~800KB base64 | `photoURL`, `photoPath`, `updatedAt` | `<img src={photoURL}>` | `updateDoc(photoURL: '')` | CC, Clerk, QM | All active staff | CC only | `trainees/**` rules exist but NO code uploads there | **YES** — base64 string in Firestore | **YES** |
| 2 | Trainee Documents | DocumentVerificationScreen | `src/features/students/DocumentVerificationScreen.tsx` | `uploadBytes()` + `getDownloadURL()` | **YES** | **YES** (metadata) | NO | `documents/{regNo}/{key}_{timestamp}_{filename}` | JPG/PNG/WEBP/PDF | 500KB per file | `fileName`, `fileUrl`, `fileSize`, `fileType`, `uploadedAt` | `<img src={fileUrl}>` or `<iframe src={fileUrl}>` | Remove from `docStatus` state (no Storage delete) | CC, Clerk, QM | All active staff | CC only | `documents/**` rules — **YES** | NO — download URL only | NO |
| 3 | Bills (Mess Fund) | MessFundScreen | `src/features/messFund/MessFundScreen.tsx` | `processBillFile()` → inline | **NO** | **YES** | NO | `mess_fund_expenses/{id}.billBase64` field | PDF/JPG/PNG/WEBP | 5MB input → 800KB base64 | `billBase64`, `billFileName`, `billFileType`, `billFileSize` | `<img src={billBase64}>` or `<iframe src={billBase64}>` | CC only (delete expense) | CC, QM | Staff with finance access | CC only | `bills/**` rules exist but NO code uploads there | **YES** — base64 in Firestore | **YES** |
| 4 | Bills (Training Fund) | TrainingFundScreen | `src/features/trainingFund/TrainingFundScreen.tsx` | `processBillFile()` → inline | **NO** | **YES** | NO | `training_fund_expenses/{id}.billBase64` field | PDF/JPG/PNG/WEBP | 5MB input → 800KB base64 | Same as #3 | Same as #3 | CC only | CC, QM | Staff with finance access | CC only | Same | **YES** | **YES** |
| 5 | Bills (General Fund) | GeneralFundScreen | `src/features/finance/generalFund/GeneralFundScreen.tsx` | `processBillFile()` → inline | **NO** | **YES** | NO | `general_fund_expenses/{id}.billBase64` field | PDF/JPG/PNG/WEBP | 5MB input → 800KB base64 | Same as #3 | Same as #3 | CC only | CC, QM | Staff with finance access | CC only | Same | **YES** | **YES** |
| 6 | Bills (Company Assets) | CompanyAssetsFundScreen | `src/features/companyAssets/CompanyAssetsFundScreen.tsx` | `processBillFile()` → inline | **NO** | **YES** | NO | `company_assets_expenses/{id}.billBase64` field | PDF/JPG/PNG/WEBP | 5MB input → 800KB base64 | Same as #3 | Same as #3 | CC only | CC, QM | Staff with finance access | CC only | Same | **YES** | **YES** |
| 7 | Vendor Bills | VendorManagementScreen | `src/features/finance/vendors/VendorManagementScreen.tsx` | `processBillFile()` → `BillAttachment[]` | **NO** | **YES** | NO | `vendor_entries/{id}.bills[].base64` array | PDF/JPG/PNG/WEBP | 5MB input → 800KB base64 | `id`, `base64`, `fileName`, `fileType`, `fileSize`, `uploadedAt`, `uploadedBy` | `<img src={base64}>` or `<iframe src={base64}>` | Filter from bills array | CC, QM | Staff with finance access | CC only | Same | **YES** | **YES** |
| 8 | AI Image Analysis | AIAgentScreen | `src/features/aiAgent/api/aiAgent.api.ts` | `extractWeeklyProgramFromImage()` | **NO** | **NO** | **NO** (sent to Gemini API) | Sent as `inlineData` to Gemini | JPG/PNG/WEBP | No explicit limit | `mimeType`, base64 data | Not stored | N/A | CC only | N/A | N/A | N/A | Temporary — not persisted | NO |
| 9 | CSV Export | ReportsScreen | `src/features/system/ReportsScreen.tsx` | `new Blob()` → download | **NO** | **NO** | NO | Browser download | CSV | N/A | N/A | Browser download | N/A | All staff | N/A | N/A | N/A | NO | NO |
| 10 | CSV Export (Welfare) | WelfareDemographicsScreen | `src/features/welfare/utils/demographics.ts` | `new Blob()` → download | **NO** | **NO** | NO | Browser download | CSV | N/A | N/A | Browser download | N/A | CC, Clerk, QM | N/A | N/A | N/A | NO | NO |

---

## PHASE 2 — FIRESTORE FILE DATA AUDIT

### Every Firestore field containing base64/binary-like data:

| # | COLLECTION | DOCUMENT | FIELD | CURRENT FORMAT | APPROX SIZE | WHY IT EXISTS | SCREEN | MIGRATION? |
|---|-----------|----------|-------|----------------|-------------|---------------|--------|------------|
| 1 | `trainees` | `{traineeId}` | `photoURL` | Base64 data URL (`data:image/jpeg;base64,...`) | 200KB–800KB | Trainee profile photo | TraineeProfileScreen | **YES** → Firebase Storage |
| 2 | `trainees` | `{traineeId}` | `photoPath` | String (`base64_{traineeId}`) | <100B | Placeholder path (not real Storage path) | TraineeProfileScreen | **YES** → real Storage path |
| 3 | `mess_fund_expenses` | `{expenseId}` | `billBase64` | Base64 data URL | 100KB–800KB | Bill/receipt image | MessFundScreen | **YES** → Firebase Storage |
| 4 | `mess_fund_expenses` | `{expenseId}` | `billFileName` | String | <100B | Original filename | MessFundScreen | KEEP (metadata) |
| 5 | `mess_fund_expenses` | `{expenseId}` | `billFileType` | String | <50B | MIME type | MessFundScreen | KEEP (metadata) |
| 6 | `mess_fund_expenses` | `{expenseId}` | `billFileSize` | Number | 8B | Original file size | MessFundScreen | KEEP (metadata) |
| 7 | `training_fund_expenses` | `{expenseId}` | `billBase64` | Base64 data URL | 100KB–800KB | Bill/receipt image | TrainingFundScreen | **YES** → Firebase Storage |
| 8 | `training_fund_expenses` | `{expenseId}` | `billFileName` | String | <100B | Original filename | TrainingFundScreen | KEEP |
| 9 | `training_fund_expenses` | `{expenseId}` | `billFileType` | String | <50B | MIME type | TrainingFundScreen | KEEP |
| 10 | `training_fund_expenses` | `{expenseId}` | `billFileSize` | Number | 8B | Original file size | TrainingFundScreen | KEEP |
| 11 | `general_fund_expenses` | `{expenseId}` | `billBase64` | Base64 data URL | 100KB–800KB | Bill/receipt image | GeneralFundScreen | **YES** → Firebase Storage |
| 12 | `general_fund_expenses` | `{expenseId}` | `billFileName` | String | <100B | Original filename | GeneralFundScreen | KEEP |
| 13 | `general_fund_expenses` | `{expenseId}` | `billFileType` | String | <50B | MIME type | GeneralFundScreen | KEEP |
| 14 | `general_fund_expenses` | `{expenseId}` | `billFileSize` | Number | 8B | Original file size | GeneralFundScreen | KEEP |
| 15 | `company_assets_expenses` | `{expenseId}` | `billBase64` | Base64 data URL | 100KB–800KB | Bill/receipt image | CompanyAssetsFundScreen | **YES** → Firebase Storage |
| 16 | `company_assets_expenses` | `{expenseId}` | `billFileName` | String | <100B | Original filename | CompanyAssetsFundScreen | KEEP |
| 17 | `company_assets_expenses` | `{expenseId}` | `billFileType` | String | <50B | MIME type | CompanyAssetsFundScreen | KEEP |
| 18 | `company_assets_expenses` | `{expenseId}` | `billFileSize` | Number | 8B | Original file size | CompanyAssetsFundScreen | KEEP |
| 19 | `vendor_entries` | `{entryId}` | `bills[]` | Array of `BillAttachment` objects | 100KB–800KB per bill | Vendor bill attachments | VendorManagementScreen | **YES** → Firebase Storage |
| 20 | `vendor_entries` | `{entryId}` | `bills[].base64` | Base64 data URL | 100KB–800KB | Individual bill image | VendorManagementScreen | **YES** → Firebase Storage |
| 21 | `vendor_entries` | `{entryId}` | `bills[].fileName` | String | <100B | Original filename | VendorManagementScreen | KEEP |
| 22 | `vendor_entries` | `{entryId}` | `bills[].fileType` | String | <50B | MIME type | VendorManagementScreen | KEEP |
| 23 | `vendor_entries` | `{entryId}` | `bills[].fileSize` | Number | 8B | Original file size | VendorManagementScreen | KEEP |

### Collections with NO base64 data (verified clean):

- `trainees` — documents field stores download URLs (from Firebase Storage), NOT base64
- `staff` — `photoURL` field is a URL input (user pastes URL), NOT base64 upload
- `inspections`, `findings` — no file fields
- `staff_attendance`, `staff_leave`, `staff_duty` — no file fields
- `batches`, `users`, `config`, `unitConfig` — no file fields
- All `*_collections` finance tables — no bill fields (bills are on expense side only)

---

## PHASE 3 — FIREBASE STORAGE AUDIT

### Storage Rules (storage.rules — 80 lines)

```
documents/{allPaths=**}   — Trainee verification documents
  read:  isActive OR devEmail
  write: (CC OR Clerk OR QM OR devEmail) AND validDocUpload (<10MB, image/PDF)
  delete: CC OR devEmail

trainees/{allPaths=**}    — Trainee photos (RULES EXIST, NO CODE UPLOADS HERE)
  read:  isActive OR devEmail
  write: (CC OR Clerk OR QM OR devEmail) AND <15MB AND image/*
  delete: CC OR devEmail

bills/{allPaths=**}       — Bill/receipt uploads (RULES EXIST, NO CODE UPLOADS HERE)
  read:  isActive OR devEmail
  write: (CC OR QM OR devEmail) AND validDocUpload (<10MB, image/PDF)
  delete: CC OR devEmail

/{allPaths=**}            — DEFAULT DENY
```

### Firebase Initialization

```typescript
// src/config/firebase.ts
export const storage = getStorage(app);
// Uses VITE_FIREBASE_STORAGE_BUCKET from env
```

### Storage Bucket

- **Bucket name:** `gs://training-command-erp.firebasestorage.app` (confirmed by user)
- **Status:** EXISTS and EMPTY
- **Configured in:** `firebase.json` (`storage.rules`), `.env.example` (`VITE_FIREBASE_STORAGE_BUCKET`)
- **Deployed via:** `firebase deploy --only storage` (NOT in deploy.yml currently)

### Current Storage Usage

| Path | Code Uploads? | Rules Exist? |
|------|--------------|--------------|
| `documents/{regNo}/` | **YES** — DocumentVerificationScreen | YES |
| `trainees/{id}/` | **NO** — photos are base64 in Firestore | YES |
| `bills/{expenseId}/` | **NO** — bills are base64 in Firestore | YES |

### Storage Helper Utilities

- `src/config/firebase.ts` — exports `storage` (getStorage)
- No shared upload/download/delete helper exists
- Each screen handles its own upload logic independently

---

## PHASE 4 — MULTI-COMPANY ARCHITECTURE

### How a New Company is Created

1. **Remote Customer** (`createRemoteCustomer()`): Creates billing record only in master app. No Auth user, no Firestore profile. Company builds its own separate app.

2. **Local CC Account** (`createCcAccount()`): Creates Firebase Auth + Firestore profile in master app. Used for the master app's own CC.

3. **First Company Setup** (`setupFirstCompany()`): Links existing CC user to customer record, assigns subscription, marks `isLocalUnit=true`.

### How Firebase Storage is Provisioned

| Question | Answer |
|----------|--------|
| How is a new company Firebase project created? | **MANUALLY** — no automated project creation in code |
| How is Firestore provisioned? | Automatic when first write happens (Firebase default) |
| How is Firebase Storage provisioned? | **Automatic when project is created** — default bucket exists |
| Is a Storage bucket automatically created? | **YES** — Firebase creates `gs://{project-id}.firebasestorage.app` by default |
| Are storage rules deployed automatically? | **NO** — must be deployed via `firebase deploy --only storage` |
| Does each company get an independent bucket? | **YES** — each project has its own bucket |
| Do deployment scripts verify Storage? | **NO** — `deploy.yml` deploys Functions + Hosting only, NOT Storage rules |
| Can a new company run without Storage? | **YES** — if rules not deployed, default deny blocks all uploads |
| Are existing data paths compatible? | **YES** — `documents/{regNo}/` works per-project |
| Does master have central file storage? | **NO** — each company's files are in their own project's Storage |

### Gaps Identified

1. **Storage rules NOT in deploy.yml** — `firebase deploy --only storage` is never called in CI/CD
2. **No Storage verification** — no check that bucket exists and rules are deployed
3. **No company provisioning script** — manual Firebase Console + CLI steps required
4. **No Storage health check** — no way to verify Storage is working per company

---

## PHASE 5 — PINECONE AUDIT

### Functions Using Pinecone

| Function | File | Purpose |
|----------|------|---------|
| `syncFirebaseToPinecone()` | `src/features/aiAgent/scripts/syncToPinecone.ts` | Reads Firestore docs → generates embeddings → upserts to Pinecone |
| `searchPinecone()` | `src/features/aiAgent/scripts/syncToPinecone.ts` | Generates query embedding → queries Pinecone → returns text matches |
| `aiPineconeQuery` | `functions/index.js` | Cloud Function: receives vector from browser → queries Pinecone → returns matches |
| `aiPineconeUpsert` | `functions/index.js` | Cloud Function: receives vectors from browser → upserts to Pinecone |

### What is Stored in Pinecone

| Aspect | Detail |
|--------|--------|
| Vector ID | `{collectionName}_{documentId}` (e.g. `trainees_abc123`) |
| Vector values | 512-dimensional embedding from TensorFlow USE |
| Metadata.text | `Collection: {col} | ID: {id} | Data: {JSON.stringify(doc.data())}` |
| Metadata.collection | Collection name string |
| Original documents? | **NO** — only text representation of Firestore documents |
| Images/files? | **NO** — Pinecone stores text embeddings only |
| File references? | **NO** — no Storage paths in Pinecone metadata |

### How Documents are Converted to Text

1. `syncFirebaseToPinecone()` reads all docs from specified Firestore collections
2. Each doc is serialized as: `Collection: {name} | ID: {id} | Data: {JSON.stringify(data)}`
3. TensorFlow USE model generates 512-dim embedding from this text
4. Vector + metadata sent to Pinecone via server-side callable function

### How Retrieval Works

1. User asks question in AI Agent
2. `searchPinecone(queryText)` generates embedding for query
3. Queries Pinecone for top-5 similar vectors
4. Returns concatenated metadata.text from matches
5. This text is injected into the AI prompt as context

### How Original Source Document is Opened After Retrieval

**NOT IMPLEMENTED** — Pinecone returns text only. There is no mechanism to:
- Extract a Storage path from Pinecone metadata
- Open the original document/image from Pinecone results
- Link Pinecone results back to Firebase Storage files

### Should Pinecone Remain After Migration?

**YES** — Pinecone should remain as the AI/vector-search layer. The desired architecture:

```
Original file → Firebase Storage → Text extraction → Chunking → Embedding → Pinecone → AI retrieval → Storage reference → Original document
```

Currently Pinecone indexes Firestore TEXT data only. After migration:
- Pinecone can index document TEXT extracted from Storage files
- Pinecone metadata can include Storage download URLs
- This enables AI retrieval → click to open original document

---

## PHASE 6 — SECURITY

### Per-File-Category Authorization

| Category | Upload | Read | Delete |
|----------|--------|------|--------|
| Trainee Photo (Firestore base64) | CC, Clerk, QM (via `canManage() \|\| canFinance()`) | All active staff | CC only |
| Trainee Documents (Storage) | CC, Clerk, QM (storage.rules) | All active staff (storage.rules) | CC only (storage.rules) |
| Bills — Mess Fund (Firestore base64) | CC, QM (via `canFinance()`) | Staff with finance access | CC only |
| Bills — Training Fund (Firestore base64) | CC, QM (via `canFinance()`) | Staff with finance access | CC only |
| Bills — General Fund (Firestore base64) | CC, QM (via `canFinance()`) | Staff with finance access | CC only |
| Bills — Company Assets (Firestore base64) | CC, QM (via `canFinance()`) | Staff with finance access | CC only |
| Vendor Bills (Firestore base64) | CC, QM (via `canFinance()`) | Staff with finance access | CC only |
| AI Image (temporary) | CC only | N/A (not stored) | N/A |

### Storage Rules vs Application Expectations

| Path | Rules Allow | App Expects | Match? |
|------|-------------|-------------|--------|
| `documents/**` | CC/Clerk/QM write, all active read | CC/Clerk/QM upload, all read | ✅ YES |
| `trainees/**` | CC/Clerk/QM write, all active read | CC/Clerk/QM upload (if migrated) | ✅ YES |
| `bills/**` | CC/QM write, all active read | CC/QM upload (if migrated) | ✅ YES |

### Developer Access

- `isDeveloperEmail()` — hardcoded `developer@acoy.com`, case-insensitive
- Developer can read/write all Storage paths (via `isDeveloperEmail()` bypass)
- Developer can delete all Storage paths
- This is consistent with Firestore rules pattern

### Security Gaps

1. **No Storage delete for documents** — `handleRemoveFile()` only removes from Firestore state, does NOT delete from Storage. Orphaned files remain in Storage forever.
2. **No file size enforcement for base64 bills** — client-side only (800KB limit). Firestore rules cannot check base64 content size.
3. **No virus/malware scanning** — files go directly to Storage

---

## PHASE 7 — BILLING / GOOGLE CLOUD

### Already Configured

| Service | Status | Evidence |
|---------|--------|----------|
| Firebase project | ✅ EXISTS | `.firebaserc` → `training-command-erp` |
| Firestore | ✅ ACTIVE | 44 collections, rules deployed |
| Firebase Storage bucket | ✅ EXISTS | `gs://training-command-erp.firebasestorage.app` (empty) |
| Storage rules file | ✅ EXISTS | `storage.rules` (80 lines) |
| Cloud Functions | ✅ DEPLOYED | 5 callables in `functions/index.js` |
| Firebase Hosting | ✅ DEPLOYED | `deploy.yml` → `FirebaseExtended/action-hosting-deploy` |
| Blaze plan | ✅ ENABLED | Required for Functions + Storage |
| GitHub Actions CI/CD | ✅ WORKING | `deploy.yml` deploys Functions + Hosting |

### Requires Console Action

| Action | Why | How |
|--------|-----|-----|
| Verify Storage bucket exists | User confirmed it does | `firebase storage:buckets --project training-command-erp` |
| Deploy Storage rules | Rules file exists but may not be deployed | `firebase deploy --only storage --project training-command-erp` |

### Requires Code Change

| Change | Why | Files |
|--------|-----|-------|
| Add Storage rules deploy to CI/CD | `deploy.yml` only deploys Functions + Hosting | `.github/workflows/deploy.yml` |
| Create upload helpers | No shared upload/download/delete utility | New file: `src/features/shared/storage.utils.ts` |
| Migrate photos to Storage | Currently base64 in Firestore | `TraineeProfileScreen.tsx` |
| Migrate bills to Storage | Currently base64 in Firestore | `BillUploadWidget.tsx`, all fund screens |
| Add Storage delete on document removal | Orphaned files in Storage | `DocumentVerificationScreen.tsx` |
| Add Storage path to Pinecone metadata | Enable AI → original document link | `syncToPinecone.ts` |

### Requires Billing

| Item | Current | After Migration |
|------|---------|-----------------|
| Firestore storage | High (base64 blobs) | **Reduced** (metadata only) |
| Firebase Storage | Empty | **New usage** (original files) |
| Cloud Functions | Same | Same |
| Pinecone | Same | Same (optional: index Storage content) |
| Network egress | Same | Slightly higher (Storage downloads) |

**Net billing impact:** Likely **neutral or lower** — Firestore reads of large base64 docs are expensive. Moving to Storage reduces Firestore costs while adding Storage costs (which are cheaper per GB).

---

## PHASE 8 — FINAL STORAGE MAP

### Complete Feature → Storage Decision Table

| # | Feature | Current Storage | Should Be | Migration? |
|---|---------|-----------------|-----------|------------|
| 1 | Trainee Profile Photo | Firestore (`trainees.photoURL` base64) | **Firebase Storage** (`trainees/{regNo}/profile/`) | **YES** |
| 2 | Trainee Verification Documents | Firebase Storage (`documents/{regNo}/`) | **Firebase Storage** (KEEP) | NO |
| 3 | Mess Fund Bills | Firestore (`mess_fund_expenses.billBase64`) | **Firebase Storage** (`bills/mess_fund/{expenseId}/`) | **YES** |
| 4 | Training Fund Bills | Firestore (`training_fund_expenses.billBase64`) | **Firebase Storage** (`bills/training_fund/{expenseId}/`) | **YES** |
| 5 | General Fund Bills | Firestore (`general_fund_expenses.billBase64`) | **Firebase Storage** (`bills/general_fund/{expenseId}/`) | **YES** |
| 6 | Company Assets Bills | Firestore (`company_assets_expenses.billBase64`) | **Firebase Storage** (`bills/company_assets/{expenseId}/`) | **YES** |
| 7 | Vendor Entry Bills | Firestore (`vendor_entries.bills[].base64`) | **Firebase Storage** (`bills/vendors/{entryId}/`) | **YES** |
| 8 | AI Image (weekly program) | Temporary (Gemini API) | **KEEP** (not persisted) | NO |
| 9 | CSV Exports | Browser download | **KEEP** (not persisted) | NO |
| 10 | Pinecone vectors | Pinecone | **Pinecone** (KEEP) | NO |
| 11 | Firestore structured data | Firestore | **Firestore** (KEEP) | NO |
| 12 | Staff photoURL | URL input field | **KEEP** (user-pasted URL, not upload) | NO |

### Categories

**A. KEEP AS-IS**
- Trainee verification documents (already in Firebase Storage)
- CSV exports (browser download, not persisted)
- AI image analysis (temporary, sent to Gemini)
- Staff photoURL (user-pasted URL)
- All Firestore structured/metadata fields

**B. MOVE TO FIREBASE STORAGE**
- Trainee profile photos (currently base64 in Firestore)
- All fund bills: mess, training, general, company assets (currently base64 in Firestore)
- Vendor entry bills (currently base64 in Firestore array)

**C. KEEP IN FIRESTORE**
- All metadata fields (billFileName, billFileType, billFileSize, etc.)
- Document verification metadata (fileName, fileUrl, fileSize, fileType, uploadedAt)
- Trainee photoURL field → replace base64 with Storage download URL
- All structured ERP data (trainees, staff, finance, inventory, etc.)

**D. KEEP IN PINECONE**
- All current vector embeddings
- Future: add Storage file text extraction + download URLs to metadata

**E. REMOVE/DEPRECATE**
- `photoPath: 'base64_{traineeId}'` placeholder → replace with real Storage path
- `bills/**` Storage rules path → ACTIVATE (currently rules exist but no code uses it)
- `trainees/**` Storage rules path → ACTIVATE (currently rules exist but no code uses it)

**F. NEEDS FURTHER VERIFICATION**
- Whether `VITE_FIREBASE_STORAGE_BUCKET` env var is set correctly in production
- Whether Storage rules have been deployed to production
- Whether existing production data has base64 blobs that need migration

---

## PHASE 9 — IMPLEMENTATION PLAN

### Stage 1: Storage Architecture (Foundation)

**Goal:** Establish shared upload/download/delete helpers

| Item | Detail |
|------|--------|
| Files to create | `src/features/shared/storage.utils.ts` |
| Functions | `uploadToStorage()`, `getStorageUrl()`, `deleteFromStorage()`, `compressForStorage()` |
| Why | Every screen currently has its own upload logic. Shared helpers ensure consistency. |
| Security impact | None — uses existing `storage` export from firebase.ts |
| Migration impact | None — new code only |
| Rollback | Delete the new file |

### Stage 2: Storage Paths (Define Standard)

**Goal:** Establish canonical path structure

```
documents/{regNo}/{docKey}_{timestamp}_{filename}     ← EXISTING (keep)
trainees/{regNo}/profile/{timestamp}_{filename}       ← NEW (photos)
bills/mess_fund/{expenseId}/{timestamp}_{filename}    ← NEW
bills/training_fund/{expenseId}/{timestamp}_{filename} ← NEW
bills/general_fund/{expenseId}/{timestamp}_{filename}  ← NEW
bills/company_assets/{expenseId}/{timestamp}_{filename} ← NEW
bills/vendors/{entryId}/{timestamp}_{filename}         ← NEW
```

| Item | Detail |
|------|--------|
| Files to change | `storage.rules` (update paths to match) |
| Why | Standard paths enable consistent rules and cleanup |
| Security impact | Rules must match new paths |
| Migration impact | None — new paths for new uploads |
| Rollback | Revert rules file |

### Stage 3: Storage Security Rules (Update)

**Goal:** Ensure rules cover all new paths

| Item | Detail |
|------|--------|
| Files to change | `storage.rules` |
| Changes | Update `trainees/**` and `bills/**` paths to match new structure |
| Why | Rules already exist but paths may need adjustment |
| Security impact | Must maintain same role restrictions |
| Migration impact | None |
| Rollback | Revert rules file |

### Stage 4: Upload Helpers (Implementation)

**Goal:** Create reusable upload functions

| Item | Detail |
|------|--------|
| Files to change | `src/features/shared/storage.utils.ts` (new) |
| Functions | `uploadBillToStorage(file, path)`, `uploadPhotoToStorage(file, regNo)` |
| Why | Replace base64 conversion with Storage upload |
| Security impact | Same authorization as current (client-side role checks + storage.rules) |
| Migration impact | None — new code |
| Rollback | Delete file |

### Stage 5: Download/View Helpers

**Goal:** Create reusable download URL and preview functions

| Item | Detail |
|------|--------|
| Files to change | `src/features/shared/storage.utils.ts` |
| Functions | `getDownloadUrl(path)`, `openInNewTab(path)` |
| Why | Replace base64 data URLs with Storage download URLs |
| Security impact | None — uses existing Storage read rules |
| Migration impact | None |
| Rollback | Revert |

### Stage 6: Delete Helpers

**Goal:** Clean up Storage files when Firestore records are deleted

| Item | Detail |
|------|--------|
| Files to change | `src/features/shared/storage.utils.ts` |
| Functions | `deleteFromStorage(path)` |
| Why | Prevent orphaned files in Storage |
| Security impact | Must respect delete authorization (CC only) |
| Migration impact | None |
| Rollback | Revert |

### Stage 7: Firestore Metadata References

**Goal:** Replace base64 fields with Storage path/URL fields

| Item | Detail |
|------|--------|
| Files to change | All fund screens, BillUploadWidget, TraineeProfileScreen |
| Changes | `billBase64` → `billStoragePath` + `billDownloadUrl`; `photoURL` base64 → download URL |
| Why | Firestore stores metadata + reference, not file content |
| Security impact | None — same read/write authorization |
| Migration impact | New records use new format; old records still readable |
| Rollback | Revert code changes; old base64 data still in Firestore |

### Stage 8: Existing Data Migration

**Goal:** Move existing base64 blobs to Storage

| Item | Detail |
|------|--------|
| Files to create | `scripts/migrate-base64-to-storage.mjs` |
| Process | Read Firestore docs with base64 → upload to Storage → update doc with URL → remove base64 field |
| Why | Reduce Firestore document size, enable proper file management |
| Security impact | Migration script must use Admin SDK |
| Migration impact | **DESTRUCTIVE** — removes base64 from Firestore after upload |
| Rollback | Keep base64 field until migration verified; then remove |
| **STOP CONDITION** | Must get user approval before running |

### Stage 9: Pinecone Integration

**Goal:** Enable AI retrieval → original document linking

| Item | Detail |
|------|--------|
| Files to change | `syncToPinecone.ts`, `collectionRegistry.ts` |
| Changes | Add Storage download URLs to Pinecone metadata; index document text from Storage files |
| Why | Enable AI to reference original documents |
| Security impact | Pinecone metadata should not expose private URLs |
| Migration impact | None |
| Rollback | Revert |

### Stage 10: Multi-Company Provisioning

**Goal:** Ensure every company app has Storage configured

| Item | Detail |
|------|--------|
| Files to change | `.github/workflows/deploy.yml` |
| Changes | Add `firebase deploy --only storage` step |
| Why | Storage rules must be deployed with every company app |
| Security impact | Ensures rules are always deployed |
| Migration impact | None |
| Rollback | Revert deploy.yml |

### Stage 11: Tests

**Goal:** Verify Storage upload/download/delete works correctly

| Item | Detail |
|------|--------|
| Files to change | `functions/test/storage.rules.test.mjs` |
| Changes | Add tests for new paths (trainees/**, bills/**) |
| Why | Ensure rules are correct |
| Security impact | None — tests only |
| Migration impact | None |
| Rollback | Revert |

### Stage 12: Production Verification

**Goal:** Verify everything works in production

| Step | Action |
|------|--------|
| 1 | Deploy Storage rules: `firebase deploy --only storage` |
| 2 | Verify bucket exists: `firebase storage:buckets` |
| 3 | Test upload from UI (one trainee photo) |
| 4 | Test download from UI (view photo) |
| 5 | Test delete from UI (remove photo) |
| 6 | Verify Storage rules are enforced (try unauthorized access) |
| 7 | Run migration script on staging data first |
| 8 | Verify Pinecone still works |
| 9 | Monitor Storage usage in Firebase Console |
| 10 | Deploy to production |

---

## ANSWERS TO THE 10 SPECIFIC QUESTIONS

### 1. EXACTLY where every current file is stored

| File Type | Storage Location | Format |
|-----------|-----------------|--------|
| Trainee photos | Firestore `trainees/{id}.photoURL` | Base64 data URL |
| Trainee documents | Firebase Storage `documents/{regNo}/` | Binary files |
| Mess fund bills | Firestore `mess_fund_expenses/{id}.billBase64` | Base64 data URL |
| Training fund bills | Firestore `training_fund_expenses/{id}.billBase64` | Base64 data URL |
| General fund bills | Firestore `general_fund_expenses/{id}.billBase64` | Base64 data URL |
| Company assets bills | Firestore `company_assets_expenses/{id}.billBase64` | Base64 data URL |
| Vendor bills | Firestore `vendor_entries/{id}.bills[].base64` | Base64 data URL (array) |
| AI images | Temporary (Gemini API inlineData) | Base64 (not persisted) |
| CSV exports | Browser download | Not persisted |

### 2. EXACTLY which files are already using Firebase Storage

**ONLY ONE:** Trainee verification documents in `DocumentVerificationScreen.tsx`
- Path: `documents/{regNo}/{key}_{timestamp}_{filename}`
- Uses: `uploadBytes()` + `getDownloadURL()`
- Metadata stored in: `trainees/{id}.documents.{key}` map

### 3. EXACTLY which files are still stored in Firestore/base64

| Collection | Field | Type |
|-----------|-------|------|
| `trainees` | `photoURL` | Base64 data URL (photo) |
| `mess_fund_expenses` | `billBase64` | Base64 data URL (bill) |
| `training_fund_expenses` | `billBase64` | Base64 data URL (bill) |
| `general_fund_expenses` | `billBase64` | Base64 data URL (bill) |
| `company_assets_expenses` | `billBase64` | Base64 data URL (bill) |
| `vendor_entries` | `bills[].base64` | Base64 data URL (bills array) |

### 4. EXACTLY what Pinecone stores

- **Vector:** 512-dimensional embedding from TensorFlow USE
- **ID:** `{collectionName}_{documentId}`
- **Metadata.text:** Full JSON serialization of Firestore document
- **Metadata.collection:** Collection name string
- **NO original files, NO images, NO Storage references**

### 5. EXACTLY what should move

| From | To | Items |
|------|-----|-------|
| Firestore `trainees.photoURL` (base64) | Firebase Storage `trainees/{regNo}/profile/` | Trainee photos |
| Firestore `mess_fund_expenses.billBase64` | Firebase Storage `bills/mess_fund/{id}/` | Mess bills |
| Firestore `training_fund_expenses.billBase64` | Firebase Storage `bills/training_fund/{id}/` | Training bills |
| Firestore `general_fund_expenses.billBase64` | Firebase Storage `bills/general_fund/{id}/` | General bills |
| Firestore `company_assets_expenses.billBase64` | Firebase Storage `bills/company_assets/{id}/` | Asset bills |
| Firestore `vendor_entries.bills[].base64` | Firebase Storage `bills/vendors/{id}/` | Vendor bills |

### 6. EXACTLY what should remain

| Item | Location | Reason |
|------|----------|--------|
| Trainee documents | Firebase Storage `documents/` | Already correct |
| All metadata fields | Firestore | Structured data |
| All ERP data | Firestore | Database |
| Pinecone vectors | Pinecone | AI search |
| Staff photoURL | Firestore (URL input) | Not an upload |
| CSV exports | Browser | Not persisted |

### 7. EXACTLY what needs to be done next

1. Create shared Storage upload/download/delete helpers
2. Update Storage rules for new paths
3. Add Storage rules deployment to CI/CD
4. Migrate trainee photos from base64 to Storage
5. Migrate all fund bills from base64 to Storage
6. Migrate vendor bills from base64 to Storage
7. Add Storage delete on document removal
8. Create data migration script
9. Update Pinecone to include Storage references
10. Test everything end-to-end

### 8. Whether the existing Firebase bucket is sufficient

**YES** — `gs://training-command-erp.firebasestorage.app` is the default bucket for the project. It is:
- Already created (confirmed by user)
- Currently empty
- Sufficient for all file types (images, PDFs)
- Compatible with existing Storage rules
- No additional buckets needed

### 9. Whether any Google Cloud Console action is still required

| Action | Required? | How |
|--------|-----------|-----|
| Create Storage bucket | **NO** — already exists | — |
| Enable Storage API | **NO** — already enabled | — |
| Deploy Storage rules | **YES** — may not be deployed | `firebase deploy --only storage` |
| Set CORS | **NO** — Firebase handles this | — |
| Create service account | **NO** — already exists | — |
| Enable Blaze plan | **NO** — already enabled | — |

### 10. Whether every future company app can get its own systematic Storage bucket

**YES** — Firebase automatically creates a default Storage bucket for every project. The path structure is project-scoped, so:

```
Company A: gs://company-a-project.firebasestorage.app/documents/{regNo}/...
Company B: gs://company-b-project.firebasestorage.app/documents/{regNo}/...
```

No collisions possible. Each company's Storage is completely isolated.

**Requirement:** Storage rules must be deployed to each company project. Add `firebase deploy --only storage` to the deployment script.

---

## SUMMARY

| Aspect | Current State | Target State |
|--------|--------------|--------------|
| Trainee photos | Base64 in Firestore (~800KB each) | Firebase Storage + download URL in Firestore |
| Fund bills (4 types) | Base64 in Firestore (~800KB each) | Firebase Storage + download URL in Firestore |
| Vendor bills | Base64 in Firestore array (~800KB each) | Firebase Storage + download URL in Firestore |
| Trainee documents | Firebase Storage ✅ | Firebase Storage (keep) |
| Pinecone | Text embeddings from Firestore | Text embeddings + Storage references |
| Storage rules | Exist but partially unused | Fully activated for all paths |
| CI/CD | Functions + Hosting only | Functions + Hosting + Storage rules |
| Multi-company | Manual provisioning | Storage rules in deploy script |

**Total base64 fields to migrate:** 6 field types across 5 Firestore collections
**Estimated Firestore savings:** 200KB–800KB per document (significant for finance-heavy companies)
**Risk level:** LOW — additive migration (new uploads go to Storage, old base64 data preserved until migration)
