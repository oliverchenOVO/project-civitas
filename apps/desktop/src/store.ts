import { create } from 'zustand';
export type Page = 'City' | 'Citizens' | 'Companies' | 'Events' | 'Government';
interface Presentation {
  citizenFilter: string;
  page: Page;
  selected?: { kind: 'citizen' | 'company' | 'household'; id: string };
  notice: string;
  setPage: (page: Page) => void;
  select: (kind: 'citizen' | 'company' | 'household', id: string) => void;
  notify: (message: string) => void;
}
export const usePresentation = create<Presentation>((set) => ({
  citizenFilter: 'alive',
  page: 'City',
  notice: '',
  setPage: (page) => set({ page }),
  select: (kind, id) => set({ selected: { kind, id } }),
  notify: (notice) => set({ notice }),
}));
