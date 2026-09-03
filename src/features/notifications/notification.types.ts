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
  | 'trainee_report_pending'
  | 'system_alert';

export type NotificationPriority = 'high' | 'medium' | 'low';

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
  trainee_report_pending: { icon: '🤒', color: 'text-yellow-800', bgColor: 'bg-yellow-50' },
  system_alert: { icon: '⚡', color: 'text-slate-700', bgColor: 'bg-slate-50' },
};