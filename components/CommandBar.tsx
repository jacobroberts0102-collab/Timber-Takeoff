import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Command, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
  category: string;
}

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export const CommandBar: React.FC<CommandBarProps> = ({ isOpen, onClose, commands }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setSearch('');
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          handleClose();
        }
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, handleClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex items-center px-4 py-4 border-bottom border-slate-100 dark:border-slate-800">
              <Search className="text-slate-400 mr-3" size={20} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none outline-none text-lg text-slate-900 dark:text-white placeholder:text-slate-400"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
              />
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono text-slate-500">
                <Command size={10} />
                <span>K</span>
              </div>
            </div>

            <div className="max-height-[400px] overflow-y-auto p-2">
              {filteredCommands.length > 0 ? (
                <div className="space-y-1">
                  {Array.from(new Set(filteredCommands.map(c => c.category))).map(category => (
                    <div key={category}>
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {category}
                      </div>
                      {filteredCommands.filter(c => c.category === category).map((cmd) => {
                        const globalIdx = filteredCommands.indexOf(cmd);
                        const isSelected = globalIdx === selectedIndex;
                        
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => {
                              cmd.action();
                              handleClose();
                            }}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors ${
                              isSelected 
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`${isSelected ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {cmd.icon}
                              </div>
                              <span className="font-medium">{cmd.label}</span>
                            </div>
                            {cmd.shortcut && (
                              <div className="text-[10px] font-mono opacity-50 px-1.5 py-0.5 border border-current rounded">
                                {cmd.shortcut}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Zap size={32} className="mx-auto mb-3 opacity-20" />
                  <p>No commands found for "{search}"</p>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-top border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><kbd className="px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">↵</kbd> to select</span>
                <span className="flex items-center gap-1"><kbd className="px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">↑↓</kbd> to navigate</span>
              </div>
              <span>Press <kbd className="px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">esc</kbd> to close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
