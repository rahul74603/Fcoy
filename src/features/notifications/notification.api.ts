// ============================================
// NOTIFICATION API (Module 17 Audit ★ NEW)
// ============================================
// Pehle notifications sirf COMPUTED the (bell = 6 collections
// poll karke live alerts banata tha) — koi persistent store,
// broadcast, ya delivery tracking nahi thi. Ye API `notifications`
// collection deti hai:
//   • sendNotification  — role/individual targeted message
//   • event emitters    — leave/schedule/exam/medical modules se
//   • read tracking     — readBy[] per notification (multi-device)
// Sab emitters FIRE-AND-FORGET hain — kabhi main flow ko break
// nahi karte (silent catch pattern, jaise logActivity).
// ============================================

import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, where, orderBy, limit, serverTimestamp,
  arrayUnion, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { NotificationPriority, NotificationType, StoredNotification } from './notification.types';

const NOTIF_COL = 'notifications';

// ─── SEND NOTIFICATION ───────────────────────
export interface SendNotificationInput {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  targetRole?: string;       // default 'ALL'
  targetUserId?: string;     // individual ke liye
  createdBy?: string;
  createdByName?: string;
  metadata?: Record<string, unknown>;
}

export const sendNotification = async (input: SendNotificationInput): Promise<string> => {
  const ref = await addDoc(collection(db, NOTIF_COL), {
    type: input.type,
    priority: input.priority,
    title: input.title,
    message: input.message,
    link: input.link ?? '',
    targetRole: input.targetRole ?? 'ALL',
    targetUserId: input.targetUserId ?? '',
    readBy: [],
    createdBy: input.createdBy ?? 'system',
    createdByName: input.createdByName ?? 'System',
    metadata: input.metadata ?? {},
    deliveredAt: serverTimestamp(),   // in-app delivery = doc created
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

// ─── FIRE-AND-FORGET SAFE WRAPPER ───────────
const safeSend = (input: SendNotificationInput): void => {
  sendNotification(input).catch(err =>
    console.error('Notification send error (main flow safe):', err)
  );
};

// ─── FETCH FOR USER (role + personal merged) ─
export const fetchNotificationsFor = async (
  role: string,
  uid: string
): Promise<StoredNotification[]> => {
  const results: StoredNotification[] = [];
  const seen = new Set<string>();

  const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): StoredNotification => ({
    id: d.id,
    type: (d.data().type as NotificationType) ?? 'system_alert',
    priority: ((d.data().priority as NotificationPriority) ?? 'medium'),
    title: String(d.data().title ?? ''),
    message: String(d.data().message ?? ''),
    link: String(d.data().link ?? ''),
    targetRole: String(d.data().targetRole ?? 'ALL'),
    targetUserId: String(d.data().targetUserId ?? ''),
    readBy: Array.isArray(d.data().readBy) ? (d.data().readBy as string[]) : [],
    createdBy: String(d.data().createdBy ?? ''),
    createdByName: String(d.data().createdByName ?? ''),
    createdAt: d.data().createdAt ? (d.data().createdAt as Timestamp).toDate() : null,
  });

  // NOTE: where + orderBy composite index ki zaroorat na pade isliye
  // query sirf filter karti hai — sorting client-side hoti hai
  // (single-company volume chhota hai; scale par composite index add karna).

  // 1. Role-targeted (ALL + mera role)
  try {
    const roleQ = query(
      collection(db, NOTIF_COL),
      where('targetRole', 'in', ['ALL', role])
    );
    const snap = await getDocs(roleQ);
    snap.docs.forEach(d => {
      // personal-targeted docs ko role feed se bahar rakho
      if (!d.data().targetUserId) {
        seen.add(d.id);
        results.push(mapDoc(d));
      }
    });
  } catch (err) {
    console.warn('Role notifications fetch failed:', err);
  }

  // 2. Personally targeted to me
  try {
    const personalQ = query(
      collection(db, NOTIF_COL),
      where('targetUserId', '==', uid)
    );
    const snap = await getDocs(personalQ);
    snap.docs.forEach(d => {
      if (!seen.has(d.id)) results.push(mapDoc(d));
    });
  } catch (err) {
    console.warn('Personal notifications fetch failed:', err);
  }

  return results
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 80);
};

// ─── SENT HISTORY (CC audit view) ────────────
export const fetchSentHistory = async (count: number = 50): Promise<StoredNotification[]> => {
  try {
    const q = query(
      collection(db, NOTIF_COL),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      type: (d.data().type as NotificationType) ?? 'system_alert',
      priority: ((d.data().priority as NotificationPriority) ?? 'medium'),
      title: String(d.data().title ?? ''),
      message: String(d.data().message ?? ''),
      link: String(d.data().link ?? ''),
      targetRole: String(d.data().targetRole ?? 'ALL'),
      targetUserId: String(d.data().targetUserId ?? ''),
      readBy: Array.isArray(d.data().readBy) ? (d.data().readBy as string[]) : [],
      createdBy: String(d.data().createdBy ?? ''),
      createdByName: String(d.data().createdByName ?? ''),
      createdAt: d.data().createdAt ? (d.data().createdAt as Timestamp).toDate() : null,
    }));
  } catch (err) {
    console.warn('Sent history fetch failed:', err);
    return [];
  }
};

