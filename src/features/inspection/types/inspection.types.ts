// ═══════════════════════════════════════════════════════════════════════
// SO (Senior Officer / Inspector) — Inspection module types
// ───────────────────────────────────────────────────────────────────────
// SO is a SUPERVISORY/inspection role — not another Company Commander.
// Flow: Inspect → Observe → Record findings → Assign corrective action →
//       Follow up → Verify closure → Report to Commander.
// ═══════════════════════════════════════════════════════════════════════

/** The role label used across the app (kept in sync with AuthContext). */
export const SO_ROLE = 'Senior Officer / Inspector';

export type Severity = 'critical' | 'major' | 'minor' | 'observation';

export type InspectionStatus = 'draft' | 'submitted' | 'closed';

export type FindingStatus =
  | 'open'           // finding logged, not yet actioned
  | 'in_progress'    // corrective action underway (assigned role)
  | 'submitted'      // corrective action submitted for SO verification
  | 'closed'         // verified & closed by SO
  | 'rework';        // SO rejected / asked for rework

export const INSPECTION_TYPES = [
  'Training',
  'Discipline',
  'Attendance',
  'Accommodation',
  'Mess',
  'Kit / Turnout',
  'Documentation',
  'Welfare',
  'Administration',
  'Safety',
  'General',
] as const;
export type InspectionType = typeof INSPECTION_TYPES[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  major: 'bg-orange-100 text-orange-800 border-orange-300',
  minor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  observation: 'bg-blue-100 text-blue-800 border-blue-300',
};

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  submitted: 'Submitted for Verification',
  closed: 'Closed',
  rework: 'Rework Required',
};

export const FINDING_STATUS_COLORS: Record<FindingStatus, string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  submitted: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
  rework: 'bg-orange-100 text-orange-700',
};

/** Which existing staff role owns a corrective action. */
export const RESPONSIBLE_ROLES = [
  'Company Commander',
  'Clerk',
  'Quarter Master',
  'Ustad',
  'Senior Officer / Inspector',
] as const;
export type ResponsibleRole = typeof RESPONSIBLE_ROLES[number];

// ── Inspection (the inspection event) ──
export interface Inspection {
  id: string;
  batchId: string;
  batchNumber?: string;
  batchName?: string;
  inspectionType: InspectionType | string;
  inspectionDate: string;          // YYYY-MM-DD (local business date)
  inspectorId: string;             // SO user id
  inspectorName: string;
  subject: string;                 // area/topic
  observations: string;
  status: InspectionStatus;
  severity?: Severity;             // overall severity (optional summary)
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

// ── Finding / Corrective action ──
export interface Finding {
  id: string;
  batchId: string;
  batchNumber?: string;
  inspectionId: string;
  category: string;                // inspection category/area
  title: string;
  description: string;
  severity: Severity;
  responsibleArea: string;         // e.g. "Mess", "Training", "Documentation"
  assignedToRole: ResponsibleRole | string;
  assignedToName?: string;
  dueDate: string;                 // YYYY-MM-DD
  status: FindingStatus;
  correctiveAction: string;        // what must be done
  // verification / audit trail
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  submittedBy?: string;
  submittedAt?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  reworkReason?: string;
  closureRemarks?: string;
}
