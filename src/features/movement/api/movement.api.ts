// ═══════════════════════════════════════════════════════════
// MOVEMENT REGISTER API (Sthanantar Register)
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { MovementRecord } from '../types/movement.types';

const COLLECTION = 'movementRecords';

export const addMovementRecord = async (data: Omit<MovementRecord, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), { ...data, createdAt: new Date().toISOString() });
  return ref.id;
};

export const getMovementRecordsByBatch = async (batchId: string): Promise<MovementRecord[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId)));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MovementRecord));
    list.sort((a, b) => (b.movementDate || '').localeCompare(a.movementDate || ''));
    return list;
  } catch { return []; }
};

export const getMovementRecordsByTrainee = async (traineeId: string, batchId: string): Promise<MovementRecord[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId), where('traineeId', '==', traineeId)));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MovementRecord));
    list.sort((a, b) => (b.movementDate || '').localeCompare(a.movementDate || ''));
    return list;
  } catch { return []; }
};

export const updateMovementRecord = async (id: string, data: Partial<MovementRecord>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteMovementRecord = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