// ─── READ TRACKING ───────────────────────────
export const markStoredNotificationRead = async (id: string, uid: string): Promise<void> => {
  try {
    await updateDoc(doc(db, NOTIF_COL, id), { readBy: arrayUnion(uid) });
  } catch (err) {
    console.error('Mark read error:', err);
  }
};

export const markAllStoredRead = async (notifs: StoredNotification[], uid: string): Promise<void> => {
  const unread = notifs.filter(n => !n.readBy.includes(uid));
  if (unread.length === 0) return;
  try {
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, NOTIF_COL, n.id), { readBy: arrayUnion(uid) }));
    await batch.commit();
  } catch (err) {
    console.error('Mark all read error:', err);
  }
};

// ═════════════════════════════════════════════
// EVENT EMITTERS — existing modules se call hote hain
// (har ek silent: main flow kabhi break nahi hota)
// ═════════════════════════════════════════════

// ★ LEAVE: approve / reject hua → Clerk ko update
export const notifyLeaveDecision = async (
  leaveId: string,
  decision: 'approved' | 'rejected',
  decidedByName: string
): Promise<void> => {
  try {
    const snap = await getDoc(doc(db, 'staff_leave', leaveId));
    if (!snap.exists()) return;
    const data = snap.data();
    const who = `${data.rank ?? ''} ${data.staffName ?? ''}`.trim();
    safeSend({
      type: decision === 'approved' ? 'leave_approved' : 'leave_rejected',
      priority: 'medium',
      title: decision === 'approved' ? 'Leave Approved ✅' : 'Leave Rejected ❌',
      message: `${who} ki ${data.leaveTypeName ?? 'leave'} (${data.numberOfDays ?? ''} days) ${decision === 'approved' ? 'approve ho gayi' : 'reject kar di gayi'} — ${decidedByName}`,
      link: '/staff-leave',
      targetRole: 'Clerk',
      createdByName: decidedByName || 'System',
    });
  } catch (err) {
    console.error('Leave decision notify error:', err);
  }
};

// ★ SCHEDULE: class reschedule/postpone → Ustad + Clerk
export const notifyScheduleChanged = (
  subjectName: string,
  newDate: string,
  newTime: string,
  changedByName: string
): void => {
  safeSend({
    type: 'schedule_changed',
    priority: 'high',
    title: 'Training Class Rescheduled 🔀',
    message: `${subjectName} class ${newDate} ko ${newTime} par reschedule/postpone hui — ${changedByName}`,
    link: '/training-schedule',
    targetRole: 'Ustad',
    createdByName: changedByName || 'System',
  });
  safeSend({
    type: 'schedule_changed',
    priority: 'medium',
    title: 'Training Class Rescheduled 🔀',
    message: `${subjectName} class ${newDate} ko ${newTime} par reschedule/postpone hui — ${changedByName}`,
    link: '/training-schedule',
    targetRole: 'Clerk',
    createdByName: changedByName || 'System',
  });
};

// ★ EXAM: results publish hue → CC + Clerk
export const notifyTestResultsPublished = (
  testName: string,
  passCount: number,
  failCount: number,
  absentCount: number
): void => {
  safeSend({
    type: 'exam_result',
    priority: 'medium',
    title: 'Test Results Published 🎓',
    message: `${testName}: Pass ${passCount} · Fail ${failCount} · Absent ${absentCount}`,
    link: '/test-records',
    targetRole: 'Company Commander',
    createdByName: 'Test Records',
  });
  safeSend({
    type: 'exam_result',
    priority: 'low',
    title: 'Test Results Published 🎓',
    message: `${testName}: Pass ${passCount} · Fail ${failCount} · Absent ${absentCount}`,
    link: '/test-records',
    targetRole: 'Clerk',
    createdByName: 'Test Records',
  });
};

// ★ MEDICAL: naya case → CC ko turant alert
export const notifyMedicalCaseCreated = (
  chestNo: string,
  traineeName: string,
  category: string,
  recordedByName: string
): void => {
  const isSerious = category === 'Hospital Admit' || category === 'Injury (Training)' || category === 'Medical Board';
  safeSend({
    type: 'medical_alert',
    priority: isSerious ? 'high' : 'low',
    title: isSerious ? `🚨 ${category}` : 'Medical Case Registered',
    message: `Chest ${chestNo} ${traineeName} — ${category} darj hua (${recordedByName})`,
    link: '/medical-register',
    targetRole: 'Company Commander',
    createdByName: recordedByName || 'Medical Register',
  });
};
