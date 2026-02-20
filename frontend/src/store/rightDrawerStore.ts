import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RightDrawerState {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useRightDrawerStore = create<RightDrawerState>()(
  persist(
    (set) => ({
      open: false, // по умолчанию панель закрыта
      openDrawer: () => set({ open: true }),
      closeDrawer: () => set({ open: false }),
      toggleDrawer: () => set((s) => ({ open: !s.open })),
    }),
    { name: 'right-chat-panel' }
  )
);
