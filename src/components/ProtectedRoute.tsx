import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'venue_owner' | 'dj' | 'bartender' | 'guest')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Platform admins can access any role-gated route
  if (allowedRoles && role && role !== 'admin' && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
