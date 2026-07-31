// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationType =
  | 'leave_pending'
  | 'leave_approved'
  | 'leave_rejected'
  | 'leave_returning_soon'
  | 'duty_assigned'
  | 'duty_conflict'
  | 'attendance_pending'
  | 'schedule_upcoming'
  | 'deputation_new'
  | 'staff_hospital'
  | 'system_alert'
  // ★ NEW (Module 17 Audit) — event + broadcast types
  | 'schedule_changed'
  | 'exam_result'
  | 'medical_alert'
  | 'finance_alert'
  | 'inventory_alert'
  | 'broadcast'
  | 'emergency';

export type NotificationPriority = 'high' | 'medium' | 'low';

// ★ Persisted notification (Firestore `notifications` collection)
export interface StoredNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  targetRole: string;        // 'ALL' | 'Company Commander' | 'Quarter Master' | 'Clerk' | 'Ustad'
  targetUserId?: string;     // individual message ke liye (optional)
  readBy: string[];          // user uids jinhone padha
  createdBy: string;
  createdByName: string;
  createdAt: Date | null;
}

export const NOTIFICATION_TARGET_ROLES = [
  'ALL',
  'Company Commander',
  'Quarter Master',
  'Clerk',
  'Ustad',
] as const;

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
  metadata?: Record<string, any>;
}

export const NOTIFICATION_CONFIG: Record<NotificationType, {
  icon: string;
  color: string;
  bgColor: string;
}> = {
  leave_pending: { icon: '🏖️', color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
  leave_approved: { icon: '✅', color: 'text-green-700', bgColor: 'bg-green-50' },
  leave_rejected: { icon: '❌', color: 'text-red-700', bgColor: 'bg-red-50' },
  leave_returning_soon: { icon: '🔔', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  duty_assigned: { icon: '🎖️', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  duty_conflict: { icon: '⚠️', color: 'text-orange-700', bgColor: 'bg-orange-50' },
  attendance_pending: { icon: '📋', color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
  schedule_upcoming: { icon: '📅', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
  deputation_new: { icon: '🔄', color: 'text-pink-700', bgColor: 'bg-pink-50' },
  staff_hospital: { icon: '🏥', color: 'text-red-700', bgColor: 'bg-red-50' },
  system_alert: { icon: '⚡', color: 'text-slate-700', bgColor: 'bg-slate-50' },
  // ★ NEW (Module 17 Audit)
  schedule_changed: { icon: '🔀', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
  exam_result: { icon: '🎓', color: 'text-violet-700', bgColor: 'bg-violet-50' },
  medical_alert: { icon: '🩺', color: 'text-rose-700', bgColor: 'bg-rose-50' },
  finance_alert: { icon: '💰', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  inventory_alert: { icon: '📦', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  broadcast: { icon: '📢', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  emergency: { icon: '🚨', color: 'text-red-800', bgColor: 'bg-red-100' },
};