import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 5000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <AlertCircle size={18} className="text-red-500" />,
    info: <Info size={18} className="text-blue-500" />,
    warning: <AlertTriangle size={18} className="text-amber-500" />
  };

  const colors = {
    success: 'border-emerald-100 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800/50',
    error: 'border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50',
    info: 'border-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/50',
    warning: 'border-amber-100 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/50'
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-4 fade-in duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md min-w-[300px] max-w-md ${colors[type]}`}>
        <div className="shrink-0">{icons[type]}</div>
        <div className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">
          {message}
        </div>
        <button 
          onClick={onClose}
          className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
