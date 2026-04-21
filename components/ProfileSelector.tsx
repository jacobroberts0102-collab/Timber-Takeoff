import React, { useState } from 'react';
import { FileSearch, Settings2, ChevronDown, Check, Plus, Sparkles, Loader2 } from 'lucide-react';
import { ParseProfile } from '../types';
import { profileService } from '../services/profiles';

interface ProfileSelectorProps {
  currentProfile: ParseProfile;
  onChangeProfile: (profile: ParseProfile) => void;
  confidence: number;
  onManageProfiles?: () => void;
  onAiGenerateProfile?: () => void;
  isAiGenerating?: boolean;
}

export const ProfileSelector: React.FC<ProfileSelectorProps> = ({ 
  currentProfile, 
  onChangeProfile, 
  confidence, 
  onManageProfiles,
  onAiGenerateProfile,
  isAiGenerating = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<ParseProfile[]>(() => profileService.getAll());

  // Refresh profiles whenever the dropdown is opened
  const handleToggle = () => {
      if (!isOpen) {
          setAvailableProfiles(profileService.getAll());
      }
      setIsOpen(!isOpen);
  };

  return (
    <div className="relative w-full sm:w-auto">
      <button 
        onClick={handleToggle}
        className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 inline-flex items-center justify-center gap-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 group h-full"
        title="Select Estimator Profile"
      >
        <FileSearch size={18} className={confidence > 60 ? 'text-emerald-500' : 'text-blue-500'} />
        <div className="flex flex-col items-start leading-[1.1] text-left">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-black">Estimator Profile</span>
            <span className="truncate max-w-[120px] sm:max-w-[150px] block text-sm">
                {currentProfile.name}
            </span>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
            <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)}></div>
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-3 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right ring-1 ring-black/5">
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Switch Profile
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto p-2 space-y-1 overscroll-contain">
                    {onAiGenerateProfile && (
                        <button
                            onClick={() => {
                                onAiGenerateProfile();
                                setIsOpen(false);
                            }}
                            disabled={isAiGenerating}
                            className="w-full text-left px-3 py-3 rounded-lg text-sm flex items-start gap-3 transition-all bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border border-violet-200 dark:border-violet-800 hover:shadow-md group/ai mb-2"
                        >
                            <div className="mt-0.5 p-1.5 rounded bg-violet-600 text-white shadow-sm group-hover/ai:scale-110 transition-transform">
                                {isAiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-violet-700 dark:text-violet-300 flex items-center justify-between">
                                    <span>AI Auto-Detect Profile</span>
                                </div>
                                <div className="text-[10px] text-violet-600/70 dark:text-violet-400/70 mt-0.5 leading-tight">
                                    Analyze text with Gemini AI to generate a custom parsing profile.
                                </div>
                            </div>
                        </button>
                    )}
                    {availableProfiles.map(profile => (
                        <button
                            key={profile.id}
                            onClick={() => {
                                onChangeProfile(profile);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-start gap-3 transition-colors ${
                                currentProfile.id === profile.id 
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20' 
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            <div className={`mt-0.5 p-1 rounded shrink-0 ${currentProfile.id === profile.id ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                <Settings2 size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold flex items-center justify-between gap-2">
                                    <span className="truncate">{profile.name}</span>
                                    {currentProfile.id === profile.id && <Check size={14} className="shrink-0" />}
                                </div>
                                <div className="text-[11px] opacity-70 mt-0.5 leading-snug line-clamp-2">
                                    {profile.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                {onManageProfiles && (
                    <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <button 
                            onClick={() => {
                                setIsOpen(false);
                                onManageProfiles();
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                            <Plus size={14} /> Create / Manage Profiles
                        </button>
                    </div>
                )}
            </div>
        </>
      )}
    </div>
  );
};