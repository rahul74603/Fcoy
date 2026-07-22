// ============================================
// EXAMINATION & PERFORMANCE TYPES
// ============================================

export type ExamStatus = 
  | 'scheduled' 
  | 'ongoing' 
  | 'completed' 
  | 'cancelled';

export type Grade = 
  | 'A+' | 'A' | 'B+' 
  | 'B' | 'C' | 'D' | 'F';

// ─── Examination ─────────────────────────────
export interface TrainingExam {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;                 // denormalized
  batchId: string;
  batchName: string;                   // denormalized
  instructorId: string;
  instructorName: string;              // denormalized
  examDate: Date | null;
  examType: string;                    // Written, Practical, PT Test etc - dynamic
  totalMarks: number;
  passingMarks: number;
  duration: number;                    // in minutes
  venue: string;
  status: ExamStatus;
  remarks: string;
  createdAt: Date | null;
  createdBy: string;
}

// ─── Exam Result ─────────────────────────────
export interface ExamResult {
  id: string;
  examId: string;
  examName: string;                    // denormalized
  traineeId: string;
  traineeName: string;                 // denormalized
  chestNumber: string;
  subjectId: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  grade: Grade;
  status: 'pass' | 'fail';
  weakAreas: string[];
  instructorRemarks: string;
  improvementSuggestions: string;
  createdAt: Date | null;
}

// ─── Exam Form ───────────────────────────────
export interface ExamFormData {
  name: string;
  subjectId: string;
  batchId: string;
  instructorId: string;
  examDate: string;
  examType: string;
  totalMarks: number;
  passingMarks: number;
  duration: number;
  venue: string;
  remarks: string;
}

// ─── Result Form ─────────────────────────────
export interface ResultFormData {
  examId: string;
  traineeId: string;
  chestNumber: string;
  marks: number;
  weakAreas: string[];
  instructorRemarks: string;
  improvementSuggestions: string;
}

// ─── Grade Calculator ────────────────────────
export const calculateGrade = (percentage: number): Grade => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
};

export const DEFAULT_EXAM_FORM: ExamFormData = {
  name: '',
  subjectId: '',
  batchId: '',
  instructorId: '',
  examDate: '',
  examType: '',
  totalMarks: 100,
  passingMarks: 35,
  duration: 60,
  venue: '',
  remarks: '',
};