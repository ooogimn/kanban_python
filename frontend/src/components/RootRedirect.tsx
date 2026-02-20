import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Редирект с корня: гость → /landing, залогиненный → /dashboard.
 */
export default function RootRedirect() {
  const { isAuthenticated } = useAuthStore();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/landing'} replace />;
}
