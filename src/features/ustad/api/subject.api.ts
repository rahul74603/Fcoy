// ============================================
// SUBJECT API - Firebase CRUD Operations
// ============================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import {
  Subject,
  SubjectFormData,
  StaffSubjectAssignment,
  AssignmentFormData,
} from '../types/subject.types';

// ─── Collection Names ────────────────────────
const SUBJECT_COL = 'subject_master';
const ASSIGNMENT_COL = 'staff_subjects';

// ─── Helper: Doc → Subject ───────────────────
const docToSubject = (
  id: string,
  data: Record<string, unknown>
): Subject => ({
  id,
  name: (data.name as string) ?? '',
  code: (data.code as string) ?? '',
  category: (data.category as string) ?? '',
  description: (data.description as string) ?? '',
  isActive: (data.isActive as boolean) ?? true,
  createdAt: data.createdAt
    ? (data.createdAt as Timestamp).toDate()
    : null,
  updatedAt: data.updatedAt
    ? (data.updatedAt as Timestamp).toDate()
    : null,
  createdBy: (data.createdBy as string) ?? '',
});

// ─── Helper: Doc → Assignment ────────────────
const docToAssignment = (
  id: string,
  data: Record<string, unknown>
): StaffSubjectAssignment => ({
  id,
  staffId: (data.staffId as string) ?? '',
  staffName: (data.staffName as string) ?? '',
  forceNumber: (data.forceNumber as string) ?? '',
  subjectId: (data.subjectId as string) ?? '',
  subjectName: (data.subjectName as string) ?? '',
  subjectCode: (data.subjectCode as string) ?? '',
  assignedDate: data.assignedDate
    ? (data.assignedDate as Timestamp).toDate()
    : null,
  assignedBy: (data.assignedBy as string) ?? '',
  isActive: (data.isActive as boolean) ?? true,
  remarks: (data.remarks as string) ?? '',
  createdAt: data.createdAt
    ? (data.createdAt as Timestamp).toDate()
    : null,
});

// ════════════════════════════════════════════
// SUBJECT MASTER CRUD
// ════════════════════════════════════════════

// ─── ADD SUBJECT ─────────────────────────────
export const addSubject = async (
  formData: SubjectFormData,
  userId: string
): Promise<string> => {
  try {
    // Check duplicate code
    const dupQuery = query(
      collection(db, SUBJECT_COL),
      where('code', '==', formData.code.toUpperCase())
    );
    const dupSnap = await getDocs(dupQuery);
    if (!dupSnap.empty) {
      throw new Error('Subject code already exists.');
    }

    const docRef = await addDoc(collection(db, SUBJECT_COL), {
      ...formData,
      code: formData.code.toUpperCase(),
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// ─── GET ALL SUBJECTS ────────────────────────
export const getAllSubjects = async (): Promise<Subject[]> => {
  try {
    const q = query(
      collection(db, SUBJECT_COL),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) =>
      docToSubject(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── GET ACTIVE SUBJECTS ─────────────────────
export const getActiveSubjects = async (): Promise<Subject[]> => {
  try {
    const q = query(
      collection(db, SUBJECT_COL),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) =>
      docToSubject(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── UPDATE SUBJECT ──────────────────────────
export const updateSubject = async (
  subjectId: string,
  formData: Partial<SubjectFormData>
): Promise<void> => {
  try {
    const docRef = doc(db, SUBJECT_COL, subjectId);
    await updateDoc(docRef, {
      ...formData,
      ...(formData.code && { code: formData.code.toUpperCase() }),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ─── TOGGLE SUBJECT STATUS ───────────────────
export const toggleSubjectStatus = async (
  subjectId: string,
  isActive: boolean
): Promise<void> => {
  try {
    const docRef = doc(db, SUBJECT_COL, subjectId);
    await updateDoc(docRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ─── DELETE SUBJECT ──────────────────────────
export const deleteSubject = async (subjectId: string): Promise<void> => {
  try {
    // Check if subject is assigned to any staff
    const assignQuery = query(
      collection(db, ASSIGNMENT_COL),
      where('subjectId', '==', subjectId),
      where('isActive', '==', true)
    );
    const assignSnap = await getDocs(assignQuery);

    if (!assignSnap.empty) {
      throw new Error(
        'Subject is assigned to staff. Remove assignment first before deleting.'
      );
    }

    await deleteDoc(doc(db, SUBJECT_COL, subjectId));
  } catch (error) {
    throw error;
  }
};

// ════════════════════════════════════════════
// SUBJECT ASSIGNMENT CRUD
// ════════════════════════════════════════════

// ─── ASSIGN SUBJECTS TO STAFF ────────────────
export const assignSubjectsToStaff = async (
  formData: AssignmentFormData,
  staffName: string,
  forceNumber: string,
  subjects: { id: string; name: string; code: string }[],
  userId: string
): Promise<void> => {
  try {
    const assignedDate = formData.assignedDate
      ? Timestamp.fromDate(new Date(formData.assignedDate))
      : Timestamp.now();

    // Add each subject assignment
    const promises = formData.subjectIds.map(async (subjectId) => {
      // Check if already assigned
      const existingQuery = query(
        collection(db, ASSIGNMENT_COL),
        where('staffId', '==', formData.staffId),
        where('subjectId', '==', subjectId),
        where('isActive', '==', true)
      );
      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        // Skip if already assigned
        return;
      }

      const subject = subjects.find((s) => s.id === subjectId);

      await addDoc(collection(db, ASSIGNMENT_COL), {
        staffId: formData.staffId,
        staffName,
        forceNumber,
        subjectId,
        subjectName: subject?.name ?? '',
        subjectCode: subject?.code ?? '',
        assignedDate,
        assignedBy: userId,
        isActive: true,
        remarks: formData.remarks,
        createdAt: serverTimestamp(),
      });
    });

    await Promise.all(promises);
  } catch (error) {
    throw error;
  }
};

// ─── GET ASSIGNMENTS BY STAFF ─────────────────
export const getAssignmentsByStaff = async (
  staffId: string
): Promise<StaffSubjectAssignment[]> => {
  try {
    const q = query(
      collection(db, ASSIGNMENT_COL),
      where('staffId', '==', staffId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) =>
      docToAssignment(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── GET ASSIGNMENTS BY SUBJECT ──────────────
export const getAssignmentsBySubject = async (
  subjectId: string
): Promise<StaffSubjectAssignment[]> => {
  try {
    const q = query(
      collection(db, ASSIGNMENT_COL),
      where('subjectId', '==', subjectId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) =>
      docToAssignment(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── GET ALL ASSIGNMENTS ──────────────────────
export const getAllAssignments = async (): Promise<
  StaffSubjectAssignment[]
> => {
  try {
    const q = query(
      collection(db, ASSIGNMENT_COL),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) =>
      docToAssignment(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── REMOVE SUBJECT ASSIGNMENT ────────────────
export const removeSubjectAssignment = async (
  assignmentId: string
): Promise<void> => {
  try {
    const docRef = doc(db, ASSIGNMENT_COL, assignmentId);
    await updateDoc(docRef, {
      isActive: false,
      removedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ─── GET SUBJECT BY ID ───────────────────────
export const getSubjectById = async (
  subjectId: string
): Promise<Subject | null> => {
  try {
    const docRef = doc(db, SUBJECT_COL, subjectId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docToSubject(
      docSnap.id,
      docSnap.data() as Record<string, unknown>
    );
  } catch (error) {
    throw error;
  }
};