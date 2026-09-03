// ═══════════════════════════════════════════════════════════
// JOINING WORKFLOW API (Bharti Prakriya)
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { JoiningRecord, JoiningStage } from '../types/joining.types';

const COLLECTION = 'joiningRecords';

export const addJoiningRecord = async (data: Omit<JoiningRecord, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), { ...data, createdAt: new Date().toISOString() });
  return ref.id;
};

export const getJoiningRecordsByBatch = async (batchId: string): Promise<JoiningRecord[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as JoiningRecord));
  } catch { return []; }
};

export const updateJoiningStage = async (id: string, stage: JoiningStage, extra?: Partial<JoiningRecord>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { currentStage: stage, ...extra });
};

export const updateJoiningRecord = async (id: string, data: Partial<JoiningRecord>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteJoiningRecord = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
