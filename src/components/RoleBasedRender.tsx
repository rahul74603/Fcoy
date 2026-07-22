import React from 'react';

interface RoleBasedRenderProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export const RoleBasedRender = ({ allowedRoles, children }: RoleBasedRenderProps) => {
  const userString = localStorage.getItem('user');

  if (!userString) {
    return null;
  }

  const user = JSON.parse(userString);

  if (allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  return null;
};