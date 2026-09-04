// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\shared\BillUploadWidget.tsx

import React, { useState, useRef } from 'react';
import {
  Upload, X, CheckCircle2, AlertTriangle, Loader2,
  FileText, FileImage, Eye, Trash2, ZoomIn, ZoomOut,
  RotateCw, Download, Maximize2
} from 'lucide-react';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface BillData {
  /** LEGACY — purane records me. Naye bills Storage me jaate hain. */
  billBase64: string;
  billFileName: string;
  billFileType: string;
  billFileSize: number;
  /** Storage download link (naya tarika). */
  billDownloadUrl?: string;
  /** Storage path — delete ke liye. */
  billStoragePath?: string;
}

/** Bill dikhane ke liye source: naya Storage URL, warna purana base64. */
const billSrc = (b?: BillData | null): string =>
  b?.billDownloadUrl || b?.billBase64 || '';

interface BillUploadWidgetProps {
  /** Current bill data (if already uploaded) */
  currentBill?: BillData | null;
  /** Called when file is processed and ready */
  onBillReady: (bill: BillData) => void;
  /** Called when bill is removed */
  onBillRemove?: () => void;
  /** Label text */
  label?: string;
  /** Compact mode for inline forms */
  compact?: boolean;
  /** Disable interactions */
  disabled?: boolean;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const MAX_FILE_SIZE   = 5 * 1024 * 1024;       // 5MB
const MAX_BASE64_SIZE = 800 * 1024;             // 800KB for Firestore

const formatFileSize = (bytes: number) => {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// ─────────────────────────────────────────────
// IMAGE COMPRESSION
// ─────────────────────────────────────────────
const compressImage = (file: File, maxSizeKB = 700): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas not supported');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;
        let base64 = canvas.toDataURL('image/jpeg', quality);
        while (base64.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          base64 = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(base64);
      };
      img.onerror = () => reject('Image load failed');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject('File read failed');
    reader.readAsDataURL(file);
  });

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject('File read failed');
    reader.readAsDataURL(file);
  });

