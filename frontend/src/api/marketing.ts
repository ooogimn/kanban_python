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

export const marketingApi = {
  getAds: async (): Promise<AdsGrouped> => {
    const { data } = await api.get<AdsGrouped>('/marketing/');
    return data;
  },
};
