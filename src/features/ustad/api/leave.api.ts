// ============================================
// LEAVE MANAGEMENT API
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
import {
  StaffLeave,
  LeaveFormData,
  LeaveStatus,
  LeaveType,
} from '../types/leave.types';
// ★ Module 17: event notification emitters (fire-and-forget)
import { notifyLeaveDecision } from '../../notifications/notification.api';

const LEAVE_COL = 'staff_leave';
const LEAVE_TYPE_COL = 'leave_types';

// ─── Helper: Generate Leave Number ───────────
const generateLeaveNumber = (count: number): string => {
  const year = new Date().getFullYear();
  const serial = String(count + 1).padStart(3, '0');
  return `LV-${year}-${serial}`;
};

// ─── Helper: Doc → LeaveType ─────────────────
const docToLeaveType = (
  id: string,
  data: Record<string, unknown>
): LeaveType => ({
  id,
  name: (data.name as string) ?? '',
  code: (data.code as string) ?? '',
  maxDaysPerYear: (data.maxDaysPerYear as number) ?? 0,
  isPaid: (data.isPaid as boolean) ?? true,
  isActive: (data.isActive as boolean) ?? true,
  description: (data.description as string) ?? '',
  createdAt: data.createdAt
    ? (data.createdAt as Timestamp).toDate()
    : null,
});

// ─── Helper: Doc → StaffLeave ─────────────────
const docToLeave = (
  id: string,
  data: Record<string, unknown>
): StaffLeave => ({
  id,
  leaveNumber: (data.leaveNumber as string) ?? '',
  staffId: (data.staffId as string) ?? '',
  staffName: (data.staffName as string) ?? '',
  forceNumber: (data.forceNumber as string) ?? '',
  rank: (data.rank as string) ?? '',
  leaveTypeId: (data.leaveTypeId as string) ?? '',
  leaveTypeName: (data.leaveTypeName as string) ?? '',
  leaveTypeCode: (data.leaveTypeCode as string) ?? '',
  fromDate: data.fromDate
    ? (data.fromDate as Timestamp).toDate()
    : null,
  toDate: data.toDate
    ? (data.toDate as Timestamp).toDate()
    : null,
  numberOfDays: (data.numberOfDays as number) ?? 0,
  reason: (data.reason as string) ?? '',
  leaveAddress: (data.leaveAddress as string) ?? '',
  contactNumber: (data.contactNumber as string) ?? '',
  // ★ Emergency contact (old docs se '' aayega — backward compatible)
  emergencyContactName: (data.emergencyContactName as string) ?? '',
  emergencyContactPhone: (data.emergencyContactPhone as string) ?? '',
  emergencyContactRelation: (data.emergencyContactRelation as string) ?? '',
  status: (data.status as LeaveStatus) ?? 'pending',
  appliedAt: data.appliedAt
    ? (data.appliedAt as Timestamp).toDate()
    : null,
  appliedBy: (data.appliedBy as string) ?? '',
  approvedBy: (data.approvedBy as string) ?? '',
  approvedByName: (data.approvedByName as string) ?? '',
  approvalDate: data.approvalDate
    ? (data.approvalDate as Timestamp).toDate()
    : null,
  rejectionReason: (data.rejectionReason as string) ?? '',
  returnDate: data.returnDate
    ? (data.returnDate as Timestamp).toDate()
    : null,
  joiningReportSubmitted: (data.joiningReportSubmitted as boolean) ?? false,
  delayReason: (data.delayReason as string) ?? '',
  remarks: (data.remarks as string) ?? '',
});

// ════════════════════════════════════════════
// LEAVE TYPE MASTER
// ════════════════════════════════════════════

