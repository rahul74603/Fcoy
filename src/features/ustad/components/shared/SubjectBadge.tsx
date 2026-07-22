// ============================================
// SUBJECT BADGE COMPONENT
// ============================================

import React from 'react';

interface Props {
  name: string;
  code?: string;
  onRemove?: () => void;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const COLOR_MAP = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  red: 'bg-red-100 text-red-800 border-red-200',
};

const SubjectBadge: React.FC<Props> = ({
  name,
  code,
  onRemove,
  color = 'blue',
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-1
        text-xs font-medium rounded-full border
        ${COLOR_MAP[color]}
      `}
    >
      {code && (
        <span className="font-bold">{code}</span>
      )}
      {name}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:opacity-70 transition-opacity"
          title="Remove"
        >
          ✕
        </button>
      )}
    </span>
  );
};

export default SubjectBadge;