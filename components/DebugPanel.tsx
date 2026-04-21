import React, { useMemo, useState } from 'react';
import { Download, X, Terminal, Code, Database, Search } from 'lucide-react';
import { ParsedLine, TextLine, ParseProfile, FileMetadata } from '../types';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  rawLines: TextLine[];
  parsedRows: ParsedLine[];
  activeRowId: string | null;
  activeProfile: ParseProfile;
  profileConfidence: number;
  metadata: FileMetadata | null;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  onClose,
  rawLines,
  parsedRows,
  activeRowId,
  activeProfile,
  profileConfidence,
  metadata
}) => {
  const [activeTab, setActiveTab] = useState<'raw' | 'parsed' | 'json'>('raw');
  const [filterText, setFilterText] = useState('');

  const activeRow = useMemo(() => 
    activeRowId ? parsedRows.find(r => r.id === activeRowId) : null
  , [parsedRows, activeRowId]);

  const filteredRawLines = useMemo(() => {
    if (!filterText) return rawLines;
    const lower = filterText.toLowerCase();
    return rawLines.filter(l => l.text.toLowerCase().includes(lower));
  }, [rawLines, filterText]);

  const handleExportBundle = () => {
    const bundle = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      metadata,
      profile: {
        id: activeProfile.id,
        name: activeProfile.name,
        confidence: profileConfidence
      },
      stats: {
        rawLinesCount: rawLines.length,
        parsedRowsCount: parsedRows.length
      },
      rawLines,
      parsedRows
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_bundle_${metadata?.name || 'unknown'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[100] w-[500px] max-w-full bg-slate-900 text-slate-300 shadow-2xl border-l border-slate-700 flex flex-col font-mono text-xs animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-950">
        <div className="flex items-center gap-2 text-white font-bold">
          <Terminal size={16} className="text-green-500" />
          <span>Parser Debugger</span>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleExportBundle}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
            >
                <Download size={12} /> Bundle
            </button>
            <button onClick={onClose} className="p-1 hover:text-white transition-colors">
                <X size={18} />
            </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-slate-800/50 border-b border-slate-700 grid grid-cols-2 gap-4">
        <div>
            <div className="text-slate-500 uppercase text-[10px] font-bold">Profile</div>
            <div className="text-white truncate">{activeProfile.name}</div>
        </div>
        <div>
            <div className="text-slate-500 uppercase text-[10px] font-bold">Confidence</div>
            <div className={`font-bold ${profileConfidence > 80 ? 'text-green-400' : 'text-amber-400'}`}>
                {profileConfidence}%
            </div>
        </div>
        <div>
            <div className="text-slate-500 uppercase text-[10px] font-bold">Raw Lines</div>
            <div className="text-white">{rawLines.length}</div>
        </div>
        <div>
            <div className="text-slate-500 uppercase text-[10px] font-bold">Parsed Items</div>
            <div className="text-white">{parsedRows.length}</div>
        </div>
      </div>

      {/* Active Selection Debug */}
      {activeRow && (
          <div className="p-3 bg-blue-900/20 border-b border-blue-900/50">
              <div className="text-blue-400 uppercase text-[10px] font-bold mb-1 flex items-center gap-1">
                  <Search size={10} /> Selected Row ({activeRow.id.slice(0, 8)})
              </div>
              <div className="space-y-1">
                  <div className="flex gap-2">
                      <span className="text-slate-500 w-12 shrink-0">Orig:</span>
                      <span className="text-white break-all">{activeRow.originalLine}</span>
                  </div>
                  <div className="flex gap-2">
                      <span className="text-slate-500 w-12 shrink-0">Rect:</span>
                      <span className="text-amber-300">
                          {activeRow.rect ? `[${activeRow.rect.map(n => Math.round(n)).join(', ')}]` : 'N/A'}
                      </span>
                  </div>
                  <div className="flex gap-2">
                      <span className="text-slate-500 w-12 shrink-0">Conf:</span>
                      <span>{activeRow.confidence}</span>
                  </div>
              </div>
          </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-800/30">
          <button 
            onClick={() => setActiveTab('raw')}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${activeTab === 'raw' ? 'border-blue-500 text-white' : 'border-transparent hover:text-white'}`}
          >
              <Code size={14} className="inline mr-1" /> Raw Lines
          </button>
          <button 
            onClick={() => setActiveTab('parsed')}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${activeTab === 'parsed' ? 'border-blue-500 text-white' : 'border-transparent hover:text-white'}`}
          >
              <Database size={14} className="inline mr-1" /> Parsed Data
          </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-slate-900 relative">
          {activeTab === 'raw' && (
              <div className="absolute inset-0 flex flex-col">
                  <div className="p-2 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                      <input 
                        type="text" 
                        placeholder="Filter raw text..." 
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none"
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                      />
                  </div>
                  <div className="flex-1 overflow-auto p-2 space-y-1">
                      {filteredRawLines.map((line, i) => (
                          <div key={i} className="p-2 hover:bg-slate-800 rounded group border border-transparent hover:border-slate-700 transition-colors">
                              <div className="flex justify-between items-start mb-1 opacity-50 group-hover:opacity-100">
                                  <span className="text-[10px] text-blue-400">Page {line.page}</span>
                                  <span className="text-[10px] text-amber-500">
                                      x:{Math.round(line.rect[0])} y:{Math.round(line.rect[1])} w:{Math.round(line.rect[2])}
                                  </span>
                              </div>
                              <div className="text-white whitespace-pre-wrap break-all leading-relaxed">
                                  {line.text}
                              </div>
                          </div>
                      ))}
                      {filteredRawLines.length === 0 && (
                          <div className="p-8 text-center text-slate-600">No lines found.</div>
                      )}
                  </div>
              </div>
          )}

          {activeTab === 'parsed' && (
              <div className="p-2 space-y-1">
                  {parsedRows.map((row) => (
                      <div key={row.id} className="p-2 bg-slate-800/30 rounded border border-slate-800 mb-1 hover:border-slate-600">
                          <div className="flex gap-2 mb-1">
                              <span className="text-blue-400 font-bold">{row.section}</span>
                              <span className="text-slate-500">|</span>
                              <span className="text-green-400">{row.qty} {row.unit}</span>
                          </div>
                          <div className="text-white mb-1">{row.item}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{row.originalLine}</div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};