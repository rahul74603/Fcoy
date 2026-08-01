// ═══════════════════════════════════════════════════════════════════════════
// usePermission — reusable role-permission hook (Task 4: Role Permission Fixes)
// ═══════════════════════════════════════════════════════════════════════════
//
// KYUN: pehle har screen me alag-alag tarah se role check likha hota tha:
//   `user?.role === 'Company Commander'`  (kabhi string, kabhi lowercase mix)
// Ab EK hi source-of-truth hai — saari role logic yahin hai.
//
// RULES (App-wide doctrine):
//   1. 'Company Commander' = FULL ACCESS override (ProtectedRoute, Sidebar
//      hasAccess, globalSearch canAccess — sab jagah yehi pattern hai).
//   2. Baaki roles ko tab access jab wo allowed-list me ho.
//   3. UI gate = UX safety; ASLI security Firestore rules karti hai (fail-closed).
//      UI gate galat bhi ho jaye to DB layer pe write block hi rahegi.
//
// USAGE:
//   const { isCommander, canAny } = usePermission();
//   {isCommander && <DangerButton />}
//   {canAny(['Quarter Master']) && <IssueButton />}   // CC bhi pass hoga
// ═══════════════════════════════════════════════════════════════════════════

import { useAuth } from '../contexts/AuthContext';

// App ke 4 asli roles (AuthContext se string aati hai — yahan constants
// rakhe hain taaki typo se bug na bane)
export const ROLES = {
  CC:    'Company Commander',
  QM:    'Quarter Master',
  CLERK: 'Clerk',
  USTAD: 'Ustad',
} as const;

export interface Permission {
  /** Current user ka role (logout ho to 'Unassigned') */
  role: string;
  isLoggedIn: boolean;
  isCommander: boolean;
  isQuarterMaster: boolean;
  isClerk: boolean;
  isUstad: boolean;
  /**
   * CC auto-override ke SAATH role check.
   * canAny(['Quarter Master']) → QM ya CC = true.
   */
  canAny: (allowedRoles: string[]) => boolean;
  /**
   * STRICT role check — CC override NAHI. Sirf tab use karo jab action
   * sach me CC-exclusive ho (e.g. batch switch, seed tools, nuclear reset).
   */
  only: (expectedRole: string) => boolean;

  // ── Ready-made combos (common gates — baar-baar mat likho) ──
  /** Batch create/edit/switch/complete — sirf CC */
  canManageBatches: boolean;
  /** Inventory issue/return/purchase flows — QM (+CC) */
  canManageInventory: boolean;
  /** Trainee records / programs / tests — Clerk (+CC) */
  canManageTrainees: boolean;
  /** Seed / Dev tools — sirf CC (route bhi CC-only hai) */
  canUseSeedTools: boolean;
}

export const usePermission = (): Permission => {
  const { user } = useAuth();

  const role = user?.role ?? 'Unassigned';
  const isCommander     = role === ROLES.CC;
  const isQuarterMaster = role === ROLES.QM;
  const isClerk         = role === ROLES.CLERK;
  const isUstad         = role === ROLES.USTAD;

  const canAny = (allowedRoles: string[]) =>
    isCommander || allowedRoles.includes(role);

  const only = (expectedRole: string) => role === expectedRole;

  return {
    role,
    isLoggedIn: !!user,
    isCommander,
    isQuarterMaster,
    isClerk,
    isUstad,
    canAny,
    only,
    canManageBatches:   isCommander,
    canManageInventory: canAny([ROLES.QM]),
    canManageTrainees:  canAny([ROLES.CLERK]),
    canUseSeedTools:    isCommander,
  };
};

export default usePermission;
