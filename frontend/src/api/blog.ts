import api from './client';

export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
}

export interface BlogTag {
  id: number;
  name: string;
  slug: string;
}

export interface BlogPostListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  image_url: string | null;
  video_url: string | null;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  tag_ids: number[];
  tag_names: string[];
  published_at: string | null;
  views_count: number;
  created_at: string;
}

export interface BlogPostDetail extends BlogPostListItem {
  content: string;
  image: string | null;
  video_url: string | null;
  main_media_autoplay: boolean;
  is_published: boolean;
  tags: { id: number; name: string; slug: string }[];
  updated_at: string;
}

export interface BlogPostsParams {
  search?: string;
  category?: string;
  tags?: string;
}

export const blogApi = {
  /** Список опубликованных постов. Параметры: search, category (slug или id), tags (slug через запятую). */
  getPosts: async (params?: BlogPostsParams): Promise<BlogPostListItem[]> => {
    const response = await api.get<BlogPostListItem[] | { results?: BlogPostListItem[] }>('/blog/posts/', {
      params: params || {},
    });
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray((data as { results?: BlogPostListItem[] }).results)) {
      return (data as { results: BlogPostListItem[] }).results;
    }
    return [];
  },

  /** Список категорий */
  getCategories: async (): Promise<BlogCategory[]> => {
    const response = await api.get<BlogCategory[]>('/blog/categories/');
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },

  /** Список тегов */
  getTags: async (): Promise<BlogTag[]> => {
    const response = await api.get<BlogTag[]>('/blog/tags/');
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },

  /** Детальная страница поста по slug (публичный) */
  getPostBySlug: async (slug: string): Promise<BlogPostDetail> => {
    const response = await api.get<BlogPostDetail>(`/blog/posts/${slug}/`);
    return response.data;
  },
};
