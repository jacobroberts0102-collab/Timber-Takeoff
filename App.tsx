import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CommandBar } from './components/CommandBar';
import { SiteMode } from './components/SiteMode';
import { 
  Table, History, Settings, FileText, 
  LogOut, Loader2, BarChart3, Sun, Moon, HelpCircle, Scissors, Mic, Smartphone, Plus, Menu, Split as SplitIcon, RotateCcw
} from 'lucide-react';

import { AnnotationsModal } from './components/AnnotationsModal';
import { Annotation } from './types';
import { Toast } from './components/Toast';
import { FileUpload } from './components/FileUpload';
import { BatchQueue } from './components/BatchQueue';
import { StatsCards, JobNotesCard } from './components/StatsCards';
import { PreviewTable } from './components/PreviewTable';
import { HistoryView } from './components/HistoryView';
import { CuttingListOptimizer } from './components/CuttingListOptimizer';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { PdfViewer } from './components/PdfViewer';
import { ExcelViewer } from './components/ExcelViewer';
import { JobHeader } from './components/JobHeader';
import { ParsingInspector } from './components/ParsingInspector';
import { UserSplashScreen } from './components/UserSplashScreen';
import { GuideModal } from './components/GuideModal';
import { OCRModal } from './components/OCRModal';
import { CollaborationProvider } from './components/CollaborationProvider';

import { aiProfileService } from './services/aiProfileService';
import { profileService } from './services/profiles';
import { Dashboard } from './components/Dashboard';
import { VerificationView } from './components/VerificationView';
import { motion, AnimatePresence } from 'motion/react';

// Services
import { extractTextFromPdf } from './services/pdfService';
import { extractTextFromExcel } from './services/excelService';
import { extractContactDetails, applyMappingToRow, normalizeUnit } from './services/parser';
import { buildLookupKey, normalizeWhitespace } from './utils/learnedKey';
import { storageService, enrichCatalogProduct } from './services/storage';
import { safeRegex } from './utils/regex';
import { runSmartAiMatch } from './services/aiMatcher';
import { detectProfile } from './services/profiles';
import { learningService } from './services/learningService';
import { computePineWastage } from './services/pineWastage';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Store
import { useStore } from './store/useStore';

// Types
import { 
  ParsedLine, FileMetadata, HistoryItem, 
  AppSettings, ParseProfile, TextLine, KPIStats, User, UiPreferences, AppTheme, MemoryItem
} from './types';

// Default UI Preferences
const DEFAULT_UI_PREFS: UiPreferences = {
  showHeaderMetrics: true,
  showJobNotes: true,
  showCatalogMapping: true,
  showContinuedBadges: true,
  showPdfPreview: true,
  showGroupControl: true,
  showColumnsControl: true,
  showExportControl: true,
  showAddControl: true
};

// Default Settings
const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  themeColor: 'green',
  fontFamily: 'Arial, sans-serif',
  fontSize: '14px',
  companyName: 'Bone Timber',
  logoUrl: null, 
  isTableLocked: false,
  uiPreferences: DEFAULT_UI_PREFS,
  tableColumnWidths: {}
};

const TIMBER_PUNS = [
  "Getting things ready...",
  "Double-checking the numbers...",
  "Gathering the details...",
  "Organizing your list...",
  "Preparing the workspace...",
  "Scanning your document...",
  "Looking for measurements...",
  "Sorting the items...",
  "Almost there...",
  "Just a few more seconds...",
  "Polishing the final list...",
  "Double-checking for accuracy...",
  "Making everything neat and tidy...",
  "Preparing your project report...",
  "Loading your data...",
  "Nearly finished..."
];

const THEME_MAP: Record<AppTheme, { bg: string, shadow: string, text: string, border: string }> = {
  blue: { bg: 'bg-blue-600', shadow: 'shadow-blue-500/20', text: 'text-blue-600', border: 'border-blue-500' },
  green: { bg: 'bg-emerald-600', shadow: 'shadow-emerald-500/20', text: 'text-emerald-600', border: 'border-emerald-500' },
  orange: { bg: 'bg-orange-500', shadow: 'shadow-orange-500/20', text: 'text-orange-500', border: 'border-orange-500' },
  red: { bg: 'bg-red-600', shadow: 'shadow-red-500/20', text: 'text-red-600', border: 'border-red-500' },
  slate: { bg: 'bg-slate-700', shadow: 'shadow-slate-500/20', text: 'text-slate-700', border: 'border-slate-600' },
};

interface SourceDocument {
    id: string;
    name: string;
    url: string;
    file: File;
    type: 'pdf' | 'excel';
    pageOffset: number; 
    pageCount: number;
}

