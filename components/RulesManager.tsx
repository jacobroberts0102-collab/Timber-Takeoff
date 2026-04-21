import React, { useState } from 'react';
import { Plus, Trash2, Info, Code, Hash, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ParsingRule {
  id: string;
  name: string;
  pattern: string;
  targetField: 'description' | 'quantity' | 'length' | 'section' | 'grade';
  action: 'extract' | 'replace' | 'exclude';
  replacement?: string;
  isActive: boolean;
}

export const RulesManager: React.FC = () => {
  const [rules, setRules] = useState<ParsingRule[]>(() => {
    const saved = localStorage.getItem('timber_parsing_rules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load rules", e);
      }
    }
    return [];
  });
  const [isAdding, setIsAdding] = useState(false);
  const [newRule, setNewRule] = useState<Partial<ParsingRule>>({
    name: '',
    pattern: '',
    targetField: 'description',
    action: 'extract',
    isActive: true
  });


  const saveRules = (updatedRules: ParsingRule[]) => {
    setRules(updatedRules);
    localStorage.setItem('timber_parsing_rules', JSON.stringify(updatedRules));
  };

  const handleAddRule = () => {
    if (!newRule.name || !newRule.pattern) return;
    
    const rule: ParsingRule = {
      id: Math.random().toString(36).substr(2, 9),
      name: newRule.name!,
      pattern: newRule.pattern!,
      targetField: newRule.targetField as any,
      action: newRule.action as any,
      replacement: newRule.replacement,
      isActive: true
    };

    saveRules([...rules, rule]);
    setIsAdding(false);
    setNewRule({
      name: '',
      pattern: '',
      targetField: 'description',
      action: 'extract',
      isActive: true
    });
  };

  const toggleRule = (id: string) => {
    saveRules(rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const deleteRule = (id: string) => {
    saveRules(rules.filter(r => r.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Code className="text-blue-500" size={20} /> Custom Parsing Rules
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Define regex patterns to fine-tune how timber data is extracted.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> Add Rule
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-xl space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Rule Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Extract Grade from Notes"
                    value={newRule.name}
                    onChange={e => setNewRule({...newRule, name: e.target.value})}
                    className="w-full p-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Target Field</label>
                  <select 
                    value={newRule.targetField}
                    onChange={e => setNewRule({...newRule, targetField: e.target.value as any})}
                    className="w-full p-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="description">Description</option>
                    <option value="quantity">Quantity</option>
                    <option value="length">Length</option>
                    <option value="section">Section</option>
                    <option value="grade">Grade</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Regex Pattern</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="e.g., \b(MGP\d+)\b"
                    value={newRule.pattern}
                    onChange={e => setNewRule({...newRule, pattern: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddRule}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-md"
                >
                  Save Rule
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {rules.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Code size={32} />
            </div>
            <p className="text-sm font-medium">No custom rules defined yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <div 
                key={rule.id}
                className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                  rule.isActive 
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm' 
                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    rule.isActive ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}>
                    <Type size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{rule.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {rule.targetField}
                      </span>
                      <code className="text-[10px] text-blue-500 font-mono bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                        {rule.pattern}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleRule(rule.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      rule.isActive ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      rule.isActive ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                  <button 
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl flex gap-3">
          <Info className="text-amber-500 shrink-0" size={20} />
          <div className="text-xs text-amber-800 dark:text-amber-400 space-y-1">
            <p className="font-bold">Pro Tip: Regex Power</p>
            <p>Rules are applied in order. Use capture groups to extract specific data. For example, <code>\b(\d+)x(\d+)\b</code> can extract width and height.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
