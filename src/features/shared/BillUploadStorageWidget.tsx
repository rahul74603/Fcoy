// ═══════════════════════════════════════════════════════════
// BILL UPLOAD WIDGET — Firebase Storage Version
// ───────────────────────────────────────────────────────────
// Ye widget bills/receipts ko Firebase Storage mein upload karta hai
// (base64 Firestore ke bajaye). Storage download URL return karta hai.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef } from 'react';
import {
  Upload, X, CheckCircle2, AlertTriangle, Loader2,
  FileText, FileImage, Eye, Trash2, ZoomIn, ZoomOut,
  RotateCw, Download, Maximize2
} from 'lucide-react';
import {
  uploadBillToStorage,
  deleteFromStorage,
  validateFileForStorage,
  formatStorageFileSize,
  type BillStorageData,
} from './storage.utils';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface BillDataStorage {
  billDownloadUrl: string;
  billStoragePath: string;
  billFileName: string;
  billFileType: string;
  billFileSize: number;
}

interface BillUploadStorageWidgetProps {
  /** Current bill data (if already uploaded) */
  currentBill?: BillDataStorage | null;
  /** Called when file is uploaded to Storage */
  onBillReady: (bill: BillDataStorage) => void;
  /** Called when bill is removed */
  onBillRemove?: () => void;
  /** Storage category: 'mess_fund', 'training_fund', etc. */
  storageCategory: string;
  /** Entity ID (expenseId or entryId) */
  entityId: string;
  /** Label text */
  label?: string;
  /** Compact mode for inline forms */
  compact?: boolean;
  /** Disable interactions */
  disabled?: boolean;
}

// ─────────────────────────────────────────────
// PREVIEW MODAL
// ─────────────────────────────────────────────
const BillPreviewModal: React.FC<{
  url: string;
  fileName: string;
  fileType: string;
  onClose: () => void;
}> = ({ url, fileName, fileType, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = !isPdf;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    window.open(url, '_blank');
  };

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.25));
      if (e.key === 'r' || e.key === 'R') setRotation(r => r + 90);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileImage size={16} className="text-blue-400" />
          <p className="text-xs font-black uppercase tracking-wider">
            {fileName || 'Bill Preview'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isImage && (
            <>
              <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} className="p-1.5 hover:bg-white/10 rounded">
                <ZoomOut size={14} />
              </button>
              <span className="text-[10px] font-bold text-slate-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} className="p-1.5 hover:bg-white/10 rounded">
                <ZoomIn size={14} />
              </button>
              <button onClick={() => { setZoom(1); setRotation(0); }} className="p-1.5 hover:bg-white/10 rounded">
                <Maximize2 size={14} />
              </button>
              <button onClick={() => setRotation(r => r + 90)} className="p-1.5 hover:bg-white/10 rounded">
                <RotateCw size={14} />
              </button>
              <div className="w-px h-5 bg-slate-600 mx-1" />
            </>
          )}
          <button onClick={handleDownload} className="p-1.5 hover:bg-white/10 rounded">
            <Download size={14} />
          </button>
          <button onClick={handleOpenNewTab} className="p-1.5 hover:bg-white/10 rounded">
            <Maximize2 size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-500/30 rounded ml-2">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950/50">
        {isPdf ? (
          <iframe src={url} className="w-full h-full max-w-4xl rounded border border-slate-700 bg-white" title="Bill PDF" />
        ) : (
          <img src={url} alt={fileName} className="max-w-full max-h-full rounded shadow-2xl transition-transform duration-200"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} />
        )}
      </div>

      {/* Bottom hints */}
      <div className="bg-slate-900 px-4 py-1.5 flex items-center justify-center gap-4 text-[9px] text-slate-500 flex-shrink-0">
        <span>ESC = Close</span>
        {isImage && <><span>+/- = Zoom</span><span>R = Rotate</span></>}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════
