import React, { useState, useMemo } from 'react';
import { ExportTemplate, ParsedLine, HistoryItem, ExportColumn } from '../types';
import { templateService, applyTemplate, exportToCsv, exportToJson, exportToXml, validateExportData } from '../services/excelService';
import { FileDown, Settings, Eye, X, TableProperties, AlertTriangle, ListFilter, CheckSquare, Square, Star, FileJson, FileCode, Box, Layers, Trash2, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ParsedLine[];
  filename?: string;
  onManageTemplates: () => void;
  metadata?: any;
  history?: HistoryItem[];
  jobNotes?: string;
}

// Map internal field names to friendly screen labels used in PreviewTable.tsx
const FIELD_LABEL_MAP: Record<string, string> = {
  section: 'Section',
  subSection: 'Sub Section',
  spruceItemNo: 'SPRUCE Item No.',
  spruceDescription: 'SPRUCE Description',
  item: 'Item Name',
  description: 'Description',
  dimensions: 'Dims',
  grade: 'Grade',
  qty: 'Qty',
  length: 'Len (m)',
  unit: 'Unit',
  total: 'Total',
  price: 'Price / Unit',
  totalPrice: 'Total Price ($)',
  // Metadata fields
  meta_builder: 'Builder',
  meta_site: 'Site Address',
  meta_job: 'Job No',
  meta_date: 'Date'
};