export default function App() {
  const currentUser = useStore(state => state.currentUser);
  const setCurrentUser = useStore(state => state.setCurrentUser);
  const data = useStore(state => state.data);
  const setData = useStore(state => state.setData);
  const undo = useStore(state => state.undo);
  const redo = useStore(state => state.redo);
  const undoStack = useStore(state => state.undoStack);
  const redoStack = useStore(state => state.redoStack);
  const rawTextLines = useStore(state => state.rawTextLines);
  const setRawTextLines = useStore(state => state.setRawTextLines);
  const metadata = useStore(state => state.metadata);
  const setMetadata = useStore(state => state.setMetadata);
  const jobNotes = useStore(state => state.jobNotes);
  const setJobNotes = useStore(state => state.setJobNotes);
  const status = useStore(state => state.status);
  const setStatus = useStore(state => state.setStatus);
  const catalog = useStore(state => state.catalog);
  const setCatalog = useStore(state => state.setCatalog);
  const learnedMappings = useStore(state => state.learnedMappings);
  const setLearnedMappings = useStore(state => state.setLearnedMappings);
  const loadingProgress = useStore(state => state.loadingProgress);
  const setLoadingProgress = useStore(state => state.setLoadingProgress);
  const loadingMessage = useStore(state => state.loadingMessage);
  const setLoadingMessage = useStore(state => state.setLoadingMessage);
  const documents = useStore(state => state.documents);
  const setDocuments = useStore(state => state.setDocuments);
  const activeDocId = useStore(state => state.activeDocId);
  const setActiveDocId = useStore(state => state.setActiveDocId);
  const currentView = useStore(state => state.currentView);
  const setCurrentView = useStore(state => state.setCurrentView);
  const settings = useStore(state => state.settings);
  const setSettings = useStore(state => state.setSettings);
  const activeProfile = useStore(state => state.activeProfile);
  const setActiveProfile = useStore(state => state.setActiveProfile);
  const setProfileConfidence = useStore(state => state.setProfileConfidence);
  const activeRowId = useStore(state => state.activeRowId);
  const setActiveRowId = useStore(state => state.setActiveRowId);
  const inspectRow = useStore(state => state.inspectRow);
  const setInspectRow = useStore(state => state.setInspectRow);
  const history = useStore(state => state.history);
  const setHistory = useStore(state => state.setHistory);
  const toast = useStore(state => state.toast);
  const showToast = useStore(state => state.showToast);
  const batchQueue = useStore(state => state.batchQueue);
  const setBatchQueue = useStore(state => state.setBatchQueue);
  const updateBatchJob = useStore(state => state.updateBatchJob);

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [annotationRowId, setAnnotationRowId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'profiles' | 'templates' | 'catalog' | 'users' | 'customisation' | 'memory'>('general');
  const [showExport, setShowExport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [isSiteModeOpen, setIsSiteModeOpen] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [ocrFile, setOcrFile] = useState<{ file: File, pageCount: number } | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(33.33); 
  const [isResizing, setIsResizing] = useState(false);
  const [userAdjustedWidth, setUserAdjustedWidth] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const uiPrefs = useMemo(() => ({
      ...DEFAULT_UI_PREFS,
      ...(settings.uiPreferences || {})
  }), [settings.uiPreferences]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Targeted lookup instead of listing all users (reduces read quota usage)
          let found = await storageService.getUser(firebaseUser.uid);
          
          if (!found && firebaseUser.email) {
            found = await storageService.getUserByEmail(firebaseUser.email);
          }

          if (found) {
            setCurrentUser(found);
          } else {
            // Fallback if user document doesn't exist yet (should be handled in splash screen)
            const newUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: 'user',
              avatar: firebaseUser.photoURL || undefined,
              pin: '0000',
              createdAt: Date.now()
            };
            await storageService.saveUser(newUser);
            setCurrentUser(newUser);
          }
        } catch {
          console.warn("Using offline user fallback (Firestore sync skipped/failed)");
          
          // Fallback user from Firebase Auth state if Firestore is offline/quota hit
          const fallbackUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            role: 'user',
            avatar: firebaseUser.photoURL || undefined,
            pin: '0000',
            createdAt: Date.now()
          };
          setCurrentUser(fallbackUser);
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [setCurrentUser]);

  useEffect(() => {
    const loadInit = async () => {
      if (!isAuthReady || !currentUser) return;
      
      try {
        setLoadingMessage('Initializing application...');
        
        // Parallel load of core data
        const [cat, mappingsList, globalBranding, userSetts] = await Promise.all([
            storageService.getCatalog(),
            storageService.getLearnedMappings(),
            storageService.getBranding(),
            storageService.getUserSettings(currentUser.id),
            learningService.seedLearnedMappingsIfMissing() // Also can run in parallel
        ]);

        // 1. Process Catalog
        setCatalog(cat);
        
        // 2. Process Mappings
        const mappingsMap = new Map<string, MemoryItem>();
        mappingsList.forEach(m => {
            mappingsMap.set(m.lookupKey, m);
        });
        setLearnedMappings(mappingsMap);
        
        // 3. Process Branding
        if (globalBranding) {
            setSettings(prev => ({
                ...prev,
                companyName: globalBranding.companyName,
                logoUrl: globalBranding.logoUrl
            }));
        }

        // 4. Process User Settings
        if (userSetts) {
            setSettings(prev => ({
                ...DEFAULT_SETTINGS,
                ...prev, // Keep branding from step above
                ...userSetts,
                uiPreferences: { ...DEFAULT_UI_PREFS, ...(userSetts.uiPreferences || {}) }
            }));
        }

        // 5. Load History
        storageService.getAll(currentUser.id).then(setHistory);
        
      } catch (e) {
        console.error("App initialization failed", e);
      }
    };
    loadInit();
  }, [isAuthReady, currentUser, setCatalog, setHistory, setLearnedMappings, setSettings, setLoadingMessage]);

  useEffect(() => {
    if (currentUser) {
        localStorage.setItem('active_user_id', currentUser.id);
    } else {
        setHistory([]);
        localStorage.removeItem('active_user_id');
    }
  }, [currentUser, setHistory]);

  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    document.documentElement.style.fontSize = settings.fontSize || '14px';
    if (currentUser) {
        storageService.saveUserSettings(currentUser.id, settings);
        if (currentUser.role === 'admin') {
            storageService.saveBranding({
                companyName: settings.companyName,
                logoUrl: settings.logoUrl
            });
        }
    }
  }, [settings, currentUser]);

  // AUTO-ADJUST PDF WIDTH EFFECT
  const handleTotalTableWidthReport = useCallback((requiredTablePx: number) => {
      if (currentView !== 'table' || !splitContainerRef.current || !uiPrefs.showPdfPreview || isResizing || userAdjustedWidth) return;
      
      const totalAvailableWidth = splitContainerRef.current.clientWidth;
      if (totalAvailableWidth <= 0) return;

      const buffer = 48;
      const effectiveTablePx = requiredTablePx + buffer;
      const minTablePct = 30; 
      
      let tablePct = (effectiveTablePx / totalAvailableWidth) * 100;
      tablePct = Math.max(minTablePct, Math.min(80, tablePct));
      
      const newLeftPct = 100 - tablePct;
      
      if (Math.abs(newLeftPct - leftPanelWidth) > 1) {
          setLeftPanelWidth(newLeftPct);
      }
  }, [currentView, leftPanelWidth, uiPrefs.showPdfPreview, isResizing, userAdjustedWidth]);

  const handleAddRow = useCallback((section?: string) => {
      const newLine: ParsedLine = {
          id: crypto.randomUUID(), category: 'Structural', section: section || data[0]?.section || 'New Section',
          subSection: 'Manual Add', item: 'New Item', dimensions: '', grade: '', qty: 1, length: null,
          unit: 'EA', total: 1, totalPrice: 0, originalLine: 'Manual Entry', confidence: 1.0, isNew: true,
          matchReason: "Manual entry, no catalog match attempted."
      };
      setData(prev => [newLine, ...prev]);
      setActiveRowId(newLine.id);
  }, [data, setData, setActiveRowId]);

  const processText = useCallback(async (lines: TextLine[], fileName: string, totalSize: number, profileOverride?: ParseProfile) => {
      if (!currentUser) return;
      setStatus('parsing');
      await new Promise(r => setTimeout(r, 50));
      const profile = profileOverride || detectProfile(lines);
      setActiveProfile(profile);
      setProfileConfidence(profile.detect(lines));
      const rules = learningService.getRules();

      // Use Web Worker for parsing
      const worker = new Worker(new URL('./workers/parser.worker.ts', import.meta.url), { type: 'module' });
      
      // Strip functions from profile before sending to worker
      const serializedProfile = {
          id: profile.id,
          name: profile.name,
          description: profile.description,
          isCustom: profile.isCustom,
          settings: profile.settings,
          keywords: profile.keywords,
          sectionHandlers: profile.sectionHandlers?.map(h => ({
              header: h.header,
              // process function cannot be cloned
          }))
      };

      worker.onmessage = (e) => {
        if (e.data.type === 'SUCCESS') {
          const { items, notes } = e.data.result;
          const finalItems = items.map((item: any) => {
              if (item.spruceMapped && item.mappingSource === 'MEMORY') return item;
              const exactKey = buildLookupKey(item.item, item.dimensions);
              const noDimsKey = buildLookupKey(item.item, "");
              const match = learnedMappings.get(exactKey) || learnedMappings.get(noDimsKey);
              if (match) {
                  const product = catalog.find(p => p.itemNo === match.itemNo);
                  if (product) {
                      return { ...item, ...applyMappingToRow(item, { ...product, source: 'MEMORY', matchedFromMemory: true }) };
                  }
              }
              return item;
          }).map((item: any) => ({ ...item, totalPrice: (item.price || 0) * item.total }));

          const notesStr = notes.join('\n');
          const meta = extractContactDetails(lines);
          const fullMetadata: FileMetadata = {
              name: fileName, size: totalSize, type: 'application/pdf', ...meta,
              builder: meta.builder || 'Unknown Client',
              pageCount: lines.length > 0 ? Math.max(...lines.map(l => l.page)) : 0
          };

          setData(finalItems);
          setMetadata(fullMetadata);
          setJobNotes(notesStr);
          setRawTextLines(lines);
          
          if (finalItems.length === 0) setStatus('no_data');
          else {
              setStatus('ready');
              setCurrentView('table');
              storageService.add({
                  id: crypto.randomUUID(), userId: currentUser.id, timestamp: Date.now(), fileName: fileName, itemCount: finalItems.length, data: finalItems, metadata: fullMetadata, jobNotes: notesStr
              }).then(() => storageService.getAll(currentUser.id).then(setHistory));
          }
          worker.terminate();
        } else {
          setStatus('error');
          console.error("Worker Error:", e.data.error);
          worker.terminate();
        }
      };

      worker.postMessage({ 
        lines, 
        profile: serializedProfile, 
        rules, 
        catalog, 
        learnedMappings: Object.fromEntries(learnedMappings) 
      });

  }, [catalog, learnedMappings, currentUser, setActiveProfile, setCurrentView, setData, setHistory, setJobNotes, setMetadata, setProfileConfidence, setRawTextLines, setStatus]);

  const handleProfileChange = useCallback(async (profile: ParseProfile) => {
      setActiveProfile(profile);
      if (rawTextLines.length > 0 && metadata) {
          await processText(rawTextLines, metadata.name, metadata.size, profile);
          showToast(`Reparsing using "${profile.name}" profile...`, "info");
      }
  }, [rawTextLines, metadata, processText, setActiveProfile, showToast]);

  const handleReparse = useCallback(async () => {
    if (rawTextLines.length === 0 || !metadata) {
        showToast("No raw data available to reparse. Please re-upload the file.", "warning");
        return;
    }
    setStatus('parsing');
    await processText(rawTextLines, metadata.name, metadata.size, activeProfile);
  }, [rawTextLines, metadata, activeProfile, processText, setStatus, showToast]);

  const handleAiGenerateProfile = async () => {
    if (rawTextLines.length === 0) {
      showToast("Please upload a file first so the AI can analyze its structure.", "warning");
      return;
    }

    setIsAiGenerating(true);
    try {
      const partialProfile = await aiProfileService.generateProfile(rawTextLines, metadata?.name || 'New Document');
      
      const newProfile: ParseProfile = {
        ...partialProfile as ParseProfile,
        settings: {
          sectionHeaderPatterns: (partialProfile.serializedSettings?.sectionHeaderPatterns || []).map(s => safeRegex(s)),
          ignorePatterns: (partialProfile.serializedSettings?.ignorePatterns || []).map(s => safeRegex(s, 'i')),
          unitRules: (partialProfile.serializedSettings?.unitRules || []).map(u => ({
            sectionNamePattern: safeRegex(u.sectionNamePattern, 'i'),
            defaultUnit: u.defaultUnit as 'L/M' | 'EA' | 'm2'
          })),
          columnHints: {}
        },
        detect: () => 0 // Manual selection
      };

      // Save to local storage
      profileService.save(newProfile);
      
      // Set as active
      setActiveProfile(newProfile);
      
      showToast(`AI Profile "${newProfile.name}" generated and saved!`, "success");
      
      // Trigger re-parse with the new profile
      setTimeout(() => {
          handleReparse();
      }, 100);
    } catch (error) {
      console.error("AI Profile generation failed", error);
      showToast("Failed to generate AI profile. Please try again.", "error");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Command Bar Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandBarOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        setShowExport(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        handleAddRow();
      }
      if (e.key === 'v' && !((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA')) {
        if (currentView === 'table' && data.length > 0) {
          setShowVerification(true);
        }
      }
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        handleReparse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleAddRow, handleReparse, currentView, data.length]);

  const commands = useMemo(() => [
    { id: 'view-table', label: 'Go to Table', icon: <Table size={18} />, action: () => setCurrentView('table'), category: 'Navigation', shortcut: 'G T' },
    { id: 'view-history', label: 'Go to History', icon: <History size={18} />, action: () => setCurrentView('history'), category: 'Navigation', shortcut: 'G H' },
    { id: 'view-optimizer', label: 'Go to Optimizer', icon: <Scissors size={18} />, action: () => setCurrentView('optimizer'), category: 'Navigation', shortcut: 'G O' },
    { id: 'view-dashboard', label: 'Go to Dashboard', icon: <BarChart3 size={18} />, action: () => setCurrentView('dashboard'), category: 'Navigation', shortcut: 'G D' },
    { id: 'view-site', label: 'Enter Site Mode', icon: <Smartphone size={18} />, action: () => setIsSiteModeOpen(true), category: 'Navigation', shortcut: 'G S' },
    { id: 'reparse', label: 'Reparse Data', icon: <RotateCcw size={18} />, action: () => handleReparse(), category: 'Actions', shortcut: 'R P' },
    { id: 'verify', label: 'Verify Data (Split View)', icon: <SplitIcon size={18} />, action: () => setShowVerification(true), category: 'Actions', shortcut: 'V' },
    { id: 'add-row', label: 'Add New Row', icon: <Plus size={18} />, action: () => handleAddRow(), category: 'Actions', shortcut: 'A R' },
    { id: 'export', label: 'Export Job', icon: <FileText size={18} />, action: () => setShowExport(true), category: 'Actions', shortcut: 'E X' },
    { id: 'settings', label: 'Open Settings', icon: <Settings size={18} />, action: () => setShowSettings(true), category: 'System', shortcut: 'S E' },
    { id: 'toggle-theme', label: 'Toggle Dark Mode', icon: settings.darkMode ? <Sun size={18} /> : <Moon size={18} />, action: () => setSettings({ ...settings, darkMode: !settings.darkMode }), category: 'System' },
  ], [setCurrentView, setIsSiteModeOpen, handleReparse, handleAddRow, setShowExport, setShowSettings, settings, setSettings]);

  // Voice Command Listener
  useEffect(() => {
    if (!settings.isVoiceEnabled) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-AU';

    recognition.onstart = () => {
        setIsListening(true);
    };

    recognition.onend = () => {
        setIsListening(false);
        // Restart if still enabled
        if (settings.isVoiceEnabled) {
            try {
                recognition.start();
            } catch {
                // Silently fail if already started
            }
        }
    };

    recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
            showToast("Microphone access denied. Please enable it in your browser settings.", "error");
            setSettings(prev => ({ ...prev, isVoiceEnabled: false }));
        }
    };

    recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        console.log('Voice Command:', transcript);

        let recognized = true;
        if (transcript.includes('go to history')) setCurrentView('history');
        else if (transcript.includes('go to upload')) setCurrentView('upload');
        else if (transcript.includes('go to preview') || transcript.includes('go to table')) setCurrentView('table');
        else if (transcript.includes('go to dashboard')) setCurrentView('dashboard');
        else if (transcript.includes('go to optimizer')) setCurrentView('optimizer');
        else if (transcript.includes('open settings')) setShowSettings(true);
        else if (transcript.includes('add row')) handleAddRow();
        else if (transcript.includes('export')) setShowExport(true);
        else recognized = false;

        if (recognized) {
            showToast(`Voice Command: "${transcript}"`, "info");
        }
    };

    try {
        recognition.start();
    } catch {
        console.error("Speech recognition failed to start");
    }
    
    return () => {
        try {
            recognition.stop();
        } catch {
            // Silently fail
        }
    };
  }, [settings.isVoiceEnabled, setCurrentView, setShowSettings, setShowExport, handleAddRow, setSettings, showToast]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (isResizing && splitContainerRef.current) {
            const containerRect = splitContainerRef.current.getBoundingClientRect();
            const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            setLeftPanelWidth(Math.max(15, Math.min(80, newWidth)));
            setUserAdjustedWidth(true);
        }
    };
    const handleMouseUp = () => { 
        setIsResizing(false); 
        document.body.style.cursor = 'default'; 
    };
    if (isResizing) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizing]);

  const stats: KPIStats = useMemo(() => {
      const totalLm = data.reduce((acc, curr) => {
          if (curr.unit === 'L/M') return acc + curr.total;
          if (curr.isDerived && curr.length) return acc + (curr.total * curr.length);
          return acc;
      }, 0);
      const totalPrice = data.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
      return { totalItems: data.length, totalLinearMetres: totalLm, totalPrice: totalPrice };
  }, [data]);

  const pineWastageSummary = useMemo(() => {
      if (data.length === 0) return undefined;
      return computePineWastage(data, catalog).summary;
  }, [data, catalog]);

  const activeDocContext = useMemo(() => {
      if (!activeDocId || documents.length === 0) return null;
      const targetDoc = documents.find(p => p.id === activeDocId) || documents[0];
      let highlightPage: number | undefined = undefined;
      let highlightRect: number[] | undefined = undefined;
      if (activeRowId) {
          const row = data.find(r => r.id === activeRowId);
          if (row && row.page) {
              const owningDoc = documents.find(doc => row.page! > doc.pageOffset && row.page! <= (doc.pageOffset + doc.pageCount));
              if (owningDoc) {
                  highlightPage = row.page! - owningDoc.pageOffset;
                  highlightRect = row.rect;
              }
          }
      }
      return { doc: targetDoc, highlightPage, highlightRect };
  }, [activeDocId, documents, activeRowId, data]);

  const handleFileUpload = async (files: File[], useAi?: boolean) => {
    if (files.length === 0) return;
    
    const newJobs: BatchJob[] = files.map(f => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      status: 'pending',
      progress: 0,
      timestamp: Date.now()
    }));
    setBatchQueue(prev => [...newJobs, ...prev]);

    // Check if any PDF needs OCR
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 1) {
        const pdf = await extractTextFromPdf(pdfFiles[0]);
        if (pdf.textLines.length < 5) {
            setOcrFile({ file: pdfFiles[0], pageCount: pdf.pageCount });
            setShowOCRModal(true);
            return;
        }
    }

    setStatus('extracting');
    setLoadingProgress(5);
    setLoadingMessage(TIMBER_PUNS[0]);
    documents.forEach(d => URL.revokeObjectURL(d.url));
    setDocuments([]);
    await new Promise(r => setTimeout(r, 100));
    let punIndex = 0;
    const punInterval = setInterval(() => { punIndex = (punIndex + 1) % TIMBER_PUNS.length; setLoadingMessage(TIMBER_PUNS[punIndex]); }, 2500);
    const progressInterval = setInterval(() => { setLoadingProgress(prev => { if (prev >= 98) return prev; const step = prev < 85 ? 0.4 : 0.05; return prev + step; }); }, 150);
    try {
        const newDocuments: SourceDocument[] = [];
        let allTextLines: TextLine[] = [];
        let cumulativePageOffset = 0;
        let totalSize = 0;
        for (let i = 0; i < files.length; i++) {
             const file = files[i];
             const jobId = newJobs[i].id;
             updateBatchJob(jobId, { status: 'processing', progress: 10 });
             
             totalSize += file.size;
             let textLines: TextLine[] = [];
             let pageCount = 0;
             const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
             const startFileProgress = 10 + (i / files.length) * 60;
             setLoadingProgress(Math.max(loadingProgress, startFileProgress));
             await new Promise(r => setTimeout(r, 0));
             if (isExcel) { const result = await extractTextFromExcel(file); textLines = result.textLines; pageCount = result.pageCount; }
             else { const result = await extractTextFromPdf(file); textLines = result.textLines; pageCount = result.pageCount; }
             const shiftedLines = textLines.map(line => ({ ...line, page: line.page + cumulativePageOffset }));
             allTextLines = [...allTextLines, ...shiftedLines];
             newDocuments.push({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), file: file, type: isExcel ? 'excel' : 'pdf', pageOffset: cumulativePageOffset, pageCount: pageCount });
             cumulativePageOffset += pageCount;
             updateBatchJob(jobId, { status: 'completed', progress: 100 });
             await new Promise(r => setTimeout(r, 0));
        }
        setDocuments(newDocuments);
        if (newDocuments.length > 0) setActiveDocId(newDocuments[0].id);
        const combinedName = files[0].name + (files.length > 1 ? ` (+${files.length - 1} files)` : '');
        setLoadingMessage("Converting lines to data...");
        setLoadingProgress(85);
        setRawTextLines(allTextLines);
        
        const meta: FileMetadata = {
            name: combinedName,
            size: totalSize,
            type: 'application/pdf',
            builder: 'Unknown Client',
            pageCount: cumulativePageOffset
        };
        setMetadata(meta);

        if (useAi) {
            setLoadingMessage("AI Analyzing structure...");
            setIsAiGenerating(true);
            try {
                const partialProfile = await aiProfileService.generateProfile(allTextLines, combinedName);
                const newProfile: ParseProfile = {
                    ...partialProfile as ParseProfile,
                    settings: {
                        sectionHeaderPatterns: (partialProfile.serializedSettings?.sectionHeaderPatterns || []).map(s => safeRegex(s)),
                        ignorePatterns: (partialProfile.serializedSettings?.ignorePatterns || []).map(s => safeRegex(s, 'i')),
                        unitRules: (partialProfile.serializedSettings?.unitRules || []).map(u => ({
                            sectionNamePattern: safeRegex(u.sectionNamePattern, 'i'),
                            defaultUnit: u.defaultUnit as 'L/M' | 'EA' | 'm2'
                        })),
                        columnHints: {}
                    },
                    detect: () => 0
                };
                profileService.save(newProfile);
                setActiveProfile(newProfile);
                showToast(`AI Profile "${newProfile.name}" generated!`, "success");
                await processText(allTextLines, combinedName, totalSize, newProfile);
            } catch (err) {
                console.error("AI detection failed", err);
                showToast("AI detection failed, using standard detection", "warning");
                await processText(allTextLines, combinedName, totalSize);
            } finally {
                setIsAiGenerating(false);
            }
        } else {
            await processText(allTextLines, combinedName, totalSize);
        }
        
        setLoadingProgress(100);
        await new Promise(r => setTimeout(r, 200));
    } catch (error: any) { 
        setStatus('error'); 
        console.error(error); 
        let msg = "Failed to process file. Please ensure it is a valid PDF or Excel document.";
        if (error?.message?.includes('password')) msg = "This PDF is password protected. Please remove the password and try again.";
        if (error?.message?.includes('corrupt')) msg = "The file appears to be corrupt.";
        if (totalSize > 50 * 1024 * 1024) msg = "File is too large (max 50MB).";
        showToast(msg, "error");
    }
    finally { clearInterval(punInterval); clearInterval(progressInterval); }
  };

  const handleOCRConfirm = async (pages: number[] | null, useAI?: boolean) => {
    if (!ocrFile) return;
    setShowOCRModal(false);
    setStatus('extracting');
    setLoadingProgress(0);
    setLoadingMessage("Performing OCR...");
    
    try {
        let textLines: TextLine[] = [];
        if (useAI) {
            const { performAiOCR } = await import('./services/ocrService');
            textLines = await performAiOCR(ocrFile.file, pages, (p, s) => {
                setOcrProgress(p);
                setOcrStatus(s);
                setLoadingProgress(p);
                setLoadingMessage(s);
            });
        } else {
            const { performOCR } = await import('./services/ocrService');
            textLines = await performOCR(ocrFile.file, pages, (p, s) => {
                setOcrProgress(p);
                setOcrStatus(s);
                setLoadingProgress(p);
                setLoadingMessage(s);
            });
        }
        
        const combinedName = ocrFile.file.name;
        const totalSize = ocrFile.file.size;
        
        setDocuments([{ 
            id: crypto.randomUUID(), 
            name: combinedName, 
            url: URL.createObjectURL(ocrFile.file), 
            file: ocrFile.file, 
            type: 'pdf', 
            pageOffset: 0, 
            pageCount: ocrFile.pageCount 
        }]);
        setActiveDocId(documents[0]?.id || null);
        
        await processText(textLines, combinedName, totalSize);
    } catch (error) {
        console.error("OCR failed", error);
        showToast("OCR failed. Please try again.", "error");
        setStatus('error');
    } finally {
        setOcrFile(null);
    }
  };

  const handleDeleteRow = (id: string) => {
    setData(prev => prev.filter(r => r.id !== id));
  };

  const handleBulkDelete = (ids: string[]) => {
    const idSet = new Set(ids);
    setData(prev => prev.filter(r => !idSet.has(r.id)));
  };

  const handleDuplicateRow = (row: ParsedLine) => {
    const newRow = { ...row, id: crypto.randomUUID(), isNew: true };
    setData(prev => {
        const idx = prev.findIndex(r => r.id === row.id);
        if (idx === -1) return [...prev, newRow];
        const next = [...prev];
        next.splice(idx + 1, 0, newRow);
        return next;
    });
    setActiveRowId(newRow.id);
  };

  const handleReorderRows = (newOrder: ParsedLine[]) => {
    setData(newOrder);
  };

  const handleUpdateRow = (id: string, field: keyof ParsedLine, value: any) => {
      const sourceRow = data.find(r => r.id === id);
      if (!sourceRow) return;
      const isSpruceUpdate = field === 'spruceItemNo' || field === 'spruceDescription';
      const isClearing = isSpruceUpdate && !value; 
      setData(prev => {
          return prev.map(row => {
              const isTarget = row.id === id;
              const isSyncMatch = isSpruceUpdate && 
                                  row.item === sourceRow.item && 
                                  row.dimensions === sourceRow.dimensions && 
                                  row.grade === sourceRow.grade && 
                                  row.length === sourceRow.length;
              if (isTarget || isSyncMatch) {
                  let updated = { ...row };
                  if (field === 'section') updated.sectionLocked = true;
                  if (field === 'subSection') updated.subSectionLocked = true;
                  
                  let finalValue = value;
                  if (field === 'unit') {
                      finalValue = normalizeUnit(value);
                  }
                  (updated as any)[field] = finalValue;
                  if (isSpruceUpdate) {
                      updated.confidence = 1.0; 
                      if (isClearing) {
                          updated.spruceItemNo = "";
                          updated.spruceDescription = "";
                          updated.sprucePriceCents = null;
                          updated.spruceGroup = null;
                          updated.spruceSection = null;
                          updated.price = 0;
                          updated.spruceMapped = false;
                          updated.manuallyUnmapped = true;
                          updated.matchReason = "No match found, manually cleared by user.";
                      } else {
                          const match = catalog.find(p => p.itemNo === value || p.description === value);
                          if (match) {
                              const enrichedMatch = enrichCatalogProduct(match); 
                              const finalMapping = applyMappingToRow(updated, { ...enrichedMatch, source: 'MANUAL' });
                              updated = { ...updated, ...finalMapping };
                              updated.totalPrice = (updated.price || 0) * updated.total;
                              
                              const memoryItem: MemoryItem = {
                                  lookupKey: buildLookupKey(updated.item, updated.dimensions),
                                  displayName: normalizeWhitespace(updated.item),
                                  dimensions: normalizeWhitespace(updated.dimensions),
                                  itemNo: match.itemNo,
                                  description: match.description
                              };
                              storageService.saveLearnedMapping(memoryItem).then(() => {
                                  storageService.getLearnedMappings().then(list => {
                                      const newMap = new Map<string, MemoryItem>();
                                      list.forEach(m => newMap.set(m.lookupKey, m));
                                      setLearnedMappings(newMap);
                                  });
                              });
                          } else {
                              updated.spruceMapped = false;
                              updated.manuallyUnmapped = false;
                              updated.matchReason = "Searching or custom code entry.";
                              if (field === 'spruceItemNo' && value.length >= 4) {
                                  const memoryItem: MemoryItem = {
                                      lookupKey: buildLookupKey(updated.item, updated.dimensions),
                                      displayName: normalizeWhitespace(updated.item),
                                      dimensions: normalizeWhitespace(updated.dimensions),
                                      itemNo: value,
                                      description: updated.spruceDescription || ''
                                  };
                                  storageService.saveLearnedMapping(memoryItem).then(() => {
                                      storageService.getLearnedMappings().then(list => {
                                          const newMap = new Map<string, MemoryItem>();
                                          list.forEach(m => newMap.set(m.lookupKey, m));
                                          setLearnedMappings(newMap);
                                      });
                                  });
                              }
                          }
                      }
                  } else if (field === 'qty' || field === 'length' || field === 'unit') {
                      if (updated.unit === 'L/M' || updated.unit === 'm2') updated.total = (updated.qty || 0) * (updated.length || 0);
                      else updated.total = updated.qty;
                      updated.totalPrice = (updated.price || 0) * updated.total;
                  } else if (field === 'price') {
                      updated.price = parseFloat(value) || 0;
                      updated.totalPrice = (updated.price || 0) * updated.total;
                  }
                  return updated;
              }
              return row;
          });
      });
  };

  const handleBulkUpdate = (ids: string[], field: keyof ParsedLine, value: any) => {
    setData(prev => {
        const idSet = new Set(ids);
        return prev.map(row => {
            if (idSet.has(row.id)) {
                let updated = { ...row };
                if (field === 'section') updated.sectionLocked = true;
                if (field === 'subSection') updated.subSectionLocked = true;
                
                let finalValue = value;
                if (field === 'unit') {
                    finalValue = normalizeUnit(value);
                }
                (updated as any)[field] = finalValue;
                if (field === 'qty' || field === 'length' || field === 'unit') {
                    if (updated.unit === 'L/M' || updated.unit === 'm2') updated.total = (updated.qty || 0) * (updated.length || 0);
                    else updated.total = updated.qty;
                    updated.totalPrice = (updated.price || 0) * updated.total;
                }
                if (field === 'spruceItemNo') {
                    updated.confidence = 1.0;
                    if (!value) {
                        updated.spruceDescription = "";
                        updated.spruceItemNo = "";
                        updated.sprucePriceCents = null;
                        updated.spruceGroup = null;
                        updated.spruceSection = null;
                        updated.price = 0;
                        updated.totalPrice = 0;
                        updated.spruceMapped = false;
                        updated.manuallyUnmapped = true;
                        updated.matchReason = "No match found, manually cleared by user.";
                    } else {
                        const match = catalog.find(p => p.itemNo === value);
                        if (match) { 
                            const enrichedMatch = enrichCatalogProduct(match);
                            const mappingUpdates = applyMappingToRow(updated, { ...enrichedMatch, source: 'MANUAL' });
                            updated = { ...updated, ...mappingUpdates };
                            updated.totalPrice = (updated.price || 0) * updated.total;
                        } else { 
                            updated.spruceMapped = false; 
                            updated.manuallyUnmapped = false;
                            updated.matchReason = "No exact match found, entering custom code.";
                        }
                    }
                }
                return updated;
            }
            return row;
        });
    });
  };

  const handleToggleAnnotationResolve = (rowId: string, annotationId: string) => {
    setData(prev => prev.map(row => {
      if (row.id === rowId) {
        const annotations = (row.annotations || []).map(ann => {
          if (ann.id === annotationId) {
            return { ...ann, resolved: !ann.resolved };
          }
          return ann;
        });
        return { ...row, annotations };
      }
      return row;
    }));
  };

  const handleAddAnnotation = (rowId: string, text: string) => {
    if (!currentUser) return;
    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      rowId,
      userId: currentUser.id,
      userName: currentUser.name,
      text,
      timestamp: Date.now(),
      resolved: false
    };

    setData(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, annotations: [...(row.annotations || []), newAnnotation] };
      }
      return row;
    }));
  };

  const handleReloadJob = (item: HistoryItem) => {
      setData(item.data);
      setMetadata(item.metadata || null);
      setJobNotes(item.jobNotes || '');
      // Clear documents as blobs aren't stored in history JSON
      setDocuments([]);
      setActiveDocId(null);
      setStatus('ready');
      setCurrentView('table');
      showToast(`Loaded "${item.fileName}". Note: Source document (PDF/Excel) is not available for historical jobs.`, "info");
  };

  const handleLogout = async () => {
      try {
          await auth.signOut();
          setCurrentUser(null);
          setData([]);
          setDocuments([]);
          setCurrentView('upload');
          setSettings(DEFAULT_SETTINGS);
      } catch (err) {
          console.error("Logout Error:", err);
      }
  };

  const handleResetView = () => {
      setUserAdjustedWidth(false);
  };

  const handleSaveColumnWidths = (widths: Record<string, number>) => {
      setSettings(prev => ({
          ...prev,
          tableColumnWidths: widths
      }));
      if (currentUser) {
          storageService.saveUserSettings(currentUser.id, {
              ...settings,
              tableColumnWidths: widths
          });
      }
  };

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('bone_timber_onboarding_seen');
    if (!hasSeenOnboarding && currentUser) {
        setShowHelp(true);
        localStorage.setItem('bone_timber_onboarding_seen', 'true');
    }
  }, [currentUser]);

  if (!isAuthReady) {
      return (
          <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Loading Application...</p>
              </div>
          </div>
      );
  }

  if (!currentUser) {
      return <UserSplashScreen onSelectUser={setCurrentUser} logoUrl={settings.logoUrl} companyName={settings.companyName} />;
  }

  const isSidebarExpanded = isSidebarHovered || currentView === 'upload';
  const activeTheme = THEME_MAP[settings.themeColor] || THEME_MAP.blue;

  return (
    <CollaborationProvider jobId={activeDocId || 'default-job'} userId={currentUser.id} userName={currentUser.name}>
      <div 
          className={`flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 font-sans text-slate-900 dark:text-slate-100 ${settings.darkMode ? 'dark' : ''} selection:bg-blue-100 selection:text-blue-900 overflow-hidden relative`}
          style={{ 
            fontFamily: settings.fontFamily,
            perspective: '1200px' 
          }}
      >
      {/* Animated Atmospheric Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40 dark:opacity-20 transition-opacity duration-1000">
        <motion.div 
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-200/40 to-transparent blur-[120px] dark:from-blue-600/20"
        />
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, -8, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-emerald-100/40 to-transparent blur-[120px] dark:from-emerald-600/10"
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden will-change-[width,transform] ${isSidebarExpanded ? 'lg:w-64' : 'lg:w-16'} ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'} w-72 lg:translate-x-0 shadow-2xl lg:shadow-none`} 
        onMouseEnter={() => setIsSidebarHovered(true)} 
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="flex flex-col h-full items-start p-3 relative z-10">
          <div className={`flex items-center mb-8 h-10 transition-all duration-300 w-full ${isSidebarExpanded ? 'gap-3 px-1' : 'justify-center gap-0'}`}>
            <motion.div 
              whileHover={{ rotateY: 180 }}
              transition={{ duration: 0.6, type: 'spring' }}
              className={`h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold shadow-xl overflow-hidden bg-white ring-1 ring-slate-200/50 perspective-sm`}
            >
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${activeTheme.bg} text-white`}>
                    {settings.companyName.charAt(0).toUpperCase()}
                </div>
              )}
            </motion.div>
            <h1 className={`font-black text-lg tracking-tight whitespace-nowrap transition-all duration-300 pointer-events-none overflow-hidden ${isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
              {settings.companyName}
            </h1>
          </div>
          <nav className="flex-1 space-y-1 w-full">
                {[
                    { id: 'upload', icon: <FileText size={18} />, label: 'New Job' },
                    { id: 'table', icon: <Table size={18} />, label: 'Main List' },
                    { id: 'dashboard', icon: <BarChart3 size={18} />, label: 'Report' },
                    { id: 'history', icon: <History size={18} />, label: 'History' }
                ].map(nav => (
                    <button key={nav.id} onClick={() => { setCurrentView(nav.id as any); setIsMobileMenuOpen(false); }} className={`flex items-center rounded-lg transition-all duration-200 group relative ${isSidebarExpanded ? 'w-full px-3 py-2 gap-3 h-10' : 'w-10 h-10 justify-center mx-auto'} ${currentView === nav.id ? `${activeTheme.bg} text-white shadow-lg ${activeTheme.shadow}` : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`} title={!isSidebarExpanded ? nav.label : undefined}>
                        <div className="flex-shrink-0 flex items-center justify-center w-5 h-5">{nav.icon}</div>
                        <span className={`font-bold text-sm whitespace-nowrap transition-[opacity,transform] duration-200 ${isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none absolute'}`}>{nav.label}</span>
                        {currentView === nav.id && !isSidebarExpanded && (
                            <div className={`absolute left-0 w-1 h-6 rounded-r-full ${activeTheme.bg} -translate-x-1`} />
                        )}
                    </button>
                ))}
                <button onClick={() => setCurrentView('optimizer' as any)} className={`flex items-center rounded-lg transition-all duration-200 group relative ${isSidebarExpanded ? 'w-full px-3 py-2 gap-3 h-10' : 'w-10 h-10 justify-center mx-auto'} ${currentView === 'optimizer' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`} title={!isSidebarExpanded ? "Optimizer" : undefined}>
                    <div className="flex-shrink-0 flex items-center justify-center w-5 h-5"><Scissors size={18} /></div>
                    <span className={`font-bold text-sm whitespace-nowrap transition-[opacity,transform] duration-200 ${isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none absolute'}`}>Optimizer</span>
                </button>
          </nav>
          <div className="w-full space-y-1 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className={`flex items-center mb-2 ${isSidebarExpanded ? 'px-1 gap-2' : 'justify-center'}`}>
                <button 
                    onClick={() => setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }))}
                    className={`flex items-center justify-center rounded-lg transition-all duration-200 ${isSidebarExpanded ? 'flex-1 h-9 gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700' : 'w-10 h-10 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    title={settings.darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {settings.darkMode ? <Sun size={18} /> : <Moon size={18} />}
                    {isSidebarExpanded && <span className="text-xs font-medium">{settings.darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
                </button>
                {isSidebarExpanded && (
                    <button 
                        onClick={() => setShowHelp(true)}
                        className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all shadow-sm"
                        title="Quick Guide"
                    >
                        <HelpCircle size={18} />
                    </button>
                )}
            </div>
            <button onClick={() => {setSettingsInitialTab('general'); setShowSettings(true);}} className={`flex items-center rounded-lg transition-colors duration-200 group relative ${isSidebarExpanded ? 'w-full px-3 py-2 gap-3 h-10' : 'w-10 h-10 justify-center mx-auto'} text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`} title={!isSidebarExpanded ? "Settings" : undefined}>
                <div className="flex-shrink-0 flex items-center justify-center w-5 h-5"><Settings size={18} /></div>
                <span className={`text-sm whitespace-nowrap transition-[opacity,transform] duration-200 ${isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none absolute'}`}>Settings</span>
            </button>
            <button onClick={handleLogout} className={`flex items-center rounded-lg transition-colors duration-200 group relative ${isSidebarExpanded ? 'w-full px-3 py-2 gap-3 h-10' : 'w-10 h-10 justify-center mx-auto'} text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`} title={!isSidebarExpanded ? "Log Out" : undefined}>
                <div className="flex-shrink-0 flex items-center justify-center w-5 h-5"><LogOut size={18} /></div>
                <span className={`text-sm whitespace-nowrap transition-[opacity,transform] duration-200 ${isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none absolute'}`}>Log Out</span>
            </button>
            {settings.isVoiceEnabled && isSidebarExpanded && (
                <div className={`mx-1 mt-2 px-3 py-2 rounded-xl border transition-all ${isListening ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 animate-pulse' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 opacity-60'} flex items-center gap-3`}>
                    <Mic size={14} className={isListening ? 'text-emerald-500' : 'text-slate-400'} />
                    <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isListening ? 'text-emerald-600' : 'text-slate-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                        {isListening ? 'Voice Active' : 'Voice Standby'}
                    </span>
                </div>
            )}
            <div className={`mt-2 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 flex items-center transition-all group/profile ${isSidebarExpanded ? 'gap-3 px-2' : 'justify-center'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden shadow-sm transition-transform group-hover/profile:scale-105 ${currentUser.role === 'admin' ? 'bg-amber-100 text-amber-600 ring-1 ring-amber-500/20' : 'bg-blue-100 text-blue-600 ring-1 ring-blue-500/20'}`}>
                    {currentUser.avatar ? <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : currentUser.name.charAt(0)}
                </div>
                {isSidebarExpanded && (
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100 leading-none mb-1">{currentUser.name}</p>
                        <p className={`text-[9px] uppercase font-black tracking-widest leading-none ${currentUser.role === 'admin' ? 'text-amber-500' : 'text-blue-500'}`}>{currentUser.role}</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 z-30">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded flex items-center justify-center text-white font-bold shadow-sm ${activeTheme.bg}`}>
                {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                ) : settings.companyName.charAt(0).toUpperCase()}
            </div>
            <span className="font-bold text-sm truncate max-w-[150px]">{settings.companyName}</span>
          </div>
          <div className="w-9" /> {/* Spacer for centering */}
        </header>

        <div className="flex-1 overflow-hidden p-2 sm:p-5 relative z-10">
          <AnimatePresence mode="wait">
            {currentView === 'upload' && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.98 }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                className="h-full flex items-center justify-center relative overflow-hidden"
              >
                {/* Background Large Typography - Editorial Style */}
                <div className="absolute inset-0 flex items-end justify-center pointer-events-none select-none overflow-hidden pb-10">
                  <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 1.5, ease: "easeOut" }}
                    className="flex flex-col items-center"
                  >
                    <h1 className="text-[12vw] font-[900] text-slate-900/5 dark:text-white/5 leading-[0.8] tracking-tighter uppercase whitespace-nowrap mb-4">
                      IMPORTER
                    </h1>
                    <div className="flex items-center gap-10 opacity-20 dark:opacity-10">
                       <span className="text-xs font-black uppercase tracking-[0.5em] text-slate-400">PDF STRUCTURE ANALYZER</span>
                       <div className="h-px w-24 bg-slate-400" />
                       <span className="text-xs font-black uppercase tracking-[0.5em] text-slate-400">EXCEL DATA EXTRACTOR</span>
                    </div>
                  </motion.div>
                </div>

                <div className="w-full max-w-4xl relative z-20 animate-enter flex flex-col gap-8">
                  <FileUpload 
                    onFileUpload={handleFileUpload} 
                    status={status} 
                    activeProfile={activeProfile} 
                    onProfileChange={handleProfileChange} 
                    onManageProfiles={() => {setSettingsInitialTab('profiles'); setShowSettings(true);}} 
                    onAiGenerateProfile={handleAiGenerateProfile}
                    isAiGenerating={isAiGenerating}
                    progress={loadingProgress} 
                    customMessage={loadingMessage}
                  />
                  
                  <AnimatePresence>
                    {batchQueue.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: 20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 20 }}
                      >
                        <BatchQueue 
                          jobs={batchQueue}
                          onRemove={(id) => setBatchQueue(prev => prev.filter(j => j.id !== id))}
                          onClear={() => setBatchQueue([])}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
            {currentView === 'table' && (
              <motion.div 
                key="table"
                initial={{ opacity: 0, rotateY: 5, x: 20 }}
                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                exit={{ opacity: 0, rotateY: -5, x: -20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                className="flex flex-col h-full gap-3"
              >
                <div ref={headerContainerRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-[minmax(320px,520px)_auto_1fr] gap-3 items-stretch shrink-0 mb-1 px-1">
                  {metadata && <JobHeader metadata={metadata} onUpdate={setMetadata} />}
                  {uiPrefs.showHeaderMetrics ? (
                    <div className="md:contents">
                      <StatsCards stats={stats} pineWastageSummary={pineWastageSummary} />
                    </div>
                  ) : <div className="hidden" />}
                  {uiPrefs.showJobNotes ? (
                    <div className="md:contents">
                      <JobNotesCard notes={jobNotes} onUpdateNotes={setJobNotes} />
                    </div>
                  ) : <div className="hidden" />}
                </div>
                <div className="flex-1 flex min-h-0 relative" ref={splitContainerRef}>
                  {documents.length > 0 && activeDocContext && uiPrefs.showPdfPreview && (
                    <>
                      <div className={`hidden xl:flex flex-col h-full min-h-0 overflow-hidden ${!isResizing ? 'transition-all duration-500 ease-in-out' : ''}`} style={{ width: `${leftPanelWidth}%` }}>
                        {activeDocContext.doc.type === 'excel' ? <ExcelViewer fileUrl={activeDocContext.doc.url} documents={documents} activeDocumentId={activeDocId!} onDocumentChange={setActiveDocId} highlightPage={activeDocContext.highlightPage} highlightRect={activeDocContext.highlightRect} /> : <PdfViewer fileUrl={activeDocContext.doc.url} highlightPage={activeDocContext.highlightPage} highlightRect={activeDocContext.highlightRect} documents={documents} activeDocumentId={activeDocId!} onDocumentChange={setActiveDocId} />}
                      </div>
                      <div 
                        className="w-1.5 hover:w-2 bg-slate-200 dark:bg-slate-800 hover:bg-blue-500 dark:hover:bg-blue-500 cursor-col-resize transition-all self-stretch group flex items-center justify-center z-10"
                        onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                      >
                        <div className="w-0.5 h-12 bg-slate-400 dark:bg-slate-600 rounded-full group-hover:bg-white"></div>
                      </div>
                    </>
                  )}
                  <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${documents.length > 0 && uiPrefs.showPdfPreview ? 'pl-1' : ''}`}>
                    <PreviewTable 
                      allData={data}
                      data={data} 
                      onUpdateRow={handleUpdateRow} 
                      onReorderRows={handleReorderRows}
                      activeProfile={activeProfile}
                      onProfileChange={handleProfileChange}
                      onManageProfiles={() => {
                        setSettingsInitialTab('profiles');
                        setShowSettings(true);
                      }}
                      onAiGenerateProfile={handleAiGenerateProfile}
                      isAiGenerating={isAiGenerating}
                      onBulkUpdate={handleBulkUpdate} 
                      onBulkDelete={handleBulkDelete} 
                      onDeleteRow={handleDeleteRow} 
                      onAddRow={handleAddRow} 
                      activeRowId={activeRowId} 
                      onRowClick={setActiveRowId} 
                      catalog={catalog} 
                      onExport={() => setShowExport(true)} 
                      onVerify={() => setShowVerification(true)}
                      onAddAnnotation={(id) => setAnnotationRowId(id)}
                      onInspect={setInspectRow} 
                      onDuplicateRow={handleDuplicateRow}
                      uiPreferences={uiPrefs} 
                      onResetView={handleResetView}
                      onTotalWidthReport={handleTotalTableWidthReport}
                      pineWastagePct={pineWastageSummary?.overallWastagePct}
                      savedColumnWidths={settings.tableColumnWidths}
                      onSaveColumnWidths={handleSaveColumnWidths}
                      onReparse={handleReparse}
                      isReparsing={status === 'parsing'}
                      onUndo={undo}
                      onRedo={redo}
                      canUndo={undoStack.length > 0}
                      canRedo={redoStack.length > 0}
                      onSmartMatch={async () => {
                        if (data.length === 0 || catalog.length === 0) return;
                        setStatus('parsing');
                        try {
                          const results = await runSmartAiMatch(data, catalog, (progress) => {
                            setLoadingProgress(progress);
                            setLoadingMessage(`AI Matching: ${Math.round(progress)}%`);
                          });
                          
                          setData(prev => prev.map(row => {
                            const match = results.find(r => r.sourceId === row.id);
                            if (match && match.status === 'MATCH' && match.itemNo) {
                              const product = catalog.find(p => p.itemNo === match.itemNo);
                              if (product) {
                                const enriched = enrichCatalogProduct(product);
                                const updated = { 
                                  ...row, 
                                  ...applyMappingToRow(row, { ...enriched, source: 'AI' }),
                                  matchReason: match.why,
                                  confidence: match.confidence
                                };
                                return { ...updated, totalPrice: (updated.price || 0) * updated.total };
                              }
                            }
                            return row;
                          }));
                          setStatus('ready');
                        } catch (e) {
                          console.error("Smart Match failed", e);
                          setStatus('ready');
                        }
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
            {currentView === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <HistoryView 
                  history={history} 
                  onRefresh={() => storageService.getAll(currentUser.id).then(setHistory)} 
                  onReloadJob={handleReloadJob} 
                  userId={currentUser.id}
                />
              </motion.div>
            )}
            {currentView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <Dashboard data={data} catalog={catalog} history={history} />
              </motion.div>
            )}
            {currentView === 'optimizer' && (
              <motion.div 
                key="optimizer"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="h-full"
              >
                <CuttingListOptimizer data={data} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {isSiteModeOpen && (
            <SiteMode 
              data={data} 
              metadata={metadata} 
              onClose={() => setIsSiteModeOpen(false)} 
            />
          )}
        </AnimatePresence>

        <CommandBar 
          isOpen={isCommandBarOpen} 
          onClose={() => setIsCommandBarOpen(false)} 
          commands={commands} 
        />

        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} settings={settings} onUpdateSettings={setSettings} onUserUpdate={setCurrentUser} initialTab={settingsInitialTab} activeProfileId={activeProfile.id} currentUser={currentUser} />
        <ExportModal isOpen={showExport} onClose={() => setShowExport(false)} data={data} filename={metadata?.name} onManageTemplates={() => {setShowExport(false); setSettingsInitialTab('templates'); setShowSettings(true);}} metadata={metadata} history={history} jobNotes={jobNotes} />
        
        <AnimatePresence>
          {showVerification && (
            <VerificationView 
              isOpen={showVerification}
              onClose={() => setShowVerification(false)}
              data={data}
              documents={documents}
              activeDocId={activeDocId}
              onUpdateRow={onUpdateRow}
              activeRowId={activeRowId}
              onRowClick={setActiveRowId}
              onAddAnnotation={(id) => setAnnotationRowId(id)}
              catalog={catalog}
              uiPreferences={uiPrefs}
            />
          )}
        </AnimatePresence>
        {inspectRow && <ParsingInspector isOpen={!!inspectRow} onClose={() => setInspectRow(null)} row={inspectRow} />}
        {annotationRowId && currentUser && (
            <AnnotationsModal 
              rowId={annotationRowId}
              annotations={data.find(r => r.id === annotationRowId)?.annotations || []}
              currentUser={currentUser}
              onAdd={(text) => handleAddAnnotation(annotationRowId, text)}
              onToggleResolve={(annId) => handleToggleAnnotationResolve(annotationRowId, annId)}
              onClose={() => setAnnotationRowId(null)}
            />
        )}
        {ocrFile && (
            <OCRModal 
                isOpen={showOCRModal}
                fileName={ocrFile.file.name}
                pageCount={ocrFile.pageCount}
                onConfirm={handleOCRConfirm}
                onCancel={() => {setShowOCRModal(false); setOcrFile(null); setStatus('ready');}}
                progress={ocrProgress}
            />
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => useStore.setState({ toast: null })} />}
      </main>
      <GuideModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    </CollaborationProvider>
  );
}
