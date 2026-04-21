import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { HistoryItem, HistoryFolder } from '../types';
import { FileDown, Trash2, FileText, Building2, Phone, MapPin, Search, Pin, Upload, Download, CheckSquare, Square, FileDiff, NotebookPen, Save, X, Mail, Layers, Maximize2, Folder, FolderPlus, FolderOpen, ChevronRight, Database, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportToCsv } from '../services/excelService';
import { storageService } from '../services/storage';
import { ComparisonView } from './ComparisonView';
import { ConfirmDialog } from './ConfirmDialog';
import { useStore } from '../store/useStore';

interface HistoryViewProps {
  history: HistoryItem[];
  onRefresh: () => void;
  onReloadJob?: (item: HistoryItem) => void;
  userId: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onRefresh, onReloadJob, userId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState<{id: string, value: string} | null>(null);
  const [folders, setFolders] = useState<HistoryFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  
  useEffect(() => {
    storageService.getFolders(userId).then(setFolders);
  }, [userId]);

  const handleBulkDelete = useCallback(async () => {
    try {
        const deletePromises = Array.from(selectedItems).map(id => storageService.delete(id));
        await Promise.all(deletePromises);
        setSelectedItems(new Set());
        onRefresh();
        setShowBulkDeleteConfirm(false);
        useStore.getState().showToast(`Deleted ${selectedItems.size} items`, "success");
    } catch (error) {
        console.error("Bulk delete failed", error);
        useStore.getState().showToast("Failed to delete some items", "error");
    }
  }, [selectedItems, onRefresh]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete') {
            if (selectedItems.size > 0) {
                setShowBulkDeleteConfirm(true);
            } else if (activeFolderId) {
                setFolderToDelete(activeFolderId);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, activeFolderId, handleBulkDelete]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || isSavingFolder) return;
    setIsSavingFolder(true);
    try {
        const newFolder: HistoryFolder = {
            id: crypto.randomUUID(),
            name: newFolderName.trim(),
            createdAt: Date.now(),
            userId
        };
        await storageService.saveFolder(newFolder);
        setFolders(prev => [...prev, newFolder]);
        setNewFolderName('');
        setIsCreatingFolder(false);
    } catch (error) {
        console.error("Failed to create folder", error);
        useStore.getState().showToast("Failed to create folder", "error");
    } finally {
        setIsSavingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    await storageService.deleteFolder(id);
    setFolders(prev => prev.filter(f => f.id !== id));
    if (activeFolderId === id) setActiveFolderId(null);
    // Update all items in this folder to null
    const itemsInFolder = history.filter(h => h.folderId === id);
    for (const item of itemsInFolder) {
        await storageService.updateFolder(item.id, null);
    }
    onRefresh();
    setFolderToDelete(null);
  };

  const handleMoveToFolder = async (folderId: string | null, itemIds?: string[]) => {
    const ids = itemIds || Array.from(selectedItems);
    for (const id of ids) {
        await storageService.updateFolder(id, folderId);
    }
    if (!itemIds) setSelectedItems(new Set());
    onRefresh();
  };
  
  // UI State for Notes Modal
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // UI State for Comparison
  const [comparisonItems, setComparisonItems] = useState<[HistoryItem, HistoryItem] | null>(null);

