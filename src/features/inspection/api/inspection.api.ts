// ═══════════════════════════════════════════════════════════════════════
// SO Inspection — data layer
// ───────────────────────────────────────────────────────────────────────
// Collections (snake_case per existing convention):
//   inspections  — inspection events
//   findings     — findings + corrective-action lifecycle
//
// Authorization is enforced THREE ways:
//   1. UI (sidebar/routes hide what you can't use)
//   2. This layer (scope + role guards fail fast)
//   3. Firestore rules (the real boundary — SO writes require role ==
//      Senior Officer / Inspector and assignedBatchIds to contain batchId;
//      CC is unrestricted).
// ═══════════════════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import { localDateISOString } from '../../../utils/localDate';
import type {
  Inspection, Finding, InspectionStatus, FindingStatus,
} from '../types/inspection.types';

export const INSPECTIONS_COL = 'inspections';
export const FINDINGS_COL = 'findings';

export interface AppUserLike {
  uid: string;
  role: string;
  displayName?: string | null;
  name?: string;
  assignedBatchIds?: string[] | null;
}

export const isSO = (role: string) => role === 'Senior Officer / Inspector';
export const isCC = (role: string) => role === 'Company Commander';

/** Batches a user may operate on. CC = all (returns null = unrestricted). */
export function scopedBatchIds(user: AppUserLike | null | undefined): string[] | null {
  if (!user) return [];
  if (isCC(user.role)) return null; // CC sees everything
  if (isSO(user.role)) {
    return Array.isArray(user.assignedBatchIds) ? user.assignedBatchIds : [];
  }
  return [];
}

export function canAccessBatch(user: AppUserLike | null | undefined, batchId: string): boolean {
  const scope = scopedBatchIds(user);
  if (scope === null) return true;       // CC
  return scope.includes(batchId);
}

const stamp = () => new Date().toISOString();

// ───────────────────────────────────────────────────────────────────────
// INSPECTIONS
// ───────────────────────────────────────────────────────────────────────
const docToInspection = (id: string, d: Record<string, any>): Inspection => ({
  id,
  batchId: d.batchId ?? '',
  batchNumber: d.batchNumber ?? '',
  batchName: d.batchName ?? '',
  inspectionType: d.inspectionType ?? 'General',
  inspectionDate: d.inspectionDate ?? localDateISOString(),
  inspectorId: d.inspectorId ?? '',
  inspectorName: d.inspectorName ?? '',
  subject: d.subject ?? '',
  observations: d.observations ?? '',
  status: (d.status as InspectionStatus) ?? 'draft',
  severity: d.severity,
  remarks: d.remarks ?? '',
  createdBy: d.createdBy ?? '',
  createdAt: d.createdAt ?? '',
  updatedBy: d.updatedBy ?? '',
  updatedAt: d.updatedAt ?? '',
});

