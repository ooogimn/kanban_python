/**
 * API рекламной сети — слоты sidebar, footer_col_1..3.
 */
import api from './client';

export interface AdItem {
  id: number;
  title: string;
  slot: string;
  content_type: 'image' | 'html' | 'video';
  image: string | null;
  image_url: string | null;
  video_url: string | null;
  html_code: string;
  link: string;
}

export interface AdsGrouped {
  sidebar: AdItem[];
  footer_col_1: AdItem[];
  footer_col_2: AdItem[];
  footer_col_3: AdItem[];
  blog_content: AdItem[];
}

export interface PublicMarketingSettings {
  brand_name: string;
  public_site_url: string;
  yandex_webmaster_verification: string;
  yandex_metrika_counter_id: string;
  yandex_metrika_tag: string;
  google_analytics_measurement_id: string;
  google_tag_manager_id: string;
  yandex_rsy_site_id: string;
  yandex_rsy_block_id: string;
  yandex_rsy_script: string;
  custom_head_html: string;
  custom_body_html: string;
  landing_media_categories: string[];
  landing_media_carousel: Array<{
    id?: string;
    category: string;
    title?: string;
    description?: string;
    media_type: 'image' | 'video';
    media_url: string;
  }>;
  landing_portal_cards: Array<{
    name: string;
    desc: string;
    href: string;
    image: string;
  }>;
  landing_plan_styles: Array<{
    plan_name: string;
    border_color: string;
    glow_color: string;
  }>;
  default_landing_category: string;
  landing_default_version: 'v1' | 'v2' | string;
  landing_private_reviews: Array<{
    author: string;
    text: string;
    avatar?: string;
  }>;
  landing_company_reviews: Array<{
    company: string;
    text: string;
    logo: string;
  }>;
  landing_ai_canned_responses: Array<{
    keywords: string[];
    answer: string;
  }>;
  landing_ai_fallback_reply: string;
  landing_plans: Array<{
    id: number;
    name: string;
    price: string;
    currency: string;
    limits: Record<string, unknown>;
    is_default: boolean;
  }>;
}

export interface MyMarketingRequests {
  leads: Array<{
    id: string;
    name: string;
    contact: string;
    message?: string;
    source?: string;
    status?: string;
    created_at?: string;
  }>;
  reviews: Array<{
    id: string;
    review_type: 'private' | 'company';
    author?: string;
    company?: string;
    text: string;
    avatar_or_logo?: string;
    status?: string;
    created_at?: string;
  }>;
  chats: Array<{
    id: string;
    session_id: string;
    role: 'user' | 'assistant';
    message: string;
    created_at?: string;
    user_id?: number | null;
    user_username?: string;
  }>;
}

export const marketingApi = {
  getAds: async (): Promise<AdsGrouped> => {
    const { data } = await api.get<AdsGrouped>('/marketing/');
    return data;
  },

  getPublicSettings: async (): Promise<PublicMarketingSettings> => {
    const { data } = await api.get<PublicMarketingSettings>('/marketing/settings/');
    return data;
  },

  submitLead: async (payload: { name: string; contact: string; message?: string; source?: string }): Promise<{ ok: boolean }> => {
    const { data } = await api.post<{ ok: boolean }>('/marketing/lead/', payload);
    return data;
  },

  submitReview: async (payload: {
    review_type: 'private' | 'company';
    author?: string;
    company?: string;
    text: string;
    avatar_or_logo?: string;
  }): Promise<{ ok: boolean }> => {
    const { data } = await api.post<{ ok: boolean }>('/marketing/review/', payload);
    return data;
  },

  getMyRequests: async (): Promise<MyMarketingRequests> => {
    const { data } = await api.get<MyMarketingRequests>('/marketing/my-requests/');
    return data;
  },

  chat: async (payload: { message: string; session_id?: string }): Promise<{
    session_id: string;
    assistant_message: string;
    matched_canned: boolean;
  }> => {
    const { data } = await api.post('/marketing/chat/', payload);
    return data;
  },

  getChatHistory: async (sessionId: string): Promise<Array<{
    id: string;
    session_id: string;
    role: 'user' | 'assistant';
    message: string;
    created_at?: string;
  }>> => {
    const { data } = await api.get<{ messages: Array<{
      id: string;
      session_id: string;
      role: 'user' | 'assistant';
      message: string;
      created_at?: string;
    }> }>('/marketing/chat/history/', { params: { session_id: sessionId } });
    return Array.isArray(data?.messages) ? data.messages : [];
  },
};
