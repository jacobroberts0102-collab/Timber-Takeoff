import React, { useRef, useState, useMemo, useEffect, useCallback, useLayoutEffect, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ParsedLine, ValidationResult, CatalogProduct, UiPreferences } from '../types';
import { aiService } from '../services/aiService';
import { normalizeDimensions, parseSheetDimsFromLine, sheetDimsMatch } from '../services/parser';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X, CheckCircle, AlertCircle, Plus, Trash2, CheckSquare, Square, Activity, Columns, EyeOff, FileDown, Layers, Calculator, AlertTriangle, Lock, Edit2, ChevronDown, ChevronRight, ArrowRightLeft, Database, GripHorizontal, RotateCcw, Check, Move, ShieldCheck, DollarSign, Tag, TrendingUp, Save, Maximize2, Loader2, Sparkles, Undo2, Redo2, Zap, HelpCircle, BrainCircuit, MessageSquare, Split as SplitIcon } from 'lucide-react';
import { ProfileSelector } from './ProfileSelector';
import { ConfirmDialog } from './ConfirmDialog';
import { detectRowAnomalies } from '../utils/anomaly';
import { evaluateFormula } from '../utils/formulas';
import { PineWastagePanel } from './PineWastagePanel';
import { getRelevanceSortedResults } from '../services/storage';

interface PreviewTableProps {
  allData: ParsedLine[];
  data: ParsedLine[];
  onUpdateRow: (id: string, field: keyof ParsedLine, value: any) => void;
  activeRowId: string | null;
  onRowClick: (id: string) => void;
  catalog?: CatalogProduct[];
  onAddRow?: (section?: string) => void;
  onDeleteRow?: (id: string) => void;
  onBulkUpdate?: (ids: string[], field: keyof ParsedLine, value: any) => void;
  onBulkDelete?: (ids: string[]) => void;
  onTeach?: (row: ParsedLine) => void;
  onInspect?: (row: ParsedLine) => void;
  onDuplicateRow?: (row: ParsedLine) => void;
  onExport?: () => void;
  onVerify?: () => void;
  onAddAnnotation?: (rowId: string) => void;
  onReview?: () => void;
  onEditSection?: (sectionName: string) => void;
  validationResult?: ValidationResult;
  validationIssues?: number;
  uiPreferences?: UiPreferences;
  onAddDraftLines?: (newLines: ParsedLine[]) => void;
  onResetView?: () => void;
  onTotalWidthReport?: (width: number) => void;
  pineWastagePct?: number;
  savedColumnWidths?: Record<string, number>;
  onSaveColumnWidths?: (widths: Record<string, number>) => void;
  onReparse?: () => void;
  isReparsing?: boolean;
  onSmartMatch?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onReorderRows?: (newOrder: ParsedLine[]) => void;
  activeProfile: ParseProfile;
  onProfileChange: (profile: ParseProfile) => void;
  onManageProfiles?: () => void;
  onAiGenerateProfile?: () => void;
  isAiGenerating?: boolean;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: keyof ParsedLine | 'status' | 'totalLm';
  direction: SortDirection;
}

const COLUMN_LABELS: Record<string, string> = {
  status: '', 
  section: 'Group',
  subSection: 'Section',
  spruceItemNo: 'SPRUCE Item No.',
  spruceDescription: 'SPRUCE Description',
  spruceGroup: 'Catalog Group',
  spruceSection: 'Catalog Section',
  item: 'Item Name', 
  description: 'Description', 
  dimensions: 'Dims',
  grade: 'Grade',
  qty: 'Qty',
  length: 'Len (m)',
  totalLm: 'Total LM',
  unit: 'Unit',
  formula: 'Formula',
  price: 'Price / Unit',
  total: 'Total',
  totalPrice: 'Total $',
  annotations: 'Notes'
};

const DEFAULT_ORDER: (keyof ParsedLine | 'status' | 'totalLm' | 'annotations')[] = ['status', 'section', 'subSection', 'spruceItemNo', 'spruceDescription', 'spruceGroup', 'spruceSection', 'item', 'description', 'dimensions', 'grade', 'qty', 'length', 'totalLm', 'unit', 'price', 'totalPrice', 'annotations'];

const DEFAULT_WIDTHS: Record<string, number> = {
  status: 50,
  section: 140,
  subSection: 140,
  spruceItemNo: 130,
  spruceDescription: 200,
  spruceGroup: 140,
  spruceSection: 160,
  item: 280,
  description: 250,
  dimensions: 110,
  grade: 90,
  qty: 80,
  length: 90,
  totalLm: 90,
  formula: 120,
  unit: 80,
  price: 110,
  total: 100,
  totalPrice: 100,
  annotations: 150
};

/**
 * Robust measurement of text width using Canvas API.
 * Adheres to requested Min (60px) / Max (520px) bounds.
 * Removed excess padding for shortest possible widths.
 */
