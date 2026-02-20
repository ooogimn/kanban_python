/**
 * Защита маршрутов SaaS Admin — только суперпользователь.
 */
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function SuperUserRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
    enabled: !!user && isAuthenticated,
  });

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

  if (!profile?.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
