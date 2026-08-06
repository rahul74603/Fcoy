// ============================================
// DEPUTATION API
// ============================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import {
  DeputationRecord, DeputationFormData,
  DeputationStatus, DeputationDirection,
} from '../types/deputation.types';

const COLLECTION = 'deputation_records';

// ─── Helper: Doc → Deputation ────────────────
const docToDeputation = (id: string, data: Record<string, unknown>): DeputationRecord => ({
  id,
  batchId: (data.batchId as string) ?? '',
  batchNumber: (data.batchNumber as string) ?? '',
  direction: (data.direction as DeputationDirection) ?? 'incoming',
  staffId: (data.staffId as string) ?? '',
  staffName: (data.staffName as string) ?? '',
  staffRank: (data.staffRank as string) ?? '',
  staffForceNumber: (data.staffForceNumber as string) ?? '',
  staffCategory: (data.staffCategory as string) ?? '',
  fromCompany: (data.fromCompany as string) ?? '',
  toCompany: (data.toCompany as string) ?? '',
  purpose: (data.purpose as string) ?? '',
  eventDetail: (data.eventDetail as string) ?? '',
  fromDate: data.fromDate ? (data.fromDate as any).toDate?.() ?? new Date(data.fromDate as string) : null,
  toDate: data.toDate ? (data.toDate as any).toDate?.() ?? new Date(data.toDate as string) : null,
  actualReturnDate: data.actualReturnDate ? (data.actualReturnDate as any).toDate?.() ?? new Date(data.actualReturnDate as string) : null,
  contactMobile: (data.contactMobile as string) ?? '',
  status: (data.status as DeputationStatus) ?? 'active',
  remarks: (data.remarks as string) ?? '',
  createdBy: (data.createdBy as string) ?? '',
  createdAt: data.createdAt ? (data.createdAt as any).toDate?.() ?? null : null,
  updatedAt: data.updatedAt ? (data.updatedAt as any).toDate?.() ?? null : null,
});

// ═══════════════════════════════════════════
// ADD DEPUTATION
// ═══════════════════════════════════════════
export const addDeputation = async (
  formData: DeputationFormData,
  batchId: string,
  batchNumber: string,
  userId: string
): Promise<string> => {
  try {
    const payload = {
      batchId,
      batchNumber,
      direction: formData.direction,
      staffId: formData.staffId,
      staffName: formData.staffName,
      staffRank: formData.staffRank,
      staffForceNumber: formData.staffForceNumber,
      staffCategory: formData.staffCategory,
      fromCompany: formData.fromCompany,
      toCompany: formData.toCompany,
      purpose: formData.purpose,
      eventDetail: formData.eventDetail,
      fromDate: formData.fromDate ? Timestamp.fromDate(new Date(formData.fromDate)) : null,
      toDate: formData.toDate ? Timestamp.fromDate(new Date(formData.toDate)) : null,
      actualReturnDate: null,
      contactMobile: formData.contactMobile,
      status: 'active' as DeputationStatus,
      remarks: formData.remarks,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), payload);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// GET ALL DEPUTATIONS (batch-wise)
// ═══════════════════════════════════════════
export const getDeputationsByBatch = async (batchId: string): Promise<DeputationRecord[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('batchId', '==', batchId)
    );

    const snap = await getDocs(q);
    const records = snap.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map(d =>
      docToDeputation(d.id, d.data() as Record<string, unknown>)
    );

    // Sort by fromDate desc (client-side)
    return records.sort((a, b) => {
      if (!a.fromDate || !b.fromDate) return 0;
      return b.fromDate.getTime() - a.fromDate.getTime();
    });
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// MARK RETURNED
// ═══════════════════════════════════════════
export const markDeputationReturned = async (
  deputationId: string,
  returnDate: string
): Promise<void> => {
  const docRef = doc(db, COLLECTION, deputationId);
  await updateDoc(docRef, {
    status: 'returned' as DeputationStatus,
    actualReturnDate: Timestamp.fromDate(new Date(returnDate)),
    updatedAt: serverTimestamp(),
  });
};

// ═══════════════════════════════════════════
// CANCEL DEPUTATION
// ═══════════════════════════════════════════
export const cancelDeputation = async (deputationId: string): Promise<void> => {
  const docRef = doc(db, COLLECTION, deputationId);
  await updateDoc(docRef, {
    status: 'cancelled' as DeputationStatus,
    updatedAt: serverTimestamp(),
  });
};

// ═══════════════════════════════════════════
// DELETE DEPUTATION
// ═══════════════════════════════════════════
export const deleteDeputation = async (deputationId: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, deputationId));
};

// ═══════════════════════════════════════════
// GET SUMMARY
// ═══════════════════════════════════════════
export const getDeputationSummary = async (batchId: string) => {
  const records = await getDeputationsByBatch(batchId);

  return {
    total: records.length,
    activeIncoming: records.filter(r => r.direction === 'incoming' && r.status === 'active').length,
    activeOutgoing: records.filter(r => r.direction === 'outgoing' && r.status === 'active').length,
    returned: records.filter(r => r.status === 'returned').length,
    cancelled: records.filter(r => r.status === 'cancelled').length,
  };
};