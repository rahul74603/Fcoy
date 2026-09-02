# FCOY ERP — ISSUES & RECOMMENDATIONS

## CRITICAL ISSUES

### 1. Subscription Enforcement: CLIENT-SIDE ONLY
**Severity:** HIGH
**Location:** `src/features/subscription/components/SubscriptionGate.tsx`
**Issue:** Subscription lock screen is a React component. Server-side enforcement (Firestore rules checking subscription status) is NOT implemented. A user who modifies the JavaScript bundle can bypass the lock screen.
**Recommendation:** Add Firestore rules that check `subscription/current` status before allowing reads/writes to business collections.

### 2. Bills Stored as Base64 in Firestore
**Severity:** MEDIUM
**Location:** `src/features/shared/BillUploadWidget.tsx`, `CompanyAssetsFundScreen.tsx`, `GeneralFundScreen.tsx`
**Issue:** Bills/receipts are stored as base64 strings directly in Firestore expense documents. This bloats Firestore documents (up to 800KB each), increases read costs, and hits Firestore's 1MB document limit.
**Recommendation:** Migrate bill uploads to Firebase Storage (rules already exist for `bills/**` path). Store only the download URL in Firestore.

### 3. Trainee Photos Stored as Base64 in Firestore
**Severity:** MEDIUM
**Location:** `src/features/students/TraineeProfileScreen.tsx`
**Issue:** Trainee photos are stored as base64 strings in Firestore. Same bloat/cost issues as bills.
**Recommendation:** Migrate to Firebase Storage (rules already exist for `trainees/**` path).

### 4. No Automated Backups
**Severity:** HIGH
**Location:** N/A
**Issue:** No scheduled Firestore exports, no Storage backups, no disaster recovery plan.
**Recommendation:** Implement scheduled Cloud Function for Firestore exports to Cloud Storage.

### 5. No Push Notifications
**Severity:** MEDIUM
**Location:** `src/features/notifications/`
**Issue:** Notifications are client-side polling only (2-minute interval). No FCM, no service worker, no email triggers.
**Recommendation:** Implement FCM push notifications for critical events (leave approval, inspection findings).

---

## MEDIUM ISSUES

### 6. Storage Rules for Unused Paths
**Severity:** LOW
**Location:** `storage.rules`
**Issue:** Rules exist for `trainees/**` and `bills/**` but NO code uploads to these paths. Only `documents/**` is used.
**Recommendation:** Either migrate code to use these paths (see #2, #3) or remove unused rules to reduce attack surface.

### 7. No Company Deletion/Suspension
**Severity:** MEDIUM
**Location:** `src/features/developer/api/customers.api.ts`
**Issue:** No workflow to disable or delete a company. No subscription-based suspension.
**Recommendation:** Implement company disable (soft delete) and subscription-based access control.

### 8. Ustad Dashboard is Placeholder
**Severity:** LOW
**Location:** `src/features/dashboard/UstadDashboard.tsx`
**Issue:** Only 20 lines, just a placeholder message. Ustad role has no meaningful dashboard.
**Recommendation:** Implement Ustad dashboard with assigned duties, pending corrective actions, training schedule.

### 9. Admin Dashboard Uses Mock Data
**Severity:** LOW
**Location:** `src/features/dashboard/AdminDashboard.tsx`
**Issue:** 182 lines with hardcoded mock data. Not connected to real Firestore data.
**Recommendation:** Either implement with real data or remove if unused.

### 10. No Error Tracking
**Severity:** MEDIUM
**Location:** N/A
**Issue:** No Sentry, LogRocket, or Firebase Crashlytics. Errors are only in console.
**Recommendation:** Implement error tracking for production debugging.

### 11. No Audit Trail
**Severity:** MEDIUM
**Location:** N/A
**Issue:** No change history logging. No way to see who changed what and when.
**Recommendation:** Implement audit trail for critical operations (user role changes, financial transactions, leave approvals).

### 12. No PDF Generation
**Severity:** LOW
**Location:** N/A
**Issue:** No report PDF export. Reports are screen-only.
**Recommendation:** Implement PDF generation for reports, leave letters, inspection reports.

### 13. No Bulk Import
**Severity:** LOW
**Location:** N/A
**Issue:** No CSV import for trainees. Manual entry only.
**Recommendation:** Implement CSV import for trainee registration.

### 14. No Offline Support
**Severity:** LOW
**Location:** N/A
**Issue:** No service worker, no offline caching. App requires internet.
**Recommendation:** Implement service worker for offline read access.

---

## LOW ISSUES

### 15. CommanderInformationBoard Orphan Cleanup
**Severity:** LOW
**Location:** `src/features/dashboard/CommanderInformationBoard.tsx`
**Issue:** On mount, deletes trainees without batchId. This is a cleanup mechanism but could be dangerous if batchId is accidentally null.
**Recommendation:** Add confirmation dialog or move cleanup to Cloud Function.

### 16. No App Check
**Severity:** LOW
**Location:** N/A
**Issue:** No Firebase App Check. API abuse possible.
**Recommendation:** Implement App Check for Cloud Functions.

### 17. No Rate Limiting
**Severity:** LOW
**Location:** Cloud Functions
**Issue:** No rate limiting on Cloud Functions. AI proxy could be abused.
**Recommendation:** Implement rate limiting per user.

### 18. TensorFlow.js Bundle Size
**Severity:** LOW
**Location:** `src/features/aiAgent/`
**Issue:** TensorFlow.js USE model is loaded client-side for RAG embeddings. Large bundle size.
**Recommendation:** Consider server-side embeddings or lighter model.

---

## SUMMARY

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| MEDIUM | 7 |
| LOW | 6 |
| **TOTAL** | **18** |
