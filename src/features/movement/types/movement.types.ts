// ═══════════════════════════════════════════════════════════
// MOVEMENT / TRANSFER REGISTER TYPES (Sthanantar Register)
// BSF STC Tekanpur Pattern
// ═══════════════════════════════════════════════════════════

export type MovementType = 'Transfer' | 'Posting' | 'Detachment' | 'Return' | 'Temporary Duty' | 'Course';

export type MovementStatus = 'Ordered' | 'Completed' | 'Overdue' | 'Cancelled';

export interface MovementRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  platoon: string;
  batchId: string;

  type: MovementType;
  fromUnit: string;
  toUnit: string;
  fromPlace: string;
  toPlace: string;
  movementOrderNo: string;
  orderDate: string;
  movementDate: string;
  reportingDate: string;
  actualReportingDate?: string;
  status: MovementStatus;
  authority: string;
  purpose: string;
  remarks: string;
  createdAt: string;
  createdBy: string;
}

export const MOVEMENT_TYPE_CONFIG: Record<MovementType, { label: string; icon: string; color: string }> = {
  Transfer: { label: 'Sthanantar (Transfer)', icon: '🔄', color: 'text-blue-700' },
  Posting: { label: 'Posting', icon: '📋', color: 'text-purple-700' },
  Detachment: { label: 'Tukda Bandi (Detachment)', icon: '✂️', color: 'text-orange-700' },
  Return: { label: 'Wapsi (Return)', icon: '↩️', color: 'text-green-700' },
  'Temporary Duty': { label: 'Temporary Duty (TD)', icon: '⏱️', color: 'text-amber-700' },
  Course: { label: 'Course / Training', icon: '🎓', color: 'text-cyan-700' },
};
