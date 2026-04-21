import { create } from 'zustand';
import { 
  ParsedLine, FileMetadata, ParseStatus, HistoryItem, 
  AppSettings, ParseProfile, TextLine, CatalogProduct, User, MemoryItem,
  BatchJob, ToastState, ToastType
} from '../types';
import { EzequoteProfile } from '../services/profiles';

interface AppState {
  currentUser: User | null;
  data: ParsedLine[];
  rawTextLines: TextLine[];
  metadata: FileMetadata | null;
  jobNotes: string;
  status: ParseStatus;
  catalog: CatalogProduct[];
  learnedMappings: Map<string, MemoryItem>;
  loadingProgress: number;
  loadingMessage: string;
  documents: any[];
  activeDocId: string | null;
  currentView: 'upload' | 'table' | 'history' | 'dashboard';
  settings: AppSettings;
  activeProfile: ParseProfile;
  profileConfidence: number;
  activeRowId: string | null;
  inspectRow: ParsedLine | null;
  history: HistoryItem[];
  undoStack: ParsedLine[][];
  redoStack: ParsedLine[][];
  toast: ToastState | null;
  batchQueue: BatchJob[];

  // Actions
  setCurrentUser: (user: User | null) => void;
  setData: (data: ParsedLine[] | ((prev: ParsedLine[]) => ParsedLine[]), skipUndo?: boolean) => void;
  undo: () => void;
  redo: () => void;
  setRawTextLines: (lines: TextLine[]) => void;
  setMetadata: (metadata: FileMetadata | null) => void;
  setJobNotes: (notes: string) => void;
  setStatus: (status: ParseStatus) => void;
  setCatalog: (catalog: CatalogProduct[]) => void;
  setLearnedMappings: (mappings: Map<string, MemoryItem>) => void;
  setLoadingProgress: (progress: number) => void;
  setLoadingMessage: (message: string) => void;
  setDocuments: (docs: any[]) => void;
  setActiveDocId: (id: string | null) => void;
  setCurrentView: (view: 'upload' | 'table' | 'history' | 'dashboard') => void;
  setSettings: (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  setActiveProfile: (profile: ParseProfile) => void;
  setProfileConfidence: (confidence: number) => void;
  setActiveRowId: (id: string | null) => void;
  setInspectRow: (row: ParsedLine | null) => void;
  setHistory: (history: HistoryItem[]) => void;
  showToast: (message: string, type?: ToastType) => void;
  setBatchQueue: (queue: BatchJob[] | ((prev: BatchJob[]) => BatchJob[])) => void;
  updateBatchJob: (id: string, updates: Partial<BatchJob>) => void;
}

export const useStore = create<AppState>((set) => ({
  currentUser: null,
  data: [],
  rawTextLines: [],
  metadata: null,
  jobNotes: '',
  status: 'idle',
  catalog: [],
  learnedMappings: new Map(),
  loadingProgress: 0,
  loadingMessage: '',
  documents: [],
  activeDocId: null,
  currentView: 'upload',
  settings: {
    darkMode: false,
    themeColor: 'green',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    companyName: 'Bone Timber',
    logoUrl: null,
    isTableLocked: false,
    uiPreferences: {
      showHeaderMetrics: true,
      showJobNotes: true,
      showCatalogMapping: true,
      showContinuedBadges: true,
      showPdfPreview: true,
      showGroupControl: true,
      showColumnsControl: true,
      showExportControl: true,
      showAddControl: true
    },
    tableColumnWidths: {}
  },
  activeProfile: EzequoteProfile,
  profileConfidence: 0,
  activeRowId: null,
  inspectRow: null,
  history: [],
  undoStack: [],
  redoStack: [],
  toast: null,
  batchQueue: [],

  setCurrentUser: (user) => set({ currentUser: user }),
  setData: (data, skipUndo = false) => set((state) => {
    const newData = typeof data === 'function' ? data(state.data) : data;
    const filteredData = newData.filter(row => !!row);
    
    if (skipUndo) return { data: filteredData };
    
    // Save current state to undo stack
    const newUndoStack = [...state.undoStack, state.data].slice(-50); // Limit to 50 undos
    return { 
      data: filteredData,
      undoStack: newUndoStack,
      redoStack: [] // Clear redo stack on new change
    };
  }),
  undo: () => set((state) => {
    if (state.undoStack.length === 0) return {};
    const prevData = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    const newRedoStack = [...state.redoStack, state.data];
    return {
      data: prevData,
      undoStack: newUndoStack,
      redoStack: newRedoStack
    };
  }),
  redo: () => set((state) => {
    if (state.redoStack.length === 0) return {};
    const nextData = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);
    const newUndoStack = [...state.undoStack, state.data];
    return {
      data: nextData,
      undoStack: newUndoStack,
      redoStack: newRedoStack
    };
  }),
  setRawTextLines: (lines) => set({ rawTextLines: lines }),
  setMetadata: (metadata) => set({ metadata }),
  setJobNotes: (notes) => set({ jobNotes: notes }),
  setStatus: (status) => set({ status }),
  setCatalog: (catalog) => set({ catalog }),
  setLearnedMappings: (mappings) => set({ learnedMappings: mappings }),
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  setLoadingMessage: (message) => set({ loadingMessage: message }),
  setDocuments: (docs) => set({ documents: docs }),
  setActiveDocId: (id) => set({ activeDocId: id }),
  setCurrentView: (view) => set({ currentView: view }),
  setSettings: (settings) => set((state) => ({ 
    settings: typeof settings === 'function' ? settings(state.settings) : settings 
  })),
  setActiveProfile: (profile) => set({ activeProfile: profile }),
  setProfileConfidence: (confidence) => set({ profileConfidence: confidence }),
  setActiveRowId: (id) => set({ activeRowId: id }),
  setInspectRow: (row) => set({ inspectRow: row }),
  setHistory: (history) => set({ history }),
  showToast: (message, type = 'info') => {
    const id = crypto.randomUUID();
    set({ toast: { message, type, id } });
    setTimeout(() => {
      set(state => state.toast?.id === id ? { toast: null } : {});
    }, 4000);
  },
  setBatchQueue: (queue) => set((state) => ({ 
    batchQueue: typeof queue === 'function' ? queue(state.batchQueue) : queue 
  })),
  updateBatchJob: (id, updates) => set((state) => ({
    batchQueue: state.batchQueue.map(job => job.id === id ? { ...job, ...updates } : job)
  }))
}));
