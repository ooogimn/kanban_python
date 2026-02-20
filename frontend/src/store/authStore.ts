import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../api/auth';
import { apiClient } from '../api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  telegramLogin: (data: any) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  init: () => {
    const token = apiClient.getToken();
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, isAuthenticated: true });
      } catch {
        localStorage.removeItem('user');
        apiClient.clearTokens();
      }
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login({ username, password });
      apiClient.setTokens({ access: response.access, refresh: response.refresh });
      localStorage.setItem('user', JSON.stringify(response.user));
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  telegramLogin: async (data: any) => {
    set({ isLoading: true });
    try {
      const response = await authApi.telegramLogin(data);
      apiClient.setTokens({ access: response.access, refresh: response.refresh });
      localStorage.setItem('user', JSON.stringify(response.user));
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    apiClient.clearTokens();
    localStorage.removeItem('user');
    set({
      user: null,
      isAuthenticated: false,
    });
  },

  setUser: (user: User | null) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
    set({ user, isAuthenticated: !!user });
  },
}));
