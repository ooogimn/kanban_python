import api from './client';
import { LoginCredentials, AuthTokens, User, UserProfile, UserProfileUpdate, TelegramAuthData } from '../types';

export interface RegisterData {
  username: string;
  password: string;
  email: string;
  telegram_contact: string; // @username или +79991234567
  invite_token?: string; // при регистрации по приглашению
}

export interface InviteTokenInfo {
  email: string;
  workspace_name: string;
  contact_name: string;
  valid: boolean;
}

export interface PasswordResetRequest {
  identifier: string; // username, email или @telegram_username
}

export interface PasswordResetConfirm {
  session_id: number;
  code: string;
  new_password: string;
}

export interface PasswordChangeRequest {
  new_password: string;
}

export interface PasswordChangeConfirm {
  session_id: number;
  code: string;
}

export interface VerifyCodeData {
  session_id: number;
  code: string;
  telegram_contact: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthTokens & { user: User }> => {
    const response = await api.post('/auth/login/', credentials);
    return response.data;
  },

  telegramLogin: async (data: TelegramAuthData): Promise<AuthTokens & { user: User }> => {
    const response = await api.post('/auth/telegram/', data);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthTokens & { user: User }> => {
    const response = await api.post('/auth/register/', data);
    return response.data;
  },

  getInviteTokenInfo: async (token: string): Promise<InviteTokenInfo> => {
    const response = await api.get<InviteTokenInfo>(`/auth/invite/${token}/`);
    return response.data;
  },

  verifyCode: async (data: VerifyCodeData): Promise<AuthTokens & { user: User }> => {
    const response = await api.post('/auth/verify-code/', data);
    return response.data;
  },

  refreshToken: async (refresh: string): Promise<AuthTokens> => {
    const response = await api.post('/auth/refresh/', { refresh });
    return response.data;
  },

  verifyToken: async (token: string): Promise<boolean> => {
    try {
      await api.post('/auth/verify/', { token });
      return true;
    } catch {
      return false;
    }
  },

  requestPasswordReset: async (data: PasswordResetRequest): Promise<{ message: string; session_id: number; expires_at: string }> => {
    const response = await api.post('/auth/password-reset/request/', data);
    return response.data;
  },

  resetPassword: async (data: PasswordResetConfirm): Promise<AuthTokens & { user: User; message: string }> => {
    const response = await api.post('/auth/password-reset/confirm/', data);
    return response.data;
  },

  requestPasswordChange: async (data: PasswordChangeRequest): Promise<{ message: string; session_id: number; expires_at: string }> => {
    const response = await api.post('/auth/password-change/request/', data);
    return response.data;
  },

  changePassword: async (data: PasswordChangeConfirm): Promise<{ message: string }> => {
    const response = await api.post('/auth/password-change/confirm/', data);
    return response.data;
  },

  /** Личный кабинет: профиль по /api/v1/auth/me/ (apps.auth.urls) */
  _profilePath: '/auth/me/',

  /** Личный кабинет: получить профиль текущего пользователя */
  getProfile: async (): Promise<UserProfile> => {
    const response = await api.get(authApi._profilePath);
    return response.data;
  },

  /** Личный кабинет: обновить профиль */
  updateProfile: async (data: UserProfileUpdate): Promise<UserProfile> => {
    const response = await api.patch(authApi._profilePath, data);
    return response.data;
  },

  /** Завершить онбординг: POST /api/v1/users/finish-onboarding/ */
  finishOnboarding: async (): Promise<UserProfile> => {
    const response = await api.post<UserProfile>('/users/finish-onboarding/');
    return response.data;
  },

  /** Личный кабинет: загрузить аватар (multipart/form-data) */
  uploadAvatar: async (file: File): Promise<UserProfile> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.patch(authApi._profilePath, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Привязка Telegram: получить ссылку для перехода в бота (Deep Link).
   * POST /auth/telegram/link/ без body → { token, link }.
   */
  getTelegramLink: async (): Promise<{ token: string; link: string }> => {
    const response = await api.post<{ token: string; link: string }>('/auth/telegram/link/');
    return response.data;
  },

  /**
   * Привязка Telegram по коду из бота.
   * POST /auth/telegram/link/ с body { code }.
   */
  linkTelegramByCode: async (code: string): Promise<{ detail: string; telegram_id?: number }> => {
    const response = await api.post<{ detail: string; telegram_id?: number }>('/auth/telegram/link/', {
      code: code.trim(),
    });
    return response.data;
  },
};
