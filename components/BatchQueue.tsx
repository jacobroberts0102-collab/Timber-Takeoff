import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, CheckCircle2, AlertCircle, Loader2, X, Clock } from 'lucide-react';
import { BatchJob } from '../types';

interface BatchQueueProps {
  jobs: BatchJob[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const BatchQueue: React.FC<BatchQueueProps> = ({ jobs, onRemove, onClear }) => {
  if (jobs.length === 0) return null;

  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const errorCount = jobs.filter(j => j.status === 'error').length;
  const processingCount = jobs.filter(j => j.status === 'processing').length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[400px] flex flex-col">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Processing Queue</h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {jobs.length}
          </span>
        </div>
        <button 
          onClick={onClear}
          className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
        >
          Clear All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <AnimatePresence initial={false}>
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                job.status === 'processing' 
                  ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/50' 
                  : job.status === 'completed'
                  ? 'bg-emerald-50/30 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/30'
                  : job.status === 'error'
                  ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800/50'
                  : 'bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${
                job.status === 'completed' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' :
                job.status === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' :
                job.status === 'processing' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' :
                'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
              }`}>
                {job.status === 'processing' ? <Loader2 size={16} className="animate-spin" /> :
                 job.status === 'completed' ? <CheckCircle2 size={16} /> :
                 job.status === 'error' ? <AlertCircle size={16} /> :
                 <FileText size={16} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    {job.fileName}
                  </p>
                  <button 
                    onClick={() => onRemove(job.id)}
                    className="p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
                
                {job.status === 'processing' && (
                  <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}

                {job.status === 'error' && (
                  <p className="text-[10px] text-red-500 font-medium truncate">
                    {job.error || 'Failed to process'}
                  </p>
                )}

                {job.status === 'completed' && (
                  <p className="text-[10px] text-emerald-500 font-medium">
                    Successfully processed
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {(completedCount > 0 || errorCount > 0) && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {completedCount} Success • {errorCount} Failed
          </p>
          {processingCount === 0 && (
            <button 
              onClick={() => {}} // Could trigger a "View Results" or similar
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
};
