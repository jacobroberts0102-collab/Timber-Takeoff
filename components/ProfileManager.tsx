import React, { useState } from 'react';
import { ParseProfile } from '../types';
import { profileService } from '../services/profiles';
import { Plus, Trash2, Save, ArrowLeft, FileSearch, Edit2, HelpCircle, Check } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface ProfileManagerProps {
  onClose: () => void;
}

const processPatternInput = (input: string, type: 'header' | 'ignore'): RegExp => {
    const trimmed = input.trim();
    if (!trimmed) return new RegExp('^$'); 

    // Heuristic: If it looks like Regex (starts with ^, ends with $, has escapes), trust user
    if (trimmed.length > 2 && (trimmed.startsWith('^') || trimmed.endsWith('$') || /\\/.test(trimmed) || /\[.*\]/.test(trimmed))) {
        try { return new RegExp(trimmed, 'i'); } catch { /* ignore invalid regex */ }
    }

    // Natural Language Processing
    // 1. Escape special regex characters that aren't *
    let pattern = trimmed.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // 2. Restore * as wildcard .*
    pattern = pattern.replace(/\*/g, '.*');

    if (type === 'header') {
        // Headers: Match whole line, allowing whitespace trim
        // e.g. "Wall Frame" -> "^\s*Wall Frame\s*$"
        return new RegExp(`^\\s*${pattern}\\s*$`, 'i');
    } else {
        // Ignore: Match anywhere (Contains)
        return new RegExp(pattern, 'i');
    }
};

