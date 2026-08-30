// ═══════════════════════════════════════════════════════════════════════
// AGENT CONTEXT — trusted application state handed to the AI
// ───────────────────────────────────────────────────────────────────────
// The model NEVER declares its own batch or role. Context is built from the
// authenticated user + BatchContext (the SAME selected-batch state every
// screen uses) and from the SO assigned-batch model. Tools treat this as the
// authorization boundary; Firestore rules remain the hard enforcement layer.
// ═══════════════════════════════════════════════════════════════════════

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { currentScopedBatchId } from '../../../utils/batchScope';
import { inspectionBatchScope } from '../../../config/permissions';
import { localDateISOString } from '../../../utils/localDate';
import { getActiveBatchInfo } from './queryEngine';

export interface AgentBatchInfo {
  id: string;
  batchNumber?: string;
  batchName?: string;
  status?: string;
}

export interface AgentUserInfo {
  uid: string;
  email: string;
  name: string;
  role: string;
  assignedBatchIds: string[];
}

export interface AgentContext {
  user: AgentUserInfo;
  /** The batch the UI currently has selected (or null if none). */
  selectedBatch: AgentBatchInfo | null;
  /** "selected" = one batch; "all" = CC explicit All Batches view. */
  batchMode: 'selected' | 'all' | 'none';
  /** Every batch this user may legitimately see data for. */
  authorizedBatchIds: string[];          // [] for CC = implicit all
  isCC: boolean;
  isSO: boolean;
  /** SO inspection scope: null = unrestricted (CC), string[] = allowed ids, [] = none */
  inspectionScope: string[] | null;
  todayISO: string;
  /** Write permission per domain (mirrors permissions.ts + firestore.rules). */
  can: {
    staffAdmin: boolean;   // CC, Clerk
    finance: boolean;      // CC, QM
    inspections: boolean;  // CC, SO
    trainees: boolean;     // CC, Clerk
  };
}

/**
 * Build the immutable per-request context. `allBatchesMode` should come from
 * BatchContext (whether the user picked "All Batches"). Only CC truly sees
 * all batches; for SO/staff we still force the selected batch.
 */
export async function buildAgentContext(user: {
  uid?: string; email?: string | null; name?: string | null;
  role?: string | null; assignedBatchIds?: string[] | null;
}, opts: { allBatchesMode?: boolean } = {}): Promise<AgentContext> {
  const role = String(user.role ?? '');
  const rl = role.toLowerCase();
  const isCC = rl === 'company commander';
  const isSO = rl === 'senior officer / inspector';
  const isClerk = rl === 'clerk';
  const isQM = rl === 'quarter master';

  const todayISO = localDateISOString();

  // ── Selected batch: SAME source as the whole app ──
  let selectedBatch: AgentBatchInfo | null = null;
  const scopedId = currentScopedBatchId();
  if (scopedId) {
    const b = await getActiveBatchInfo();
    if (b && b.id === scopedId) {
      selectedBatch = { id: b.id, batchNumber: b.batchNumber, batchName: b.batchName, status: b.status };
    } else {
      selectedBatch = { id: scopedId, batchNumber: scopedId, batchName: scopedId };
    }
  }
  if (!selectedBatch) {
    const b = await getActiveBatchInfo();
    if (b) selectedBatch = { id: b.id, batchNumber: b.batchNumber, batchName: b.batchName, status: b.status };
  }

  // ── Authorized batches for SO (assignedBatchIds); CC = all ──
  const assigned = Array.isArray(user.assignedBatchIds) ? user.assignedBatchIds.map(String) : [];
  const inspectionScope = inspectionBatchScope(role, assigned);
  // null = CC/unrestricted, [] = none, string[] = those batches
  let authorizedBatchIds: string[] = [];
  if (isCC) authorizedBatchIds = [];          // implicit all
  else if (isSO) authorizedBatchIds = inspectionScope ?? [];
  else authorizedBatchIds = selectedBatch ? [selectedBatch.id] : [];

  const batchMode: AgentContext['batchMode'] =
    opts.allBatchesMode && isCC ? 'all' : selectedBatch ? 'selected' : 'none';

  return {
    user: {
      uid: String(user.uid ?? ''),
      email: String(user.email ?? ''),
      name: String(user.name ?? ''),
      role,
      assignedBatchIds: assigned,
    },
    selectedBatch,
    batchMode,
    authorizedBatchIds,
    isCC,
    isSO,
    inspectionScope,
    todayISO,
    can: {
      staffAdmin: isCC || isClerk,
      finance: isCC || isQM,
      inspections: isCC || isSO,
      trainees: isCC || isClerk,
    },
  };
}

