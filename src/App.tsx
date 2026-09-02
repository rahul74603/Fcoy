// src/App.tsx

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { EnterpriseLayout } from './components/layout/EnterpriseLayout';
// --- AI Agent ---
import AIAgentScreen from './features/aiAgent/components/AIAgentScreen';

// --- Contexts ---
import { AuthProvider }         from './contexts/AuthContext';
import { UnitConfigProvider }   from './contexts/UnitConfigContext';
import { BatchProvider }        from './contexts/BatchContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { LoginScreen }          from './features/auth/LoginScreen';
import { FirstRunSetupScreen }  from './features/auth/FirstRunSetupScreen';
import { ProtectedRoute }       from './components/ProtectedRoute';

// --- Subscription ---
import { SubscriptionScreen } from './features/subscription/SubscriptionScreen';

// --- Developer Practice ---
import { DevPracticeScreen } from './features/developer/DevPracticeScreen';
import { CompanyMonitorScreen } from './features/developer/CompanyMonitorScreen';
import { SUBSCRIPTION_ENABLED } from './features/subscription/subscription.config';

// --- Dashboards ---
import { CompanyCommanderDashboard } from './features/dashboard/CompanyCommanderDashboard';
import { QuarterMasterDashboard }    from './features/dashboard/QuarterMasterDashboard';
import { ClerkDashboard }            from './features/dashboard/ClerkDashboard';
import { UstadDashboard }            from './features/dashboard/UstadDashboard';

// --- QM Modules ---
import { InventoryIssueScreen }  from './features/quartermaster/InventoryIssueScreen';
import InventoryHubScreen from './features/inventory/InventoryHubScreen';
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

// --- Senior Officer / Inspector ---
import SOInspectionHub from './features/inspection/screens/SOInspectionHub';

// --- Dashboard Sub-Modules ---
import { AbsentManagement }  from './features/dashboard/AbsentManagement';
import { SyllabusTrackingScreen } from './features/syllabus/screens/SyllabusTrackingScreen';
import { JoiningWorkflowScreen } from './features/joining/screens/JoiningWorkflowScreen';
import { SessionLogScreen } from './features/trainingSessions/screens/SessionLogScreen';
import { AuditLogScreen } from './features/auditLog/screens/AuditLogScreen';
import { ClearanceScreen } from './features/clearance/screens/ClearanceScreen';
import { FinalBoardScreen } from './features/finalResult/screens/FinalBoardScreen';
import { PeriodAttendanceScreen } from './features/periodAttendance/screens/PeriodAttendanceScreen';
import { MismatchDashboardScreen } from './features/mismatch/screens/MismatchDashboardScreen';
import { LeaveManagementScreen } from './features/leaveMgmt/screens/LeaveManagementScreen';
import { MovementRegisterScreen } from './features/movement/screens/MovementRegisterScreen';
import { DisciplineRegisterScreen } from './features/discipline/screens/DisciplineRegisterScreen';
import { TestRecordsScreen } from './features/ustad/screens';

// --- System & Config ---
import { ReportsScreen }      from './features/system/ReportsScreen';
import { SettingsScreen }     from './features/system/SettingsScreen';
import { UserManagementPage } from './features/system/UserManagementPage';
import { TrainingScheduleScreen } from './features/ustad/screens';

// --- Batch ---
import { BatchManagementScreen } from './features/batch/BatchManagementScreen';
import { BatchProgressScreen } from './features/ustad/screens';

// --- Staff Management ---
import {
  StaffManagementScreen,
  SubjectMasterScreen,
  SubjectAssignmentScreen,
  LeaveManagementScreen as StaffLeaveManagementScreen,
  AttendanceScreen,
  DutyManagementScreen,
} from './features/ustad/screens';

// --- Trainee Module ---
import { TraineeDashboard } from './features/traineeModule/screens/TraineeDashboard';
import { TraineeManagementScreen } from './features/traineeModule/screens/TraineeManagementScreen';

