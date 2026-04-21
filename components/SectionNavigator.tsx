import React, { useMemo } from 'react';
import { ParsedLine, ValidationResult } from '../types';
import { Layers, AlertCircle, Lock, Edit2, ChevronRight, CheckCircle, ShieldAlert, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { validateData } from '../services/validation';

interface SectionNavigatorProps {
  data: ParsedLine[];
  activeSection: string | null;
  onSelectSection: (section: string | null) => void;
  onEditSection: (sectionName: string) => void;
  className?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onBulkUpdate?: (rowIds: string[], updates: Partial<ParsedLine>) => void;
  validationResult?: ValidationResult;
}

interface SectionStats {
    name: string;
    count: number;
    lockedCount: number;
    issues: number;
    totalLM: number;
    totalEA: number;
    totalM2: number;
    rowIds: string[];
}

export const SectionNavigator: React.FC<SectionNavigatorProps> = ({ 
    data, activeSection, onSelectSection, onEditSection, className, isCollapsed, onToggleCollapse, validationResult 
}) => {
  
  const sections = useMemo(() => {
      const map = new Map<string, SectionStats>();
      const validation = validationResult || validateData(data);
      const errorMap = new Map<string, number>(); // rowId -> count
      
      validation.errors.forEach(e => {
          errorMap.set(e.rowId, (errorMap.get(e.rowId) || 0) + 1);
      });

      data.forEach(row => {
          const key = row.section || 'Unspecified';
          if (!map.has(key)) {
              map.set(key, { 
                  name: key, count: 0, lockedCount: 0, issues: 0, 
                  totalLM: 0, totalEA: 0, totalM2: 0, rowIds: [] 
              });
          }
          const stats = map.get(key)!;
          stats.count++;
          stats.rowIds.push(row.id);
          if (row.locked) stats.lockedCount++;
          if (errorMap.has(row.id)) stats.issues++;
          
          if (row.unit === 'L/M') stats.totalLM += row.total;
          else if (row.unit === 'EA') stats.totalEA += row.qty; // Use qty for EA count
          else if (row.unit === 'm2') stats.totalM2 += row.total;
      });

      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, validationResult]);

  return (
    <div className={`flex flex-col bg-slate-50 dark:bg-slate-900/30 ${className}`}>
        <div className={`p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between'}`}>
            {!isCollapsed && (
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={14} /> Sections ({sections.length})
                </h3>
            )}
            <button 
                onClick={onToggleCollapse} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {sections.map(section => {
                const isActive = activeSection === section.name;
                const isFullyLocked = section.count > 0 && section.lockedCount === section.count;
                
                return (
                    <div 
                        key={section.name}
                        onClick={() => onSelectSection(isActive ? null : section.name)}
                        className={`group relative border-b border-slate-100 dark:border-slate-800 transition-colors cursor-pointer select-none ${
                            isActive 
                            ? 'bg-blue-50 dark:bg-blue-900/20' 
                            : 'hover:bg-white dark:hover:bg-slate-800'
                        }`}
                        title={isCollapsed ? `${section.name} • ${section.count} Items${section.issues > 0 ? ` • ${section.issues} Issues` : ''}` : undefined}
                    >
                        {/* Active Indicator Strip */}
                        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}

                        {isCollapsed ? (
                            <div className="py-3 flex justify-center items-center h-full">
                                {section.issues > 0 ? (
                                    <div className="relative">
                                        <AlertCircle size={18} className="text-amber-500" />
                                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                        </span>
                                    </div>
                                ) : isFullyLocked ? (
                                    <Lock size={18} className="text-slate-400" />
                                ) : (
                                    <div className={`w-2 h-2 rounded-full transition-all ${isActive ? 'bg-blue-500 scale-125' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400'}`}></div>
                                )}
                            </div>
                        ) : (
                            <div className="p-3 pl-4 flex items-start gap-3">
                                <div className="mt-0.5">
                                    {section.issues > 0 ? (
                                        <AlertCircle size={16} className="text-amber-500" />
                                    ) : isFullyLocked ? (
                                        <Lock size={16} className="text-slate-400" />
                                    ) : (
                                        <CheckCircle size={16} className="text-emerald-500/50" />
                                    )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-sm font-bold truncate ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {section.name}
                                        </span>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditSection(section.name);
                                            }}
                                            className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-all ${isFullyLocked ? 'text-slate-300' : ''}`}
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        <span>{section.count} Items</span>
                                        {section.totalLM > 0 && <span className="text-slate-600 dark:text-slate-300">{section.totalLM.toFixed(1)}m</span>}
                                        {section.totalEA > 0 && <span>{section.totalEA}ea</span>}
                                        {section.totalM2 > 0 && <span>{section.totalM2.toFixed(1)}m²</span>}
                                    </div>

                                    {section.issues > 0 && (
                                        <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold">
                                            <ShieldAlert size={10} /> {section.issues} Issues
                                        </div>
                                    )}
                                </div>
                                
                                <ChevronRight 
                                    size={14} 
                                    className={`text-slate-300 self-center transition-transform duration-200 ${isActive ? 'rotate-90 text-blue-400' : ''}`} 
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
};