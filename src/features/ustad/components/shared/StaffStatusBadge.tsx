// ============================================
// STAFF STATUS BADGE COMPONENT
// ============================================

import React from 'react';
import { StaffStatus, STAFF_STATUS_LABELS, STAFF_STATUS_COLORS } from '../../types/staff.types';

interface Props {
  status: StaffStatus;
  size?: 'sm' | 'md' | 'lg';
}

const StaffStatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${STAFF_STATUS_COLORS[status]}
        ${sizeClasses[size]}
      `}
    >
      {/* Status Dot */}
      <span
        className={`
          w-1.5 h-1.5 rounded-full mr-1.5
          ${status === 'active' ? 'bg-green-500' : ''}
          ${status === 'inactive' ? 'bg-gray-500' : ''}
          ${status === 'leave' ? 'bg-yellow-500' : ''}
          ${status === 'td' ? 'bg-blue-500' : ''}
          ${status === 'hospital' ? 'bg-red-500' : ''}
          ${status === 'course' ? 'bg-purple-500' : ''}
          ${status === 'attachment' ? 'bg-orange-500' : ''}
        `}
      />
      {STAFF_STATUS_LABELS[status]}
    </span>
  );
};

export default StaffStatusBadge;