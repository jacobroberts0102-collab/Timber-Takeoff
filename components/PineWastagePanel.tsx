import React, { useMemo, useState } from 'react';
import { X, Trees, Info, Copy, Check, AlertCircle, TrendingUp, ChevronRight, Layers, ArrowUpRight, Scissors } from 'lucide-react';
import { ParsedLine, CatalogProduct, PineWastageRow } from '../types';
import { computePineWastage } from '../services/pineWastage';
import { optimizeCutting } from '../services/wastageOptimizer';

interface PineWastagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  lines: ParsedLine[]; 
  catalog: CatalogProduct[];
  onSelectSourceLine?: (id: string) => void;
}

interface WastageRowProps {
    row: PineWastageRow;
    sourceLines: ParsedLine[];
    onSelectSourceLine?: (id: string) => void;
}

const WastageTableRow: React.FC<WastageRowProps> = ({ row, sourceLines, onSelectSourceLine }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <tr 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`group cursor-pointer transition-colors ${isExpanded ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
            >
                <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        <div className={`p-0.5 rounded transition-transform ${isExpanded ? 'rotate-90 text-emerald-600' : 'text-slate-400'}`}>
                            <ChevronRight size={14} />
                        </div>
                        {row.dimsLabel}
                    </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">{row.totalLm.toFixed(1)}m</td>
                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">{row.suppliedLm.toFixed(1)}m</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-200">{row.lengths6m}x</td>
                <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{row.offcutLm.toFixed(1)}m</td>
                <td className="px-4 py-3 text-right font-mono">
                    <span className={row.wastagePct > 15 ? 'text-red-500' : 'text-emerald-500'}>
                        {row.wastagePct.toFixed(1)}%
                    </span>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-slate-50/30 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
                    <td colSpan={6} className="px-4 py-3">
                        <div className="pl-6 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                <Layers size={10} /> Contributing Takeoff Lines
                            </div>
                            {sourceLines.map(line => (
                                <div 
                                    key={line.id} 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectSourceLine?.(line.id);
                                    }}
                                    className="flex items-center justify-between text-xs py-1.5 px-2 -mx-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all group/line cursor-pointer border-b border-slate-100/50 dark:border-slate-800/50 last:border-none"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 rounded font-bold shrink-0">
                                            {line.section}
                                        </span>
                                        <span className="text-slate-600 dark:text-slate-300 truncate font-medium group-hover/line:text-blue-600 dark:group-hover/line:text-blue-400 transition-colors" title={line.item}>
                                            {line.item}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="font-mono text-slate-500 dark:text-slate-400">
                                            {line.total.toFixed(2)}m
                                        </span>
                                        <ArrowUpRight size={12} className="text-slate-300 opacity-0 group-hover/line:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))}
                            {sourceLines.length === 0 && (
                                <div className="text-xs text-slate-400 italic">No detailed source items found.</div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

export const PineWastagePanel: React.FC<PineWastagePanelProps> = ({ isOpen, onClose, lines, catalog, onSelectSourceLine }) => {
  const { rows, summary } = useMemo(() => computePineWastage(lines, catalog), [lines, catalog]);
  const cuttingList = useMemo(() => optimizeCutting(lines), [lines]);
  const [copied, setCopied] = useState(false);
  const [showCuttingList, setShowCuttingList] = useState(false);

  const handleCopyCsv = () => {
    const headers = "Dimensions,Required LM,Supplied LM,6.0m Lengths,Offcut LM,Wastage %,Suggested Code";
    const body = rows.map(r => 
        `${r.dimsLabel},${r.totalLm.toFixed(2)},${r.suppliedLm.toFixed(2)},${r.lengths6m},${r.offcutLm.toFixed(2)},${r.wastagePct}%,${r.suggestedItemNo || 'N/A'}`
    ).join('\n');
    navigator.clipboard.writeText(`${headers}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[110] w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Trees size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pine Wastage Analysis</h2>
            <p className="text-sm text-slate-500">Exact cover tracking for standard 6.0m stock</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Summary Card */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Required</span>
                <span className="text-xl font-black text-slate-800 dark:text-white">{summary.totalLm.toFixed(1)}m</span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Supplied</span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">{summary.totalSuppliedLm.toFixed(1)}m</span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">Offcut</span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">{summary.totalOffcutLm.toFixed(1)}m</span>
            </div>
            <div className={`p-4 rounded-xl border ${summary.overallWastagePct > 15 ? 'bg-red-50 border-red-100 dark:bg-red-900/20' : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest block mb-1 opacity-60">Wastage</span>
                <span className={`text-xl font-black ${summary.overallWastagePct > 15 ? 'text-red-600' : 'text-emerald-600'}`}>{summary.overallWastagePct.toFixed(1)}%</span>
            </div>
        </div>

        {rows.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center text-slate-400">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="font-bold">No analyzable PINE items detected.</p>
                <p className="text-sm">Analysis applies to items matched to PIDRRDM using stock-length derivation.</p>
            </div>
        ) : (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <TrendingUp size={14} /> Breakdown by Dimensions
                    </h3>
                    <button 
                        onClick={() => setShowCuttingList(!showCuttingList)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-[10px] font-black uppercase tracking-tight border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                    >
                        <Scissors size={10} />
                        {showCuttingList ? 'Show Stats' : 'Show Cutting List'}
                    </button>
                </div>

                {showCuttingList ? (
                    <div className="space-y-3">
                        {cuttingList.map((bin, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Board #{i + 1} (6.0m)</span>
                                    <span className="text-[10px] font-bold text-amber-500 uppercase">Waste: {(bin.waste / 1000).toFixed(2)}m</span>
                                </div>
                                <div className="flex gap-1 h-6 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden p-0.5">
                                    {bin.cuts.map((cut, j) => (
                                        <div 
                                            key={j} 
                                            style={{ width: `${(cut / 6000) * 100}%` }}
                                            className="h-full bg-emerald-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                                            title={`${cut}mm cut`}
                                        >
                                            {cut}
                                        </div>
                                    ))}
                                    <div 
                                        style={{ width: `${(bin.waste / 6000) * 100}%` }}
                                        className="h-full bg-slate-200 dark:bg-slate-700"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3">Dims</th>
                                    <th className="px-4 py-3 text-right">Req. LM</th>
                                    <th className="px-4 py-3 text-right">Sup. LM</th>
                                    <th className="px-4 py-3 text-right">Qty(6m)</th>
                                    <th className="px-4 py-3 text-right">Offcut</th>
                                    <th className="px-4 py-3 text-right">Waste%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rows.map((row) => {
                                    const sourceLines = lines.filter(l => row.sourceLineIds.includes(l.id));
                                    return (
                                        <WastageTableRow key={row.dimsKey} row={row} sourceLines={sourceLines} onSelectSourceLine={onSelectSourceLine} />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 p-4 rounded-xl flex gap-3">
                    <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                        Calculations use <strong>exact source requirements</strong> vs. <strong>6.0m standard stock lengths</strong>. 
                        Wastage is calculated as <code>(Supplied - Required) / Supplied</code>. 
                        Click a row to see the contributing takeoff items.
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex gap-3">
        <button 
          onClick={handleCopyCsv}
          className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
        >
          {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
          {copied ? 'Copied' : 'Copy CSV'}
        </button>
        <div className="flex-[2] px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
            <Check size={18} className="text-emerald-500" />
            Fractional math reconciliation active
        </div>
      </div>
    </div>
  );
};
