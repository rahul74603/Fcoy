// src/App.tsx

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { EnterpriseLayout } from './components/layout/EnterpriseLayout';
import SeedStaffData from './features/system/SeedStaffData';
// --- AI Agent ---
import AIAgentScreen from './features/aiAgent/components/AIAgentScreen';

// --- Contexts ---
import { AuthProvider }       from './contexts/AuthContext';
import { UnitConfigProvider } from './contexts/UnitConfigContext';
import { BatchProvider }      from './contexts/BatchContext';
import { ThemeProvider }      from './contexts/ThemeContext';
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
import { WeeklyProgramScreen }        from './features/weekly/WeeklyProgramScreen';
import { MedicalRegisterScreen }      from './features/medical/MedicalRegisterScreen';
import { DeputationScreen } from './features/ustad/screens';
// --- Dashboard Sub-Modules ---
import { AbsentManagement }  from './features/dashboard/AbsentManagement';
import { TestRecordsScreen } from './features/ustad/screens';
// --- System & Config ---
import { ReportsScreen }      from './features/system/ReportsScreen';
import { SettingsScreen }     from './features/system/SettingsScreen';
import { UserManagementPage } from './features/system/UserManagementPage';
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


// Staff module access — CC + Clerk can manage, Ustad can view own
const STAFF_MANAGE_ROLES = ['Company Commander', 'Clerk'];
const STAFF_VIEW_ROLES   = ['Company Commander', 'Clerk', 'Ustad'];

function App() {
  return (
    <ThemeProvider>
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
                  <ProtectedRoute allowedRoles={ALL_ROLES}>
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
                  <ProtectedRoute allowedRoles={['Company Commander', 'Quarter Master']}>
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
              
              {/* ── 404 Fallback ── */}
              <Route path="*" element={<Navigate to="/login" replace />} />

            </Routes>
            </Router>
          </BatchProvider>
        </UnitConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;