import React, { useState } from 'react';
import { Ruler, Package, FileText, Maximize2, X, Save, DollarSign, TrendingUp } from 'lucide-react';
import { KPIStats, PineWastageSummary } from '../types';

interface StatsCardsProps {
  stats: KPIStats;
  pineWastageSummary?: PineWastageSummary;
}

const Card: React.FC<{ 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  colorClass: string;
  iconColorClassName?: string;
}> = ({ title, value, icon, colorClass, iconColorClassName }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center gap-3.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/20 group cursor-default min-h-[56px] h-[56px] w-full shrink-0">
    <div className={`p-2 rounded-xl ${colorClass} shadow-sm group-hover:scale-110 transition-transform duration-300 shrink-0 flex items-center justify-center ring-1 ring-black/5 dark:ring-white/5`}>
      {/* Fix: use React.ReactElement<any> to allow the 'size' and 'className' prop when cloning the Lucide icon element */}
      {React.cloneElement(icon as React.ReactElement<any>, { 
        size: 16,
        className: iconColorClassName || 'text-white'
      })}
    </div>
    <div className="min-w-0 flex flex-col justify-center">
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 whitespace-nowrap leading-none">{title}</p>
      <p className="text-lg font-black text-slate-800 dark:text-white font-mono tracking-tighter leading-none whitespace-nowrap">{value}</p>
    </div>
  </div>
);

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, pineWastageSummary }) => {
  const safePct = Math.max(0, Number(pineWastageSummary?.overallWastagePct) || 0);

  function pineIconColor(pct: number): string {
    if (pct < 5) return 'text-green-600 dark:text-green-400';
    if (pct <= 10) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }

  return (
    <div className="grid grid-cols-2 gap-2 shrink-0">
      <Card 
        title="Items" 
        value={stats.totalItems} 
        icon={<Package />} 
        colorClass="bg-blue-50 dark:bg-blue-900/20"
        iconColorClassName="text-blue-600 dark:text-blue-400"
      />
      <Card 
        title="Total L/M" 
        value={stats.totalLinearMetres.toFixed(1) + 'm'} 
        icon={<Ruler />} 
        colorClass="bg-yellow-50 dark:bg-yellow-900/20"
        iconColorClassName="text-yellow-500 dark:text-yellow-400"
      />
      <Card 
        title="Total Price" 
        value={'$' + stats.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
        icon={<DollarSign />} 
        colorClass="bg-green-50 dark:bg-green-900/20"
        iconColorClassName="text-green-600 dark:text-green-400"
      />
      <Card 
        title="Pine Wastage" 
        value={safePct.toFixed(1) + '%'} 
        icon={<TrendingUp />} 
        colorClass="bg-slate-50 dark:bg-slate-800/50"
        iconColorClassName={pineIconColor(safePct)}
      />
    </div>
  );
};

interface JobNotesCardProps {
    notes: string;
    onUpdateNotes: (notes: string) => void;
}

export const JobNotesCard: React.FC<JobNotesCardProps> = ({ notes, onUpdateNotes }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <div 
                className="bg-white dark:bg-slate-900 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-200 dark:border-slate-800 px-3 py-2 flex flex-col transition-all duration-300 hover:shadow-md group h-full relative overflow-hidden"
            >
                <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                            <FileText size={10} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Job Notes</span>
                    </div>
                    <button 
                        onClick={() => setIsExpanded(true)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all text-slate-400 hover:text-blue-500 flex items-center gap-1 shrink-0"
                        title="Expand Notes"
                    >
                        <Maximize2 size={10} />
                    </button>
                </div>
                <div className="flex-1 min-h-0">
                    <textarea
                        className="w-full h-full bg-transparent border-none resize-none text-[11px] text-slate-600 dark:text-slate-300 placeholder:text-slate-300 focus:ring-0 p-0 leading-tight custom-scrollbar font-medium whitespace-normal break-words"
                        placeholder="Click expand for full notes..."
                        value={notes}
                        readOnly
                        onClick={() => setIsExpanded(true)}
                    />
                </div>
            </div>

            {/* Expanded Modal View - Preserved exactly as requested */}
            {isExpanded && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh] border border-slate-200 dark:border-slate-700">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg">
                                    <FileText size={20} />
                                </div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Job Notes</h3>
                            </div>
                            <button 
                                onClick={() => setIsExpanded(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 p-6 overflow-hidden flex flex-col">
                            <textarea
                                autoFocus
                                className="flex-1 w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-base text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none leading-relaxed custom-scrollbar shadow-inner"
                                placeholder="Add detailed job notes, site requirements, or customer instructions here..."
                                value={notes}
                                onChange={(e) => onUpdateNotes(e.target.value)}
                            />
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                            <button 
                                onClick={() => setIsExpanded(false)}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95"
                            >
                                <Save size={18} />
                                Close & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};