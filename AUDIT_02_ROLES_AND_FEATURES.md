# FCOY ERP — ROLES & FEATURES

## ROLES

| Role | Short | Dashboard | Routes | Key Permissions |
|------|-------|-----------|--------|-----------------|
| Company Commander | CC | `/commander` (2,726 lines) | All routes | Full access: all CRUD, user management, subscription, settings, delete |
| Clerk | Clerk | `/clerk` (1,079 lines) | Trainee/staff/attendance/leave/duty/training/reports | canManage: staff CRUD, trainee CRUD, attendance, duty, subjects |
| Quarter Master | QM | `/quartermaster` (1,064 lines) | Finance/inventory/vendors/mess-boy/reports | canFinance: all fund types, inventory, vendors, bills |
| Ustad | Ustad | `/ustad` (20 lines — placeholder) | Own dashboard, staff view, training view, corrective actions | Read-only for most; can submit corrective actions |
| Senior Officer / Inspector | SO | `/so-dashboard` | Inspections, findings, corrective actions | Batch-scoped inspection/finding CRUD, verify/close findings |
| Developer / Owner | Dev | `/dev-practice` | Practice Console, Customers, Subscriptions, Test Batch | Master seed, wipe, snapshot/cleanup, customer management |

---

## ROUTE MAP

| Route | Screen | Allowed Roles | LOC |
|-------|--------|---------------|-----|
| `/login` | LoginScreen | Public | 188 |
| `/first-run` | FirstRunSetupScreen | Public (first time only) | 430 |
| `/commander` | CompanyCommanderDashboard | CC | 2,726 |
| `/clerk` | ClerkDashboard | CC, Clerk | 1,079 |
| `/quartermaster` | QuarterMasterDashboard | CC, QM | 1,064 |
| `/ustad` | UstadDashboard | CC, Ustad | 20 |
| `/so-dashboard` | SODashboard | CC, SO | — |
| `/so-inspections` | SOInspectionsScreen | CC, SO, Clerk, QM, Ustad | — |
| `/batches` | BatchManagementScreen | ALL | — |
| `/trainees` | TraineeProfileScreen | CC, Clerk | 1,623 |
| `/documents` | DocumentVerificationScreen | CC, Clerk | 942 |
| `/staff` | StaffManagementScreen | CC, Clerk, Ustad (view) | 458 |
| `/staff-attendance` | AttendanceScreen | CC, Clerk | 894 |
| `/staff-leave` | LeaveManagementScreen | CC, Clerk, Ustad (view) | 1,550 |
| `/duty-management` | DutyManagementScreen | CC, Clerk | 1,098 |
| `/training-schedule` | TrainingScheduleScreen | CC, Clerk, Ustad (view) | 706 |
| `/subjects` | SubjectMasterScreen | CC, Clerk | 413 |
| `/subject-assignment` | SubjectAssignmentScreen | CC, Clerk | 531 |
| `/test-records` | TestRecordsScreen | CC, Clerk | 1,892 |
| `/batch-progress` | BatchProgressScreen | CC, Clerk, Ustad (view) | 997 |
| `/deputation` | DeputationScreen | CC, Clerk | 768 |
| `/medical` | MedicalRegisterScreen | CC, Clerk | 417 |
| `/welfare` | WelfareDemographicsScreen | CC, Clerk, QM | 443 |
| `/inventory` | InventoryHubScreen | CC, QM | 84 |
| `/issue-kit` | InventoryIssueScreen | CC, QM | 1,913 |
| `/mess-boy-salary` | MessBoySalaryScreen | CC, QM | — |
| `/funds` | FundsDashboard | CC, QM | — |
| `/mess-fund` | MessFundScreen | CC, QM | 2,147 |
| `/training-fund` | TrainingFundScreen | CC, QM | 2,814 |
| `/general-fund` | GeneralFundScreen | CC, QM | 1,608 |
| `/company-assets-fund` | CompanyAssetsFundScreen | CC, QM | 2,079 |
| `/vendors` | VendorManagementScreen | CC, QM | 979 |
| `/vendor-payments` | VendorPaymentScreen | CC, QM | 1,416 |
| `/reports` | ReportsScreen | ALL | 2,174 |
| `/settings` | SettingsScreen | CC | 1,211 |
| `/users` | UserManagementPage | CC | 486 |
| `/subscription` | SubscriptionScreen | CC | — |
| `/company-monitor` | CompanyMonitorScreen | CC | 241 |
| `/ai-agent` | AIAgentScreen | CC | 423 |
| `/dev-practice` | DevPracticeScreen | Authenticated (isDeveloper guard) | 1,461 |
| `/weekly-program` | WeeklyProgramScreen | CC, Clerk | — |

---

## FEATURE DEPTH BY ROLE

### Company Commander (CC)
- **Full access to everything** — all routes, all CRUD, all delete
- User Management (create staff accounts via Cloud Function)
- Settings (unit config, company name)
- Subscription management
- AI Agent
- Developer panel (if isDeveloper)
- Approve/reject leave
- Delete any record

### Clerk
- Trainee registration, documents, medical
- Staff management (create, edit)
- Attendance marking
- Leave management (create, cannot approve)
- Duty management
- Training schedule, subjects, test records
- Batch management
- Deputation records
- Reports
- Welfare demographics (view)

### Quarter Master (QM)
- Finance: all 4 fund types (mess, training, general, company assets)
- Vendor management + payments
- Inventory hub + kit issue
- Mess boy salaries
- Bills/receipts
- Welfare demographics (view)
- Reports (QM scope)

### Ustad
- Own dashboard (placeholder)
- View staff, attendance, leave, duty, training schedule
- View batch progress, test records
- Submit corrective actions (findings assigned to their role)
- Cannot create/edit/delete most records

### Senior Officer / Inspector (SO)
- Inspection dashboard
- Create inspections (batch-scoped to assigned batches)
- Create findings
- Verify/close findings
- Assign corrective actions to roles
- Cannot approve leave, manage users, touch finance

### Developer / Owner
- Practice Console (snapshot, seed, cleanup)
- Master Seed (150 trainees, 20 staff, 10 subjects, full data)
- Customer management (create CC accounts)
- Subscription management (assign, renew, cancel)
- Company Monitor
- X-Ray (database scan)
