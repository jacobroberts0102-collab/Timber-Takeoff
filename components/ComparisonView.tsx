import React, { useMemo } from 'react';
import { HistoryItem } from '../types';
import { ArrowRight, FileDiff, XCircle, Building2, MapPin, Hash } from 'lucide-react';
import { calculateDiff, generateDiffCsv } from '../services/comparison';

interface ComparisonViewProps {
  itemA: HistoryItem;
  itemB: HistoryItem;
  onClose: () => void;
}

const ComparisonField = ({ icon: Icon, label, valA, valB }: { icon: any, label: string, valA?: string, valB?: string }) => {
    if (!valA && !valB) return null;
    const isDiff = valA !== valB;
    return (
        <div className={`p-3 rounded-lg border text-xs ${isDiff ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
            <div className="flex items-center gap-2 mb-1 opacity-70">
                <Icon size={12} /> <span className="uppercase font-bold">{label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className={`break-words ${isDiff ? 'text-red-600 line-through opacity-70' : 'text-slate-700 dark:text-slate-300'}`}>
                    {valA || '-'}
                </div>
                <div className={`break-words font-bold ${isDiff ? 'text-green-600' : 'text-slate-700 dark:text-slate-300'}`}>
                    {valB || '-'}
                </div>
            </div>
        </div>
    );
};

export const ComparisonView: React.FC<ComparisonViewProps> = ({ itemA, itemB, onClose }) => {
  
  const diffData = useMemo(() => {
    return calculateDiff(itemA.data, itemB.data);
  }, [itemA, itemB]);

  const handleExportDelta = () => {
    const csvContent = generateDiffCsv(diffData, itemA.fileName, itemB.fileName);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Delta_Report_${itemA.fileName}_vs_${itemB.fileName}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-fade-in">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 p-4 flex flex-col gap-4 shadow-sm sticky top-0 z-10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XCircle size={24} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <FileDiff size={20} className="text-blue-500" />
                            Version Comparison
                        </h2>
                    </div>
                </div>
                <button 
                    onClick={handleExportDelta}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm"
                >
                    Export Delta Report
                </button>
            </div>

            {/* Header Comparison (Anchors) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ComparisonField icon={Building2} label="Builder" valA={itemA.metadata?.builder} valB={itemB.metadata?.builder} />
                <ComparisonField icon={MapPin} label="Site Address" valA={itemA.metadata?.address} valB={itemB.metadata?.address} />
                <ComparisonField icon={Hash} label="Job Number" valA={itemA.metadata?.jobNumber} valB={itemB.metadata?.jobNumber} />
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">{itemA.fileName}</span>
                <ArrowRight size={12} />
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">{itemB.fileName}</span>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-300 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-300 dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Section</th>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3 text-right text-red-600 dark:text-red-400">Old Qty</th>
                            <th className="px-4 py-3 text-right text-green-600 dark:text-green-400">New Qty</th>
                            <th className="px-4 py-3 text-right">Diff</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {diffData.map((row) => (
                            <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        row.status === 'added' ? 'bg-green-100 text-green-700' :
                                        row.status === 'removed' ? 'bg-red-100 text-red-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.section}</td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-slate-800 dark:text-slate-200">{row.item}</div>
                                    <div className="text-xs text-slate-500">{row.desc}</div>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-500 font-mono bg-red-50/50 dark:bg-red-900/10">{row.qtyA || '-'}</td>
                                <td className="px-4 py-3 text-right text-slate-800 dark:text-slate-200 font-bold font-mono bg-green-50/50 dark:bg-green-900/10">{row.qtyB || '-'}</td>
                                <td className={`px-4 py-3 text-right font-bold font-mono ${row.diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {row.diff > 0 ? '+' : ''}{row.diff}
                                </td>
                            </tr>
                        ))}
                        {diffData.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                    No differences found. The files are identical in terms of quantities.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};