/**
 * Resolve a batch id mentioned by the model/user against AUTHORIZATION.
 * The model may NOT invent a batchId. Returns the authorized id or null with
 * a reason. This is the batch-scoped tool contract.
 */
export function resolveBatchForTool(
  ctx: AgentContext,
  requestedBatchId?: string | null,
): { ok: true; batchId: string | null } | { ok: false; reason: string } {
  // CC may work all-batch (null) when in all mode.
  if (ctx.isCC) {
    if (requestedBatchId) return { ok: true, batchId: requestedBatchId };
    if (ctx.batchMode === 'all') return { ok: true, batchId: null };
    if (ctx.selectedBatch) return { ok: true, batchId: ctx.selectedBatch.id };
    return { ok: false, reason: 'Koi batch select nahi hai. Pehle batch choose karein.' };
  }
  // SO: only assigned batches.
  if (ctx.isSO) {
    const scope = ctx.inspectionScope ?? [];
    const want = requestedBatchId ?? ctx.selectedBatch?.id ?? null;
    if (!want) return { ok: false, reason: 'Koi assigned batch select nahi hai.' };
    if (!scope.includes(want)) {
      return { ok: false, reason: `SURAKSHA: ye batch aapko assigned nahi hai. Sirf assigned batches allowed hain.` };
    }
    return { ok: true, batchId: want };
  }
  // Other roles: only the currently selected batch (trainees etc.).
  if (requestedBatchId && ctx.selectedBatch && requestedBatchId !== ctx.selectedBatch.id) {
    return { ok: false, reason: 'SURAKSHA: aap sirf current selected batch ka data dekh sakte hain.' };
  }
  if (ctx.selectedBatch) return { ok: true, batchId: ctx.selectedBatch.id };
  return { ok: false, reason: 'Koi batch select nahi hai.' };
}

/**
 * Firestore write authorization mirror (defense in depth — rules are the
 * hard boundary). Used by generic write tools to fail fast with a clear
 * message before a request ever hits Firestore.
 */
export function canWriteCollection(ctx: AgentContext, collectionName: string): { ok: boolean; reason?: string } {
  const financeCols = [
    'mess_fund_expenses', 'mess_fund_collections', 'training_fund_expenses',
    'training_fund_collections', 'training_fund_recoveries',
    'company_assets_expenses', 'company_assets_collections',
    'general_fund_expenses', 'general_fund_collections',
    'vendors', 'vendor_entries', 'vendor_payments', 'bills',
    'fund_transfers', 'collections', 'expenses', 'recoveries', 'item_master',
    'stock_ledgers', 'issue_records', 'subscription', 'subscriptionHistory',
    'subscriptionPlans', 'customers', 'customerSubscriptions', 'companyBridges',
  ];
  const staffCols = [
    'trainees', 'absentRecords', 'medicalRecords', 'fptRecords',
    'weeklyTestRecords', 'weeklyPrograms', 'staff', 'staff_attendance',
    'staff_duty', 'duty_types', 'deputation_records', 'training_schedule',
  ];
  if (financeCols.includes(collectionName) && !ctx.can.finance) {
    return { ok: false, reason: 'Finance/inventory writes sirf Quarter Master ya Company Commander kar sakte hain.' };
  }
  if (staffCols.includes(collectionName) && !ctx.can.staffAdmin) {
    return { ok: false, reason: 'Staff/training writes sirf Clerk ya Company Commander kar sakte hain.' };
  }
  if ((collectionName === 'inspections' || collectionName === 'findings') && !ctx.can.inspections) {
    return { ok: false, reason: 'Inspection writes sirf Senior Officer/Inspector ya Company Commander kar sakte hain.' };
  }
  return { ok: true };
}

/** Quick batch lookup (id → label) for tool replies. */
export async function getBatchLabel(batchId: string): Promise<{ batchNumber?: string; batchName?: string }> {
  try {
    const snap = await getDocs(collection(db, 'batches'));
    const hit = snap.docs.find(d => d.id === batchId);
    if (hit) {
      const data = hit.data() as any;
      return { batchNumber: data.batchNumber, batchName: data.batchName };
    }
  } catch { /* ignore */ }
  return {};
}
