// ═══════════════════════════════════════════════════════════
// SYLLABUS TRACKING API (Pathyakram Anurekhan)
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { SyllabusTopic } from '../types/syllabus.types';

const COLLECTION = 'trainingSyllabus';

export const addSyllabusTopic = async (data: Omit<SyllabusTopic, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), { ...data, createdAt: new Date().toISOString() });
  return ref.id;
};

export const getSyllabusByBatch = async (batchId: string): Promise<SyllabusTopic[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SyllabusTopic));
  } catch { return []; }
};

export const updateSyllabusTopic = async (id: string, data: Partial<SyllabusTopic>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteSyllabusTopic = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
