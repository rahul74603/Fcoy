// ═══════════════════════════════════════════════════════════
// CANONICAL TRAINEE TYPE — T-120
// Complete TypeScript domain model for BSF Trainee
// Matches actual Firestore data + UI fields
// ═══════════════════════════════════════════════════════════

/** Trainee lifecycle states */
export type TraineeStatus =
  | 'Joined'           // Just arrived at training center
  | 'Training'         // Active in training
  | 'On Leave'         // Approved leave
  | 'Medical'          // Sick / Hospital
  | 'Under Training'   // Re-test / Extra training
  | 'Failed'           // Failed final board
  | 'Re-test'          // Appearing for re-test
  | 'Passed'           // Cleared final board
  | 'Withheld'         // Result withheld
  | 'Withdrawn'        // Withdrawn from training
  | 'Discharged'       // Discharged from service
  | 'Posted'           // Posted to unit
  | 'Relieved';        // Relieved from training center

/** Attendance status codes */
export type AttendanceCode =
  | 'P'   // Present
  | 'A'   // Absent
  | 'L'   // Leave
  | 'S'   // Sick / MI Room
  | 'H'   // Hospital Admitted
  | 'R'   // B/C Rest (Light Duty)
  | 'M'   // Medical Appointment
  | 'T';  // Training Away

/** Medical fitness status */
export type MedicalStatus =
  | 'SHAPE-1'
  | 'SHAPE-2'
  | 'Temporary Unfit'
  | 'Permanent Unfit';

/** Gender */
export type Gender = 'Male' | 'Female';

/** Marital status */
export type MaritalStatus = 'Unmarried' | 'Married' | 'Divorced' | 'Widower';

/** Blood group */
export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';

/** Religion */
export type Religion = 'Hindu' | 'Muslim' | 'Sikh' | 'Christian' | 'Buddhist' | 'Jain' | 'Other';

/** Category */
export type Category = 'General' | 'OBC' | 'SC' | 'ST' | 'EWS';

/** Education qualification */
export type EducationQual = '8th Pass' | '10th Pass' | '12th Pass' | 'Graduation' | 'Post Graduation';

/** Rank */
export type TraineeRank = 'RCT' | 'GD' | 'HG' | 'CT' | 'SCT' | 'HC' | 'ASI' | 'SI' | 'Insp';

// ═══════════════════════════════════════════════════════════
// DOCUMENT ENTRY
// ═══════════════════════════════════════════════════════════
export interface DocumentEntry {
  status: 'Pending' | 'Uploaded' | 'Verified' | 'Rejected';
  isRequired: boolean;
  url?: string;
  uploadedAt?: string;
  verifiedBy?: string;
  remarks?: string;
}

// ═══════════════════════════════════════════════════════════
// KIT ITEM ENTRY
// ═══════════════════════════════════════════════════════════
export interface KitIssueEntry {
  itemName: string;
  quantity: number;
  assignedSize?: string;
  issueDate?: string;
  issuedBy?: string;
  condition?: 'New' | 'Good' | 'Fair' | 'Worn';
  returnDate?: string;
}

// ═══════════════════════════════════════════════════════════
// MAIN TRAINEE INTERFACE
// ═══════════════════════════════════════════════════════════
export interface Trainee {
  // ── Firestore ID ──
  id: string;

  // ── Identity ──
  regNo: string;              // Registration number (UNIQUE)
  chestNo?: string;           // Chest number (UNIQUE within batch)
  serviceNo?: string;         // Service number (UNIQUE)
  rollNo?: string;            // Roll number (UNIQUE within batch)
  rank: TraineeRank;
  name: string;
  fatherName?: string;
  motherName?: string;
  dob?: string;               // YYYY-MM-DD
  age?: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  religion: Religion;
  category: Category;
  maritalStatus: MaritalStatus;
  aadharNo?: string;
  panNo?: string;
  identificationMarks?: string;

  // ── Contact ──
  mobileNo?: string;
  email?: string;
  emergencyContact?: string;
  emergencyContactName?: string;
  relationship?: string;

  // ── Address ──
  village?: string;
  tehsil?: string;
  district?: string;
  state?: string;
  pinCode?: string;

  // ── Education ──
  education?: EducationQual;
  boardUniversity?: string;
  passingYear?: string;
  percentage?: string;

  // ── Physical ──
  height?: string;            // cm
  weight?: string;            // kg
  chest?: string;             // e.g. "77/82"
  shoeSize?: string;
  dressSize?: string;

  // ── Recruitment ──
  recruitmentCenter?: string;
  joinDate?: string;          // YYYY-MM-DD

  // ── Batch Assignment ──
  batchId: string;
  batchNumber?: string;
  batchName?: string;
  platoon?: string;
  section?: string;
  company?: string;

  // ── Medical ──
  medStat: MedicalStatus;
  medRemarks?: string;

  // ── Performance ──
  ptScore?: string;
  fptResult?: string;         // 'Pass' | 'Fail'
  fptScore?: string;
  weeklyExamResult?: string;
  weeklyExamMarks?: string;
  weaponNo?: string;
  rifleNo?: string;
  weaponQual?: string;
  firingResult?: string;
  firingScore?: string;