// ─────────────────────────────────────────────
// ROLE GROUPS
// ─────────────────────────────────────────────
const ALL_ROLES   = ['Company Commander', 'Quarter Master', 'Clerk', 'Ustad'];
const QM_ROLES    = ['Company Commander', 'Quarter Master'];
const CLERK_ROLES = ['Company Commander', 'Clerk'];
const WELFARE_ROLES = ['Company Commander', 'Clerk', 'Quarter Master'];
const STAFF_MANAGE_ROLES = ['Company Commander', 'Clerk'];
const STAFF_VIEW_ROLES   = ['Company Commander', 'Clerk', 'Ustad'];
const SO_ROLES           = ['Company Commander', 'Senior Officer / Inspector'];
const SO_INSPECTIONS_ROLES = [
  'Company Commander', 'Senior Officer / Inspector',
  'Clerk', 'Quarter Master', 'Ustad',
];

function App() {
  return (
    <AuthProvider>
      <UnitConfigProvider>
        <SubscriptionProvider>
        <BatchProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>

              {/* ── Public ── */}
              <Route path="/login"     element={<LoginScreen />} />
              <Route path="/first-run" element={<FirstRunSetupScreen />} />
              <Route path="/"          element={<Navigate to="/login" replace />} />

              {/* ════════════════════════════════
                  NEW MODULES (Phase 1-10)
              ════════════════════════════════ */}
              <Route path="/discipline-register" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><DisciplineRegisterScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/movement-register" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><MovementRegisterScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/leave-management" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><LeaveManagementScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/mismatch-dashboard" element={<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><MismatchDashboardScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/period-attendance" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><PeriodAttendanceScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/syllabus-tracking" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><SyllabusTrackingScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/final-board" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><FinalBoardScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/clearance" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><ClearanceScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/joining-workflow" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><JoiningWorkflowScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/training-sessions" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><SessionLogScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/audit-log" element={<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><AuditLogScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  DASHBOARDS
              ════════════════════════════════ */}
              <Route path="/commander" element={<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><CompanyCommanderDashboard /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/quartermaster" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><QuarterMasterDashboard /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/clerk" element={<ProtectedRoute allowedRoles={CLERK_ROLES}><EnterpriseLayout><ClerkDashboard /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/ustad" element={<ProtectedRoute allowedRoles={['Company Commander', 'Ustad']}><EnterpriseLayout><UstadDashboard /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  BATCH MANAGEMENT
              ════════════════════════════════ */}
              <Route path="/batches" element={<ProtectedRoute allowedRoles={ALL_ROLES}><EnterpriseLayout><BatchManagementScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  CENTRAL INVENTORY HUB
              ════════════════════════════════ */}
              <Route path="/inventory" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><InventoryHubScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  QM MODULE ROUTES
              ════════════════════════════════ */}
              <Route path="/issue-kit" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><InventoryIssueScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/mess-boy-salary" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><MessBoySalaryScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={ALL_ROLES}><EnterpriseLayout><ReportsScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  FINANCE ROUTES — 4 FUNDS
              ════════════════════════════════ */}
              <Route path="/funds" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><FundsDashboard /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/mess-fund" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><MessFundScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/training-fund" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><TrainingFundScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/company-assets-fund" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><CompanyAssetsFundScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/general-fund" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><GeneralFundScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  VENDOR ROUTES
              ════════════════════════════════ */}
              <Route path="/vendors" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><VendorManagementScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/vendor-payments" element={<ProtectedRoute allowedRoles={QM_ROLES}><EnterpriseLayout><VendorPaymentScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  SENIOR OFFICER / INSPECTOR MODULE
              ════════════════════════════════ */}
              <Route path="/so-dashboard" element={<ProtectedRoute allowedRoles={SO_ROLES}><EnterpriseLayout><SOInspectionHub /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/so-inspections" element={<ProtectedRoute allowedRoles={SO_INSPECTIONS_ROLES}><EnterpriseLayout><SOInspectionHub /></EnterpriseLayout></ProtectedRoute>} />

              {/* ── Old URL Redirects ── */}
              <Route path="/purchase"      element={<Navigate to="/funds" replace />} />
              <Route path="/mess-recovery" element={<Navigate to="/funds" replace />} />

              {/* ════════════════════════════════
                  CLERK / OPERATIONS ROUTES
              ════════════════════════════════ */}
              <Route path="/profile" element={<ProtectedRoute allowedRoles={CLERK_ROLES}><EnterpriseLayout><TraineeProfileScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute allowedRoles={CLERK_ROLES}><EnterpriseLayout><DocumentVerificationScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/medical-register" element={<ProtectedRoute allowedRoles={CLERK_ROLES}><EnterpriseLayout><MedicalRegisterScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/welfare-demographics" element={<ProtectedRoute allowedRoles={WELFARE_ROLES}><EnterpriseLayout><WelfareDemographicsScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/weekly-program" element={<ProtectedRoute allowedRoles={CLERK_ROLES}><EnterpriseLayout><WeeklyProgramScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  DASHBOARD SUB-MODULES
              ════════════════════════════════ */}
              <Route path="/absent-management" element={<ProtectedRoute allowedRoles={CLERK_ROLES}><EnterpriseLayout><AbsentManagement /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/test-records" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><TestRecordsScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  AI AGENT
              ════════════════════════════════ */}
              <Route path="/ai-agent" element={<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><AIAgentScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/schema-generator" element={<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><AIAgentScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  STAFF MANAGEMENT MODULE
              ════════════════════════════════ */}
              <Route path="/staff" element={<ProtectedRoute allowedRoles={STAFF_VIEW_ROLES}><EnterpriseLayout><StaffManagementScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/training-schedule" element={<ProtectedRoute allowedRoles={STAFF_VIEW_ROLES}><EnterpriseLayout><TrainingScheduleScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/subjects" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><SubjectMasterScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/deputation" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><DeputationScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/subject-assignment" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><SubjectAssignmentScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/staff-attendance" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><AttendanceScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/staff-leave" element={<ProtectedRoute allowedRoles={STAFF_VIEW_ROLES}><EnterpriseLayout><StaffLeaveManagementScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/duty-management" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><DutyManagementScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/batch-progress" element={<ProtectedRoute allowedRoles={STAFF_VIEW_ROLES}><EnterpriseLayout><BatchProgressScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  SYSTEM ROUTES (CC Only)
              ════════════════════════════════ */}
              <Route path="/subscription" element={SUBSCRIPTION_ENABLED ? (<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><SubscriptionScreen /></EnterpriseLayout></ProtectedRoute>) : (<Navigate to="/login" replace />)} />
              <Route path="/company-monitor" element={SUBSCRIPTION_ENABLED ? (<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><CompanyMonitorScreen /></EnterpriseLayout></ProtectedRoute>) : (<Navigate to="/login" replace />)} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><SettingsScreen /></EnterpriseLayout></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['Company Commander']}><EnterpriseLayout><UserManagementPage /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  DEVELOPER PRACTICE (CC only)
              ════════════════════════════════ */}
              <Route path="/dev-practice" element={<ProtectedRoute><EnterpriseLayout><DevPracticeScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ════════════════════════════════
                  TRAINEE MODULE
              ════════════════════════════════ */}
                            <Route path="/trainee-dashboard" element={<ProtectedRoute><TraineeDashboard /></ProtectedRoute>} />
              <Route path="/trainee-management" element={<ProtectedRoute allowedRoles={STAFF_MANAGE_ROLES}><EnterpriseLayout><TraineeManagementScreen /></EnterpriseLayout></ProtectedRoute>} />

              {/* ── 404 Fallback ── */}
              <Route path="*" element={<Navigate to="/login" replace />} />

            </Routes>
          </Router>
        </BatchProvider>
        </SubscriptionProvider>
      </UnitConfigProvider>
    </AuthProvider>
  );
}

export default App;
