# F COY ERP — MASTER AUDIT REPORT
## MODULE 17 — NOTIFICATION SYSTEM  |  MODULE 18 — SETTINGS & MASTERS

**Audit Date:** 31 July 2026
**Auditor Role:** Senior Government ERP Architect / BSF Training Centre Consultant / Senior Full-Stack Software Auditor
**Method:** 100% Evidence-Based (har claim actual code se verify — koi assumption nahi)
**Branch:** `arena/019fb3d1-fcoy`

**Legend:** ✅ Available · 🟡 Partial · ❌ Missing · ★ Is audit mein FIX kiya · ♻️ Refactor kiya · 🔴 Critical issue mila

---

# ══════════════════════════════════════════════
# MODULE 17 — NOTIFICATION SYSTEM
# ══════════════════════════════════════════════

**Existing Code (pehle se):** `src/features/notifications/` — 3 files:
- `notification.types.ts` — 11 types + 3 priority levels + per-type icon/color config
- `useNotifications.ts` — **COMPUTED** engine: har 2 minute mein 6 collections poll karke live alerts banata hai (pending leaves, returning-soon, today's duties, hospital staff, today's classes, active deputations); read-status localStorage mein
- `NotificationBell.tsx` — header bell + dropdown + unread badge (mounted EnterpriseLayout line 104)

**Sabse Badi Khoj:** System **purely pull/computed** tha — koi `notifications` Firestore collection **exist hi nahi karti thi**. Matlab: na kisi ko message BHEJA ja sakta tha, na koi history, na delivery/read tracking (localStorage read-status sirf usi device par valid tha — dusre device par sab unread wapas).

---

## A. NOTIFICATION DASHBOARD — AUDIT EVIDENCE

| # | Feature | Status | Evidence | Recommendation |
|---|---------|--------|----------|----------------|
| 1 | Dashboard Cards | ❌→★ | Pehle sirf bell dropdown tha. Ab ★ **Notification Center** (`/notifications`) — 4 stat cards (Total / Unread / High Priority / Broadcasts) | ➕ ADD NEW (done ★) |
| 2 | Notification Statistics | ❌→★ | ★ Stats cards + type/priority/status breakdown filters | ➕ ADD NEW (done ★) |
| 3 | Delivery Status | ❌→★ | ★ Sent History mein har notification par "Delivered · Unread" ya "✓ Read by N" badge (`readBy[]` se) | ➕ ADD NEW (done ★) |
| 4 | Failed Notifications | ❌ | In-app model mein "failure" concept nahi banta (doc write = delivered). Push/SMS aane par relevant hoga | ➕ Future (FCM phase) |

## B. NOTIFICATION TYPES — AUDIT EVIDENCE

| # | Type | Status | Evidence | Recommendation |
|---|------|--------|----------|----------------|
| 1 | In-App Notifications | ✅ | Bell + ★ persistent center — ab dono: computed (live alerts) + stored (broadcasts/events) | ✅ KEEP (+ ★ upgrade) |
| 2 | Push Notifications | ❌ | FCM integration kahin nahi (no service worker, no `getToken`, no VAPID key) | ➕ Future — Phase 3 (Cloud Messaging) |
| 3 | Email Notifications | ❌ | Koi email pipeline nahi (Cloud Functions + provider chahiye) | ➕ Future — Phase 3 |
| 4 | SMS Ready | ❌ | Schema-ready nahi tha; ab `targetRole/targetUserId/priority` schema SMS gateway ke liye compatible hai | 🟡 Schema-ready ★ (gateway Future) |
| 5 | WhatsApp Ready | ❌ | Same as SMS | 🟡 Schema-ready ★ (gateway Future) |
| 6 | System Alerts | 🟢→✅ | `system_alert` type config mein tha; ★ ab `broadcast` + `sendNotification` se actual system alerts bheje ja sakte hain | ✅ (improved ★) |
| 7 | Emergency Alerts | ❌→★ | ★ Broadcast composer mein **Emergency Mode toggle** — `emergency` type, forced HIGH priority%， 🚨 styling, red send button | ➕ ADD NEW (done ★) |

## C. EVENT BASED NOTIFICATIONS — AUDIT EVIDENCE

