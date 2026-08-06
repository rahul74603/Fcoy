// ============================================
// STAFF API - Batch-wise CRUD
// ============================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import {
  Staff,
  StaffFormData,
  StaffFilter,
  StaffStatus,
} from '../types/staff.types';

const COLLECTION = 'staff';
const staffCol = () => collection(db, COLLECTION);

// ─── Helper: Doc → Staff ─────────────────────
const docToStaff = (id: string, data: Record<string, unknown>): Staff => ({
  id,
  batchId: (data.batchId as string) ?? '',
  batchNumber: (data.batchNumber as string) ?? '',
  forceNumber: (data.forceNumber as string) ?? '',
  name: (data.name as string) ?? '',
  rank: (data.rank as string) ?? '',
  company: (data.company as string) ?? '',
  category: (data.category as string) ?? '',
  battalion: (data.battalion as string) ?? '',
  mobile: (data.mobile as string) ?? '',
  email: (data.email as string) ?? '',
  dateOfJoining: data.dateOfJoining
    ? (data.dateOfJoining as any).toDate?.() ?? new Date(data.dateOfJoining as string)
    : null,
  dateOfPosting: data.dateOfPosting
    ? (data.dateOfPosting as any).toDate?.() ?? new Date(data.dateOfPosting as string)
    : null,
  experienceYears: (data.experienceYears as number) ?? 0,
  qualification: (data.qualification as string) ?? '',
  bloodGroup: (data.bloodGroup as Staff['bloodGroup']) ?? '',
  emergencyContact: (data.emergencyContact as Staff['emergencyContact']) ?? {
    name: '', relation: '', mobile: '', address: '',
  },
  status: (data.status as StaffStatus) ?? 'active',
  photoURL: (data.photoURL as string) ?? '',
  remarks: (data.remarks as string) ?? '',
  createdAt: data.createdAt
    ? (data.createdAt as any).toDate?.() ?? new Date(data.createdAt as string)
    : null,
  updatedAt: data.updatedAt
    ? (data.updatedAt as any).toDate?.() ?? new Date(data.updatedAt as string)
    : null,
  createdBy: (data.createdBy as string) ?? '',
});

// ═══════════════════════════════════════════
// ADD STAFF (with batch)
// ═══════════════════════════════════════════
export const addStaff = async (
  formData: StaffFormData,
  batchId: string,
  batchNumber: string,
  userId: string
): Promise<string> => {
  try {
    if (!batchId) {
      throw new Error('Active batch required to add staff.');
    }

    // Check duplicate within same batch
    const dupQuery = query(
      staffCol(),
      where('batchId', '==', batchId),
      where('forceNumber', '==', formData.forceNumber)
    );
    const dupSnap = await getDocs(dupQuery);
    if (!dupSnap.empty) {
      throw new Error('Force Number already exists in this batch.');
    }

    const payload = {
      ...formData,
      batchId,
      batchNumber,
      dateOfJoining: formData.dateOfJoining
        ? Timestamp.fromDate(new Date(formData.dateOfJoining))
        : null,
      dateOfPosting: formData.dateOfPosting
        ? Timestamp.fromDate(new Date(formData.dateOfPosting))
        : null,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(staffCol(), payload);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// GET STAFF BY BATCH
// ═══════════════════════════════════════════
export const getStaffByBatch = async (batchId: string): Promise<Staff[]> => {
  try {
    if (!batchId) return [];

    const q = query(
      staffCol(),
      where('batchId', '==', batchId)
    );
    const snapshot = await getDocs(q);

    const staffList = snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map(doc =>
      docToStaff(doc.id, doc.data() as Record<string, unknown>)
    );

    // Sort by name (client-side, avoids index)
    return staffList.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// GET STAFF BY ID
// ═══════════════════════════════════════════
export const getStaffById = async (staffId: string): Promise<Staff | null> => {
  try {
    const docRef = doc(db, COLLECTION, staffId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docToStaff(docSnap.id, docSnap.data() as Record<string, unknown>);
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// UPDATE STAFF
// ═══════════════════════════════════════════
export const updateStaff = async (
  staffId: string,
  formData: Partial<StaffFormData>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, staffId);
    const payload: Record<string, unknown> = {
      ...formData,
      updatedAt: serverTimestamp(),
    };

    if (formData.dateOfJoining) {
      payload.dateOfJoining = Timestamp.fromDate(new Date(formData.dateOfJoining));
    }
    if (formData.dateOfPosting) {
      payload.dateOfPosting = Timestamp.fromDate(new Date(formData.dateOfPosting));
    }

    await updateDoc(docRef, payload);
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// UPDATE STATUS
// ═══════════════════════════════════════════
export const updateStaffStatus = async (
  staffId: string,
  status: StaffStatus
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, staffId);
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// DELETE STAFF
// ═══════════════════════════════════════════
export const deleteStaff = async (staffId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, staffId);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// FILTER STAFF (Client-side)
// ═══════════════════════════════════════════
export const filterStaff = (
  staffList: Staff[],
  filter: StaffFilter
): Staff[] => {
  return staffList.filter((staff) => {
    const searchLower = filter.search.toLowerCase();
    const matchSearch =
      !filter.search ||
      staff.name.toLowerCase().includes(searchLower) ||
      staff.forceNumber.toLowerCase().includes(searchLower) ||
      staff.rank.toLowerCase().includes(searchLower) ||
      staff.category.toLowerCase().includes(searchLower) ||
      staff.company.toLowerCase().includes(searchLower) ||
      staff.mobile.includes(filter.search);

    const matchStatus = filter.status === 'all' || staff.status === filter.status;
    const matchRank = filter.rank === 'all' || staff.rank === filter.rank;
    const matchCompany = filter.company === 'all' || staff.company === filter.company;
    const matchCategory = filter.category === 'all' || staff.category === filter.category;

    return matchSearch && matchStatus && matchRank && matchCompany && matchCategory;
  });
};

// ═══════════════════════════════════════════
// STAFF SUMMARY (for active batch only)
// ═══════════════════════════════════════════
export const getStaffSummary = async (batchId: string): Promise<{
  total: number;
  active: number;
  onLeave: number;
  onTD: number;
  inHospital: number;
  onCourse: number;
  inactive: number;
}> => {
  try {
    const staffList = await getStaffByBatch(batchId);

    return {
      total: staffList.length,
      active: staffList.filter(s => s.status === 'active').length,
      onLeave: staffList.filter(s => s.status === 'leave').length,
      onTD: staffList.filter(s => s.status === 'td').length,
      inHospital: staffList.filter(s => s.status === 'hospital').length,
      onCourse: staffList.filter(s => s.status === 'course').length,
      inactive: staffList.filter(s => s.status === 'inactive').length,
    };
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// DEPRECATED (kept for backward compatibility)
// ═══════════════════════════════════════════
export const getAllStaff = async (): Promise<Staff[]> => {
  console.warn('getAllStaff is deprecated. Use getStaffByBatch instead.');
  const snapshot = await getDocs(staffCol());
  return snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map(doc =>
    docToStaff(doc.id, doc.data() as Record<string, unknown>)
  );
};

export const getActiveStaff = async (batchId: string): Promise<Staff[]> => {
  const staffList = await getStaffByBatch(batchId);
  return staffList.filter(s => s.status === 'active');
};

export const getStaffByStatus = async (
  batchId: string,
  status: StaffStatus
): Promise<Staff[]> => {
  const staffList = await getStaffByBatch(batchId);
  return staffList.filter(s => s.status === status);
};