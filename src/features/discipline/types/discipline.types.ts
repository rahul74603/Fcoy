// ═══════════════════════════════════════════════════════════
// DISCIPLINE / CONDUCT REGISTER TYPES (Anushasan Register)
// BSF STC Tekanpur Pattern
// ═══════════════════════════════════════════════════════════

export type DisciplineType = 'Punishment' | 'Award' | 'Commendation' | 'Warning' | 'Restriction';

export type DisciplineCategory =
  | 'Parade Violation'
  | 'Unauthorized Absence'
  | 'Disobedience'
  | 'Insolence'
  | 'Dress Violation'
  | 'Barrack Offence'
  | 'Mess Offence'
  | 'Training Negligence'
  | 'Weapon Mishandling'
  | 'Substance Abuse'
  | 'Violence'
  | 'Theft'
  | 'Good Performance'
  | 'Bravery'
  | 'Best Firer'
  | 'Best in PT'
  | 'Best in Drill'
  | 'Cleanest Barrack'
  | 'Other';

export type DisciplineStatus = 'Active' | 'Completed' | 'Expired' | 'Revoked';

export interface DisciplineRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  platoon: string;
  batchId: string;

  // Record Info
  type: DisciplineType;
  category: DisciplineCategory;
  description: string;
  date: string;                    // Date of incident/award
  effectiveDate: string;           // When it takes effect
  endDate?: string;                // When punishment ends (if duration-based)

  // Authority
  awardedBy: string;               // Officer name + rank
  authority: string;               // Order reference / authority

  // Punishment specific
  punishmentDays?: number;         // Duration in days
  punishmentType?: string;         // Extra drill, confinement, restriction, etc.

  // Status
  status: DisciplineStatus;
  remarks: string;

  // Meta
  createdAt: string;
  createdBy: string;
}

export interface DisciplineFormData {
  traineeId: string;
  type: DisciplineType;
  category: DisciplineCategory;
  description: string;
  date: string;
  effectiveDate: string;
  endDate: string;
  awardedBy: string;
  authority: string;
  punishmentDays: number;
  punishmentType: string;
  remarks: string;
}

export const DISCIPLINE_TYPE_CONFIG: Record<DisciplineType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  Punishment: { label: 'Sazaa (Punishment)', icon: '🔴', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300' },
  Award: { label: 'Inaam (Award)', icon: '🏆', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' },
  Commendation: { label: 'Prashansa (Commendation)', icon: '⭐', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300' },
  Warning: { label: 'Chetavani (Warning)', icon: '⚠️', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' },
  Restriction: { label: 'Pabandi (Restriction)', icon: '🚫', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300' },
};

export const DISCIPLINE_CATEGORIES: DisciplineCategory[] = [
  'Parade Violation', 'Unauthorized Absence', 'Disobedience', 'Insolence',
  'Dress Violation', 'Barrack Offence', 'Mess Offence', 'Training Negligence',
  'Weapon Mishandling', 'Substance Abuse', 'Violence', 'Theft',
  'Good Performance', 'Bravery', 'Best Firer', 'Best in PT', 'Best in Drill',
  'Cleanest Barrack', 'Other',
];

export const PUNISHMENT_TYPES = [
  'Extra Drill', 'Confinement', 'Restriction to Barracks', 'Extra Guard Duty',
  'Fatigue Duty', 'Written Warning', 'Verbal Warning', 'Fine',
  'Reduction in Rank', 'Counseling', 'Other',
];