| # | Event | Status | Evidence | Recommendation |
|---|-------|--------|----------|----------------|
| 1 | Leave Approval | 🟡→★ | Computed "pending" alert tha; approval/rejection event koi nahi sunta tha. ★ Ab `approveLeave`/`rejectLeave` (leave.api.ts) → `notifyLeaveDecision` → Clerk ko stored notification (staff ka naam, days, type, decision, kisne kiya) | 🔄 UPDATE EXISTING (done ★) |
| 2 | Attendance Missing | 🟡 | `attendance_pending` type config mein hai (bell duty-based cover karta hai); dedicated hazri-missing generator nahi | 🟡 Acceptable ( Medium backlog) |
| 3 | Training Schedule Update | ❌→★ | M12 mein reschedule/postpone banaya tha par koi alert nahi jaati thi. ★ Ab `updateSchedule` (schedule.api.ts) → `notifyScheduleChanged` → Ustad (HIGH) + Clerk (MEDIUM) | ➕ ADD NEW (done ★) |
| 4 | Exam Result | ❌→★ | Results publish hone par kisi ko pata nahi chalta tha. ★ Ab `saveTestResults` (testRecord.api.ts) → `notifyTestResultsPublished` → CC + Clerk (Pass/Fail/Absent counts + test name) | ➕ ADD NEW (done ★) |
| 5 | Medical Alert | 🟡→★ | Computed "staff hospital" tha; trainee medical case event nahi tha. ★ Ab MedicalRegisterScreen add-case → `notifyMedicalCaseCreated` → CC (Hospital/Injury/Board = HIGH, baaki LOW) | 🔄 UPDATE EXISTING (done ★) |
| 6 | Inventory Alert | 🟡 | `inventory_alert` type + emitter schema ready; computed low-stock alerts AI-engine mein hain — auto-emit Medium backlog | 🟡 Schema-ready ★ |
| 7 | Finance Alert | 🟡 | Same — type ready, emit backlog | 🟡 Schema-ready ★ |
| 8 | User Activity Alert | 🟡 | M16 `login_history` audit trail ban gaya; failed-login alert emit backlog | 🟡 (audit exists; alert Medium) |

**Architecture Note:** Sab emitters **fire-and-forget** hain — `safeSend` wrapper silent-catch karta hai, main business flow (leave approve, results save) kabhi notification error se break nahi hota. Ye `logActivity` ka established pattern hi follow karta hai.

## D. NOTIFICATION FEATURES — AUDIT EVIDENCE

| # | Feature | Status | Evidence | Recommendation |
|---|---------|--------|----------|----------------|
| 1 | Broadcast Message | ❌→★ | ★ CC-only Broadcast tab — sab roles ya specific role ko, BC-0001 auto-numbering ke saath | ➕ ADD NEW (done ★) |
| 2 | Individual Message | 🟡 | Schema support (`targetUserId`) + fetch merge ready; composer UI Future | 🟡 Schema-ready ★ |
| 3 | Group Message | 🟡 | Role = group targeting (schema same) | 🟡 via role-wise ★ |
| 4 | Batch Wise | ❌ | `targetBatchId` schema extension point chhoda hai (metadata) — UI Future | ➕ Future |
| 5 | Platoon Wise | ❌ | Same — Future | ➕ Future |
| 6 | Role Wise | ❌→★ | ★ `targetRole`: ALL / CC / QM / Clerk / Ustad — bell + center dono filter karte hain | ➕ ADD NEW (done ★) |

## E. TEMPLATES — AUDIT EVIDENCE

| # | Feature | Status | Evidence | Recommendation |
|---|---------|--------|----------|----------------|
| 1 | Dynamic Templates | ❌ | Event emitters mein message strings code mein built hoti hain (parameterized functions — partial dynamic) | 🟡 Event emitters = code templates; DB templates Future |
| 2 | Variables | 🟡 | `${who} ki ${type} (${days} days)` style interpolation emitters mein | 🟡 via emitters |
| 3 | Multilingual | ❌ | Messages English+Hinglish mix (project voice); template-level i18n nahi | ➕ Future |
| 4 | Priority Levels | ✅ | high/medium/low — sort weight, URGENT badges, emergency override | ✅ KEEP AS IT IS |

## F. HISTORY — AUDIT EVIDENCE

| # | Feature | Status | Evidence | Recommendation |
|---|---------|--------|----------|----------------|
| 1 | Sent History | ❌→★ | ★ CC Sent History tab — last 50, type/target/read badges, sender + time | ➕ ADD NEW (done ★) |
| 2 | Failed History | ❌ | In-app model mein N/A; FCM aane par | ➕ Future |
| 3 | Retry Queue | ❌ | Firestore write fail = document hi nahi banta (offline persistence queue Firebase SDK handle karta hai) | 🟡 SDK-level; custom queue Future |
| 4 | Delivery Tracking | ❌→★ | ★ `readBy[]` per notification — kisne padha, kab delivered hua (`deliveredAt` stamp) | ➕ ADD NEW (done ★) |
| 5 | Read Status | 🟡→★ | Pehle: localStorage per-device only. ★ Ab: stored notifications ka readBy[] Firestore mein (**multi-device consistent**); computed alerts localStorage par hi rehte hain (by design — wo ephemeral hain) | 🔄 UPDATE EXISTING (done ★) |

## G. SEARCH & FILTERS — AUDIT EVIDENCE

