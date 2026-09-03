// ═══════════════════════════════════════════════════════════
// AUDIT LOG SERVICE (Lekha-Jokha)
// Logs all create/update/delete operations
// ═══════════════════════════════════════════════════════════

import {
  collection, addDoc, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface AuditLogEntry {
  id?: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 'Create' | 'Update' | 'Delete' | 'Login' | 'Export';
  collection: string;
  documentId: string;
  description: string;
  timestamp: string;
}

const COLLECTION = 'auditLogs';

export const logAudit = async (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> => {
  try {
    await addDoc(collection(db, COLLECTION), {
      ...entry,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Audit log failed:', e);
  }
};

export const getAuditLogs = async (batchId?: string, maxResults: number = 200): Promise<AuditLogEntry[]> => {
  try {
    let q;
    if (batchId) {
      q = query(collection(db, COLLECTION), where('batchId', '==', batchId), orderBy('timestamp', 'desc'), limit(maxResults));
    } else {
      q = query(collection(db, COLLECTION), orderBy('timestamp', 'desc'), limit(maxResults));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
  } catch {
    // Fallback without orderBy
    const snap = await getDocs(collection(db, COLLECTION));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return list.slice(0, maxResults);
  }
};
