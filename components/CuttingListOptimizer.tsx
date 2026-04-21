import React, { useMemo } from 'react';
import { ParsedLine } from '../types';
import { Scissors, Layout, Download, AlertTriangle } from 'lucide-react';
import { ThreeDCuttingView } from './ThreeDCuttingView';

interface CuttingListOptimizerProps {
    data: ParsedLine[];
}

interface StockLength {
    length: number;
    used: number[];
    waste: number;
}

export const CuttingListOptimizer: React.FC<CuttingListOptimizerProps> = ({ data }) => {
    const stockLengths = useMemo(() => [2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.2, 4.5, 4.8, 5.1, 5.4, 5.7, 6.0], []);

    const optimization = useMemo(() => {
        // Group by material (item + dimensions)
        const groups: Record<string, number[]> = {};
        data.forEach(row => {
            if (row.unit === 'L/M' && row.length && row.qty) {
                const key = `${row.item} ${row.dimensions}`;
                if (!groups[key]) groups[key] = [];
                for (let i = 0; i < row.qty; i++) {
                    groups[key].push(row.length);
                }
            }
        });

        const results: Record<string, StockLength[]> = {};

        Object.entries(groups).forEach(([material, lengths]) => {
            // Sort lengths descending for First Fit Decreasing (FFD)
            const sortedLengths = [...lengths].sort((a, b) => b - a);
            const bins: StockLength[] = [];

            sortedLengths.forEach(len => {
                // Find best stock length for this piece if it's the first in a bin
                // Or find existing bin with space
                let placed = false;
                for (const bin of bins) {
                    if (bin.length - bin.used.reduce((a, b) => a + b, 0) >= len) {
                        bin.used.push(len);
                        bin.waste = bin.length - bin.used.reduce((a, b) => a + b, 0);
                        placed = true;
                        break;
                    }
                }

                if (!placed) {
                    // Pick the smallest stock length that fits this piece
                    const bestStock = stockLengths.find(s => s >= len) || stockLengths[stockLengths.length - 1];
                    bins.push({
                        length: bestStock,
                        used: [len],
                        waste: bestStock - len
                    });
                }
            });

            results[material] = bins;
        });

        return results;
    }, [data, stockLengths]);

    const totalWaste = useMemo(() => {
        let waste = 0;
        let total = 0;
        Object.values(optimization).flat().forEach(bin => {
            waste += bin.waste;
            total += bin.length;
        });
        return total > 0 ? (waste / total) * 100 : 0;
    }, [optimization]);

    const [viewMode, setViewMode] = React.useState<'2d' | '3d'>('2d');

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <Scissors className="text-violet-600 dark:text-violet-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Cutting List Optimizer</h2>
                        <p className="text-sm text-slate-500">First-Fit Decreasing algorithm for minimal waste</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mr-4">
                        <button 
                            onClick={() => setViewMode('2d')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === '2d' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            2D Plan
                        </button>
                        <button 
                            onClick={() => setViewMode('3d')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === '3d' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            3D View
                        </button>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency</div>
                        <div className={`text-xl font-black ${totalWaste < 5 ? 'text-emerald-500' : totalWaste < 10 ? 'text-amber-500' : 'text-red-500'}`}>
                            {(100 - totalWaste).toFixed(1)}%
                        </div>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold text-sm shadow-lg hover:scale-105 transition-transform">
                        <Download size={16} /> Export List
                    </button>
                </div>
            </div>

            {totalWaste > 12 && (
                <div className="mx-6 mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                        <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-amber-800 dark:text-amber-200">Wastage Guard Alert</h4>
                        <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                            Current wastage is high ({(totalWaste).toFixed(1)}%). 
                            {totalWaste > 15 ? " Consider using longer stock lengths (e.g. 6.0m) to reduce offcuts." : " Try adjusting your stock length mix to improve efficiency."}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {Object.entries(optimization).map(([material, bins]) => (
                    <div key={material} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-slate-700 dark:text-slate-200 uppercase text-xs tracking-widest flex items-center gap-2">
                                <Layout size={14} className="text-slate-400" /> {material}
                            </h3>
                            <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                                {bins.length} Stock Lengths Required
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {bins.map((bin, i) => (
                                <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-black text-slate-400">STOCK: {bin.length}m</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bin.waste < 0.3 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                            Waste: {bin.waste.toFixed(2)}m
                                        </span>
                                    </div>
                                    
                                    {viewMode === '2d' ? (
                                        <div className="relative h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex">
                                            {bin.used.map((len, j) => (
                                                <div 
                                                    key={j}
                                                    style={{ width: `${(len / bin.length) * 100}%` }}
                                                    className={`h-full border-r border-white/20 flex items-center justify-center text-[9px] font-black text-white ${
                                                        j % 2 === 0 ? 'bg-violet-500' : 'bg-blue-500'
                                                    }`}
                                                    title={`Piece: ${len}m`}
                                                >
                                                    {len}m
                                                </div>
                                            ))}
                                            <div 
                                                style={{ width: `${(bin.waste / bin.length) * 100}%` }}
                                                className="h-full bg-slate-200 dark:bg-slate-700/50 flex items-center justify-center"
                                            >
                                                <Scissors size={10} className="text-slate-400 opacity-50" />
                                            </div>
                                        </div>
                                    ) : (
                                        <ThreeDCuttingView bin={bin} />
                                    )}
                                    
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {bin.used.map((len, j) => (
                                            <span key={j} className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                                                Piece {j+1}: {len}m
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {Object.keys(optimization).length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-4">
                            <Scissors size={40} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">No data to optimize</h3>
                        <p className="text-slate-500 max-w-xs">Add items with quantities and lengths in L/M unit to see the cutting list optimization.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
