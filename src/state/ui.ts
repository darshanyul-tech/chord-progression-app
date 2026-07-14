import { create } from 'zustand';
import { DEFAULT_TOPIC_ID } from '../topics/registry';

interface UIState {
  drawerOpen: boolean;
  examActive: boolean;
  lastActiveTopicId: string;
  openDrawer(): void;
  closeDrawer(): void;
  toggleDrawer(): void;
  setExamActive(active: boolean): void;
  setLastActiveTopicId(id: string): void;
}

// Ephemeral UI state — drawer, exam lock, active-topic tracking (01-architecture §5).
export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  examActive: false,
  lastActiveTopicId: DEFAULT_TOPIC_ID,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  setExamActive: (active) => set({ examActive: active }),
  setLastActiveTopicId: (id) => set({ lastActiveTopicId: id }),
}));
