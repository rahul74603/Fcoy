// ═══════════════════════════════════════════════════════════
// PERIOD ATTENDANCE API (Kaksha Upasthiti)
// Bulk mark attendance per period with reason + body pair
// ═══════════════════════════════════════════════════════════

import {
  collection, addDoc, getDocs, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { PeriodAttendanceRecord, PeriodStatus } from '../types/periodAttendance.types';

const COLLECTION = 'periodAttendance';

// Bulk mark attendance for a period
export const bulkMarkPeriodAttendance = async (
  batchId: string,
  date: string,
  period: string,
  subject: string,
  marks: { traineeId: string; traineeName: string; chestNo: string; status: PeriodStatus; reason?: string; bodyPairChestNo?: string; bodyPairName?: string }[],
  markedBy: string,
): Promise<void> => {
  // Delete existing records for this period+date+batch
  try {
    const existing = await getDocs(
      query(collection(db, COLLECTION), where('batchId', '==', batchId), where('date', '==', date), where('period', '==', period))
    );
    const batch = writeBatch(db);
    existing.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch { /* ignore if no existing */ }

  // Add new records
  for (const m of marks) {
    await addDoc(collection(db, COLLECTION), {
      traineeId: m.traineeId,
      traineeName: m.traineeName,
      chestNo: m.chestNo,
      batchId, date, period, subject,
      status: m.status,
      reason: m.reason || '',
      bodyPairChestNo: m.bodyPairChestNo || '',
      bodyPairName: m.bodyPairName || '',
      markedBy,
      remarks: '',
      createdAt: new Date().toISOString(),
    });
  }
};

// Get attendance for a specific date
export const getPeriodAttendanceByDate = async (batchId: string, date: string): Promise<PeriodAttendanceRecord[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('batchId', '==', batchId), where('date', '==', date))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodAttendanceRecord));
  } catch { return []; }
};

// Get attendance for a date range (weekly/monthly reports)
export const getPeriodAttendanceByRange = async (batchId: string, startDate: string, endDate: string): Promise<PeriodAttendanceRecord[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('batchId', '==', batchId), where('date', '>=', startDate), where('date', '<=', endDate))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodAttendanceRecord));
  } catch { return []; }
};

// Get attendance for a specific trainee
export const getPeriodAttendanceByTrainee = async (traineeId: string, batchId: string): Promise<PeriodAttendanceRecord[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('batchId', '==', batchId), where('traineeId', '==', traineeId))
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodAttendanceRecord));
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  } catch { return []; }
};
