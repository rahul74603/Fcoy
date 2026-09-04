// ═══════════════════════════════════════════════════════════
// TRAINEE FILES / DOCUMENTS
// ───────────────────────────────────────────────────────────
// Clerk PDF / image upload karta hai (weekly program, syllabus,
// order, notice, form...) aur wo seedha trainee ke account me
// "Files" tab me dikh jaata hai — download ke liye taiyar.
//
// Targeting notices jaisa hi hai:
//   • poora batch      → targetPlatoon 'all', koi trainee id nahi
//   • ek platoon       → targetPlatoon 'Platoon 2'
//   • chune hue trainee → targetTraineeIds me unke ids
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { logAudit } from '../../../services/auditLog.service';
import {
  uploadToStorage, deleteFromStorage, validateFileForStorage,
} from '../../shared/storage.utils';

export type TraineeFileCategory =
  | 'Weekly Program'
  | 'Syllabus'
  | 'Order / Circular'
  | 'Exam / Result'
  | 'Form'
  | 'Study Material'
  | 'Other';

export const FILE_CATEGORIES: { value: TraineeFileCategory; icon: string }[] = [
  { value: 'Weekly Program', icon: '📅' },
  { value: 'Syllabus', icon: '📘' },
  { value: 'Order / Circular', icon: '📜' },
  { value: 'Exam / Result', icon: '🏆' },
  { value: 'Form', icon: '📝' },
  { value: 'Study Material', icon: '📚' },
  { value: 'Other', icon: '📎' },
];

export interface TraineeFile {
  id: string;
  batchId: string;
  title: string;
  description?: string;
  category: TraineeFileCategory;
  /** Firebase Storage download URL */
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  targetPlatoon: string;
  targetTraineeIds?: string[];
  targetTraineeLabel?: string;
  pinned?: boolean;
  uploadedBy: string;
  uploadedAt: string;
  isActive: boolean;
  createdAt: string;
}

/** Storage path: traineeFiles/<batchId>/<timestamp>_<safe name> */
const buildPath = (batchId: string, fileName: string) => {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-80);
  return `traineeFiles/${batchId}/${Date.now()}_${safe}`;
};

export const uploadTraineeFile = async (
  file: File,
  meta: {
    batchId: string;
    title: string;
    description?: string;
    category: TraineeFileCategory;
    targetPlatoon: string;
    targetTraineeIds?: string[];
    targetTraineeLabel?: string;
    pinned?: boolean;
  },
  uploadedBy: string,
): Promise<string> => {
  const check = validateFileForStorage(file, 'document');
  if (!check.valid) throw new Error(check.error || 'File allowed nahi hai');

  const path = buildPath(meta.batchId, file.name);
  const up = await uploadToStorage(file, path, { contentType: file.type });
  const now = new Date().toISOString();

  const ref = await addDoc(collection(db, 'traineeFiles'), {
    batchId: meta.batchId,
    title: meta.title,
    description: meta.description || '',
    category: meta.category,
    downloadUrl: up.downloadUrl,
    storagePath: up.storagePath,
    fileName: up.fileName,
    fileType: up.fileType,
    fileSize: up.fileSize,
    targetPlatoon: meta.targetPlatoon || 'all',
    targetTraineeIds: meta.targetTraineeIds || [],
    targetTraineeLabel: meta.targetTraineeLabel || '',
    pinned: !!meta.pinned,
    uploadedBy,
    uploadedAt: now,
    isActive: true,
    createdAt: now,
  });

  // Lekha-jokha: kaunsi file, kisne, kiske liye bheji
  await logAudit({
    userId: '', userName: uploadedBy, userRole: 'Clerk',
    action: 'Create', collection: 'traineeFiles', documentId: ref.id,
    description: `File upload ki — "${meta.title}" (${meta.category}, ${up.fileName}) `
      + `${meta.targetTraineeLabel || (meta.targetPlatoon && meta.targetPlatoon !== 'all' ? meta.targetPlatoon : 'poore batch')} ke liye.`,
  });
  return ref.id;
};

/**
 * Batch ki files.
 * `traineeId` / `platoon` do to sirf usko dikhne wali files milengi.
 */
export const getTraineeFiles = async (
  batchId: string,
  opts?: { traineeId?: string; platoon?: string },
): Promise<TraineeFile[]> => {
  try {
    const snap = await getDocs(query(
      collection(db, 'traineeFiles'),
      where('batchId', '==', batchId),
      where('isActive', '==', true),
    ));
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TraineeFile));

    if (opts?.traineeId) {
      list = list.filter(f => {
        const ids = f.targetTraineeIds || [];
        return ids.length === 0 || ids.includes(opts.traineeId!);
      });
    }
    if (opts?.platoon) {
      list = list.filter(f =>
        !f.targetPlatoon || f.targetPlatoon === 'all' || f.targetPlatoon === opts.platoon);
    }

    // Pinned pehle, phir naye upar
    list.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return list;
  } catch {
    return [];
  }
};

export const setTraineeFilePinned = async (id: string, pinned: boolean): Promise<void> => {
  await updateDoc(doc(db, 'traineeFiles', id), { pinned });
};

/** Firestore record + Storage object dono hatao. */
export const deleteTraineeFile = async (file: TraineeFile): Promise<void> => {
  await deleteDoc(doc(db, 'traineeFiles', file.id));
  if (file.storagePath) {
    try {
      await deleteFromStorage(file.storagePath);
    } catch (err) {
      // Firestore record ja chuka hai; orphan blob par upload block mat karo.
      console.warn('Storage delete failed (record removed):', err);
    }
  }
};
