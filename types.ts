export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastState {
  message: string;
  type: ToastType;
  id: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'junior';
  permissions?: string[];
  avatar?: string;
  pin?: string; // 4-digit PIN for admin users
  createdAt: number;
}

export interface MemoryItem {
  // Stable key for matching (Upper-case, normalized whitespace)
  lookupKey: string;          
  
  // Original casing from the table for user-friendly display
  displayName: string;        
  dimensions: string;         

  itemNo: string;
  description: string;
}

export interface ParsingTrace {
    stepLog: string[];
    appliedRules: string[];
    extraction: {
        field: string;
        value: any;
        source: string; // 'regex', 'column', 'rule', 'inference'
        confidence?: string;
    }[];
}

export interface SheetDims {
    l: number;
    w: number;
    t?: number;
}

export interface CatalogProduct {
    itemNo: string;
    description: string;
    dimensions?: string;
    grade?: string;
    unit?: string;
    priceCents?: number | null; 
    priceHistory?: { date: number; priceCents: number }[];
    group?: string | null;
    section?: string | null;
    supplier?: string;
    isSystem?: boolean;
    // Enriched fields for optimized matching
    dimsKey?: string;
    gradeKey?: string;
    lengthKeyM?: number;
    sheetDimsMm?: SheetDims | null;
}

export interface UiPreferences {
  showHeaderMetrics: boolean;
  showJobNotes: boolean;
  showCatalogMapping: boolean;
  showContinuedBadges: boolean;
  showPdfPreview: boolean;
  showGroupControl: boolean;
  showColumnsControl: boolean;
  showExportControl: boolean;
  showAddControl: boolean;
}

export interface ParsedLine {
  id: string;
  category: string;
  section: string;
  subSection: string;
  sectionLocked?: boolean;
  subSectionLocked?: boolean;
  spruceItemNo?: string;
  spruceDescription?: string;
  sprucePriceCents?: number | null;
  spruceGroup?: string | null;
  spruceSection?: string | null;
  spruceMapped?: boolean;
  matchedFromMemory?: boolean; // New flag for memory application visibility
  manuallyUnmapped?: boolean; // Flag to prevent automated re-matching
  isContinued?: boolean; // Flag for multi-line merged descriptions
  mappingSource?: 'CODE_EXACT' | 'MEMORY' | 'FUZZY' | 'LM_FALLBACK' | 'RULE_BRACING' | 'MANUAL' | 'AUTO_PINE_6M';
  matchReason?: string; // Plain English explanation for match/no-match
  overrideReason?: string; // Flag for post-match catalog substitutions
  item: string;
  description?: string;
  dimensions: string;
  grade: string;
  qty: number;
  length: number | null;
  unit: 'L/M' | 'EA' | 'm2';
  total: number;
  price?: number; // Kept for manual/backward compatibility overrides if needed
  totalPrice?: number; 
  originalLine?: string;
  confidence?: number;
  parsingNotes?: string[];
  page?: number;
  rect?: number[];
  isNew?: boolean;
  locked?: boolean;
  debugTrace?: ParsingTrace;
  annotations?: Annotation[];
  // Internal matching metadata
  lineSheetDimsMm?: SheetDims | null;
  isDerived?: boolean; // Flag for wastage draft rows
  derivedFromIds?: string[]; // IDs of source lines used to create this derived line
  // New fields for 20 improvements
  formula?: string;
  anomaly?: string | null;
  sortOrder?: number;
}

export interface KPIStats {
  totalItems: number;
  totalLinearMetres: number;
  totalPrice: number;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  pageCount?: number;
  author?: string;
  producer?: string;
  creationDate?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  dateStr?: string;
  builder?: string;
  jobNumber?: string;
}

export type ParseStatus = 'idle' | 'extracting' | 'parsing' | 'ready' | 'error' | 'no_data' | 'scanned_detected' | 'ocr_processing';

export interface HistoryItem {
  id: string;
  userId: string; 
  timestamp: number;
  fileName: string;
  itemCount: number;
  data: ParsedLine[];
  metadata?: FileMetadata;
  isPinned?: boolean;
  tags?: string[];
  jobNotes?: string;
  folderId?: string | null;
  annotations?: Annotation[];
  originalFileUrl?: string; // For split-screen verification
}

export interface HistoryFolder {
    id: string;
    name: string;
    createdAt: number;
    userId: string;
}

export interface WebhookConfig {
    id: string;
    name: string;
    url: string;
    events: ('export' | 'save' | 'delete')[];
    isActive: boolean;
}

export interface SupplierConfig {
    id: string;
    name: string;
    apiUrl: string;
    apiKey?: string;
    isActive: boolean;
}