export const ExportModal: React.FC<ExportModalProps> = ({ 
    isOpen, onClose, data, filename, onManageTemplates, metadata 
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'mapper'>('preview');
  const [templates, setTemplates] = useState<ExportTemplate[]>(() => templateService.getTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
      const available = templateService.getTemplates();
      const def = available.find(t => t.isDefault) || available[0];
      return def ? def.id : 'generic';
  });
  const [enabledColumnIds, setEnabledColumnIds] = useState<Set<string>>(() => {
      const available = templateService.getTemplates();
      const def = available.find(t => t.isDefault) || available[0];
      return new Set(def?.columns.map(c => c.id) || []);
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
        setTemplates(templateService.getTemplates());
        setValidationErrors([]);
    }
  }

  const handleSelectTemplate = (templateId: string) => {
      setSelectedTemplateId(templateId);
      const t = templates.find(temp => temp.id === templateId);
      if (t) {
          setEnabledColumnIds(new Set(t.columns.map(c => c.id)));
          setValidationErrors([]);
      }
  };

  const selectedTemplate = useMemo(() => 
      templates.find(t => t.id === selectedTemplateId) || templates[0]
  , [templates, selectedTemplateId]);

  // This is the template filtered by user selections
  const effectiveTemplate = useMemo(() => {
      if (!selectedTemplate) return null;
      return {
          ...selectedTemplate,
          columns: selectedTemplate.columns.filter(c => enabledColumnIds.has(c.id))
      };
  }, [selectedTemplate, enabledColumnIds]);

  const previewData = useMemo(() => {
      if (!effectiveTemplate) return [];
      // Show all data in preview
      return applyTemplate(data, effectiveTemplate, metadata);
  }, [data, effectiveTemplate, metadata]);

  const toggleColumn = (id: string) => {
      const next = new Set(enabledColumnIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setEnabledColumnIds(next);
  };

  const toggleAllColumns = () => {
      if (!selectedTemplate) return;
      if (enabledColumnIds.size === selectedTemplate.columns.length) {
          setEnabledColumnIds(new Set());
      } else {
          setEnabledColumnIds(new Set(selectedTemplate.columns.map(c => c.id)));
      }
  };

  const validate = () => {
      if (!effectiveTemplate) return false;
      const errors = validateExportData(data, effectiveTemplate, metadata);
      if (errors.length > 0) {
          setValidationErrors(errors);
          return false;
      }
      return true;
  };

  const handleExport = (format: 'csv' | 'json' | 'xml' | 'dxf' | 'ifc' = 'csv') => {
      if (effectiveTemplate && validate()) {
          if (format === 'csv') exportToCsv(data, filename, effectiveTemplate, metadata);
          else if (format === 'json') exportToJson(data, filename, effectiveTemplate, metadata);
          else if (format === 'xml') exportToXml(data, filename, effectiveTemplate, metadata);
          else if (format === 'dxf') {
              // Simulated DXF Export
              console.log("Exporting to DXF...");
              useStore.getState().showToast("DXF Export generated (simulated).", "info");
          }
          else if (format === 'ifc') {
              // Simulated IFC Export
              console.log("Exporting to IFC...");
              useStore.getState().showToast("IFC Export generated (simulated).", "info");
          }
          onClose();
      }
  };

  const handleForceExport = (format: 'csv' | 'json' | 'xml' = 'csv') => {
      if (effectiveTemplate) {
          if (format === 'csv') exportToCsv(data, filename, effectiveTemplate, metadata);
          else if (format === 'json') exportToJson(data, filename, effectiveTemplate, metadata);
          else if (format === 'xml') exportToXml(data, filename, effectiveTemplate, metadata);
          onClose();
      }
  };

  // Helper to get friendly label for a column based on its mapping field
  const getColumnLabel = (col: ExportColumn) => {
      const label = FIELD_LABEL_MAP[col.field as string];
      if (label) return label;
      if (col.field === 'custom_text') return `Fixed: ${col.customValue || 'Text'}`;
      return col.header;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-[95vw] overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl shadow-sm">
                        <FileDown size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Export Takeoff</h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Select ERP format and customize columns</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all">
                    <X size={24} />
                </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Sidebar: Selection */}
                <div className="w-full md:w-72 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-6 overflow-y-auto">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">ERP Template</label>
                        <div className="space-y-2">
                            {templates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => { handleSelectTemplate(t.id); }}
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group ${
                                        selectedTemplateId === t.id 
                                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-300 shadow-sm' 
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {t.isDefault ? (
                                            <Star size={18} className="text-amber-500 fill-amber-500 shrink-0" />
                                        ) : (
                                            <TableProperties size={18} className={selectedTemplateId === t.id ? 'text-blue-500' : 'text-slate-400'} />
                                        )}
                                        <span className="font-medium truncate">{t.name}</span>
                                    </div>
                                    {t.id === 'spruce_erp' || t.id === 'generic' ? <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded shrink-0">SYS</span> : null}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={onManageTemplates}
                            className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            <Settings size={16} /> Manage Templates
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
                    
                    {/* Column Customizer Toolbar */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setActiveTab('preview')}
                                    className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${activeTab === 'preview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    <Eye size={14} /> Preview
                                </button>
                                <button 
                                    onClick={() => setActiveTab('mapper')}
                                    className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${activeTab === 'mapper' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    <Settings size={14} /> Mapper
                                </button>
                            </div>
                            {activeTab === 'preview' && (
                                <button 
                                    onClick={toggleAllColumns}
                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {enabledColumnIds.size === selectedTemplate?.columns.length ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>
                        
                        {activeTab === 'preview' && (
                            <div className="flex flex-wrap gap-2">
                                {selectedTemplate?.columns.map(col => (
                                    <button
                                        key={col.id}
                                        onClick={() => toggleColumn(col.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-2 ${
                                            enabledColumnIds.has(col.id)
                                            ? 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/10'
                                            : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-400 opacity-60 grayscale'
                                        }`}
                                    >
                                        {enabledColumnIds.has(col.id) ? <CheckSquare size={14} className="text-blue-500" /> : <Square size={14} />}
                                        {getColumnLabel(col)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Content View Area */}
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        {activeTab === 'mapper' ? (
                            <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950">
                                <div className="max-w-4xl mx-auto space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Column Mapping Engine</h4>
                                        <button 
                                            onClick={() => {
                                                if (selectedTemplate) {
                                                    const newCol: ExportColumn = { id: crypto.randomUUID(), header: 'New Column', field: 'custom_text', customValue: '' };
                                                    const updated = { ...selectedTemplate, columns: [...selectedTemplate.columns, newCol] };
                                                    templateService.saveTemplate(updated);
                                                    setTemplates(templateService.getTemplates());
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2"
                                        >
                                            <Plus size={14} /> Add Column
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {selectedTemplate?.columns.map((col, idx) => (
                                            <div key={col.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 animate-in slide-in-from-left-2 duration-200" style={{ animationDelay: `${idx * 50}ms` }}>
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CSV Header</label>
                                                    <input 
                                                        type="text" 
                                                        value={col.header} 
                                                        onChange={(e) => {
                                                            const updated = { ...selectedTemplate, columns: selectedTemplate.columns.map(c => c.id === col.id ? { ...c, header: e.target.value } : c) };
                                                            templateService.saveTemplate(updated);
                                                            setTemplates(templateService.getTemplates());
                                                        }}
                                                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Source Field</label>
                                                    <select 
                                                        value={col.field} 
                                                        onChange={(e) => {
                                                            const updated = { ...selectedTemplate, columns: selectedTemplate.columns.map(c => c.id === col.id ? { ...c, field: e.target.value } : c) };
                                                            templateService.saveTemplate(updated);
                                                            setTemplates(templateService.getTemplates());
                                                        }}
                                                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200"
                                                    >
                                                        <optgroup label="Takeoff Data">
                                                            {Object.entries(FIELD_LABEL_MAP).filter(([k]) => !k.startsWith('meta_')).map(([k, v]) => (
                                                                <option key={k} value={k}>{v}</option>
                                                            ))}
                                                        </optgroup>
                                                        <optgroup label="Metadata">
                                                            {Object.entries(FIELD_LABEL_MAP).filter(([k]) => k.startsWith('meta_')).map(([k, v]) => (
                                                                <option key={k} value={k}>{v}</option>
                                                            ))}
                                                        </optgroup>
                                                        <option value="custom_text">Fixed Text / Constant</option>
                                                    </select>
                                                </div>
                                                {col.field === 'custom_text' && (
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fixed Value</label>
                                                        <input 
                                                            type="text" 
                                                            value={col.customValue || ''} 
                                                            onChange={(e) => {
                                                                const updated = { ...selectedTemplate, columns: selectedTemplate.columns.map(c => c.id === col.id ? { ...c, customValue: e.target.value } : c) };
                                                                templateService.saveTemplate(updated);
                                                                setTemplates(templateService.getTemplates());
                                                            }}
                                                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-200"
                                                            placeholder="Enter text..."
                                                        />
                                                    </div>
                                                )}
                                                <div className="w-32">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Preview (Row 1)</label>
                                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-mono text-slate-500 truncate border border-dashed border-slate-300 dark:border-slate-700">
                                                        {col.field === 'custom_text' ? col.customValue : (data[0] ? (data[0][col.field as keyof ParsedLine] || '-') : '-')}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        const updated = { ...selectedTemplate, columns: selectedTemplate.columns.filter(c => c.id !== col.id) };
                                                        templateService.saveTemplate(updated);
                                                        setTemplates(templateService.getTemplates());
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mt-4"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : validationErrors.length > 0 ? (
                            <div className="flex-1 flex flex-col min-h-0 bg-red-50 dark:bg-red-900/10 overflow-hidden">
                                <div className="p-4 bg-red-100 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 flex items-center gap-3 text-red-700 dark:text-red-300">
                                    <AlertTriangle size={24} />
                                    <div>
                                        <h3 className="font-bold">Validation Failed</h3>
                                        <p className="text-sm opacity-90">The data does not match the requirements for the selected template.</p>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-6">
                                    <ul className="space-y-2 list-disc list-inside text-sm text-red-800 dark:text-red-200">
                                        {validationErrors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            // Preview View
                            <div className="flex-1 overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <Eye size={16} /> CSV Data Preview ({effectiveTemplate?.columns.length || 0} columns)
                                    </h3>
                                    <div className="text-xs text-slate-400">
                                        Previewing all {data.length} rows
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
                                    {effectiveTemplate && effectiveTemplate.columns.length > 0 ? (
                                        <table className="w-full text-sm text-left border-collapse table-fixed min-w-full">
                                            <thead className="bg-white dark:bg-slate-900 text-xs uppercase text-slate-500 font-semibold sticky top-0 z-10">
                                                <tr>
                                                    {effectiveTemplate.columns.map(col => (
                                                        <th key={col.id} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 whitespace-pre-wrap break-words bg-white dark:bg-slate-900 min-w-[120px]">
                                                            {getColumnLabel(col)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {previewData.map((row, i) => (
                                                    <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                                        {effectiveTemplate.columns.map(col => (
                                                            <td key={col.id} className="px-4 py-3 text-slate-700 dark:text-slate-300 align-top">
                                                                <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                                                                    {row[col.header]}
                                                                </div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 italic p-12">
                                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center mb-4">
                                                <ListFilter size={24} className="opacity-50" />
                                            </div>
                                            Please select at least one column to export.
                                        </div>
                                    )}
                                    {data.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 italic">No data to preview</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            Cancel
                        </button>
                        
                        {validationErrors.length > 0 ? (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleForceExport('csv')}
                                    className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-xl font-bold transition-colors text-sm"
                                >
                                    Force CSV
                                </button>
                                <button 
                                    onClick={() => handleForceExport('json')}
                                    className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-xl font-bold transition-colors text-sm"
                                >
                                    Force JSON
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 justify-end">
                                <button 
                                    onClick={() => handleExport('json')}
                                    disabled={!effectiveTemplate || effectiveTemplate.columns.length === 0}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <FileJson size={18} /> JSON
                                </button>
                                <button 
                                    onClick={() => handleExport('xml')}
                                    disabled={!effectiveTemplate || effectiveTemplate.columns.length === 0}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <FileCode size={18} /> XML
                                </button>
                                <button 
                                    onClick={() => handleExport('dxf')}
                                    disabled={!effectiveTemplate || effectiveTemplate.columns.length === 0}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                    title="Export to CAD (DXF)"
                                >
                                    <Box size={18} /> DXF
                                </button>
                                <button 
                                    onClick={() => handleExport('ifc')}
                                    disabled={!effectiveTemplate || effectiveTemplate.columns.length === 0}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                    title="Export to BIM (IFC)"
                                >
                                    <Layers size={18} /> IFC
                                </button>
                                <button 
                                    onClick={() => handleExport('csv')}
                                    disabled={!effectiveTemplate || effectiveTemplate.columns.length === 0}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <FileDown size={18} /> Download CSV
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