| # | Filter | Status | Evidence | Recommendation |
|---|--------|--------|----------|----------------|
| 1 | User (role) | ✅★ | Role-targeted fetch + broadcast target filter | ✅ (★ new) |
| 2 | Role | ✅★ | Same | ✅ |
| 3 | Date | ❌→★ | ★ Inbox date-picker filter | ➕ done ★ |
| 4 | Status (read/unread) | ❌→★ | ★ All/Unread/Read filter + Mark All Read | ➕ done ★ |
| 5 | Notification Type | ❌→★ | ★ 18-type dropdown filter (dynamic from feed) | ➕ done ★ |

## H. TECHNICAL — AUDIT EVIDENCE

| # | Aspect | Status | Evidence & Notes |
|---|--------|--------|------------------|
| 1 | Firebase Cloud Messaging | ❌ | Not integrated — Phase 3 (service worker + token registry + Cloud Function trigger) |
| 2 | Firestore Collections | ❌→★ | ★ `notifications` collection (type, priority, title, message, link, targetRole, targetUserId, readBy[], deliveredAt, createdBy/Name, metadata) |
| 3 | Queue Handling | 🟡 | Firebase offline persistence = built-in queue; custom job queue nahi |
| 4 | Retry Logic | 🟡 | SDK auto-retry for writes; manual retry queue FCM phase par |
| 5 | Performance | 🟡 | Bell: 6 computed queries + 2 stored queries har 2 min. **Index-safe design ★** — composite index ki zaroorat na pade isliye role/personal queries mein orderBy nahi, sorting client-side (single-company volume chhota) |
| 6 | Security | 🟡 | Route ALL_ROLES (apne role ka feed hi milta hai — targetRole filter client-side). Firestore rules abhi repo mein nahi (repo-wide Critical) |
| 7 | Scalability | 🟡 | 80-notification slice, arrayUnion readBy — single-company scale par theek; readBy array bada hone par per-user read-docs pattern Future |

## I. INTEGRATION — AUDIT EVIDENCE

| Touchpoint | Status | Evidence |
|------------|--------|----------|
| All ERP Modules | ✅★ | 6 computed generators (staff module) + ★ 4 stored event emitters (leave/schedule/exam/medical) + finance/inventory types ready |
| Dashboard | ✅ | EnterpriseLayout bell har dashboard par |
| Reports | 🟡 | Reports mein notification link nahi; center se saral navigation hai |
| User Management | 🟡 | Role-targeting users collection se aligned; individual composer Future |

---

## MODULE 17 — SCORECARD

| Metric | Before → **After** | Justification |
|--------|--------------------|---------------|
| **Overall Score** | 40 → **72** | Persistent backbone + broadcast + events + history ★ |
| **Completion %** | 38 → **70** | Checklist ke core in-app items complete; push/email/SMS consciously future |
| **UI Score** | 78 | Bell pehle se polished; ★ center military-theme consistent |
| **Code Quality** | 75 | Fire-and-forget emitters, index-safe queries, localStorage+Firestore dual read-state |
| **Database Quality** | 72 | `notifications` schema extensible (targetUserId/metadata reserved) |
| **Architecture** | 70 | Computed + Stored hybrid — pragmatic, golden-rule compliant |
| **Security** | 55 | Role-targeting client-side; rules repo-mein nahi (repo-wide Critical) |
| **Performance** | 70 | 2-min polling samajhdari se throttled; slice caps |
| **Scalability** | 62 | Single company ✓; readBy[] growth + FCM phase par redesign |
| **Government ERP** | 68 | Emergency broadcast + delivery audit = command-ready |

### Top 10 Existing Features Worth Keeping (M17)
1. Computed alert engine (6 live generators — zero-config situational awareness)
2. NotificationBell UI (badge, dropdown, time-ago, priority sort)
3. 2-minute auto-refresh cycle
4. Priority model (high/medium/low + weight sort)
5. NOTIFICATION_CONFIG icon/color registry
6. localStorage read-cache for computed alerts
7. Outside-click close + loading states
8. Deep links (`link` → navigate) per notification
9. Silent-fail pattern (koi query fail ho to baaki alerts aate hain)
10. Returning-soon smart alert (3-day window + urgency escalation)

### Top 10 Features Updated / Added (M17) ★
1. ★ `notifications` Firestore collection + notification.api.ts (persistent backbone)
2. ★ Notification Center screen (`/notifications` — stats, filters, inbox)
3. ★ Broadcast composer (CC, role-target, BC-numbering, 500-char guard)
4. ★ Emergency Alert mode (forced HIGH, 🚨 styling)
5. ★ Sent History with read/delivery badges (CC audit)
6. ★ Firestore readBy[] read-tracking (multi-device)
7. ★ Leave approve/reject → Clerk notification
8. ★ Schedule reschedule → Ustad + Clerk notification
9. ★ Exam results published → CC + Clerk notification
10. ★ Medical case (serious = HIGH) → CC notification

