// ═══════════════════════════════════════════════════════════════════════
// CENTRAL ROLE PERMISSION POLICY (single source of truth, UI layer)
// ───────────────────────────────────────────────────────────────────────
// These are the CLIENT-side mirrors of the Firestore/Storage security
// rules. They drive UI affordances (show/hide controls, guard handlers).
// They are NOT the security boundary — the rules in firestore.rules are.
// Keeping them here lets the UI and tests agree with the documented role
// matrix.
// ═══════════════════════════════════════════════════════════════════════

export type Role = 'Company Commander' | 'Clerk' | 'Quarter Master' | 'Ustad' | string;

export const normalizeRoleInput = (r: unknown): string =>
  String(r ?? '').trim().toLowerCase();

/** Only Company Commander may approve / reject / return (finalize) leave. */
export const canApproveLeave = (role: Role): boolean =>
  normalizeRoleInput(role) === 'company commander';

/** Leave-type master administration = CC + Clerk. */
export const canManageLeaveTypes = (role: Role): boolean =>
  ['company commander', 'clerk'].includes(normalizeRoleInput(role));

/** Staff/training administration (attendance, duty, subjects, tests). */
export const canManageStaff = (role: Role): boolean =>
  ['company commander', 'clerk'].includes(normalizeRoleInput(role));

/** Finance / inventory / funds / vendors. */
export const canManageFinance = (role: Role): boolean =>
  ['company commander', 'quarter master'].includes(normalizeRoleInput(role));

/** User management (create users, roles, activation). */
export const canManageUsers = (role: Role): boolean =>
  normalizeRoleInput(role) === 'company commander';

/** Trainee registration / documents / medical. */
export const canManageTrainees = (role: Role): boolean =>
  ['company commander', 'clerk'].includes(normalizeRoleInput(role));

/** Cross-batch "All Batches" aggregate views (e.g. welfare demographics). */
export const canViewAllBatches = (role: Role): boolean =>
  normalizeRoleInput(role) === 'company commander';

/** Developer/test sandbox access. */
export const canUseDevSandbox = (role: Role, isDeveloper: boolean): boolean =>
  normalizeRoleInput(role) === 'company commander' || isDeveloper === true;

/**
 * Fields on staff_leave that only CC may change. If a non-CC changes any of
 * these on an existing leave document, the operation must be denied.
 */
export const LEAVE_APPROVAL_FIELDS = [
  'status',
  'approvedBy',
  'approvedByName',
  'approvalDate',
  'rejectionReason',
] as const;

/**
 * Pure decision: given a leave update, is the caller allowed?
 *  - CC may change anything.
 *  - Any other role may update a leave doc ONLY if no approval field changes.
 */
export const canUpdateLeave = (
  role: Role,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean => {
  if (canApproveLeave(role)) return true;
  return LEAVE_APPROVAL_FIELDS.every((f) => {
    const a = before?.[f];
    const b = after?.[f];
    // null/'' treated equivalently for approvalDate
    if (f === 'approvalDate') return (a ?? null) === (b ?? null);
    return a === b;
  });
};

/**
 * Fields on a user profile that a non-CC must never change on themselves or
 * others (privilege escalation protection).
 */
export const PROTECTED_USER_FIELDS = ['role', 'isDeveloper', 'isActive'] as const;

export const canUpdateUserProfile = (
  role: Role,
  targetUserId: string,
  selfUserId: string | null,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean => {
  if (normalizeRoleInput(role) === 'company commander') return true;
  // Non-CC may only touch their OWN profile, and never protected fields.
  if (selfUserId !== targetUserId) return false;
  return PROTECTED_USER_FIELDS.every((f) => before?.[f] === after?.[f]);
};