  // Filter Logic
  const filteredHistory = useMemo(() => {
    let base = [...history];
    
    // Sort by pinned first, then timestamp
    base.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.timestamp || 0) - (a.timestamp || 0);
    });

    if (activeFolderId) {
        base = base.filter(h => h.folderId === activeFolderId);
    }
    if (!searchTerm) return base;
    const lower = searchTerm.toLowerCase();
    return base.filter(item => {
      const builder = item.metadata?.builder?.toLowerCase() || '';
      const address = item.metadata?.address?.toLowerCase() || '';
      const filename = item.fileName.toLowerCase();
      const tags = item.tags?.join(' ').toLowerCase() || '';
      const email = item.metadata?.email?.toLowerCase() || '';
      const phone = item.metadata?.phoneNumber?.toLowerCase() || '';
      
      return builder.includes(lower) || 
             address.includes(lower) || 
             filename.includes(lower) ||
             tags.includes(lower) ||
             email.includes(lower) ||
             phone.includes(lower);
    });
  }, [history, searchTerm, activeFolderId]);

  // Bulk Actions
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredHistory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredHistory.map(h => h.id)));
    }
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    try {
        const deletePromises = history.map(item => storageService.delete(item.id));
        await Promise.all(deletePromises);
        onRefresh();
        useStore.getState().showToast("History cleared successfully", "success");
    } catch (error) {
        console.error("Clear all failed", error);
        useStore.getState().showToast("Failed to clear some items", "error");
    }
  };

  const handleBulkExport = () => {
    const itemsToExport = history.filter(h => selectedItems.has(h.id));
    itemsToExport.forEach(item => {
        const name = item.metadata?.name || item.fileName;
        exportToCsv(item.data, name);
    });
    setSelectedItems(new Set());
  };

  const handleCompare = () => {
      if (selectedItems.size !== 2) return;
      const items = history.filter(h => selectedItems.has(h.id));
      if (items.length === 2) {
          // Sort by timestamp so Oldest is A, Newest is B
          items.sort((a, b) => a.timestamp - b.timestamp);
          setComparisonItems([items[0], items[1]]);
      }
  };

  // Individual Actions
  const handleDownload = (item: HistoryItem) => {
    const name = item.metadata?.name || item.fileName;
    exportToCsv(item.data, name);
  };

  const handleDelete = async (id: string) => {
    await storageService.delete(id);
    onRefresh();
    setItemToDeleteId(null);
  };

  const handleTogglePin = async (id: string) => {
    await storageService.togglePin(id);
    onRefresh();
  };

  const handleAddTag = async (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' && tagInput && tagInput.value.trim()) {
        const item = history.find(h => h.id === id);
        if (item) {
            const currentTags = item.tags || [];
            if (!currentTags.includes(tagInput.value.trim())) {
                const newTags = [...currentTags, tagInput.value.trim()];
                await storageService.updateTags(id, newTags);
                onRefresh();
            }
        }
        setTagInput(null);
    }
  };

  // Backup/Restore
  const handleExportBackup = async () => {
    const json = await storageService.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timber_takeoff_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target?.result as string;
            try {
                const count = await storageService.importBackup(content);
                useStore.getState().showToast(`Successfully restored ${count} items.`, "success");
                onRefresh();
            } catch {
                useStore.getState().showToast("Failed to import backup. Invalid file format.", "error");
            }
        };
        reader.readAsText(file);
    }
  };

  // Notes Modal Logic
  const openNoteEditor = (item: HistoryItem) => {
      setEditingNoteId(item.id);
      setTempNote(item.jobNotes || '');
  };

  const saveNote = async () => {
      if (!editingNoteId) return;
      // We need to update the item in DB. We can use `add` (put) to overwrite.
      const item = history.find(h => h.id === editingNoteId);
      if (item) {
          const updated = { ...item, jobNotes: tempNote };
          await storageService.add(updated);
          onRefresh();
      }
      setEditingNoteId(null);
  };

  if (comparisonItems) {
      return <ComparisonView itemA={comparisonItems[0]} itemB={comparisonItems[1]} onClose={() => setComparisonItems(null)} />;
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative h-full">
      
      {/* Discard Confirmation Dialog */}
      <ConfirmDialog 
        isOpen={!!folderToDelete}
        title="Delete Folder"
        message="Are you sure you want to delete this folder? Jobs inside will be moved to 'All Jobs'."
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => folderToDelete && handleDeleteFolder(folderToDelete)}
        onCancel={() => setFolderToDelete(null)}
      />

      <ConfirmDialog 
        isOpen={showClearConfirm}
        title="Clear Job History"
        message="Are you sure you want to clear your entire job history? This cannot be undone."
        confirmLabel="Clear All"
        isDestructive
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmDialog 
        isOpen={showBulkDeleteConfirm}
        title="Delete Selected Items"
        message={`Are you sure you want to delete ${selectedItems.size} selected items? This action cannot be undone.`}
        confirmLabel="Delete Items"
        isDestructive
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      <ConfirmDialog 
        isOpen={!!itemToDeleteId}
        title="Delete Job"
        message="Are you sure you want to delete this job? This action cannot be undone."
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => itemToDeleteId && handleDelete(itemToDeleteId)}
        onCancel={() => setItemToDeleteId(null)}
      />

      {/* Note Editor Modal */}
      <AnimatePresence>
        {editingNoteId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setEditingNoteId(null)}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.2)] w-full max-w-lg overflow-hidden border border-white/20 dark:border-slate-800/50 relative z-10"
                >
                    <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center bg-white/40 dark:bg-slate-900/40">
                        <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest text-sm">
                            <NotebookPen size={20} className="text-blue-500" /> Job Notes
                        </h3>
                        <button onClick={() => setEditingNoteId(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
                    </div>
                    <div className="p-6">
                        <textarea 
                          className="w-full h-64 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none transition-all shadow-inner"
                          placeholder="Add notes about this job, delivery instructions, etc..."
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                        />
                    </div>
                    <div className="p-6 bg-white/40 dark:bg-slate-900/40 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-end gap-3">
                        <motion.button 
                          whileHover={{ y: -2 }} 
                          whileTap={{ scale: 0.98 }} 
                          style={{ backfaceVisibility: 'hidden', willChange: 'transform' }}
                          onClick={saveNote} 
                          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-blue-500/30"
                        >
                            <Save size={16} /> Save Note
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Control Bar */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/20 dark:border-slate-800/50 p-4 flex flex-col md:flex-row gap-4 justify-between items-center"
      >
        
        {/* Search */}
        <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
                type="text" 
                placeholder="Search clients, addresses, tags..." 
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-700/50 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none text-slate-800 dark:text-slate-200 transition-all shadow-inner font-medium text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <motion.label 
              whileHover={{ y: -2 }} 
              whileTap={{ scale: 0.98 }} 
              style={{ backfaceVisibility: 'hidden', willChange: 'transform' }}
              className="cursor-pointer px-5 py-2.5 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-sm ring-1 ring-black/5"
            >
                <Upload size={14} className="text-blue-500" />
                <span className="hidden sm:inline">Restore</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </motion.label>
            <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }}
                onClick={handleExportBackup}
                className="px-5 py-2.5 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-sm ring-1 ring-black/5"
            >
                <Download size={14} className="text-blue-500" />
                <span className="hidden sm:inline">Backup</span>
            </motion.button>
            {history.length > 0 && (
                <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowClearConfirm(true)}
                    className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-sm ring-1 ring-red-500/20"
                >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Clear All</span>
                </motion.button>
            )}
        </div>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        {/* Folder Sidebar */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
            <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/20 dark:border-slate-800/50 overflow-hidden flex flex-col"
            >
                <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center bg-white/40 dark:bg-slate-900/40">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Folders</h3>
                    <motion.button 
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsCreatingFolder(true)}
                        className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl transition-all hover:bg-blue-500 hover:text-white"
                    >
                        <FolderPlus size={18} />
                    </motion.button>
                </div>
                
                <div className="p-3 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[60vh] custom-scrollbar">
                    <motion.button 
                        whileHover={{ x: 4 }}
                        onClick={() => setActiveFolderId(null)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('all'); }}
                        onDragLeave={() => setDragOverFolderId(null)}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (draggedItemId) handleMoveToFolder(null, [draggedItemId]);
                            setDragOverFolderId(null);
                        }}
                        className={`flex-shrink-0 lg:w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
                            activeFolderId === null 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20' 
                            : dragOverFolderId === 'all'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 border-2 border-dashed border-blue-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <Layers size={18} className={activeFolderId === null ? 'text-white' : 'text-blue-500'} />
                            <span className="whitespace-nowrap">All Jobs</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeFolderId === null ? 'bg-white/20' : 'bg-slate-100 dark:bg-black/30'}`}>{history.length}</span>
                    </motion.button>

                    <AnimatePresence>
                        {folders.map((folder, fIdx) => (
                            <motion.div 
                                key={folder.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: fIdx * 0.05 }}
                                className="group relative flex-shrink-0 lg:flex-shrink"
                            >
                                <motion.button 
                                    whileHover={{ x: 4 }}
                                    onClick={() => setActiveFolderId(folder.id)}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); }}
                                    onDragLeave={() => setDragOverFolderId(null)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (draggedItemId) handleMoveToFolder(folder.id, [draggedItemId]);
                                        setDragOverFolderId(null);
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
                                        activeFolderId === folder.id 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20' 
                                        : dragOverFolderId === folder.id
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 border-2 border-dashed border-blue-400'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {activeFolderId === folder.id ? <FolderOpen size={18} className="text-white" /> : <Folder size={18} className="text-blue-500/50 group-hover:text-blue-500" />}
                                        <span className="truncate max-w-[120px] whitespace-nowrap">{folder.name}</span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeFolderId === folder.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-black/30'}`}>
                                        {history.filter(h => h.folderId === folder.id).length}
                                    </span>
                                </motion.button>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setFolderToDelete(folder.id); }}
                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg shadow-sm bg-white dark:bg-slate-800"
                                        title="Delete Folder"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {isCreatingFolder && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="p-4 bg-white/40 dark:bg-slate-900/40 border-t border-slate-200/50 dark:border-slate-800/50 overflow-hidden"
                        >
                            <input 
                                autoFocus
                                type="text" 
                                className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                placeholder="Folder name..."
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            />
                            <div className="flex justify-end gap-3 mt-3">
                                <button onClick={() => setIsCreatingFolder(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Cancel</button>
                                <button 
                                    onClick={handleCreateFolder} 
                                    disabled={isSavingFolder}
                                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                >
                                    {isSavingFolder ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>

        {/* Main List Area */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {selectedItems.size > 0 && (
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-2xl border border-white/20 rounded-3xl p-3 flex items-center justify-between sticky top-0 z-20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-black/40"
                >
                    <div className="flex flex-col ml-4">
                        <span className="text-white font-black text-xs uppercase tracking-widest">
                            {selectedItems.size} Selected
                        </span>
                        <button onClick={() => setSelectedItems(new Set())} className="text-[10px] text-blue-400 hover:text-blue-300 text-left font-bold uppercase tracking-tighter">Clear selection</button>
                    </div>
                    <div className="flex gap-2 mr-2">
                        {selectedItems.size === 2 && (
                            <motion.button 
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleCompare}
                              className="px-5 py-2.5 bg-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-violet-500/30 flex items-center gap-2"
                            >
                                <FileDiff size={16} /> Compare
                            </motion.button>
                        )}
                        
                        {/* Move to Folder Dropdown */}
                        <div className="relative group/move">
                            <motion.button whileHover={{ y: -2 }} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all">
                                Move to <ChevronRight size={14} className="rotate-90" />
                            </motion.button>
                            <div className="absolute top-full left-0 mt-2 w-56 bg-slate-900 rounded-3xl shadow-2xl border border-white/10 hidden group-hover/move:block z-30 p-2 backdrop-blur-xl">
                                <button onClick={() => handleMoveToFolder(null)} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-2xl flex items-center gap-3 text-slate-300 transition-all">
                                    <Layers size={16} className="text-blue-500" /> All Jobs
                                </button>
                                {folders.map(f => (
                                    <button key={f.id} onClick={() => handleMoveToFolder(f.id)} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-2xl flex items-center gap-3 text-slate-300 transition-all">
                                        <Folder size={16} className="text-blue-500" /> {f.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={handleBulkExport} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest">Export</motion.button>
                        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setShowBulkDeleteConfirm(true)} className="px-5 py-2.5 bg-red-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-red-500/30">Delete</motion.button>
                    </div>
                </motion.div>
            )}
          </AnimatePresence>

          {/* List */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/20 dark:border-slate-800/50 overflow-hidden flex-1 flex flex-col"
          >
            {filteredHistory.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 shadow-inner"
                    >
                        <Database size={48} className="text-slate-300" />
                    </motion.div>
                    <h3 className="text-lg font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2">
                        {searchTerm ? 'No matches' : 'History empty'}
                    </h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto mb-8 font-medium">
                        {searchTerm 
                            ? 'Try adjusting your search terms to find what you are looking for.' 
                            : 'Your processed jobs will appear here for future reference and comparison.'}
                    </p>
                    {!searchTerm && (
                        <button onClick={() => onRefresh()} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-blue-500/30">
                           <Plus size={18} /> New Takeoff
                        </button>
                    )}
                 </div>
            ) : (
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                  <thead className="bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-md text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] sticky top-0 z-10 border-b border-slate-200/50 dark:border-slate-800/50">
                    <tr>
                      <th className="w-16 px-6 py-5">
                          <button onClick={selectAll} className="text-slate-400 hover:text-blue-500 transition-colors">
                            {selectedItems.size === filteredHistory.length && filteredHistory.length > 0 ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}
                          </button>
                      </th>
                      <th className="px-6 py-5 min-w-[140px]">Date</th>
                      <th className="px-6 py-5 min-w-[250px]">Job Details</th>
                      <th className="px-6 py-5 min-w-[200px]">Site Address</th>
                      <th className="px-4 py-5 text-center">Items</th>
                      <th className="px-4 py-5 text-center">Value</th>
                      <th className="px-4 py-5">Tags</th>
                      <th className="px-4 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                <AnimatePresence mode="popLayout">
                    {filteredHistory.map((item, idx) => {
                       const builder = item.metadata?.builder;
                       const address = item.metadata?.address;
                       const email = item.metadata?.email;
                       const phone = item.metadata?.phoneNumber;
                       const isSelected = selectedItems.has(item.id);
                       
                       // Calculate extended metrics
                       const totalLm = item.data.filter(d => d.unit === 'L/M').reduce((acc, curr) => acc + (curr.total || 0), 0);
                       const calcPrice = item.data.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

                       return (
                        <motion.tr 
                            key={item.id} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                            draggable
                            onDragStart={() => setDraggedItemId(item.id)}
                            onDragEnd={() => setDraggedItemId(null)}
                            className={`group transition-all hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-grab active:cursor-grabbing ${item.isPinned ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''} ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20 shadow-inner' : ''}`}
                        >
                          {/* Select */}
                          <td className="px-6 py-5 align-top">
                              <button onClick={() => toggleSelection(item.id)} className={`transition-all active:scale-90 ${isSelected ? 'text-blue-600' : 'text-slate-300 dark:text-slate-600 hover:text-blue-500'}`}>
                                  {isSelected ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}
                              </button>
                          </td>

                          {/* Date & Pin */}
                          <td className="px-6 py-5 align-top">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <motion.button whileTap={{ scale: 0.8 }} onClick={() => handleTogglePin(item.id)} className={`${item.isPinned ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'} transition-colors`}>
                                        {item.isPinned ? <Pin size={16} fill="currentColor" /> : <Pin size={16} />}
                                    </motion.button>
                                    <span className="font-black text-[13px] text-slate-800 dark:text-slate-100">{new Date(item.timestamp).toLocaleDateString()}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 pl-6 font-black uppercase tracking-widest leading-none">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          
                          {/* Job Details */}
                          <td 
                            className="px-6 py-5 align-top cursor-pointer group/details" 
                            onClick={() => onReloadJob?.(item)}
                          >
                            <div className="flex flex-col gap-2">
                                <div className="flex items-start gap-2.5 font-bold text-slate-900 dark:text-white group-hover/details:text-blue-600 dark:group-hover/details:text-blue-400 transition-all">
                                     <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover/details:bg-blue-500 group-hover/details:text-white transition-all">
                                        <FileText size={16} className="shrink-0" />
                                     </div>
                                     <span className="break-words line-clamp-2 mt-1 leading-tight" title={item.fileName}>{item.fileName}</span>
                                </div>
                                <div className="pl-[38px] flex flex-col gap-1">
                                    {builder && (
                                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
                                            <Building2 size={12} className="shrink-0" />
                                            <span className="truncate">{builder}</span>
                                        </div>
                                    )}
                                    {(email || phone) && (
                                        <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                            {email && <div className="flex items-center gap-1.5"><Mail size={10} className="shrink-0" /> <span className="truncate max-w-[120px]">{email}</span></div>}
                                            {phone && <div className="flex items-center gap-1.5"><Phone size={10} className="shrink-0" /> <span>{phone}</span></div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                          </td>

                          {/* Address */}
                          <td className="px-6 py-5 align-top">
                            {address ? (
                                <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300 text-xs font-medium leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                    <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <MapPin size={14} className="text-red-500" />
                                    </div>
                                    <span className="break-words line-clamp-3" title={address}>{address}</span>
                                </div>
                            ) : (
                                <span className="text-slate-300 dark:text-slate-700 italic pl-10 text-[11px]">No address provided</span>
                            )}
                          </td>

                          {/* Items */}
                          <td className="px-4 py-5 text-center align-top">
                            <div className="inline-flex flex-col items-center gap-1">
                                <div className="text-[14px] font-black text-slate-900 dark:text-white">{item.itemCount}</div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Items</div>
                            </div>
                          </td>

                          {/* Total Value */}
                          <td className="px-4 py-5 text-center align-top">
                            <div className="inline-flex flex-col items-end gap-1">
                                <div className="text-[14px] font-black text-emerald-600 dark:text-emerald-400">${calcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{totalLm.toFixed(0)}m Total LM</div>
                            </div>
                          </td>

                          {/* Tags */}
                          <td className="px-4 py-5 align-top">
                              <div className="flex flex-wrap gap-1.5 max-w-[150px]">
                                  {item.tags?.map(tag => (
                                      <motion.span 
                                        key={tag} 
                                        initial={{ scale: 0.8 }}
                                        animate={{ scale: 1 }}
                                        className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-500/20 flex items-center gap-1.5 group/tag shadow-sm transition-all hover:bg-blue-500 hover:text-white"
                                      >
                                          {tag}
                                          <button 
                                            onClick={() => {
                                                const newTags = item.tags?.filter(t => t !== tag) || [];
                                                storageService.updateTags(item.id, newTags).then(onRefresh);
                                            }}
                                            className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-200"
                                          >
                                              <X size={10} strokeWidth={3} />
                                          </button>
                                      </motion.span>
                                  ))}
                                  {tagInput?.id === item.id ? (
                                      <input 
                                        autoFocus
                                        type="text" 
                                        className="w-20 px-2 py-0.5 text-[10px] rounded-lg bg-white dark:bg-slate-800 border border-blue-500/50 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                        placeholder="..."
                                        onBlur={() => setTagInput(null)}
                                        onKeyDown={(e) => handleAddTag(e, item.id)}
                                        onChange={(e) => setTagInput({ id: item.id, value: e.target.value })}
                                      />
                                  ) : (
                                      <button 
                                        onClick={() => setTagInput({ id: item.id, value: '' })}
                                        className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-blue-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:border-blue-500 transition-all text-xs"
                                      >
                                          <Plus size={12} />
                                      </button>
                                  )}
                              </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-5 text-right whitespace-nowrap align-top">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onReloadJob?.(item)}
                                className="p-2.5 text-blue-600 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-900/50 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                title="Open Job"
                              >
                                 <Maximize2 size={16} />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => openNoteEditor(item)}
                                className="p-2.5 text-amber-600 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-900/50 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                title="Notes"
                              >
                                 <NotebookPen size={16} />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDownload(item)}
                                className="p-2.5 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-900/50 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                title="Export"
                              >
                                <FileDown size={16} />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setItemToDeleteId(item.id)}
                                className="p-2.5 text-red-500 hover:bg-red-500 hover:text-white dark:hover:bg-red-900/50 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                </AnimatePresence>
              </tbody>
            </table>
            </div>
          )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
