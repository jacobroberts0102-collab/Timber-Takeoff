import React, { useState } from 'react';
import { CheckCircle2, Circle, Search, ChevronRight, Package, Ruler } from 'lucide-react';
import { ParsedLine, FileMetadata } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SiteModeProps {
  data: ParsedLine[];
  metadata: FileMetadata | null;
  onClose: () => void;
}

export const SiteMode: React.FC<SiteModeProps> = ({ data, metadata, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sections = Array.from(new Set(data.map(item => item.section || 'Uncategorized')));
  
  const filteredData = data.filter(item => 
    item.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.dimensions.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCheck = (id: string) => {
    const next = new Set(checkedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedIds(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 safe-top">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Site Mode</h1>
            <p className="text-xs text-slate-500">{metadata?.name || 'Current Job'}</p>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-medium"
          >
            Exit
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-base focus:ring-2 focus:ring-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between text-sm font-medium">
        <span>{checkedIds.size} of {data.length} items checked</span>
        <div className="flex items-center gap-1">
          <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-500" 
              style={{ width: `${(checkedIds.size / data.length) * 100}%` }}
            />
          </div>
          <span className="ml-2">{Math.round((checkedIds.size / data.length) * 100)}%</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {sections.map(section => {
          const sectionItems = filteredData.filter(item => (item.section || 'Uncategorized') === section);
          if (sectionItems.length === 0) return null;

          const isExpanded = activeSection === section;

          return (
            <div key={section} className="mb-2">
              <button 
                onClick={() => setActiveSection(isExpanded ? null : section)}
                className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                    <Package size={18} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-900 dark:text-white">{section}</h3>
                    <p className="text-xs text-slate-500">
                      {sectionItems.filter(i => checkedIds.has(i.id)).length} / {sectionItems.length} items
                    </p>
                  </div>
                </div>
                <ChevronRight 
                  size={20} 
                  className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50 dark:bg-slate-900/50"
                  >
                    {sectionItems.map(item => {
                      const isChecked = checkedIds.has(item.id);
                      return (
                        <div 
                          key={item.id}
                          onClick={() => toggleCheck(item.id)}
                          className={`flex items-start gap-4 px-4 py-4 border-b border-slate-100 dark:border-slate-800 transition-colors ${isChecked ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}
                        >
                          <div className={`mt-1 ${isChecked ? 'text-emerald-500' : 'text-slate-300'}`}>
                            {isChecked ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={`font-medium leading-tight ${isChecked ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                                {item.item}
                              </h4>
                              <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                                {item.qty} {item.unit}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              {item.dimensions && (
                                <span className="flex items-center gap-1">
                                  <Ruler size={12} /> {item.dimensions}
                                </span>
                              )}
                              {item.length && (
                                <span className="flex items-center gap-1">
                                  <ChevronRight size={12} /> {item.length}m
                                </span>
                              )}
                            </div>
                            {item.subSection && (
                              <div className="mt-2 inline-block px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                {item.subSection}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Quick Actions Float */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="flex gap-3">
          <button 
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            onClick={() => {
              const allIds = new Set(data.map(i => i.id));
              setCheckedIds(allIds);
            }}
          >
            Check All
          </button>
          <button 
            className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl active:scale-95 transition-all"
            onClick={() => setCheckedIds(new Set())}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