// MAIN WIDGET
// ═════════════════════════════════════════════
export const BillUploadStorageWidget: React.FC<BillUploadStorageWidgetProps> = ({
  currentBill,
  onBillReady,
  onBillRemove,
  storageCategory,
  entityId,
  label = 'Bill Upload',
  compact = false,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const hasBill = !!(currentBill?.billDownloadUrl);
  const isPdf = currentBill?.billFileType === 'application/pdf' ||
                currentBill?.billFileName?.toLowerCase().endsWith('.pdf');

  // ── PROCESS FILE ──
  const processFile = async (file: File) => {
    setError('');

    // Validate
    const validation = validateFileForStorage(file, 'bill');
    if (!validation.valid) {
      setError(validation.error || 'File valid nahi hai');
      return;
    }

    setProcessing(true);
    setProgress(10);

    try {
      setProgress(30);

      // Upload to Firebase Storage
      const result = await uploadBillToStorage(file, storageCategory, entityId);
      setProgress(90);

      setProgress(100);

      // Callback with Storage data
      onBillReady({
        billDownloadUrl: result.billDownloadUrl,
        billStoragePath: result.billStoragePath,
        billFileName: result.billFileName,
        billFileType: result.billFileType,
        billFileSize: result.billFileSize,
      });
    } catch (err) {
      console.error(err);
      setError(`Upload fail: ${String(err)}`);
    } finally {
      setTimeout(() => {
        setProcessing(false);
        setProgress(0);
      }, 500);
    }
  };

  // ── DELETE FROM STORAGE ──
  const handleRemove = async () => {
    if (currentBill?.billStoragePath) {
      try {
        await deleteFromStorage(currentBill.billStoragePath);
      } catch (err) {
        console.warn('Storage delete failed (may already be deleted):', err);
      }
    }
    if (onBillRemove) onBillRemove();
  };

  // ── HANDLERS ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── COMPACT MODE ──
  if (compact) {
    return (
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase block">{label}</label>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange} className="hidden" disabled={disabled} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled || processing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded border transition-colors ${
              processing ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait' :
              hasBill ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
              'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:bg-blue-50'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
            {processing ? <><Loader2 size={11} className="animate-spin" />{progress}%</> :
             hasBill ? <><Upload size={11} /> Re-upload</> :
             <><Upload size={11} /> Upload Bill</>}
          </button>
          {hasBill && currentBill && (
            <>
              <span className="text-[9px] text-green-600 font-bold flex items-center gap-1 truncate max-w-32">
                <CheckCircle2 size={9} />{currentBill.billFileName}
              </span>
              <button type="button" onClick={() => setPreview(true)}
                className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                <Eye size={9} /> View
              </button>
              {onBillRemove && (
                <button type="button" onClick={handleRemove} className="text-red-400 hover:text-red-600 p-0.5">
                  <Trash2 size={11} />
                </button>
              )}
            </>
          )}
        </div>
        {error && (
          <p className="text-[9px] text-red-600 font-semibold flex items-center gap-1">
            <AlertTriangle size={9} /> {error}
          </p>
        )}
        {processing && (
          <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
        {preview && currentBill?.billDownloadUrl && (
          <BillPreviewModal url={currentBill.billDownloadUrl} fileName={currentBill.billFileName}
            fileType={currentBill.billFileType} onClose={() => setPreview(false)} />
        )}
      </div>
    );
  }

  // ── FULL MODE (Drag & Drop) ──
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-slate-500 uppercase block">{label}</label>
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileChange} className="hidden" disabled={disabled} />
      <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        onClick={() => !disabled && !processing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-50' :
          dragOver ? 'bg-blue-50 border-blue-400 scale-[1.01] shadow-lg' :
          hasBill ? 'bg-green-50 border-green-300 hover:border-green-400' :
          'bg-white border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'
        }`}>
        {processing ? (
          <div className="py-2">
            <Loader2 size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
            <p className="text-xs font-bold text-blue-600">Uploading to Storage... {progress}%</p>
            <div className="mt-2 mx-auto max-w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : hasBill && currentBill ? (
          <div className="py-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isPdf ? <FileText size={20} className="text-red-500" /> : <FileImage size={20} className="text-blue-500" />}
              <div className="text-left">
                <p className="text-xs font-black text-slate-800 truncate max-w-48">{currentBill.billFileName}</p>
                <p className="text-[9px] text-slate-400">{formatStorageFileSize(currentBill.billFileSize)} · {isPdf ? 'PDF' : 'Image'}</p>
              </div>
              <CheckCircle2 size={16} className="text-green-500" />
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <button type="button" onClick={e => { e.stopPropagation(); setPreview(true); }}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                <Eye size={11} /> Preview
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                <Upload size={11} /> Replace
              </button>
              {onBillRemove && (
                <button type="button" onClick={e => { e.stopPropagation(); handleRemove(); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100">
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>
          </div>
        ) : dragOver ? (
          <div className="py-4">
            <Upload size={28} className="mx-auto text-blue-500 mb-2" />
            <p className="text-xs font-black text-blue-700">Drop bill file here!</p>
          </div>
        ) : (
          <div className="py-3">
            <Upload size={24} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-500">Click ya drag & drop karo</p>
            <p className="text-[9px] text-slate-400 mt-1">PDF / Images — Max 10MB — Firebase Storage</p>
          </div>
        )}
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
          <p className="text-[10px] text-red-600 font-semibold">{error}</p>
          <button type="button" onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <X size={11} />
          </button>
        </div>
      )}
      {preview && currentBill?.billDownloadUrl && (
        <BillPreviewModal url={currentBill.billDownloadUrl} fileName={currentBill.billFileName}
          fileType={currentBill.billFileType} onClose={() => setPreview(false)} />
      )}
    </div>
  );
};

export default BillUploadStorageWidget;
