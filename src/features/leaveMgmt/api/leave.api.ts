// ═══════════════════════════════════════════════════════════
// LEAVE MANAGEMENT API (Chhutti Prabandhan)
// Integrates with absentRecords for backward compatibility
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { LeaveApplication } from '../types/leave.types';

const COLLECTION = 'leaveApplications';

export const addLeaveApplication = async (data: Omit<LeaveApplication, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), { ...data, createdAt: new Date().toISOString() });

  // Auto-sync with absentRecords if sanctioned
  if (data.status === 'Sanctioned' || data.status === 'On Leave') {
    try {
      await addDoc(collection(db, 'absentRecords'), {
        traineeId: data.traineeId,
        traineeName: data.traineeName,
        chestNo: data.chestNo,
        batchId: data.batchId,
        type: 'L',
        reason: `${data.leaveType} Leave: ${data.reason}`,
        fromDate: data.fromDate,
        toDate: data.toDate,
        totalDays: data.totalDays,
        status: 'Active',
        leaveApplicationId: ref.id,
        createdAt: new Date().toISOString(),
      });
    } catch (e) { console.warn('absentRecords sync failed:', e); }
  }

  return ref.id;
};

export const getLeaveApplicationsByBatch = async (batchId: string): Promise<LeaveApplication[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId)));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveApplication));
    list.sort((a, b) => (b.fromDate || '').localeCompare(a.fromDate || ''));
    return list;
  } catch { return []; }
};

export const getLeaveApplicationsByTrainee = async (traineeId: string, batchId: string): Promise<LeaveApplication[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId), where('traineeId', '==', traineeId)));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveApplication));
    list.sort((a, b) => (b.fromDate || '').localeCompare(a.fromDate || ''));
    return list;
  } catch { return []; }
};

export const updateLeaveApplication = async (id: string, data: Partial<LeaveApplication>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteLeaveApplication = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
