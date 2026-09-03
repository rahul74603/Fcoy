// ═══════════════════════════════════════════════════════════
// JOINING WORKFLOW TYPES (Bharti Prakriya)
// Rangroot joining lifecycle
// ═══════════════════════════════════════════════════════════

export type JoiningStage = 'Selected' | 'Called' | 'Reported' | 'Verified' | 'Medically Fit' | 'Joined' | 'Allocated';

export type JoiningStatus = 'Active' | 'Completed' | 'Dropped' | 'Transferred';

export interface JoiningRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  regNo: string;
  batchId: string;

  // Recruitment
  recruitmentCenter: string;
  selectionDate: string;
  selectionBoardNo: string;

  // Calling
  callLetterNo: string;
  callDate: string;
  reportingDate: string;
  reportingTime: string;

  // Reporting
  actualReportingDate: string;
  lateReporting: boolean;
  lateReason: string;

  // Verification
  identityVerified: boolean;
  documentsVerified: boolean;
  verifiedBy: string;
  verificationDate: string;

  // Medical
  initialMedicalDate: string;
  medicalStatus: 'Fit' | 'Unfit' | 'Temporary Unfit' | 'Pending';
  medicalRemarks: string;

  // Joining
  joiningDate: string;
  joiningAuthority: string;
  oathTaken: boolean;
  oathDate: string;

  // Allocation
  allocatedCompany: string;
  allocatedPlatoon: string;
  allocatedSection: string;
  kitIssued: boolean;

  // Status
  currentStage: JoiningStage;
  status: JoiningStatus;
  dropReason: string;
  remarks: string;
  createdAt: string;
}

export const JOINING_STAGES: { stage: JoiningStage; icon: string; color: string }[] = [
  { stage: 'Selected', icon: '🎯', color: 'bg-blue-100 text-blue-800' },
  { stage: 'Called', icon: '📨', color: 'bg-indigo-100 text-indigo-800' },
  { stage: 'Reported', icon: '🚶', color: 'bg-purple-100 text-purple-800' },
  { stage: 'Verified', icon: '✅', color: 'bg-cyan-100 text-cyan-800' },
  { stage: 'Medically Fit', icon: '🏥', color: 'bg-green-100 text-green-800' },
  { stage: 'Joined', icon: '🎖️', color: 'bg-amber-100 text-amber-800' },
  { stage: 'Allocated', icon: '📋', color: 'bg-emerald-100 text-emerald-800' },
];
