import React from 'react';

type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface StatusBadgeProps {
  status: StatusType;
  text: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
  // Base ERP styling: uppercase, small text, tracking wide, sharp corners
  const baseClasses = "px-2 py-1 text-[11px] font-bold uppercase tracking-wider rounded-sm border";

  // Military & Status color mappings based on our tailwind.config.js
  const colorClasses = {
    success: "bg-[#F0FDF4] text-status-success border-status-success/40",
    warning: "bg-[#FFFBEB] text-status-warning border-status-warning/40",
    danger: "bg-[#FEF2F2] text-status-danger border-status-danger/40",
    info: "bg-[#EFF6FF] text-status-info border-status-info/40",
    default: "bg-slate-100 text-slate-700 border-slate-300",
  };

  return (
    <span className={`${baseClasses} ${colorClasses[status]}`}>
      {text}
    </span>
  );
};