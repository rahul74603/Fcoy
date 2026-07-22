// ============================================
// STAFF CARD COMPONENT
// ============================================

import React from 'react';
import { Staff } from '../../types/staff.types';
import StaffStatusBadge from './StaffStatusBadge';

interface Props {
  staff: Staff;
  onView?: (staff: Staff) => void;
  onEdit?: (staff: Staff) => void;
  onDelete?: (staff: Staff) => void;
  showActions?: boolean;
}

const StaffCard: React.FC<Props> = ({
  staff,
  onView,
  onEdit,
  onDelete,
  showActions = true,
}) => {
  // ─── Avatar Letters ──────────────────────
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Top Row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {staff.photoURL ? (
            <img
              src={staff.photoURL}
              alt={staff.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
              {getInitials(staff.name)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm truncate">
                {staff.rank} {staff.name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {staff.forceNumber}
              </p>
            </div>
            <StaffStatusBadge status={staff.status} size="sm" />
          </div>
        </div>
      </div>

            {/* Category Badge - PROMINENT */}
      {staff.category && (
        <div className="mt-2 mb-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full border border-indigo-200">
            🎖️ {staff.category}
          </span>
        </div>
      )}

      {/* Details */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span>🏢</span>
          <span className="truncate font-medium">{staff.company || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span>📱</span>
          <span className="truncate">{staff.mobile || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span>🎓</span>
          <span className="truncate">{staff.experienceYears} yrs</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span>🩸</span>
          <span>{staff.bloodGroup || 'N/A'}</span>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100">
          {onView && (
            <button
              onClick={() => onView(staff)}
              className="flex-1 text-xs text-blue-600 hover:text-blue-800 font-medium py-1 hover:bg-blue-50 rounded transition-colors"
            >
              👁 View
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(staff)}
              className="flex-1 text-xs text-green-600 hover:text-green-800 font-medium py-1 hover:bg-green-50 rounded transition-colors"
            >
              ✏️ Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(staff)}
              className="flex-1 text-xs text-red-600 hover:text-red-800 font-medium py-1 hover:bg-red-50 rounded transition-colors"
            >
              🗑 Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffCard;