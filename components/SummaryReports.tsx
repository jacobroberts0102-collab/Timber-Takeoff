import React, { useMemo } from 'react';
import { ParsedLine } from '../types';
import { Layers, Ruler, Tag, FileText, Printer } from 'lucide-react';

interface SummaryReportsProps {
  data: ParsedLine[];
  jobNotes: string;
}

const aggregate = (data: ParsedLine[], keyFn: (row: ParsedLine) => string) => {
  const map = new Map<string, { count: number, lm: number, m2: number, items: number }>();
  
  data.forEach(row => {
    const key = keyFn(row) || 'Unspecified';
    if (!map.has(key)) {
      map.set(key, { count: 0, lm: 0, m2: 0, items: 0 });
    }
    const entry = map.get(key)!;
    entry.items += 1;
    
    if (row.unit === 'EA') {
      entry.count += row.qty;
    } else if (row.unit === 'L/M') {
      entry.lm += row.total;
    } else if (row.unit === 'm2') {
      entry.m2 += row.total;
    }
  });

  return Array.from(map.entries())
    .map(([key, stats]) => ({ key, ...stats }))
    .sort((a, b) => a.key.localeCompare(b.key));
};

const TableBlock = ({ title, icon, rows }: { title: string, icon: React.ReactNode, rows: any[] }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col h-full print:shadow-none print:border-slate-200 print:break-inside-avoid">
    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-300 dark:border-slate-700 flex items-center gap-2 print:bg-white print:border-b-2">
      {icon}
      <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-sm print:text-black">{title}</h3>
    </div>
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 print:bg-white print:text-black">
          <tr>
            <th className="px-4 py-2 whitespace-normal break-words">Name</th>
            <th className="px-4 py-2 text-right whitespace-nowrap">Items</th>
            <th className="px-4 py-2 text-right whitespace-nowrap">Count (EA)</th>
            <th className="px-4 py-2 text-right whitespace-nowrap">Linear (m)</th>
            <th className="px-4 py-2 text-right whitespace-nowrap">Area (m²)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 print:divide-slate-200">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
              <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200 print:text-black whitespace-normal break-words">{row.key}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400 print:text-black whitespace-nowrap">{row.items}</td>
              <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-400 print:text-black whitespace-nowrap">{row.count > 0 ? row.count : '-'}</td>
              <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-400 print:text-black whitespace-nowrap">{row.lm > 0 ? row.lm.toFixed(1) : '-'}</td>
              <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-400 print:text-black whitespace-nowrap">{row.m2 > 0 ? row.m2.toFixed(1) : '-'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
              <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-400 italic">No data available</td>
              </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const SummaryReports: React.FC<SummaryReportsProps> = ({ data, jobNotes }) => {
  
  const bySection = useMemo(() => aggregate(data, r => r.section), [data]);
  const byDimension = useMemo(() => aggregate(data, r => r.dimensions), [data]);
  const byGrade = useMemo(() => aggregate(data, r => r.grade), [data]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in p-1 print:p-0">
      {/* Job Notes Print Block */}
      {jobNotes && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 shadow-sm print:bg-white print:border print:border-slate-300 print:shadow-none print:break-inside-avoid">
            <h4 className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold mb-3 print:text-black">
                <FileText size={18} /> Job Notes
            </h4>
            <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed font-sans print:text-black">
                {jobNotes}
            </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
        <TableBlock 
          title="Summary by Section" 
          icon={<Layers size={18} className="text-blue-500 print:text-black" />} 
          rows={bySection} 
        />
        <div className="flex flex-col gap-6 print:block print:space-y-6">
            <TableBlock 
            title="Summary by Dimension" 
            icon={<Ruler size={18} className="text-emerald-500 print:text-black" />} 
            rows={byDimension} 
            />
            <TableBlock 
            title="Summary by Grade" 
            icon={<Tag size={18} className="text-violet-500 print:text-black" />} 
            rows={byGrade} 
            />
        </div>
      </div>
      
      <div className="flex justify-center mt-8 mb-8 print:hidden">
        <button 
            type="button"
            onClick={handlePrint}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
        >
            <Printer size={20} />
            Print Order Pack
        </button>
      </div>
    </div>
  );
};