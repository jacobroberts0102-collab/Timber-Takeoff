import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MemoryItem, CatalogProduct } from '../types';
import { storageService, getRelevanceSortedResults } from '../services/storage';
import { buildLookupKey, normalizeWhitespace } from '../utils/learnedKey';
import { Sparkles, Database, Search, Trash2, Plus, Upload, Download, X, AlertCircle, Edit2, Loader2, Save } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { CatalogDropdown } from './PreviewTable';
import { useStore } from '../store/useStore';
import Fuse from 'fuse.js';

export const MemoryManager: React.FC = () => {
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(true);
    const [newMapping, setNewMapping] = useState({ name: '', dims: '', code: '', desc: '', wildcard: false });
    
    // Edit State
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', dims: '', code: '', desc: '', wildcard: false });

    // Suggestion Dropdown State
    const [catalogLookup, setCatalogLookup] = useState<{ 
        field: 'code' | 'desc'; 
        targetRef: React.RefObject<HTMLInputElement | null>; 
        searchTerm: string; 
    } | null>(null);
    const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(-1);
    
    // Input Refs for positioning suggestions
    const newCodeRef = useRef<HTMLInputElement>(null);
    const newDescRef = useRef<HTMLInputElement>(null);
    const editCodeRef = useRef<HTMLInputElement>(null);
    const editDescRef = useRef<HTMLInputElement>(null);

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteTargetKey, setDeleteTargetKey] = useState<string | null>(null);

    useEffect(() => {
        loadMemory();
        storageService.getCatalog().then(setCatalog);
    }, []);

    const loadMemory = async () => {
        setLoading(true);
        try {
            const list = await storageService.getLearnedMappings();
            setMemories(list);
        } catch (e) {
            console.error("Failed to load memory list", e);
        } finally {
            setLoading(false);
        }
    };

    const filteredMemories = useMemo(() => {
        if (!searchTerm) return memories;
        const fuse = new Fuse(memories, {
            keys: ['lookupKey', 'displayName', 'itemNo', 'description'],
            threshold: 0.3
        });
        return fuse.search(searchTerm).map(r => r.item);
    }, [memories, searchTerm]);

    const lookupFilteredCatalog = useMemo(() => {
        return getRelevanceSortedResults(catalog, catalogLookup?.searchTerm || '');
    }, [catalog, catalogLookup?.searchTerm]);

    const handleSelectProduct = useCallback((product: CatalogProduct) => {
        const setTargetForm = editingKey ? setEditForm : setNewMapping;
        setTargetForm(prev => ({
            ...prev,
            code: product.itemNo,
            desc: product.description
        }));
        setCatalogLookup(null);
    }, [editingKey, setEditForm, setNewMapping]);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (!catalogLookup) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setDropdownSelectedIndex(prev => (prev < lookupFilteredCatalog.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setDropdownSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
            } else if (e.key === 'Enter') {
                if (dropdownSelectedIndex >= 0 && dropdownSelectedIndex < lookupFilteredCatalog.length) {
                    e.preventDefault();
                    handleSelectProduct(lookupFilteredCatalog[dropdownSelectedIndex]);
                }
            } else if (e.key === 'Escape') {
                setCatalogLookup(null);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [catalogLookup, lookupFilteredCatalog, dropdownSelectedIndex, handleSelectProduct]);

    const handleOpenLookup = (field: 'code' | 'desc', ref: React.RefObject<HTMLInputElement | null>, val: string) => {
        setCatalogLookup({ field, targetRef: ref, searchTerm: val });
        setDropdownSelectedIndex(-1);
    };

    const handleAdd = async () => {
        if (!newMapping.name || !newMapping.code) return;
        
        const dimensions = newMapping.wildcard ? "" : newMapping.dims;
        const memoryItem: MemoryItem = {
            lookupKey: buildLookupKey(newMapping.name, dimensions),
            displayName: normalizeWhitespace(newMapping.name),
            dimensions: normalizeWhitespace(dimensions),
            itemNo: newMapping.code,
            description: newMapping.desc
        };

        await storageService.saveLearnedMapping(memoryItem);
        await loadMemory();
        setIsAdding(false);
        setNewMapping({ name: '', dims: '', code: '', desc: '', wildcard: false });
    };

    const handleEditStart = (m: MemoryItem) => {
        setEditingKey(m.lookupKey);
        setEditForm({
            name: m.displayName,
            dims: m.dimensions,
            code: m.itemNo,
            desc: m.description,
            wildcard: !m.dimensions
        });
    };

    const handleEditSave = async () => {
        if (!editingKey || !editForm.name || !editForm.code) return;
        
        await storageService.updateLearnedMapping(
            editingKey,
            editForm.name,
            editForm.wildcard ? "" : editForm.dims,
            editForm.code,
            editForm.desc
        );
        
        await loadMemory();
        setEditingKey(null);
    };

    const handleDeleteClick = (e: React.MouseEvent, lookupKey: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteTargetKey(lookupKey);
        setIsDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTargetKey) {
            setIsDeleteOpen(false);
            return;
        }

        try {
            await storageService.deleteLearnedMapping(deleteTargetKey);
            await loadMemory();
        } catch (e) {
            console.error("Failed to delete memory item", e);
        } finally {
            setIsDeleteOpen(false);
            setDeleteTargetKey(null);
        }
    };

    const handleCancelDelete = () => {
        setIsDeleteOpen(false);
        setDeleteTargetKey(null);
    };

    const handleExport = async () => {
        const json = await storageService.exportMemory();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timber_takeoff_brain_${Date.now()}.json`;
        a.click();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const count = await storageService.importMemory(evt.target?.result as string);
                useStore.getState().showToast(`Successfully taught the app ${count} new things!`, 'success');
                await loadMemory();
            } catch {
                useStore.getState().showToast("Failed to read brain file.", 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleBlur = () => {
        // Delay to allow dropdown click
        setTimeout(() => setCatalogLookup(null), 150);
    };

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="flex justify-between items-center mb-6 px-1 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Sparkles size={20} className="text-violet-500" /> App Memory
                    </h3>
                    <p className="text-sm text-slate-500">Manual product corrections that bypass fuzzy logic on future jobs.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold flex items-center gap-2">
                        <Download size={16} /> Export Brain
                    </button>
                    <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-bold cursor-pointer flex items-center gap-2 transition-colors">
                        <Upload size={16} /> Import Brain
                        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                    <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-violet-500/20">
                        <Plus size={16} /> Manually Teach
                    </button>
                </div>
            </div>

            {(isAdding || editingKey) && (
                <div className="mb-6 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-6 shadow-sm animate-in slide-in-from-top-4 shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-violet-800 dark:text-violet-300 flex items-center gap-2">
                            <Edit2 size={18} /> {editingKey ? 'Edit Memory Entry' : 'Link Takeoff Text to Catalog Code'}
                        </h4>
                        <button onClick={() => { setIsAdding(false); setEditingKey(null); }}><X size={20} className="text-slate-400" /></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                        {(() => {
                            const targetForm = editingKey ? editForm : newMapping;
                            const setTargetForm = editingKey ? setEditForm : setNewMapping;
                            const currentCodeRef = editingKey ? editCodeRef : newCodeRef;
                            const currentDescRef = editingKey ? editDescRef : newDescRef;

                            return (
                                <>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Takeoff Item Name</label>
                                        <input type="text" value={targetForm.name} onChange={e => setTargetForm({...targetForm, name: e.target.value})} className="w-full p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm dark:text-white" placeholder="e.g. T-PLATE" />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-[10px] uppercase font-bold text-slate-500">Dimensions</label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input type="checkbox" checked={targetForm.wildcard} onChange={e => setTargetForm({...targetForm, wildcard: e.target.checked})} className="rounded text-violet-600" />
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">No Dims</span>
                                            </label>
                                        </div>
                                        <input 
                                            type="text" 
                                            value={targetForm.dims} 
                                            disabled={targetForm.wildcard}
                                            onChange={e => setTargetForm({...targetForm, dims: e.target.value})} 
                                            className={`w-full p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm dark:text-white ${targetForm.wildcard ? 'opacity-50 grayscale' : ''}`} 
                                            placeholder={targetForm.wildcard ? "Matches any dims" : "e.g. 90X45"} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">ERP Catalog Code</label>
                                        <input 
                                            ref={currentCodeRef}
                                            type="text" 
                                            value={targetForm.code} 
                                            onFocus={() => handleOpenLookup('code', currentCodeRef, targetForm.code)}
                                            onBlur={handleBlur}
                                            onChange={e => {
                                                setTargetForm({...targetForm, code: e.target.value});
                                                handleOpenLookup('code', currentCodeRef, e.target.value);
                                            }} 
                                            className="w-full p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-violet-500/50" 
                                            placeholder="e.g. PI09045" 
                                        />
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description (Optional)</label>
                                        <input 
                                            ref={currentDescRef}
                                            type="text" 
                                            value={targetForm.desc} 
                                            onFocus={() => handleOpenLookup('desc', currentDescRef, targetForm.desc)}
                                            onBlur={handleBlur}
                                            onChange={e => {
                                                setTargetForm({...targetForm, desc: e.target.value});
                                                handleOpenLookup('desc', currentDescRef, e.target.value);
                                            }} 
                                            className="w-full p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-violet-500/50" 
                                            placeholder="e.g. MGP10 PINE" 
                                        />
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => { setIsAdding(false); setEditingKey(null); }} className="px-4 py-2 text-slate-600 font-bold">Cancel</button>
                        <button 
                            onClick={editingKey ? handleEditSave : handleAdd} 
                            className="px-6 py-2 bg-violet-600 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-transform active:scale-95"
                        >
                            {editingKey ? <Save size={16} /> : <Plus size={16} />}
                            {editingKey ? 'Update Brain' : 'Add to Brain'}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm">
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 shrink-0">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search remembered items..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500/50 dark:text-white shadow-sm" 
                        />
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-4">
                        {memories.length} Associations Stored
                    </div>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar overscroll-contain">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-slate-400">
                            <Loader2 className="animate-spin mr-2" /> Synapsing...
                        </div>
                    ) : filteredMemories.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                            <AlertCircle size={48} className="mb-4 opacity-20" />
                            <p className="font-bold text-slate-600 dark:text-slate-300">Brain is empty or no matches found</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 border-b border-slate-100 dark:border-slate-700 shadow-sm z-10">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider w-1/2">Takeoff Reference (Original Casing)</th>
                                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">ERP Catalog Match</th>
                                    <th className="w-24 px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                {filteredMemories.map(m => {
                                    const isCurrentlyEditing = editingKey === m.lookupKey;

                                    return (
                                        <tr key={m.lookupKey} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 group transition-colors ${isCurrentlyEditing ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-400 shrink-0">
                                                        <Database size={14} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-slate-800 dark:text-white truncate">{m.displayName}</div>
                                                        <div className="text-[10px] font-mono text-slate-500">
                                                            {!m.dimensions ? (
                                                                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 rounded font-black">No Dims Fallback</span>
                                                            ) : (
                                                                m.dimensions
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">{m.itemNo}</span>
                                                    <span className="text-xs text-slate-500 truncate max-w-[300px]" title={m.description}>{m.description}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleEditStart(m)}
                                                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                        title="Edit this mapping"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => handleDeleteClick(e, m.lookupKey)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                        title="Delete this learned mapping"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {catalogLookup && (
                <CatalogDropdown 
                    catalog={catalog}
                    onSelect={handleSelectProduct}
                    onClose={() => setCatalogLookup(null)}
                    searchTerm={catalogLookup.searchTerm}
                    targetRef={catalogLookup.targetRef as any}
                    selectedIndex={dropdownSelectedIndex}
                />
            )}

            <ConfirmDialog 
                isOpen={isDeleteOpen}
                title="Delete remembered mapping?"
                message={
                    deleteTargetKey
                    ? `This will remove the saved match for:\n\n${deleteTargetKey}\n\nYou can re-teach it later.`
                    : "This will remove the saved match. You can re-teach it later."
                }
                confirmLabel="Delete"
                isDestructive={true}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    );
};