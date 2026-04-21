import React, { useState } from 'react';
import { ParsedLine, SourceDocument } from '../types';
import { PdfViewer } from './PdfViewer';
import { ExcelViewer } from './ExcelViewer';
import { PreviewTable } from './PreviewTable';
import { X, Split as SplitIcon, FileText, Table as TableIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface VerificationViewProps {
  isOpen: boolean;
  onClose: () => void;
  data: ParsedLine[];
  documents: SourceDocument[];
  activeDocId: string | null;
  onUpdateRow: (id: string, field: keyof ParsedLine, value: any) => void;
  activeRowId: string | null;
  onRowClick: (id: string) => void;
  onAddAnnotation?: (rowId: string) => void;
  catalog: any[];
  uiPreferences: any;
}

export const VerificationView: React.FC<VerificationViewProps> = ({
  isOpen,
  onClose,
  data,
  documents,
  activeDocId,
  onUpdateRow,
  activeRowId,
  onRowClick,
  onAddAnnotation,
  catalog,
  uiPreferences
}) => {
  const [splitRatio, setSplitRatio] = useState(50); // percentage for the document side
  const [mobileActiveTab, setMobileActiveTab] = useState<'document' | 'data'>('document');
  const activeDoc = documents.find(d => d.id === activeDocId) || documents[0];
  const activeRow = data.find(r => r.id === activeRowId);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900 flex flex-col"
    >
      {/* Header */}
      <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
            <SplitIcon size={20} />
          </div>
          <div>
            <h2 className="text-white font-bold">Split-Screen Verification</h2>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Compare source document with parsed data</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-1">
            <button 
              onClick={() => setSplitRatio(30)}
              className={`px-3 py-1 text-[10px] font-bold rounded ${splitRatio === 30 ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              30/70
            </button>
            <button 
              onClick={() => setSplitRatio(50)}
              className={`px-3 py-1 text-[10px] font-bold rounded ${splitRatio === 50 ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              50/50
            </button>
            <button 
              onClick={() => setSplitRatio(70)}
              className={`px-3 py-1 text-[10px] font-bold rounded ${splitRatio === 70 ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              70/30
            </button>
          </div>
          
          <div className="flex sm:hidden items-center bg-slate-800 rounded-lg p-1">
            <button 
              onClick={() => setMobileActiveTab('document')}
              className={`p-2 rounded ${mobileActiveTab === 'document' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            >
              <FileText size={16} />
            </button>
            <button 
              onClick={() => setMobileActiveTab('data')}
              className={`p-2 rounded ${mobileActiveTab === 'data' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            >
              <TableIcon size={16} />
            </button>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Document Side */}
        <div 
          className={`h-full border-r border-slate-800 relative overflow-hidden flex flex-col transition-all duration-300 w-full sm:w-[var(--split-ratio)] ${mobileActiveTab === 'document' ? 'flex' : 'hidden sm:flex'}`}
          style={{ '--split-ratio': `${splitRatio}%` } as React.CSSProperties}
        >
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
              Source: {activeDoc?.name}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {activeDoc?.type === 'pdf' ? (
              <PdfViewer 
                fileUrl={activeDoc.url} 
                highlightPage={activeRow?.page} 
                highlightRect={activeRow?.rect} 
              />
            ) : (
              <ExcelViewer 
                fileUrl={activeDoc?.url || ''} 
                highlightPage={activeRow?.page} 
                highlightRect={activeRow?.rect} 
              />
            )}
          </div>
        </div>

        {/* Data Side */}
        <div 
          className={`h-full bg-white dark:bg-slate-950 flex flex-col overflow-hidden transition-all duration-300 w-full sm:w-[var(--data-ratio)] ${mobileActiveTab === 'data' ? 'flex' : 'hidden sm:flex'}`}
          style={{ '--data-ratio': `${100 - splitRatio}%` } as React.CSSProperties}
        >
          <div className="flex-1 overflow-hidden">
            <PreviewTable 
              allData={data}
              data={data}
              onUpdateRow={onUpdateRow}
              activeRowId={activeRowId}
              onRowClick={onRowClick}
              onAddAnnotation={onAddAnnotation}
              catalog={catalog}
              uiPreferences={uiPreferences}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
