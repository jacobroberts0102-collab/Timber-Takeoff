import React from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, X } from 'lucide-react';
import { ValidationResult } from '../types';

interface ValidationSummaryProps {
  validation: ValidationResult;
  onClose: () => void;
  onExportValid: () => void;
  onExportAll: () => void;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ 
  validation, 
  onClose, 
  onExportValid, 
  onExportAll 
}) => {
  const errorCount = validation.errors.filter(e => e.severity === 'error').length;
  const warningCount = validation.errors.filter(e => e.severity === 'warning').length;
  const isAllValid = validation.errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isAllValid ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : errorCount > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
               {isAllValid ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Validation Check</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isAllValid 
                    ? "Data integrity verified." 
                    : `Found ${errorCount} errors and ${warningCount} warnings.`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
           {isAllValid ? (
               <div className="flex flex-col items-center justify-center py-8 text-center">
                   <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full flex items-center justify-center mb-4">
                       <CheckCircle size={32} />
                   </div>
                   <h4 className="text-lg font-bold text-slate-800 dark:text-white">All Good!</h4>
                   <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-2 mx-auto">
                       Every row has the required fields and valid quantities. You are ready to export.
                   </p>
               </div>
           ) : (
               <div className="space-y-3">
                 {validation.errors.slice(0, 10).map((err, i) => (
                   <div key={i} className={`p-3 rounded-lg border flex gap-3 items-start ${
                      err.severity === 'error' 
                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' 
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                   }`}>
                      {err.severity === 'error' 
                        ? <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" /> 
                        : <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                      }
                      <div className="text-sm">
                        <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">{err.field}: </span>
                        <span className="text-slate-600 dark:text-slate-300">{err.message}</span>
                      </div>
                   </div>
                 ))}
                 {validation.errors.length > 10 && (
                    <div className="text-center text-sm text-slate-500 italic py-2">
                       ...and {validation.errors.length - 10} more issues.
                    </div>
                 )}
               </div>
           )}
        </div>

        <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 justify-end">
           {errorCount > 0 && (
             <button 
                onClick={onExportValid}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
             >
                <CheckCircle size={16} />
                Export Valid Rows Only
             </button>
           )}
           <button 
              onClick={onExportAll}
              className={`px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                 errorCount > 0 
                 ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                 : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
           >
              {errorCount > 0 ? 'Ignore Errors & Export All' : 'Continue to Export'}
           </button>
        </div>
      </div>
    </div>
  );
};