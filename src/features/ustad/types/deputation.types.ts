// ============================================
// DEPUTATION TYPES
// ============================================

export type DeputationDirection = 'incoming' | 'outgoing';
export type DeputationStatus = 'active' | 'returned' | 'cancelled';

// ─── Deputation Record ───────────────────────
export interface DeputationRecord {
  id: string;
  batchId: string;
  batchNumber: string;

  // Direction
  direction: DeputationDirection;

  // Staff Info
  staffId: string;                // For outgoing: our staff. For incoming: manual entry
  staffName: string;
  staffRank: string;
  staffForceNumber: string;
  staffCategory: string;

  // Company movement
  fromCompany: string;            // Parent company (for outgoing: our; for incoming: external)
  toCompany: string;              // Deputed to

  // Purpose
  purpose: string;                // Training/event name
  eventDetail: string;            // Additional details

  // Dates
  fromDate: Date | null;
  toDate: Date | null;            // Expected return
  actualReturnDate: Date | null;

  // Contact (for incoming staff)
  contactMobile: string;

  // Status
  status: DeputationStatus;
  remarks: string;

  // Meta
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ─── Form Data ───────────────────────────────
export interface DeputationFormData {
  direction: DeputationDirection;
  staffId: string;                // For outgoing only
  staffName: string;              // For incoming (manual)
  staffRank: string;
  staffForceNumber: string;
  staffCategory: string;
  fromCompany: string;
  toCompany: string;
  purpose: string;
  eventDetail: string;
  fromDate: string;
  toDate: string;
  contactMobile: string;
  remarks: string;
}

// ─── Default Values ──────────────────────────
export const DEFAULT_DEPUTATION_FORM: DeputationFormData = {
  direction: 'incoming',
  staffId: '',
  staffName: '',
  staffRank: '',
  staffForceNumber: '',
  staffCategory: '',
  fromCompany: '',
  toCompany: '',
  purpose: '',
  eventDetail: '',
  fromDate: new Date().toISOString().split('T')[0],
  toDate: '',
  contactMobile: '',
  remarks: '',
};

// ─── Common Purposes ─────────────────────────
export const DEPUTATION_PURPOSES = [
  'FPT (Field Physical Test)',
  'PT Training',
  'Drill Practice',
  'Weapon Training',
  'Firing Practice',
  'Map Reading Class',
  'Field Craft Exercise',
  'Battle Craft Training',
  'Parade Practice',
  'Special Training Course',
  'Yoga Session',
  'Cross Country',
  'Sports Event',
  'Passing Out Parade',
  'Combat Course',
  'Other',
] as const;

// ─── Status Colors ───────────────────────────
export const DEPUTATION_STATUS_COLORS: Record<DeputationStatus, string> = {
  active: 'bg-blue-100 text-blue-800 border-blue-300',
  returned: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const DEPUTATION_STATUS_LABELS: Record<DeputationStatus, string> = {
  active: 'Active',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

// ─── Direction Colors ────────────────────────
export const DIRECTION_COLORS: Record<DeputationDirection, string> = {
  incoming: 'bg-green-50 border-green-200 text-green-800',
  outgoing: 'bg-red-50 border-red-200 text-red-800',
};

export const DIRECTION_LABELS: Record<DeputationDirection, string> = {
  incoming: '↙ Incoming',
  outgoing: '↗ Outgoing',
};