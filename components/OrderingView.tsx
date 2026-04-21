import React, { useState, useMemo } from 'react';
import { ParsedLine, OptimizationGroup } from '../types';
import { groupForOptimization, optimizeGroup, DEFAULT_STOCK_LENGTHS, DEFAULT_KERF } from '../services/optimizer';
import { Settings, ChevronRight, ShoppingCart, Scissors, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

interface OrderingViewProps {
  data: ParsedLine[];
}

export const OrderingView: React.FC<OrderingViewProps> = ({ data }) => {
  // Config State
  const [stockLengthsStr, setStockLengthsStr] = useState(DEFAULT_STOCK_LENGTHS.join(', '));
  const [kerf, setKerf] = useState(DEFAULT_KERF);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Derived State
  const stockLengths = useMemo(() => {
      return stockLengthsStr.split(',')
          .map(s => parseFloat(s.trim()))
          .filter(n => !isNaN(n) && n > 0)
          .sort((a, b) => a - b);
  }, [stockLengthsStr]);

  const results = useMemo(() => {
      const groups = groupForOptimization(data);
      const optimized: OptimizationGroup[] = [];
      
      groups.forEach((rows, key) => {
          optimized.push(optimizeGroup(key, rows, stockLengths, kerf));
      });

      return optimized.sort((a, b) => a.key.localeCompare(b.key));
  }, [data, stockLengths, kerf]);

  const totals = useMemo(() => {
      return results.reduce((acc, group) => ({
          required: acc.required + group.totalRequiredLength,
          stock: acc.stock + group.totalStockLength,
          bins: acc.bins + group.bins.length
      }), { required: 0, stock: 0, bins: 0 });
  }, [results]);

  const wastePercent = totals.stock > 0 
      ? ((totals.stock - totals.required) / totals.stock) * 100 
      : 0;

  const toggleGroup = (key: string) => {
      const next = new Set(expandedGroups);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setExpandedGroups(next);
  };

  const handleExportCSV = () => {
      // Create Order List Sheet
      const orderRows = results.flatMap(g => 
          g.orderList.map(item => ({
              'Group': g.key,
              'Stock Length (m)': item.length,
              'Quantity': item.count,
              'Total Length (m)': item.length * item.count
          }))
      );
      const wsOrder = XLSX.utils.json_to_sheet(orderRows);

      // Create Cut List Sheet
      const cutRows = results.flatMap(g => 
          g.bins.flatMap((bin, binIdx) => 
              bin.cuts.map(cut => ({
                  'Group': g.key,
                  'Stock Board #': binIdx + 1,
                  'Board Length': bin.stockLength,
                  'Cut Length': cut.length,
                  'Item': cut.description,
                  'Section': cut.section
              }))
          )
      );
      const wsCuts = XLSX.utils.json_to_sheet(cutRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsOrder, "Shopping List");
      XLSX.utils.book_append_sheet(wb, wsCuts, "Cut Plan");

      XLSX.writeFile(wb, "Timber_Order_and_Cut_List.xlsx");
  };

  const handlePrint = () => {
      window.print();
  };

  if (data.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <ShoppingCart size={48} className="mb-4 opacity-20" />
              <p>No data available. Convert a takeoff first.</p>
          </div>
      );
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden animate-fade-in">
        {/* Sidebar Config - Hidden on print */}
        <div className="w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col print:hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Settings size={18} /> Configuration
                </h3>
            </div>
            
            <div className="p-4 space-y-6 overflow-y-auto flex-1">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Available Stock Lengths (m)</label>
                    <textarea 
                        value={stockLengthsStr}
                        onChange={(e) => setStockLengthsStr(e.target.value)}
                        className="w-full p-2 text-sm border rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white h-24 font-mono shadow-sm"
                        placeholder="e.g. 2.4, 3.0, 3.6"
                    />
                    <p className="text-xs text-slate-400 mt-1">Comma separated values.</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kerf Allowance (mm)</label>
                    <input 
                        type="number"
                        value={kerf}
                        onChange={(e) => setKerf(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 text-sm border rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm"
                    />
                    <p className="text-xs text-slate-400 mt-1">Width of the saw blade cut.</p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">Algorithm</h4>
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        Uses <strong>First-Fit Decreasing</strong> logic. Cuts are sorted largest to smallest and placed in the first available stock piece. 
                        Stock lengths are optimized to minimize waste per board.
                    </p>
                </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                <button 
                    onClick={handleExportCSV}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                    <Download size={16} /> Export Order CSV
                </button>
                <button 
                    onClick={handlePrint}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                    <Printer size={16} /> Print View
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header / Summary */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 shadow-sm z-10 print:border-none print:shadow-none">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Ordering & Cut List</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Optimized stock orders based on current takeoff.</p>
                    </div>

                    <div className="flex gap-4">
                        <div className="text-right">
                            <div className="text-xs font-bold text-slate-500 uppercase">Net Required</div>
                            <div className="text-xl font-bold text-slate-800 dark:text-white">{totals.required.toFixed(1)}m</div>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-slate-500 uppercase">Gross Order</div>
                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{totals.stock.toFixed(1)}m</div>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-slate-500 uppercase">Waste</div>
                            <div className={`text-xl font-bold ${wastePercent > 15 ? 'text-red-500' : 'text-green-500'}`}>
                                {wastePercent.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible">
                {results.map((group) => {
                    const isExpanded = expandedGroups.has(group.key);
                    
                    return (
                        <div key={group.key} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden print:border print:break-inside-avoid">
                            {/* Group Header */}
                            <div 
                                onClick={() => toggleGroup(group.key)}
                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer select-none border-b border-slate-100 dark:border-slate-700"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-1 rounded bg-white dark:bg-slate-700 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                        <ChevronRight size={16} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">{group.key}</h3>
                                        <div className="flex gap-2 text-xs text-slate-500 mt-0.5">
                                            <span>Required: {group.totalRequiredLength.toFixed(1)}m</span>
                                            <span>•</span>
                                            <span>Order: {group.totalStockLength.toFixed(1)}m</span>
                                            <span>•</span>
                                            <span className={group.wastePercentage > 15 ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}>
                                                Waste: {group.wastePercentage.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Order Summary Chips */}
                                <div className="flex items-center gap-2">
                                    {group.orderList.slice(0, 3).map((item, i) => (
                                        <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800">
                                            {item.count}x {item.length}m
                                        </span>
                                    ))}
                                    {group.orderList.length > 3 && (
                                        <span className="text-xs text-slate-400">+{group.orderList.length - 3} more</span>
                                    )}
                                </div>
                            </div>

                            {/* Details (Collapsible) */}
                            {isExpanded && (
                                <div className="p-0 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-700">
                                        
                                        {/* Left Col: Shopping List */}
                                        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <ShoppingCart size={14} /> Shopping List
                                            </h4>
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                                        <th className="text-left py-2 font-semibold text-slate-600 dark:text-slate-300">Length</th>
                                                        <th className="text-right py-2 font-semibold text-slate-600 dark:text-slate-300">Qty</th>
                                                        <th className="text-right py-2 font-semibold text-slate-600 dark:text-slate-300">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                    {group.orderList.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="py-2 text-slate-800 dark:text-slate-200 font-mono font-bold">{item.length.toFixed(1)}m</td>
                                                            <td className="py-2 text-right text-slate-600 dark:text-slate-400">x {item.count}</td>
                                                            <td className="py-2 text-right text-slate-500">{(item.length * item.count).toFixed(1)}m</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="border-t border-slate-200 dark:border-slate-700">
                                                    <tr>
                                                        <td className="py-3 font-bold text-slate-800 dark:text-white">Total</td>
                                                        <td className="py-3 text-right font-bold text-slate-800 dark:text-white">{group.bins.length}</td>
                                                        <td className="py-3 text-right font-bold text-blue-600 dark:text-blue-400">{group.totalStockLength.toFixed(1)}m</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        {/* Right Col: Cut Plans */}
                                        <div className="col-span-2 p-6">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <Scissors size={14} /> Cut Plans
                                            </h4>
                                            <div className="space-y-4">
                                                {group.bins.map((bin, i) => (
                                                    <div key={bin.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800/50 print:break-inside-avoid">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                Board #{i + 1} <span className="text-slate-400 font-normal mx-1">|</span> {bin.stockLength}m
                                                            </div>
                                                            <div className="text-xs text-slate-400">
                                                                Waste: {bin.waste.toFixed(3)}m
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Visual Bar */}
                                                        <div className="flex w-full h-8 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden mb-3 border border-slate-200 dark:border-slate-600">
                                                            {bin.cuts.map((cut, cIdx) => {
                                                                const widthPct = (cut.length / bin.stockLength) * 100;
                                                                return (
                                                                    <div 
                                                                        key={cIdx} 
                                                                        className="h-full bg-blue-500 dark:bg-blue-600 border-r border-white/20 relative group first:rounded-l"
                                                                        style={{ width: `${widthPct}%` }}
                                                                        title={`${cut.length}m - ${cut.description}`}
                                                                    >
                                                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 overflow-hidden whitespace-nowrap">
                                                                            {cut.length}m
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            <div className="flex-1 bg-red-100/50 dark:bg-red-900/20 h-full relative" title={`Waste: ${bin.waste.toFixed(3)}m`}>
                                                                 <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-400 font-mono">
                                                                     ///
                                                                 </div>
                                                            </div>
                                                        </div>

                                                        {/* Text Cut List */}
                                                        <div className="flex flex-wrap gap-2">
                                                            {bin.cuts.map((cut, cIdx) => (
                                                                <div key={cIdx} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300 flex items-center gap-2 border border-slate-200 dark:border-slate-600">
                                                                    <span className="font-bold">{cut.length}m</span>
                                                                    <span className="text-slate-400">|</span>
                                                                    <span className="truncate max-w-[150px]">{cut.section} - {cut.description}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};