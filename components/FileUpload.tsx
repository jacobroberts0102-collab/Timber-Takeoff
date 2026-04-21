import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Upload, Loader2, AlertCircle, Scan, FileText, FileSpreadsheet, Sparkles } from 'lucide-react';
import { ParseStatus, ParseProfile } from '../types';
import { ProfileSelector } from './ProfileSelector';
import { useStore } from '../store/useStore';

interface FileUploadProps {
  onFileUpload: (files: File[], useAi?: boolean) => void;
  status: ParseStatus;
  activeProfile: ParseProfile;
  onProfileChange: (profile: ParseProfile) => void;
  onManageProfiles?: () => void;
  onAiGenerateProfile?: () => void;
  isAiGenerating?: boolean;
  progress?: number;
  customMessage?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUpload, 
  status, 
  activeProfile, 
  onProfileChange, 
  onManageProfiles,
  onAiGenerateProfile,
  isAiGenerating = false,
  progress = 0,
  customMessage = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const [useAiOnUpload, setUseAiOnUpload] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const isValidFile = (file: File) => {
      const validTypes = [
          'application/pdf', 
          'application/vnd.ms-excel', 
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv'
      ];
      // Fallback check on extension if MIME type is generic/missing
      const validExts = ['.pdf', '.xls', '.xlsx', '.csv'];
      return validTypes.includes(file.type) || validExts.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const validFiles: File[] = [];
        Array.from(e.dataTransfer.files).forEach((item) => {
            const file = item as File;
            if (isValidFile(file)) {
                validFiles.push(file);
            }
        });
        
        if (validFiles.length > 0) {
            onFileUpload(validFiles, useAiOnUpload);
        } else {
            useStore.getState().showToast('Please upload PDF, Excel, or CSV files.', 'warning');
        }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(Array.from(e.target.files), useAiOnUpload);
    }
  };

  const statusMessages = {
      idle: "Drag and drop your files here",
      extracting: "Reading document structure...",
      parsing: "Analyzing text and dimensions...",
      ready: "Processing complete!",
      error: "Error processing file",
      no_data: "No identifiable data found",
      scanned_detected: "Scanned file detected. Waiting for input...",
      ocr_processing: "Running OCR engine..."
  };

  const isProcessing = status === 'extracting' || status === 'parsing' || status === 'ocr_processing';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      style={{ perspective: 1000 }}
      className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-white/40 dark:border-slate-800/40 p-4 md:p-12 mb-8 transition-all relative group overflow-hidden"
    >
      
      {/* Background Decor - Immersive Atmospheric Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              x: [0, 80, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-40 -right-40 w-[40rem] h-[40rem] bg-blue-500/10 rounded-full blur-[120px]"
          />
          <motion.div 
            animate={{ 
              x: [0, -60, 0],
              y: [0, 100, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-60 -left-60 w-[50rem] h-[50rem] bg-emerald-500/5 rounded-full blur-[150px]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-white/10 dark:via-transparent dark:to-slate-900/20 pointer-events-none" />
      </div>

      <div className="flex flex-col relative z-10">
        {/* File Upload Area */}
        <div 
          className={`w-full border-2 border-dashed rounded-[1.5rem] sm:rounded-[2.5rem] p-8 md:p-24 flex flex-col items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden group/dropzone ${
            isDragging 
              ? 'border-blue-500 bg-blue-500/5 scale-[0.99] shadow-inner' 
              : status === 'error' || status === 'no_data'
              ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
              : status === 'scanned_detected' || status === 'ocr_processing'
              ? 'border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-blue-400/50 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-2xl hover:shadow-blue-500/5'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Subtle noise texture */}
          <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/p6-dark.png')]"></div>

          {/* Active state highlight glow */}
          <div className={`absolute inset-0 bg-gradient-to-br from-blue-500/10 to-emerald-500/10 opacity-0 transition-opacity duration-700 ${isDragging ? 'opacity-100' : ''}`} />

          {/* Icon Container with Deep Shadow */}
          <div className="relative mb-6 sm:mb-10">
              {isProcessing && (
                  <div className="absolute -inset-6 bg-blue-500/20 rounded-full animate-ping opacity-50"></div>
              )}
              <motion.div 
                whileHover={{ rotate: [0, -5, 5, 0], scale: 1.05 }}
                transition={{ scale: { type: 'spring', damping: 10 }, rotate: { duration: 0.5 } }}
                className={`p-6 sm:p-9 rounded-[1.5rem] sm:rounded-[2.5rem] transition-all duration-1000 shadow-2xl relative z-10 ${
                  status === 'error' || status === 'no_data' 
                      ? 'bg-gradient-to-br from-red-100 to-red-50 text-red-500 shadow-red-200/50 dark:from-red-900/20 dark:to-red-900/10 dark:text-red-400' 
                      : status === 'scanned_detected' || status === 'ocr_processing'
                      ? 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 shadow-blue-200/50 dark:from-blue-900/20 dark:to-blue-900/10 dark:text-blue-400'
                      : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xl shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-700/50 ring-offset-8 ring-offset-transparent'
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin" strokeWidth={1} />
                ) : status === 'error' || status === 'no_data' ? (
                  <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16" strokeWidth={1} />
                ) : status === 'scanned_detected' ? (
                  <Scan className="w-12 h-12 sm:w-16 sm:h-16" strokeWidth={1} />
                ) : (
                  <div className="relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16">
                      <FileText className="w-full h-full transform -translate-x-1.5 -translate-y-1.5 group-hover/dropzone:translate-x-0 group-hover/dropzone:translate-y-0 transition-transform duration-700" strokeWidth={1} />
                      <FileSpreadsheet className="w-8 h-8 sm:w-11 sm:h-11 absolute -right-2 -bottom-2 sm:-right-3 sm:-bottom-3 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl text-emerald-500 shadow-2xl transform translate-x-1.5 translate-y-1.5 group-hover/dropzone:translate-x-0 group-hover/dropzone:translate-y-0 transition-transform duration-700 border-2 sm:border-4 border-slate-50 dark:border-slate-900" strokeWidth={1} />
                  </div>
                )}
              </motion.div>
          </div>
          
          <h3 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight drop-shadow-sm text-center">
            {status === 'no_data' ? 'No Items Found' : 'Smart Takeoff Importer'}
          </h3>
          
          <p className="text-slate-500 dark:text-slate-400 text-center mb-8 sm:mb-12 max-w-lg text-lg sm:text-xl font-medium leading-relaxed">
            {status === 'no_data' 
              ? "We couldn't identify any takeoff items. Check the file or your profile settings." 
              : "The definitive solution for timber list conversion. Drop your documents here to begin."}
          </p>

          <div className="flex flex-col md:flex-row gap-6 items-stretch justify-center w-full max-w-2xl relative p-1">
            <div className="w-full md:w-auto z-20 flex flex-col gap-3">
                <ProfileSelector 
                    currentProfile={activeProfile} 
                    onChangeProfile={onProfileChange} 
                    confidence={0} 
                    onManageProfiles={onManageProfiles}
                    onAiGenerateProfile={onAiGenerateProfile}
                    isAiGenerating={isAiGenerating}
                />
                {onAiGenerateProfile && (
                  <motion.button 
                    whileHover={{ scale: 1.02, x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setUseAiOnUpload(!useAiOnUpload)}
                    disabled={isAiGenerating || isProcessing}
                    className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2.5 px-4 py-2 rounded-2xl transition-all shadow-sm ${
                      useAiOnUpload 
                        ? 'bg-blue-600 text-white shadow-blue-500/40 ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-slate-900' 
                        : 'text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    <Sparkles size={14} className={isAiGenerating ? 'animate-spin' : ''} />
                    {useAiOnUpload ? 'Smart Scanner Active' : 'Enable Smart Scanner'}
                  </motion.button>
                )}
            </div>

            <label className="cursor-pointer w-full md:w-auto flex flex-1">
                <input 
                type="file" 
                accept=".pdf,.xlsx,.xls,.csv" 
                multiple
                className="hidden" 
                onChange={handleFileChange} 
                disabled={isProcessing}
                />
                <motion.span 
                  whileHover={{ y: -4, shadow: '0 25px 50px -12px rgba(37,99,235,0.5)' }}
                  whileTap={{ scale: 0.97 }}
                  style={{ 
                    backfaceVisibility: 'hidden',
                    WebkitFontSmoothing: 'subpixel-antialiased',
                    willChange: 'transform, box-shadow',
                    transform: 'translateZ(0)'
                  }}
                  className={`w-full md:w-64 px-12 py-5 rounded-[1.5rem] font-black text-sm tracking-widest transition-all flex items-center justify-center gap-3 shadow-[0_20px_40px_-15px_rgba(37,99,235,0.4)] transform-gpu ${
                    status === 'no_data' 
                    ? 'bg-slate-900 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                  }`}
                >
                  <Upload size={20} strokeWidth={3} />
                  {status === 'no_data' ? 'TRY AGAIN' : 'SELECT FILES'}
                </motion.span>
            </label>
          </div>
        </div>
      </div>
      
      {isProcessing && (
        <div className="mt-12 flex flex-col items-center gap-4 animate-enter">
           <div className="w-full max-w-md h-3 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-200/50 dark:ring-slate-700/50">
               <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"
               />
           </div>
           <div className="flex flex-col items-center gap-1.5">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-black uppercase tracking-[0.2em] animate-pulse">
                    {customMessage || statusMessages[status]}
                </span>
                <span className="text-[11px] text-slate-400 font-mono font-black tracking-tighter">
                    {Math.round(progress)}% PROCESSED
                </span>
           </div>
        </div>
      )}
      
      {status === 'error' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 text-center bg-red-50 dark:bg-red-950/40 p-5 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold border border-red-100 dark:border-red-900/50 shadow-sm"
        >
          An unexpected error occurred. Please verify your file format and try again.
        </motion.div>
      )}
    </motion.div>
  );
};