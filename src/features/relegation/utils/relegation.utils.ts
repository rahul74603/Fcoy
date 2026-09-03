// Pure helpers — RelID, chest "R" suffix, strength filter.
// No Firebase imports so security-tests.mjs can transpile & run them.

const REL_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Strip trailing R / R2 / RR so original chest identity mil jaye. "25R" → "25", "25R2" → "25". */
export function originalChestBase(chestNo: string | undefined | null): string {
  const raw = String(chestNo ?? '').trim().toUpperCase();
  if (!raw) return '';
  return raw.replace(/R+\d*$/i, '') || raw;
}

/**
 * Rejoin chest: original 25 → 25R (Capital R, duplicate se bachaav).
 * Agar 25R already taken hai naya batch me, caller uniqueRejoinChestNo
 * se 25R2, 25R3 try karega.
 */
export function rejoinChestNo(originalChest: string | undefined | null): string {
  const base = originalChestBase(originalChest);
  if (!base) return 'R';
  return `${base}R`;
}

/** Next candidate after a collision: 25R → 25R2 → 25R3 … */
export function nextRejoinChestNo(desired: string, attempt: number): string {
  const base = originalChestBase(desired);
  if (attempt <= 1) return `${base}R`;
  return `${base}R${attempt}`;
}

export function generateRelegateId(chestNo: string | undefined | null, now = new Date()): string {
  const year = now.getFullYear();
  const chest = originalChestBase(chestNo).replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'X';
  let rand = '';
  for (let i = 0; i < 4; i += 1) {
    rand += REL_ID_CHARS[Math.floor(Math.random() * REL_ID_CHARS.length)];
  }
  return `REL-${year}-${chest}-${rand}`;
}

/** Normalise typed RelID: trim, upper, collapse spaces. */
export function normalizeRelegateId(raw: string | undefined | null): string {
  return String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidRelegateId(raw: string | undefined | null): boolean {
  return /^REL-\d{4}-[A-Z0-9]+-[A-Z0-9]{4}$/.test(normalizeRelegateId(raw));
}

/**
 * Strength me count hota hai ya nahi.
 * Relegated trainee purane batch ki nafri me NAHI dikhta —
 * lekin record history ke liye pada rehta hai.
 */
export function isOnStrength(trainee: { trainingStatus?: string } | null | undefined): boolean {
  const s = String(trainee?.trainingStatus ?? 'active').toLowerCase();
  return s !== 'relegated' && s !== 'discharged' && s !== 'relieved';
}

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v !== undefined) out[k] = v;
  });
  return out as T;
}

/** Personal + identity fields that travel with the trainee across batches. */
export const SNAPSHOT_FIELDS = [
  'name', 'fatherName', 'motherName', 'dob', 'age', 'gender', 'bloodGroup',
  'religion', 'category', 'maritalStatus', 'regNo', 'aadharNo', 'panNo',
  'mobileNo', 'emergencyContact', 'emergencyContactName', 'relationship',
  'village', 'tehsil', 'district', 'state', 'pinCode', 'education',
  'boardUniversity', 'passingYear', 'percentage', 'recruitmentCenter',
  'height', 'weight', 'chest', 'shoeSize', 'dressSize', 'photoURL',
  'photoPath', 'documents', 'rank', 'medStat', 'medRemarks',
  'fptResult', 'fptScore', 'weeklyExamResult', 'weeklyExamMarks',
  'punishments', 'weaponQual', 'ptScore',
] as const;

export function pickSnapshot(src: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!src) return out;
  SNAPSHOT_FIELDS.forEach((k) => {
    if (src[k] !== undefined) out[k] = src[k];
  });
  return out;
}
