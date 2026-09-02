// ═══════════════════════════════════════════════════════════
// TRAINEE MODULE API
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type {
  TraineeAccount, TraineeUpdate, TraineeNotice, RelegationRecord,
  TraineeUpdateCategory, NoticeCategory, RelegationReason,
} from '../types/trainee.types';

// ─── TRAINEE ACCOUNTS ─────────────────────────────────────

export const createTraineeAccount = async (
  traineeId: string, username: string, password: string, createdBy: string
): Promise<string> => {
  const ref = await addDoc(collection(db, 'traineeAccounts'), {
    traineeId, username, password, isActive: true,
    createdAt: new Date().toISOString(), createdBy,
  });
  return ref.id;
};

export const getTraineeAccountByUsername = async (username: string): Promise<TraineeAccount | null> => {
  const snap = await getDocs(query(collection(db, 'traineeAccounts'), where('username', '==', username)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as TraineeAccount;
};

export const getAllTraineeAccounts = async (): Promise<TraineeAccount[]> => {
  const snap = await getDocs(collection(db, 'traineeAccounts'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TraineeAccount));
};

export const changeTraineePassword = async (accountId: string, oldPassword: string, newPassword: string): Promise<boolean> => {
  const snap = await getDocs(query(collection(db, 'traineeAccounts'), where('__name__', '==', accountId)));
  if (snap.empty) return false;
  const acc = snap.docs[0].data() as TraineeAccount;
  if (acc.password !== oldPassword) return false;
  await updateDoc(doc(db, 'traineeAccounts', accountId), { password: newPassword });
  return true;
};

export const updateTraineeAccount = async (id: string, data: Partial<TraineeAccount>): Promise<void> => {
  await updateDoc(doc(db, 'traineeAccounts', id), data);
};

export const deleteTraineeAccount = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'traineeAccounts', id));
};

// ─── TRAINEE UPDATES ──────────────────────────────────────

export const submitTraineeUpdate = async (
  data: {
    traineeId: string; traineeName: string; chestNo: string;
    batchId: string; platoon: string; category: TraineeUpdateCategory;
    title: string; description: string; priority: 'low' | 'medium' | 'high' | 'urgent';
  },
  submittedBy: string, submittedByRole: string
): Promise<string> => {
  const ref = await addDoc(collection(db, 'traineeUpdates'), {
    ...data, status: 'pending',
    submittedBy, submittedByRole,
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const getTraineeUpdates = async (traineeId: string): Promise<TraineeUpdate[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'traineeUpdates'), where('traineeId', '==', traineeId), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TraineeUpdate));
  } catch {
    const snap = await getDocs(query(collection(db, 'traineeUpdates'), where('traineeId', '==', traineeId)));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TraineeUpdate));
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  }
};

export const getAllUpdatesForBatch = async (batchId: string): Promise<TraineeUpdate[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'traineeUpdates'), where('batchId', '==', batchId)));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TraineeUpdate));
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  } catch { return []; }
};

export const approveTraineeUpdate = async (id: string, approvedBy: string): Promise<void> => {
  await updateDoc(doc(db, 'traineeUpdates', id), {
    status: 'approved', approvedBy,
    approvedAt: new Date().toISOString(),
  });
};

export const rejectTraineeUpdate = async (id: string, approvedBy: string, reason: string): Promise<void> => {
  await updateDoc(doc(db, 'traineeUpdates', id), {
    status: 'rejected', approvedBy,
    approvedAt: new Date().toISOString(),
    rejectionReason: reason,
  });
};

// ─── NOTICES ──────────────────────────────────────────────

export const createNotice = async (
  data: {
    batchId: string; title: string; content: string;
    category: NoticeCategory; priority: 'normal' | 'important' | 'urgent';
    targetPlatoon: string; expiresAt?: string;
  },
  publishedBy: string
): Promise<string> => {
  const ref = await addDoc(collection(db, 'traineeNotices'), {
    ...data, publishedBy, publishedAt: new Date().toISOString(),
    isActive: true, createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const getNotices = async (batchId: string, platoon?: string): Promise<TraineeNotice[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'traineeNotices'), where('batchId', '==', batchId), where('isActive', '==', true))
    );
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TraineeNotice));
    if (platoon) list = list.filter(n => n.targetPlatoon === 'all' || n.targetPlatoon === platoon);
    const now = new Date().toISOString();
    list = list.filter(n => !n.expiresAt || n.expiresAt > now);
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  } catch { return []; }
};

export const deleteNotice = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'traineeNotices', id));
};

// ─── RELEGATION ───────────────────────────────────────────

export const createRelegation = async (
  data: {
    traineeId: string; traineeName: string; chestNo: string; regNo: string;
    fromBatchId: string; fromBatchName: string; fromPlatoon: string;
    toBatchId: string; toBatchName: string; toPlatoon: string;
    reason: RelegationReason; reasonDetail: string;
    medicalCertificate: boolean; authorityName: string; authorityRank: string;
    orderNumber: string; remainingSubjects: string[]; completedTraining: string[];
  },
  createdBy: string
): Promise<string> => {
  const ref = await addDoc(collection(db, 'relegations'), {
    ...data, status: 'pending',
    createdAt: new Date().toISOString(), createdBy,
  });
  return ref.id;
};

export const getRelegations = async (batchId: string): Promise<RelegationRecord[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'relegations'), where('fromBatchId', '==', batchId))
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RelegationRecord));
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  } catch { return []; }
};

export const getRelegationsToBatch = async (batchId: string): Promise<RelegationRecord[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'relegations'), where('toBatchId', '==', batchId))
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RelegationRecord));
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  } catch { return []; }
};

export const approveRelegation = async (id: string, approvedBy: string): Promise<void> => {
  await updateDoc(doc(db, 'relegations', id), {
    status: 'approved', approvedBy,
    approvedAt: new Date().toISOString(),
  });
};

export const completeRelegation = async (id: string): Promise<void> => {
  await updateDoc(doc(db, 'relegations', id), {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
};

export const cancelRelegation = async (id: string): Promise<void> => {
  await updateDoc(doc(db, 'relegations', id), { status: 'cancelled' });
};
