// src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { EnterpriseLayout } from './components/layout/EnterpriseLayout';
import SeedStaffData from './features/system/SeedStaffData';
// --- AI Agent ---
import AIAgentScreen from './features/aiAgent/components/AIAgentScreen';

// --- Contexts ---
import { AuthProvider }       from './contexts/AuthContext';
import { UnitConfigProvider } from './contexts/UnitConfigContext';
import { BatchProvider }      from './contexts/BatchContext';
import { LoginScreen }        from './features/auth/LoginScreen';
import { ProtectedRoute }     from './components/ProtectedRoute';

// --- Dashboards ---
import { CompanyCommanderDashboard } from './features/dashboard/CompanyCommanderDashboard';
import { QuarterMasterDashboard }    from './features/dashboard/QuarterMasterDashboard';
import { ClerkDashboard }            from './features/dashboard/ClerkDashboard';
import { UstadDashboard }            from './features/dashboard/UstadDashboard';

// --- QM Modules ---
import { InventoryIssueScreen }  from './features/quartermaster/InventoryIssueScreen';
import { MessBoySalaryScreen }   from './features/quartermaster/MessBoySalaryScreen';

// --- Finance (4 Funds) ---
import { FundsDashboard }          from './features/finance/FundsDashboard';
import { MessFundScreen }          from './features/messFund/MessFundScreen';
import { TrainingFundScreen }      from './features/trainingFund/TrainingFundScreen';
import { CompanyAssetsFundScreen } from './features/companyAssets/CompanyAssetsFundScreen';
import { GeneralFundScreen }       from './features/finance/generalFund/GeneralFundScreen';

// --- Vendor Module ---
import { VendorManagementScreen } from './features/finance/vendors/VendorManagementScreen';
import { VendorPaymentScreen }    from './features/finance/vendors/VendorPaymentScreen';

// --- Clerk / Operations ---
import { TraineeProfileScreen }       from './features/students/TraineeProfileScreen';
import { DocumentVerificationScreen } from './features/students/DocumentVerificationScreen';
import { WelfareDemographicsScreen }  from './features/welfare/WelfareDemographicsScreen';
import { WeeklyProgramScreen }        from './features/weekly/WeeklyProgramScreen';
import { MedicalRegisterScreen }      from './features/medical/MedicalRegisterScreen';
import { DeputationScreen } from './features/ustad/screens';
// --- Dashboard Sub-Modules ---
import { AbsentManagement }  from './features/dashboard/AbsentManagement';
import { TestRecordsScreen } from './features/ustad/screens';
// --- 🆕 Trainee Daily Attendance Register ---
import { TraineeAttendanceScreen } from './features/attendance/TraineeAttendanceScreen';
// --- System & Config ---
import { ReportsScreen }      from './features/system/ReportsScreen';
import { SettingsScreen }     from './features/system/SettingsScreen';
import { UserManagementPage } from './features/system/UserManagementPage';
// --- ★ Module 17-18 Audit: Notification Center + System Masters ---
import { NotificationCenterScreen } from './features/notifications/NotificationCenterScreen';
import { SystemMastersScreen }      from './features/system/SystemMastersScreen';
// --- ★ Module 19-20 Audit: System Health + Automation Center ---
import { SystemHealthScreen }       from './features/system/SystemHealthScreen';
import { AutomationCenterScreen }   from './features/automation/AutomationCenterScreen';
import { logClientError }           from './features/system/systemHealth.api';
import { TrainingScheduleScreen } from './features/ustad/screens';

// --- Batch ---
import { BatchManagementScreen } from './features/batch/BatchManagementScreen';
import { BatchProgressScreen } from './features/ustad/screens';

// ─────────────────────────────────────────────
// 🆕 STAFF MANAGEMENT MODULE IMPORTS
// ─────────────────────────────────────────────
import {
  StaffManagementScreen,
  SubjectMasterScreen,
  SubjectAssignmentScreen,
  LeaveManagementScreen,
  AttendanceScreen,
  DutyManagementScreen,
} from './features/ustad/screens';



// ─────────────────────────────────────────────
// ROLE GROUPS
// ─────────────────────────────────────────────
const ALL_ROLES   = ['Company Commander', 'Quarter Master', 'Clerk', 'Ustad'];
const QM_ROLES    = ['Company Commander', 'Quarter Master'];
const CLERK_ROLES = ['Company Commander', 'Clerk'];