const measureColumnWidth = (colKey: string, dataSample: ParsedLine[]): number => {
    if (colKey === 'status') return 50;
    
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return DEFAULT_WIDTHS[colKey] || 100;
    
    const bodyFont = "14px Arial, sans-serif"; 
    const headerFont = "600 10px Arial, sans-serif";
    
    // Requested Bounds
    const MIN_WIDTH = 40; // Lowered to allow even tighter columns if content is tiny
    const MAX_WIDTH = 520;
    const PADDING_X = 6; // Minimal 3px buffer on each side to prevent pixel-touching
    
    let maxWidth = MIN_WIDTH; 
    
    // 1. Measure Header
    // Headers need space for: text + sort icon (14) + drag handle (10) + auto-fit button (14)
    context.font = headerFont;
    const label = COLUMN_LABELS[colKey] || colKey;
    const headerTextWidth = context.measureText(label.toUpperCase()).width + 52; // Increased for better spacing
    maxWidth = Math.max(maxWidth, headerTextWidth);
    
    // 2. Measure Cell Contents
    context.font = bodyFont;
    dataSample.forEach(row => {
        let text: string;
        const val = (row as any)[colKey];
        
        if (val === null || val === undefined) text = '';
        else if (colKey === 'total') text = (row.total?.toFixed(2) || '0.00');
        else if (colKey === 'price') text = '$' + (row.price?.toFixed(2) || '0.00') + ' /LM';
        else if (colKey === 'totalPrice') text = '$' + (row.totalPrice?.toFixed(2) || '0.00');
        else if (colKey === 'totalLm') text = (row.unit === 'L/M' && row.qty && row.length ? (row.qty * row.length).toFixed(2) : '--');
        else text = String(val);
        
        if (text) {
            const isBold = colKey === 'item' || colKey === 'spruceItemNo';
            if (isBold) context.font = "bold 14px Arial, sans-serif";
            else context.font = bodyFont;

            const width = context.measureText(text).width + PADDING_X + 12; // Consolidated padding
            if (width > maxWidth) maxWidth = width;
        }
    });
    
    return Math.min(maxWidth, MAX_WIDTH); 
};

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const tokens = highlight.toUpperCase().split(/\s+/).filter(t => t.length >= 2);
    if (tokens.length === 0) return <span>{text}</span>;
    
    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    const parts = text.split(regex);
    
    return (
        <span>
            {parts.map((part, i) => 
                regex.test(part) ? (
                    <mark key={i} className="bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 rounded-sm px-0.5 font-bold">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

const isSummaryRow = (row: ParsedLine): boolean => {
    const text = (row.item + " " + (row.description || "")).toLowerCase();
    return /total|summary|subtotal|sum\s+of/.test(text) && !/frame|truss|joist/.test(text.replace(/total/g, ''));
};

const DynamicInput = ({ 
  value, 
  onChange, 
  className,
  readOnly,
  autoFocus,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: { 
  value: string; 
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; 
  className: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  [key: string]: any;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
      if (autoFocus && textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
      }
  }, [autoFocus]);
  return (
    <div className="relative w-full group min-h-[1.5rem] h-full flex items-center">
        <div className={`${className} invisible whitespace-normal break-words overflow-hidden h-auto absolute pointer-none`} aria-hidden="true">
            {value || ' '}
        </div>
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className={`${className} w-full h-full resize-none overflow-hidden bg-transparent whitespace-normal break-words ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
            readOnly={readOnly}
            rows={1}
            style={{ minHeight: '24px' }} 
            {...props}
        />
    </div>
  );
};

export interface CatalogDropdownProps {
    catalog: CatalogProduct[];
    onSelect: (product: CatalogProduct) => void;
    onClose: () => void;
    searchTerm: string;
    targetRef: React.RefObject<HTMLElement>;
    selectedIndex: number;
}

export const CatalogDropdown: React.FC<CatalogDropdownProps> = ({ catalog, onSelect, onClose, searchTerm, targetRef, selectedIndex }) => {
    const popupRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
    const MAX_HEIGHT = 350;

    const filtered = useMemo(() => {
        return getRelevanceSortedResults(catalog, searchTerm);
    }, [catalog, searchTerm]);

    const reposition = useCallback(() => {
        if (targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const shouldFlip = spaceBelow < MAX_HEIGHT && spaceAbove > spaceBelow;

            const isMobile = window.innerWidth < 768;
            const dropdownWidth = isMobile ? window.innerWidth - 32 : Math.max(450, rect.width);
            const leftPos = isMobile ? 16 : Math.min(rect.left, window.innerWidth - dropdownWidth - 16);

            setStyle({
                position: 'fixed',
                top: shouldFlip ? 'auto' : `${rect.bottom + 4}px`,
                bottom: shouldFlip ? `${window.innerHeight - rect.top + 4}px` : 'auto',
                left: `${leftPos}px`,
                width: `${dropdownWidth}px`,
                zIndex: 9999,
                visibility: 'visible'
            });
        }
    }, [targetRef]);

    useEffect(() => {
        if (scrollRef.current && selectedIndex >= 0) {
            const container = scrollRef.current;
            const items = container.querySelectorAll('button');
            const target = items[selectedIndex] as HTMLElement;
            if (target) {
                const containerRect = container.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                if (targetRect.bottom > containerRect.bottom) {
                    target.scrollIntoView({ block: 'end', behavior: 'smooth' });
                } else if (targetRect.top < containerRect.top) {
                    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }
            }
        }
    }, [selectedIndex]);

    useLayoutEffect(() => {
        const handleScroll = () => reposition();
        const handleResize = () => reposition();
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        
        const rafId = requestAnimationFrame(() => {
            reposition();
        });

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(rafId);
        };
    }, [reposition, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
        };
        const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 10);
        return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); };
    }, [onClose]);

    if (!searchTerm || searchTerm.length < 1) return null;

    const content = (
        <div 
            ref={popupRef} 
            style={style} 
            className="bg-white dark:bg-slate-800 rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-black/5"
            onScroll={(e) => e.stopPropagation()}
        >
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center">
                        <Database size={12} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        ERP Catalog Suggestions
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-bold">{filtered.length} matches</span>
                    <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <span className="text-[9px] text-slate-400 font-medium italic">Arrows to navigate • Enter to select</span>
                </div>
            </div>
            <div ref={scrollRef} className="max-h-[350px] overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain bg-white dark:bg-slate-800">
                {searchTerm.length < 2 ? (
                    <div className="p-8 text-center flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                            <Search size={18} className="text-slate-300" />
                        </div>
                        <div className="text-slate-400 font-medium text-xs">Keep typing to search the catalog...</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 text-center flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                            <AlertCircle size={24} className="text-red-300 dark:text-red-800" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-slate-800 dark:text-slate-200 font-bold text-sm">No matches found</div>
                            <div className="text-slate-400 text-xs">Try a different search term or check spelling.</div>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {filtered.map((p, idx) => (
                            <button 
                                key={p.itemNo} 
                                type="button"
                                onMouseDown={(e) => { 
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onSelect(p);
                                }}
                                className={`w-full text-left px-4 py-3 flex items-start gap-4 transition-all group ${
                                    selectedIndex === idx 
                                    ? 'bg-blue-50 dark:bg-blue-900/40 ring-inset ring-2 ring-blue-500/20' 
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                                }`}
                            >
                                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                    selectedIndex === idx 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                                    : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500'
                                }`}>
                                    <Tag size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <span className={`text-xs font-black tracking-tight transition-colors ${selectedIndex === idx ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>
                                            <HighlightText text={p.itemNo} highlight={searchTerm} />
                                        </span>
                                        {p.price && (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                <DollarSign size={10} />{p.price.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                    <div className={`text-[11px] leading-relaxed transition-colors ${selectedIndex === idx ? 'text-blue-600/80 dark:text-blue-400/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                        <HighlightText text={p.description || ''} highlight={searchTerm} />
                                    </div>
                                    {p.dimensions && (
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-tighter bg-slate-100 dark:bg-slate-900 text-slate-400 px-1 rounded">
                                                {p.dimensions}
                                            </span>
                                            {p.grade && (
                                                <span className="text-[9px] font-bold uppercase tracking-tighter bg-blue-50 dark:bg-blue-900/30 text-blue-500 px-1 rounded">
                                                    {p.grade}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className={`mt-2 transition-all ${selectedIndex === idx ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>
                                    <ChevronRight size={16} className="text-blue-500" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {filtered.length > 0 && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[9px] font-bold shadow-sm">↑↓</kbd>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Navigate</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[9px] font-bold shadow-sm">Enter</kbd>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Select</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Dismiss</button>
                </div>
            )}
        </div>
    );

    return createPortal(content, document.body);
};

interface TableRowProps {
  row: ParsedLine;
  onUpdateRow: (id: string, field: keyof ParsedLine, value: any) => void;
  visibleColumns: (keyof ParsedLine | 'status' | 'totalLm' | 'annotations')[];
  isActive: boolean;
  onRowClick?: (id: string) => void;
  onDeleteAction?: (id: string) => void;
  isSelected: boolean;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  hasMultipleSources: boolean;
  onTeach?: (row: ParsedLine) => void;
  onInspect?: (row: ParsedLine) => void;
  onDuplicateRowAction?: (row: ParsedLine) => void;
  onAddAnnotationAction?: (rowId: string) => void;
  isSummary?: boolean;
  validationMessages?: string[];
  onOpenMoveMenuAction?: (id: string) => void;
  onOpenCatalogLookup: (rowId: string, field: 'spruceItemNo' | 'spruceDescription', ref: React.RefObject<HTMLTableCellElement>, currentVal: string) => void;
  onNavigate: (e: React.KeyboardEvent, direction: 'up' | 'down' | 'left' | 'right' | 'enter', columnKey: string) => void;
  catalog: CatalogProduct[];
  uiPreferences?: UiPreferences;
  isCommittingRef: React.RefObject<boolean>;
  isLookupOpen: boolean;
  rowRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandleProps?: any;
  allData: ParsedLine[];
  avgQty?: number;
}

// Added comment to address lint error: Explicitly using React.memo to ensure it refers to the imported React module.
const TableRow = React.memo<TableRowProps>(({
  row,
  onUpdateRow,
  visibleColumns,
  isActive,
  onRowClick,
  onDeleteAction,
  isSelected,
  onToggleSelect,
  onInspect,
  onDuplicateRowAction,
  onAddAnnotationAction,
  isSummary,
  onOpenMoveMenuAction,
  onOpenCatalogLookup,
  onNavigate,
  catalog,
  isCommittingRef,
  isLookupOpen,
  rowRef,
  style,
  dragHandleProps,
  allData,
  avgQty = 0
}) => {
  const internalRowRef = useRef<HTMLTableRowElement>(null);
  const spruceItemRef = useRef<HTMLTableCellElement>(null);
  const spruceDescRef = useRef<HTMLTableCellElement>(null);

  const onClick = useCallback(() => onRowClick?.(row.id), [onRowClick, row.id]);

  const setRefs = useCallback((node: HTMLTableRowElement | null) => {
    (internalRowRef as any).current = node;
    if (rowRef) rowRef(node);
  }, [rowRef]);

  const rowLatestRef = useRef(row);
  useEffect(() => { rowLatestRef.current = row; }, [row]);

  useEffect(() => {
    if (isActive && internalRowRef.current && document.activeElement?.closest('tr') !== internalRowRef.current) {
        internalRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (isLookupOpen && (key === 'spruceItemNo' || key === 'spruceDescription')) {
        if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return;
    }

    const isTextarea = e.currentTarget.tagName === 'TEXTAREA';
    const selectionStart = (e.currentTarget as any).selectionStart;
    const selectionEnd = (e.currentTarget as any).selectionEnd;
    const textLength = (e.currentTarget as any).value.length;
    
    if (e.key === 'ArrowUp') onNavigate(e, 'up', key);
    else if (e.key === 'ArrowDown') onNavigate(e, 'down', key);
    else if (e.key === 'ArrowLeft') { if (!isTextarea || selectionStart === 0) onNavigate(e, 'left', key); }
    else if (e.key === 'ArrowRight') { if (!isTextarea || selectionEnd === textLength) onNavigate(e, 'right', key); }
    else if (e.key === 'Enter') onNavigate(e, 'enter', key);
  };

  const handleSpruceFocus = (field: 'spruceItemNo' | 'spruceDescription', ref: React.RefObject<HTMLTableCellElement>, val: string) => {
      onClick();
      onOpenCatalogLookup(row.id, field, ref, val);
  };

  const handleBlur = (field: 'spruceItemNo' | 'spruceDescription') => {
    setTimeout(() => {
        if (!isCommittingRef.current) {
            onOpenCatalogLookup(row.id, field, { current: null } as any, ""); 
        }
    }, 150);
  };

  const precomputed = useMemo(() => ({ avgQty }), [avgQty]);
  const anomalies = useMemo(() => detectRowAnomalies(row, allData, precomputed), [row, allData, precomputed]);

  const confidence = row.confidence ?? 1;
  const confidenceColor = confidence < 0.5 
      ? 'bg-red-50/30 dark:bg-red-900/10' 
      : confidence < 0.8 
          ? 'bg-amber-50/30 dark:bg-amber-900/10' 
          : '';

  const renderCellContent = (key: keyof ParsedLine | 'totalLm', row: ParsedLine, onUpdate: (id: string, field: keyof ParsedLine, value: any) => void, isActive: boolean) => {
    const isLocked = row.locked;
    const confidence = row.confidence ?? 1;
    
    // Confidence heatmap colors
    const confidenceColor = confidence < 0.5 
        ? 'bg-red-50/50 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/50' 
        : confidence < 0.8 
            ? 'bg-amber-50/50 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/50' 
            : 'bg-white/50 dark:bg-slate-900/50 border-transparent';

    const commonClasses = `cell-input w-full ${confidenceColor} border hover:border-slate-200 dark:hover:border-slate-700 rounded px-1 py-0.5 outline-none text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 dark:focus:border-blue-500 transition-all duration-200 leading-relaxed text-left`;
    const finalClasses = isLocked ? `${commonClasses} bg-transparent text-slate-500 cursor-not-allowed border-none` : commonClasses;
    
    switch (key) {
    case 'item': {
            const filteredNotes = (row.parsingNotes || []).filter(n => 
                !n.includes('Source:') && 
                n !== 'Auto-Detected Split' && 
                !n.includes('mapped to Spruce') && 
                !n.toLowerCase().includes('auto-mapped') && 
                !n.includes('LM_FALLBACK') &&
                !n.includes('CODE_EXACT') &&
                !n.includes('MEMORY') &&
                !n.includes('RULE_BRACING') &&
                !n.startsWith('Mapped from')
            );
            return (
                 <div className="flex flex-col w-full h-full justify-center">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <DynamicInput value={row.item} onChange={(e) => onUpdate(row.id, 'item', e.target.value)} onKeyDown={(e) => handleKeyDown(e, 'item')} onFocus={onClick} data-col-key="item" data-row-id={row.id} className={`${finalClasses} font-medium whitespace-normal break-words`} autoFocus={row.isNew && isActive} readOnly={isLocked} />
                        </div>
                    </div>
                    {filteredNotes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 animate-in fade-in zoom-in-95">
                            {filteredNotes.map((note, i) => (
                                <span key={i} className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0 rounded-full flex items-center gap-1 border border-amber-100 dark:border-amber-800/50 whitespace-normal break-words"><AlertCircle size={8} />{note}</span>
                            ))}
                        </div>
                    )}
                 </div>
            );
        }
        case 'spruceItemNo':
            return (
                <div className="relative group/spruce">
                    <DynamicInput value={row.spruceItemNo || ''} onFocus={() => handleSpruceFocus('spruceItemNo', spruceItemRef, row.spruceItemNo || '')} onBlur={() => handleBlur('spruceItemNo')} onKeyDown={(e) => handleKeyDown(e, 'spruceItemNo')} data-col-key="spruceItemNo" data-row-id={row.id} onChange={(e) => { onUpdate(row.id, 'spruceItemNo', e.target.value); onOpenCatalogLookup(row.id, 'spruceItemNo', spruceItemRef, e.target.value); }} className={`${finalClasses} text-xs whitespace-normal break-all ${row.spruceMapped ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`} placeholder="Search Code..." readOnly={isLocked} />
                    {row.spruceMapped && <div className="absolute -right-1 -top-1"><CheckCircle size={10} className="text-blue-500 bg-white dark:bg-slate-900 rounded-full" /></div>}
                </div>
            );
        case 'spruceDescription':
            return (
                <div className="relative">
                    <DynamicInput value={row.spruceDescription || ''} onFocus={() => handleSpruceFocus('spruceDescription', spruceDescRef, row.spruceDescription || '')} onBlur={() => handleBlur('spruceDescription')} onKeyDown={(e) => handleKeyDown(e, 'spruceDescription')} data-col-key="spruceDescription" data-row-id={row.id} onChange={(e) => { onUpdate(row.id, 'spruceDescription', e.target.value); onOpenCatalogLookup(row.id, 'spruceDescription', spruceDescRef, e.target.value); }} className={`${finalClasses} text-xs whitespace-normal break-words ${row.spruceMapped ? 'text-blue-700 dark:text-blue-300 font-medium italic' : 'text-slate-700 dark:text-slate-200'}`} placeholder="Catalog Search..." readOnly={isLocked} />
                </div>
            );
        case 'spruceGroup':
            return (
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase py-1 flex items-start gap-1 whitespace-normal break-words text-left">
                    {row.spruceGroup && <Tag size={10} className="opacity-50 mt-0.5 shrink-0" />}
                    {row.spruceGroup || ''}
                </div>
            );
        case 'spruceSection':
            return (
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase py-1 flex items-start gap-1 whitespace-normal break-words text-left">
                    {row.spruceSection && <Layers size={10} className="opacity-50 mt-0.5 shrink-0" />}
                    {row.spruceSection || ''}
                </div>
            );
        case 'description': return <DynamicInput value={row.description || ''} onChange={(e) => onUpdate(row.id, 'description', e.target.value)} onKeyDown={(e) => handleKeyDown(e, 'description')} onFocus={onClick} data-col-key="description" data-row-id={row.id} className={`${finalClasses} whitespace-normal break-words`} readOnly={isLocked} />;
        case 'qty': {
            const formulaResult = evaluateFormula(String(row.qty || ''), row);
            return (
                <div className="relative group/qty">
                    <input 
                        type="text" 
                        value={row.qty} 
                        onChange={(e) => onUpdate(row.id, 'qty', e.target.value)} 
                        onKeyDown={(e) => handleKeyDown(e, 'qty')} 
                        onFocus={onClick} 
                        data-col-key="qty" 
                        data-row-id={row.id} 
                        className={`${finalClasses} cell-input no-spinner text-left font-bold text-blue-600 dark:text-blue-400`} 
                        readOnly={isLocked} 
                    />
                    {formulaResult !== null && (
                        <div className="absolute -bottom-4 left-0 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-1">
                            = {formulaResult.toFixed(2)}
                        </div>
                    )}
                </div>
            );
        }
        case 'length': return <input type="number" value={row.length || ''} onChange={(e) => onUpdate(row.id, 'length', e.target.value)} onKeyDown={(e) => handleKeyDown(e, 'length')} onFocus={onClick} data-col-key="length" data-row-id={row.id} className={`${finalClasses} cell-input no-spinner text-left ${!row.length ? 'opacity-30 dark:opacity-40' : ''}`} placeholder="-" readOnly={isLocked} />;
        case 'totalLm':
            return (
                <div className="text-left font-mono text-slate-500 flex items-center justify-start h-full px-1 py-0.5">
                    {row.unit === 'L/M' && row.qty && row.length 
                        ? (row.qty * row.length).toFixed(2) 
                        : <span className="opacity-20 text-slate-400 font-sans">–</span>}
                </div>
            );
        case 'formula':
            return (
                <div className="relative group/formula">
                    <DynamicInput 
                        value={row.formula || ''} 
                        onChange={(e) => onUpdate(row.id, 'formula', e.target.value)} 
                        onKeyDown={(e) => handleKeyDown(e, 'formula')} 
                        onFocus={onClick} 
                        data-col-key="formula" 
                        data-row-id={row.id} 
                        className={`${finalClasses} text-[10px] font-mono whitespace-normal break-all`} 
                        placeholder="e.g. QTY * 1.05"
                        readOnly={isLocked} 
                    />
                    <Calculator size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                </div>
            );
        case 'unit': return (
                <div className="relative h-full flex items-center">
                    <select value={row.unit} onChange={(e) => onUpdate(row.id, 'unit', e.target.value)} onKeyDown={(e) => handleKeyDown(e, 'unit')} onFocus={onClick} data-col-key="unit" data-row-id={row.id} className={`${finalClasses} cell-input appearance-none cursor-pointer font-medium text-xs w-full text-left`} disabled={isLocked}>
                        <option value="L/M">L/M</option>
                        <option value="EA">EA</option>
                        <option value="m2">m2</option>
                    </select>
                </div>
            );
        case 'price': {
            const product = catalog.find(p => p.itemNo === row.spruceItemNo);
            const hasHistory = product && product.priceHistory && product.priceHistory.length > 0;
            
            return (
                <div className="flex items-center justify-between group/price px-1">
                    <div className="text-left text-emerald-600 dark:text-emerald-400 whitespace-nowrap flex items-center justify-start h-full py-0.5 leading-relaxed">
                        <span className="text-[10px] opacity-50 mr-0.5">$</span>
                        {(row.price || 0).toFixed(2)}
                        <span className="text-[9px] opacity-40 ml-1 text-slate-500 font-medium">/{row.unit === 'L/M' ? 'LM' : row.unit === 'm2' ? 'm2' : 'EA'}</span>
                    </div>
                    {hasHistory && (
                        <div className="flex items-center gap-0.5 text-blue-500 opacity-0 group-hover/price:opacity-100 transition-opacity" title="Price Benchmarking Available">
                            <TrendingUp size={12} />
                        </div>
                    )}
                </div>
            );
        }
        case 'total': return <div className="text-left font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap flex items-center justify-start h-full px-1">{row.total?.toFixed(2) || '0.00'}</div>;
        case 'totalPrice': return (
            <div 
                className="text-left font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap flex items-center justify-start h-full px-1 py-0.5 leading-relaxed"
                title={row.unit === 'L/M' ? `Total = $/LM × (Qty ${row.qty} × Len ${row.length})` : undefined}
            >
                <span className="text-[10px] opacity-50 mr-0.5">$</span>
                {(row.totalPrice || 0).toFixed(2)}
            </div>
        );
        case 'dimensions': {
            const takeoffDim = normalizeDimensions(row.dimensions);
            const catalogDim = normalizeDimensions(row.spruceDescription || '');
            let isMismatch = false;
            
            if (row.spruceMapped && row.spruceItemNo !== 'PIDRRDM') {
                const prod = catalog.find(p => p.itemNo === row.spruceItemNo);
                const currentLineSheetDims = parseSheetDimsFromLine(row.dimensions);
                
                if (prod && prod.sheetDimsMm && currentLineSheetDims) {
                    const match = sheetDimsMatch(currentLineSheetDims, prod.sheetDimsMm);
                    isMismatch = !match.ok;
                } else {
                    isMismatch = takeoffDim && catalogDim && !catalogDim.includes(takeoffDim);
                }
            }

            return (
                <div className="relative flex items-center gap-1 group/dim">
                    <DynamicInput 
                        value={row.dimensions} 
                        onChange={(e) => onUpdateRow(row.id, 'dimensions', e.target.value)} 
                        onKeyDown={(e) => handleKeyDown(e, 'dimensions')} 
                        onFocus={onClick} 
                        data-col-key="dimensions" 
                        data-row-id={row.id} 
                        className={`${finalClasses} text-xs whitespace-normal break-all text-left ${isMismatch ? 'text-red-600 dark:text-red-400 ring-1 ring-red-500/50' : ''}`} 
                        readOnly={isLocked} 
                    />
                    {isMismatch && (
                        <div className="shrink-0 text-red-500" title="Dimension mismatch: Interpreted sheet size differs significantly from ERP catalog data.">
                            <AlertTriangle size={12} />
                        </div>
                    )}
                </div>
            );
        }
        case 'grade':
        case 'section':
        case 'subSection': return <DynamicInput value={row[key as keyof ParsedLine] as string || ''} onChange={(e) => onUpdateRow(row.id, key as keyof ParsedLine, e.target.value)} onKeyDown={(e) => handleKeyDown(e, key as keyof ParsedLine)} onFocus={onClick} data-col-key="key" data-row-id={row.id} className={`${finalClasses} whitespace-normal break-words text-left ${key === 'section' ? 'font-semibold text-slate-600 dark:text-slate-200' : ''} ${key === 'subSection' ? 'text-slate-600 dark:text-slate-200' : ''}`} readOnly={isLocked} />;
        case 'annotations':
            return (
                <div className="flex items-center gap-1 group/notes">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddAnnotationAction?.(row.id); }}
                        className={`p-1 rounded-lg transition-all ${row.annotations?.length ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <MessageSquare size={14} />
                    </button>
                    {row.annotations?.length ? (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            {row.annotations.length}
                        </span>
                    ) : null}
                </div>
            );
        default: return <span className="text-slate-400 italic">N/A</span>;
    }
  };

  if (!row) return null;

  return (
    <tr ref={setRefs} style={style} className={`group border-b border-slate-100 dark:border-slate-800 transition-all duration-200 ease-out ${isActive ? 'bg-blue-50/80 dark:bg-blue-900/20 shadow-[inset_3px_0_0_0] shadow-blue-500 z-10 relative' : isSelected ? 'bg-blue-50/40 dark:bg-blue-900/10' : row.locked ? 'bg-slate-50/50 dark:bg-slate-900/50' : isSummary ? 'bg-amber-50/50 dark:bg-amber-900/10' : confidenceColor || 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`} onClick={onClick}>
        <td className="px-1 py-1.5 border-r border-slate-100 dark:border-slate-800 align-top w-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center justify-center pt-1.5 gap-2">
                <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors">
                    <GripHorizontal size={14} />
                </div>
                <button onClick={(e) => onToggleSelect(row.id, e.shiftKey)} className={`transition-all duration-200 transform active:scale-90 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}>{isSelected ? <CheckSquare size={14} /> : <Square size={14} />}</button>
            </div>
        </td>
        {visibleColumns.map(colKey => {
            if (colKey === 'status') {
                 return (
                    <td key={colKey} className="px-1 py-1.5 border-r border-slate-100 dark:border-slate-800 text-left align-top relative w-8">
                        <div className="flex flex-col items-start gap-1 pt-2 group/status">
                            {row.locked ? <div title="Group Locked"><Lock size={12} className="text-slate-400" /></div> : isSummary ? <div title="Stated Total / Summary Line"><Calculator size={12} className="text-amber-500" /></div> : (
                                <div className="relative group/status-dot flex flex-col items-start gap-1.5">
                                    <div className={`w-2 h-2 rounded-full cursor-help transition-all duration-300 hover:scale-150 ${(row.confidence || 0) > 0.8 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : (row.confidence || 0) > 0.5 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'}`} />
                                    
                                    {anomalies.length > 0 && (
                                        <div className="text-red-500 animate-pulse" title={`${anomalies.length} anomalies detected`}>
                                            <AlertTriangle size={12} />
                                        </div>
                                    )}

                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover/status-dot:block z-[100] animate-in fade-in slide-in-from-left-1 duration-150 pointer-events-none">
                                        <div className="bg-slate-900/95 backdrop-blur-md text-white text-[11px] px-3 py-2.5 rounded-xl shadow-2xl border border-white/10 min-w-[200px] max-w-[280px] leading-relaxed relative ring-1 ring-black/50">
                                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-slate-900/95"></div>
                                            <div className="flex flex-col gap-2.5">
                                                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-0.5">
                                                    <span className="font-black text-slate-400 uppercase text-[9px] tracking-widest">Mapping Insight</span>
                                                    {row.confidence !== undefined && (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${row.confidence > 0.8 ? 'bg-emerald-500/20 text-emerald-400' : row.confidence > 0.5 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                                            {Math.round(row.confidence * 100)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-medium whitespace-normal break-words text-slate-200">{row.matchReason || (row.spruceMapped ? "Matched, no reason available." : "No match found.")}</span>
                                                
                                                {anomalies.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
                                                        <span className="font-black text-red-400 uppercase text-[9px] tracking-widest block">Anomalies Detected</span>
                                                        {anomalies.map((a, i) => (
                                                            <div key={i} className="flex items-start gap-2 text-[10px]">
                                                                <AlertTriangle size={10} className="text-red-500 mt-0.5 shrink-0" />
                                                                <span className="text-red-200">{a.message}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </td>
                 );
            }
            return <td key={colKey} ref={colKey === 'spruceItemNo' ? spruceItemRef : colKey === 'spruceDescription' ? spruceDescRef : null} className="px-1 py-1.5 border-r border-slate-100 dark:border-slate-800 align-top overflow-hidden text-left">{renderCellContent(colKey, row, onUpdateRow, isActive)}</td>;
        })}
        <td className="px-1 py-1.5 text-left align-top w-12 relative">
             {!row.locked && (
                 <div className="flex items-center justify-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pt-1">
                    {onOpenMoveMenuAction && <button onClick={(e) => { e.stopPropagation(); onOpenMoveMenuAction(row.id); }} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors" title="Move to Group"><ArrowRightLeft size={12} /></button>}
                    <button onClick={(e) => { e.stopPropagation(); onTeach?.(row); }} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors" title="Teach AI Mapping"><BrainCircuit size={12} /></button>
                    {onInspect && <button onClick={(e) => { e.stopPropagation(); onInspect(row); }} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors" title="Inspect Parsing Logic"><Search size={12} /></button>}
                    {onDuplicateRowAction && <button onClick={(e) => { e.stopPropagation(); onDuplicateRowAction(row); }} className="p-0.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors" title="Duplicate Row"><Plus size={12} /></button>}
                    {onDeleteAction && <button onClick={(e) => { e.stopPropagation(); onDeleteAction(row.id); }} className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors" title="Delete Row"><Trash2 size={12} /></button>}
                 </div>
             )}
        </td>
    </tr>
  );
});

import { TeachModal } from './TeachModal';
import { MemoryItem } from '../types';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps extends TableRowProps {
  id: string;
}

const SortableRow = React.memo((props: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.id });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }), [transform, transition, isDragging]);

  return (
    <TableRow 
      {...props} 
      rowRef={setNodeRef} 
      style={style} 
      dragHandleProps={{ ...attributes, ...listeners }} 
      allData={props.allData}
    />
  );
});

export const PreviewTable: React.FC<PreviewTableProps> = ({ 
  allData, data, onUpdateRow, activeRowId, onRowClick, catalog = [], onAddRow, onDeleteRow, onBulkUpdate, onBulkDelete, onInspect, onDuplicateRow, onExport, onVerify, onAddAnnotation, uiPreferences,
  onTotalWidthReport, pineWastagePct, savedColumnWidths, onSaveColumnWidths, onReparse, isReparsing, onSmartMatch,
  onUndo, onRedo, canUndo, canRedo, onReorderRows,
  activeProfile, onProfileChange, onManageProfiles, onAiGenerateProfile, isAiGenerating = false
}) => {
  const [filterText, setFilterText] = useState('');
  const avgQty = useMemo(() => {
    if (!allData || allData.length === 0) return 0;
    return allData.reduce((acc, r) => acc + (r.qty || 0), 0) / allData.length;
  }, [allData]);
  const deferredFilterText = useDeferredValue(filterText);
  const deferredData = useDeferredValue(data);
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isGrouped, setIsGrouped] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<(keyof ParsedLine | 'status' | 'totalLm')[]>(DEFAULT_ORDER);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set(['description', 'section', 'spruceGroup', 'spruceSection'])); 
  const [userTouchedGroupVisibility, setUserTouchedGroupVisibility] = useState(false); // Flag to track manual overrides
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [moveMenuRowId, setMoveMenuRowId] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [bulkMenuMode, setBulkMenuMode] = useState<'none' | 'move' | 'edit' | 'replace'>('none');
  const [bulkEditField, setBulkEditField] = useState<keyof ParsedLine | ''>('');
  const [bulkEditValue, setBulkEditValue] = useState<string>('');
  const [bulkSearchTerm, setBulkSearchTerm] = useState<string>('');
  const [bulkReplaceTerm, setBulkReplaceTerm] = useState<string>('');
  const [catalogLookup, setCatalogLookup] = useState<{ rowId: string; field: 'spruceItemNo' | 'spruceDescription'; targetRef: React.RefObject<HTMLTableCellElement>; searchTerm: string; } | null>(null);
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(-1);
  const [showPineWastage, setShowPineWastage] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hasSavedWidths, setHasSavedWidths] = useState(!!savedColumnWidths && Object.keys(savedColumnWidths).length > 0);
  const [teachRow, setTeachRow] = useState<ParsedLine | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = processedData.findIndex(item => item.id === active.id);
      const newIndex = processedData.findIndex(item => item.id === over.id);
      const newOrder = arrayMove(processedData, oldIndex, newIndex);
      if (onReorderRows) onReorderRows(newOrder);
    }
  };
  
  const lastWidthReported = useRef(0);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
      const widths = { ...DEFAULT_WIDTHS, ...(savedColumnWidths || {}) };
      widths.status = 50;
      return widths;
  });
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setshowBulkDeleteConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const isCommittingRef = useRef(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
        setShowScrollTop(container.scrollTop > 400);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Stable Row Callbacks to minimize re-renders
  const handleInspectRow = useCallback((row: ParsedLine) => {
    onInspect?.(row);
  }, [onInspect]);

  const handleDuplicateRowAction = useCallback((row: ParsedLine) => {
    onDuplicateRow?.(row);
  }, [onDuplicateRow]);

  const handleAddAnnotationAction = useCallback((id: string) => {
    onAddAnnotation?.(id);
  }, [onAddAnnotation]);

  const handleOpenRowMoveMenu = useCallback((id: string) => {
    onRowClick(id);
    setMoveMenuRowId(id);
    setBulkMenuMode('move');
  }, [onRowClick, setMoveMenuRowId, setBulkMenuMode]);

  const handleOpenTeach = useCallback((row: ParsedLine) => {
    setTeachRow(row);
  }, [setTeachRow]);

  const handleDeleteRowAction = useCallback((id: string) => {
     setDeleteCandidateId(id);
  }, [setDeleteCandidateId]);

  const mappingStats = useMemo(() => {
      const total = allData.length;
      if (total === 0) return { count: 0, percent: 0 };
      const mapped = allData.filter(r => r.spruceMapped).length;
      return { count: mapped, percent: Math.round((mapped / total) * 100) };
  }, [allData]);

  const visibleColumns = useMemo(() => columnOrder.filter(col => !hiddenColumns.has(col)), [columnOrder, hiddenColumns]);

  const filteredData = useMemo(() => {
    let result = [...deferredData];
    if (showOnlyUnmapped) result = result.filter(row => !row.spruceMapped);
    
    if (deferredFilterText) {
      const low = deferredFilterText.toLowerCase();
      result = result.filter(row => 
        row.item.toLowerCase().includes(low) || 
        row.section.toLowerCase().includes(low) || 
        row.subSection.toLowerCase().includes(low) || 
        row.dimensions.toLowerCase().includes(low) || 
        row.grade.toLowerCase().includes(low) || 
        (row.spruceItemNo && row.spruceItemNo.toLowerCase().includes(low)) || 
        (row.spruceDescription && row.spruceDescription.toLowerCase().includes(low)) || 
        (row.description && row.description.toLowerCase().includes(low))
      );
    }
    return result;
  }, [deferredData, deferredFilterText, showOnlyUnmapped]);

  const processedData = (() => {
    if (!sortConfig) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const { key, direction } = sortConfig;
      const aVal = key === 'status' ? (a.confidence ?? 0) : key === 'totalLm' ? (a.unit === 'L/M' ? a.total : 0) : a[key as keyof ParsedLine];
      const bVal = key === 'status' ? (b.confidence ?? 0) : key === 'totalLm' ? (b.unit === 'L/M' ? b.total : 0) : b[key as keyof ParsedLine];
      
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  useEffect(() => {
    const handleUndoRedoKeys = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            if (e.shiftKey) {
                if (onRedo) { e.preventDefault(); onRedo(); }
            } else {
                if (onUndo) { e.preventDefault(); onUndo(); }
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            if (onRedo) { e.preventDefault(); onRedo(); }
        }
    };

    window.addEventListener('keydown', handleUndoRedoKeys);
    return () => window.removeEventListener('keydown', handleUndoRedoKeys);
  }, [onUndo, onRedo]);

  const handleToggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedItems(prev => {
        const next = new Set(prev);
        const targetIsCurrentlySelected = next.has(id);
        
        if (shiftKey && lastSelectedId && lastSelectedId !== id) {
            const lastIdx = processedData.findIndex(d => d.id === lastSelectedId);
            const currentIdx = processedData.findIndex(d => d.id === id);
            
            if (lastIdx !== -1 && currentIdx !== -1) {
                const start = Math.min(lastIdx, currentIdx);
                const end = Math.max(lastIdx, currentIdx);
                
                // Standard behavior: if current is being selected, select range.
                const shouldSelect = !targetIsCurrentlySelected;
                
                for (let i = start; i <= end; i++) {
                    if (shouldSelect) next.add(processedData[i].id);
                    else next.delete(processedData[i].id);
                }
                setLastSelectedId(id);
                return next;
            }
        }
        
        if (targetIsCurrentlySelected) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setLastSelectedId(id);
        return next;
    });
  }, [processedData, lastSelectedId]);

  /**
   * Auto fits a single target column based on visible data.
   */
  const handleAutoFitColumn = useCallback((colKey: string) => {
      const newWidth = measureColumnWidth(colKey, processedData.slice(0, 200));
      setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
      setHasSavedWidths(true);
  }, [processedData, setColumnWidths]);

  /**
   * Auto fits all currently visible columns.
   */
  const handleAutoFitAll = useCallback(() => {
      const newWidths = { ...columnWidths };
      const sample = processedData.slice(0, 200);
      
      visibleColumns.forEach(col => {
          newWidths[col as string] = measureColumnWidth(col as string, sample);
      });
      
      setColumnWidths(newWidths);
      setHasSavedWidths(true);
  }, [processedData, visibleColumns, columnWidths, setColumnWidths]);

  // CONTENT-AWARE AUTO COLUMN WIDTHS (Initial only if no saved widths)
  const [hasAutoFitted, setHasAutoFitted] = useState(false);
  if (allData.length > 0 && !hasSavedWidths && !hasAutoFitted) {
      setHasAutoFitted(true);
      handleAutoFitAll();
  }

  // AUTO TOGGLE GROUP COLUMN VISIBILITY
  const [prevIsGrouped, setPrevIsGrouped] = useState(isGrouped);
  if (isGrouped !== prevIsGrouped && !userTouchedGroupVisibility) {
      setPrevIsGrouped(isGrouped);
      setHiddenColumns(prev => {
          const next = new Set(prev);
          if (isGrouped) {
              next.add('section'); // Key for Group column is 'section'
          } else {
              next.delete('section');
          }
          return next;
      });
  }

  // TOTAL REQUIRED WIDTH REPORTING
  useEffect(() => {
      if (onTotalWidthReport) {
          // Calculate total width including selection column, columns, and actions column (20px each side)
          const totalWidth = visibleColumns.reduce((sum, col) => sum + (columnWidths[col as string] || 100), 20 + 60);
          if (totalWidth !== lastWidthReported.current) {
              onTotalWidthReport(totalWidth);
              lastWidthReported.current = totalWidth;
          }
      }
  }, [columnWidths, visibleColumns, onTotalWidthReport]);

  const lookupFilteredCatalog = useMemo(() => {
    return getRelevanceSortedResults(catalog, catalogLookup?.searchTerm || '');
  }, [catalog, catalogLookup?.searchTerm]);

  const handleSelectProduct = useCallback((product: CatalogProduct) => {
      if (!catalogLookup) return;
      const targetRowId = catalogLookup.rowId;
      isCommittingRef.current = true;
      setCatalogLookup(null);
      setDropdownSelectedIndex(-1);
      onUpdateRow(targetRowId, 'spruceItemNo', product.itemNo);
      queueMicrotask(() => { isCommittingRef.current = false; });
  }, [catalogLookup, onUpdateRow]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (!catalogLookup) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setDropdownSelectedIndex(prev => (prev < lookupFilteredCatalog.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDropdownSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            if (dropdownSelectedIndex >= 0 && dropdownSelectedIndex < lookupFilteredCatalog.length) {
                e.preventDefault();
                handleSelectProduct(lookupFilteredCatalog[dropdownSelectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setCatalogLookup(null);
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [catalogLookup, lookupFilteredCatalog, dropdownSelectedIndex, handleSelectProduct]);

  const sectionNames = useMemo(() => Array.from(new Set(allData.map(d => d.section || 'Unspecified'))).sort(), [allData]);

  const [isResizing, setIsResizing] = useState(false);

    const [resizingGuideX, setResizingGuideX] = useState<number | null>(null);

    useEffect(() => {
        if (isResizing) {
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.removeProperty('user-select');
            setTimeout(() => setResizingGuideX(null), 0);
        }
    }, [isResizing]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!resizingRef.current) return;
        const { col, startX, startWidth } = resizingRef.current;
        const diff = e.clientX - startX;
        setColumnWidths(prev => ({ ...prev, [col]: Math.max(20, startWidth + diff) }));
        setHasSavedWidths(true);
        setResizingGuideX(e.clientX);
    }, [setColumnWidths]);

  const handleMouseUp = useCallback(() => {
      if (resizingRef.current && onSaveColumnWidths) {
          onSaveColumnWidths(columnWidths);
      }
      resizingRef.current = null;
      setIsResizing(false);
  }, [columnWidths, onSaveColumnWidths]);

  const startResize = (col: string, e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      resizingRef.current = { col, startX: e.clientX, startWidth: columnWidths[col] || 100 };
      setIsResizing(true);
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleColumnDragStart = (e: React.DragEvent, colId: string) => { setDraggedColumnId(colId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', colId); };
  const handleColumnDragOver = (e: React.DragEvent, targetColId: string) => { e.preventDefault(); if (draggedColumnId === targetColId) return; e.dataTransfer.dropEffect = 'move'; };
  const handleColumnDrop = (e: React.DragEvent, targetColId: string) => {
      e.preventDefault();
      if (!draggedColumnId || draggedColumnId === targetColId) { setDraggedColumnId(null); return; }
      setColumnOrder(prev => {
          const newOrder = [...prev];
          const draggedIdx = newOrder.indexOf(draggedColumnId as any);
          const targetIdx = newOrder.indexOf(targetColId as any);
          if (draggedIdx === -1 || targetIdx === -1) return prev;
          newOrder.splice(draggedIdx, 1);
          newOrder.splice(targetIdx, 0, draggedColumnId as any);
          return newOrder;
      });
      setDraggedColumnId(null);
  };

  const groupedData = useMemo(() => {
      if (!isGrouped) return [['All Items', processedData]] as const;
      const groupMap = new Map<string, ParsedLine[]>();
      processedData.forEach(row => {
          const key = row.section || 'Unspecified';
          if (!groupMap.has(key)) groupMap.set(key, []);
          groupMap.get(key)!.push(row);
      });
      return sortConfig ? Array.from(groupMap.entries()).sort((a, b) => a[0].localeCompare(b[0])) : Array.from(groupMap.entries());
  }, [processedData, isGrouped, sortConfig]);

  const handleOpenLookup = (rowId: string, field: 'spruceItemNo' | 'spruceDescription', ref: React.RefObject<HTMLTableCellElement>, val: string) => {
    setCatalogLookup({ rowId, field, targetRef: ref, searchTerm: val });
    setDropdownSelectedIndex(-1);
  };

  const handleBulkMove = (sectionName: string) => { 
    if (onBulkUpdate) { 
        const targets = moveMenuRowId ? [moveMenuRowId] : Array.from(selectedItems);
        onBulkUpdate(targets, 'section', sectionName); 
        setBulkMenuMode('none'); 
        setMoveMenuRowId(null);
        // Only clear selection if we were doing a bulk move
        if (!moveMenuRowId) {
            setSelectedItems(new Set()); 
            setLastSelectedId(null);
        }
    } 
  };
  
  const handleBulkEditApply = () => {
      if (onBulkUpdate && bulkEditField && bulkEditValue) {
          let finalVal: any = bulkEditValue;
          if (bulkEditField === 'qty' || bulkEditField === 'length') finalVal = parseFloat(bulkEditValue);
          onBulkUpdate(Array.from(selectedItems), bulkEditField as keyof ParsedLine, finalVal);
          setBulkMenuMode('none'); setSelectedItems(new Set()); setBulkEditField(''); setBulkEditValue('');
          setLastSelectedId(null);
      }
  };

  const [bulkSearchRegex, setBulkSearchRegex] = useState(false);
  const [bulkSearchCaseSensitive, setBulkSearchCaseSensitive] = useState(false);

  const handleBulkReplaceApply = () => {
      if (onUpdateRow && bulkEditField && bulkSearchTerm !== '') {
          const targets = Array.from(selectedItems);
          
          targets.forEach(id => {
              const row = allData.find(r => r.id === id);
              if (row) {
                  const currentVal = String(row[bulkEditField as keyof ParsedLine] || '');
                  let newVal = currentVal;
                  let hasMatch = false;

                  try {
                      const flags = bulkSearchCaseSensitive ? 'g' : 'gi';
                      const pattern = bulkSearchRegex ? bulkSearchTerm : bulkSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const re = new RegExp(pattern, flags);
                      
                      if (re.test(currentVal)) {
                          hasMatch = true;
                          newVal = currentVal.replace(re, bulkReplaceTerm);
                      }

                      if (hasMatch && newVal !== currentVal) {
                          onUpdateRow(id, bulkEditField as keyof ParsedLine, newVal);
                      }
                  } catch (e) {
                      console.error("Regex error:", e);
                  }
              }
          });
          
          setBulkMenuMode('none'); 
          setSelectedItems(new Set()); 
          setBulkEditField(''); 
          setBulkSearchTerm(''); 
          setBulkReplaceTerm('');
          setBulkSearchRegex(false);
          setBulkSearchCaseSensitive(false);
          setLastSelectedId(null);
      }
  };

  const handleNavigate = useCallback((e: React.KeyboardEvent, direction: 'up' | 'down' | 'left' | 'right' | 'enter', columnKey: string) => {
    const activeElement = document.activeElement;
    if (!activeElement) return;
    const currentTr = activeElement.closest('tr');
    if (!currentTr) return;
    const table = currentTr.closest('table');
    if (!table) return;
    const inputs = Array.from(table.querySelectorAll('.cell-input')) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];
    const currentIndex = inputs.indexOf(activeElement as any);
    if (currentIndex === -1) return;
    const activateAndFocus = (target: HTMLElement | null) => {
        if (target) {
            e.preventDefault();
            const rowId = target.getAttribute('data-row-id');
            if (rowId) onRowClick(rowId);
            target.focus();
            if ('select' in target) (target as any).select();
        }
    };
    if (direction === 'left') { if (currentIndex > 0) activateAndFocus(inputs[currentIndex - 1]); }
    else if (direction === 'right') { if (currentIndex < inputs.length - 1) activateAndFocus(inputs[currentIndex + 1]); }
    else if (direction === 'up') {
        let prevTr = currentTr.previousElementSibling;
        while (prevTr && prevTr.querySelector('[colspan]')) prevTr = prevTr.previousElementSibling;
        if (prevTr) activateAndFocus(prevTr.querySelector(`[data-col-key="${columnKey}"]`) as HTMLElement);
    } else if (direction === 'down' || direction === 'enter') {
        let nextTr = currentTr.nextElementSibling;
        while (nextTr && nextTr.querySelector('[colspan]')) nextTr = nextTr.nextElementSibling;
        if (nextTr) activateAndFocus(nextTr.querySelector(`[data-col-key="${columnKey}"]`) as HTMLElement);
    }
  }, [onRowClick]);

  const getWastageIconColor = (pct: number) => {
    if (pct < 5) return 'text-green-600';
    if (pct <= 10) return 'text-yellow-500';
    return 'text-red-600';
  };

  const safeWastagePct = Math.max(0, Number(pineWastagePct) || 0);

  const handleSaveWidthsAsDefault = () => {
      if (onSaveColumnWidths) {
          onSaveColumnWidths(columnWidths);
          setHasSavedWidths(true);
          setShowColumnMenu(false);
      }
  };

  const handleResetToAutoWidths = () => {
      setHasSavedWidths(false);
      handleAutoFitAll();
      setShowColumnMenu(false);
  };

  const handleLearned = (mapping: MemoryItem) => {
    // Update the row that was just taught
    if (teachRow) {
      onUpdateRow(teachRow.id, 'spruceItemNo', mapping.itemNo);
      onUpdateRow(teachRow.id, 'spruceDescription', mapping.description);
      onUpdateRow(teachRow.id, 'spruceMapped', true);
      onUpdateRow(teachRow.id, 'mappingSource', 'MEMORY');
      onUpdateRow(teachRow.id, 'confidence', 1);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/20 dark:border-slate-800/50 overflow-hidden flex flex-col transition-all relative h-full group/table"
    >
      {teachRow && (
        <TeachModal 
          isOpen={!!teachRow} 
          onClose={() => setTeachRow(null)} 
          row={teachRow} 
          catalog={catalog || []} 
          onLearned={handleLearned} 
        />
      )}
      <div className="p-2 border-b border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex flex-col lg:flex-row gap-3 justify-between items-center sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto flex-1 pb-1 lg:pb-0">
            <div className="relative w-full min-w-[220px] lg:w-72 group shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-all" />
                </div>
                <input 
                    type="text" 
                    placeholder="Search takeoff items..." 
                    className="pl-9 pr-9 py-2 w-full bg-white/50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner" 
                    value={filterText} 
                    onChange={(e) => setFilterText(e.target.value)} 
                />
                {filterText && (
                    <motion.button 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => setFilterText('')} 
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </motion.button>
                )}
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {uiPreferences?.showCatalogMapping && (
                  <button 
                      data-mapping-indicator="true"
                      onClick={() => setShowOnlyUnmapped(!showOnlyUnmapped)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all hover:shadow-md active:scale-95 shrink-0 ${
                          showOnlyUnmapped 
                          ? 'bg-blue-600 border-blue-700 text-white shadow-lg ring-2 ring-blue-500/20' 
                          : mappingStats.percent > 90 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-100' 
                          : mappingStats.percent > 50 ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-100' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100'
                      }`} 
                      title={showOnlyUnmapped ? "Showing ONLY unmapped items. Click to show all." : `Click to filter: Showing ${mappingStats.count} of ${allData.length} items mapped to ERP catalog`}
                  >
                      <ShieldCheck size={12} className={showOnlyUnmapped ? 'text-blue-100' : mappingStats.percent > 70 ? 'text-emerald-500' : 'text-slate-400'} />
                      <span className="text-[10px] font-bold whitespace-nowrap">
                          {showOnlyUnmapped ? 'Unmapped' : `ERP: ${mappingStats.percent}%`}
                      </span>
                  </button>
              )}

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 shrink-0"></div>

              <button 
                  data-wastage-anchor="true"
                  onClick={() => setShowPineWastage(true)} 
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:shadow-md transition-all active:scale-95 shrink-0" 
                  title={`Pine Wastage: ${safeWastagePct.toFixed(1)}% (Click for analysis)`}
              >
                  <TrendingUp size={12} className={getWastageIconColor(safeWastagePct)} />
                  <span className="text-[10px] font-black uppercase tracking-tight">Wastage</span>
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block shrink-0"></div>

              <ProfileSelector 
                  currentProfile={activeProfile} 
                  onChangeProfile={onProfileChange} 
                  confidence={0} 
                  onManageProfiles={onManageProfiles}
                  onAiGenerateProfile={onAiGenerateProfile}
                  isAiGenerating={isAiGenerating}
              />

              <div className="flex items-center gap-1 ml-1 bg-slate-100 dark:bg-slate-800/50 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                  <button 
                      onClick={onUndo}
                      disabled={!canUndo}
                      aria-label="Undo"
                      className={`p-1.5 rounded-md transition-all ${canUndo ? 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}
                      title="Undo (Ctrl+Z)"
                  >
                        <Undo2 size={14} />
                  </button>
                  <button 
                      onClick={onRedo}
                      disabled={!canRedo}
                      aria-label="Redo"
                      className={`p-1.5 rounded-md transition-all ${canRedo ? 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}
                      title="Redo (Ctrl+Y)"
                  >
                      <Redo2 size={14} />
                  </button>
              </div>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto justify-end">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto scrollbar-hide">
                {uiPreferences?.showGroupControl && (
                    <button onClick={() => setIsGrouped(!isGrouped)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${isGrouped ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Layers size={12} /><span className="hidden sm:inline">Group</span></button>
                )}
                {uiPreferences?.showColumnsControl && (
                    <div className="relative">
                        <button onClick={() => setShowColumnMenu(!showColumnMenu)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${showColumnMenu ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Columns size={12} /><span className="hidden sm:inline">Columns</span></button>
                    </div>
                )}
            </div>

            {showScrollTop && (
                <button 
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 p-3 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all active:scale-95 z-50 animate-in fade-in slide-in-from-bottom-4"
                    title="Scroll to top"
                >
                    <ArrowUp size={20} />
                </button>
            )}

            {showColumnMenu && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowColumnMenu(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 overflow-hidden p-2 animate-in fade-in zoom-in-95 origin-top-right">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-2 mb-1 text-left border-b border-slate-50 dark:border-slate-700/50">Visibility & Sizing</div>
                                    <div className="px-2 py-2">
                                        <button 
                                            onClick={handleAutoFitAll}
                                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-all border border-emerald-100 dark:border-emerald-800/50 mb-1"
                                        >
                                            <Maximize2 size={14} /> Auto Fit All Columns
                                        </button>
                                    </div>
                                    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar px-1">
                                        {columnOrder.map(col => {
                                            if (col === 'status') return null; 
                                            const isVisible = !hiddenColumns.has(col);
                                            return (<button key={col} onClick={() => { 
                                                const next = new Set(hiddenColumns); 
                                                if (isVisible) next.add(col); else next.delete(col); 
                                                setHiddenColumns(next); 
                                                if (col === 'section') setUserTouchedGroupVisibility(true); // Track manual override
                                            }} className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"><span className={`font-medium ${isVisible ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>{COLUMN_LABELS[col as string]}</span>{isVisible ? <Check size={14} className="text-blue-500" /> : <EyeOff size={14} className="text-slate-400" />}</button>);
                                        })}
                                    </div>
                                    <div className="border-t border-slate-100 dark:border-slate-700 mt-2 pt-2 flex flex-col gap-1">
                                        <button 
                                            onClick={handleSaveWidthsAsDefault}
                                            className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-all"
                                        >
                                            <Save size={12} /> Save as default
                                        </button>
                                        {hasSavedWidths && (
                                            <button 
                                                onClick={handleResetToAutoWidths}
                                                className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                            >
                                                <RotateCcw size={12} /> Reset to auto
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <div className="flex items-center gap-1.5">
                {sortConfig && (
                    <button 
                        onClick={() => setSortConfig(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shadow-sm bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/40"
                        title="Clear sorting and revert to original parsed order"
                    >
                        <ArrowUpDown size={12} className="text-amber-600 dark:text-amber-500" />
                        <span>Clear Sort</span>
                    </button>
                )}
                {onReparse && (
                    <button 
                        onClick={onReparse}
                        disabled={isReparsing}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shadow-sm ${
                            isReparsing 
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title="Re-run parse pipeline on current document"
                    >
                        {isReparsing ? (
                            <Loader2 size={12} className="animate-spin text-blue-500" />
                        ) : (
                            <RotateCcw size={12} className="text-blue-600 dark:text-blue-400" />
                        )}
                        <span>Reparse</span>
                    </button>
                )}
                {onSmartMatch && (
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={onSmartMatch}
                            disabled={isReparsing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shadow-sm ${
                                isReparsing 
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                                : 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95'
                            }`}
                            title="Run AI Smart Match to find catalog products"
                        >
                            {isReparsing ? (
                                <Loader2 size={12} className="animate-spin text-white" />
                            ) : (
                                <Sparkles size={12} className="text-white" />
                            )}
                            <span>Smart Match</span>
                        </button>
                        <button 
                            onClick={async () => {
                                try {
                                    // Use AI for contextual sectioning
                                    const sectionMap = await aiService.smartSection(data);
                                    Object.entries(sectionMap).forEach(([id, section]) => {
                                        onUpdateRow(id, 'section', section);
                                    });
                                } catch (error) {
                                    console.error("AI Smart Sectioning failed, falling back to rules", error);
                                    // Fallback to rule-based sectioning
                                    data.forEach(row => {
                                        if (!row.section || row.section === 'Default' || row.section === 'Unspecified') {
                                            const item = row.item.toLowerCase();
                                            let fallbackSection = row.section;
                                            if (item.includes('stud') || item.includes('plate') || item.includes('nog')) fallbackSection = 'Wall Framing';
                                            else if (item.includes('truss') || item.includes('rafter')) fallbackSection = 'Roof Trusses';
                                            else if (item.includes('joist') || item.includes('bearer')) fallbackSection = 'Floor Framing';
                                            else if (item.includes('post') || item.includes('beam')) fallbackSection = 'Structural';
                                            
                                            if (fallbackSection !== row.section) {
                                                onUpdateRow(row.id, 'section', fallbackSection);
                                            }
                                        }
                                    });
                                }
                            }}
                            disabled={isReparsing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shadow-sm ${
                                isReparsing 
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                                : 'bg-violet-600 border-violet-700 text-white hover:bg-violet-700 shadow-lg shadow-violet-500/20 active:scale-95'
                            }`}
                            title="AI Smart Sectioning: Group items by structural role"
                        >
                            <Zap size={12} className="text-white" />
                            <span>Smart Section</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <div className="flex items-center gap-1.5">
                <button 
                    onClick={() => setShowShortcuts(true)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Keyboard Shortcuts"
                >
                    <HelpCircle size={16} />
                </button>
                {onExport && uiPreferences?.showExportControl && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={onVerify} 
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                    >
                      <SplitIcon size={12} className="text-blue-500" />
                      <span>Verify</span>
                    </button>
                    <button onClick={onExport} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 dark:bg-slate-700 text-white border border-slate-900 dark:border-slate-600 shadow-lg shadow-slate-500/10 hover:bg-slate-900 dark:hover:bg-slate-600 transition-all active:scale-95"><FileDown size={12} className="text-blue-400" /><span>Export</span></button>
                  </div>
                )}
                {onAddRow && uiPreferences?.showAddControl && <button onClick={() => onAddRow()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white border border-emerald-700 shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95"><Plus size={12} className="text-white" /><span>Add</span></button>}
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden relative">
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto flex-1 scroll-smooth custom-scrollbar">
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <table className="min-w-full text-[13px] text-left border-separate border-spacing-0 table-auto">
                <thead className="sticky top-0 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                    <tr>
                    <th className="w-6 px-2 py-3 border-y border-l border-r border-slate-200/50 dark:border-slate-800/50 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xl">
                        <button onClick={() => { if (selectedItems.size === processedData.length && processedData.length > 0) setSelectedItems(new Set()); else setSelectedItems(new Set(processedData.map(d => d.id))); }} className="text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 flex items-center justify-center w-full transition-all active:scale-95">{processedData.length > 0 && selectedItems.size === processedData.length ? <CheckSquare size={16} /> : <Square size={16} />}</button>
                    </th>
                    {visibleColumns.map(colId => (
                        <th key={colId} data-col-id={colId} style={{ minWidth: `${columnWidths[colId as string]}px` }} draggable={colId !== 'status'} onDragStart={(e) => handleColumnDragStart(e, colId)} onDragOver={(e) => handleColumnDragOver(e, colId)} onDrop={(e) => handleColumnDrop(e, colId)} className={`px-2 py-3 border-y border-r border-slate-200/50 dark:border-slate-800/50 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xl text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest select-none group transition-all relative text-left ${colId !== 'status' ? 'cursor-grab active:cursor-grabbing hover:bg-white dark:hover:bg-slate-800' : ''} ${draggedColumnId === colId ? 'opacity-40' : ''}`}>
                            <div className="flex items-center gap-2 justify-start h-full">
                                <div className={`flex items-center gap-2 flex-1 overflow-hidden justify-start`} onClick={() => { let direction: SortDirection = 'asc'; if (sortConfig && sortConfig.key === colId && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key: colId as any, direction }); }}>
                                    {colId !== 'status' && <GripHorizontal size={10} className="text-slate-300 group-hover:text-blue-400 transition-colors shrink-0" />}
                                    <span className="whitespace-normal break-words truncate">{colId === 'status' ? <Activity size={14} className="text-slate-400" /> : COLUMN_LABELS[colId as string]}</span>
                                    {sortConfig?.key === colId && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0">
                                            {sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />}
                                        </motion.div>
                                    )}
                                </div>
                                {colId !== 'status' && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleAutoFitColumn(colId as string); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-blue-500 transition-all rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                        title="Auto fit width"
                                    >
                                        <Maximize2 size={12} />
                                    </button>
                                )}
                            </div>
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/50 z-10 transition-colors" onMouseDown={(e) => startResize(colId as string, e)} onDoubleClick={(e) => { e.stopPropagation(); handleAutoFitColumn(colId as string); }} />
                        </th>
                    ))}
                    <th className="px-2 py-3 w-14 border-y border-r border-slate-200/50 dark:border-slate-800/50 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xl"></th>
                    </tr>
                </thead>
                <tbody>
                    {processedData.length === 0 ? (
                        <tr>
                            <td colSpan={visibleColumns.length + 2} className="py-32 text-center">
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center gap-4 text-slate-400"
                                >
                                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                                        <Database size={40} className="text-slate-300" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-lg font-bold text-slate-600 dark:text-slate-300">No items found</p>
                                        <p className="text-sm text-slate-400">Add an item to get started with this takeoff.</p>
                                    </div>
                                    <button onClick={() => onAddRow?.()} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2">
                                        <Plus size={18} /> Add First Item
                                    </button>
                                </motion.div>
                            </td>
                        </tr>
                    ) : (
                    <SortableContext 
                        items={processedData.map(d => d.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {groupedData.map(([groupName, groupRows]) => {
                            let calcLM = 0, calcPrice = 0;
                            const isCollapsed = collapsedGroups.has(groupName);
                            groupRows.forEach(r => { if (!isSummaryRow(r)) { if (r.unit === 'L/M') calcLM += r.total; calcPrice += (r.totalPrice || 0); } });
                            return (
                                <React.Fragment key={groupName}>
                                    {isGrouped && (
                                        <tr className="bg-slate-50/80 dark:bg-slate-800/40 backdrop-blur-sm transition-colors sticky top-[41px] z-10 shadow-sm border-b border-slate-200/50 dark:border-slate-800/50">
                                            <td colSpan={visibleColumns.length + 2} className="px-3 py-2 text-[10px] uppercase text-slate-600 dark:text-slate-300 tracking-wider text-left">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); const next = new Set(collapsedGroups); if (isCollapsed) next.delete(groupName); else next.add(groupName); setCollapsedGroups(next); }} 
                                                            className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-500 transition-all shadow-sm"
                                                            title={isCollapsed ? "Expand section" : "Collapse section"}
                                                        >
                                                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                                            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                                <Layers size={14} className="text-blue-500" />
                                                            </div>
                                                            {groupName}
                                                        </div>
                                                        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-tighter ring-1 ring-blue-500/20">{groupRows.length} Items</span>
                                                    </div>
                                                    <div className="flex items-center gap-5 font-bold text-slate-500 dark:text-slate-400">
                                                        {calcLM > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] opacity-60">TOTAL LM:</span>
                                                                <span className="text-slate-900 dark:text-slate-100 font-black">{calcLM.toFixed(1)}m</span>
                                                            </div>
                                                        )}
                                                        {calcPrice > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] opacity-60">TOTAL VALUE:</span>
                                                                <span className="text-emerald-700 dark:text-emerald-400 font-black">${calcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {!isCollapsed && groupRows.map((row) => (
                                        <SortableRow 
                                            key={row.id} 
                                            id={row.id}
                                            row={row} 
                                            onUpdateRow={onUpdateRow} 
                                            visibleColumns={visibleColumns as any} 
                                            isActive={activeRowId === row.id} 
                                            onRowClick={onRowClick} 
                                            onDeleteAction={onDeleteRow && !row.locked ? handleDeleteRowAction : undefined} 
                                            isSelected={selectedItems.has(row.id)} 
                                            onToggleSelect={handleToggleSelect} 
                                            hasMultipleSources={false} 
                                            onTeach={handleOpenTeach} 
                                            onInspect={handleInspectRow} 
                                            onDuplicateRowAction={handleDuplicateRowAction}
                                            onAddAnnotationAction={handleAddAnnotationAction}
                                            isSummary={isSummaryRow(row)} 
                                            onOpenMoveMenuAction={handleOpenRowMoveMenu} 
                                            onOpenCatalogLookup={handleOpenLookup} 
                                            onNavigate={handleNavigate} 
                                            catalog={catalog} 
                                            uiPreferences={uiPreferences} 
                                            isCommittingRef={isCommittingRef}
                                            isLookupOpen={!!catalogLookup && catalogLookup.rowId === row.id}
                                            allData={allData}
                                            avgQty={avgQty}
                                        />
                                    ))}
                                    {isGrouped && !isCollapsed && groupRows.length > 1 && (
                                        <tr className="bg-slate-50/30 dark:bg-slate-900/30 border-t border-slate-200/50 dark:border-slate-800/50 group/group-summary">
                                            <td colSpan={visibleColumns.length + 2} className="px-6 py-3 text-right">
                                                <div className="flex items-center justify-end gap-10 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] group-hover/group-summary:text-blue-500/50 transition-colors">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-[8px] opacity-50">SECTION TOTAL LM</span>
                                                        <span className="text-slate-900 dark:text-slate-100 font-black tracking-normal text-sm">{calcLM.toFixed(2)}m</span>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-[8px] opacity-50">SECTION TOTAL VALUE</span>
                                                        <span className="text-emerald-700 dark:text-emerald-400 font-black tracking-normal text-sm">${calcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </SortableContext>
                    )}
                </tbody>
                </table>
            </DndContext>
        </div>
      </div>
      {catalogLookup && (
        <CatalogDropdown 
            catalog={catalog} 
            targetRef={catalogLookup.targetRef} 
            searchTerm={catalogLookup.searchTerm} 
            onSelect={handleSelectProduct} 
            onClose={() => setCatalogLookup(null)} 
            selectedIndex={dropdownSelectedIndex}
        />
      )}
      {resizingGuideX !== null && (
          <div 
            className="fixed top-0 bottom-0 w-0.5 bg-blue-500 z-[100] pointer-events-none shadow-[0_0_10px_rgba(59,130,246,0.5)]"
            style={{ left: `${resizingGuideX}px` }}
          />
      )}
      <PineWastagePanel 
          isOpen={showPineWastage} 
          onClose={() => setShowPineWastage(false)} 
          lines={allData} 
          catalog={catalog} 
          onSelectSourceLine={(id) => {
              onRowClick(id);
          }}
      />
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                          <Zap size={18} className="text-amber-500" /> Keyboard Shortcuts
                      </h3>
                      <button onClick={() => setShowShortcuts(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      {[
                          { key: 'Ctrl + Z', desc: 'Undo last change' },
                          { key: 'Ctrl + Y', desc: 'Redo last change' },
                          { key: 'Arrows', desc: 'Navigate between cells' },
                          { key: 'Enter', desc: 'Edit cell / Save & Move down' },
                          { key: 'Esc', desc: 'Cancel editing' },
                          { key: 'Del / Backspace', desc: 'Delete selected rows' },
                          { key: 'Shift + Click', desc: 'Select range of rows' },
                      ].map(s => (
                          <div key={s.key} className="flex justify-between items-center">
                              <span className="text-sm text-slate-600 dark:text-slate-400">{s.desc}</span>
                              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-black text-slate-700 dark:text-slate-200 shadow-sm">{s.key}</kbd>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center">
                      <button onClick={() => setShowShortcuts(false)} className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold text-sm">Got it</button>
                  </div>
              </div>
          </div>
      )}

      {bulkMenuMode !== 'none' && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => { setBulkMenuMode('none'); setMoveMenuRowId(null); }}></div>
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-80 animate-in slide-in-from-bottom-2 duration-200 overflow-hidden">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between"><span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">{bulkMenuMode === 'move' ? <Move size={14} /> : bulkMenuMode === 'edit' ? <Edit2 size={14} /> : <ArrowRightLeft size={14} />} {bulkMenuMode === 'move' ? (moveMenuRowId ? 'Move Item' : 'Bulk Move Items') : bulkMenuMode === 'edit' ? 'Bulk Edit Field' : 'Search & Replace'}</span><button onClick={() => { setBulkMenuMode('none'); setMoveMenuRowId(null); }}><X size={16} className="text-slate-400" /></button></div>
                <div className="p-4">
                    {bulkMenuMode === 'move' ? (
                        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                            {sectionNames.map(name => ( <button key={name} onClick={() => handleBulkMove(name)} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center justify-between"><span className="whitespace-normal break-words">{name}</span><ChevronRight size={14} className="text-slate-300 shrink-0" /></button> ))}
                            <button onClick={() => { const name = prompt("Enter new group name:"); if (name) handleBulkMove(name); }} className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-dashed border-blue-200 dark:border-blue-800 mt-2 flex items-center gap-2"><Plus size={14} /> New Group...</button>
                        </div>
                    ) : bulkMenuMode === 'edit' ? (
                        <div className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Field</label><select value={bulkEditField} onChange={(e) => setBulkEditField(e.target.value as any)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200"><option value="">Choose column...</option><option value="item">Item Name</option><option value="dimensions">Dimensions</option><option value="grade">Grade</option><option value="unit">Unit</option><option value="qty">Quantity</option><option value="length">Length</option></select></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">New Value</label>
                                {bulkEditField === 'unit' ? ( <select value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200"><option value="">Choose unit...</option><option value="L/M">L/M</option><option value="EA">EA</option><option value="m2">m2</option></select>
                                ) : ( <input type={bulkEditField === 'qty' || bulkEditField === 'length' ? 'number' : 'text'} value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200" placeholder="Enter value..." /> )}
                            </div>
                            <button onClick={handleBulkEditApply} disabled={!bulkEditField || !bulkEditValue} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all"><Check size={16} /> Apply to {selectedItems.size} items</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Field</label><select value={bulkEditField} onChange={(e) => setBulkEditField(e.target.value as any)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200"><option value="">Choose column...</option><option value="item">Item Name</option><option value="dimensions">Dimensions</option><option value="grade">Grade</option><option value="section">Group</option><option value="subSection">Section</option></select></div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search For</label>
                                <div className="relative">
                                    <input type="text" value={bulkSearchTerm} onChange={(e) => setBulkSearchTerm(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200 pr-16" placeholder="Text to find..." />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <button onClick={() => setBulkSearchRegex(!bulkSearchRegex)} className={`p-1 rounded text-[9px] font-bold transition-all ${bulkSearchRegex ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`} title="Regex Mode">.*</button>
                                        <button onClick={() => setBulkSearchCaseSensitive(!bulkSearchCaseSensitive)} className={`p-1 rounded text-[9px] font-bold transition-all ${bulkSearchCaseSensitive ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`} title="Match Case">Aa</button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Replace With</label>
                                <input type="text" value={bulkReplaceTerm} onChange={(e) => setBulkReplaceTerm(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200" placeholder="Replacement text..." />
                            </div>
                            <button onClick={handleBulkReplaceApply} disabled={!bulkEditField || bulkSearchTerm === ''} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all">
                                <ArrowRightLeft size={16} /> 
                                Replace in {selectedItems.size} items
                            </button>
                        </div>
                    )}
                </div>
            </div>
          </>
      )}
      <AnimatePresence>
        {selectedItems.size > 0 && !moveMenuRowId && (
            <motion.div 
                initial={{ y: 100, opacity: 0, x: '-50%' }}
                animate={{ y: 0, opacity: 1, x: '-50%' }}
                exit={{ y: 100, opacity: 0, x: '-50%' }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 dark:bg-slate-800/90 text-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 pl-6 flex items-center gap-6 backdrop-blur-2xl ring-1 ring-white/20 border border-white/10"
            >
                <div className="flex flex-col">
                    <div className="font-black text-xs whitespace-nowrap text-white uppercase tracking-wider">{selectedItems.size} Selected</div>
                    <button onClick={() => { setSelectedItems(new Set()); setLastSelectedId(null); }} className="text-[10px] text-blue-400 hover:text-blue-300 text-left font-bold uppercase tracking-tighter transition-colors">Clear all</button>
                </div>
                <div className="h-10 w-px bg-white/10 mx-2 shadow-[1px_0_0_rgba(0,0,0,0.5)]"></div>
                <div className="flex items-center gap-2">
                    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => setBulkMenuMode('move')} className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all shadow-sm ${bulkMenuMode === 'move' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-200'}`}><Move size={16} className="text-blue-400" /> Move</motion.button>
                    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => setBulkMenuMode('edit')} className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all shadow-sm ${bulkMenuMode === 'edit' ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-200'}`}><Edit2 size={16} className="text-amber-400" /> Edit</motion.button>
                    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => setBulkMenuMode('replace')} className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all shadow-sm ${bulkMenuMode === 'replace' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-200'}`}><ArrowRightLeft size={16} className="text-purple-400" /> Replace</motion.button>
                    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => setshowBulkDeleteConfirm(true)} className="px-5 py-2.5 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all shadow-sm"><Trash2 size={16} /> Delete</motion.button>
                </div>
                <button type="button" onClick={() => { setSelectedItems(new Set()); setLastSelectedId(null); }} className="p-3 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all active:scale-90"><X size={20} /></button>
            </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog isOpen={!!deleteCandidateId} title="Delete Item" message="Are you sure you want to delete this item?" confirmLabel="Delete" isDestructive={true} onConfirm={() => { if (deleteCandidateId && onDeleteRow) onDeleteRow(deleteCandidateId); setDeleteCandidateId(null); }} onCancel={() => setDeleteCandidateId(null)} />
      <ConfirmDialog isOpen={showBulkDeleteConfirm} title="Delete Multiple Items" message={`Are you sure you want to delete ${selectedItems.size} selected items?`} confirmLabel={`Delete ${selectedItems.size} Items`} isDestructive={true} onConfirm={() => { if (onBulkDelete) onBulkDelete(Array.from(selectedItems)); setSelectedItems(new Set()); setshowBulkDeleteConfirm(false); setLastSelectedId(null); }} onCancel={() => setshowBulkDeleteConfirm(false)} />
    </motion.div>
  );
};