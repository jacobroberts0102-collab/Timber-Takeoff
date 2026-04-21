import React from 'react';
import { Keyboard } from 'lucide-react';

export const ShortcutsHelp: React.FC = () => {
  const shortcuts = [
    { keys: ['J', '↓'], desc: 'Next Row' },
    { keys: ['K', '↑'], desc: 'Previous Row' },
    { keys: ['Enter'], desc: 'Confirm / Next' },
    { keys: ['Ctrl', 'S'], desc: 'Export CSV' },
  ];

  return (
    <div className="hidden xl:block fixed bottom-4 right-4 z-40">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-4 opacity-75 hover:opacity-100 transition-opacity">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Keyboard size={14} /> Shortcuts
        </h4>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-600 dark:text-slate-300">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};