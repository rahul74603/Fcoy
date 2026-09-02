# FCOY ERP — STORAGE, DOCUMENTS & PHOTOS

## FILE UPLOAD INVENTORY

### 1. Trainee Photo

| Aspect | Detail |
|--------|--------|
| Frontend | `TraineeProfileScreen.tsx` (line 142) |
| Function | `compressImageToBase64(file, maxW=350, maxH=450, quality=0.72)` |
| Storage | **Firestore** — `trainees/{id}.photoURL` field |
| Provider | **NOT Firebase Storage** — base64 string in Firestore document |
| Path | `trainees/{traineeId}` document, field `photoURL` |
| Read | All active staff (`isStaff()`) |
| Write | CC, Clerk, QM (`canManage() \|\| canFinance()`) |
| Delete | CC only (sets `photoURL: ''`) |
| Max size | 15MB input → compressed to ~800KB base64 (~1.07MB Firestore) |
| Types | JPG, PNG, WEBP |
| Used in production | **YES** |
| Compression | Canvas resize to 350×450, JPEG 0.72, re-compress at 0.5 if >800KB |

### 2. Trainee Documents (Aadhaar, certificates, etc.)

| Aspect | Detail |
|--------|--------|
| Frontend | `DocumentVerificationScreen.tsx` (line 204) |
| Function | `uploadBytes(storageRef, file)` + `getDownloadURL(storageRef)` |
| Storage | **Firebase Storage** |
| Path | `documents/{regNo}/{key}_{timestamp}_{filename}` |
| Read | All active staff (`isActive()`) |
| Write | CC, Clerk, QM (`isCC() \|\| isClerk() \|\| isQM()`) |
| Delete | CC only |
| Max size | 10MB (enforced in storage.rules AND client) |
| Types | Images (`image/*`) + PDF (`application/pdf`) |
| Used in production | **YES** |
| Metadata | Stored in `trainees/{id}.documents.{key}` map |

### 3. Bills / Receipts (Finance)

| Aspect | Detail |
|--------|--------|
| Frontend | `BillUploadWidget.tsx` → used by `CompanyAssetsFundScreen.tsx`, `GeneralFundScreen.tsx` |
| Function | `compressImage()` or `fileToBase64()` → base64 string |
| Storage | **Firestore** — inline in expense document |
| Provider | **NOT Firebase Storage** — base64 in Firestore |
| Path | `company_assets_expenses/{id}.billBase64` or `general_fund_expenses/{id}.billBase64` |
| Read | Staff with finance access |
| Write | CC, QM (`canFinance()`) |
| Delete | CC only |
| Max size | 5MB input → compressed to ~800KB base64 |
| Types | PDF, JPG, PNG, WEBP |
| Used in production | **YES** |
| Storage rules path | `bills/{allPaths=**}` exists but **NO code uploads to this path** |

### 4. Inspection Attachments

| Aspect | Detail |
|--------|--------|
| Frontend | **NOT IMPLEMENTED** |
| Storage | N/A |
| Status | ❌ No upload code exists |

### 5. Staff Documents

| Aspect | Detail |
|--------|--------|
| Frontend | **NOT IMPLEMENTED** |
| Storage | N/A |
| Status | ❌ No upload code exists |

### 6. Medical Documents

| Aspect | Detail |
|--------|--------|
| Frontend | **NOT IMPLEMENTED** |
| Storage | N/A |
| Status | ❌ No upload code exists |

---

## STORAGE ARCHITECTURE SUMMARY

```
Firebase Storage (production bucket)
├── documents/{regNo}/          ← Trainee verification documents
│   ├── aadhar_{ts}_{name}.png
│   ├── certificate_{ts}_{name}.pdf
│   └── ...
├── trainees/{allPaths=**}      ← Rules exist, NO upload code uses this path
└── bills/{allPaths=**}         ← Rules exist, NO upload code uses this path

Firestore (base64 inline)
├── trainees/{id}.photoURL      ← Trainee photos (compressed base64)
├── company_assets_expenses/{id}.billBase64  ← Bills (compressed base64)
├── general_fund_expenses/{id}.billBase64    ← Bills (compressed base64)
└── training_fund_expenses/{id}.billBase64   ← Bills (if applicable)
```

## KEY FINDINGS

1. **Only ONE upload uses Firebase Storage**: `DocumentVerificationScreen.tsx`
2. **Trainee photos are base64 in Firestore** — NOT Firebase Storage
3. **Bills are base64 in Firestore** — NOT Firebase Storage
4. **Storage rules exist for `trainees/` and `bills/`** but NO code uploads there
5. **No third-party storage** — no Cloudinary, S3, Supabase, etc.
6. **Orphan risk**: If trainee document is deleted from Firestore, Storage file remains
7. **No cleanup function**: No Cloud Function to delete Storage files when Firestore doc is deleted

## PRODUCTION BUCKET STATUS

| Question | Answer |
|----------|--------|
| Is Storage configured? | YES — `firebase.json`, `getStorage()` in code |
| Bucket name | Implicit from `firebaseConfig.storageBucket` |
| Is bucket verified to exist? | **NOT VERIFIABLE FROM REPOSITORY** |
| Requires Blaze plan? | YES |
| How to verify | `firebase storage:buckets --project training-command-erp` or Firebase Console |
