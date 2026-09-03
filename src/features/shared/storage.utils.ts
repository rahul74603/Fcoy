// ═══════════════════════════════════════════════════════════
// SHARED STORAGE UTILITIES — Firebase Storage helpers
// ───────────────────────────────────────────────────────────
// Ye file sab screens ke liye common upload/download/delete
// functions provide karti hai. Base64 ko Firebase Storage mein
// move karne ke liye banayi gayi hai.
// ═══════════════════════════════════════════════════════════

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../../config/firebase';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface StorageUploadResult {
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface BillStorageData {
  billDownloadUrl: string;
  billStoragePath: string;
  billFileName: string;
  billFileType: string;
  billFileSize: number;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
export const STORAGE_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const STORAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const PHOTO_MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
export const PHOTO_ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

// ─────────────────────────────────────────────
// IMAGE COMPRESSION (for photos before upload)
// ─────────────────────────────────────────────
export const compressImageForStorage = (
  file: File,
  maxW = 800,
  maxH = 1000,
  quality = 0.85
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width: w, height: h } = img;
        if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
        if (h > maxH) { w = Math.round((w * maxH) / h); h = maxH; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas error')); return; }
        ctx.fillStyle = '#FFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Compression failed'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
    };
    reader.onerror = () => reject(new Error('File read failed'));
  });

// ─────────────────────────────────────────────
// UPLOAD — Generic file to Storage
// ─────────────────────────────────────────────
export const uploadToStorage = async (
  file: File | Blob,
  storagePath: string,
  metadata?: { contentType?: string }
): Promise<StorageUploadResult> => {
  const storageRef = ref(storage, storagePath);
  const uploadMeta: Record<string, string> = {};
  if (metadata?.contentType) uploadMeta.contentType = metadata.contentType;

  await uploadBytes(storageRef, file, uploadMeta);
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    downloadUrl,
    storagePath,
    fileName: file instanceof File ? file.name : 'blob',
    fileSize: file.size,
    fileType: file instanceof File ? file.type : (metadata?.contentType || 'application/octet-stream'),
  };
};

// ─────────────────────────────────────────────
// UPLOAD — Trainee Photo
// ─────────────────────────────────────────────
export const uploadTraineePhoto = async (
  file: File,
  regNo: string
): Promise<StorageUploadResult> => {
  // Validate
  if (!PHOTO_ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Sirf JPG, PNG ya WEBP allowed hai');
  }
  if (file.size > PHOTO_MAX_FILE_SIZE) {
    throw new Error('File 15MB se badi hai');
  }

  // Compress
  const compressed = await compressImageForStorage(file);

  // Upload path: trainees/{regNo}/profile/{timestamp}_{filename}
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `trainees/${regNo}/profile/${timestamp}_${safeName}`;

  return uploadToStorage(compressed, path, { contentType: 'image/jpeg' });
};

// ─────────────────────────────────────────────
// UPLOAD — Bill/Receipt
// ─────────────────────────────────────────────
export const uploadBillToStorage = async (
  file: File,
  category: string, // 'mess_fund', 'training_fund', 'general_fund', 'company_assets', 'vendors'
  entityId: string  // expenseId or entryId
): Promise<BillStorageData> => {
  // Validate
  if (!STORAGE_ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Sirf PDF, JPG, PNG, WEBP allowed hai');
  }
  if (file.size > STORAGE_MAX_FILE_SIZE) {
    throw new Error('File 10MB se badi hai');
  }

  // Upload path: bills/{category}/{entityId}/{timestamp}_{filename}
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `bills/${category}/${entityId}/${timestamp}_${safeName}`;

  const result = await uploadToStorage(file, path, { contentType: file.type });

  return {
    billDownloadUrl: result.downloadUrl,
    billStoragePath: result.storagePath,
    billFileName: result.fileName,
    billFileType: result.fileType,
    billFileSize: result.fileSize,
  };
};

// ─────────────────────────────────────────────
// DELETE — Remove file from Storage
// ─────────────────────────────────────────────
export const deleteFromStorage = async (storagePath: string): Promise<void> => {
  if (!storagePath) return;
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (err: any) {
    // Ignore "object not found" errors (already deleted)
    if (err?.code === 'storage/object-not-found') return;
    throw err;
  }
};

// ─────────────────────────────────────────────
// GET DOWNLOAD URL — For existing Storage files
// ─────────────────────────────────────────────
export const getStorageDownloadUrl = async (storagePath: string): Promise<string> => {
  const storageRef = ref(storage, storagePath);
  return getDownloadURL(storageRef);
};

// ─────────────────────────────────────────────
// VALIDATE FILE — Before upload
// ─────────────────────────────────────────────
export const validateFileForStorage = (
  file: File,
  type: 'photo' | 'document' | 'bill'
): { valid: boolean; error?: string } => {
  const allowedTypes = type === 'photo' ? PHOTO_ALLOWED_TYPES : STORAGE_ALLOWED_TYPES;
  const maxSize = type === 'photo' ? PHOTO_MAX_FILE_SIZE : STORAGE_MAX_FILE_SIZE;

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type allowed nahi hai' };
  }
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File ${maxMB}MB se badi hai` };
  }
  return { valid: true };
};

// ─────────────────────────────────────────────
// FORMAT FILE SIZE — For display
// ─────────────────────────────────────────────
export const formatStorageFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
