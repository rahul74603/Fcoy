// ═══════════════════════════════════════════════════════════
// FINAL RESULT TYPES (Antim Board Parinaam)
// ═══════════════════════════════════════════════════════════

export type FinalRecommendation = 'Fit for Duty' | 'Unfit' | 'Conditional' | 'Re-Test Required';

export interface FinalResult {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  platoon: string;
  batchId: string;

  // Aggregated scores
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  overallGrade: string;
  position: number;

  // Component scores
  ptScore: number;
  drillScore: number;
  weaponScore: number;
  firingScore: number;
  writtenScore: number;
  attendancePercentage: number;

  // Classification
  fptResult: string;
  firingClassification: string;  // MM/FC/SS/FAIL
  recommendation: FinalRecommendation;

  // Board
  passedOutDate: string;
  certificateNo: string;
  boardMembers: string[];
  remarks: string;
  createdAt: string;
}

export const RECOMMENDATION_CONFIG: Record<FinalRecommendation, { color: string; bg: string; icon: string }> = {
  'Fit for Duty': { color: 'text-green-800', bg: 'bg-green-100', icon: '✅' },
  'Unfit': { color: 'text-red-800', bg: 'bg-red-100', icon: '❌' },
  'Conditional': { color: 'text-amber-800', bg: 'bg-amber-100', icon: '⚠️' },
  'Re-Test Required': { color: 'text-purple-800', bg: 'bg-purple-100', icon: '🔄' },
};
