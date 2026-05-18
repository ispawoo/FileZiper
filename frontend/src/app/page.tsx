'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderArchive, 
  UploadCloud, 
  FileText, 
  Trash2, 
  CheckCircle, 
  History, 
  Settings, 
  ShieldCheck, 
  Download, 
  Copy, 
  FileCode, 
  FileAudio, 
  FileVideo, 
  FileImage, 
  FileText as FileIcon, 
  AlertCircle, 
  Clock,
  Sparkles,
  Database,
  ArrowRight,
  RefreshCw,
  Github
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTelegram } from '../hooks/useTelegram';
import { uploadFiles, getJobStatus, getHistory, JobStatusResponse, HistoryResponse } from '../services/api';

type Tab = 'home' | 'upload' | 'progress' | 'download' | 'history' | 'settings' | 'privacy' | 'error';

export default function FileZiperApp() {
  const { user, getAuthHeader, triggerHaptic, showAlert } = useTelegram();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [files, setFiles] = useState<File[]>([]);
  const [zipName, setZipName] = useState<string>('');
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // Job and polling states
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [compressionProgress, setCompressionProgress] = useState<number>(0);
  const [finalZipName, setFinalZipName] = useState<string>('');
  const [finalZipSize, setFinalZipSize] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [jobExpiresAt, setJobExpiresAt] = useState<string>('');
  
  // History states
  const [historyJobs, setHistoryJobs] = useState<HistoryResponse['jobs']>([]);
  const [historyMetrics, setHistoryMetrics] = useState({ totalJobs: 0, totalFilesCompressed: 0, totalStorageUsed: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // General states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stop polling when component unmounts
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Format file size
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Get matching icon for file types
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FileImage className="w-8 h-8 text-cyan-400" />;
    if (mimeType.startsWith('video/')) return <FileVideo className="w-8 h-8 text-rose-400" />;
    if (mimeType.startsWith('audio/')) return <FileAudio className="w-8 h-8 text-emerald-400" />;
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document')) {
      return <FileIcon className="w-8 h-8 text-amber-400" />;
    }
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css')) {
      return <FileCode className="w-8 h-8 text-purple-400" />;
    }
    return <FileText className="w-8 h-8 text-gray-400" />;
  };

  // File Upload Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    // 50MB size limit per file, maximum 20 files
    const totalFiles = [...files, ...newFiles];
    if (totalFiles.length > 20) {
      triggerHaptic('error');
      showAlert('You can upload a maximum of 20 files per ZIP archive.');
      return;
    }

    const exceedingFile = newFiles.find(f => f.size > 50 * 1024 * 1024);
    if (exceedingFile) {
      triggerHaptic('error');
      showAlert(`File "${exceedingFile.name}" exceeds the 50MB maximum size limit.`);
      return;
    }

    setFiles(totalFiles);
    triggerHaptic('success');
  };

  const removeFile = (index: number) => {
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    setFiles(updatedFiles);
    triggerHaptic('warning');
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Compression & Upload execution
  const startCompression = async () => {
    if (files.length === 0) return;

    triggerHaptic('medium');
    setActiveTab('progress');
    setUploadProgress(0);
    setCompressionProgress(0);
    setJobStatus('uploading');

    try {
      const authHeader = getAuthHeader();
      const response = await uploadFiles(files, zipName, authHeader, (percentage) => {
        setUploadProgress(percentage);
        if (percentage === 100) {
          setJobStatus('compressing');
        }
      });

      if (response.success && response.jobId) {
        startPollingJobStatus(response.jobId);
      } else {
        throw new Error('Upload succeeded but server did not return a Job ID.');
      }

    } catch (err) {
      triggerHaptic('error');
      const errorMsg = err instanceof Error ? err.message : 'An error occurred during file upload.';
      setErrorMessage(errorMsg);
      setActiveTab('error');
    }
  };

  // Polling Job Status
  const startPollingJobStatus = (id: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    const authHeader = getAuthHeader();
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response: JobStatusResponse = await getJobStatus(id, authHeader);
        const job = response.job;

        setJobStatus(job.status);
        setCompressionProgress(job.compression_percentage);
        setFinalZipName(job.zip_name);
        setFinalZipSize(job.zip_size || 0);
        setJobExpiresAt(job.expires_at);

        if (job.status === 'completed') {
          clearInterval(pollingIntervalRef.current!);
          setDownloadUrl(job.download_url || null);
          setActiveTab('download');
          triggerHaptic('success');
          
          // Confetti explosion!
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#24a1de', '#00cbd6', '#ffffff']
          });

          // Reset upload files state
          setFiles([]);
          setZipName('');
        } else if (job.status === 'failed') {
          clearInterval(pollingIntervalRef.current!);
          setErrorMessage(job.error_message || 'An error occurred inside the compression engine.');
          setActiveTab('error');
          triggerHaptic('error');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500); // Poll every 1.5 seconds
  };

  // Fetch History & Metrics
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const authHeader = getAuthHeader();
      const response = await getHistory(authHeader);
      setHistoryJobs(response.jobs);
      setHistoryMetrics(response.metrics);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      const timer = setTimeout(() => {
        fetchHistory();
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Copy zip link
  const copyLink = () => {
    if (!downloadUrl) return;
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    triggerHaptic('success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 pb-20 pt-6">
      
      {/* Header Bar */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-gradient-to-tr from-tg-blue to-tg-cyan rounded-xl shadow-lg animate-float">
            <FolderArchive className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl leading-none text-transparent bg-clip-text bg-gradient-to-r from-white to-tg-cyan">
              FileZiper
            </h1>
            <span className="text-[10px] text-tg-muted uppercase tracking-widest font-semibold">Premium Compressor</span>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2 bg-glass-card/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
            {user.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={user.photo_url} 
              alt={user.first_name} 
              className="w-6 h-6 rounded-full border border-tg-cyan/40"
            />
          ) : (
              <div className="w-6 h-6 rounded-full bg-tg-blue/40 flex items-center justify-center font-bold text-xs border border-tg-blue/40">
                {user.first_name[0]}
              </div>
            )}
            <span className="text-xs font-semibold text-white/90 max-w-[80px] truncate">
              {user.first_name}
            </span>
          </div>
        )}
      </header>

      {/* Main Pages Content Area */}
      <div className="flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          
          {/* HOME TAB */}
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6"
            >
              {/* Hero Banner Card */}
              <div className="glass-panel rounded-3xl p-6 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-tg-blue/10 blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-tg-cyan/10 blur-3xl rounded-full" />
                
                <div className="relative z-10 flex flex-col gap-3">
                  <div className="inline-flex items-center gap-1.5 bg-tg-blue/20 text-tg-cyan font-bold text-xs px-3 py-1 rounded-full w-max border border-tg-blue/30">
                    <Sparkles className="w-3.5 h-3.5" /> High Compression Engine
                  </div>
                  <h2 className="text-2xl font-black text-white leading-tight">
                    Pack multiple files of any type into <span className="text-transparent bg-clip-text bg-gradient-to-r from-tg-blue to-tg-cyan">One Secure ZIP</span>
                  </h2>
                  <p className="text-sm text-tg-muted leading-relaxed">
                    Convert apks, images, videos, audio, code files, and documents in seconds. Receive download link + file directly in chat.
                  </p>
                  
                  <button
                    onClick={() => { triggerHaptic('medium'); setActiveTab('upload'); }}
                    className="mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-tg-blue to-tg-cyan text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-xl shadow-tg-blue/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Start Zipping Now <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Supported Badge Card */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-xs font-bold text-tg-muted uppercase tracking-wider">Formats Supported</span>
                <div className="flex flex-wrap gap-2">
                  {['.zip', '.apk', '.jpg/.png', '.mp4', '.pdf', '.docx', '.mp3', '.json', '.code'].map((f) => (
                    <span key={f} className="text-xs bg-tg-bg px-2.5 py-1 rounded-lg border border-tg-border text-white/90">
                      {f}
                    </span>
                  ))}
                  <span className="text-xs text-tg-cyan font-semibold flex items-center gap-1">
                    and any other binary file!
                  </span>
                </div>
              </div>

              {/* Security Banner */}
              <div className="glass-panel rounded-2xl p-4 flex gap-3 items-center border-l-4 border-l-tg-cyan">
                <ShieldCheck className="w-8 h-8 text-tg-cyan shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">Privacy Guarantee</h4>
                  <p className="text-[11px] text-tg-muted">
                    Files are transferred securely and fully deleted from servers after 1 hour. No permanent storage or trackers.
                  </p>
                </div>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div 
                  onClick={() => setActiveTab('history')}
                  className="glass-panel rounded-2xl p-4 flex flex-col gap-2 cursor-pointer glass-panel-hover"
                >
                  <History className="w-6 h-6 text-tg-blue" />
                  <span className="text-sm font-bold text-white">History & Stats</span>
                  <p className="text-[10px] text-tg-muted">Track your recent zip files and storage details</p>
                </div>
                <div 
                  onClick={() => setActiveTab('privacy')}
                  className="glass-panel rounded-2xl p-4 flex flex-col gap-2 cursor-pointer glass-panel-hover"
                >
                  <ShieldCheck className="w-6 h-6 text-tg-cyan" />
                  <span className="text-sm font-bold text-white">Privacy Policy</span>
                  <p className="text-[10px] text-tg-muted">Learn about files automatic cleanup</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* UPLOAD TAB */}
          {activeTab === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-5"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white">Select Files to Zip</h2>
                <button
                  onClick={() => { triggerHaptic('warning'); setFiles([]); }}
                  className="text-xs text-rose-400 font-bold hover:underline"
                >
                  Clear All
                </button>
              </div>

              {/* Drag and Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerUpload}
                className={`glass-panel border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center gap-3 ${
                  isDragActive ? 'border-tg-cyan bg-tg-cyan/5 scale-[0.99]' : 'border-tg-border hover:border-tg-blue/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
                
                <div className="p-4 bg-tg-bg rounded-full border border-tg-border relative">
                  <UploadCloud className="w-8 h-8 text-tg-cyan" />
                  {files.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-tg-blue text-white font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-tg-bg">
                      {files.length}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-extrabold text-sm text-white">Drag & drop files here</h3>
                  <p className="text-xs text-tg-muted mt-1">or tap to select from device</p>
                </div>
                
                <span className="text-[10px] text-tg-muted">Max 20 files • Up to 50MB per file</span>
              </div>

              {/* Custom Zip Name Input */}
              {files.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-tg-muted uppercase tracking-wider">Output ZIP name</label>
                  <input
                    type="text"
                    placeholder="e.g. holiday-photos"
                    value={zipName}
                    onChange={(e) => setZipName(e.target.value)}
                    className="glass-input px-4 py-3 rounded-2xl w-full text-sm font-semibold"
                  />
                </div>
              )}

              {/* Upload List */}
              {files.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-tg-muted uppercase tracking-wider">
                      Selected Files ({files.length})
                    </span>
                    <span className="text-xs font-bold text-white">
                      Total: {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto flex flex-col gap-2 pr-1">
                    {files.map((file, index) => (
                      <div 
                        key={index} 
                        className="glass-panel px-3 py-2 rounded-xl flex justify-between items-center gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getFileIcon(file.type)}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate max-w-[160px]">{file.name}</h4>
                            <span className="text-[10px] text-tg-muted">{formatBytes(file.size)}</span>
                          </div>
                        </div>

                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                          className="p-1.5 text-tg-muted hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={startCompression}
                    className="mt-2 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-tg-blue to-tg-cyan text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-xl shadow-tg-blue/20 hover:scale-[1.01] active:scale-95 transition-all"
                  >
                    Compress Now ({files.length} Files) <FolderArchive className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* COMPRESSION PROGRESS TAB */}
          {activeTab === 'progress' && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel rounded-3xl p-6 flex flex-col items-center gap-6 shadow-2xl relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-tg-blue/5 blur-2xl rounded-full" />
              
              <div className="relative flex items-center justify-center">
                {/* Loader Pulse Rings */}
                <div className="w-24 h-24 rounded-full bg-tg-blue/10 animate-ping absolute" />
                <div className="w-24 h-24 rounded-full border border-tg-cyan/20 animate-spin absolute" style={{ animationDuration: '6s' }} />
                
                <div className="w-20 h-20 rounded-full bg-glass-card border border-tg-border flex items-center justify-center relative z-10">
                  <FolderArchive className="w-10 h-10 text-tg-cyan animate-pulse" />
                </div>
              </div>

              <div className="text-center">
                <h3 className="font-extrabold text-lg text-white">
                  {jobStatus === 'uploading' ? 'Uploading Files...' : 'Compressing Archive...'}
                </h3>
                <p className="text-xs text-tg-muted mt-1 leading-relaxed">
                  {jobStatus === 'uploading' 
                    ? `Sending files safely to compression server. Please keep this screen open.` 
                    : `Zipping your files using Archiver. This will take a few seconds.`
                  }
                </p>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-tg-muted">
                    {jobStatus === 'uploading' ? `Uploading` : `Zipping Process`}
                  </span>
                  <span className="text-tg-cyan">
                    {jobStatus === 'uploading' ? `${uploadProgress}%` : `${compressionProgress}%`}
                  </span>
                </div>
                
                {/* Progress bar background */}
                <div className="w-full h-3 bg-tg-bg rounded-full border border-tg-border overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-tg-blue to-tg-cyan"
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: jobStatus === 'uploading' ? `${uploadProgress}%` : `${compressionProgress}%` 
                    }}
                    transition={{ ease: 'easeInOut' }}
                  />
                </div>

                {jobStatus === 'compressing' && (
                  <span className="text-[10px] text-tg-muted text-center animate-pulse-slow">
                    🤖 Real-time compression polled from Express server.
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* COMPRESSION DOWNLOAD TAB */}
          {activeTab === 'download' && (
            <motion.div
              key="download"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-5"
            >
              <div className="glass-panel rounded-3xl p-6 flex flex-col items-center gap-4 text-center shadow-2xl relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>

                <div>
                  <h3 className="font-extrabold text-lg text-white">ZIP Generated Successfully!</h3>
                  <p className="text-xs text-tg-muted mt-1 leading-relaxed">
                    Compression complete. We saved you substantial size in bytes!
                  </p>
                </div>

                {/* ZIP Detail Box */}
                <div className="w-full bg-tg-bg rounded-2xl border border-tg-border p-4 mt-2 flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-tg-muted">Archive File:</span>
                    <span className="font-bold text-white truncate max-w-[180px]">{finalZipName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-tg-muted">Zip Size:</span>
                    <span className="font-bold text-tg-cyan">{formatBytes(finalZipSize)}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-tg-border/50 pt-2">
                    <span className="text-tg-muted flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Expiry:
                    </span>
                    <span className="font-semibold text-amber-400">
                      In 1 hour ({new Date(jobExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  </div>
                </div>

                {/* Action download button */}
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={finalZipName}
                    onClick={() => triggerHaptic('success')}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-tg-blue to-tg-cyan text-white font-extrabold px-6 py-4 rounded-2xl shadow-xl shadow-tg-blue/20 hover:scale-[1.01] active:scale-95 transition-all text-sm"
                  >
                    Download ZIP Instantly <Download className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Bot chat notice */}
              <div className="glass-panel rounded-2xl p-4 flex gap-3 items-center">
                <div className="p-2 bg-tg-blue/20 rounded-xl">
                  <FolderArchive className="w-6 h-6 text-tg-blue" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white">Sent directly to Chat!</h4>
                  <p className="text-[10px] text-tg-muted leading-normal">
                    Check your Telegram chat logs. We have sent the ZIP binary file directly to your private thread with the bot!
                  </p>
                </div>
              </div>

              {/* Share & Copy link panel */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-tg-muted uppercase tracking-wider">Share ZIP Link</span>
                  {copied && <span className="text-xs text-tg-cyan font-bold">Copied!</span>}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={downloadUrl || 'Loading secure link...'}
                    className="glass-input px-3.5 py-2.5 rounded-xl text-xs text-tg-muted select-all truncate flex-1 min-w-0"
                  />
                  <button
                    onClick={copyLink}
                    className="p-2.5 bg-tg-blue text-white rounded-xl hover:bg-tg-blue/80 active:scale-95 transition-all shrink-0"
                    title="Copy Link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => { triggerHaptic('medium'); setActiveTab('upload'); }}
                className="w-full text-center text-xs font-bold text-tg-cyan hover:underline"
              >
                ← Upload More Files
              </button>
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-5"
            >
              <h2 className="text-lg font-black text-white">Dashboard & History</h2>

              {/* Metrics Panels */}
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-panel rounded-2xl p-3 text-center flex flex-col gap-0.5 shadow-lg">
                  <FolderArchive className="w-4.5 h-4.5 text-tg-blue mx-auto mb-1" />
                  <span className="text-[9px] font-bold text-tg-muted uppercase tracking-wide">Total ZIPs</span>
                  <span className="text-base font-black text-white">{historyMetrics.totalJobs}</span>
                </div>
                <div className="glass-panel rounded-2xl p-3 text-center flex flex-col gap-0.5 shadow-lg">
                  <FileText className="w-4.5 h-4.5 text-tg-cyan mx-auto mb-1" />
                  <span className="text-[9px] font-bold text-tg-muted uppercase tracking-wide">Files Packaged</span>
                  <span className="text-base font-black text-white">{historyMetrics.totalFilesCompressed}</span>
                </div>
                <div className="glass-panel rounded-2xl p-3 text-center flex flex-col gap-0.5 shadow-lg">
                  <Database className="w-4.5 h-4.5 text-purple-400 mx-auto mb-1" />
                  <span className="text-[9px] font-bold text-tg-muted uppercase tracking-wide">Saved Storage</span>
                  <span className="text-base font-black text-white text-ellipsis overflow-hidden truncate">
                    {formatBytes(historyMetrics.totalStorageUsed, 1)}
                  </span>
                </div>
              </div>

              {/* History List */}
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-tg-muted uppercase tracking-wider">Recent Compression Jobs</span>
                  <button 
                    onClick={() => { triggerHaptic('medium'); fetchHistory(); }}
                    className="text-tg-cyan hover:underline p-1 text-xs font-bold flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>

                {isLoadingHistory ? (
                  // Skelton loading state
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="shimmer h-16 rounded-xl w-full" />
                    ))}
                  </div>
                ) : historyJobs.length === 0 ? (
                  <div className="glass-panel rounded-2xl p-8 text-center flex flex-col items-center gap-2 border border-dashed border-tg-border">
                    <History className="w-8 h-8 text-tg-muted" />
                    <h3 className="font-extrabold text-sm text-white">No history yet</h3>
                    <p className="text-xs text-tg-muted leading-relaxed">
                      Your compression history is empty. Select files to generate a ZIP!
                    </p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto flex flex-col gap-2 pr-1">
                    {historyJobs.map((job) => (
                      <div 
                        key={job.id} 
                        className="glass-panel px-4 py-3 rounded-xl flex justify-between items-center gap-3 relative overflow-hidden"
                      >
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <h4 className="text-xs font-extrabold text-white truncate max-w-[180px]">{job.zip_name}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-tg-muted">
                            <span>{formatBytes(job.zip_size || 0)}</span>
                            <span>•</span>
                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Status badges */}
                        {job.status === 'completed' && job.download_url ? (
                          <a
                            href={job.download_url}
                            className="bg-tg-blue/20 text-tg-cyan border border-tg-blue/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-tg-blue/30 active:scale-95 transition-all shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        ) : job.status === 'expired' || !job.download_url ? (
                          <span className="bg-white/5 border border-white/5 text-tg-muted px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase shrink-0 tracking-wider">
                            Expired
                          </span>
                        ) : job.status === 'failed' ? (
                          <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase shrink-0 tracking-wider">
                            Failed
                          </span>
                        ) : (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase shrink-0 tracking-wider animate-pulse">
                            Processing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-5"
            >
              <h2 className="text-lg font-black text-white">App Settings</h2>

              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4">
                
                {/* System details */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-tg-muted font-semibold">Service Version</span>
                  <span className="text-white font-bold">1.0.0 (Production)</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-tg-border/50 pt-3">
                  <span className="text-tg-muted font-semibold">Clean-up Interval</span>
                  <span className="text-tg-cyan font-bold">1 Hour Expiry</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-tg-border/50 pt-3">
                  <span className="text-tg-muted font-semibold">Max Upload Size</span>
                  <span className="text-white font-bold">50MB / file</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-tg-border/50 pt-3">
                  <span className="text-tg-muted font-semibold">Server State</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" /> Online
                  </span>
                </div>
              </div>

              {/* Credits Section */}
              <div className="glass-panel rounded-2xl p-5 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-tg-blue/10 border border-tg-blue/20 rounded-full flex items-center justify-center">
                  <Github className="w-6 h-6 text-tg-blue" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Developer Credit</h3>
                  <p className="text-xs text-tg-muted mt-0.5 leading-relaxed">
                    Designed and engineered by Yasir Ispawoo
                  </p>
                </div>
                <a
                  href="https://github.com/ispawoo"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => triggerHaptic('success')}
                  className="bg-tg-bg border border-tg-border px-4 py-2 rounded-xl text-xs text-white/90 font-bold hover:bg-tg-border/40 active:scale-95 transition-all inline-flex items-center gap-1.5"
                >
                  Visit Github Repository
                </a>
              </div>
            </motion.div>
          )}

          {/* PRIVACY POLICY TAB */}
          {activeTab === 'privacy' && (
            <motion.div
              key="privacy"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-4 text-sm"
            >
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-lg font-black text-white">Privacy Policy</h2>
                <button
                  onClick={() => setActiveTab('home')}
                  className="text-xs text-tg-cyan font-bold hover:underline"
                >
                  Back to Home
                </button>
              </div>

              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4 leading-relaxed text-xs">
                <div>
                  <h3 className="font-extrabold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-tg-cyan" /> 1-Hour Automatic Cleanup
                  </h3>
                  <p className="text-tg-muted">
                    We maintain absolute privacy. Every file you upload and every ZIP generated is permanently and automatically deleted from our Supabase secure bucket after exactly **1 hour** of creation.
                  </p>
                </div>

                <div className="border-t border-tg-border/50 pt-4">
                  <h3 className="font-extrabold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-tg-cyan" /> End-to-End Encryption
                  </h3>
                  <p className="text-tg-muted">
                    All file transfers to the Express backend and from our Supabase secure storage are fully encrypted using military-grade SSL/TLS connections, preventing data sniffing.
                  </p>
                </div>

                <div className="border-t border-tg-border/50 pt-4">
                  <h3 className="font-extrabold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-tg-cyan" /> No Long-Term Logs
                  </h3>
                  <p className="text-tg-muted">
                    We do not keep traffic logs, tracking information, or metadata relating to the content of your archives. We only utilize Telegram secure authentication sessions to maintain your personal dashboard history.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ERROR TAB */}
          {activeTab === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel rounded-3xl p-6 flex flex-col items-center gap-4 text-center shadow-2xl relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full" />
              
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-rose-400" />
              </div>

              <div>
                <h3 className="font-extrabold text-lg text-white">Compression Error</h3>
                <p className="text-xs text-tg-muted mt-2 leading-relaxed">
                  {errorMessage || 'An unexpected error occurred during the zip creation process. Please try again.'}
                </p>
              </div>

              <div className="w-full flex gap-3 mt-2">
                <button
                  onClick={() => { triggerHaptic('medium'); setActiveTab('upload'); }}
                  className="flex-1 bg-glass-card border border-tg-border text-white font-bold py-3 rounded-xl text-xs hover:bg-tg-border/30 active:scale-95 transition-all"
                >
                  Back to Upload
                </button>
                <button
                  onClick={() => { triggerHaptic('medium'); startCompression(); }}
                  className="flex-1 bg-gradient-to-r from-tg-blue to-tg-cyan text-white font-bold py-3 rounded-xl text-xs hover:scale-[1.01] active:scale-95 transition-all"
                >
                  Retry Job
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Premium Native Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-tg-header/90 backdrop-blur-md border-t border-tg-border px-6 py-2.5 flex justify-between items-center z-50 rounded-t-3xl shadow-2xl">
        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('home'); }}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'home' || activeTab === 'privacy' ? 'text-tg-blue scale-105' : 'text-tg-muted hover:text-white'
          }`}
        >
          <FolderArchive className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>

        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('upload'); }}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'upload' || activeTab === 'progress' ? 'text-tg-blue scale-105' : 'text-tg-muted hover:text-white'
          }`}
        >
          <UploadCloud className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
        </button>

        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('history'); }}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'history' ? 'text-tg-blue scale-105' : 'text-tg-muted hover:text-white'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
        </button>

        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('settings'); }}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'settings' ? 'text-tg-blue scale-105' : 'text-tg-muted hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
        </button>
      </nav>

      {/* Credit Footer */}
      <footer className="mt-8 text-center text-[10px] text-tg-muted leading-loose pb-6">
        <p>FileZiper Bot Version 1.0.0 • Secure Compression</p>
        <p>
          Built by{' '}
          <a
            href="https://github.com/ispawoo"
            target="_blank"
            rel="noreferrer"
            className="text-tg-cyan hover:underline font-bold"
          >
            Yasir Ispawoo
          </a>
        </p>
      </footer>
    </div>
  );
}