export type AppTheme = 'blue' | 'green' | 'orange' | 'red' | 'slate';

export interface AppSettings {
  darkMode: boolean;
  themeColor: AppTheme;
  fontFamily: string;
  fontSize: string;
  companyName: string;
  logoUrl: string | null;
  isTableLocked: boolean;
  activeUserId?: string; 
  uiPreferences?: UiPreferences;
  tableColumnWidths?: Record<string, number>;
  isOfflineMode?: boolean;
  isVoiceEnabled?: boolean;
  webhooks?: WebhookConfig[];
  suppliers?: SupplierConfig[];
  folders?: HistoryFolder[];
  exportTemplates?: ExportTemplate[];
  supplierCatalogs?: SupplierCatalog[];
}

export interface ValidationError {
  rowId: string;
  field: keyof ParsedLine | 'general';
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface TextLine {
    text: string;
    page: number;
    rect: number[];
    formattedWords?: string[];
}

export interface UnitRule {
    sectionNamePattern: RegExp;
    defaultUnit: 'L/M' | 'EA' | 'm2';
}

export interface ProfileSettings {
    sectionHeaderPatterns: RegExp[];
    columnHints?: {
        qtyX?: [number, number];
        dimsX?: [number, number];
        gradeX?: [number, number];
    };
    ignorePatterns: RegExp[];
    ignorePatternsStrings?: string[];
    unitRules: UnitRule[];
    lineCleanupRules?: { pattern: RegExp; replacement: string }[];
}

export interface SectionHandler {
    header: RegExp;
    process: (lines: TextLine[], startIndex: number) => { notes: string; consumedLines: number };
}

export interface ParseProfile {
    id: string;
    name: string;
    description: string;
    isCustom?: boolean;
    detect: (textLines: TextLine[]) => number;
    settings: ProfileSettings;
    keywords?: string[]; 
    sectionHandlers?: SectionHandler[];
    serializedSettings?: {
        sectionHeaderPatterns: string[];
        ignorePatterns: string[];
        unitRules?: { sectionNamePattern: string; defaultUnit: 'L/M' | 'EA' | 'm2' }[];
    };
}

export type TransformType = 'none' | 'uppercase' | 'lowercase' | 'trim' | 'number_0' | 'number_2' | 'default_val';

export type ExportValidationType = 'required' | 'max_length' | 'numeric_only' | 'no_spaces';

export interface ExportValidation {
    type: ExportValidationType;
    value?: number;
}

export interface ExportColumn {
    id: string;
    header: string;
    field: keyof ParsedLine | 'custom_text' | 'empty' | 'meta_builder' | 'meta_site' | 'meta_job' | 'meta_date';
    customValue?: string;
    transform: TransformType;
    validations?: ExportValidation[];
}

export interface Annotation {
  id: string;
  rowId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  resolved?: boolean;
}

export interface SupplierCatalog {
  id: string;
  supplierName: string;
  products: CatalogProduct[];
  lastUpdated: number;
}

export interface BatchJob {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  resultId?: string;
}

export interface ExportTemplate {
  id: string;
  name: string;
  isDefault?: boolean;
  columns: ExportColumn[];
}

export type ParserRuleType = 'section_rename' | 'item_alias' | 'unit_override' | 'ignore_pattern' | 'dimensions_rule' | 'grade_rule';

export interface ParserRule {
    id: string;
    type: ParserRuleType;
    pattern: string;
    replacement?: string;
    unit?: 'L/M' | 'EA' | 'm2';
    profileId: string;
    createdAt: number;
}

export interface CutItem {
  id: string;
  length: number;
  description: string;
  section: string;
  originalRef: ParsedLine;
}

export interface StockBin {
  id: string;
  stockLength: number;
  cuts: CutItem[];
  usedLength: number;
  waste: number;
}

export interface OptimizationGroup {
  key: string;
  dimensions: string;
  grade: string;
  unit: 'L/M' | 'EA' | 'm2';
  totalRequiredLength: number;
  bins: StockBin[];
  totalStockLength: number;
  totalWaste: number;
  wastePercentage: number;
  orderList: { length: number; count: number }[];
}

export type PineWastageRow = { 
  dimsKey: string; 
  dimsLabel: string; 
  totalLm: number; 
  lengths6m: number; 
  suppliedLm: number; 
  offcutLm: number; 
  wastagePct: number; 
  suggestedItemNo?: string; 
  suggestedDesc?: string;
  sourceLineIds: string[]; 
}

export type PineWastageSummary = { 
  totalLm: number; 
  totalLengths6m: number; 
  totalSuppliedLm: number; 
  totalOffcutLm: number; 
  overallWastagePct: number 
}