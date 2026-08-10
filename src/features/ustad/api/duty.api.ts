// ============================================
// DUTY MANAGEMENT API
// Batch-wise support included
// ============================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import { toJSDate } from '../../../utils/date.utils';
import {
  StaffDuty,
  DutyFormData,
  DutyType,
  DutyStatus,
} from '../types/duty.types';

const DUTY_COL = 'staff_duty';
const DUTY_TYPE_COL = 'duty_types';

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

// Doc → DutyType
const docToDutyType = (
  id: string,
  data: Record<string, unknown>
): DutyType => ({
  id,
  name: (data.name as string) ?? '',
  description: (data.description as string) ?? '',
  isActive: (data.isActive as boolean) ?? true,
  createdAt: toJSDate(data.createdAt),
});

// Doc → StaffDuty
const docToDuty = (
  id: string,
  data: Record<string, unknown>
): StaffDuty => ({
  id,
  dutyTypeId: (data.dutyTypeId as string) ?? '',
  dutyTypeName: (data.dutyTypeName as string) ?? '',
  staffId: (data.staffId as string) ?? '',
  staffName: (data.staffName as string) ?? '',
  forceNumber: (data.forceNumber as string) ?? '',
  rank: (data.rank as string) ?? '',
  date: toJSDate(data.date),
  startTime: (data.startTime as string) ?? '',
  endTime: (data.endTime as string) ?? '',
  venue: (data.venue as string) ?? '',
  status: (data.status as DutyStatus) ?? 'assigned',
  remarks: (data.remarks as string) ?? '',
  assignedBy: (data.assignedBy as string) ?? '',
  assignedAt: toJSDate(data.assignedAt),
  completedAt: toJSDate(data.completedAt),
  transferredTo: (data.transferredTo as string) ?? '',
  transferReason: (data.transferReason as string) ?? '',
});

// ═══════════════════════════════════════════
// DUTY TYPE MASTER
// ═══════════════════════════════════════════

export const addDutyType = async (
  name: string,
  description: string
): Promise<string> => {
  const docRef = await addDoc(collection(db, DUTY_TYPE_COL), {
    name,
    description,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getAllDutyTypes = async (): Promise<DutyType[]> => {
  const snapshot = await getDocs(collection(db, DUTY_TYPE_COL));
  return snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map((d) =>
    docToDutyType(d.id, d.data() as Record<string, unknown>)
  );
};

export const getActiveDutyTypes = async (): Promise<DutyType[]> => {
  const q = query(
    collection(db, DUTY_TYPE_COL),
    where('isActive', '==', true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map((d) =>
    docToDutyType(d.id, d.data() as Record<string, unknown>)
  );
};

export const toggleDutyTypeStatus = async (
  typeId: string,
  isActive: boolean
): Promise<void> => {
  const docRef = doc(db, DUTY_TYPE_COL, typeId);
  await updateDoc(docRef, { isActive });
};

// ═══════════════════════════════════════════
// DUTY ASSIGNMENT (with batch)
// ═══════════════════════════════════════════

export const assignDuty = async (
  formData: DutyFormData,
  staffName: string,
  forceNumber: string,
  rank: string,
  dutyTypeName: string,
  assignedBy: string,
  batchId?: string,
  batchNumber?: string
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, DUTY_COL), {
      // Duty Info
      dutyTypeId: formData.dutyTypeId,
      dutyTypeName,

      // Staff Info
      staffId: formData.staffId,
      staffName,
      forceNumber,
      rank,

      // 🆕 Batch Info
      batchId: batchId ?? '',
      batchNumber: batchNumber ?? '',

      // Duty Details
      date: Timestamp.fromDate(new Date(formData.date)),
      startTime: formData.startTime,
      endTime: formData.endTime,
      venue: formData.venue,
      status: 'assigned',
      remarks: formData.remarks,

      // Meta
      assignedBy,
      assignedAt: serverTimestamp(),
      completedAt: null,
      transferredTo: '',
      transferReason: '',
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// COMPLETE DUTY
// ═══════════════════════════════════════════

export const completeDuty = async (dutyId: string): Promise<void> => {
  const docRef = doc(db, DUTY_COL, dutyId);
  await updateDoc(docRef, {
    status: 'completed',
    completedAt: serverTimestamp(),
  });
};

// ═══════════════════════════════════════════
// TRANSFER DUTY
// ═══════════════════════════════════════════

export const transferDuty = async (
  dutyId: string,
  newStaffId: string,
  newStaffName: string,
  transferReason: string
): Promise<void> => {
  const docRef = doc(db, DUTY_COL, dutyId);
  await updateDoc(docRef, {
    status: 'transferred',
    transferredTo: newStaffId,
    transferReason,
    staffId: newStaffId,
    staffName: newStaffName,
    updatedAt: serverTimestamp(),
  });
};

// ═══════════════════════════════════════════
// GET DUTIES BY DATE (batch-filtered)
// ═══════════════════════════════════════════

export const getDutiesByDate = async (
  date: string,
  batchId?: string
): Promise<StaffDuty[]> => {
  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, DUTY_COL),
    where('date', '>=', Timestamp.fromDate(dateObj)),
    where('date', '<=', Timestamp.fromDate(endOfDay))
  );

  const snapshot = await getDocs(q);
  let records = snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map((d) =>
    docToDuty(d.id, d.data() as Record<string, unknown>)
  );

  // 🆕 BATCH FILTER (backward compatible)
  if (batchId) {
    records = records.filter((r) => {
      const docData = snapshot.docs.find((d) => d.id === r.id)?.data();
      const recordBatchId = docData?.batchId as string | undefined;
      // Show if: no batchId (old records) OR matches active batch
      return !recordBatchId || recordBatchId === batchId;
    });
  }

  return records;
};

// ═══════════════════════════════════════════
// GET DUTIES BY STAFF (all batches)
// ═══════════════════════════════════════════

export const getDutiesByStaff = async (
  staffId: string,
  batchId?: string
): Promise<StaffDuty[]> => {
  const q = query(
    collection(db, DUTY_COL),
    where('staffId', '==', staffId),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(q);
  let records = snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map((d) =>
    docToDuty(d.id, d.data() as Record<string, unknown>)
  );

  // 🆕 BATCH FILTER (optional)
  if (batchId) {
    records = records.filter((r) => {
      const docData = snapshot.docs.find((d) => d.id === r.id)?.data();
      const recordBatchId = docData?.batchId as string | undefined;
      return !recordBatchId || recordBatchId === batchId;
    });
  }

  return records;
};