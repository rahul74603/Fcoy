// src/components/layout/Sidebar.tsx

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Activity, Target,
  Users, Archive, Settings,
  ChevronDown, ChevronRight, ChevronLeft,
  Layers, CalendarDays, BarChart3,
  PieChart, Menu,
  Bot, Sparkles,
  UserCog, ClipboardList, Boxes, FlaskConical, Crown, Building2,
  ClipboardCheck, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';
import { SUBSCRIPTION_ENABLED } from '../../features/subscription/subscription.config';

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeBatch, loading: batchLoading } = useBatch();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    ccSystem: false,
    qmInventory: true,
    qmFunds: true,
    ustadOwn: true,
    clerkBatch: true,
    clerkTrainee: true,
    clerkTraining: true,
    clerkRecords: true,
    clerkStaff: true,
    clerkStaffOps: true,
    clerkStaffAdv: false,
  });

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasAccess = (allowedRoles: string[]) => {
    if (!user) return false;
    if (user.role === 'Company Commander') return true;
    return allowedRoles.includes(user.role);
  };

  // ═══════════════════════════════════════════
  // SUB COMPONENTS
  // ═══════════════════════════════════════════

  const NavItem = ({
    title, icon: Icon, path, badge,
  }: {
    title: string;
    icon: React.ElementType;
    path: string;
    badge?: React.ReactNode;
  }) => {
    const active = location.pathname === path;
    return (
      <div
        onClick={() => navigate(path)}
        className={`flex items-center justify-between px-4 py-2.5 mx-2 cursor-pointer transition-colors text-sm rounded-sm ${
          active
            ? 'bg-military-700 text-white font-semibold'
            : 'text-slate-300 hover:bg-military-800 hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-3">
          <Icon size={18} />
          <span>{title}</span>
        </div>
        {badge && badge}
      </div>
    );
  };

  const AINavItem = () => {
    const active = location.pathname === '/ai-agent';
    return (
      <div
        onClick={() => navigate('/ai-agent')}
        className={`
          flex items-center justify-between px-4 py-2.5 mx-2
          cursor-pointer transition-all duration-200 text-sm rounded-sm
          border
          ${active
            ? 'bg-gradient-to-r from-purple-900/80 to-pink-900/80 text-white font-semibold border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
            : 'text-slate-300 hover:text-white border-transparent hover:border-purple-700/50 hover:bg-gradient-to-r hover:from-purple-900/40 hover:to-pink-900/40 hover:shadow-[0_0_8px_rgba(168,85,247,0.2)]'
          }
        `}
      >
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Bot size={18} className={active ? 'text-purple-300' : 'text-slate-300'} />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>
          <span>AI Agent</span>
        </div>
        <span className="text-[8px] font-black bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap animate-pulse">
          <Sparkles size={7} />
          NEW
        </span>
      </div>
    );
  };

  const NavGroup = ({
    title, icon: Icon, menuKey, children, badge,
  }: {
    title: string;
    icon: React.ElementType;
    menuKey: string;
    children: React.ReactNode;
    badge?: React.ReactNode;
  }) => {
    const isOpen = openMenus[menuKey];
    return (
      <div className="mb-1">
        <div
          onClick={() => toggleMenu(menuKey)}
          className="flex items-center justify-between px-4 py-2.5 mx-2 cursor-pointer transition-colors text-sm rounded-sm text-slate-300 hover:bg-military-800 hover:text-white"
        >
          <div className="flex items-center space-x-3">
            <Icon size={18} />
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {badge && badge}
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
        {isOpen && (
          <div className="ml-9 pr-4 py-1 space-y-1 border-l border-military-600 pl-2 mt-1">
            {children}
          </div>
        )}
      </div>
    );
  };

  const SubItem = ({
    title, path, badge, dot,
  }: {
    title: string;
    path: string;
    badge?: string;
    dot?: string;
  }) => {
    const active = location.pathname === path;
    return (
      <div
        onClick={() => navigate(path)}
        className={`flex items-center justify-between py-1.5 px-3 text-[13px] cursor-pointer rounded-sm ${
          active
            ? 'text-white font-bold bg-military-800'
            : 'text-slate-400 hover:text-white hover:bg-military-800'
        }`}
      >
        <div className="flex items-center gap-2">
          {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />}
          <span>{title}</span>
        </div>
        {badge && (
          <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
    );
  };

  const GroupDivider = ({ label }: { label: string }) => (
    <div className="pt-1.5 pb-0.5 px-3">
      <span className="text-[9px] font-black text-military-500 uppercase tracking-wider">
        — {label} —
      </span>
    </div>
  );

  const RoleSectionHeader = ({
    icon, title, subtitle, color, bgColor,
  }: {
    icon: string;
    title: string;
    subtitle: string;
    color: string;
    bgColor: string;
  }) => (
    <div className={`mt-4 mb-2 mx-2 rounded-lg ${bgColor} px-3 py-2 border-l-4 ${color}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-[11px] font-black text-white uppercase tracking-wider">
            {title}
          </p>
          <p className="text-[9px] text-slate-300 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  const ActiveBatchBadge = () => {
    if (batchLoading) return null;
    if (activeBatch) {
      return (
        <span className="text-[8px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
          {activeBatch.batchNumber}
        </span>
      );
    }
    return (
      <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
        NO BATCH
      </span>
    );
  };

  const FundBadge = () => (
    <span className="text-[8px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
      4 FUNDS
    </span>
  );

  const NewBadge = () => (
    <span className="text-[8px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
      NEW
    </span>
  );

  // ═══════════════════════════════════════════
  // RENDER — ORDER: CC → SO → QM → Ustad → Clerk
  // ═══════════════════════════════════════════
  return (
    <>
      {/* OPEN BUTTON */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 bg-military-900 text-white p-2.5 rounded-lg border border-military-700 shadow-lg hover:bg-military-800 hover:scale-105 transition-all duration-200"
          aria-label="Open Sidebar"
        >
          <Menu size={20} />
        </button>
      )}

      {/* OVERLAY */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="app-sidebar fixed inset-0 bg-black/30 z-30 lg:hidden"
        />
      )}

      {/* SIDEBAR WRAPPER */}
      <div
        className={`app-sidebar relative h-full flex-shrink-0 overflow-visible transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div
          className={`absolute left-0 top-0 h-full w-64 bg-military-900 flex flex-col shadow-flat z-40 transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* CLOSE BUTTON */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-[72px] -right-4 z-50 bg-military-900 text-white border border-military-700 rounded-full p-1.5 shadow-lg hover:bg-red-600 hover:border-red-500 hover:scale-110 transition-all duration-200"
            aria-label="Close Sidebar"
          >
            <ChevronLeft size={14} />
          </button>

          {/* LOGO */}
          <div className="h-16 flex items-center px-6 bg-military-950 border-b border-military-800">
            <div className="w-8 h-8 bg-military-500 rounded-sm flex items-center justify-center text-white font-bold tracking-widest mr-3 border border-military-400">
              HQ
            </div>
            <h1 className="text-white font-bold tracking-widest uppercase text-sm">
              ERP CORE
            </h1>
          </div>

          {/* USER INFO — Rank-based beautification */}
          {(() => {
            const roleConfig: Record<string, { icon: string; gradient: string; badge: string; badgeColor: string }> = {
              'Company Commander': { icon: '⭐', gradient: 'from-amber-600 to-yellow-500', badge: 'CO', badgeColor: 'bg-amber-500 text-white' },
              'Senior Officer / Inspector': { icon: '🎖️', gradient: 'from-blue-600 to-indigo-500', badge: 'SO', badgeColor: 'bg-blue-500 text-white' },
              'Quartermaster': { icon: '📦', gradient: 'from-emerald-600 to-green-500', badge: 'QM', badgeColor: 'bg-emerald-500 text-white' },
              'Ustad': { icon: '🎯', gradient: 'from-red-600 to-rose-500', badge: 'UST', badgeColor: 'bg-red-500 text-white' },
              'Clerk': { icon: '📋', gradient: 'from-slate-500 to-gray-400', badge: 'CLK', badgeColor: 'bg-slate-500 text-white' },
            };
            const rc = roleConfig[user?.role || ''] || { icon: '🪖', gradient: 'from-slate-600 to-slate-500', badge: 'USR', badgeColor: 'bg-slate-500 text-white' };
            return (
              <div className={`px-4 py-3 bg-gradient-to-r ${rc.gradient} border-b border-white/10`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm border border-white/10">
                    {rc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Logged in as</p>
                    <p className="text-xs font-black text-white mt-0.5 truncate">{user?.name || 'User'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${rc.badgeColor}`}>{rc.badge}</span>
                      <span className="text-[10px] text-white/80 font-bold">{user?.role || 'Role'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ACTIVE BATCH STATUS */}
          <div className={`px-4 py-2 border-b flex items-center justify-between ${
            activeBatch ? 'bg-green-900/40 border-green-800' : 'bg-amber-900/30 border-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              <Layers size={12} className={activeBatch ? 'text-green-400' : 'text-amber-400'} />
              <span className="text-[10px] font-black text-slate-400 uppercase">Current Batch</span>
            </div>
            {batchLoading ? (
              <span className="text-[9px] text-slate-500">Loading...</span>
            ) : activeBatch ? (
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] font-black text-green-400">{activeBatch.batchNumber}</span>
                </div>
                <span className="text-[9px] text-slate-500 truncate max-w-[100px] block">
                  {activeBatch.batchName}
                </span>
              </div>
            ) : (
              <span className="text-[9px] font-black text-amber-400">⚠ None Active</span>
            )}
          </div>

          {/* ═════════════════════════════════════
              NAVIGATION — RANK ORDER
          ═════════════════════════════════════ */}
          <div className="flex-1 overflow-y-auto py-3 space-y-1 custom-scrollbar">

            {/* ═══════════════════════════════════════════════
                ⭐ 1. COMPANY COMMANDER
            ═══════════════════════════════════════════════ */}
            {user?.role === 'Company Commander' && (
              <>
                <RoleSectionHeader
                  icon="⭐"
                  title="Company Commander"
                  subtitle="Full Command Authority"
                  color="border-amber-500"
                  bgColor="bg-amber-900/30"
                />
                <NavItem title="🔍 Bemel Dashboard" icon={AlertTriangle} path="/mismatch-dashboard" />
                <NavItem title="Commander Dashboard" icon={LayoutDashboard} path="/commander" />
                <AINavItem />
                <NavItem title="🛡️ SO Inspections Oversight" icon={ClipboardCheck} path="/so-inspections" />
                <NavGroup
                  title="Batch Command"
                  icon={Layers}
                  menuKey="clerkBatch"
                  badge={<ActiveBatchBadge />}
                >
                  <SubItem title="All Batches" path="/batches" dot="bg-green-400" />
                </NavGroup>
                <div className="mx-4 my-2 h-px bg-military-800" />
              </>
            )}

            {/* ═══════════════════════════════════════════════
                🛡️ 2. SENIOR OFFICER / INSPECTOR
            ═══════════════════════════════════════════════ */}
            {user?.role === 'Senior Officer / Inspector' && (
              <>
                <RoleSectionHeader
                  icon="🛡️"
                  title="Senior Officer"
                  subtitle="Inspection · Supervision · Verification"
                  color="border-indigo-400"
                  bgColor="bg-indigo-900/30"
                />
                <NavItem title="Inspections & Oversight" icon={ClipboardCheck} path="/so-inspections" />
                <div className="mx-4 my-2 h-px bg-military-800" />
              </>
            )}

            {/* ═══════════════════════════════════════════════
                📦 3. QUARTER MASTER
            ═══════════════════════════════════════════════ */}
            {hasAccess(['Quarter Master']) && (
              <>
                <RoleSectionHeader
                  icon="📦"
                  title="Quarter Master"
                  subtitle="Fund · Stock · Bills · Vendors"
                  color="border-orange-500"
                  bgColor="bg-orange-900/30"
                />
                <NavItem title="QM Dashboard" icon={LayoutDashboard} path="/quartermaster" />
                <NavItem title="QM Reports" icon={BarChart3} path="/reports?scope=qm" />
                <NavItem title="Inventory & Stock Hub" icon={Boxes} path="/inventory" badge={<NewBadge />} />
                <NavGroup
                  title="Stock Management"
                  icon={Archive}
                  menuKey="qmInventory"
                >
                  <SubItem title="Saaman Vitran (Kit Issue)" path="/issue-kit" dot="bg-blue-400" />
                </NavGroup>
                <NavItem title="Assigned Corrective Actions" icon={ClipboardCheck} path="/so-inspections" />
                <NavGroup
                  title="Fund Manager"
                  icon={PieChart}
                  menuKey="qmFunds"
                  badge={<FundBadge />}
                >
                  <SubItem title="📊 Funds Dashboard" path="/funds" dot="bg-white" />
                  <GroupDivider label="Funds" />
                  <SubItem title="🍽️ Mess Fund" path="/mess-fund" dot="bg-orange-500" />
                  <SubItem title="🎓 Training Fund" path="/training-fund" dot="bg-blue-500" />
                  <SubItem title="🏛️ Company Assets" path="/company-assets-fund" dot="bg-green-500" />
                  <SubItem title="💰 General Fund" path="/general-fund" dot="bg-slate-300" />
                  <GroupDivider label="Bills & Vendors" />
                  <SubItem title="🏪 Vendor Management" path="/vendors" dot="bg-indigo-400" />
                  <SubItem title="💳 Vendor Payments" path="/vendor-payments" dot="bg-red-400" />
                  <SubItem title="👨‍🍳 Mess Boy Salary" path="/mess-boy-salary" dot="bg-purple-400" />
                </NavGroup>
                <div className="mx-4 my-2 h-px bg-military-800" />
              </>
            )}

            {/* ═══════════════════════════════════════════════
                🎖️ 4. USTAD / INSTRUCTOR
            ═══════════════════════════════════════════════ */}
            {hasAccess(['Ustad']) && (
              <>
                <RoleSectionHeader
                  icon="🎖️"
                  title="Ustad / Instructor"
                  subtitle={user?.role === 'Ustad' ? 'Your Duties & Schedule' : 'Instructor Management'}
                  color="border-blue-500"
                  bgColor="bg-blue-900/30"
                />
                {user?.role === 'Ustad' && <NavItem title="My Dashboard" icon={Target} path="/ustad" />}
                {user?.role === 'Ustad' && <NavItem title="Assigned Corrective Actions" icon={ClipboardCheck} path="/so-inspections" />}
                <NavGroup
                  title="Instructor Profiles"
                  icon={UserCog}
                  menuKey="clerkStaff"
                  badge={<NewBadge />}
                >
                  <SubItem title="Staff List" path="/staff" dot="bg-blue-400" />
                  {user?.role !== 'Ustad' && (
                    <>
                      <SubItem title="Subject Master" path="/subjects" dot="bg-purple-400" />
                      <SubItem title="Subject Assignment" path="/subject-assignment" dot="bg-indigo-400" />
                    </>
                  )}
                </NavGroup>
                <NavGroup
                  title="Daily Operations"
                  icon={ClipboardList}
                  menuKey="clerkStaffOps"
                >
                  <SubItem title="📊 Batch Progress" path="/batch-progress" dot="bg-purple-500" />
                  <SubItem title="Training Schedule" path="/training-schedule" dot="bg-blue-400" />
                  {user?.role !== 'Ustad' && (
                    <>
                      <SubItem title="Mark Attendance" path="/staff-attendance" dot="bg-green-400" />
                      <SubItem title="Duty Management" path="/duty-management" dot="bg-amber-400" />
                      <SubItem title="Deputation Register" path="/deputation" dot="bg-purple-500" />
                    </>
                  )}
                  <SubItem title="Leave Management" path="/staff-leave" dot="bg-yellow-400" />
                </NavGroup>
                <div className="mx-4 my-2 h-px bg-military-800" />
              </>
            )}

            {/* ═══════════════════════════════════════════════
                📋 5. CLERK / TRAINING RECORDS
            ═══════════════════════════════════════════════ */}
            {hasAccess(['Clerk']) && (
              <>
                <RoleSectionHeader
                  icon="📋"
                  title="Clerk / Training"
                  subtitle="Trainee Details · Program · Tests"
                  color="border-cyan-500"
                  bgColor="bg-cyan-900/30"
                />
                <NavItem title="Clerk Dashboard" icon={Activity} path="/clerk" />
                <NavItem title="Clerk Reports" icon={BarChart3} path="/reports" />
                {user?.role !== 'Company Commander' && (
                  <NavItem title="Assigned Corrective Actions" icon={ClipboardCheck} path="/so-inspections" />
                )}
                {user?.role !== 'Company Commander' && (
                  <NavGroup
                    title="Batch View"
                    icon={Layers}
                    menuKey="clerkBatch"
                    badge={<ActiveBatchBadge />}
                  >
                    <SubItem title="All Batches" path="/batches" dot="bg-green-400" />
                  </NavGroup>
                )}
                <NavGroup
                  title="Rangroot Prabandhan"
                  icon={Users}
                  menuKey="clerkTrainee"
                >
                  <SubItem title="Rangroot Profile (Trainee)" path="/profile" dot="bg-blue-400" />
                  <SubItem title="Dastavez Satyapan (Documents)" path="/documents" dot="bg-purple-400" />
                  <SubItem title="Chikitsa Register (Medical)" path="/medical-register" dot="bg-red-400" />
                </NavGroup>
                <NavGroup
                  title="Program & Duty Planning"
                  icon={CalendarDays}
                  menuKey="clerkTraining"
                >
                  <SubItem title="Weekly Program" path="/weekly-program" dot="bg-green-400" />
                  <SubItem title="Ustad Schedule / Duty" path="/training-schedule" dot="bg-blue-400" />
                </NavGroup>
                <NavGroup
                  title="Prashikshan Anurekhan"
                  icon={BarChart3}
                  menuKey="clerkRecords"
                >
                  <GroupDivider label="Daily Tracking" />
                  <SubItem title="Anupasthiti / Chhutti / Medical" path="/absent-management" dot="bg-red-500" />
                  <GroupDivider label="Exam Records" />
                  <SubItem title="Pariksha Register (All Tests)" path="/test-records" dot="bg-purple-500" />
                  <SubItem title="⚖️ Anushasan Register" path="/discipline-register" dot="bg-red-500" />
                  <SubItem title="🚶 Sthanantar Register" path="/movement-register" dot="bg-blue-500" />
                  <SubItem title="✈️ Chhutti Prabandhan" path="/leave-management" dot="bg-amber-500" />
                  <SubItem title="📊 Kaksha Upasthiti" path="/period-attendance" dot="bg-green-500" />
                  <SubItem title="📚 Pathyakram Anurekhan" path="/syllabus-tracking" dot="bg-indigo-500" />
                  <SubItem title="🏆 Antim Board Result" path="/final-board" dot="bg-yellow-500" />
                  <SubItem title="📋 Klirans Prabandhan" path="/clearance" dot="bg-teal-500" />
                  <SubItem title="🚶 Bharti Prakriya" path="/joining-workflow" dot="bg-violet-500" />
                  <SubItem title="📝 Lekha-Jokha (Audit)" path="/audit-log" dot="bg-slate-500" />
                  <SubItem title="✈️ Chhutti Prabandhan" path="/leave-management" dot="bg-amber-500" />
                  <SubItem title="📊 Kaksha Upasthiti" path="/period-attendance" dot="bg-green-500" />
                  <SubItem title="📚 Pathyakram Anurekhan" path="/syllabus-tracking" dot="bg-indigo-500" />
                  <SubItem title="🏆 Antim Board Result" path="/final-board" dot="bg-yellow-500" />
                  <SubItem title="📋 Klirans Prabandhan" path="/clearance" dot="bg-teal-500" />
                  <SubItem title="🚶 Bharti Prakriya" path="/joining-workflow" dot="bg-violet-500" />
                  <SubItem title="📝 Lekha-Jokha (Audit)" path="/audit-log" dot="bg-slate-500" />
                </NavGroup>
                <div className="mx-4 my-2 h-px bg-military-800" />
              </>
            )}

            {/* ═══════════════════════════════════════════════
                REPORTS & SETTINGS — CC ONLY
            ═══════════════════════════════════════════════ */}
            {user?.role === 'Company Commander' && (
              <>
                <RoleSectionHeader
                  icon="⚙️"
                  title="Reports & Settings"
                  subtitle="Commander Only"
                  color="border-slate-400"
                  bgColor="bg-slate-800/40"
                />
                <NavGroup
                  title="System Administration"
                  icon={Settings}
                  menuKey="ccSystem"
                >
                  <SubItem title="Reports Center" path="/reports" dot="bg-blue-400" />
                  <SubItem title="Settings" path="/settings" dot="bg-slate-400" />
                  <SubItem title="User Management" path="/users" dot="bg-purple-400" />
                </NavGroup>
              </>
            )}

            {/* ═══════════════════════════════════════════════
                🧪 DEVELOPER
            ═══════════════════════════════════════════════ */}
            {user?.isDeveloper && (
              <>
                <div className="mx-4 my-2 h-px bg-military-800" />
                <RoleSectionHeader
                  icon="🧪"
                  title="Developer"
                  subtitle="Practice · Testing Zone"
                  color="border-orange-500"
                  bgColor="bg-orange-900/40"
                />
                <NavItem title="🧪 Practice Console" icon={FlaskConical} path="/dev-practice" />
                {SUBSCRIPTION_ENABLED && (
                  <NavItem title="👑 Subscription & License" icon={Crown} path="/subscription" />
                )}
                {SUBSCRIPTION_ENABLED && (
                  <NavItem title="🏢 Company Monitor" icon={Building2} path="/company-monitor" />
                )}
              </>
            )}

          </div>

          {/* FOOTER */}
          <div className="p-4 bg-military-950 border-t border-military-800 text-xs text-military-400 text-center">
            v2.6.0 · Rank Order
          </div>

        </div>
      </div>
    </>
  );
};
