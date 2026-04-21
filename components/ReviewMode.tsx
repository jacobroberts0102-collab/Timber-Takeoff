import React, { useState, useEffect, useMemo } from 'react';
import { ParsedLine } from '../types';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ReviewModeProps {
  data: ParsedLine[];
  onUpdateRow: (id: string, field: keyof ParsedLine, value: any) => void;
  onExit: () => void;
  onActiveRowChange?: (id: string) => void;
}

export const ReviewMode: React.FC<ReviewModeProps> = ({ data, onUpdateRow, onExit, onActiveRowChange }) => {
  // 1. Identify Issues
  const issueIndices = useMemo(() => {
    return data.map((row, index) => {
        const issues: string[] = [];
        if (!row.item || !row.item.trim()) issues.push("Missing Description");
        if (row.qty <= 0 || isNaN(row.qty)) issues.push("Invalid Quantity");
        if (!row.unit) issues.push("Missing Unit");
        if ((row.confidence || 1) < 0.6) issues.push("Low Confidence");
        if ((row.unit === 'L/M' || row.unit === 'm2') && (!row.dimensions || !row.dimensions.trim())) issues.push("Missing Dimensions");
        
        return { index, issues };
    }).filter(item => item.issues.length > 0);
  }, [data]);

  const [currentIndex, setCurrentIndex] = useState(() => {
      const saved = localStorage.getItem(`review_index_${data.length}`);
      return saved ? parseInt(saved) : 0;
  });
  
  const [prevIssueIndicesLength, setPrevIssueIndicesLength] = useState(issueIndices.length);
  if (issueIndices.length !== prevIssueIndicesLength) {
    setPrevIssueIndicesLength(issueIndices.length);
    if (currentIndex >= issueIndices.length && issueIndices.length > 0) {
      setCurrentIndex(issueIndices.length - 1);
    }
  }

  useEffect(() => {
      localStorage.setItem(`review_index_${data.length}`, currentIndex.toString());
  }, [currentIndex, data.length]);

  // Sync active row with parent (PDF viewer)
  useEffect(() => {
      if (issueIndices.length > 0) {
          const idx = Math.min(currentIndex, issueIndices.length - 1);
          const activeItem = issueIndices[idx];
          if (activeItem && onActiveRowChange) {
              onActiveRowChange(data[activeItem.index].id);
          }
      }
  }, [currentIndex, issueIndices, data, onActiveRowChange]);

  // Handle case where all issues are resolved
  if (issueIndices.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm animate-fade-in">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">All Clear!</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                  No critical issues found. You can switch back to the main table view to review the rest of your takeoff.
              </p>
              <button 
                  onClick={onExit}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors"
              >
                  Return to All Rows
              </button>
          </div>
      );
  }

  // Ensure index is valid
  const activeItem = issueIndices[Math.min(currentIndex, issueIndices.length - 1)];
  const row = data[activeItem.index];
  const issues = activeItem.issues;

  const handleNext = () => {
      if (currentIndex < issueIndices.length - 1) {
          setCurrentIndex(prev => prev + 1);
      }
  };

  const handlePrev = () => {
      if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault(); 
              handleNext();
          }
          return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') handleNext();
      if (e.key === 'k' || e.key === 'ArrowUp') handlePrev();
      if (e.key === 'Escape') onExit();
  };

  const setUnit = (unit: 'L/M' | 'EA' | 'm2') => {
      onUpdateRow(row.id, 'unit', unit);
      if (unit === 'EA') onUpdateRow(row.id, 'total', row.qty);
      if (unit === 'L/M' && row.length) onUpdateRow(row.id, 'total', row.qty * row.length);
  };

  return (
    <div 
        className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-xl outline-none" 
        tabIndex={0} 
        onKeyDown={handleKeyDown}
    >
        {/* Navigation Bar */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 rounded-t-xl">
            <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Issue {currentIndex + 1} of {issueIndices.length}
                </span>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-2"></div>
                <div className="flex gap-1">
                    <button 
                        onClick={handlePrev} 
                        disabled={currentIndex === 0}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
                        title="Previous (K)"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button 
                        onClick={handleNext} 
                        disabled={currentIndex === issueIndices.length - 1}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
                        title="Next (J or Enter)"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                 <div className="text-xs text-slate-400 mr-2 hidden sm:block">
                    <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded mx-1">Enter</span> to next
                    <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded mx-1">Esc</span> to exit
                 </div>
                 <button onClick={onExit} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X size={20} />
                 </button>
            </div>
        </div>

        {/* Card Content - Wrapped in overflow-auto to handle varying content heights */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 flex justify-center items-start">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                
                {/* Header: Issues & Section */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 border-b border-amber-100 dark:border-amber-800 flex flex-col justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-300 rounded-lg shrink-0">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-amber-800 dark:text-amber-200 text-sm">Needs Attention</h3>
                            <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 list-disc list-inside">
                                {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                            </ul>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-amber-100 dark:border-amber-800/50">
                        <div className="flex items-center gap-2 flex-1">
                             <label className="text-xs text-slate-500 uppercase font-bold whitespace-nowrap">Section</label>
                             <input 
                                type="text" 
                                value={row.section}
                                onChange={(e) => onUpdateRow(row.id, 'section', e.target.value)}
                                className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-200 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                             <label className="text-xs text-slate-500 uppercase font-bold whitespace-nowrap">Sub Section</label>
                             <input 
                                type="text" 
                                value={row.subSection}
                                onChange={(e) => onUpdateRow(row.id, 'subSection', e.target.value)}
                                className="flex-1 text-sm text-slate-800 dark:text-slate-200 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Form Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-6">
                    
                    {/* Item Description - Full Width */}
                    <div className="md:col-span-12">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Item Name
                        </label>
                        <textarea 
                            value={row.item}
                            onChange={(e) => onUpdateRow(row.id, 'item', e.target.value)}
                            className={`w-full p-2.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 outline-none transition-colors text-sm shadow-sm ${
                                !row.item ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                            }`}
                            rows={2}
                            placeholder="Enter item description..."
                        />
                    </div>

                    {/* Dimensions */}
                    <div className="md:col-span-6">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Dimensions
                        </label>
                        <input 
                            type="text" 
                            value={row.dimensions}
                            onChange={(e) => onUpdateRow(row.id, 'dimensions', e.target.value)}
                            className={`w-full p-2.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 outline-none font-mono text-sm shadow-sm ${
                                (!row.dimensions && (row.unit === 'L/M' || row.unit === 'm2')) 
                                ? 'border-amber-300 ring-2 ring-amber-100' 
                                : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                            }`}
                            placeholder="e.g. 90x45"
                        />
                    </div>

                    {/* Grade */}
                    <div className="md:col-span-6">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Grade
                        </label>
                        <input 
                            type="text" 
                            value={row.grade}
                            onChange={(e) => onUpdateRow(row.id, 'grade', e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm"
                            placeholder="e.g. MGP10"
                        />
                    </div>

                    {/* Unit */}
                    <div className="md:col-span-4">
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Unit
                        </label>
                        <div className="flex gap-2">
                             <select 
                                value={row.unit}
                                onChange={(e) => setUnit(e.target.value as any)}
                                className={`flex-1 p-2.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 outline-none appearance-none text-sm shadow-sm ${
                                    !row.unit ? 'border-red-300' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                                }`}
                             >
                                <option value="L/M">L/M</option>
                                <option value="EA">EA</option>
                                <option value="m2">m2</option>
                             </select>
                        </div>
                    </div>

                    {/* Quantities */}
                    <div className="md:col-span-4">
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Count (Qty)
                        </label>
                        <input 
                            type="number" 
                            value={row.qty}
                            onChange={(e) => onUpdateRow(row.id, 'qty', parseFloat(e.target.value))}
                            className={`w-full p-2.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 outline-none font-mono no-spinner text-sm shadow-sm ${
                                row.qty <= 0 ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                            }`}
                        />
                    </div>

                    <div className="md:col-span-4">
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Length (m)
                        </label>
                        <input 
                            type="number" 
                            value={row.length || ''}
                            onChange={(e) => onUpdateRow(row.id, 'length', parseFloat(e.target.value))}
                            className={`w-full p-2.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 outline-none font-mono no-spinner text-sm shadow-sm ${
                                row.unit === 'L/M' && (!row.length || row.length <= 0) 
                                ? 'border-red-300 ring-2 ring-red-100' 
                                : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                            } ${row.unit === 'EA' ? 'opacity-50' : ''}`}
                            step="0.1"
                            disabled={row.unit === 'EA'}
                        />
                    </div>

                    {/* Total Display */}
                    <div className="md:col-span-12 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                             <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total</span>
                             <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {row.total.toFixed(2)} <span className="text-xs font-normal text-slate-500">{row.unit}</span>
                             </div>
                        </div>
                    </div>

                </div>
                
                {/* Footer: Original Context */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Original Line Context</div>
                    <div className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 whitespace-pre-wrap break-words">
                        {row.originalLine || "No original text available"}
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};