### Top 10 Missing Features (M17) — Backlog
1. FCM push notifications (service worker + tokens) — Future Phase 3
2. Email pipeline (Cloud Function + provider) — Future
3. SMS/WhatsApp gateway integration — Future (schema-ready ★)
4. Individual message composer UI (schema-ready) — Medium
5. Batch/platoon-wise targeting — Medium
6. DB-driven notification templates (`dropdown_masters` se) — Medium
7. Inventory/finance auto-emitters (low stock, due alerts) — Medium
8. Failed-login security alert to CC — Medium
9. Notification retention/cleanup policy (30-day purge) — Medium
10. Multilingual template support — Low

### Top 10 Critical Problems (M17)
1. 🔴 Repo-wide: Firestore security rules absent — `notifications` writes client-trusted hain
2. ~~No persistent store — bell refresh = history gone~~ ★ FIXED
3. ~~No broadcast capability~~ ★ FIXED
4. ~~Read status per-device only~~ ★ FIXED (stored notifications)
5. Bell har 2 min mein 8 queries — battery/quota footprint (Medium)
6. No cleanup policy — `notifications` collection unbounded growth (Medium)
7. Push nahi hai — field mein app khule bina alert nahi milti (by design, Phase 3)
8. Computed alerts dedupe logic localStorage-dependent (device switch par re-alert) — minor
9. Event messages code-hardcoded (template drift risk) — Low
10. No per-user notification preferences — Low

### Top 10 Future Enhancements (M17)
1. FCM integration end-to-end
2. Email digests (daily summary to CC)
3. SMS gateway (govt NIC SMS / MSG91)
4. Individual + batch + platoon targeting UI
5. DB template master with variables (`{{name}}`, `{{days}}`)
6. Notification preferences per user
7. Retention Cloud Function (auto-purge 30+ days)
8. Delivery analytics (read-rate per broadcast)
9. Action buttons in notifications (Approve directly)
10. Quiet hours + priority override rules

---

# ══════════════════════════════════════════════
# MODULE 18 — SETTINGS & MASTERS
# ══════════════════════════════════════════════

**Existing Code:** `src/features/system/SettingsScreen.tsx` (~1,300 lines — profile edit, password change WITH re-auth, staff creation, staff list toggles, unit config edit), `src/contexts/UnitConfigContext.tsx` (real-time), `SeedStaffData.tsx`, masters scattered across modules (subject/leave-type/duty-type/batch/vendor managers).

---

## A. SYSTEM SETTINGS — AUDIT EVIDENCE

| # | Feature | Status | Evidence | Recommendation |
|---|---------|--------|----------|----------------|
| 1 | Company Profile | ✅ | `unitConfig/main` doc — companyName, companyShort, location, commanderName; Settings edit form + real-time context | ✅ KEEP AS IT IS |
| 2 | Training Centre Details | ✅ | `parentUnit` ('STC TEKANPUR') + location — print headers mein live use (printDocuments) | ✅ KEEP AS IT IS |
| 3 | Financial Year | ❌→★ | Pehle kahin nahi tha. ★ `unitConfig.financialYear` — auto-computed current FY (April–March: "2026-27"), Settings editable + view row + context default | ➕ ADD NEW (done ★) |
| 4 | Academic Year | ❌→★ | ★ `unitConfig.sessionLabel` ("Training Session 2025-26") — same edit flow | ➕ ADD NEW (done ★) |
| 5 | Session Settings | 🟡 | sessionLabel label-level hai; session date-range enforcement Future | 🟡 Label ★; enforcement Future |

## B. MASTER DATA — AUDIT EVIDENCE

| # | Master | Status | Evidence | Recommendation |
|---|--------|--------|----------|----------------|
| 1 | Batch Master | ✅ | `batches` collection + BatchManagementScreen (CC edit modal M1-4) | ✅ KEEP AS IT IS |
| 2 | Platoon Master | 🟡 | **3 hardcoded lists** (`schedule.types.ts` PLATOONS, `testRecord.types.ts` BSF_PLATOONS, `WeeklyProgramScreen.tsx` local) — DB master nahi. ★ Masters Registry mein ab visibly marked | 🔄 Future migration (drift risk documented ★) |
| 3 | Rank Master | 🟡 | `staff.types.ts` RANKS constant — code master; ★ registry mein marked | 🔄 Future migration |
| 4 | Subject Master | ✅ | `subject_master` + SubjectManagementScreen (CRUD + isActive) | ✅ KEEP AS IT IS |
| 5 | Item Master | 🟡 | Kit items purchase entries se dynamic (datalist pattern) — central catalog nahi (M6 se known) | 🔄 Future (kit_templates backlog) |
| 6 | Leave Type Master | ✅ | `leave_types` + LeaveManagementScreen "Leave Types" tab (quota management) | ✅ KEEP AS IT IS |
| 7 | Medical Category Master | 🟡→★ | Pehle hardcoded `CATEGORIES` array. ★ Ab `dropdown_masters/medical_categories` DB-driven with **hardcoded fallback** — MedicalRegisterScreen boot par DB values prefer karta hai; Masters screen se CC edit kar sakta hai | 🔄 UPDATE EXISTING (done ★) |
| 8 | Exam Type Master | 🟡 | `TestType` union type (11 types, type-safe code master) — intentionally code-level (business logic tied) | ✅ KEEP AS IT IS (code master justified) |
| 9 | Notification Template Master | ❌→★🟡 | ★ `dropdown_masters` generic store ready — templates future consumer; event templates abhi code emitters mein | 🟡 Infra ready ★ |

