import React, { useRef, useState } from 'react';
import { X, Moon, Sun, Palette, Image as ImageIcon, Type, LayoutTemplate, Database, Sliders, Users, RotateCcw, Settings, Brain, Code, Globe, Wifi, Mic, Plus, Trash2, ExternalLink } from 'lucide-react';
import { AppSettings, AppTheme, User, UiPreferences, WebhookConfig, SupplierConfig } from '../types';
import { ProfileManager } from './ProfileManager';
import { TemplateManager } from './TemplateManager';
import { CatalogManager } from './CatalogManager';
import { UserManager } from './UserManager';
import { MemoryManager } from './MemoryManager';

import { RulesManager } from './RulesManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onUserUpdate?: (user: User) => void;
  initialTab?: 'general' | 'profiles' | 'templates' | 'catalog' | 'users' | 'customisation' | 'memory' | 'rules';
  onOpenDebug?: () => void;
  activeProfileId?: string;
  currentUser: User;
}

const DEFAULT_UI_PREFS: UiPreferences = {
  showHeaderMetrics: true,
  showJobNotes: true,
  showCatalogMapping: true,
  showContinuedBadges: true,
  showPdfPreview: true,
  showGroupControl: true,
  showColumnsControl: true,
  showExportControl: true,
  showAddControl: true
};