export const addLeaveType = async (
  name: string,
  code: string,
  maxDaysPerYear: number,
  isPaid: boolean,
  description: string
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, LEAVE_TYPE_COL), {
      name,
      code: code.toUpperCase(),
      maxDaysPerYear,
      isPaid,
      description,
      isActive: true,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const getAllLeaveTypes = async (): Promise<LeaveType[]> => {
  try {
    const snapshot = await getDocs(collection(db, LEAVE_TYPE_COL));
    return snapshot.docs.map((doc) =>
      docToLeaveType(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

export const getActiveLeaveTypes = async (): Promise<LeaveType[]> => {
  try {
    const q = query(
      collection(db, LEAVE_TYPE_COL),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) =>
      docToLeaveType(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

export const toggleLeaveTypeStatus = async (
  typeId: string,
  isActive: boolean
): Promise<void> => {
  const docRef = doc(db, LEAVE_TYPE_COL, typeId);
  await updateDoc(docRef, { isActive });
};

// ════════════════════════════════════════════
// LEAVE APPLICATION
// ════════════════════════════════════════════

// ─── APPLY LEAVE ─────────────────────────────
export const applyLeave = async (
  formData: LeaveFormData,
  staffName: string,
  forceNumber: string,
  rank: string,
  leaveTypeName: string,
  leaveTypeCode: string,
  appliedBy: string,
  batchId?: string,
  batchNumber?: string
): Promise<string> => {
  try {
    // Calculate number of days
    const from = new Date(formData.fromDate);
    const to = new Date(formData.toDate);
    const diffTime = Math.abs(to.getTime() - from.getTime());
    const numberOfDays =
      Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Get current count for leave number
    const countSnap = await getDocs(collection(db, LEAVE_COL));
    const leaveNumber = generateLeaveNumber(countSnap.size);

        const docRef = await addDoc(collection(db, LEAVE_COL), {
      leaveNumber,
      staffId: formData.staffId,
      staffName,
      forceNumber,
      rank,
      batchId: batchId ?? '',
      batchNumber: batchNumber ?? '',
      leaveTypeId: formData.leaveTypeId,
      leaveTypeName,
      leaveTypeCode,
      fromDate: Timestamp.fromDate(from),
      toDate: Timestamp.fromDate(to),
      numberOfDays,
      reason: formData.reason,
      leaveAddress: formData.leaveAddress,
      contactNumber: formData.contactNumber,
      emergencyContactName: formData.emergencyContactName ?? '',
      emergencyContactPhone: formData.emergencyContactPhone ?? '',
      emergencyContactRelation: formData.emergencyContactRelation ?? '',
      status: 'pending',
      appliedAt: serverTimestamp(),
      appliedBy,
      approvedBy: '',
      approvedByName: '',
      approvalDate: null,
      rejectionReason: '',
      returnDate: null,
      joiningReportSubmitted: false,
      delayReason: '',
      remarks: formData.remarks,
    });

    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// ─── APPROVE LEAVE ────────────────────────────
export const approveLeave = async (
  leaveId: string,
  approvedBy: string,
  approvedByName: string
): Promise<void> => {
  try {
    const docRef = doc(db, LEAVE_COL, leaveId);
    await updateDoc(docRef, {
      status: 'approved',
      approvedBy,
      approvedByName,
      approvalDate: serverTimestamp(),
    });

    // ★ Module 17: notification emit (fire-and-forget — flow safe)
    notifyLeaveDecision(leaveId, 'approved', approvedByName);
  } catch (error) {
    throw error;
  }
};

// ─── REJECT LEAVE ─────────────────────────────
export const rejectLeave = async (
  leaveId: string,
  rejectedBy: string,
  rejectedByName: string,
  rejectionReason: string
): Promise<void> => {
  try {
    const docRef = doc(db, LEAVE_COL, leaveId);
    await updateDoc(docRef, {
      status: 'rejected',
      approvedBy: rejectedBy,
      approvedByName: rejectedByName,
      rejectionReason,
      approvalDate: serverTimestamp(),
    });

    // ★ Module 17: notification emit (fire-and-forget — flow safe)
    notifyLeaveDecision(leaveId, 'rejected', rejectedByName);
  } catch (error) {
    throw error;
  }
};

// ─── CANCEL LEAVE ─────────────────────────────
export const cancelLeave = async (leaveId: string): Promise<void> => {
  try {
    const docRef = doc(db, LEAVE_COL, leaveId);
    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ─── RECORD RETURN ────────────────────────────
export const recordLeaveReturn = async (
  leaveId: string,
  returnDate: string,
  joiningReportSubmitted: boolean,
  delayReason: string
): Promise<void> => {
  try {
    const docRef = doc(db, LEAVE_COL, leaveId);
    await updateDoc(docRef, {
      returnDate: Timestamp.fromDate(new Date(returnDate)),
      joiningReportSubmitted,
      delayReason,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ─── GET LEAVE BY STAFF ───────────────────────
export const getLeaveByStaff = async (
  staffId: string
): Promise<StaffLeave[]> => {
  try {
    const q = query(
      collection(db, LEAVE_COL),
      where('staffId', '==', staffId),
      orderBy('appliedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) =>
      docToLeave(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── GET PENDING LEAVES ───────────────────────
export const getPendingLeaves = async (): Promise<StaffLeave[]> => {
  try {
    const q = query(
      collection(db, LEAVE_COL),
      where('status', '==', 'pending'),
      orderBy('appliedAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) =>
      docToLeave(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── GET CURRENT STAFF ON LEAVE ───────────────
// ─── GET CURRENT STAFF ON LEAVE ───────────────
export const getCurrentLeaves = async (): Promise<StaffLeave[]> => {
  try {
    // Get ALL approved leaves (no date filter in query)
    const q = query(
      collection(db, LEAVE_COL),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(q);

    const allApprovedLeaves = snapshot.docs.map((doc) =>
      docToLeave(doc.id, doc.data() as Record<string, unknown>)
    );

    // Filter client-side for CURRENT date range
    const today = new Date();
    today.setHours(12, 0, 0, 0); // Middle of day to avoid timezone issues

    const currentlyOnLeave = allApprovedLeaves.filter((leave) => {
      if (!leave.fromDate || !leave.toDate) return false;

      const fromDate = new Date(leave.fromDate);
      fromDate.setHours(0, 0, 0, 0);

      const toDate = new Date(leave.toDate);
      toDate.setHours(23, 59, 59, 999);

      // Check if today falls within leave period
      // AND leave return hasn't been recorded
      return (
        today >= fromDate &&
        today <= toDate &&
        !leave.returnDate  // Not yet returned
      );
    });

    return currentlyOnLeave;
  } catch (error) {
    console.error('getCurrentLeaves error:', error);
    throw error;
  }
};

// ─── GET ALL LEAVES ───────────────────────────
export const getAllLeaves = async (batchId?: string): Promise<StaffLeave[]> => {
  try {
    const q = query(
      collection(db, LEAVE_COL),
      orderBy('appliedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    let records = snapshot.docs.map((doc) =>
      docToLeave(doc.id, doc.data() as Record<string, unknown>)
    );

    // 🆕 Filter by batch if provided (backward compatible)
    if (batchId) {
      records = records.filter(r => {
        const data = snapshot.docs.find(d => d.id === r.id)?.data();
        return !data?.batchId || data.batchId === batchId;
      });
    }

    return records;
  } catch (error) {
    throw error;
  }
};