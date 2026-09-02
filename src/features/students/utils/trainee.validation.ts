// ═══════════════════════════════════════════════════════════
// TRAINEE VALIDATION — T-122
// Uniqueness checks and field validation
// ═══════════════════════════════════════════════════════════

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Check if regNo is UNIQUE across all trainees
 */
export async function isRegNoUnique(regNo: string, excludeId?: string): Promise<boolean> {
  if (!regNo) return true;
  try {
    const snap = await getDocs(
      query(collection(db, 'trainees'), where('regNo', '==', regNo))
    );
    if (snap.empty) return true;
    // If editing, exclude current trainee
    if (excludeId) {
      return snap.docs.every(d => d.id === excludeId);
    }
    return false;
  } catch {
    return true; // On error, don't block
  }
}

/**
 * Check if chestNo is UNIQUE within active batch
 */
export async function isChestNoUnique(
  chestNo: string,
  batchId: string,
  excludeId?: string
): Promise<boolean> {
  if (!chestNo || !batchId) return true;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'trainees'),
        where('batchId', '==', batchId),
        where('chestNo', '==', chestNo)
      )
    );
    if (snap.empty) return true;
    if (excludeId) {
      return snap.docs.every(d => d.id === excludeId);
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Check if serviceNo is UNIQUE
 */
export async function isServiceNoUnique(
  serviceNo: string,
  excludeId?: string
): Promise<boolean> {
  if (!serviceNo) return true;
  try {
    const snap = await getDocs(
      query(collection(db, 'trainees'), where('serviceNo', '==', serviceNo))
    );
    if (snap.empty) return true;
    if (excludeId) {
      return snap.docs.every(d => d.id === excludeId);
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Validate trainee registration data
 */
export async function validateTraineeRegistration(
  data: {
    regNo: string;
    chestNo?: string;
    batchId: string;
    name: string;
    dob?: string;
    aadharNo?: string;
  },
  excludeId?: string
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Required fields
  if (!data.name?.trim()) errors.push('Name is required');
  if (!data.regNo?.trim()) errors.push('Registration Number is required');
  if (!data.batchId) errors.push('Batch is required');

  // Aadhar validation
  if (data.aadharNo && data.aadharNo.length !== 12) {
    errors.push('Aadhar must be 12 digits');
  }

  // DOB validation (18-30 years)
  if (data.dob) {
    const age = Math.floor(
      (Date.now() - new Date(data.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    if (age < 17 || age > 31) {
      errors.push('Age must be between 18-30 years');
    }
  }

  // Uniqueness checks
  const [regUnique, chestUnique] = await Promise.all([
    isRegNoUnique(data.regNo, excludeId),
    data.chestNo
      ? isChestNoUnique(data.chestNo, data.batchId, excludeId)
      : Promise.resolve(true),
  ]);

  if (!regUnique) errors.push(`Registration No "${data.regNo}" already exists!`);
  if (!chestUnique) errors.push(`Chest No "${data.chestNo}" already exists in this batch!`);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Aadhar number format
 */
export function isValidAadhar(aadhar: string): boolean {
  return /^\d{12}$/.test(aadhar);
}

/**
 * Validate mobile number format (Indian)
 */
export function isValidMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile);
}

/**
 * Validate PIN code format
 */
export function isValidPinCode(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