## C. DYNAMIC CONFIGURATION — AUDIT EVIDENCE

| # | Feature | Status | Evidence | Recommendation |
|---|---------|--------|----------|----------------|
| 1 | Custom Fields | ❌ | Schema-fixed modules (Firestore schemaless hai par app types fixed) | ➕ Future |
| 2 | Dropdown Masters | ❌→★ | ★ `dropdown_masters` collection + Masters Screen editor (add/remove values, audit stamps, Enter-key quick add) + live consumer (medical categories) | ➕ ADD NEW (done ★) |
| 3 | Status Masters | 🟡 | Statuses code enums/union types mein (leave status, course status) — gov-ERP mein ye customary hai (type-safety) | ✅ KEEP AS IT IS |
| 4 | Category Masters | 🟡→★ | Subject categories dropdown-driven; ★ medical categories ab DB; fund categories code (4 funds = business core) | ✅ Acceptable |

## D. NUMBERING SYSTEM — AUDIT EVIDENCE

| # | Feature | Status | Evidence | Recommendation |
|---|---------|--------|----------|----------------|
| 1 | Auto IDs | ✅🟡 | Firestore auto-IDs + semantic IDs (`trainee_attendance` doc = `batch_date_session`) | ✅ KEEP |
| 2 | Registration Number | 🟡 | Chest numbers clerk-assigned (M1-4 duplicate-guard ★) | ✅ KEEP |
| 3 | Document Number | ✅ | LV- (leave), IS- (kit slip), RT- (return receipt), batch_N — module-managed schemes | ✅ KEEP AS IT IS |
| 4 | Voucher Number | 🟡 | Finance voucher/receipt print exists (M7-8); numbering module-internal | 🟡 Acceptable |
| 5 | **Counter Infrastructure** | ❌→★ | ★ `system_counters` collection + `getNextNumber(key, prefix)` — **runTransaction race-safe**; live consumer: broadcast IDs (BC-0001…); Masters screen par counter snapshot + existing schemes registry | ➕ ADD NEW (done ★) |

## E. BACKUP & RESTORE READY — AUDIT EVIDENCE

| # | Feature | Status | Evidence | Recommendation |
|---|---------|--------|----------|----------------|
| 1 | Backup | ❌→★ | ★ **Backup Center** (Masters screen) — 42 collections ka one-click JSON export, Timestamps→ISO conversion, per-collection counts, progress display, last-export summary | ➕ ADD NEW (done ★) |
| 2 | Restore | 🟡 | Manual admin-assisted (Firestore console / script) — documented in-screen; auto-restore import wizard Future | 🟡 Export-ready ★; import Future |
| 3 | Import/Export Settings | 🟡 | JSON full-export ★; per-module CSV exports Reports mein (M15); selective collection export Future | 🟡 Partial ★ |

## F. SEARCH & FILTERS (Settings domain)
| # | Feature | Status | Evidence |
|---|--------|--------|----------|
| 1 | Staff search | 🟡 | M16 User Management search ★; Settings staff list basic |
| 2 | Master search | 🟡 | Masters registry table single-view (16 rows — filter unneeded) |

## G. TECHNICAL — AUDIT EVIDENCE

| # | Aspect | Status | Evidence |
|---|--------|--------|----------|
| 1 | Firestore Collections | ✅★ | unitConfig + ★ dropdown_masters + ★ system_counters + existing masters |
| 2 | Validation | ✅ | Required-field guards (unit config, staff create), email format, min-password, duplicate email mapping, dropdown value trim/dedupe |
| 3 | Versioning | 🟡 | `updatedAt/updatedBy` stamps on config+masters; doc-level history nahi |
| 4 | Security Rules | 🔴 | Repo-wide absent (recurring Critical) |
| 5 | Activity Log | 🟡 | staff_activity_logs (staff module); settings changes stamps-only |
| 6 | Audit Trail | ✅🟡 | updatedBy/updatedAt + M16 login_history + per-record createdBy |
| 7 | Performance | ✅ | Masters counts Promise.all parallel; backup sequential with progress |
| 8 | Scalability | 🟡 | Backup full-scan — single company fine; large data par Cloud Function export Future |

## H. INTEGRATION
- ★ MedicalRegisterScreen ← dropdown_masters (live consumer pattern proven)
- ★ Broadcast numbering ← system_counters
- UnitConfig → printDocuments headers (existing) + ★ FY/session available context-wide
- Masters screen → existing managers deep-link (no duplication — golden rule)

