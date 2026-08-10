// ============================================
// ACTIVITY LOG API
// ============================================

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { toJSDate } from '../../../utils/date.utils';
import { StaffActivityLog } from '../types/performance.types';

const COLLECTION = 'staff_activity_logs';

// ─── Log an Action ───────────────────────────
export const logActivity = async (
  userId: string,
  userName: string,
  userRole: string,
  module: string,
  action: string,
  details: Record<string, unknown>,
  targetId: string = ''
): Promise<void> => {
  try {
    await addDoc(collection(db, COLLECTION), {
      userId,
      userName,
      userRole,
      module,
      action,
      details,
      targetId,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    // Log silently - don't break main operations
    console.error('Activity log error:', error);
  }
};

// ─── Get Recent Logs ─────────────────────────
export const getRecentLogs = async (
  count: number = 50
): Promise<StaffActivityLog[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        userId: (data.userId as string) ?? '',
        userName: (data.userName as string) ?? '',
        userRole: (data.userRole as string) ?? '',
        module: (data.module as string) ?? '',
        action: (data.action as string) ?? '',
        details: (data.details as Record<string, unknown>) ?? {},
        targetId: (data.targetId as string) ?? '',
        timestamp: toJSDate(data.timestamp),
      };
    });
  } catch (error) {
    throw error;
  }
};

// ─── Get Logs by Staff ───────────────────────
export const getLogsByStaff = async (
  staffId: string
): Promise<StaffActivityLog[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('targetId', '==', staffId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        userId: (data.userId as string) ?? '',
        userName: (data.userName as string) ?? '',
        userRole: (data.userRole as string) ?? '',
        module: (data.module as string) ?? '',
        action: (data.action as string) ?? '',
        details: (data.details as Record<string, unknown>) ?? {},
        targetId: (data.targetId as string) ?? '',
        timestamp: toJSDate(data.timestamp),
      };
    });
  } catch (error) {
    throw error;
  }
};