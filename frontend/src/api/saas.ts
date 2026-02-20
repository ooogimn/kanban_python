/**
 * SaaS Super Admin API — только для суперпользователя.
 */
import api from './client';

export interface SaasStats {
  total_users: number;
  active_workspaces: number;
  mrr: string;
  registrations: Array<{ month: string | null; count: number }>;
}

export interface SaasPlan {
  id: number;
  name: string;
  price: string;
  currency: string;
  limits: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaasPlanCreateUpdate {
  name: string;
  price: string | number;
  currency?: string;
  limits: Record<string, unknown>;
  is_active?: boolean;
  is_default?: boolean;
}

export interface SaasUserListItem {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  workspace_count: number;
  date_joined: string | null;
  force_business_plan?: boolean;
  hide_ads?: boolean;
}

export interface SaasUserEvent {
  id: number;
  event_type: string;
  created_at: string;
  details: Record<string, unknown>;
  amount: string | null;
}

export const saasApi = {
  getStats: async (): Promise<SaasStats> => {
    const response = await api.get('/saas/dashboard/stats/');
    return response.data;
  },

  getPlans: async (): Promise<SaasPlan[]> => {
    const response = await api.get('/saas/plans/');
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },

  getPlan: async (id: number): Promise<SaasPlan> => {
    const response = await api.get(`/saas/plans/${id}/`);
    return response.data;
  },

  createPlan: async (data: SaasPlanCreateUpdate): Promise<SaasPlan> => {
    const response = await api.post('/saas/plans/', data);
    return response.data;
  },

  updatePlan: async (id: number, data: Partial<SaasPlanCreateUpdate>): Promise<SaasPlan> => {
    const response = await api.patch(`/saas/plans/${id}/`, data);
    return response.data;
  },

  deletePlan: async (id: number): Promise<void> => {
    await api.delete(`/saas/plans/${id}/`);
  },

  getUsers: async (): Promise<SaasUserListItem[]> => {
    const response = await api.get('/saas/users/');
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },

  getUser: async (id: number): Promise<SaasUserListItem> => {
    const response = await api.get(`/saas/users/${id}/`);
    return response.data;
  },

  manageAccess: async (userId: number, forceBusiness: boolean): Promise<{ force_business_plan: boolean }> => {
    const response = await api.patch(`/saas/users/${userId}/manage-access/`, { force_business: forceBusiness });
    return response.data;
  },

  manageAds: async (userId: number, hideAds: boolean): Promise<{ hide_ads: boolean }> => {
    const response = await api.patch(`/saas/users/${userId}/manage-ads/`, { hide_ads: hideAds });
    return response.data;
  },

  getUserEvents: async (userId: number): Promise<SaasUserEvent[]> => {
    const response = await api.get(`/saas/users/${userId}/events/`);
    return response.data;
  },

  addPayment: async (userId: number, amount: number, details?: Record<string, unknown>): Promise<SaasUserEvent> => {
    const response = await api.post(`/saas/users/${userId}/add-payment/`, { amount, details: details ?? {} });
    return response.data;
  },

  banUser: async (userId: number): Promise<{ is_active: boolean }> => {
    const response = await api.post(`/saas/users/${userId}/ban/`);
    return response.data;
  },

  impersonate: async (userId: number): Promise<{ access: string; refresh: string }> => {
    const response = await api.post(`/saas/users/${userId}/impersonate/`);
    return response.data;
  },

  getBlogCategories: async (): Promise<SaasBlogCategory[]> => {
    const response = await api.get('/saas/blog/categories/');
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },
  getBlogCategory: async (id: number): Promise<SaasBlogCategory> => {
    const response = await api.get(`/saas/blog/categories/${id}/`);
    return response.data;
  },
  createBlogCategory: async (data: { name: string; slug?: string; sort_order?: number }): Promise<SaasBlogCategory> => {
    const response = await api.post('/saas/blog/categories/', data);
    return response.data;
  },
  updateBlogCategory: async (id: number, data: Partial<SaasBlogCategory>): Promise<SaasBlogCategory> => {
    const response = await api.patch(`/saas/blog/categories/${id}/`, data);
    return response.data;
  },
  deleteBlogCategory: async (id: number): Promise<void> => {
    await api.delete(`/saas/blog/categories/${id}/`);
  },
  getBlogTags: async (): Promise<SaasBlogTag[]> => {
    const response = await api.get('/saas/blog/tags/');
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },
  createBlogTag: async (data: { name: string; slug?: string }): Promise<SaasBlogTag> => {
    const response = await api.post('/saas/blog/tags/', data);
    return response.data;
  },
  updateBlogTag: async (id: number, data: Partial<SaasBlogTag>): Promise<SaasBlogTag> => {
    const response = await api.patch(`/saas/blog/tags/${id}/`, data);
    return response.data;
  },
  deleteBlogTag: async (id: number): Promise<void> => {
    await api.delete(`/saas/blog/tags/${id}/`);
  },
  getBlogPosts: async (): Promise<SaasBlogPost[]> => {
    const response = await api.get('/saas/blog/posts/');
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },
  getBlogPost: async (id: number): Promise<SaasBlogPost> => {
    const response = await api.get(`/saas/blog/posts/${id}/`);
    return response.data;
  },
  createBlogPost: async (data: FormData | SaasBlogPostCreate): Promise<SaasBlogPost> => {
    const response = await api.post('/saas/blog/posts/', data);
    return response.data;
  },
  updateBlogPost: async (id: number, data: FormData | Partial<SaasBlogPostCreate>): Promise<SaasBlogPost> => {
    const response = await api.patch(`/saas/blog/posts/${id}/`, data);
    return response.data;
  },
  deleteBlogPost: async (id: number): Promise<void> => {
    await api.delete(`/saas/blog/posts/${id}/`);
  },
  /** Загрузка изображения/видео для вставки в контент поста. Возвращает { url }. */
  uploadBlogMedia: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post('/saas/blog/posts/upload-media/', form);
    return response.data;
  },