// Welfare cell — CC + Clerk plan karte hain, QM ration/budget ke liye dekh sakta hai
const WELFARE_ROLES = ['Company Commander', 'Clerk', 'Quarter Master'];


// Staff module access — CC + Clerk can manage, Ustad can view own
const STAFF_MANAGE_ROLES = ['Company Commander', 'Clerk'];
const STAFF_VIEW_ROLES   = ['Company Commander', 'Clerk', 'Ustad'];

function App() {
  // ★ Module 19: Global client error monitoring → error_logs
  // (dedupe + throttle built-in; kabhi app ko break nahi karta)
  React.useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      logClientError('window.onerror', ev.message ?? 'unknown', `${ev.filename ?? ''}:${ev.lineno ?? ''}`);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason instanceof Error ? ev.reason.message : String(ev.reason ?? 'unhandled rejection');
      logClientError('unhandledrejection', reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return (
    <AuthProvider>
      <UnitConfigProvider>
        <BatchProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>

              {/* ── Public ── */}
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/"      element={<Navigate to="/login" replace />} />

              {/* ════════════════════════════════
                  DASHBOARDS
              ════════════════════════════════ */}
              <Route
                path="/commander"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><CompanyCommanderDashboard /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
                            <Route
                path="/seed-staff"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><SeedStaffData /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quartermaster"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><QuarterMasterDashboard /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clerk"
                element={
                  <ProtectedRoute allowedRoles={CLERK_ROLES}>
                    <EnterpriseLayout><ClerkDashboard /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ustad"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander', 'Ustad']}>
                    <EnterpriseLayout><UstadDashboard /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* ════════════════════════════════
                  BATCH MANAGEMENT
              ════════════════════════════════ */}
              <Route
                path="/batches"
                element={
                  // 🔄 UPDATE — Task 4: pehle ALL_ROLES tha (Ustad/QM bhi khol sakta tha).
                  // Ab sirf CC + Clerk (Clerk ka "Batch View" legit use-case hai —
                  // sidebar me bhi sirf CC/Clerk ko ye link dikhta hai).
                  // Write actions screen ke andar pehle se CC-gated hain aur
                  // Firestore rules DB-level pe bhi enforce karti hain.
                  <ProtectedRoute allowedRoles={CLERK_ROLES}>
                    <EnterpriseLayout><BatchManagementScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* ════════════════════════════════
                  QM MODULE ROUTES
              ════════════════════════════════ */}
              <Route
                path="/issue-kit"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><InventoryIssueScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mess-boy-salary"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><MessBoySalaryScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><ReportsScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* ════════════════════════════════
                  FINANCE ROUTES — 4 FUNDS
              ════════════════════════════════ */}
              <Route
                path="/funds"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><FundsDashboard /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mess-fund"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><MessFundScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/training-fund"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><TrainingFundScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/company-assets-fund"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><CompanyAssetsFundScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/general-fund"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><GeneralFundScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* ════════════════════════════════
                  VENDOR ROUTES
              ════════════════════════════════ */}
              <Route
                path="/vendors"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><VendorManagementScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor-payments"
                element={
                  <ProtectedRoute allowedRoles={QM_ROLES}>
                    <EnterpriseLayout><VendorPaymentScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* ── Old URL Redirects ── */}
              <Route path="/purchase"      element={<Navigate to="/funds" replace />} />
              <Route path="/mess-recovery" element={<Navigate to="/funds" replace />} />

              {/* ════════════════════════════════
                  CLERK / OPERATIONS ROUTES
              ════════════════════════════════ */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={CLERK_ROLES}>
                    <EnterpriseLayout><TraineeProfileScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute allowedRoles={CLERK_ROLES}>
                    <EnterpriseLayout><DocumentVerificationScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/medical-register"
                element={
                  <ProtectedRoute allowedRoles={CLERK_ROLES}>
                    <EnterpriseLayout><MedicalRegisterScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* ════════════════════════════════
                  WELFARE & DEMOGRAPHICS
                  Trainee registration data se state/religion/
                  language wise counts + festival welfare planning
              ════════════════════════════════ */}
              <Route
                path="/welfare-demographics"
                element={
                  <ProtectedRoute allowedRoles={WELFARE_ROLES}>
                    <EnterpriseLayout><WelfareDemographicsScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/weekly-program"
                element={
                  <ProtectedRoute allowedRoles={CLERK_ROLES}>
                    <EnterpriseLayout><WeeklyProgramScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              
              

              {/* ════════════════════════════════
                  DASHBOARD SUB-MODULES
              ════════════════════════════════ */}
              <Route
                path="/absent-management"
                element={
                  <ProtectedRoute allowedRoles={CLERK_ROLES}>
                    <EnterpriseLayout><AbsentManagement /></EnterpriseLayout>
                  </ProtectedRoute>
                }
             
            
              />
              {/* 🆕 Trainee Daily Hazri Register (Parade/PT/Roll Call) */}
              <Route
                path="/trainee-attendance"
                element={
                  <ProtectedRoute allowedRoles={CLERK_ROLES}>
                    <EnterpriseLayout><TraineeAttendanceScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/test-records"
                element={
                  <ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}>
                    <EnterpriseLayout><TestRecordsScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              {/* ════════════════════════════════
                  AI AGENT
              ════════════════════════════════ */}
              <Route
                path="/ai-agent"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><AIAgentScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schema-generator"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><AIAgentScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* ════════════════════════════════
                  🆕 STAFF MANAGEMENT MODULE
              ════════════════════════════════ */}

              {/* Staff List — View all instructors */}
              <Route
                path="/staff"
                element={
                  <ProtectedRoute allowedRoles={STAFF_VIEW_ROLES}>
                    <EnterpriseLayout><StaffManagementScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/training-schedule"
                element={
                  <ProtectedRoute allowedRoles={STAFF_VIEW_ROLES}>
                    <EnterpriseLayout><TrainingScheduleScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              {/* Subject Master — Admin + Clerk */}
              <Route
                path="/subjects"
                element={
                  <ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}>
                    <EnterpriseLayout><SubjectMasterScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deputation"
                element={
                  <ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}>
                    <EnterpriseLayout><DeputationScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              {/* Subject Assignment — Admin + Clerk */}
              <Route
                path="/subject-assignment"
                element={
                  <ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}>
                    <EnterpriseLayout><SubjectAssignmentScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* Staff Attendance */}
              <Route
                path="/staff-attendance"
                element={
                  <ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}>
                    <EnterpriseLayout><AttendanceScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* Leave Management */}
              <Route
                path="/staff-leave"
                element={
                  <ProtectedRoute allowedRoles={STAFF_VIEW_ROLES}>
                    <EnterpriseLayout><LeaveManagementScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* Duty Management */}
              <Route
                path="/duty-management"
                element={
                  <ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}>
                    <EnterpriseLayout><DutyManagementScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/batch-progress"
                element={
                  <ProtectedRoute allowedRoles={STAFF_VIEW_ROLES}>
                    <EnterpriseLayout><BatchProgressScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              {/* ════════════════════════════════
                  SYSTEM ROUTES (CC Only)
              ════════════════════════════════ */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><SettingsScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><UserManagementPage /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              {/* ★ Module 17: Notification Center — ALL roles (apne role ke messages) */}
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute allowedRoles={ALL_ROLES}>
                    <EnterpriseLayout><NotificationCenterScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              {/* ★ Module 18: System Masters & Backup — CC only */}
              <Route
                path="/system-masters"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><SystemMastersScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              {/* ★ Module 19: System Health & Administration — CC only */}
              <Route
                path="/system-health"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><SystemHealthScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />
              {/* ★ Module 20: Automation Center — CC only */}
              <Route
                path="/automation"
                element={
                  <ProtectedRoute allowedRoles={['Company Commander']}>
                    <EnterpriseLayout><AutomationCenterScreen /></EnterpriseLayout>
                  </ProtectedRoute>
                }
              />

              {/* ── 404 Fallback ── */}
              <Route path="*" element={<Navigate to="/login" replace />} />

            </Routes>
          </Router>
        </BatchProvider>
      </UnitConfigProvider>
    </AuthProvider>
  );
}

export default App;