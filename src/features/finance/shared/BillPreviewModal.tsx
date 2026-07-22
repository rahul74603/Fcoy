import React, { useEffect, useState } from 'react';
import {
  X, Download, ZoomIn, ZoomOut, RotateCw, FileImage
} from 'lucide-react';
import type { BillAttachment } from '../vendors/types';

const BillPreviewModal: React.FC<{
  bill: BillAttachment;
  onClose: () => void;
}> = ({ bill, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const isPdf = bill.fileType === 'application/pdf';

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.25));
      if (e.key === 'r' || e.key === 'R') setRotation(r => r + 90);
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = bill.base64;
    link.download = bill.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col">
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileImage size={15} className="text-blue-400" />
          <p className="text-xs font-black truncate max-w-64">{bill.fileName}</p>
        </div>

        <div className="flex items-center gap-1">
          {!isPdf && (
            <>
              <button
                onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <ZoomOut size={13} />
              </button>

              <span className="text-[10px] font-bold text-slate-300 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>

              <button
                onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <ZoomIn size={13} />
              </button>

              <button
                onClick={() => setRotation(r => r + 90)}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <RotateCw size={13} />
              </button>

              <div className="w-px h-5 bg-slate-600 mx-1" />
            </>
          )}

          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-white/10 rounded"
          >
            <Download size={13} />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-500/30 rounded ml-2"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950/50">
        {isPdf ? (
          <iframe
            src={bill.base64}
            className="w-full h-full max-w-4xl rounded bg-white"
            title="Bill"
          />
        ) : (
          <img
            src={bill.base64}
            alt={bill.fileName}
            className="max-w-full max-h-full rounded shadow-2xl transition-transform duration-200"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />
        )}
      </div>

      <div className="bg-slate-900 px-4 py-1.5 flex items-center justify-center gap-4 text-[9px] text-slate-500">
        <span>ESC = Close</span>
        {!isPdf && (
          <>
            <span>+/- = Zoom</span>
            <span>R = Rotate</span>
          </>
        )}
      </div>
    </div>
  );
};

export default BillPreviewModal;