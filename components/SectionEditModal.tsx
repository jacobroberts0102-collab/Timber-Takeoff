import React, { useState } from 'react';
import { Layers, Check, X, Lock, Unlock } from 'lucide-react';

interface SectionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionName: string;
  onSave: (updates: { newName?: string; unit?: 'L/M' | 'EA' | 'm2'; locked?: boolean }) => void;
  currentUnitMode: 'mixed' | 'L/M' | 'EA' | 'm2';
  isLocked: boolean;
}

export const SectionEditModal: React.FC<SectionEditModalProps> = ({ 
  isOpen, onClose, sectionName, onSave, currentUnitMode, isLocked 
}) => {
  const [name, setName] = useState(sectionName);
  const [unit, setUnit] = useState<'mixed' | 'L/M' | 'EA' | 'm2'>(currentUnitMode);
  const [locked, setLocked] = useState(isLocked);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
        setName(sectionName);
        setUnit(currentUnitMode);
        setLocked(isLocked);
    }
  }

  const handleSave = () => {
      onSave({
          newName: name !== sectionName ? name : undefined,
          unit: unit !== 'mixed' && unit !== currentUnitMode ? unit : undefined,
          locked: locked !== isLocked ? locked : undefined
      });
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Layers className="text-blue-500" size={20} />
                    Edit Section
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 space-y-4">
                
                {/* Rename */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Section Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                {/* Bulk Unit */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Force Unit (All Items)</label>
                    <select 
                        value={unit}
                        onChange={e => setUnit(e.target.value as any)}
                        className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="mixed">Keep Current (Mixed)</option>
                        <option value="L/M">Linear Metres (L/M)</option>
                        <option value="EA">Each (EA)</option>
                        <option value="m2">Area (m2)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">This will update all items in this section.</p>
                </div>

                {/* Lock Status */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`p-2 rounded-lg transition-colors ${locked ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>
                            {locked ? <Lock size={20} /> : <Unlock size={20} />}
                        </div>
                        <div>
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Lock Section</span>
                            <span className="block text-xs text-slate-500 group-hover:text-slate-600 dark:text-slate-400">Prevent further edits or bulk changes.</span>
                        </div>
                        <input 
                            type="checkbox" 
                            checked={locked} 
                            onChange={e => setLocked(e.target.checked)} 
                            className="hidden"
                        />
                    </label>
                </div>

            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                    <Check size={16} /> Save Changes
                </button>
            </div>
        </div>
    </div>
  );
};