export async function createInspection(
  user: AppUserLike,
  data: Omit<Inspection, 'id' | 'createdBy' | 'createdAt' | 'inspectorId' | 'inspectorName'>,
): Promise<string> {
  if (!isSO(user.role) && !isCC(user.role)) {
    throw new Error('Authorization: sirf Senior Officer / Inspector (ya CC) inspection bana sakta hai.');
  }
  if (!canAccessBatch(user, data.batchId)) {
    throw new Error('Authorization: ye batch aapko assigned nahi hai.');
  }
  const ref = await addDoc(collection(db, INSPECTIONS_COL), {
    ...data,
    inspectorId: user.uid,
    inspectorName: user.displayName || user.name || 'SO',
    status: data.status ?? 'submitted',
    createdBy: user.uid,
    createdAt: stamp(),
    serverCreatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateInspection(
  user: AppUserLike,
  id: string,
  before: Inspection,
  updates: Partial<Inspection>,
): Promise<void> {
  if (!isSO(user.role) && !isCC(user.role)) {
    throw new Error('Authorization: inspection edit nahi kar sakte.');
  }
  if (!canAccessBatch(user, before.batchId)) {
    throw new Error('Authorization: is batch ki inspection aapko assigned nahi hai.');
  }
  // Ownership / authorization fields are immutable via this path.
  const { batchId, createdBy, inspectorId, ...safe } = updates as Record<string, unknown>;
  await updateDoc(doc(db, INSPECTIONS_COL, id), {
    ...safe,
    updatedBy: user.uid,
    updatedAt: stamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function deleteInspection(user: AppUserLike, inspection: Inspection): Promise<void> {
  // Only a DRAFT inspection, and only by its creator SO (or CC), may be deleted.
  if (!isCC(user.role) && !(isSO(user.role) && inspection.createdBy === user.uid)) {
    throw new Error('Authorization: inspection delete nahi kar sakte.');
  }
  if (!isCC(user.role) && inspection.status !== 'draft') {
    throw new Error('Sirf draft inspection delete ho sakti hai.');
  }
  if (!canAccessBatch(user, inspection.batchId)) {
    throw new Error('Authorization: is batch ki inspection aapko assigned nahi hai.');
  }
  await deleteDoc(doc(db, INSPECTIONS_COL, inspection.id));
}

export async function getInspections(user: AppUserLike): Promise<Inspection[]> {
  const snap = await getDocs(query(collection(db, INSPECTIONS_COL), orderBy('createdAt', 'desc')));
  const scope = scopedBatchIds(user);
  return snap.docs
    .filter((d) => showDoc(d.data() as Record<string, unknown>))
    .map((d) => docToInspection(d.id, d.data() as Record<string, any>))
    .filter((insp) => (scope === null ? true : scope.includes(insp.batchId)));
}

// ───────────────────────────────────────────────────────────────────────
// FINDINGS / CORRECTIVE ACTIONS
// ───────────────────────────────────────────────────────────────────────
const docToFinding = (id: string, d: Record<string, any>): Finding => ({
  id,
  batchId: d.batchId ?? '',
  batchNumber: d.batchNumber ?? '',
  inspectionId: d.inspectionId ?? '',
  category: d.category ?? '',
  title: d.title ?? '',
  description: d.description ?? '',
  severity: (d.severity as Finding['severity']) ?? 'minor',
  responsibleArea: d.responsibleArea ?? '',
  assignedToRole: d.assignedToRole ?? '',
  assignedToName: d.assignedToName ?? '',
  dueDate: d.dueDate ?? '',
  status: (d.status as FindingStatus) ?? 'open',
  correctiveAction: d.correctiveAction ?? '',
  createdBy: d.createdBy ?? '',
  createdByName: d.createdByName ?? '',
  createdAt: d.createdAt ?? '',
  updatedBy: d.updatedBy ?? '',
  updatedAt: d.updatedAt ?? '',
  submittedBy: d.submittedBy ?? '',
  submittedAt: d.submittedAt ?? '',
  verifiedBy: d.verifiedBy ?? '',
  verifiedByName: d.verifiedByName ?? '',
  verifiedAt: d.verifiedAt ?? '',
  reworkReason: d.reworkReason ?? '',
  closureRemarks: d.closureRemarks ?? '',
});

export async function createFinding(
  user: AppUserLike,
  data: Omit<Finding, 'id' | 'createdBy' | 'createdAt' | 'status'> & { status?: FindingStatus },
): Promise<string> {
  if (!isSO(user.role) && !isCC(user.role)) {
    throw new Error('Authorization: sirf Senior Officer / Inspector (ya CC) finding bana sakta hai.');
  }
  if (!canAccessBatch(user, data.batchId)) {
    throw new Error('Authorization: ye batch aapko assigned nahi hai.');
  }
  const ref = await addDoc(collection(db, FINDINGS_COL), {
    ...data,
    status: data.status ?? 'open',
    createdBy: user.uid,
    createdByName: user.displayName || user.name || 'SO',
    createdAt: stamp(),
    serverCreatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getFindings(user: AppUserLike): Promise<Finding[]> {
  const snap = await getDocs(query(collection(db, FINDINGS_COL), orderBy('createdAt', 'desc')));
  const scope = scopedBatchIds(user);
  return snap.docs
    .filter((d) => showDoc(d.data() as Record<string, unknown>))
    .map((d) => docToFinding(d.id, d.data() as Record<string, any>))
    .filter((f) => {
      if (scope === null) return true;            // CC — all
      if (isSO(user.role)) return scope.includes(f.batchId);
      // Other staff (Clerk/QM/Ustad): only findings assigned to their role
      // so they can respond with corrective-action progress.
      return f.assignedToRole === user.role;
    });
}

/**
 * Lifecycle transitions. SO/CC drive open→(assign)→verify/close/rework.
 * The assigned responsible role may move a finding to "submitted" (action
 * done) — that is the ONLY write a non-SO/CC role performs, enforced in
 * Firestore rules by assignedToRole == caller role.
 */
export async function updateFindingStatus(
  user: AppUserLike & { assignedBatchIds?: string[] | null },
  id: string,
  before: Finding,
  transition:
    | { to: 'in_progress'; actorName?: string }
    | { to: 'submitted'; actorName?: string }
    | { to: 'closed'; closureRemarks?: string; actorName?: string }
    | { to: 'rework'; reworkReason: string; actorName?: string },
): Promise<void> {
  const name = user.displayName || user.name || transition.actorName || '';
  const now = stamp();
  const base: Record<string, unknown> = {
    updatedBy: user.uid,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  };

  const soOrCC = isSO(user.role) || isCC(user.role);

  switch (transition.to) {
    case 'in_progress':
      // Assigned responsible role acknowledges; SO/CC may also set it.
      if (!soOrCC && user.role !== before.assignedToRole) {
        throw new Error('Authorization: sirf assigned role ya SO is finding pe kaam shuru kar sakta hai.');
      }
      base.status = 'in_progress';
      break;

    case 'submitted':
      // Responsible role submits completed corrective action for verification.
      if (!soOrCC && user.role !== before.assignedToRole) {
        throw new Error('Authorization: sirf assigned role corrective action submit kar sakta hai.');
      }
      base.status = 'submitted';
      base.submittedBy = user.uid;
      base.submittedAt = now;
      break;

    case 'closed':
      // Verification + closure = SO/CC only.
      if (!soOrCC) {
        throw new Error('Authorization: verification/closure sirf Senior Officer / Commander kar sakta hai.');
      }
      if (!canAccessBatch(user, before.batchId)) {
        throw new Error('Authorization: is batch ki finding aapko assigned nahi hai.');
      }
      base.status = 'closed';
      base.verifiedBy = user.uid;
      base.verifiedByName = name;
      base.verifiedAt = now;
      base.closureRemarks = transition.closureRemarks ?? '';
      base.reworkReason = '';
      break;

    case 'rework':
      // Reject / request rework = SO/CC only.
      if (!soOrCC) {
        throw new Error('Authorization: rework sirf Senior Officer / Commander request kar sakta hai.');
      }
      if (!canAccessBatch(user, before.batchId)) {
        throw new Error('Authorization: is batch ki finding aapko assigned nahi hai.');
      }
      base.status = 'rework';
      base.reworkReason = transition.reworkReason;
      base.verifiedBy = user.uid;
      base.verifiedByName = name;
      base.verifiedAt = now;
      break;
  }

  await updateDoc(doc(db, FINDINGS_COL, id), base);
}

/** SO/CC may edit editable finding fields (never ownership/authorization). */
export async function updateFinding(
  user: AppUserLike,
  id: string,
  before: Finding,
  updates: Partial<Finding>,
): Promise<void> {
  if (!isSO(user.role) && !isCC(user.role)) {
    throw new Error('Authorization: finding edit nahi kar sakte.');
  }
  if (!canAccessBatch(user, before.batchId)) {
    throw new Error('Authorization: is batch ki finding aapko assigned nahi hai.');
  }
  const immutable = ['batchId', 'createdBy', 'inspectionId', 'verifiedBy', 'verifiedAt', 'submittedBy', 'submittedAt'];
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (!immutable.includes(k)) safe[k] = v;
  }
  await updateDoc(doc(db, FINDINGS_COL, id), {
    ...safe,
    updatedBy: user.uid,
    updatedAt: stamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function deleteFinding(user: AppUserLike, finding: Finding): Promise<void> {
  if (!isCC(user.role) && !(isSO(user.role) && finding.createdBy === user.uid)) {
    throw new Error('Authorization: finding delete nahi kar sakte.');
  }
  if (!isCC(user.role) && !['open', 'rework'].includes(finding.status)) {
    throw new Error('Sirf open/rework finding delete ho sakti hai.');
  }
  if (!canAccessBatch(user, finding.batchId)) {
    throw new Error('Authorization: is batch ki finding aapko assigned nahi hai.');
  }
  await deleteDoc(doc(db, FINDINGS_COL, finding.id));
}
