import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Loader2, AlertCircle, FileText, ChevronDown } from 'lucide-react';
import { PDF_WORKER_URL } from '../constants';

// Initialize PDF.js worker
const pdfjs = (pdfjsLib as any).default || pdfjsLib;
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
}

interface PdfDocument {
    id: string;
    url: string;
    name: string;
}

interface PdfViewerProps {
  fileUrl: string;
  highlightPage?: number;
  highlightRect?: number[]; // [x, y, w, h]
  documents?: PdfDocument[];
  activeDocumentId?: string;
  onDocumentChange?: (id: string) => void;
  onPdfClick?: (page: number, x: number, y: number) => void;
}

// --- Sub-component for individual pages to handle lazy loading ---
interface PdfPageProps {
  pdfDoc: any;
  pageNumber: number;
  scale: number;
  highlightRect?: number[];
  onInView: (page: number) => void;
  registerRef: (page: number, element: HTMLDivElement | null) => void;
  onPdfClick?: (page: number, x: number, y: number) => void;
}

const PdfPage: React.FC<PdfPageProps> = ({ pdfDoc, pageNumber, scale, highlightRect, onInView, registerRef, onPdfClick }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const [isRendered, setIsRendered] = useState(false);
    const [dimensions, setDimensions] = useState<{ width: number, height: number } | null>(null);
    const renderTaskRef = useRef<any>(null);
    const viewportRef = useRef<any>(null);

    // Register ref with parent for lazy loading tracking
    useEffect(() => {
        registerRef(pageNumber, containerRef.current);
    }, [pageNumber, registerRef]);

    // Intersection Observer for Lazy Loading & Current Page tracking
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setIsRendered(true);
                    onInView(pageNumber);
                }
            });
        }, { rootMargin: '200px', threshold: 0.1 }); 

        observer.observe(element);
        return () => observer.disconnect();
    }, [pageNumber, onInView]);

    // Initial Dimension Fetch (Fast, no rendering)
    useEffect(() => {
        pdfDoc.getPage(pageNumber).then((page: any) => {
            const viewport = page.getViewport({ scale });
            viewportRef.current = viewport;
            setDimensions({ width: viewport.width, height: viewport.height });
        });
    }, [pdfDoc, pageNumber, scale]);

    // Actual Rendering
    useEffect(() => {
        if (!isRendered || !canvasRef.current || !dimensions) return;

        const render = async () => {
            try {
                const page = await pdfDoc.getPage(pageNumber);
                const viewport = page.getViewport({ scale });
                viewportRef.current = viewport; 
                const canvas = canvasRef.current;
                
                if (!canvas) return;

                const context = canvas.getContext('2d');
                if (!context) return;

                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };

                const renderTask = page.render(renderContext);
                renderTaskRef.current = renderTask;
                await renderTask.promise;
            } catch (error: any) {
                if (error.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering page ${pageNumber}`, error);
                }
            }
        };

        render();

        return () => {
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [isRendered, pdfDoc, pageNumber, scale, dimensions]);

    // Highlight Logic
    const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties | null>(null);

    // Adjust state during rendering for the null case to avoid synchronous setState in useEffect
    const [prevHighlightRect, setPrevHighlightRect] = useState<number[] | null | undefined>(highlightRect);
    if (highlightRect !== prevHighlightRect) {
        setPrevHighlightRect(highlightRect);
        if (!highlightRect) {
            setHighlightStyle(null);
        }
    }

    useEffect(() => {
        if (!highlightRect) return;
        let isMounted = true;
        pdfDoc.getPage(pageNumber).then((page: any) => {
            if (!isMounted) return;
            const viewport = page.getViewport({ scale });
            const [x, y, w, h] = highlightRect;
            const rect = [x, y, x + w, y + h];
            const viewRect = viewport.convertToViewportRectangle(rect);
             
            const minX = Math.min(viewRect[0], viewRect[2]);
            const maxX = Math.max(viewRect[0], viewRect[2]);
            const minY = Math.min(viewRect[1], viewRect[3]);
            const maxY = Math.max(viewRect[1], viewRect[3]);

            setHighlightStyle({
                left: `${minX}px`,
                top: `${minY}px`,
                width: `${maxX - minX}px`,
                height: `${maxY - minY}px`,
                display: 'block'
            });
        });
        return () => { isMounted = false; };
    }, [pdfDoc, pageNumber, scale, highlightRect]);

    // Center precise highlight in middle of preview
    useEffect(() => {
        if (highlightStyle && highlightRef.current) {
            // Precision scrolling: focus the line in the center of the viewport
            highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightStyle]);

    const handleClick = (e: React.MouseEvent) => {
        if (!viewportRef.current || !onPdfClick || !containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const [pdfX, pdfY] = viewportRef.current.convertToPdfPoint(x, y);
        onPdfClick(pageNumber, pdfX, pdfY);
    };

    return (
        <div 
            ref={containerRef}
            onClick={handleClick}
            className="relative bg-white shadow-lg mb-6 transition-all duration-200 mx-auto group cursor-text"
            style={{ 
                width: dimensions ? dimensions.width : '100%', 
                height: dimensions ? dimensions.height : '800px', 
                minHeight: '200px'
            }}
        >
            {!isRendered && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400">
                    <Loader2 className="animate-spin" />
                </div>
            )}
            <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
            
            {highlightStyle && (
                 <div 
                    ref={highlightRef}
                    className="absolute bg-yellow-400/30 border-2 border-yellow-500 z-10 mix-blend-multiply transition-all duration-300 pointer-events-none"
                    style={highlightStyle}
                />
            )}
            
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded backdrop-blur-sm opacity-50 hover:opacity-100 transition-opacity select-none pointer-events-none">
                Page {pageNumber}
            </div>
        </div>
    );
};


// --- Main Viewer Component ---

export const PdfViewer: React.FC<PdfViewerProps> = ({ 
    fileUrl, 
    highlightPage, 
    highlightRect, 
    documents, 
    activeDocumentId, 
    onDocumentChange,
    onPdfClick
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const [scale, setScale] = useState(1.2); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  // Drag Pan State
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  // Load Document
  useEffect(() => {
    let active = true;
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjs.getDocument(fileUrl);
        const doc = await loadingTask.promise;
        if (active) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setLoading(false);
          
          // Auto-fit first page
          const page = await doc.getPage(1);
          const viewport = page.getViewport({ scale: 1 });
          if (containerRef.current) {
               const availWidth = containerRef.current.clientWidth - 60;
               if (availWidth > 0) {
                   setScale(availWidth / viewport.width);
               }
          }
        }
      } catch (err) {
        console.error("Error loading PDF:", err);
        if (active) {
          setError("Could not load PDF. It might be corrupted or password protected.");
          setLoading(false);
        }
      }
    };

    if (fileUrl) loadPdf();
    return () => { active = false; };
  }, [fileUrl]);

  // Precise scrolling is now handled at the page level by PdfPage's scrollIntoView on the highlight ref
  // This avoids double-scrolling or fighting with the document container's offset

  const changeZoom = (delta: number) => {
      setScale(prev => Math.max(0.5, Math.min(4.0, prev + delta)));
  };

  const registerPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
      if (el) pageRefs.current.set(page, el);
      else pageRefs.current.delete(page);
  }, []);

  const handlePageInView = useCallback((page: number) => {
      setVisiblePage(page);
  }, []);

  // --- Panning Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
        e.preventDefault();
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
    if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.removeProperty('user-select');
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.removeProperty('user-select');
    }
  };

  if (!fileUrl) return null;

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
                        className="appearance-none pl-9 pr-9 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[160px] max-w-[240px] truncate shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                     >
                         {documents.map(doc => (
                             <option key={doc.id} value={doc.id}>
                                 {doc.name}
                             </option>
                         ))}
                     </select>
                     <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                     <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                </div>
            ) : (
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:block">
                    {loading ? 'Loading PDF...' : `${numPages} Pages`}
                </span>
            )}
        </div>
        
        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
            Page {visiblePage} of {numPages}
        </div>

        <div className="flex items-center gap-1">
             <button 
                onClick={() => changeZoom(-0.2)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors"
                title="Zoom Out"
            >
                <ZoomOut size={16} />
            </button>
            <span className="text-xs w-12 text-center text-slate-500">{Math.round(scale * 100)}%</span>
            <button 
                onClick={() => changeZoom(0.2)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-colors"
                title="Zoom In"
            >
                <ZoomIn size={16} />
            </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className={`flex-1 overflow-auto bg-slate-100/50 dark:bg-slate-900/50 p-8 ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
          <div className="flex flex-col min-w-full min-h-full">
            {loading && (
                <div className="flex flex-col items-center justify-center mt-20 text-slate-400 w-full">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p className="text-sm">Loading document...</p>
                </div>
            )}
            
            {error && (
                <div className="flex flex-col items-center justify-center mt-20 text-red-500 w-full">
                    <AlertCircle size={32} className="mb-2" />
                    <p className="font-bold">Error Loading PDF</p>
                    <p className="text-sm opacity-80">{error}</p>
                </div>
            )}

            {!loading && !error && pdfDoc && (
                Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                    <PdfPage 
                        key={pageNum}
                        pageNumber={pageNum}
                        pdfDoc={pdfDoc}
                        scale={scale}
                        highlightRect={highlightPage === pageNum ? highlightRect : undefined}
                        onInView={handlePageInView}
                        registerRef={registerPageRef}
                        onPdfClick={onPdfClick}
                    />
                ))
            )}
          </div>
      </div>
    </div>
  );
}