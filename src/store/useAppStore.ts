import { create } from 'zustand';
import type { KeyboardLog, FilterState, UIState, ViewMode } from '@/types';
import { sampleData } from '@/data/sampleData';
import type { ImportApplyResult, ValidatedLog } from '@/utils/importExport';
import { applyImport, genNewId } from '@/utils/importExport';

const STORAGE_KEY = 'keyfeeling-logs-v1';

function loadFromStorage(): KeyboardLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
      return sampleData;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return sampleData;
  } catch {
    return sampleData;
  }
}

function saveToStorage(logs: KeyboardLog[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

function genId() {
  return genNewId();
}

interface AppState {
  logs: KeyboardLog[];
  filter: FilterState;
  ui: UIState;
  setFilter: (patch: Partial<FilterState>) => void;
  resetFilter: () => void;
  createLog: (data: Omit<KeyboardLog, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateLog: (id: string, data: Partial<KeyboardLog>) => void;
  deleteLog: (id: string) => void;
  importLogs: (
    selectedForImport: string[],
    fileValidLogs: KeyboardLog[],
    duplicateWithExisting: ValidatedLog[],
    strategy: 'skip' | 'overwrite' | 'regenerate',
  ) => ImportApplyResult;
  setViewMode: (mode: ViewMode) => void;
  toggleCompareSelect: (id: string) => void;
  clearCompareSelect: () => void;
  openFormModal: (log?: KeyboardLog | null) => void;
  closeFormModal: () => void;
  openDetail: (log: KeyboardLog) => void;
  closeDetail: () => void;
  openImportExport: () => void;
  closeImportExport: () => void;
}

const defaultFilter: FilterState = {
  switchType: 'all',
  soundCharacter: 'all',
  minRating: 0,
  searchKeyword: '',
};

const defaultUI: UIState = {
  viewMode: 'list',
  selectedForCompare: [],
  formModalOpen: false,
  editingLog: null,
  detailLog: null,
  importExportModalOpen: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  logs: loadFromStorage(),
  filter: defaultFilter,
  ui: defaultUI,

  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
  resetFilter: () => set({ filter: defaultFilter }),

  createLog: (data) => {
    const now = new Date().toISOString();
    const newLog: KeyboardLog = {
      ...data,
      id: genId(),
      createdAt: now,
      updatedAt: now,
    };
    const next = [newLog, ...get().logs];
    set({ logs: next, ui: { ...get().ui, formModalOpen: false, editingLog: null } });
    saveToStorage(next);
  },

  updateLog: (id, data) => {
    const next = get().logs.map((l) =>
      l.id === id ? { ...l, ...data, updatedAt: new Date().toISOString() } : l,
    );
    set({ logs: next, ui: { ...get().ui, formModalOpen: false, editingLog: null } });
    saveToStorage(next);
  },

  deleteLog: (id) => {
    const next = get().logs.filter((l) => l.id !== id);
    const selected = get().ui.selectedForCompare.filter((sid) => sid !== id);
    set({ logs: next, ui: { ...get().ui, selectedForCompare: selected, detailLog: null } });
    saveToStorage(next);
  },

  importLogs: (selectedForImport, fileValidLogs, duplicateWithExisting, strategy) => {
    const result = applyImport(
      get().logs,
      selectedForImport,
      fileValidLogs,
      duplicateWithExisting,
      strategy,
    );
    set({ logs: result.finalLogs });
    saveToStorage(result.finalLogs);
    return result;
  },

  setViewMode: (mode) => set({ ui: { ...get().ui, viewMode: mode } }),

  toggleCompareSelect: (id) => {
    const cur = get().ui.selectedForCompare;
    let next: string[];
    if (cur.includes(id)) {
      next = cur.filter((x) => x !== id);
    } else if (cur.length >= 2) {
      next = [cur[1], id];
    } else {
      next = [...cur, id];
    }
    set({ ui: { ...get().ui, selectedForCompare: next } });
  },

  clearCompareSelect: () =>
    set({ ui: { ...get().ui, selectedForCompare: [], viewMode: 'list' } }),

  openFormModal: (log) =>
    set({ ui: { ...get().ui, formModalOpen: true, editingLog: log ?? null } }),
  closeFormModal: () => set({ ui: { ...get().ui, formModalOpen: false, editingLog: null } }),

  openDetail: (log) => set({ ui: { ...get().ui, detailLog: log } }),
  closeDetail: () => set({ ui: { ...get().ui, detailLog: null } }),

  openImportExport: () => set({ ui: { ...get().ui, importExportModalOpen: true } }),
  closeImportExport: () => set({ ui: { ...get().ui, importExportModalOpen: false } }),
}));

export function useFilteredLogs(): KeyboardLog[] {
  const { logs, filter } = useAppStore();
  const { switchType, soundCharacter, minRating, searchKeyword } = filter;
  const kw = searchKeyword.trim().toLowerCase();
  return logs.filter((log) => {
    if (switchType !== 'all' && log.switchType !== switchType) return false;
    if (soundCharacter !== 'all' && log.soundCharacter !== soundCharacter) return false;
    if (log.overallRating < minRating) return false;
    if (kw) {
      const haystack = [
        log.name,
        log.brand,
        log.model,
        log.switchName,
        log.notes,
        log.keycapProcess,
        ...log.soundTags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    return true;
  });
}
