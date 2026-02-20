/**
 * RBAC: защита маршрутов Finance — только Director/Manager.
 * Employee при переходе по /finance/* перенаправляется на Dashboard.
 */
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

function canSeeFinance(groups?: string[], isSuperuser?: boolean): boolean {
  if (isSuperuser) return true;
  if (!groups || !Array.isArray(groups)) return false;
  return groups.includes('Director') || groups.includes('Manager');
}

interface FinanceProtectedRouteProps {
  children: React.ReactNode;
}

export default function FinanceProtectedRoute({ children }: FinanceProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
    enabled: !!user && isAuthenticated,
  });

  const groups = profile?.groups ?? user?.groups ?? [];
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[320px] text-slate-500 dark:text-slate-400">
        Загрузка…
      </div>
    );
  }

  if (!canSeeFinance(groups, profile?.is_superuser)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
