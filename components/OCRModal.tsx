import React, { useState } from 'react';
import { Scan, Loader2 } from 'lucide-react';

interface OCRModalProps {
  fileName: string;
  pageCount: number;
  onConfirm: (pages: number[] | null, useAI?: boolean) => void;
  onCancel: () => void;
  progress?: { current: number; status: string };
}

export const OCRModal: React.FC<OCRModalProps> = ({ fileName, pageCount, onConfirm, onCancel, progress }) => {
  const [rangeOption, setRangeOption] = useState<'all' | 'first' | 'custom'>('all');
  const [customRange, setCustomRange] = useState('');
  const [useAI, setUseAI] = useState(false);

  const handleConfirm = () => {
    let pages: number[] | null = null;
    
    if (rangeOption === 'first') {
        pages = [1];
    } else if (rangeOption === 'custom') {
        // Simple parser: "1,3,5-7"
        const parts = customRange.split(',').map(p => p.trim());
        const pSet = new Set<number>();
        parts.forEach(p => {
            if (p.includes('-')) {
                const [start, end] = p.split('-').map(Number);
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= end; i++) pSet.add(i);
                }
            } else {
                const n = parseInt(p);
                if (!isNaN(n)) pSet.add(n);
            }
        });
        pages = Array.from(pSet).filter(p => p >= 1 && p <= pageCount).sort((a, b) => a - b);
        if (pages.length === 0) pages = null; // Fallback to all? Or validation error.
    }

    onConfirm(pages, useAI);
  };

  const isProcessing = !!progress;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    {isProcessing ? <Loader2 size={32} className="animate-spin" /> : <Scan size={32} />}
                </div>
                
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    {isProcessing ? 'Running OCR...' : 'Scanned PDF Detected'}
                </h2>
                
                <p className="text-slate-600 dark:text-slate-300 mb-6">
                    {isProcessing 
                        ? progress.status 
                        : `The file "${fileName}" appears to be a scanned image. Would you like to run text recognition (OCR)?`}
                </p>

                {isProcessing && (
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2 overflow-hidden">
                        <div 
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{ width: `${progress.current}%` }}
                        ></div>
                    </div>
                )}

                {!isProcessing && (
                    <div className="text-left bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                         <div className="text-xs font-bold text-slate-500 uppercase mb-2">Processing Options</div>
                         
                         <div className="space-y-2">
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input 
                                    type="radio" 
                                    name="range" 
                                    checked={rangeOption === 'all'} 
                                    onChange={() => setRangeOption('all')}
                                    className="text-blue-600 focus:ring-blue-500"
                                 />
                                 <span className="text-sm text-slate-700 dark:text-slate-200">Process all {pageCount} pages</span>
                             </label>

                             {pageCount > 1 && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="range" 
                                        checked={rangeOption === 'first'} 
                                        onChange={() => setRangeOption('first')}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-200">Process page 1 only (Fastest)</span>
                                </label>
                             )}

                             <label className="flex items-start gap-2 cursor-pointer">
                                 <input 
                                    type="radio" 
                                    name="range" 
                                    checked={rangeOption === 'custom'} 
                                    onChange={() => setRangeOption('custom')}
                                    className="text-blue-600 focus:ring-blue-500 mt-1"
                                 />
                                 <div className="flex-1">
                                     <span className="text-sm text-slate-700 dark:text-slate-200 block mb-1">Custom Range</span>
                                     <input 
                                        type="text" 
                                        placeholder="e.g. 1-3, 5" 
                                        disabled={rangeOption !== 'custom'}
                                        value={customRange}
                                        onChange={(e) => setCustomRange(e.target.value)}
                                        className="w-full text-sm p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 disabled:opacity-50 shadow-sm"
                                     />
                                 </div>
                             </label>
                         </div>

                         <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                             <label className="flex items-center gap-3 cursor-pointer group">
                                 <div className={`w-10 h-6 rounded-full transition-colors relative ${useAI ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                     <input 
                                        type="checkbox" 
                                        className="sr-only" 
                                        checked={useAI}
                                        onChange={() => setUseAI(!useAI)}
                                     />
                                     <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${useAI ? 'translate-x-4' : ''}`} />
                                 </div>
                                 <div className="flex-1">
                                     <span className="text-sm font-bold text-slate-800 dark:text-white block">AI Enhanced (Gemini Vision)</span>
                                     <span className="text-[10px] text-slate-500 block">Uses advanced AI to understand complex drawings and tables.</span>
                                 </div>
                             </label>
                         </div>
                    </div>
                )}

                <div className="flex gap-3 justify-center">
                    {!isProcessing ? (
                        <>
                            <button 
                                onClick={onCancel}
                                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                Skip OCR
                            </button>
                            <button 
                                onClick={handleConfirm}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5"
                            >
                                Run OCR
                            </button>
                        </>
                    ) : (
                         <div className="text-xs text-slate-400">
                             Processing on your device. Please wait...
                         </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};