// ============================================
// ATTENDANCE API - Firebase CRUD Operations
// ============================================

import {
  collection, doc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import { toJSDate } from '../../../utils/date.utils';
import {
  StaffAttendance,
  AttendanceStatus,
  DailyAttendanceEntry,
  AttendanceSummary,
} from '../types/attendance.types';

const COLLECTION = 'staff_attendance';

// ─── Helper: Doc → Attendance ────────────────
const docToAttendance = (
  id: string,
  data: Record<string, unknown>
): StaffAttendance => ({
  id,
  staffId: (data.staffId as string) ?? '',
  staffName: (data.staffName as string) ?? '',
  forceNumber: (data.forceNumber as string) ?? '',
  date: toJSDate(data.date),
  status: (data.status as AttendanceStatus) ?? 'present',
  remarks: (data.remarks as string) ?? '',
  markedBy: (data.markedBy as string) ?? '',
  markedAt: toJSDate(data.markedAt),
  updatedAt: toJSDate(data.updatedAt),
});

// ─── MARK BULK ATTENDANCE ─────────────────────
// Mark attendance for all staff at once
export const markBulkAttendance = async (
  entries: DailyAttendanceEntry[],
  date: string,
  markedBy: string,
  batchId?: string,
  batchNumber?: string
): Promise<void> => {
  try {
    const dateObj = new Date(date);
    // Set to midnight for consistent date comparison
    dateObj.setHours(0, 0, 0, 0);
    const dateTimestamp = Timestamp.fromDate(dateObj);

    // Check existing attendance for this date
    const existingQuery = query(
      collection(db, COLLECTION),
      where('date', '==', dateTimestamp)
    );
    const existingSnap = await getDocs(existingQuery);

    // Map existing records by staffId for quick lookup
    const existingMap = new Map<string, string>();
    existingSnap.docs.forEach((doc) => {
      existingMap.set(doc.data().staffId as string, doc.id);
    });

    // Use batch write for performance
    const batch = writeBatch(db);

    entries.forEach((entry) => {
      const existingDocId = existingMap.get(entry.staffId);

      if (existingDocId) {
        // Update existing
        const docRef = doc(db, COLLECTION, existingDocId);
        batch.update(docRef, {
          status: entry.status,
          remarks: entry.remarks,
          markedBy,
          updatedAt: serverTimestamp(),
        });
            } else {
        // Create new
        const newDocRef = doc(collection(db, COLLECTION));
        batch.set(newDocRef, {
          staffId: entry.staffId,
          staffName: entry.staffName,
          forceNumber: entry.forceNumber,
          date: dateTimestamp,
          status: entry.status,
          remarks: entry.remarks,
          markedBy,
          batchId: batchId ?? '',
          batchNumber: batchNumber ?? '',
          markedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  } catch (error) {
    throw error;
  }
};

// ─── GET ATTENDANCE BY DATE ───────────────────
export const getAttendanceByDate = async (
  date: string,
  batchId?: string
): Promise<StaffAttendance[]> => {
  try {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    const dateTimestamp = Timestamp.fromDate(dateObj);

    const q = query(
      collection(db, COLLECTION),
      where('date', '==', dateTimestamp)
    );
    const snapshot = await getDocs(q);

    let records = snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map((doc) =>
      docToAttendance(doc.id, doc.data() as Record<string, unknown>)
    );

    // 🆕 Filter by batch if provided
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

// ─── GET ATTENDANCE BY STAFF (Monthly) ───────
export const getStaffAttendanceByMonth = async (
  staffId: string,
  month: number,
  year: number
): Promise<StaffAttendance[]> => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const q = query(
      collection(db, COLLECTION),
      where('staffId', '==', staffId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map((doc) =>
      docToAttendance(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── GET ALL STAFF ATTENDANCE (Monthly) ──────
export const getAllAttendanceByMonth = async (
  month: number,
  year: number
): Promise<StaffAttendance[]> => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const q = query(
      collection(db, COLLECTION),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map((doc) =>
      docToAttendance(doc.id, doc.data() as Record<string, unknown>)
    );
  } catch (error) {
    throw error;
  }
};

// ─── UPDATE SINGLE ATTENDANCE ─────────────────
export const updateAttendance = async (
  attendanceId: string,
  status: AttendanceStatus,
  remarks: string,
  updatedBy: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, attendanceId);
    await updateDoc(docRef, {
      status,
      remarks,
      markedBy: updatedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// ─── CALCULATE ATTENDANCE SUMMARY ────────────
export const calculateAttendanceSummary = (
  staffId: string,
  staffName: string,
  records: StaffAttendance[],
  month: number,
  year: number
): AttendanceSummary => {
  // Total working days in month
  const daysInMonth = new Date(year, month, 0).getDate();

  const summary: AttendanceSummary = {
    staffId,
    staffName,
    month,
    year,
    totalDays: daysInMonth,
    presentDays: 0,
    absentDays: 0,
    leaveDays: 0,
    tdDays: 0,
    hospitalDays: 0,
    courseDays: 0,
    weeklyOffDays: 0,
    attendancePercent: 0,
  };

  records.forEach((record) => {
    switch (record.status) {
      case 'present':
        summary.presentDays++;
        break;
      case 'absent':
        summary.absentDays++;
        break;
      case 'leave':
        summary.leaveDays++;
        break;
      case 'td':
        summary.tdDays++;
        break;
      case 'hospital':
        summary.hospitalDays++;
        break;
      case 'course':
        summary.courseDays++;
        break;
      case 'weekly_off':
        summary.weeklyOffDays++;
        break;
    }
  });

  // Attendance % = present / (total - weekly off) * 100
  const workingDays = daysInMonth - summary.weeklyOffDays;
  summary.attendancePercent =
    workingDays > 0
      ? Math.round((summary.presentDays / workingDays) * 100)
      : 0;

  return summary;
};