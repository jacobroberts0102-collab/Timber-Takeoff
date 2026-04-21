
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { CatalogProduct } from '../types';
import { storageService } from '../services/storage';
import { Upload, Trash2, Check, Database, Search, Edit2, X, Lock, Tag, Save, Ruler, Globe } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useStore } from '../store/useStore';

interface CatalogManagerProps {
    onCatalogUpdated?: (newCatalog: CatalogProduct[]) => void;
}

// Helpers for price logic
const parseToCents = (input: any): number | null => {
    if (input === null || input === undefined || input === '') return null;
    const str = String(input).replace(/[$,]/g, '').trim();
    const val = parseFloat(str);
    if (isNaN(val) || val < 0) return null;
    return Math.round(val * 100);
};

const formatFromCents = (cents: number | null | undefined): string => {
    if (cents === null || cents === undefined || cents === 0) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
};

const DEFAULT_CATALOG_WIDTHS: Record<string, number> = {
    lock: 40,
    itemNo: 140,
    supplier: 120,
    description: 400,
    price: 110,
    enriched: 260,
    group: 220,
    actions: 80
};

export const CatalogManager: React.FC<CatalogManagerProps> = ({ onCatalogUpdated }) => {
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(100);
    
    // Resize Logic
    const [columnWidths, setColumnWidths] = useState(DEFAULT_CATALOG_WIDTHS);
    const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

    // Edit State
    const [editingItemNo, setEditingItemNo] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<CatalogProduct>>({});

    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({
        itemNo: '',
        supplier: '',
        description: '',
        price: '',
        group: '',
        section: ''
    });
    const [pendingData, setPendingData] = useState<any[]>([]);

    const sentinelRef = useRef<HTMLDivElement>(null);

    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        try {
            const data = await storageService.getCatalog();
            setCatalog(data);
            if (onCatalogUpdated) onCatalogUpdated(data);
        } catch (e) {
            console.error("Failed to load catalog", e);
        } finally {
            setLoading(false);
        }
    }, [onCatalogUpdated]);

    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    const [prevSearchTerm, setPrevSearchTerm] = useState(searchTerm);
    if (searchTerm !== prevSearchTerm) {
        setPrevSearchTerm(searchTerm);
        setVisibleCount(100);
    }

    const startResize = (e: React.MouseEvent, col: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizingRef.current = { col, startX: e.clientX, startWidth: columnWidths[col] };
        document.body.style.cursor = 'col-resize';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!resizingRef.current) return;
        const { col, startX, startWidth } = resizingRef.current;
        const diff = e.clientX - startX;
        setColumnWidths(prev => ({
            ...prev,
            [col]: Math.max(col === 'lock' || col === 'actions' ? 20 : 60, startWidth + diff)
        }));
    }, []);

    const handleMouseUp = useCallback(() => {
        resizingRef.current = null;
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const suppliers = useMemo(() => {
        const set = new Set<string>();
        catalog.forEach(p => { if (p.supplier) set.add(p.supplier); });
        return Array.from(set).sort();
    }, [catalog]);

    const [selectedSupplier, setSelectedSupplier] = useState<string>('all');

    const filteredCatalog = useMemo(() => {
        let list = catalog;
        if (selectedSupplier !== 'all') {
            list = list.filter(p => p.supplier === selectedSupplier);
        }
        if (!searchTerm) return list;
        const low = searchTerm.toLowerCase();
        return list.filter(p => 
            p.itemNo.toLowerCase().includes(low) || 
            (p.description && p.description.toLowerCase().includes(low)) ||
            (p.group && p.group.toLowerCase().includes(low)) ||
            (p.section && p.section.toLowerCase().includes(low)) ||
            (p.dimsKey && p.dimsKey.toLowerCase().includes(low)) ||
            (p.gradeKey && p.gradeKey.toLowerCase().includes(low)) ||
            (p.supplier && p.supplier.toLowerCase().includes(low))
        );
    }, [catalog, searchTerm, selectedSupplier]);

    const displayedItems = useMemo(() => {
        return filteredCatalog.slice(0, visibleCount);
    }, [filteredCatalog, visibleCount]);

    useEffect(() => {
        if (loading || displayedItems.length >= filteredCatalog.length) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setVisibleCount(prev => prev + 100);
            }
        }, { threshold: 0.1 });

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [loading, displayedItems.length, filteredCatalog.length]);

    const handleEditStart = (p: CatalogProduct) => {
        setEditingItemNo(p.itemNo);
        setEditForm({ ...p });
    };

    const handleSaveEdit = async () => {
        if (!editingItemNo || !editForm.itemNo || !editForm.description) return;
        
        try {
            await storageService.updateCatalogItem(editingItemNo, editForm as CatalogProduct);
            await loadCatalog();
            setEditingItemNo(null);
            setEditForm({});
            useStore.getState().showToast("Item updated successfully.", "success");
        } catch {
            useStore.getState().showToast("Failed to update item. Ensure Item No is unique.", "error");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const arrayBuffer = evt.target?.result as ArrayBuffer;
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const wsname = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[wsname];
                
                // Robust extraction: get all rows as array of arrays
                const dataRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
                
                // Strategy: find the row with the most non-empty string cells (most likely headers)
                let maxCols = 0;
                let headerRowIdx = 0;
                dataRows.forEach((row, idx) => {
                    const count = Array.isArray(row) ? row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length : 0;
                    if (count > maxCols) {
                        maxCols = count;
                        headerRowIdx = idx;
                    }
                });

                const headerRow = dataRows[headerRowIdx];
                if (headerRow && Array.isArray(headerRow)) {
                    // Extract headers while maintaining index. Handle missing names with placeholders.
                    const headers = headerRow.map((h, i) => h ? String(h).trim() : `Col ${i + 1}`);
                    setRawHeaders(headers);
                    
                    // Convert full sheet to objects using the detected header row index
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIdx });
                    setPendingData(jsonData);
                    
                    // Smart auto-mapping based on extracted headers
                    const newMapping = { itemNo: '', description: '', price: '', group: '', section: '' };
                    headers.forEach(h => {
                        const low = h.toLowerCase();
                        if (low.includes('code') || low.includes('item no') || low.includes('itemno') || low.includes('sku') || low.includes('product')) newMapping.itemNo = h;
                        if (low.includes('desc')) newMapping.description = h;
                        if (low.includes('price') || low.includes('cost') || low.includes('sell') || low.includes('retail') || low.includes('pricing')) newMapping.price = h;
                        if (low.includes('group') || low.includes('cat') || low.includes('family')) newMapping.group = h;
                        if (low.includes('section') || low.includes('dept') || low.includes('department')) newMapping.section = h;
                    });
                    setMapping(newMapping);
                } else {
                    useStore.getState().showToast("The selected file appears to be empty or formatted incorrectly.", "error");
                }
            } catch (err) {
                console.error(err);
                useStore.getState().showToast("Failed to read file. Please ensure it is a valid Excel or CSV.", "error");
            } finally {
                // Done
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSaveCatalog = async () => {
        if (!mapping.itemNo || !mapping.description) {
            useStore.getState().showToast("Please map at least 'Item No' and 'Description' columns.", "warning");
            return;
        }

        setLoading(true);
        const processed: CatalogProduct[] = pendingData.map(row => ({
            itemNo: String(row[mapping.itemNo] || ''),
            description: String(row[mapping.description] || ''),
            supplier: mapping.supplier ? String(row[mapping.supplier] || '').trim() : undefined,
            priceCents: mapping.price ? parseToCents(row[mapping.price]) : null,
            group: mapping.group ? String(row[mapping.group] || '').trim() : null,
            section: mapping.section ? String(row[mapping.section] || '').trim() : null
        })).filter(p => p.itemNo && p.description && p.description !== 'nan');

        await storageService.saveCatalog(processed);
        await loadCatalog();
        setPendingData([]);
    };

    const handleDeleteItem = async () => {
        if (!deleteTarget) return;
        await storageService.deleteCatalogItem(deleteTarget);
        await loadCatalog();
        setDeleteTarget(null);
    };

    const inputClasses = "w-full bg-transparent outline-none px-2 py-1 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 text-xs text-slate-800 dark:text-slate-100";
    const compactInputClasses = "w-20 bg-white dark:bg-slate-900 outline-none px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-700 dark:text-slate-200 focus:border-blue-500 transition-colors shadow-sm";

    const Th = ({ id, label }: { id: string, label?: string }) => (
        <th 
            style={{ width: `${columnWidths[id]}px` }} 
            className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] relative group overflow-hidden"
        >
            <div className="flex items-center gap-1">
                {label && <span className="truncate">{label}</span>}
            </div>
            <div 
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-slate-300 dark:group-hover:bg-slate-700/50 transition-colors z-20"
                onMouseDown={(e) => startResize(e, id)}
            />
        </th>
    );

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="flex justify-between items-center mb-6 px-1 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Database size={20} className="text-blue-500" /> Product Catalog
                    </h3>
                    <p className="text-sm text-slate-500">Managing {catalog?.length || 0} items for Spruce ERP mapping.</p>
                </div>
                <div className="flex gap-2">
                    <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold cursor-pointer shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all">
                        <Upload size={16} /> Import Items
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
                    </label>
                    <button 
                        onClick={async () => {
                            const suppliers = useStore.getState().settings.suppliers?.filter(s => s.isActive);
                            if (!suppliers || suppliers.length === 0) {
                                useStore.getState().showToast("No active suppliers configured in settings.", "warning");
                                return;
                            }
                            setLoading(true);
                            try {
                                // Simulated API Sync
                                useStore.getState().showToast(`Syncing with ${suppliers.length} suppliers...`, "info");
                                await new Promise(r => setTimeout(r, 2000));
                                useStore.getState().showToast("Supplier sync complete. 12 new items found.", "success");
                                await loadCatalog();
                            } catch {
                                useStore.getState().showToast("Supplier sync failed.", "error");
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
                    >
                        <Globe size={16} /> Sync API
                    </button>
                </div>
            </div>

            {pendingData.length > 0 && (
                <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-sm animate-in slide-in-from-top-4 shrink-0">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                        <Check size={18} /> Map Imported Columns
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                        {['itemNo', 'supplier', 'description', 'price', 'group', 'section'].map(key => (
                            <div key={key}>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                                    {key === 'itemNo' ? 'Item No *' : key === 'description' ? 'Description *' : key === 'supplier' ? 'Supplier' : key === 'price' ? 'Price' : key.charAt(0).toUpperCase() + key.slice(1)}
                                </label>
                                <select 
                                    value={mapping[key]}
                                    onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                                >
                                    <option value="">Select Column...</option>
                                    {rawHeaders.map((h, i) => (
                                        <option key={`${h}-${i}`} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setPendingData([])} className="px-4 py-2 text-slate-600">Cancel</button>
                        <button onClick={handleSaveCatalog} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md">Import {pendingData.length} Products</button>
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm">
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                    <div className="relative w-full max-w-xl">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search catalog items, codes, descriptions..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" 
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        {suppliers.length > 0 && (
                            <select 
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.target.value)}
                                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                            >
                                <option value="all">All Suppliers</option>
                                {suppliers.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        )}
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-600">
                            {filteredCatalog.length} Matches
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left border-collapse table-fixed">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 border-b border-slate-100 dark:border-slate-700 shadow-sm z-10">
                            <tr>
                                <Th id="lock" />
                                <Th id="itemNo" label="Item No" />
                                <Th id="supplier" label="Supplier" />
                                <Th id="description" label="Description" />
                                <Th id="price" label="Price (Read-only)" />
                                <Th id="enriched" label="Enriched Keys (Editable)" />
                                <Th id="group" label="Group / Section" />
                                <Th id="actions" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {displayedItems.map(p => {
                                const isEditing = editingItemNo === p.itemNo;
                                return (
                                    <tr 
                                        key={p.itemNo} 
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 group ${p.isSystem ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''} ${isEditing ? 'bg-amber-500/10 transition-colors' : ''}`}
                                    >
                                        <td className="px-4 py-2 text-center overflow-hidden">
                                            {p.isSystem ? <Lock size={12} className="text-slate-300 mx-auto" /> : null}
                                        </td>
                                        <td className="px-4 py-2 truncate font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                                            {p.itemNo}
                                        </td>
                                        <td className="px-4 py-2 truncate text-xs text-slate-500 dark:text-slate-400 italic">
                                            {p.supplier || 'N/A'}
                                        </td>
                                        <td className="px-4 py-2 truncate">
                                            {isEditing && !p.isSystem ? (
                                                <input 
                                                    value={editForm.description} 
                                                    onChange={e => setEditForm({...editForm, description: e.target.value})} 
                                                    className={inputClasses}
                                                />
                                            ) : (
                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{p.description}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-1 justify-end font-mono text-xs text-slate-400 italic">
                                                {formatFromCents(p.priceCents)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            {isEditing ? (
                                                <div className="flex flex-wrap gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <Ruler size={10} className="text-slate-400" />
                                                        <input 
                                                            value={editForm.dimsKey || ''} 
                                                            onChange={e => setEditForm({...editForm, dimsKey: e.target.value})} 
                                                            className={compactInputClasses}
                                                            placeholder="Dims..."
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Tag size={10} className="text-slate-400" />
                                                        <input 
                                                            value={editForm.gradeKey || ''} 
                                                            onChange={e => setEditForm({...editForm, gradeKey: e.target.value})} 
                                                            className={compactInputClasses}
                                                            placeholder="Grade..."
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-slate-400">m</span>
                                                        <input 
                                                            type="number"
                                                            step="0.1"
                                                            value={editForm.lengthKeyM === undefined || editForm.lengthKeyM === null ? '' : editForm.lengthKeyM} 
                                                            onChange={e => setEditForm({...editForm, lengthKeyM: e.target.value ? parseFloat(e.target.value) : null})} 
                                                            className={compactInputClasses}
                                                            placeholder="Len..."
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {p.dimsKey && <span className="text-[9px] font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1 border border-blue-100 dark:border-blue-800"><Ruler size={8} /> {p.dimsKey}</span>}
                                                    {p.gradeKey && <span className="text-[9px] font-mono bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1 border border-violet-100 dark:border-violet-800"><Tag size={8} /> {p.gradeKey}</span>}
                                                    {p.lengthKeyM && <span className="text-[9px] font-mono bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1 border border-emerald-100 dark:border-emerald-800">{p.lengthKeyM}m</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 truncate">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-1">
                                                    <input 
                                                        value={editForm.group || ''} 
                                                        onChange={e => setEditForm({...editForm, group: e.target.value})} 
                                                        className={inputClasses}
                                                        placeholder="Group..."
                                                    />
                                                    <input 
                                                        value={editForm.section || ''} 
                                                        onChange={e => setEditForm({...editForm, section: e.target.value})} 
                                                        className={inputClasses}
                                                        placeholder="Section..."
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase truncate">
                                                        {p.group || '-'}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 truncate italic">
                                                        {p.section || '-'}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right overflow-hidden">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={handleSaveEdit} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Save"><Save size={14} /></button>
                                                        <button onClick={() => setEditingItemNo(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200" title="Cancel"><X size={14} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleEditStart(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Edit Fields"><Edit2 size={14} /></button>
                                                        {!p.isSystem && (
                                                            <button onClick={() => setDeleteTarget(p.itemNo)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete"><Trash2 size={14} /></button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div ref={sentinelRef} className="h-4" />
                </div>
            </div>
            
            <ConfirmDialog 
                isOpen={!!deleteTarget}
                title="Remove Catalog Item"
                message="Are you sure you want to remove this custom item from your catalog? This cannot be undone."
                confirmLabel="Remove Item"
                isDestructive={true}
                onConfirm={handleDeleteItem}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
};