// ─────────────────────────────────────────────
// PREVIEW MODAL
// ─────────────────────────────────────────────
const BillPreviewModal: React.FC<{
  base64: string;
  fileName: string;
  fileType: string;
  onClose: () => void;
}> = ({ base64, fileName, fileType, onClose }) => {
  const [zoom, setZoom]         = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf  = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = !isPdf;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`
        <html><head><title>${fileName}</title></head>
        <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh">
          ${isPdf
            ? `<iframe src="${base64}" style="width:100%;height:100vh;border:none"></iframe>`
            : `<img src="${base64}" style="max-width:100%;max-height:100vh" />`
          }
        </body></html>
      `);
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')             onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-')                  setZoom(z => Math.max(z - 0.25, 0.25));
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
              <button
                onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[10px] font-bold text-slate-300 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => { setZoom(1); setRotation(0); }}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <Maximize2 size={14} />
              </button>
              <button
                onClick={() => setRotation(r => r + 90)}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <RotateCw size={14} />
              </button>
              <div className="w-px h-5 bg-slate-600 mx-1" />
            </>
          )}
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-white/10 rounded"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleOpenNewTab}
            className="p-1.5 hover:bg-white/10 rounded"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-500/30 rounded ml-2"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950/50">
        {isPdf ? (
          <iframe
            src={base64}
            className="w-full h-full max-w-4xl rounded border border-slate-700 bg-white"
            title="Bill PDF"
          />
        ) : (
          <img
            src={base64}
            alt={fileName}
            className="max-w-full max-h-full rounded shadow-2xl transition-transform duration-200"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />
        )}
      </div>

      {/* Bottom hints */}
      <div className="bg-slate-900 px-4 py-1.5 flex items-center justify-center gap-4 text-[9px] text-slate-500 flex-shrink-0">
        <span>ESC = Close</span>
        {isImage && (
          <>
            <span>+/- = Zoom</span>
            <span>R = Rotate</span>
          </>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════
// MAIN WIDGET
// ═════════════════════════════════════════════
export const BillUploadWidget: React.FC<BillUploadWidgetProps> = ({
  currentBill,
  onBillReady,
  onBillRemove,
  label = 'Bill Upload',
  compact = false,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress]     = useState(0);
  const [error, setError]           = useState('');
  const [preview, setPreview]       = useState(false);
  const [dragOver, setDragOver]     = useState(false);

  // Derived
  const hasBill   = !!billSrc(currentBill);
  const isPdf     = currentBill?.billFileType === 'application/pdf' ||
                    currentBill?.billFileName?.toLowerCase().endsWith('.pdf');

  // ── PROCESS FILE ──
  const processFile = async (file: File) => {
    setError('');

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Sirf PDF, JPG, PNG, WEBP allowed hai');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File ${formatFileSize(file.size)} hai. Max 5MB allowed.`);
      return;
    }

    setProcessing(true);
    setProgress(10);

    try {
      let base64: string;

      if (file.type === 'application/pdf') {
        setProgress(30);
        // PDF size check
        if (file.size > MAX_BASE64_SIZE) {
          setError(`PDF ${formatFileSize(file.size)} hai. Max 800KB allowed. Chhoti PDF use karo.`);
          setProcessing(false);
          return;
        }
        base64 = await fileToBase64(file);
        setProgress(80);
      } else {
        // Image — compress
        setProgress(40);
        base64 = await compressImage(file, 700);
        setProgress(80);
      }

      // Final size check
      const base64SizeBytes = Math.round((base64.length * 3) / 4);
      if (base64SizeBytes > MAX_BASE64_SIZE) {
        setError(
          `Compress ke baad bhi ${formatFileSize(base64SizeBytes)} hai. Aur chhoti file dein.`
        );
        setProcessing(false);
        return;
      }

      setProgress(100);

      // Callback
      onBillReady({
        billBase64:   base64,
        billFileName: file.name,
        billFileType: file.type,
        billFileSize: file.size,
      });
    } catch (err) {
      console.error(err);
      setError(`File process nahi hua: ${String(err)}`);
    } finally {
      setTimeout(() => {
        setProcessing(false);
        setProgress(0);
      }, 500);
    }
  };

  // ── HANDLERS ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be selected again
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

  const handleRemove = () => {
    if (onBillRemove) onBillRemove();
  };

  // ── COMPACT MODE ──
  if (compact) {
    return (
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase block">
          {label}
        </label>

        <div className="flex items-center gap-2">
          {/* Hidden input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />

          {/* Upload / Re-upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || processing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded border transition-colors ${
              processing
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait'
                : hasBill
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:bg-blue-50'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {processing ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                {progress}%
              </>
            ) : hasBill ? (
              <>
                <Upload size={11} /> Re-upload
              </>
            ) : (
              <>
                <Upload size={11} /> Upload Bill
              </>
            )}
          </button>

          {/* File info */}
          {hasBill && currentBill && (
            <>
              <span className="text-[9px] text-green-600 font-bold flex items-center gap-1 truncate max-w-32">
                <CheckCircle2 size={9} />
                {currentBill.billFileName}
              </span>

              {/* Preview */}
              <button
                type="button"
                onClick={() => setPreview(true)}
                className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
              >
                <Eye size={9} /> View
              </button>

              {/* Remove */}
              {onBillRemove && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-red-400 hover:text-red-600 p-0.5"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-[9px] text-red-600 font-semibold flex items-center gap-1">
            <AlertTriangle size={9} /> {error}
          </p>
        )}

        {/* Progress bar */}
        {processing && (
          <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Preview Modal */}
        {preview && billSrc(currentBill) && currentBill && (
          <BillPreviewModal
            base64={billSrc(currentBill)}
            fileName={currentBill.billFileName}
            fileType={currentBill.billFileType}
            onClose={() => setPreview(false)}
          />
        )}
      </div>
    );
  }

  // ── FULL MODE (Drag & Drop) ──
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-slate-500 uppercase block">
        {label}
      </label>

      {/* Hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !processing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          disabled
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
            : dragOver
            ? 'bg-blue-50 border-blue-400 scale-[1.01] shadow-lg'
            : hasBill
            ? 'bg-green-50 border-green-300 hover:border-green-400'
            : 'bg-white border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'
        }`}
      >
        {processing ? (
          <div className="py-2">
            <Loader2 size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
            <p className="text-xs font-bold text-blue-600">Processing... {progress}%</p>
            <div className="mt-2 mx-auto max-w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : hasBill && currentBill ? (
          <div className="py-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isPdf ? (
                <FileText size={20} className="text-red-500" />
              ) : (
                <FileImage size={20} className="text-blue-500" />
              )}
              <div className="text-left">
                <p className="text-xs font-black text-slate-800 truncate max-w-48">
                  {currentBill.billFileName}
                </p>
                <p className="text-[9px] text-slate-400">
                  {formatFileSize(currentBill.billFileSize)} ·{' '}
                  {isPdf ? 'PDF' : 'Image'}
                </p>
              </div>
              <CheckCircle2 size={16} className="text-green-500" />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setPreview(true);
                }}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
              >
                <Eye size={11} /> Preview
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              >
                <Upload size={11} /> Replace
              </button>
              {onBillRemove && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                >
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
            <p className="text-xs font-bold text-slate-500">
              Click ya drag & drop karo
            </p>
            <p className="text-[9px] text-slate-400 mt-1">
              PDF (max 800KB) · Images JPG/PNG/WEBP (auto-compress ~700KB)
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
          <p className="text-[10px] text-red-600 font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {preview && billSrc(currentBill) && currentBill && (
        <BillPreviewModal
          base64={billSrc(currentBill)}
          fileName={currentBill.billFileName}
          fileType={currentBill.billFileType}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
};

export default BillUploadWidget;