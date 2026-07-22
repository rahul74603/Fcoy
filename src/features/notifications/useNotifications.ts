// ============================================
// useNotifications HOOK
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { AppNotification } from './notification.types';
import { useAuth } from '../../contexts/AuthContext';
import { useBatch } from '../../contexts/BatchContext';

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const READ_STORAGE_KEY = 'bsf_read_notifications';

export const useNotifications = (): UseNotificationsReturn => {
  const { user } = useAuth();
  const { activeBatch } = useBatch();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(READ_STORAGE_KEY);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...readIds]));
  }, [readIds]);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const allNotifs: AppNotification[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threeDaysLater = new Date();
      threeDaysLater.setDate(today.getDate() + 3);

      // 1. PENDING LEAVES
      try {
        const pendingSnap = await getDocs(
          query(collection(db, 'staff_leave'), where('status', '==', 'pending'))
        );

        pendingSnap.docs.forEach(d => {
          const data = d.data();
          const appliedAt = data.appliedAt?.toDate() ?? new Date();
          allNotifs.push({
            id: `leave_pending_${d.id}`,
            type: 'leave_pending',
            priority: 'high',
            title: 'Leave Approval Required',
            message: `${data.rank} ${data.staffName} applied for ${data.numberOfDays} days ${data.leaveTypeName}`,
            timestamp: appliedAt,
            read: readIds.has(`leave_pending_${d.id}`),
            link: '/staff-leave',
          });
        });
      } catch (err) {
        console.warn('Failed to fetch pending leaves:', err);
      }

      // 2. RETURNING SOON
      try {
        const approvedSnap = await getDocs(
          query(collection(db, 'staff_leave'), where('status', '==', 'approved'))
        );

        approvedSnap.docs.forEach(d => {
          const data = d.data();
          const toDate = data.toDate?.toDate();
          if (!toDate || data.returnDate) return;

          if (toDate >= today && toDate <= threeDaysLater) {
            const daysLeft = Math.ceil((toDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            allNotifs.push({
              id: `returning_${d.id}`,
              type: 'leave_returning_soon',
              priority: daysLeft <= 1 ? 'high' : 'medium',
              title: 'Staff Returning Soon',
              message: `${data.rank} ${data.staffName} returning in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
              timestamp: today,
              read: readIds.has(`returning_${d.id}`),
              link: '/staff-leave',
            });
          }
        });
      } catch (err) {
        console.warn('Failed to fetch returning:', err);
      }

      // 3. TODAY'S DUTIES
      try {
        const dutySnap = await getDocs(
          query(collection(db, 'staff_duty'), where('status', '==', 'assigned'))
        );

        const todayDuties: any[] = [];
        dutySnap.docs.forEach(d => {
          const data = d.data();
          const dutyDate = data.date?.toDate();
          if (!dutyDate) return;

          const dutyDateOnly = new Date(dutyDate);
          dutyDateOnly.setHours(0, 0, 0, 0);

          if (dutyDateOnly.getTime() === today.getTime()) {
            todayDuties.push({ id: d.id, ...data });
          }
        });

        if (todayDuties.length > 0) {
          allNotifs.push({
            id: `duties_today`,
            type: 'duty_assigned',
            priority: 'medium',
            title: `${todayDuties.length} Duties Today`,
            message: `${todayDuties.length} pending duties for today`,
            timestamp: today,
            read: readIds.has('duties_today'),
            link: '/duty-management',
          });
        }
      } catch (err) {
        console.warn('Failed to fetch duties:', err);
      }

      // 4. STAFF IN HOSPITAL
      try {
        if (activeBatch) {
          const staffSnap = await getDocs(
            query(collection(db, 'staff'),
              where('batchId', '==', activeBatch.id),
              where('status', '==', 'hospital')
            )
          );

          if (staffSnap.size > 0) {
            allNotifs.push({
              id: `staff_hospital_${activeBatch.id}`,
              type: 'staff_hospital',
              priority: 'high',
              title: 'Staff in Hospital',
              message: `${staffSnap.size} staff member(s) currently in hospital`,
              timestamp: today,
              read: readIds.has(`staff_hospital_${activeBatch.id}`),
              link: '/staff',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch hospital staff:', err);
      }

      // 5. UPCOMING TRAINING SCHEDULES
      try {
        if (activeBatch) {
          const scheduleSnap = await getDocs(
            query(collection(db, 'training_schedule'),
              where('batchId', '==', activeBatch.id),
              where('status', '==', 'scheduled')
            )
          );

          const todaySchedules = scheduleSnap.docs.filter(d => {
            const data = d.data();
            const schedDate = data.date?.toDate();
            if (!schedDate) return false;
            const schedDateOnly = new Date(schedDate);
            schedDateOnly.setHours(0, 0, 0, 0);
            return schedDateOnly.getTime() === today.getTime();
          });

          if (todaySchedules.length > 0) {
            allNotifs.push({
              id: `schedules_today`,
              type: 'schedule_upcoming',
              priority: 'medium',
              title: `${todaySchedules.length} Classes Today`,
              message: `${todaySchedules.length} training classes scheduled for today`,
              timestamp: today,
              read: readIds.has('schedules_today'),
              link: '/training-schedule',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch schedules:', err);
      }

      // 6. ACTIVE DEPUTATIONS
      try {
        if (activeBatch) {
          const depSnap = await getDocs(
            query(collection(db, 'deputation_records'),
              where('batchId', '==', activeBatch.id),
              where('status', '==', 'active')
            )
          );

          if (depSnap.size > 0) {
            allNotifs.push({
              id: `deputations_active`,
              type: 'deputation_new',
              priority: 'low',
              title: 'Active Deputations',
              message: `${depSnap.size} active deputation record(s)`,
              timestamp: today,
              read: readIds.has('deputations_active'),
              link: '/deputation',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch deputations:', err);
      }

      // Sort by priority + timestamp
      allNotifs.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      setNotifications(allNotifs);
    } catch (err) {
      console.error('Notification fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeBatch, readIds]);

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const markAsRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
  };

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  const clearAll = () => {
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
};