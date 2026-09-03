// ═══════════════════════════════════════════════════════════
// CLEARANCE API (Klirans Prabandhan)
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { ClearanceRecord, ClearanceItem, ClearanceDept, ClearanceItemStatus } from '../types/clearance.types';
import { CLEARANCE_DEPARTMENTS } from '../types/clearance.types';

const COLLECTION = 'clearanceRecords';

// Create clearance record for a trainee (with all departments as pending)
export const createClearanceRecord = async (
  traineeId: string, traineeName: string, chestNo: string, regNo: string, batchId: string,
): Promise<string> => {
  const items: ClearanceItem[] = CLEARANCE_DEPARTMENTS.map(dept => ({
    department: dept, status: 'Pending' as ClearanceItemStatus, clearedBy: '', date: '', remarks: '',
  }));
  const ref = await addDoc(collection(db, COLLECTION), {
    traineeId, traineeName, chestNo, regNo, batchId,
    items, overallStatus: 'Pending', remarks: '', createdAt: new Date().toISOString(),
  });
  return ref.id;
};

// Bulk create for all trainees in a batch
export const bulkCreateClearance = async (batchId: string, trainees: { id: string; name: string; chestNo: string; regNo: string }[]): Promise<number> => {
  let count = 0;
  for (const t of trainees) {
    // Check if already exists
    const existing = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId), where('traineeId', '==', t.id)));
    if (existing.empty) {
      await createClearanceRecord(t.id, t.name, t.chestNo, t.regNo, batchId);
      count++;
    }
  }
  return count;
};

export const getClearanceByBatch = async (batchId: string): Promise<ClearanceRecord[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClearanceRecord));
  } catch { return []; }
};

export const updateClearanceItem = async (
  recordId: string, items: ClearanceItem[], overallStatus: string,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, recordId), { items, overallStatus });
};

export const deleteClearanceRecord = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
