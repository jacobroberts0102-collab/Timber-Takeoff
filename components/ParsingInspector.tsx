import React from 'react';
import { ParsedLine } from '../types';
import { X, Search, CheckCircle, AlertCircle, Terminal, Layers } from 'lucide-react';

interface ParsingInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  row: ParsedLine;
}

export const ParsingInspector: React.FC<ParsingInspectorProps> = ({ isOpen, onClose, row }) => {
  if (!isOpen) return null;

  const trace = row.debugTrace;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <Search size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Parsing Inspector</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Row ID: {row.id.slice(0, 8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Raw Input */}
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Terminal size={14} /> Raw Input
                </h4>
                <div className="bg-slate-950 text-slate-200 p-4 rounded-lg font-mono text-sm shadow-inner overflow-x-auto whitespace-pre-wrap break-all border border-slate-800">
                    {row.originalLine || "No original text preserved."}
                </div>
            </div>

            {/* Trace Timeline */}
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers size={14} /> Extraction Logic
                </h4>
                
                {trace ? (
                    <div className="relative pl-4 space-y-4 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
                        {/* Rules */}
                        {trace.appliedRules.length > 0 && (
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-white dark:ring-slate-900"></div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase mb-1">Applied Rules</div>
                                    <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                                        {trace.appliedRules.map((r, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <AlertCircle size={14} className="mt-0.5 shrink-0 opacity-70" />
                                                <span>{r}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Regex Extractions */}
                        {trace.extraction.map((ext, i) => (
                            <div key={i} className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-900"></div>
                                <div className="text-sm text-slate-700 dark:text-slate-300">
                                    <span className="font-bold text-slate-900 dark:text-white capitalize">{ext.field}</span> found via <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">{ext.source}</code>
                                </div>
                                <div className="mt-1 font-mono text-xs bg-slate-50 dark:bg-slate-800 inline-block px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                    {String(ext.value)}
                                </div>
                            </div>
                        ))}

                        {/* Step Log */}
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-400 ring-4 ring-white dark:ring-slate-900"></div>
                            <div className="space-y-2">
                                {trace.stepLog.map((step, i) => (
                                    <div key={i} className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                        {step}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        No detailed trace available for this row.
                    </div>
                )}
            </div>

            {/* Final Output Preview */}
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CheckCircle size={14} /> Final Parsed Object
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Section</span>
                        <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{row.section}</div>
                    </div>
                    <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Item</span>
                        <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{row.item}</div>
                    </div>
                    <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Dims / Grade</span>
                        <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{row.dimensions} {row.grade}</div>
                    </div>
                    <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Result</span>
                        <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400 truncate">
                            {row.qty} {row.length ? `x ${row.length}` : ''} {row.unit}
                        </div>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};