### 🔴➜♻️ CRITICAL REFACTOR (Session Safety)
**Evidence:** SettingsScreen ka `handleCreateStaff` **live auth instance** par `createUserWithEmailAndPassword` karta tha — Firebase create-user ke baad **automatically naye user mein sign-in kar deta hai**, matlab CC apna session kho deta tha; code mein CC ka apna password maang kar `signInWithEmailAndPassword` se vaapis aana padta tha (error aane par CC mid-work logout!). **♻️ FIX:** M16 ka `createStaffAuthUser` (secondary-app) use kiya — CC session 100% intact, re-auth password field ki zaroorat hi nahi rahi (UI pe green info card). Behavior same: same profile doc shape, same staff list. Technical reason fully documented — golden rule compliant refactor.

---

## MODULE 18 — SCORECARD

| Metric | Before → **After** | Justification |
|--------|--------------------|---------------|
| **Overall Score** | 58 → **74** | Session-safe refactor + masters registry + backup + numbering + FY |
| **Completion %** | 60 → **76** | Core masters exist; config infra + backup added |
| **UI Score** | 78 | Settings tabs established; ★ Masters screen consistent |
| **Code Quality** | 80 | Transaction counters defensive; backup serializer handles nested Timestamps |
| **Database Quality** | 76 | 3 config collections; fallback-driven consumers |
| **Architecture** | 74 | Masters linked not duplicated; code vs DB masters honestly registry'd |
| **Security** | 56 | CC-gates client-side; rules absent (repo-wide) |
| **Performance** | 82 | Parallel counts, sequential progress backup |
| **Scalability** | 68 | Single-company ✓; backup size growth → cloud export Future |
| **Government ERP** | 78 | Backup + numbering + FY = audit/inspection-ready |

### Top 10 Existing Features Worth Keeping (M18)
1. UnitConfig real-time context (onSnapshot — headers instant update)
2. Settings change-password WITH re-authentication (security-correct)
3. Password reset email flow (Settings)
4. Staff list toggle-deactivate (disable-not-delete)
5. Batch Master management screen
6. Subject Master CRUD (`subject_master` + isActive pattern)
7. Leave Type quota management (Leave Types tab)
8. Duty Type master
9. Vendor master with dues linkage
10. Module-managed numbering schemes (LV-/IS-/RT-)

### Top 10 Features Updated / Added (M18) ★
1. ♻️ Settings staff creation → session-safe secondary-app (re-auth password retired)
2. ★ Financial Year field (auto-computed, editable, context-wide)
3. ★ Training Session label field
4. ★ System Masters Registry (16 masters, DB-vs-CODE truth table, live counts)
5. ★ `dropdown_masters` collection + editor UI
6. ★ Medical categories DB-driven (first live consumer, fallback-safe)
7. ★ `system_counters` transaction-safe numbering + broadcast consumer
8. ★ Backup Center — 42-collection JSON export
9. ★ Masters → existing manager screens deep-links (no duplication)
10. ★ UnitConfigContext extended (FY/session defaults for print/reports use)

### Top 10 Missing Features (M18) — Backlog
1. 🔴 Firestore security rules (repo-wide Critical)
2. Restore import wizard (JSON → Firestore) — High
3. Platoon/Rank masters DB migration (3+ hardcoded lists drift risk) — High
4. Central kit/item catalog (`kit_templates`) — Medium (M6 backlog)
5. Notification template master (DB) — Medium
6. Custom fields engine — Future
7. Config versioning/history (who changed what, diff) — Medium
8. Selective collection backup + scheduled backup — Medium
9. Session date-range enforcement (lock out-of-session entries) — Low
10. Master data usage analytics (konsa value kitni baar use hota hai) — Low

