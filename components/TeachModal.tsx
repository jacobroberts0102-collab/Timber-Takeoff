import React, { useState, useMemo } from 'react';
import { X, Save, Search, Info, CheckCircle2, AlertCircle, BrainCircuit } from 'lucide-react';
import { ParsedLine, CatalogProduct, MemoryItem } from '../types';
import { buildLookupKey } from '../utils/learnedKey';
import { storageService } from '../services/storage';
import { motion } from 'motion/react';

interface TeachModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: ParsedLine;
  catalog: CatalogProduct[];
  onLearned: (mapping: MemoryItem) => void;
}

export const TeachModal: React.FC<TeachModalProps> = ({ isOpen, onClose, row, catalog, onLearned }) => {
  const [searchTerm, setSearchTerm] = useState(row.spruceDescription || row.item || '');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(
    catalog.find(p => p.itemNo === row.spruceItemNo) || null
  );

  const filteredCatalog = useMemo(() => {
    if (!searchTerm) return catalog.slice(0, 50);
    const term = searchTerm.toLowerCase();
    return catalog
      .filter(p => 
        p.itemNo.toLowerCase().includes(term) || 
        p.description.toLowerCase().includes(term) ||
        (p.dimensions && p.dimensions.toLowerCase().includes(term))
      )
      .slice(0, 50);
  }, [catalog, searchTerm]);

  const handleSave = async () => {
    if (!selectedProduct) return;

    const memoryItem: MemoryItem = {
      lookupKey: buildLookupKey(row.item, row.dimensions),
      displayName: row.item,
      dimensions: row.dimensions,
      itemNo: selectedProduct.itemNo,
      description: selectedProduct.description
    };

    await storageService.saveLearnedMapping(memoryItem);
    onLearned(memoryItem);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BrainCircuit size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Teach AI Mapping</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Help the AI learn how to map this specific line item</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Source Context */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Info size={14} /> Source Line Context
            </h4>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{row.item}</p>
                  <p className="text-xs text-slate-500">{row.dimensions} {row.grade}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                    {row.qty} {row.unit}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 italic">Original Text: "{row.originalLine}"</p>
              </div>
            </div>
          </div>

          {/* Mapping Selector */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Search size={14} /> Select Correct Catalog Product
            </h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search catalog by code or description..."
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30">
              {filteredCatalog.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCatalog.map(product => (
                    <button
                      key={product.itemNo}
                      onClick={() => setSelectedProduct(product)}
                      className={`w-full text-left p-3 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${selectedProduct?.itemNo === product.itemNo ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-inset ring-blue-500' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{product.description}</p>
                        <p className="text-xs text-slate-500 font-mono">{product.itemNo}</p>
                      </div>
                      {selectedProduct?.itemNo === product.itemNo && (
                        <CheckCircle2 className="text-blue-500 shrink-0" size={20} />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="text-sm text-slate-500">No products found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex-1 mr-4">
            {selectedProduct ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Ready to learn this mapping
              </p>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info size={14} /> Select a product to continue
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={!selectedProduct}
              onClick={handleSave}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95 ${selectedProduct ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              <Save size={18} />
              Save Mapping
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
