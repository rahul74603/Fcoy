// ═══════════════════════════════════════════════════════════
// TRAINEE MAPPER — T-121
// Converts between Firestore raw data and Trainee type
// ═══════════════════════════════════════════════════════════

import type { Trainee, CreateTraineeInput, KitIssueEntry, DocumentEntry } from '../types/trainee.types';

/**
 * Convert raw Firestore document to Trainee type
 * Handles missing fields, null values, Timestamp conversion
 */
export function firestoreToTrainee(raw: any, id: string): Trainee {
  return {
    id,
    // Identity
    regNo:              String(raw.regNo ?? ''),
    chestNo:            raw.chestNo ?? undefined,
    serviceNo:          raw.serviceNo ?? undefined,
    rollNo:             raw.rollNo ?? undefined,
    rank:               raw.rank ?? 'RCT',
    name:               String(raw.name ?? ''),
    fatherName:         raw.fatherName ?? undefined,
    motherName:         raw.motherName ?? undefined,
    dob:                raw.dob ?? undefined,
    age:                raw.age ?? undefined,
    gender:             raw.gender ?? 'Male',
    bloodGroup:         raw.bloodGroup ?? 'O+',
    religion:           raw.religion ?? 'Hindu',
    category:           raw.category ?? 'General',
    maritalStatus:      raw.maritalStatus ?? 'Unmarried',
    aadharNo:           raw.aadharNo ?? undefined,
    panNo:              raw.panNo ?? undefined,
    identificationMarks: raw.identificationMarks ?? undefined,

    // Contact
    mobileNo:           raw.mobileNo ?? undefined,
    email:              raw.email ?? undefined,
    emergencyContact:   raw.emergencyContact ?? undefined,
    emergencyContactName: raw.emergencyContactName ?? undefined,
    relationship:       raw.relationship ?? undefined,

    // Address
    village:            raw.village ?? undefined,
    tehsil:             raw.tehsil ?? undefined,
    district:           raw.district ?? undefined,
    state:              raw.state ?? undefined,
    pinCode:            raw.pinCode ?? undefined,

    // Education
    education:          raw.education ?? undefined,
    boardUniversity:    raw.boardUniversity ?? undefined,
    passingYear:        raw.passingYear ?? undefined,
    percentage:         raw.percentage ?? undefined,

    // Physical
    height:             raw.height ?? undefined,
    weight:             raw.weight ?? undefined,
    chest:              raw.chest ?? undefined,
    shoeSize:           raw.shoeSize ?? undefined,
    dressSize:          raw.dressSize ?? undefined,

    // Recruitment
    recruitmentCenter:  raw.recruitmentCenter ?? undefined,
    joinDate:           raw.joinDate ?? undefined,

    // Batch
    batchId:            String(raw.batchId ?? ''),
    batchNumber:        raw.batchNumber ?? undefined,
    batchName:          raw.batchName ?? undefined,
    platoon:            raw.platoon ?? undefined,
    section:            raw.section ?? undefined,
    company:            raw.company ?? undefined,

    // Medical
    medStat:            raw.medStat ?? 'SHAPE-1',
    medRemarks:         raw.medRemarks ?? undefined,

    // Performance
    ptScore:            raw.ptScore ?? undefined,
    fptResult:          raw.fptResult ?? undefined,
    fptScore:           raw.fptScore ?? undefined,
    weeklyExamResult:   raw.weeklyExamResult ?? undefined,
    weeklyExamMarks:    raw.weeklyExamMarks ?? undefined,
    weaponNo:           raw.weaponNo ?? undefined,
    rifleNo:            raw.rifleNo ?? undefined,
    weaponQual:         raw.weaponQual ?? undefined,
    firingResult:       raw.firingResult ?? undefined,
    firingScore:        raw.firingScore ?? undefined,

    // Status
    attn:               raw.attn ?? 'P',
    punishments:        raw.punishments ?? undefined,
    remarks:            raw.remarks ?? undefined,
    completionStatus:   raw.completionStatus ?? undefined,

    // Photo
    photoURL:           raw.photoURL ?? undefined,
    photoPath:          raw.photoPath ?? undefined,

    // Kit
    kitIssued:          raw.kitIssued ?? false,
    issuedItems:        raw.issuedItems ?? [],
    issuedKitItems:     (raw.issuedKitItems ?? []) as KitIssueEntry[],
    lastKitIssueDate:   raw.lastKitIssueDate ?? undefined,

    // Documents
    documents:          raw.documents ?? undefined,
    docsComplete:       raw.docsComplete ?? undefined,

    // Metadata
    createdAt:          raw.createdAt ?? undefined,
    updatedAt:          raw.updatedAt ?? undefined,
    createdBy:          raw.createdBy ?? undefined,
  };
}

/**
 * Convert Trainee type to Firestore-safe plain object
 * Strips undefined values, ensures proper types
 */
export function traineeToFirestore(t: Partial<Trainee>): Record<string, any> {
  const result: Record<string, any> = {};

  const fields: (keyof Trainee)[] = [
    'regNo', 'chestNo', 'serviceNo', 'rollNo', 'rank', 'name',
    'fatherName', 'motherName', 'dob', 'age', 'gender', 'bloodGroup',
    'religion', 'category', 'maritalStatus', 'aadharNo', 'panNo',
    'identificationMarks', 'mobileNo', 'email', 'emergencyContact',
    'emergencyContactName', 'relationship', 'village', 'tehsil',
    'district', 'state', 'pinCode', 'education', 'boardUniversity',
    'passingYear', 'percentage', 'height', 'weight', 'chest',
    'shoeSize', 'dressSize', 'recruitmentCenter', 'joinDate',
    'batchId', 'batchNumber', 'batchName', 'platoon', 'section',
    'company', 'medStat', 'medRemarks', 'ptScore', 'fptResult',
    'fptScore', 'weeklyExamResult', 'weeklyExamMarks', 'weaponNo',
    'rifleNo', 'weaponQual', 'firingResult', 'firingScore',
    'attn', 'punishments', 'remarks', 'completionStatus',
    'photoURL', 'photoPath', 'kitIssued', 'issuedItems',
    'issuedKitItems', 'lastKitIssueDate', 'documents', 'docsComplete',
  ];

  for (const field of fields) {
    const val = t[field];
    if (val !== undefined) {
      result[field] = val === null ? null : val;
    }
  }

  return result;
}

/**
 * Calculate age from DOB string (YYYY-MM-DD)
 */
export function calculateAge(dob: string): string {
  if (!dob) return '';
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age.toString();
}

/**
 * Format date for display (en-IN)
 */
export function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get full display name with rank
 */
export function getDisplayName(trainee: Trainee): string {
  return `${trainee.rank || 'RCT'} ${trainee.name}`;
}

/**
 * Get attendance status label
 */
export function getAttendanceLabel(code: string): string {
  const map: Record<string, string> = {
    P: '✅ Present',
    A: '🚫 Absent',
    L: '✈️ Leave',
    S: '🤒 Sick',
    H: '🏥 Hospital',
    R: '🛌 Rest',
    M: '🩺 Medical',
    T: '🏃 Training',
  };
  return map[code] || code || 'P';
}
