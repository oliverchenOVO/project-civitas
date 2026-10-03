import { create } from 'zustand';
export type Page =
  'City' | 'Citizens' | 'Companies' | 'Events' | 'Government' | 'Metrics' | 'History' | 'Scenarios';
export interface Selection {
  kind: 'citizen' | 'company' | 'household' | 'district' | 'metric' | 'event';
  id: string;
  trace?: 'causes' | 'effects';
  window?: number;
  explained?: boolean;
}
export interface AffectedOverlay {
  label: string;
  refs: { kind: 'citizen' | 'company' | 'household' | 'district'; id: string }[];
  mode: 'all' | 'citizen' | 'company' | 'household';
}
export interface HistoryFilters {
  year: number;
  category: string;
  district: string;
  entityType: string;
  limit: number;
}
interface Context {
  page: Page;
  selected?: Selection;
  overlay?: AffectedOverlay;
  historyFilters?: HistoryFilters;
  scroll: { main: number; window: number; inspector: number };
}
function context(s: Presentation): Context {
  return {
    page: s.page,
    selected: s.selected,
    overlay: s.overlay,
    historyFilters: s.historyFilters,
    scroll: {
      main:
        typeof document === 'undefined'
          ? 0
          : (document.querySelector('.main-view')?.scrollTop ?? 0),
      window: typeof window === 'undefined' ? 0 : window.scrollY,
      inspector:
        typeof document === 'undefined'
          ? 0
          : (document.querySelector('.inspector')?.scrollTop ?? 0),
    },
  };
}
interface Presentation {
  citizenFilter: string;
  page: Page;
  selected?: Selection;
  overlay?: AffectedOverlay;
  historyFilters?: HistoryFilters;
  stack: Context[];
  navigationRevision: number;
  scroll: { main: number; window: number; inspector: number };
  back: () => void;
  trace: (direction: 'causes' | 'effects') => void;
  metricOptions: (options: { window?: number; explained?: boolean }) => void;
  focusMap: () => void;
  setOverlay: (overlay?: AffectedOverlay) => void;
  notice: string;
  setPage: (page: Page) => void;
  select: (kind: Selection['kind'], id: string) => void;
  notify: (message: string) => void;
}
export const usePresentation = create<Presentation>((set, get) => ({
  citizenFilter: 'alive',
  page: 'City',
  notice: '',
  stack: [],
  navigationRevision: 0,
  scroll: { main: 0, window: 0, inspector: 0 },
  metricOptions: (options) =>
    set((s) => ({
      selected: s.selected?.kind === 'metric' ? { ...s.selected, ...options } : s.selected,
    })),
  back: () => {
    const stack = [...get().stack];
    const context = stack.pop();
    if (context) set({ ...context, stack, navigationRevision: get().navigationRevision + 1 });
  },
  trace: (trace) => {
    const s = get();
    if (s.selected?.kind === 'event')
      set({
        selected: { ...s.selected, trace },
        stack: [...s.stack, context(s)].slice(-50),
        navigationRevision: s.navigationRevision + 1,
        scroll: { main: 0, window: 0, inspector: 0 },
      });
  },
  focusMap: () => {
    const s = get();
    set({
      page: 'City',
      stack: [...s.stack, context(s)].slice(-50),
      navigationRevision: s.navigationRevision + 1,
      scroll: { main: 0, window: 0, inspector: 0 },
    });
  },
  setOverlay: (overlay) => set({ overlay }),
  setPage: (page) => {
    const s = get();
    set({
      page,
      stack: [...s.stack, context(s)].slice(-50),
      navigationRevision: s.navigationRevision + 1,
      scroll: { main: 0, window: 0, inspector: 0 },
    });
  },
  select: (kind, id) => {
    const s = get();
    set({
      selected: { kind, id },
      page:
        kind === 'metric' || kind === 'event' ? 'Metrics' : s.page === 'Metrics' ? 'City' : s.page,
      stack: [...s.stack, context(s)].slice(-50),
      navigationRevision: s.navigationRevision + 1,
      scroll: { main: 0, window: 0, inspector: 0 },
    });
  },
  notify: (notice) => set({ notice }),
}));