### Top 10 Critical Problems (M18)
1. 🔴 No Firestore security rules (recurring #1)
2. ~~CC session-killing user creation~~ ♻️ FIXED is audit mein
3. ~~No backup capability at all~~ ★ FIXED
4. ~~No numbering infrastructure~~ ★ FIXED
5. ~~No FY/session config~~ ★ FIXED
6. Platoon lists 3 jagah hardcoded — inconsistency risk (jaise kisi ne "P5" ek jagah badla aur dusri jagah nahi) — High backlog
7. Rank list hardcoded — same risk
8. Config changes ka history nahi (sirf last updatedBy) — Medium
9. Restore process manual — High (documented)
10. Backup client-side RAM mein build hota hai — bahut bade data par browser strain (scale note)

### Top 10 Future Enhancements (M18)
1. firestore.rules (platform-wide)
2. JSON restore wizard with dry-run + validation
3. Platoon/Rank DB masters + consumers refactor
4. Scheduled automatic backups (Cloud Function → Storage)
5. kit_templates central catalog
6. Notification template master + variable engine
7. Config change history viewer
8. Master diff/export CSV per master
9. Multi-company master inheritance (HQ → coy)
10. Numbering scheme customizer (prefix/format per doc type)

---

# ══════════════════════════════════════════════
# FINAL COMPARISON TABLE
# ══════════════════════════════════════════════

| Module | Completion % (Before → After) | Existing Features | Update Required | New Features Required | Production Ready |
|--------|------------------------------|-------------------|-----------------|-----------------------|------------------|
| **M17 — Notifications** | 38 → **70** | Computed bell, 6 generators, priorities, read-cache | Individual composer, batch/platoon targeting, retention policy, auto-emitters (inventory/finance) | FCM push, email, SMS/WhatsApp, DB templates | 🟡 In-app ✅ for single-company; push pending |
| **M18 — Settings & Masters** | 60 → **76** | Unit config, 8 working masters, password flows, 4 numbering schemes | Restore wizard, platoon/rank DB migration, config history | Custom fields, scheduled backups, template master | 🟡 Near — rules + restore pending |

---

# ══════════════════════════════════════════════
# PRIORITY TABLE (M17 + M18 Combined)
# ══════════════════════════════════════════════

## 🔴 CRITICAL
| # | Item | Module | Status |
|---|------|--------|--------|
| 1 | Session-killing staff creation in Settings | M18 | ♻️ **FIXED** |
| 2 | No notification persistence/broadcast possible | M17 | ★ **FIXED** |
| 3 | Firestore + Storage security rules (repo-wide) | Both | ⏳ OPEN — Phase 1 first |

## 🟠 HIGH
| # | Item | Module | Status |
|---|------|--------|--------|
| 4 | Persistent notifications collection + API | M17 | ★ **FIXED** |
| 5 | Broadcast + emergency alerts (role-wise) | M17 | ★ **FIXED** |
| 6 | Event emitters (leave/schedule/exam/medical) | M17 | ★ **FIXED** |
| 7 | Multi-device read tracking (readBy[]) | M17 | ★ **FIXED** |
| 8 | Sent history + delivery badges | M17 | ★ **FIXED** |
| 9 | Backup Center (42-collection JSON export) | M18 | ★ **FIXED** |
| 10 | Financial Year + Session config | M18 | ★ **FIXED** |
| 11 | Transaction-safe numbering counters | M18 | ★ **FIXED** |
| 12 | Dropdown Masters infra + medical consumer | M18 | ★ **FIXED** |
| 13 | Restore import wizard | M18 | ⏳ OPEN |
| 14 | Platoon/Rank DB masters (3-list drift) | M18 | ⏳ OPEN |

## 🟡 MEDIUM
| # | Item |
|---|------|
| 15 | Individual message composer UI (schema-ready) |
| 16 | Inventory/finance/security auto-emitters |
| 17 | Notification retention cleanup (30-day purge) |
| 18 | Batch/platoon-wise targeting |
| 19 | DB notification templates with variables |
| 20 | Config change history viewer |
| 21 | Selective/scheduled backups |

## 🟢 LOW / FUTURE
| # | Item |
|---|------|
| 22 | FCM push + service worker |
| 23 | Email/SMS/WhatsApp gateways |
| 24 | Custom fields engine |
| 25 | Master usage analytics |
| 26 | Multilingual templates |
| 27 | Quiet hours / notification preferences |

---

# ══════════════════════════════════════════════
# FINAL IMPLEMENTATION STRATEGY
# ══════════════════════════════════════════════

### ✅ KEEP AS IT IS
1. Computed alert engine — 6 generators (untouched, still feeds bell)
2. NotificationBell component design (sirf footer link ★ add hua)
3. Priority model + config registry
4. UnitConfig context + Settings edit flow
5. Batch/Subject/LeaveType/DutyType/Vendor masters (unmodified)
6. Module-managed numbering (LV-/IS-/RT-/batch_N)
7. Settings change-password + reset flows
8. TestType/exam-type code master (type-safety justified)

### 🔄 UPDATE EXISTING (Done ★)
1. useNotifications — computed + stored merge model
2. notification.types — 7 new types + StoredNotification + target roles
3. Medical categories — hardcoded → DB-driven with fallback
4. UnitConfig — FY + session fields (context + settings + view)
5. Sidebar (ccSystem) + App routes — 2 new entries

### ♻️ REFACTOR EXISTING (Done ♻️ — technical reason documented)
1. **Settings staff creation** — live-auth session-swap → secondary-app session-safe provisioning (M16 `createStaffAuthUser`); CC re-auth password requirement retired

### ➕ ADD NEW FEATURE (Done ★)
1. `notification.api.ts` — send/fetch/history/read-tracking + 4 event emitters
2. `NotificationCenterScreen.tsx` — inbox + broadcast + sent history
3. `masters.api.ts` — dropdown masters + getNextNumber + backup export
4. `SystemMastersScreen.tsx` — registry + dropdown editor + numbering + backup center
5. Collections: `notifications`, `dropdown_masters`, `system_counters`

### ➕ ADD NEW (Backlog — never forget)
1. firestore.rules + storage.rules
2. Restore wizard
3. Platoon/Rank DB migration
4. FCM/email/SMS pipelines

---

# ══════════════════════════════════════════════
# PHASED ROADMAP (M17 + M18)
# ══════════════════════════════════════════════

## Phase 1 — Stabilization
1. firestore.rules — `notifications` (read: role-match, write: emitters/CC), `dropdown_masters`/`system_counters` (CC write, all read)
2. Notification retention policy (90-day soft cap doc)
3. Emergency broadcast drill (test with all 4 roles logged in)
4. Platoon/Rank drift audit — 3 lists same hain verify karke doc

## Phase 2 — Enhancement
1. Individual composer + batch/platoon targeting
2. Inventory/finance/security auto-emitters
3. Restore import wizard (dry-run + validation)
4. DB notification templates (dropdown_masters consumer)
5. Config change history

## Phase 3 — Automation
1. FCM push pipeline (service worker + tokens + Cloud Function on-create trigger)
2. Scheduled backups (Cloud Function → Storage bucket)
3. Failed-login spike alert to CC (login_history watch)
4. Daily email digest (CC summary)
5. Notification cleanup cron

## Phase 4 — Enterprise Readiness
1. SMS/WhatsApp gateway (govt-approved provider)
2. Per-user notification preferences + quiet hours
3. Delivery analytics dashboard (read-rates)
4. Multi-company broadcast hierarchy (HQ → coy)
5. Master data sync across companies

---

# ══════════════════════════════════════════════
# FINAL SAFETY LIST
# ══════════════════════════════════════════════

### 🛡️ Never Remove
1. Computed alert engine + bell (users depend on live awareness)
2. Priority sort + config registry
3. `unitConfig/main` doc shape (headers/context depend)
4. Settings re-auth change-password
5. Module numbering schemes (LV-/IS-/RT-)
6. ★ `notifications` collection + readBy[] model
7. ★ fire-and-forget emitter pattern (business-flow safety)
8. ★ master fallback pattern (DB → hardcoded default)
9. LocalStorage read-cache (computed alerts)
10. Disable-not-delete user model

### 🔧 Safe To Refactor
1. Platoon/Rank lists → DB masters (fallback pattern se)
2. Backup export → Cloud Function (scale par)
3. readBy[] → per-user read docs (growth par)
4. Event templates → DB templates
5. Reports/Notification counts → denormalized counters

### ➕ Must Add (Top 5)
1. **firestore.rules + storage.rules** (sabse pehle)
2. Restore import wizard
3. Notification retention cleanup
4. Individual/batch targeting UI
5. Inventory/finance auto-emitters

### 🚀 Future Version Features
1. FCM/SMS/WhatsApp/Email pipelines
2. Custom fields engine
3. Scheduled cloud backups
4. Notification analytics + preferences
5. Multi-company master inheritance

---

## FILES CHANGED IN THIS AUDIT
| File | Change |
|------|--------|
| `src/features/notifications/notification.api.ts` | ➕ NEW — persistent API + 4 event emitters |
| `src/features/notifications/notification.types.ts` | 🔄 +7 types, StoredNotification, target roles, configs |
| `src/features/notifications/useNotifications.ts` | 🔄 computed+stored merge, Firestore read-tracking |
| `src/features/notifications/NotificationCenterScreen.tsx` | ➕ NEW — inbox/broadcast/history dashboard |
| `src/features/notifications/NotificationBell.tsx` | 🔄 "View All →" footer link |
| `src/features/ustad/api/leave.api.ts` | 🔄 approve/reject emit |
| `src/features/ustad/api/schedule.api.ts` | 🔄 reschedule emit (+optional changedByName) |
| `src/features/ustad/api/testRecord.api.ts` | 🔄 results-published emit |
| `src/features/medical/MedicalRegisterScreen.tsx` | 🔄 medical alert emit + DB-driven categories |
| `src/features/system/masters.api.ts` | ➕ NEW — dropdown masters + counters + backup |
| `src/features/system/SystemMastersScreen.tsx` | ➕ NEW — registry/editor/numbering/backup |
| `src/features/system/SettingsScreen.tsx` | ♻️ session-safe creation + FY/session fields |
| `src/contexts/UnitConfigContext.tsx` | 🔄 FY/session context fields |
| `src/App.tsx` + `src/components/layout/Sidebar.tsx` | 🔄 2 routes + 2 nav links |

**Verification:** `tsc --noEmit` ✅ clean (strict + noUnusedLocals) · `vite build` ✅ pass (2,447 modules)
**Existing functionality removed/replaced:** ZERO breaking — 1 documented refactor (Settings creation, behavior-preserving, session-safer)