  getAds: async (): Promise<SaasAd[]> => {
    const response = await api.get('/saas/ads/');
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },
  getAd: async (id: number): Promise<SaasAd> => {
    const response = await api.get(`/saas/ads/${id}/`);
    return response.data;
  },
  createAd: async (data: FormData | SaasAdCreate): Promise<SaasAd> => {
    const response = await api.post('/saas/ads/', data);
    return response.data;
  },
  updateAd: async (id: number, data: FormData | Partial<SaasAdCreate>): Promise<SaasAd> => {
    const response = await api.patch(`/saas/ads/${id}/`, data);
    return response.data;
  },
  deleteAd: async (id: number): Promise<void> => {
    await api.delete(`/saas/ads/${id}/`);
  },
};

export interface SaasBlogCategory {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

export interface SaasBlogTag {
  id: number;
  name: string;
  slug: string;
}

export interface SaasBlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string | null;
  image_url: string | null;
  video_url?: string | null;
  main_media_autoplay?: boolean;
  category: number | null;
  category_name: string | null;
  tag_ids: number[];
  is_published: boolean;
  published_at: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface SaasBlogPostCreate {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  category?: number | null;
  tag_ids?: number[];
  is_published?: boolean;
  published_at?: string | null;
  main_media_autoplay?: boolean;
}

export interface SaasAd {
  id: number;
  title: string;
  slot: string;
  content_type: string;
  image: string | null;
  image_url: string | null;
  video_url: string | null;
  html_code: string;
  link: string;
  is_active: boolean;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SaasAdCreate {
  title: string;
  slot: string;
  content_type: string;
  html_code?: string;
  link?: string;
  is_active?: boolean;
  width?: number | null;
  height?: number | null;
  sort_order?: number;
}
