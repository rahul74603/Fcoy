// ============================================
// STAFF TYPES - BSF Training Command ERP
// Single Source of Truth for ALL Staff Data
// ============================================

export type StaffStatus =
  | 'active'
  | 'inactive'
  | 'leave'
  | 'td'
  | 'hospital'
  | 'course'
  | 'attachment'
  | 'deputed_out'
  | 'on_deputation';

export type BloodGroup =
  | 'A+' | 'A-'
  | 'B+' | 'B-'
  | 'O+' | 'O-'
  | 'AB+' | 'AB-';

// ─── Companies ───────────────────────────────
export const COMPANIES = [
  'A Coy', 'B Coy', 'C Coy', 'D Coy',
  'E Coy', 'F Coy', 'G Coy', 'H Coy',
  'HQ Coy', 'Signal Coy', 'MT Coy',
] as const;

// ─── Ranks ───────────────────────────────────
export const RANKS = [
  'Constable', 'Head Constable', 'ASI',
  'Sub Inspector', 'Inspector',
  'Assistant Commandant', 'Deputy Commandant',
  'Commandant', 'DIG', 'IG',
] as const;

// ─── Instructor Categories ──────────────────
export const INSTRUCTOR_CATEGORIES = [
  'PT Instructor',
  'Drill Instructor',
  'Weapon Instructor',
  'FPT Instructor',
  'Yoga Instructor',
  'Map Reading',
  'Field Craft',
  'Battle Craft',
  'Communication',
  'First Aid',
  'Law Instructor',
  'Swimming',
  'Admin Staff',
  'Other',
] as const;

// ─── Emergency Contact ───────────────────────
export interface EmergencyContact {
  name: string;
  relation: string;
  mobile: string;
  address: string;
}

// ─── Staff Profile (Main Entity) ─────────────
export interface Staff {
  id: string;
  batchId: string;              // ⭐ Link to batch
  batchNumber: string;          // ⭐ Denormalized for easy display
  forceNumber: string;           // IRLA / Identity Card / BP No
  name: string;
  rank: string;
  company: string;               // A Coy, B Coy, etc
  category: string;              // PT Instructor, Drill, etc
  battalion: string;             // 3rd Bn, 5th Bn, etc
  mobile: string;
  email: string;
  dateOfJoining: Date | null;
  dateOfPosting: Date | null;
  experienceYears: number;
  qualification: string;
  bloodGroup: BloodGroup | '';
  emergencyContact: EmergencyContact;
  status: StaffStatus;
  photoURL: string;
  remarks: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
}

// ─── Staff Form Data (for Add/Edit) ──────────
export interface StaffFormData {
  batchId: string;              // ⭐ Auto-filled from active batch
  forceNumber: string;
  name: string;
  rank: string;
  company: string;
  category: string;
  battalion: string;
  mobile: string;
  email: string;
  dateOfJoining: string;
  dateOfPosting: string;
  experienceYears: number;
  qualification: string;
  bloodGroup: BloodGroup | '';
  emergencyContact: EmergencyContact;
  status: StaffStatus;
  photoURL: string;
  remarks: string;
}

// ─── Staff Filter ────────────────────────────
export interface StaffFilter {
  search: string;
  status: StaffStatus | 'all';
  rank: string | 'all';
  company: string | 'all';
  category: string | 'all';
}

// ─── Default Values ──────────────────────────
export const DEFAULT_EMERGENCY_CONTACT: EmergencyContact = {
  name: '',
  relation: '',
  mobile: '',
  address: '',
};

export const DEFAULT_STAFF_FORM: StaffFormData = {
  batchId: '',                  // ⭐ Will be set from activeBatch
  forceNumber: '',
  name: '',
  rank: '',
  company: '',
  category: '',
  battalion: '',
  mobile: '',
  email: '',
  dateOfJoining: '',
  dateOfPosting: '',
  experienceYears: 0,
  qualification: '',
  bloodGroup: '',
  emergencyContact: DEFAULT_EMERGENCY_CONTACT,
  status: 'active',
  photoURL: '',
  remarks: '',
};

export const DEFAULT_STAFF_FILTER: StaffFilter = {
  search: '',
  status: 'all',
  rank: 'all',
  company: 'all',
  category: 'all',
};

// ─── Status Labels ───────────────────────────
export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  leave: 'On Leave',
  td: 'Temporary Duty',
  hospital: 'Hospital',
  course: 'On Course',
  attachment: 'Attachment',
  deputed_out: 'Deputed Out',
  on_deputation: 'On Deputation',
};

// ─── Status Colors ───────────────────────────
export const STAFF_STATUS_COLORS: Record<StaffStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  leave: 'bg-yellow-100 text-yellow-800',
  td: 'bg-blue-100 text-blue-800',
  hospital: 'bg-red-100 text-red-800',
  course: 'bg-purple-100 text-purple-800',
  attachment: 'bg-orange-100 text-orange-800',
  deputed_out: 'bg-pink-100 text-pink-800',
  on_deputation: 'bg-cyan-100 text-cyan-800',
};

// ─── Category Icons ──────────────────────────
export const CATEGORY_ICONS: Record<string, string> = {
  'PT Instructor': '🏋️',
  'Drill Instructor': '🎖️',
  'Weapon Instructor': '🔫',
  'FPT Instructor': '⚡',
  'Yoga Instructor': '🧘',
  'Map Reading': '🗺️',
  'Field Craft': '⛺',
  'Battle Craft': '⚔️',
  'Communication': '📡',
  'First Aid': '🏥',
  'Law Instructor': '⚖️',
  'Swimming': '🏊',
  'Admin Staff': '📋',
  'Other': '📌',
};

// ─── Category Colors ─────────────────────────
export const CATEGORY_COLORS: Record<string, string> = {
  'PT Instructor': 'bg-blue-100 text-blue-800 border-blue-300',
  'Drill Instructor': 'bg-purple-100 text-purple-800 border-purple-300',
  'Weapon Instructor': 'bg-red-100 text-red-800 border-red-300',
  'FPT Instructor': 'bg-orange-100 text-orange-800 border-orange-300',
  'Yoga Instructor': 'bg-green-100 text-green-800 border-green-300',
  'Map Reading': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'Field Craft': 'bg-amber-100 text-amber-800 border-amber-300',
  'Battle Craft': 'bg-rose-100 text-rose-800 border-rose-300',
  'Communication': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'First Aid': 'bg-pink-100 text-pink-800 border-pink-300',
  'Law Instructor': 'bg-slate-100 text-slate-800 border-slate-300',
  'Swimming': 'bg-sky-100 text-sky-800 border-sky-300',
  'Admin Staff': 'bg-gray-100 text-gray-800 border-gray-300',
  'Other': 'bg-zinc-100 text-zinc-800 border-zinc-300',
};