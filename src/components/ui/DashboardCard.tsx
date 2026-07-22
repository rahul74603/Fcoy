import React from 'react';

interface DashboardCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  icon,
  children,
  action,
  className = '',
}) => {
  return (
    <div className={`bg-white border border-gray-300 shadow-flat rounded-sm p-5 ${className}`}>
      {/* Card Header */}
      <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-3">
        <div className="flex items-center space-x-3">
          {icon && <span className="text-military-700 flex-shrink-0">{icon}</span>}
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{title}</h3>
        </div>
        {action && <div className="ml-4">{action}</div>}
      </div>
      
      {/* Card Body */}
      <div className="text-gray-700 text-sm">
        {children}
      </div>
    </div>
  );
};