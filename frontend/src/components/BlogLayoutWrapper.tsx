import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Layout from './Layout';
import BlogLayout from './BlogLayout';

/**
 * Для /blog и /blog/:slug: авторизованным показываем основной Layout с сайдбаром и контентом блога,
 * неавторизованным — публичный BlogLayout с сайдбаром (Блог, Войти, Регистрация).
 */
export default function BlogLayoutWrapper() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Layout overrideContent={<Outlet />} />;
  }

  return <BlogLayout />;
}
