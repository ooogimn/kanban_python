/**
 * Глобальное состояние модалки «Улучшите тариф» (SaaS Sprint 2).
 * Открывается при 403 с кодом LIMIT_REACHED или FEATURE_LOCKED.
 */
import { create } from 'zustand';

export type UpgradeModalCode = 'LIMIT_REACHED' | 'FEATURE_LOCKED' | null;

interface UpgradeModalState {
  open: boolean;
  code: UpgradeModalCode;
  detail: string | null;
  openModal: (code: UpgradeModalCode, detail?: string | null) => void;
  closeModal: () => void;
}

export const useUpgradeModalStore = create<UpgradeModalState>((set) => ({
  open: false,
  code: null,
  detail: null,
  openModal: (code, detail = null) => set({ open: true, code, detail }),
  closeModal: () => set({ open: false, code: null, detail: null }),
}));
