import React, { useState } from 'react';
import { ExportTemplate, ExportColumn, ExportValidation } from '../types';
import { templateService } from '../services/excelService';
import { Plus, Trash2, Save, MoveUp, MoveDown, ArrowLeft, LayoutTemplate, Columns, Edit2, ShieldAlert, Star } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface TemplateManagerProps {
  onClose: () => void;
}

const FIELD_OPTIONS: { label: string; value: ExportColumn['field'] }[] = [
    { label: 'Section', value: 'section' },
    { label: 'Sub Section', value: 'subSection' },
    { label: 'Item Description', value: 'item' },
    { label: 'Dimensions', value: 'dimensions' },
    { label: 'Grade', value: 'grade' },
    { label: 'Quantity', value: 'qty' },
    { label: 'Length', value: 'length' },
    { label: 'Unit (L/M, EA)', value: 'unit' },
    { label: 'Total', value: 'total' },
    { label: 'Price / Unit', value: 'price' },
    { label: 'Total Price ($)', value: 'totalPrice' },
    { label: 'Job Notes', value: 'parsingNotes' }, 
    { label: 'Original Line', value: 'originalLine' },
    { label: '--- Job Metadata ---', value: 'empty' },
    { label: 'Builder Name', value: 'meta_builder' },
    { label: 'Site Address', value: 'meta_site' },
    { label: 'Job Number', value: 'meta_job' },
    { label: 'Takeoff Date', value: 'meta_date' },
    { label: '-------------------', value: 'empty' },
    { label: 'Custom Text (Fixed)', value: 'custom_text' },
    { label: 'Empty Column', value: 'empty' },
];

const TRANSFORM_OPTIONS = [
    { label: 'None', value: 'none' },
    { label: 'Uppercase', value: 'uppercase' },
    { label: 'Lowercase', value: 'lowercase' },
    { label: 'Number (0 decimals)', value: 'number_0' },
    { label: 'Number (2 decimals)', value: 'number_2' },
    { label: 'Trim Whitespace', value: 'trim' },
];