export const ProfileManager: React.FC<ProfileManagerProps> = ({ onClose }) => {
  const [profiles, setProfiles] = useState<ParseProfile[]>(() => profileService.getAll());
  const [activeProfile, setActiveProfile] = useState<ParseProfile | null>(null);
  
  // Dialog State
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; title: string; message: string } | null>(null);

  // Form State for Active Profile (using strings for regex editing)
  const [formData, setFormData] = useState<{
      name: string;
      description: string;
      keywords: string;
      sectionPatterns: string;
      ignorePatterns: string;
  } | null>(null);

  const handleSelectProfile = (p: ParseProfile) => {
      setActiveProfile(p);
      setFormData({
          name: p.name,
          description: p.description,
          keywords: p.keywords?.join(', ') || '',
          sectionPatterns: p.settings.sectionHeaderPatterns.map(r => r.source).join('\n'),
          ignorePatterns: p.settings.ignorePatterns.map(r => r.source).join('\n')
      });
  };

  const handleCreateNew = () => {
      const newProfile: ParseProfile = {
          id: crypto.randomUUID(),
          name: 'New Custom Profile',
          description: 'Custom parsing rules.',
          isCustom: true,
          keywords: [],
          settings: {
              sectionHeaderPatterns: [],
              ignorePatterns: [],
              unitRules: []
          },
          detect: () => 0
      };
      
      // Save initially to register it
      profileService.save(newProfile);
      const updatedList = profileService.getAll();
      setProfiles(updatedList);
      
      // Find the newly created profile in the refreshed list to ensure consistency
      const created = updatedList.find(p => p.id === newProfile.id) || newProfile;
      handleSelectProfile(created);
  };

  const handleRequestDelete = (e: React.MouseEvent, id: string, name: string) => {
      // Prevent selection
      e.preventDefault();
      e.stopPropagation();

      setDeleteDialog({
          isOpen: true,
          id,
          name
      });
  };

  const confirmDelete = () => {
      if (!deleteDialog) return;
      const { id } = deleteDialog;

      // Perform delete
      profileService.delete(id);
      
      // Update State
      const freshProfiles = profileService.getAll();
      setProfiles(freshProfiles);
      
      // Handle active profile state
      if (activeProfile?.id === id) {
          setActiveProfile(null);
          setFormData(null);
      }
      setDeleteDialog(null);
  };

  const handleSave = () => {
      if (!activeProfile || !formData) return;

      try {
          const updatedProfile: ParseProfile = {
              ...activeProfile,
              name: formData.name,
              description: formData.description,
              isCustom: true, // Always mark as custom when saving
              keywords: formData.keywords.split(',').map(s => s.trim()).filter(Boolean),
              settings: {
                  ...activeProfile.settings,
                  sectionHeaderPatterns: formData.sectionPatterns.split('\n').filter(Boolean).map(s => processPatternInput(s, 'header')),
                  ignorePatterns: formData.ignorePatterns.split('\n').filter(Boolean).map(s => processPatternInput(s, 'ignore'))
              }
          };

          profileService.save(updatedProfile);
          
          // Refresh lists
          setProfiles(profileService.getAll());
          setActiveProfile(updatedProfile);
          
          // Update form data to match saved state
          setFormData({
              name: updatedProfile.name,
              description: updatedProfile.description,
              keywords: updatedProfile.keywords?.join(', ') || '',
              sectionPatterns: updatedProfile.settings.sectionHeaderPatterns.map(r => r.source).join('\n'),
              ignorePatterns: updatedProfile.settings.ignorePatterns.map(r => r.source).join('\n')
          });
          
          setAlertDialog({
              isOpen: true,
              title: "Success",
              message: "Profile saved successfully!"
          });
      } catch (err) {
          console.error(err);
          setAlertDialog({
              isOpen: true,
              title: "Error",
              message: "Failed to save profile. Please check your text patterns for invalid Regular Expressions."
          });
      }
  };

  return (
    <div className="flex h-full bg-white dark:bg-slate-900 overflow-hidden animate-fade-in relative">
        {/* Sidebar List */}
        <div className="w-72 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-800/50">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <FileSearch size={18} /> Estimator Profiles
                </h3>
                <button onClick={handleCreateNew} className="p-1.5 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 transition-colors" title="Create New Profile">
                    <Plus size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {profiles.map(p => {
                    const isActive = activeProfile?.id === p.id;

                    return (
                        <div 
                            key={p.id} 
                            className={`flex items-center rounded-lg border overflow-hidden transition-all select-none ${
                                isActive 
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 shadow-sm' 
                                : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                            }`}
                        >
                            {/* LEFT SIBLING: Selection Area */}
                            <div
                                onClick={() => handleSelectProfile(p)}
                                className="flex-1 p-3 cursor-pointer min-w-0"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`truncate font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {p.name}
                                    </span>
                                    {isActive && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                    {p.description}
                                </div>
                            </div>

                            {/* RIGHT SIBLING: Delete Button */}
                            <div className="pr-2 border-l border-slate-100 dark:border-slate-700/50 self-stretch flex items-center">
                                <button
                                    type="button"
                                    onClick={(e) => handleRequestDelete(e, p.id, p.name)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer z-10"
                                    title="Delete Profile"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={onClose} className="w-full py-2 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
            {activeProfile && formData ? (
                <>
                    {/* Toolbar */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                             <input 
                                type="text" 
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="text-lg font-bold text-slate-800 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full max-w-md"
                                placeholder="Profile Name"
                             />
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                type="button"
                                onClick={(e) => handleRequestDelete(e, activeProfile.id, activeProfile.name)}
                                className="shrink-0 px-3 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg font-medium flex items-center gap-2 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-800"
                                title="Delete Profile"
                            >
                                <Trash2 size={16} /> <span className="hidden sm:inline">Delete</span>
                            </button>
                            <button 
                                onClick={handleSave}
                                className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                            >
                                <Save size={16} /> Save Changes
                            </button>
                        </div>
                    </div>

                    {/* Content Editor */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
                        <div className="max-w-3xl mx-auto space-y-6">
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                                <input 
                                    type="text" 
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Detection Keywords</label>
                                <input 
                                    type="text" 
                                    value={formData.keywords}
                                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                                    placeholder="e.g. Mitek, Estimate, Job No (Comma separated)"
                                />
                                <p className="text-xs text-slate-400 mt-1">If these words appear in the PDF, this profile will be auto-selected.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                                        <span>Section Headers</span>
                                        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded text-slate-600 dark:text-slate-300">Exact Match</span>
                                    </label>
                                    <textarea 
                                        value={formData.sectionPatterns}
                                        onChange={(e) => setFormData({ ...formData, sectionPatterns: e.target.value })}
                                        className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono h-64 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-slate-800 dark:text-white"
                                        placeholder={`WALL FRAME\nROOF FRAME\nHARDWARE`}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">One per line. Matches full line (case insensitive). Use * for wildcards.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                                        <span>Ignored Text</span>
                                        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded text-slate-600 dark:text-slate-300">Contains</span>
                                    </label>
                                    <textarea 
                                        value={formData.ignorePatterns}
                                        onChange={(e) => setFormData({ ...formData, ignorePatterns: e.target.value })}
                                        className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono h-64 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-slate-800 dark:text-white"
                                        placeholder={`Page\nDate:\nTerms and Conditions`}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">One per line. Any line containing this text will be skipped.</p>
                                </div>
                            </div>
                            
                            {/* Help Box */}
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex gap-3">
                                <HelpCircle size={20} className="text-blue-500 shrink-0" />
                                <div className="text-sm text-blue-800 dark:text-blue-200">
                                    <p className="font-bold mb-1">Regex Support</p>
                                    <p>Advanced users can enter Javascript Regular Expressions. Start with <code>^</code> or end with <code>$</code> to trigger regex mode. Otherwise, text is treated as simple wildcards.</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Edit2 size={32} className="opacity-50" />
                    </div>
                    <p className="font-medium">Select a profile to edit</p>
                    <p className="text-sm opacity-70">or create a new one to get started.</p>
                </div>
            )}
        </div>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog 
            isOpen={!!deleteDialog}
            title="Delete Profile?"
            message={`Delete profile "${deleteDialog?.name}"? This cannot be undone.`}
            confirmLabel="Delete"
            isDestructive={true}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteDialog(null)}
        />

        <ConfirmDialog 
            isOpen={!!alertDialog}
            title={alertDialog?.title || 'Alert'}
            message={alertDialog?.message || ''}
            confirmLabel="OK"
            onConfirm={() => setAlertDialog(null)}
        />
    </div>
  );
};