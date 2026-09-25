import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'user' | 'viewer';
}

const roleHierarchy: Record<string, number> = {
  admin: 3,
  user: 2,
  viewer: 1,
};

function hasRequiredRole(userRole: string, requiredRole?: string): boolean {
  if (!requiredRole) return true;
  const userLevel = roleHierarchy[userRole] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, initialized, user } = useAuthStore();
  const location = useLocation();

  if (isLoading || !initialized) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#5E6AD2] mx-auto mb-4" />
          <p className="text-[#A1A1A8] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user && !hasRequiredRole(user.role, requiredRole)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#050505]">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-xl font-semibold text-[#ECECEC] mb-2">Access Denied</h1>
          <p className="text-[#A1A1A8] text-sm mb-4">
            This page requires {requiredRole} privileges or higher.
          </p>
          <div className="text-sm text-[#6B6B73] space-y-1">
            <p>
              Your role: <span className="text-[#ECECEC] font-medium">{user?.role}</span>
            </p>
            <p>
              Required: <span className="text-[#ECECEC] font-medium">{requiredRole}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
