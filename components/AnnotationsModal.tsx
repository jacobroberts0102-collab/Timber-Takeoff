import React, { useState } from 'react';
import { Annotation, User } from '../types';
import { MessageSquare, Send, X, CheckCircle, Circle, User as UserIcon, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface AnnotationsModalProps {
  rowId: string;
  annotations: Annotation[];
  currentUser: User;
  onAdd: (text: string) => void;
  onToggleResolve: (annotationId: string) => void;
  onClose: () => void;
}

export const AnnotationsModal: React.FC<AnnotationsModalProps> = ({
  rowId,
  annotations,
  onAdd,
  onToggleResolve,
  onClose
}) => {
  const [newText, setNewText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newText.trim()) {
      onAdd(newText.trim());
      setNewText('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <MessageSquare className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-white tracking-tight">Row Annotations</h3>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Row ID: {rowId.slice(0, 8)}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Annotations List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
          {annotations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-12">
              <MessageSquare size={48} className="text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">No annotations yet.</p>
              <p className="text-xs text-slate-400">Be the first to add a note to this row.</p>
            </div>
          ) : (
            annotations.map((ann) => (
              <div 
                key={ann.id} 
                className={`flex gap-3 p-3 rounded-xl border transition-all ${
                  ann.resolved 
                    ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                }`}
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                    <UserIcon size={14} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">{ann.userName}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(ann.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={`text-sm text-slate-600 dark:text-slate-300 break-words ${ann.resolved ? 'line-through' : ''}`}>
                    {ann.text}
                  </p>
                </div>
                <button 
                  onClick={() => onToggleResolve(ann.id)}
                  className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                    ann.resolved 
                      ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' 
                      : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                  }`}
                  title={ann.resolved ? "Unresolve" : "Mark as Resolved"}
                >
                  {ann.resolved ? <CheckCircle size={18} /> : <Circle size={18} />}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input 
              autoFocus
              type="text" 
              placeholder="Add a note or instruction..." 
              className="flex-1 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
            <button 
              type="submit"
              disabled={!newText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