export const TemplateManager: React.FC<TemplateManagerProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<ExportTemplate[]>(() => templateService.getTemplates());
  const [activeTemplate, setActiveTemplate] = useState<ExportTemplate | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedColId, setExpandedColId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExportTemplate | null>(null);

  const handleSelectTemplate = (t: ExportTemplate) => {
      // Deep copy to avoid mutating state directly
      setActiveTemplate(JSON.parse(JSON.stringify(t)));
      setIsDirty(false);
      setExpandedColId(null);
  };

  const handleCreateNew = () => {
      const newTemplate: ExportTemplate = {
          id: crypto.randomUUID(),
          name: 'New Custom Template',
          isDefault: false,
          columns: [
              { id: crypto.randomUUID(), header: 'Description', field: 'item', transform: 'none' },
              { id: crypto.randomUUID(), header: 'Qty', field: 'qty', transform: 'number_0' },
          ]
      };
      setActiveTemplate(newTemplate);
      setIsDirty(true);
      setExpandedColId(null);
  };

  const handleDelete = (t: ExportTemplate) => {
      setDeleteTarget(t);
  };

  const confirmDelete = () => {
      if (!deleteTarget) return;
      templateService.deleteTemplate(deleteTarget.id);
      setTemplates(templateService.getTemplates());
      if (activeTemplate?.id === deleteTarget.id) setActiveTemplate(null);
      setDeleteTarget(null);
  };

  const handleSave = () => {
      if (activeTemplate) {
          templateService.saveTemplate(activeTemplate);
          setTemplates(templateService.getTemplates());
          setIsDirty(false);
      }
  };

  const toggleDefault = () => {
      if (!activeTemplate) return;
      setActiveTemplate({ ...activeTemplate, isDefault: !activeTemplate.isDefault });
      setIsDirty(true);
  };

  const updateColumn = (colId: string, field: keyof ExportColumn, value: any) => {
      if (!activeTemplate) return;
      const updatedCols = activeTemplate.columns.map(c => 
          c.id === colId ? { ...c, [field]: value } : c
      );
      setActiveTemplate({ ...activeTemplate, columns: updatedCols });
      setIsDirty(true);
  };

  const toggleValidation = (colId: string, type: ExportValidation['type'], enabled: boolean) => {
      if (!activeTemplate) return;
      
      const col = activeTemplate.columns.find(c => c.id === colId);
      if (!col) return;

      let currentValidations = col.validations || [];
      
      if (enabled) {
          if (!currentValidations.find(v => v.type === type)) {
              currentValidations = [...currentValidations, { type }];
          }
      } else {
          currentValidations = currentValidations.filter(v => v.type !== type);
      }

      updateColumn(colId, 'validations', currentValidations);
  };

  const updateValidationValue = (colId: string, type: ExportValidation['type'], value: number) => {
      if (!activeTemplate) return;
      const col = activeTemplate.columns.find(c => c.id === colId);
      if (!col) return;

      const currentValidations = (col.validations || []).map(v => 
          v.type === type ? { ...v, value } : v
      );
      updateColumn(colId, 'validations', currentValidations);
  };

  const addColumn = () => {
      if (!activeTemplate) return;
      const newCol: ExportColumn = {
          id: crypto.randomUUID(),
          header: 'New Column',
          field: 'empty',
          transform: 'none'
      };
      setActiveTemplate({ ...activeTemplate, columns: [...activeTemplate.columns, newCol] });
      setIsDirty(true);
  };

  const removeColumn = (colId: string) => {
      if (!activeTemplate) return;
      setActiveTemplate({ 
          ...activeTemplate, 
          columns: activeTemplate.columns.filter(c => c.id !== colId) 
      });
      setIsDirty(true);
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
      if (!activeTemplate) return;
      const newCols = [...activeTemplate.columns];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newCols.length) return;
      
      const temp = newCols[index];
      newCols[index] = newCols[targetIndex];
      newCols[targetIndex] = temp;
      
      setActiveTemplate({ ...activeTemplate, columns: newCols });
      setIsDirty(true);
  };

  return (
    <div className="flex h-full bg-white dark:bg-slate-900 overflow-hidden animate-fade-in">
        {/* Sidebar List */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-800/50">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <LayoutTemplate size={18} /> Templates
                </h3>
                <button onClick={handleCreateNew} className="p-1.5 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200">
                    <Plus size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {templates.map(t => (
                    <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group ${
                            activeTemplate?.id === t.id 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            {t.isDefault && <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
                            <span className="truncate font-medium">{t.name}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1" onClick={e => e.stopPropagation()}>
                            <Trash2 
                                size={14} 
                                className="hover:text-red-300 cursor-pointer" 
                                onClick={() => handleDelete(t)}
                            />
                        </div>
                    </button>
                ))}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={onClose} className="w-full py-2 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
            {activeTemplate ? (
                <>
                    {/* Toolbar */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                             <input 
                                type="text" 
                                value={activeTemplate.name}
                                onChange={(e) => {
                                    setActiveTemplate({ ...activeTemplate, name: e.target.value });
                                    setIsDirty(true);
                                }}
                                className="text-lg font-bold text-slate-800 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none flex-1"
                             />
                             <button 
                                onClick={toggleDefault}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                                    activeTemplate.isDefault 
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                    : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600 border border-transparent'
                                }`}
                             >
                                <Star size={14} className={activeTemplate.isDefault ? 'fill-amber-500' : ''} />
                                {activeTemplate.isDefault ? 'Default Template' : 'Set as Default'}
                             </button>
                        </div>
                        
                        <button 
                            onClick={handleSave}
                            disabled={!isDirty}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-2 ml-4"
                        >
                            <Save size={16} /> Save Changes
                        </button>
                    </div>

                    {/* Columns Editor */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <Columns size={16} /> Export Columns ({activeTemplate.columns.length})
                                </h4>
                                <button onClick={addColumn} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                                    <Plus size={14} /> Add Column
                                </button>
                            </div>
                            
                            <div className="space-y-3">
                                {activeTemplate.columns.map((col, index) => {
                                    const isExpanded = expandedColId === col.id;
                                    const required = col.validations?.some(v => v.type === 'required');
                                    const maxLength = col.validations?.find(v => v.type === 'max_length')?.value;
                                    const numericOnly = col.validations?.some(v => v.type === 'numeric_only');
                                    const noSpaces = col.validations?.some(v => v.type === 'no_spaces');

                                    return (
                                        <div key={col.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm group overflow-hidden">
                                            {/* Header Row */}
                                            <div className="p-3 flex flex-col md:flex-row items-start md:items-center gap-4">
                                                {/* Drag/Order Handles */}
                                                <div className="flex flex-col gap-1 items-center justify-center text-slate-400 pt-2 md:pt-0">
                                                    <button 
                                                        disabled={index === 0} 
                                                        onClick={() => moveColumn(index, -1)}
                                                        className="hover:text-blue-500 disabled:opacity-20"
                                                    >
                                                        <MoveUp size={14} />
                                                    </button>
                                                    <button 
                                                        disabled={index === activeTemplate.columns.length - 1} 
                                                        onClick={() => moveColumn(index, 1)}
                                                        className="hover:text-blue-500 disabled:opacity-20"
                                                    >
                                                        <MoveDown size={14} />
                                                    </button>
                                                </div>

                                                {/* Configuration */}
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-400">CSV Header</label>
                                                        <input 
                                                            type="text" 
                                                            value={col.header}
                                                            onChange={(e) => updateColumn(col.id, 'header', e.target.value)}
                                                            className="w-full text-sm font-medium border-b border-slate-200 dark:border-slate-700 bg-transparent focus:border-blue-500 outline-none pb-1 dark:text-slate-200"
                                                            placeholder="Header Name"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-400">Map to Field</label>
                                                        <select 
                                                            value={col.field}
                                                            onChange={(e) => updateColumn(col.id, 'field', e.target.value)}
                                                            className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 dark:text-slate-200 shadow-sm"
                                                        >
                                                            {FIELD_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {col.field === 'custom_text' ? (
                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold text-slate-400">Fixed Value</label>
                                                            <input 
                                                                type="text"
                                                                value={col.customValue || ''}
                                                                onChange={(e) => updateColumn(col.id, 'customValue', e.target.value)}
                                                                className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 dark:text-slate-200 shadow-sm"
                                                                placeholder="Static text..."
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold text-slate-400">Transform</label>
                                                            <select 
                                                                value={col.transform}
                                                                onChange={(e) => updateColumn(col.id, 'transform', e.target.value)}
                                                                className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 dark:text-slate-200 shadow-sm"
                                                            >
                                                                {TRANSFORM_OPTIONS.map(opt => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-2 items-center pt-4 md:pt-0">
                                                    <button
                                                        onClick={() => setExpandedColId(isExpanded ? null : col.id)}
                                                        className={`p-1.5 rounded transition-colors ${isExpanded || col.validations?.length ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                                        title="Validation Rules"
                                                    >
                                                        <ShieldAlert size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => removeColumn(col.id)}
                                                        className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Validation Panel */}
                                            {isExpanded && (
                                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-150">
                                                    <div className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                                        <ShieldAlert size={12} /> Data Validation
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={required} 
                                                                onChange={e => toggleValidation(col.id, 'required', e.target.checked)}
                                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">Required</span>
                                                        </label>

                                                        <div className="flex items-center gap-2">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={!!maxLength} 
                                                                    onChange={e => toggleValidation(col.id, 'max_length', e.target.checked)}
                                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">Max Len</span>
                                                            </label>
                                                            {!!maxLength && (
                                                                <input 
                                                                    type="number" 
                                                                    value={maxLength} 
                                                                    onChange={e => updateValidationValue(col.id, 'max_length', parseInt(e.target.value))}
                                                                    className="w-16 p-1 text-xs border rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                                                />
                                                            )}
                                                        </div>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={numericOnly} 
                                                                onChange={e => toggleValidation(col.id, 'numeric_only', e.target.checked)}
                                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">Numeric Only</span>
                                                        </label>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={noSpaces} 
                                                                onChange={e => toggleValidation(col.id, 'no_spaces', e.target.checked)}
                                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">No Spaces</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <Edit2 size={48} className="mb-4 opacity-20" />
                    <p>Select a template to edit or create a new one.</p>
                </div>
            )}
        </div>

        <ConfirmDialog 
            isOpen={!!deleteTarget}
            title="Delete Export Template"
            message={`Are you sure you want to delete the template "${deleteTarget?.name}"? This action cannot be undone.`}
            confirmLabel="Delete Template"
            isDestructive={true}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
        />
    </div>
  );
};
