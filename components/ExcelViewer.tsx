import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Loader2, ChevronDown, Table, ZoomIn, ZoomOut } from 'lucide-react';

interface ExcelViewerProps {
  fileUrl: string;
  documents?: { id: string; name: string; url: string; type: 'pdf' | 'excel' }[];
  activeDocumentId?: string;
  onDocumentChange?: (id: string) => void;
  highlightPage?: number; // Maps to Sheet Index (1-based)
  highlightRect?: number[]; // [x, y, w, h] - Used to derive row index
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({
  fileUrl,
  documents,
  activeDocumentId,
  onDocumentChange,
  highlightPage,
  highlightRect
}) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(false);
  
  // View Control State
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLTableRowElement>(null);

  // Pan State
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const loadExcel = async () => {
        setLoading(true);
        try {
            const response = await fetch(fileUrl);
            const blob = await response.arrayBuffer();
            const wb = XLSX.read(blob, { type: 'array' });
            setWorkbook(wb);
        } catch (e) {
            console.error("Failed to load excel", e);
        } finally {
            setLoading(false);
        }
    };
    if (fileUrl) loadExcel();
  }, [fileUrl]);

  const [prevHighlightPage, setPrevHighlightPage] = useState(highlightPage);
  const [prevWorkbook, setPrevWorkbook] = useState(workbook);
  if (highlightPage !== prevHighlightPage || workbook !== prevWorkbook) {
      setPrevHighlightPage(highlightPage);
      setPrevWorkbook(workbook);
      if (workbook && workbook.SheetNames.length > 0) {
          if (highlightPage && highlightPage <= workbook.SheetNames.length) {
              const targetSheet = workbook.SheetNames[highlightPage - 1];
              if (targetSheet !== activeSheet) {
                  setActiveSheet(targetSheet);
              }
          } else if (!activeSheet) {
              setActiveSheet(workbook.SheetNames[0]);
          }
      }
  }

  // Load Sheet Data
  useEffect(() => {
      if (workbook && activeSheet) {
          const ws = workbook.Sheets[activeSheet];
          const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
          setSheetData(data);
      }
  }, [workbook, activeSheet]);

  // Highlight Logic
  const highlightedRowIndex = useMemo(() => {
      if (!highlightRect) return -1;
      // Reverse the mock calculation from excelService: rect[1] = rowIndex * 12
      // We accept a small margin of error or exact match
      return Math.round(highlightRect[1] / 12);
  }, [highlightRect]);

  // Auto-scroll to highlight
  useEffect(() => {
      if (activeRowRef.current && highlightedRowIndex >= 0) {
          activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  }, [highlightedRowIndex, activeSheet]);

  const changeZoom = (delta: number) => {
      setScale(prev => Math.max(0.5, Math.min(3.0, prev + delta)));
  };

  // --- Pan Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      setIsDragging(true);
      setStartPos({ x: e.clientX, y: e.clientY });
      setScrollStart({ 
        left: containerRef.current.scrollLeft, 
        top: containerRef.current.scrollTop 
      });
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    containerRef.current.scrollLeft = scrollStart.left - dx;
    containerRef.current.scrollTop = scrollStart.top - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.removeProperty('user-select');
  };

  const handleMouseLeave = () => {
    if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.removeProperty('user-select');
    }
  };

  return (
    <div className="flex-1 w-full bg-slate-200 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 shadow-inner flex flex-col min-h-0 relative">
        {/* Toolbar */}
        <div className="bg-white dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center z-20 shadow-sm shrink-0">
             <div className="flex items-center gap-2">
                {documents && documents.length > 1 && onDocumentChange ? (
                    <div className="relative group">
                        <select
                            value={activeDocumentId}
                            onChange={(e) => onDocumentChange(e.target.value)}
                            className="appearance-none pl-9 pr-9 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-[160px] max-w-[240px] truncate shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                        >
                            {documents.map(doc => (
                                <option key={doc.id} value={doc.id}>
                                    {doc.name}
                                </option>
                            ))}
                        </select>
                        {documents.find(d => d.id === activeDocumentId)?.type === 'excel' ? (
                            <FileSpreadsheet size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" />
                        ) : (
                            <Table size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
                        )}
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm">
                        <FileSpreadsheet size={16} className="text-emerald-500" />
                        Excel Viewer
                    </div>
                )}
            </div>

            {/* Middle: Sheet Selector */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-[40%] no-scrollbar mask-gradient-right">
                {workbook?.SheetNames.map(sheet => (
                    <button
                        key={sheet}
                        onClick={() => setActiveSheet(sheet)}
                        className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
                            activeSheet === sheet
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-500'
                            : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        {sheet}
                    </button>
                ))}
            </div>

            {/* Right: Zoom Controls */}
            <div className="flex items-center gap-1">
                 <button 
                    onClick={() => changeZoom(-0.2)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors"
                    title="Zoom Out"
                >
                    <ZoomOut size={16} />
                </button>
                <span className="text-xs w-12 text-center text-slate-500 select-none">{Math.round(scale * 100)}%</span>
                <button 
                    onClick={() => changeZoom(0.2)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors"
                    title="Zoom In"
                >
                    <ZoomIn size={16} />
                </button>
            </div>
        </div>

        {/* Content */}
        <div 
            ref={containerRef}
            className={`flex-1 overflow-auto bg-slate-100/50 dark:bg-slate-900/50 p-8 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p className="text-sm">Loading spreadsheet...</p>
                </div>
            ) : (
                <div 
                    className="bg-white dark:bg-slate-900 shadow-lg overflow-hidden border border-slate-300 dark:border-slate-700 rounded-sm origin-top-left transition-transform duration-200 ease-out"
                    style={{ 
                        transform: `scale(${scale})`,
                        width: 'fit-content' // Ensure container wraps content for scaling to work on correct dimensions
                    }}
                >
                    <div className="overflow-hidden">
                        <table className="text-xs border-collapse">
                            <tbody>
                                {sheetData.map((row, rIdx) => {
                                    const isHighlighted = rIdx === highlightedRowIndex;
                                    return (
                                        <tr 
                                            key={rIdx} 
                                            ref={isHighlighted ? activeRowRef : null}
                                            className={isHighlighted ? 'bg-yellow-200/50 dark:bg-yellow-900/50 transition-colors duration-300' : ''}
                                        >
                                            <td className={`bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 w-8 text-center text-slate-400 select-none font-mono text-[10px] ${isHighlighted ? 'font-bold text-yellow-700 dark:text-yellow-400 border-yellow-300' : ''}`}>
                                                {rIdx + 1}
                                            </td>
                                            {row.map((cell: any, cIdx: number) => (
                                                <td key={cIdx} className={`border border-slate-200 dark:border-slate-800 px-2 py-1 text-slate-800 dark:text-slate-300 whitespace-nowrap min-w-[60px] ${isHighlighted ? 'border-yellow-200 dark:border-yellow-800' : ''}`}>
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};