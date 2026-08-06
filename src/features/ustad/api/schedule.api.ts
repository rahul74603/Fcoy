// ============================================
// TRAINING SCHEDULE API
// ============================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import {
  TrainingSchedule, ScheduleFormData, ScheduleStatus, DAYS_OF_WEEK,
} from '../types/schedule.types';

const COLLECTION = 'training_schedule';

// ─── Helper: Doc → Schedule ──────────────────
const docToSchedule = (id: string, data: Record<string, unknown>): TrainingSchedule => ({
  id,
  batchId: (data.batchId as string) ?? '',
  batchNumber: (data.batchNumber as string) ?? '',
  date: data.date ? (data.date as any).toDate?.() ?? new Date(data.date as string) : null,
  dayOfWeek: (data.dayOfWeek as string) ?? '',
  startTime: (data.startTime as string) ?? '',
  endTime: (data.endTime as string) ?? '',
  duration: (data.duration as number) ?? 0,
  ustadId: (data.ustadId as string) ?? '',
  ustadName: (data.ustadName as string) ?? '',
  ustadRank: (data.ustadRank as string) ?? '',
  ustadForceNumber: (data.ustadForceNumber as string) ?? '',
  subjectId: (data.subjectId as string) ?? '',
  subjectName: (data.subjectName as string) ?? '',
  subjectCode: (data.subjectCode as string) ?? '',
  company: (data.company as string) ?? '',
  platoon: (data.platoon as string) ?? '',
  venue: (data.venue as string) ?? '',
  status: (data.status as ScheduleStatus) ?? 'scheduled',
  remarks: (data.remarks as string) ?? '',
  createdAt: data.createdAt ? (data.createdAt as any).toDate?.() ?? null : null,
  updatedAt: data.updatedAt ? (data.updatedAt as any).toDate?.() ?? null : null,
  createdBy: (data.createdBy as string) ?? '',
});

// ─── Calculate Duration (in minutes) ─────────
const calculateDuration = (startTime: string, endTime: string): number => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
};

// ─── Get Day Name from Date ──────────────────
const getDayName = (dateStr: string): string => {
  const date = new Date(dateStr);
  return DAYS_OF_WEEK[date.getDay()];
};

// ═══════════════════════════════════════════
// ADD SCHEDULE
// ═══════════════════════════════════════════
export const addSchedule = async (
  formData: ScheduleFormData,
  batchId: string,
  batchNumber: string,
  ustadDetails: { name: string; rank: string; forceNumber: string },
  subjectDetails: { name: string; code: string },
  userId: string
): Promise<string> => {
  try {
    const payload = {
      batchId,
      batchNumber,
      date: Timestamp.fromDate(new Date(formData.date)),
      dayOfWeek: getDayName(formData.date),
      startTime: formData.startTime,
      endTime: formData.endTime,
      duration: calculateDuration(formData.startTime, formData.endTime),
      ustadId: formData.ustadId,
      ustadName: ustadDetails.name,
      ustadRank: ustadDetails.rank,
      ustadForceNumber: ustadDetails.forceNumber,
      subjectId: formData.subjectId,
      subjectName: subjectDetails.name,
      subjectCode: subjectDetails.code,
      company: formData.company,
      platoon: formData.platoon,
      venue: formData.venue,
      status: 'scheduled' as ScheduleStatus,
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
// GET SCHEDULES BY DATE
// ═══════════════════════════════════════════
export const getSchedulesByDate = async (
  batchId: string,
  date: string
): Promise<TrainingSchedule[]> => {
  try {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, COLLECTION),
      where('batchId', '==', batchId),
      where('date', '>=', Timestamp.fromDate(dateObj)),
      where('date', '<=', Timestamp.fromDate(endOfDay))
    );

    const snap = await getDocs(q);
    const schedules = snap.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map(d =>
      docToSchedule(d.id, d.data() as Record<string, unknown>)
    );

    // Sort by start time
    return schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// GET SCHEDULES BY DATE RANGE (for weekly view)
// ═══════════════════════════════════════════
export const getSchedulesByDateRange = async (
  batchId: string,
  fromDate: string,
  toDate: string
): Promise<TrainingSchedule[]> => {
  try {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, COLLECTION),
      where('batchId', '==', batchId),
      where('date', '>=', Timestamp.fromDate(from)),
      where('date', '<=', Timestamp.fromDate(to))
    );

    const snap = await getDocs(q);
    return snap.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map(d =>
      docToSchedule(d.id, d.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// GET SCHEDULES BY USTAD
// ═══════════════════════════════════════════
export const getSchedulesByUstad = async (
  batchId: string,
  ustadId: string
): Promise<TrainingSchedule[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('batchId', '==', batchId),
      where('ustadId', '==', ustadId)
    );

    const snap = await getDocs(q);
    return snap.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map(d =>
      docToSchedule(d.id, d.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// UPDATE SCHEDULE
// ═══════════════════════════════════════════
export const updateSchedule = async (
  scheduleId: string,
  formData: Partial<ScheduleFormData>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, scheduleId);
    const payload: Record<string, unknown> = {
      ...formData,
      updatedAt: serverTimestamp(),
    };

    if (formData.date) {
      payload.date = Timestamp.fromDate(new Date(formData.date));
      payload.dayOfWeek = getDayName(formData.date);
    }

    if (formData.startTime && formData.endTime) {
      payload.duration = calculateDuration(formData.startTime, formData.endTime);
    }

    await updateDoc(docRef, payload);
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// UPDATE STATUS
// ═══════════════════════════════════════════
export const updateScheduleStatus = async (
  scheduleId: string,
  status: ScheduleStatus
): Promise<void> => {
  const docRef = doc(db, COLLECTION, scheduleId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });
};

// ═══════════════════════════════════════════
// DELETE SCHEDULE
// ═══════════════════════════════════════════
export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, scheduleId));
};

// ═══════════════════════════════════════════
// CHECK CONFLICT (same ustad, overlapping time)
// ═══════════════════════════════════════════
export const checkScheduleConflict = async (
  batchId: string,
  ustadId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string
): Promise<TrainingSchedule | null> => {
  try {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, COLLECTION),
      where('batchId', '==', batchId),
      where('ustadId', '==', ustadId),
      where('date', '>=', Timestamp.fromDate(dateObj)),
      where('date', '<=', Timestamp.fromDate(endOfDay))
    );

    const snap = await getDocs(q);

    for (const d of snap.docs) {
      if (excludeId && d.id === excludeId) continue;

      const schedule = docToSchedule(d.id, d.data() as Record<string, unknown>);

      // Check time overlap
      if (
        (startTime >= schedule.startTime && startTime < schedule.endTime) ||
        (endTime > schedule.startTime && endTime <= schedule.endTime) ||
        (startTime <= schedule.startTime && endTime >= schedule.endTime)
      ) {
        return schedule; // Conflict found
      }
    }

    return null; // No conflict
  } catch (error) {
    throw error;
  }
};