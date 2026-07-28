import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-military-950 flex-col">
        <div className="w-10 h-10 border-4 border-military-700 border-t-military-400 rounded-full animate-spin mb-4"></div>
        <div className="text-military-400 font-bold tracking-widest text-xs uppercase">Establishing Secure Connection...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user.isActive) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100 flex-col">
        <ShieldAlert size={48} className="text-status-danger mb-4" />
        <h1 className="text-xl font-black text-military-900 uppercase tracking-widest">Account Disabled</h1>
        <p className="text-sm font-bold text-slate-500 mt-2">Contact Company Commander to reactivate access.</p>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'Company Commander') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100 flex-col">
        <ShieldAlert size={48} className="text-status-danger mb-4" />
        <h1 className="text-xl font-black text-military-900 uppercase tracking-widest">Access Denied</h1>
        <p className="text-sm font-bold text-slate-500 mt-2">You do not have clearance for this module.</p>
      </div>
    );
  }

  return children;
};