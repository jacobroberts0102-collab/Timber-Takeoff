import React from 'react';
import { ParserRule } from '../types';
import { Brain, Check, X } from 'lucide-react';

interface SuggestionToastProps {
  suggestion: { rule: ParserRule; count: number };
  onAccept: () => void;
  onDismiss: () => void;
}

export const SuggestionToast: React.FC<SuggestionToastProps> = ({ suggestion, onAccept, onDismiss }) => {
  const { rule, count } = suggestion;

  // Auto-dismiss after 10 seconds if ignored? No, let user decide for rules.

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] animate-in slide-in-from-bottom-4 fade-in duration-300 w-full max-w-md px-4">
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 flex items-start gap-4 ring-1 ring-white/10">
        <div className="p-2 bg-violet-600 rounded-lg shrink-0">
          <Brain size={20} className="text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
            Pattern Detected
            <span className="bg-violet-900/50 text-violet-200 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">
              {count} Occurrences
            </span>
          </h4>
          
          <div className="text-xs text-slate-300 mb-3 leading-relaxed">
            {rule.type === 'item_alias' && (
              <>
                You renamed items matching <span className="font-mono text-amber-300 bg-amber-900/30 px-1 rounded">"{rule.pattern}"</span> to <span className="font-bold text-white">{rule.replacement}</span> multiple times.
              </>
            )}
            {rule.type === 'unit_override' && (
              <>
                You changed unit to <span className="font-bold text-white">{rule.unit}</span> for items in section <span className="font-mono text-amber-300 bg-amber-900/30 px-1 rounded">"{rule.pattern}"</span> multiple times.
              </>
            )}
            {rule.type === 'dimensions_rule' && (
               <>
                You set dimensions to <span className="font-bold text-white">{rule.replacement}</span> for items containing <span className="font-mono text-amber-300 bg-amber-900/30 px-1 rounded">"{rule.pattern}"</span>.
               </>
            )}
             <br/>
             Create a rule to apply this automatically?
          </div>

          <div className="flex gap-3">
            <button 
              onClick={onAccept}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Check size={14} /> Yes, Create Rule
            </button>
            <button 
              onClick={onDismiss}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button onClick={onDismiss} className="text-slate-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};