const FONT_OPTIONS = [
  { label: 'Arial (Standard)', value: 'Arial, sans-serif' },
  { label: 'Inter (Modern)', value: '"Inter", sans-serif' },
  { label: 'Roboto (Clean)', value: '"Roboto", sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'System Default', value: 'system-ui, -apple-system, sans-serif' },
];

const FONT_SIZE_OPTIONS = [
  { label: 'Compact', value: '14px' },
  { label: 'Standard', value: '16px' },
  { label: 'Large', value: '18px' },
  { label: 'Extra Large', value: '20px' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdateSettings, onUserUpdate, initialTab = 'general', currentUser }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'profiles' | 'templates' | 'catalog' | 'users' | 'customisation' | 'memory' | 'rules' | 'integrations'>(initialTab || 'general');
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setTempSettings(settings);
      setHasChanges(false);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }

  if (!isOpen) return null;

  const handleUpdateTemp = (newSettings: AppSettings) => {
    setTempSettings(newSettings);
    setHasChanges(JSON.stringify(newSettings) !== JSON.stringify(settings));
  };

  const handleSave = () => {
    onUpdateSettings(tempSettings);
    setHasChanges(false);
    onClose();
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleUpdateTemp({ ...tempSettings, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    handleUpdateTemp({ ...tempSettings, logoUrl: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleUiPref = (key: keyof UiPreferences) => {
    const currentPrefs = tempSettings.uiPreferences || DEFAULT_UI_PREFS;
    handleUpdateTemp({
      ...tempSettings,
      uiPreferences: {
        ...currentPrefs,
        [key]: !currentPrefs[key]
      }
    });
  };

  const resetUiPrefs = () => {
    handleUpdateTemp({
      ...tempSettings,
      uiPreferences: DEFAULT_UI_PREFS
    });
  };

  const themes: { id: AppTheme; color: string; label: string }[] = [
    { id: 'blue', color: 'bg-blue-600', label: 'Classic Blue' },
    { id: 'green', color: 'bg-emerald-600', label: 'Timber Green' },
    { id: 'orange', color: 'bg-orange-500', label: 'Construction Orange' },
    { id: 'red', color: 'bg-red-600', label: 'Alert Red' },
    { id: 'slate', color: 'bg-slate-600', label: 'Minimal Slate' },
  ];

  const uiPrefs = tempSettings.uiPreferences || DEFAULT_UI_PREFS;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 max-w-[50vw] h-[85vh]"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                <Settings size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Application Settings</h2>
          </div>
          <button onClick={handleCancel} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0 bg-white dark:bg-slate-800 scrollbar-hide">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'general' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
            }`}
          >
            <Settings size={14} /> General
          </button>
          <button 
            onClick={() => setActiveTab('customisation')}
            className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'customisation' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
            }`}
          >
            <Sliders size={14} /> Style
          </button>
          <button 
            onClick={() => setActiveTab('memory')}
            className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'memory' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
            }`}
          >
            <Brain size={14} /> Memory
          </button>
          {currentUser.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === 'users' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
              }`}
            >
              <Users size={14} /> Users
            </button>
          )}
          <button 
            onClick={() => setActiveTab('catalog')}
            className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'catalog' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
            }`}
          >
            <Database size={14} /> Catalog
          </button>
          <button 
            onClick={() => setActiveTab('profiles')}
            className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'profiles' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
            }`}
          >
            <Type size={14} /> AI
          </button>
          <button 
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'rules' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
            }`}
          >
            <Code size={14} /> Rules
          </button>
          <button 
            onClick={() => setActiveTab('integrations')}
            className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'integrations' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
            }`}
          >
            <Globe size={14} /> Integrations
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={`flex-1 py-4 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'templates' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30'
            }`}
          >
            <LayoutTemplate size={14} /> Export
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTab === 'general' ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sliders size={16} /> Workflow & Tools
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <Wifi size={18} />
                        </div>
                        <div>
                            <span className="text-slate-700 dark:text-slate-200 font-bold block">Offline Mode</span>
                            <span className="text-xs text-slate-500 block">Work without internet. Data syncs when back online.</span>
                        </div>
                    </div>
                    <button
                      onClick={() => handleUpdateTemp({ ...tempSettings, isOfflineMode: !tempSettings.isOfflineMode })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        tempSettings.isOfflineMode ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tempSettings.isOfflineMode ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg">
                            <Mic size={18} />
                        </div>
                        <div>
                            <span className="text-slate-700 dark:text-slate-200 font-bold block">Voice Dictation</span>
                            <span className="text-xs text-slate-500 block">Enable voice-to-takeoff commands.</span>
                        </div>
                    </div>
                    <button
                      onClick={() => handleUpdateTemp({ ...tempSettings, isVoiceEnabled: !tempSettings.isVoiceEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        tempSettings.isVoiceEnabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tempSettings.isVoiceEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Palette size={16} /> Appearance
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-200 font-medium">Dark Mode</span>
                    <button
                      onClick={() => handleUpdateTemp({ ...tempSettings, darkMode: !tempSettings.darkMode })}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        tempSettings.darkMode ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        tempSettings.darkMode ? 'translate-x-7' : 'translate-x-1'
                      } flex items-center justify-center`}>
                        {tempSettings.darkMode ? <Moon size={12} className="text-blue-600" /> : <Sun size={12} className="text-amber-500" />}
                      </span>
                    </button>
                  </div>
                  
                  <div>
                    <label className="text-slate-700 dark:text-slate-200 font-medium block mb-3">Color Theme</label>
                    <div className="flex gap-3">
                      {themes.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => handleUpdateTemp({ ...tempSettings, themeColor: theme.id })}
                          className={`w-8 h-8 rounded-full ${theme.color} ring-2 ring-offset-2 dark:ring-offset-slate-800 transition-all ${
                            tempSettings.themeColor === theme.id ? 'ring-slate-900 dark:ring-white scale-110' : 'ring-transparent hover:scale-105'
                          }`}
                          title={theme.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-slate-700 dark:text-slate-200 font-medium block mb-3">Font Family</label>
                      <div className="relative">
                        <select 
                          value={tempSettings.fontFamily}
                          onChange={(e) => handleUpdateTemp({ ...tempSettings, fontFamily: e.target.value })}
                          className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm"
                        >
                          {FONT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-700 dark:text-slate-200 font-medium block mb-3">Application Scaling (Font Size)</label>
                      <div className="relative">
                        <select 
                          value={tempSettings.fontSize}
                          onChange={(e) => handleUpdateTemp({ ...tempSettings, fontSize: e.target.value })}
                          className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm"
                        >
                          {FONT_SIZE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ImageIcon size={16} /> Branding
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-slate-700 dark:text-slate-200 font-medium block mb-2">Company Name</label>
                    <div className="relative">
                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        value={tempSettings.companyName}
                        onChange={(e) => handleUpdateTemp({ ...tempSettings, companyName: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-200 font-medium block mb-2">Header Logo</label>
                    <div className="flex items-center gap-4">
                      {tempSettings.logoUrl ? (
                        <div className="relative group">
                          <img src={tempSettings.logoUrl} alt="Logo" className="h-12 w-auto object-contain rounded bg-white/10 p-1" referrerPolicy="no-referrer" />
                          <button onClick={handleRemoveLogo} className="absolute -top-2 -right-2 bg-red-50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                        </div>
                      ) : (
                        <div className="h-12 px-4 border border-dashed border-slate-300 dark:border-slate-600 rounded flex items-center text-slate-400 text-xs">No custom logo</div>
                      )}
                      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">Upload New</button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : activeTab === 'integrations' ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <section>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Globe size={16} /> Webhooks (ERP Sync)
                    </h3>
                    <button 
                        onClick={() => {
                            const newWebhook: WebhookConfig = { id: crypto.randomUUID(), url: '', event: 'job_completed', active: true };
                            handleUpdateTemp({ ...tempSettings, webhooks: [...(tempSettings.webhooks || []), newWebhook] });
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                        <Plus size={14} /> Add Webhook
                    </button>
                </div>
                <div className="space-y-3">
                    {tempSettings.webhooks?.length === 0 && <p className="text-xs text-slate-500 italic">No webhooks configured.</p>}
                    {tempSettings.webhooks?.map((webhook, idx) => (
                        <div key={webhook.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex gap-3">
                                <input 
                                    type="text" 
                                    placeholder="https://your-erp.com/webhook"
                                    className="flex-1 px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={webhook.url}
                                    onChange={(e) => {
                                        const newWebhooks = [...tempSettings.webhooks!];
                                        newWebhooks[idx].url = e.target.value;
                                        handleUpdateTemp({ ...tempSettings, webhooks: newWebhooks });
                                    }}
                                />
                                <select 
                                    className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={webhook.event}
                                    onChange={(e) => {
                                        const newWebhooks = [...tempSettings.webhooks!];
                                        newWebhooks[idx].event = e.target.value as any;
                                        handleUpdateTemp({ ...tempSettings, webhooks: newWebhooks });
                                    }}
                                >
                                    <option value="job_completed">Job Completed</option>
                                    <option value="job_saved">Job Saved</option>
                                    <option value="export_triggered">Export Triggered</option>
                                </select>
                                <button 
                                    onClick={() => {
                                        const newWebhooks = tempSettings.webhooks!.filter(w => w.id !== webhook.id);
                                        handleUpdateTemp({ ...tempSettings, webhooks: newWebhooks });
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <ExternalLink size={16} /> Supplier APIs
                    </h3>
                    <button 
                        onClick={() => {
                            const newSupplier: SupplierConfig = { id: crypto.randomUUID(), name: '', apiUrl: '', apiKey: '', active: true };
                            handleUpdateTemp({ ...tempSettings, suppliers: [...(tempSettings.suppliers || []), newSupplier] });
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                        <Plus size={14} /> Add Supplier
                    </button>
                </div>
                <div className="space-y-4">
                    {tempSettings.suppliers?.length === 0 && <p className="text-xs text-slate-500 italic">No suppliers configured.</p>}
                    {tempSettings.suppliers?.map((supplier, idx) => (
                        <div key={supplier.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <input 
                                    type="text" 
                                    placeholder="Supplier Name (e.g. Bunnings)"
                                    className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={supplier.name}
                                    onChange={(e) => {
                                        const newSuppliers = [...tempSettings.suppliers!];
                                        newSuppliers[idx].name = e.target.value;
                                        handleUpdateTemp({ ...tempSettings, suppliers: newSuppliers });
                                    }}
                                />
                                <input 
                                    type="text" 
                                    placeholder="API Endpoint URL"
                                    className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={supplier.apiUrl}
                                    onChange={(e) => {
                                        const newSuppliers = [...tempSettings.suppliers!];
                                        newSuppliers[idx].apiUrl = e.target.value;
                                        handleUpdateTemp({ ...tempSettings, suppliers: newSuppliers });
                                    }}
                                />
                            </div>
                            <div className="flex gap-3">
                                <input 
                                    type="password" 
                                    placeholder="API Key / Secret"
                                    className="flex-1 px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={supplier.apiKey}
                                    onChange={(e) => {
                                        const newSuppliers = [...tempSettings.suppliers!];
                                        newSuppliers[idx].apiKey = e.target.value;
                                        handleUpdateTemp({ ...tempSettings, suppliers: newSuppliers });
                                    }}
                                />
                                <button 
                                    onClick={() => {
                                        const newSuppliers = tempSettings.suppliers!.filter(s => s.id !== supplier.id);
                                        handleUpdateTemp({ ...tempSettings, suppliers: newSuppliers });
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
              </section>
            </div>
          ) : activeTab === 'customisation' ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Interface Preferences</h3>
                  <p className="text-sm text-slate-500">Hide or show UI modules to streamline your workspace.</p>
                </div>
                <button 
                  onClick={resetUiPrefs}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-all"
                >
                  <RotateCcw size={14} /> Reset to Defaults
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'showHeaderMetrics', label: 'Header Metrics Cards', desc: 'Summary of items, L/M, and sections at the top.' },
                  { key: 'showJobNotes', label: 'Job Notes Card', desc: 'Persistent notes panel next to the metrics.' },
                  { key: 'showCatalogMapping', label: 'Catalog Mapping Indicator', desc: 'Percentage of items matched to Spruce catalog.' },
                  { key: 'showContinuedBadges', label: 'Continued Badges', desc: 'Visual indicators for multi-line item detection.' },
                  { key: 'showPdfPreview', label: 'PDF Preview Pane', desc: 'Split-screen view of the source document.' },
                  { key: 'showGroupControl', label: 'Grouping Control', desc: 'Button to toggle table grouping by section.' },
                  { key: 'showColumnsControl', label: 'Column Selector', desc: 'Menu to hide/show specific data columns.' },
                  { key: 'showExportControl', label: 'Export Controls', desc: 'Download and ERP export functionality.' },
                  { key: 'showAddControl', label: 'Manual Add Button', desc: 'Ability to manually insert new takeoff lines.' },
                ].map((pref) => (
                  <div key={pref.key} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group transition-all hover:border-blue-300">
                    <div className="pr-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">{pref.label}</span>
                      <span className="text-xs text-slate-500 block mt-0.5">{pref.desc}</span>
                    </div>
                    <button
                      onClick={() => toggleUiPref(pref.key as keyof UiPreferences)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                        uiPrefs[pref.key as keyof UiPreferences] ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        uiPrefs[pref.key as keyof UiPreferences] ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'users' ? (
            <div className="flex-1 h-full overflow-hidden">
              <UserManager currentUser={currentUser} onUserUpdate={onUserUpdate} />
            </div>
          ) : activeTab === 'templates' ? (
            <div className="h-full overflow-hidden">
              <TemplateManager onClose={() => setActiveTab('general')} />
            </div>
          ) : activeTab === 'catalog' ? (
            <div className="p-6 h-full overflow-hidden">
              <CatalogManager />
            </div>
          ) : activeTab === 'memory' ? (
            <div className="p-6 h-full overflow-hidden">
              <MemoryManager />
            </div>
          ) : activeTab === 'rules' ? (
            <div className="h-full overflow-hidden">
              <RulesManager />
            </div>
          ) : (
            <ProfileManager onClose={() => setActiveTab('general')} />
          )
        }
        </div>

        {/* Global Footer (Visible for all tabs except specialized managers with sidebars) */}
        {(activeTab === 'general' || activeTab === 'customisation' || activeTab === 'catalog' || activeTab === 'users' || activeTab === 'memory' || activeTab === 'rules' || activeTab === 'integrations') && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
            {hasChanges && (
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
              >
                Save Changes
              </button>
            )}
            <button 
              onClick={handleCancel} 
              className={`px-6 py-2 rounded-lg font-bold transition-all ${
                hasChanges 
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300' 
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
              }`}
            >
              {hasChanges ? 'Discard Changes' : 'Done'}
            </button>
          </div>
        )}

        {/* Discard Confirmation Dialog */}
        {showDiscardConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Unsaved Changes</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">You have unsaved changes. Are you sure you want to discard them?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDiscardConfirm(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                >
                  Stay
                </button>
                <button 
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};