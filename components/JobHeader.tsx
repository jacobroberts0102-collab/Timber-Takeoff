import React, { useState } from 'react';
import { FileMetadata } from '../types';
import { Building2, MapPin, Hash, Calendar, Edit2, Check, X } from 'lucide-react';

interface JobHeaderProps {
    metadata: FileMetadata;
    onUpdate: (meta: FileMetadata) => void;
}

export const JobHeader: React.FC<JobHeaderProps> = ({ metadata, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState(metadata);

    const [prevMetadata, setPrevMetadata] = useState(metadata);
    if (metadata !== prevMetadata) {
        setPrevMetadata(metadata);
        setForm(metadata);
    }

    const handleSave = () => {
        onUpdate(form);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setForm(metadata);
        setIsEditing(false);
    };

    const handleChange = (field: keyof FileMetadata, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    // Input style: Forced light background for readability as requested
    const inputClasses = "w-full p-1.5 text-sm border rounded bg-white border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm";

    if (isEditing) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-blue-200 dark:border-blue-800 p-3 mb-2 animate-fade-in ring-1 ring-blue-500/10">
                <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <h3 className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2 text-sm">
                        <Edit2 size={14} /> Edit Job Details
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={handleCancel} className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"><X size={16} /></button>
                        <button onClick={handleSave} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 font-bold flex items-center gap-1"><Check size={14} /> Save</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Builder</label>
                        <input type="text" value={form.builder || ''} onChange={e => handleChange('builder', e.target.value)} className={inputClasses} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Site Address</label>
                        <input type="text" value={form.address || ''} onChange={e => handleChange('address', e.target.value)} className={inputClasses} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Job Number</label>
                        <input type="text" value={form.jobNumber || ''} onChange={e => handleChange('jobNumber', e.target.value)} className={inputClasses} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Date</label>
                        <input type="text" value={form.dateStr || ''} onChange={e => handleChange('dateStr', e.target.value)} className={inputClasses} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group transition-all hover:shadow-md relative h-full">
            
            <div className="absolute top-0 left-0 w-0.5 h-full bg-blue-500/20 group-hover:bg-blue-500 transition-colors"></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 items-start flex-1">
                
                {/* Builder */}
                <div className="flex items-center gap-2 min-w-[150px]">
                    <div className="p-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-lg shadow-sm ring-1 ring-violet-100 dark:ring-violet-800">
                        <Building2 size={14} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider leading-none mb-0.5">Builder</div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight truncate max-w-[200px]" title={metadata.builder}>{metadata.builder || 'Unknown Builder'}</div>
                    </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-2 min-w-[200px]">
                    <div className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg shadow-sm ring-1 ring-red-100 dark:ring-red-800 mt-0.5">
                        <MapPin size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider leading-none mb-0.5">Site Address</div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug whitespace-normal break-words line-clamp-2" title={metadata.address}>{metadata.address || 'Unknown Address'}</div>
                    </div>
                </div>

                {/* Job No */}
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm ring-1 ring-blue-100 dark:ring-blue-800">
                        <Hash size={14} />
                    </div>
                    <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider leading-none mb-0.5">Job No</div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{metadata.jobNumber || '-'}</div>
                    </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-800">
                        <Calendar size={14} />
                    </div>
                    <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider leading-none mb-0.5">Date</div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{metadata.dateStr || '-'}</div>
                    </div>
                </div>
            </div>

            <button 
                onClick={() => setIsEditing(true)} 
                className="lg:opacity-0 lg:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all shrink-0 absolute top-2 right-2 lg:static"
                title="Edit Job Header"
            >
                <Edit2 size={14} />
            </button>
        </div>
    );
};
