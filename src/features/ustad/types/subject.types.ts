// ============================================
// SUBJECT TYPES - BSF Training Command ERP
// ============================================

// ─── Subject Master ──────────────────────────
export interface Subject {
  id: string;
  name: string;
  code: string;                        // e.g., "WT", "DRILL", "PT"
  category: string;                    // e.g., "Weapon", "Physical", "Academic"
  description: string;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
}

// ─── Subject Form Data ───────────────────────
export interface SubjectFormData {
  name: string;
  code: string;
  category: string;
  description: string;
  isActive: boolean;
}

// ─── Subject Assignment ──────────────────────
// One staff can have multiple subjects
export interface StaffSubjectAssignment {
  id: string;
  staffId: string;
  staffName: string;                   // denormalized for easy query
  forceNumber: string;                 // denormalized
  subjectId: string;
  subjectName: string;                 // denormalized
  subjectCode: string;                 // denormalized
  assignedDate: Date | null;
  assignedBy: string;
  isActive: boolean;
  remarks: string;
  createdAt: Date | null;
}

// ─── Assignment Form Data ────────────────────
export interface AssignmentFormData {
  staffId: string;
  subjectIds: string[];                // Multiple subjects at once
  assignedDate: string;
  remarks: string;
}

// ─── Default Values ──────────────────────────
export const DEFAULT_SUBJECT_FORM: SubjectFormData = {
  name: '',
  code: '',
  category: '',
  description: '',
  isActive: true,
};

export const DEFAULT_ASSIGNMENT_FORM: AssignmentFormData = {
  staffId: '',
  subjectIds: [],
  assignedDate: '',
  remarks: '',
};