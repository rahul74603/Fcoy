// ============================================
// BATCH PROGRESS API
// ============================================

import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import {
  BatchProgress, SubjectProgress,
} from '../types/batchProgress.types';

const COLLECTION = 'batch_progress';

// ─── Helper: Doc → BatchProgress ─────────────
const docToProgress = (id: string, data: Record<string, unknown>): BatchProgress => ({
  id,
  batchId: (data.batchId as string) ?? '',
  batchNumber: (data.batchNumber as string) ?? '',
  batchName: (data.batchName as string) ?? '',
  startDate: data.startDate ? (data.startDate as any).toDate?.() ?? null : null,
  endDate: data.endDate ? (data.endDate as any).toDate?.() ?? null : null,
  totalDays: (data.totalDays as number) ?? 0,
  daysElapsed: (data.daysElapsed as number) ?? 0,
  daysRemaining: (data.daysRemaining as number) ?? 0,
  overallPercent: (data.overallPercent as number) ?? 0,
  subjectProgress: (data.subjectProgress as SubjectProgress[]) ?? [],
  weeklyTrend: (data.weeklyTrend as any[]) ?? [],
  milestones: (data.milestones as any[]) ?? [],
  createdAt: data.createdAt ? (data.createdAt as any).toDate?.() ?? null : null,
  updatedAt: data.updatedAt ? (data.updatedAt as any).toDate?.() ?? null : null,
});

// ═══════════════════════════════════════════
// GET OR CREATE PROGRESS FOR BATCH
// ═══════════════════════════════════════════
export const getOrCreateBatchProgress = async (
  batchId: string,
  batchNumber: string,
  batchName: string,
  startDate: Date,
  endDate: Date
): Promise<BatchProgress> => {
  try {
    // Check if exists
    const q = query(
      collection(db, COLLECTION),
      where('batchId', '==', batchId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      // Return existing
      const doc = snap.docs[0];
      return docToProgress(doc.id, doc.data() as Record<string, unknown>);
    }

    // Create new
    const today = new Date();
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysElapsed = Math.max(0, Math.ceil(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    const newProgress = {
      batchId,
      batchNumber,
      batchName,
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
      totalDays,
      daysElapsed,
      daysRemaining,
      overallPercent: 0,
      subjectProgress: [],
      weeklyTrend: [],
      milestones: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), newProgress);
    return {
      id: docRef.id,
      ...newProgress,
      startDate,
      endDate,
      createdAt: today,
      updatedAt: today,
    } as BatchProgress;
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// UPDATE SUBJECT PROGRESS
// ═══════════════════════════════════════════
export const updateSubjectProgress = async (
  progressId: string,
  subjectId: string,
  updates: Partial<SubjectProgress>
): Promise<void> => {
  try {
    // Get current
    const q = query(collection(db, COLLECTION), where('__name__', '==', progressId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Progress record not found');

    const currentDoc = snap.docs[0];
    const currentData = currentDoc.data();
    const subjectProgress = (currentData.subjectProgress as SubjectProgress[]) ?? [];

    // Update or add
    const existingIndex = subjectProgress.findIndex(sp => sp.subjectId === subjectId);
    if (existingIndex >= 0) {
      subjectProgress[existingIndex] = {
        ...subjectProgress[existingIndex],
        ...updates,
        percentComplete: updates.totalHours && updates.completedHours
          ? Math.round((updates.completedHours / updates.totalHours) * 100)
          : subjectProgress[existingIndex].percentComplete,
        lastUpdated: new Date(),
      };
    }

    // Calculate overall
    const totalHours = subjectProgress.reduce((s, sp) => s + sp.totalHours, 0);
    const completedHours = subjectProgress.reduce((s, sp) => s + sp.completedHours, 0);
    const overallPercent = totalHours > 0
      ? Math.round((completedHours / totalHours) * 100)
      : 0;

    await updateDoc(doc(db, COLLECTION, progressId), {
      subjectProgress,
      overallPercent,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// ADD/UPDATE SUBJECT PLAN
// ═══════════════════════════════════════════
export const addSubjectToPlan = async (
  progressId: string,
  subject: SubjectProgress
): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), where('__name__', '==', progressId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Progress record not found');

    const currentData = snap.docs[0].data();
    const subjectProgress = (currentData.subjectProgress as SubjectProgress[]) ?? [];

    // Check if already exists
    const existingIndex = subjectProgress.findIndex(sp => sp.subjectId === subject.subjectId);
    if (existingIndex >= 0) {
      subjectProgress[existingIndex] = subject;
    } else {
      subjectProgress.push(subject);
    }

    await updateDoc(doc(db, COLLECTION, progressId), {
      subjectProgress,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// REMOVE SUBJECT FROM PLAN
// ═══════════════════════════════════════════
export const removeSubjectFromPlan = async (
  progressId: string,
  subjectId: string
): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), where('__name__', '==', progressId));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const currentData = snap.docs[0].data();
    const subjectProgress = (currentData.subjectProgress as SubjectProgress[]) ?? [];
    const filtered = subjectProgress.filter(sp => sp.subjectId !== subjectId);

    await updateDoc(doc(db, COLLECTION, progressId), {
      subjectProgress: filtered,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// ADD MILESTONE
// ═══════════════════════════════════════════
export const addMilestone = async (
  progressId: string,
  name: string,
  targetDate: Date
): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), where('__name__', '==', progressId));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const currentData = snap.docs[0].data();
    const milestones = (currentData.milestones as any[]) ?? [];

    milestones.push({
      name,
      targetDate: Timestamp.fromDate(targetDate),
      completed: false,
      completedDate: null,
    });

    await updateDoc(doc(db, COLLECTION, progressId), {
      milestones,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// COMPLETE MILESTONE
// ═══════════════════════════════════════════
export const completeMilestone = async (
  progressId: string,
  milestoneIndex: number
): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), where('__name__', '==', progressId));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const currentData = snap.docs[0].data();
    const milestones = (currentData.milestones as any[]) ?? [];

    if (milestones[milestoneIndex]) {
      milestones[milestoneIndex].completed = true;
      milestones[milestoneIndex].completedDate = Timestamp.fromDate(new Date());
    }

    await updateDoc(doc(db, COLLECTION, progressId), {
      milestones,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};