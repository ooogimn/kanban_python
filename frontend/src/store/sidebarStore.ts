import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: 'sidebar-state' }
  )
);

/** Ширина сайдбара в Tailwind: развёрнут = 18rem (72), свёрнут = 5rem (20) */
export const SIDEBAR_WIDTH_EXPANDED = 72;  // w-72 = 18rem
export const SIDEBAR_WIDTH_COLLAPSED = 20; // w-20 = 5rem
