// ═══════════════════════════════════════════════════════════
// DISCIPLINE REGISTER API (Anushasan Register)
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { DisciplineRecord, DisciplineFormData } from '../types/discipline.types';

const COLLECTION = 'disciplineRecords';

// ─── Add Record ──────────────────────────────────────────
export const addDisciplineRecord = async (
  data: DisciplineFormData,
  traineeInfo: { name: string; chestNo: string; regNo: string; platoon: string },
  batchId: string,
  userName: string,
): Promise<string> => {
  const payload = {
    ...data,
    traineeName: traineeInfo.name,
    chestNo: traineeInfo.chestNo,
    regNo: traineeInfo.regNo,
    platoon: traineeInfo.platoon,
    batchId,
    status: 'Active' as const,
    createdAt: new Date().toISOString(),
    createdBy: userName,
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
};

// ─── Get Records by Batch ────────────────────────────────
export const getDisciplineRecordsByBatch = async (batchId: string): Promise<DisciplineRecord[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('batchId', '==', batchId), orderBy('date', 'desc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DisciplineRecord));
  } catch {
    // Fallback without orderBy (needs index)
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('batchId', '==', batchId))
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as DisciplineRecord));
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }
};

// ─── Get Records by Trainee ──────────────────────────────
export const getDisciplineRecordsByTrainee = async (traineeId: string, batchId: string): Promise<DisciplineRecord[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('batchId', '==', batchId), where('traineeId', '==', traineeId))
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as DisciplineRecord));
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  } catch { return []; }
};

// ─── Update Record ───────────────────────────────────────
export const updateDisciplineRecord = async (id: string, data: Partial<DisciplineRecord>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
};

// ─── Delete Record ───────────────────────────────────────
export const deleteDisciplineRecord = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