  // ── Status ──
  attn: AttendanceCode;
  punishments?: string;
  remarks?: string;
  completionStatus?: TraineeStatus;

  // ── Photo ──
  photoURL?: string;
  photoPath?: string;

  // ── Kit ──
  kitIssued?: boolean;
  issuedItems?: string[];
  issuedKitItems?: KitIssueEntry[];
  lastKitIssueDate?: string;

  // ── Documents ──
  documents?: Record<string, DocumentEntry>;
  docsComplete?: boolean;

  // ── Metadata ──
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// ═══════════════════════════════════════════════════════════
// CREATE INPUT (for registration)
// ═══════════════════════════════════════════════════════════
export type CreateTraineeInput = Omit<Trainee, 'id' | 'createdAt' | 'updatedAt'>;

// ═══════════════════════════════════════════════════════════
// UPDATE INPUT (for edit)
// ═══════════════════════════════════════════════════════════
export type UpdateTraineeInput = Partial<Omit<Trainee, 'id' | 'createdAt'>>;

// ═══════════════════════════════════════════════════════════
// SEARCH RESULT (lightweight for lists)
// ═══════════════════════════════════════════════════════════
export interface TraineeSearchResult {
  id: string;
  name?: string;
  regNo?: string;
  chestNo?: string;
  batchId?: string;
  batchNumber?: string;
  batchName?: string;
  platoon?: string;
  section?: string;
  rank?: string;
  attn?: string;
  medStat?: string;
  photoURL?: string;
  photoPath?: string;
  [key: string]: any; // Allow additional fields from Firestore
}

// ═══════════════════════════════════════════════════════════
// TRAINING SESSION (Phase 15)
// ═══════════════════════════════════════════════════════════
export interface TrainingSession {
  id: string;
  batchId: string;
  subject: string;
  topic: string;
  sessionDate: string;        // YYYY-MM-DD
  period: string;             // e.g. "Period 1"
  instructorId?: string;
  instructorName?: string;
  sessionType: 'Theory' | 'Practical' | 'Drill' | 'Firing' | 'Field';
  duration: number;           // minutes
  attendanceTaken: boolean;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════
// LEAVE APPLICATION (Phase 14)
// ═══════════════════════════════════════════════════════════
export type LeaveStatus =
  | 'Applied'
  | 'Recommended'
  | 'Sanctioned'
  | 'Departed'
  | 'Returned'
  | 'Overstay'
  | 'Rejected'
  | 'Cancelled';

export type LeaveType =
  | 'Casual Leave'
  | 'Medical Leave'
  | 'Emergency Leave'
  | 'Earned Leave'
  | 'Restricted Holiday'
  | 'Other';

export interface LeaveApplication {
  id: string;
  traineeId: string;
  traineeName?: string;
  chestNo?: string;
  batchId: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  recommendedBy?: string;
  recommendedDate?: string;
  sanctionedBy?: string;
  sanctionedDate?: string;
  actualDepartureDate?: string;
  actualReturnDate?: string;
  expectedReturnDate?: string;
  overstayDays?: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════
// DISCIPLINE CASE (Phase 17)
// ═══════════════════════════════════════════════════════════
export type DisciplineCaseStatus =
  | 'Reported'
  | 'Explanation Called'
  | 'Under Inquiry'
  | 'Decision Pending'
  | 'Decided'
  | 'Appealed'
  | 'Closed';

export interface DisciplineCase {
  id: string;
  traineeId: string;
  traineeName?: string;
  chestNo?: string;
  batchId: string;
  incidentDate: string;
  incidentType: string;
  description: string;
  reportedBy?: string;
  explanation?: string;
  explanationDate?: string;
  inquiryOfficer?: string;
  inquiryDate?: string;
  decision?: string;
  punishment?: string;
  appealDate?: string;
  appealOutcome?: string;
  status: DisciplineCaseStatus;
  closedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════
// MEDICAL EVENT (Phase 17)
// ═══════════════════════════════════════════════════════════
export type MedicalEventCategory =
  | 'Sick Report'
  | 'OPD'
  | 'Hospital'
  | 'Injury'
  | 'Treatment'
  | 'Fitness Certificate'
  | 'Medical Board'
  | 'Other';

export interface MedicalEvent {
  id: string;
  traineeId: string;
  batchId: string;
  date: string;
  category: MedicalEventCategory;
  diagnosis?: string;
  treatment?: string;
  hospital?: string;
  doctor?: string;
  returnToTrainingDate?: string;
  fitnessCertificate?: boolean;
  status: 'Active' | 'Resolved';
  remarks?: string;
  createdAt?: string;
}

// ═══════════════════════════════════════════════════════════
// POSTING ORDER (Phase 18)
// ═══════════════════════════════════════════════════════════
export interface PostingOrder {
  id: string;
  traineeId: string;
  traineeName?: string;
  chestNo?: string;
  batchId: string;
  postingDate: string;
  unit: string;
  location?: string;
  relievingDate?: string;
  handoverStatus: 'Pending' | 'In Progress' | 'Completed';
  clearanceId?: string;
  movementId?: string;
  remarks?: string;
  createdAt?: string;
}
