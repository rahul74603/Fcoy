// ═══════════════════════════════════════════════════════════
// TRAINING SESSION API — T-151
// ═══════════════════════════════════════════════════════════

import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where, orderBy,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { TrainingSession } from '../types/session.types';

const COL = 'trainingSessions';

export const addSession = async (data: Omit<TrainingSession, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const getSessionsByBatch = async (batchId: string): Promise<TrainingSession[]> => {
  const snap = await getDocs(
    query(collection(db, COL), where('batchId', '==', batchId))
  );
  const list: TrainingSession[] = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() } as TrainingSession));
  list.sort((a, b) => (b.sessionDate || '').localeCompare(a.sessionDate || ''));
  return list;
};

export const updateSession = async (id: string, data: Partial<TrainingSession>): Promise<void> => {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  } as any);
};

export const deleteSession = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COL, id));
};
