// ============================================
// MASTERS & CONFIG API (Module 18 Audit ★ NEW)
// ============================================
// 1) Dropdown Masters — `dropdown_masters` collection
//    (DB-driven dropdown lists, hardcoded fallback ke saath)
// 2) Numbering System — `system_counters` collection
//    (transaction-safe auto-increment document numbers)
// 3) Backup Export — known collections ka JSON dump
// ============================================

import {
  collection, doc, getDoc, getDocs, setDoc,
  runTransaction, Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

// ─── DROPDOWN MASTERS ────────────────────────
export interface DropdownMaster {
  key: string;
  label: string;
  values: string[];
  updatedAt: string;
  updatedBy: string;
}

const DROPDOWN_COL = 'dropdown_masters';

// Values fetch — doc nahi mila ya khaali ho to caller ka fallback use hota hai
export const getDropdownValues = async (key: string): Promise<string[]> => {
  try {
    const snap = await getDoc(doc(db, DROPDOWN_COL, key));
    if (!snap.exists()) return [];
    const values = snap.data().values;
    return Array.isArray(values) ? (values as string[]) : [];
  } catch (err) {
    console.warn(`Dropdown master ${key} fetch failed:`, err);
    return [];
  }
};

export const saveDropdownValues = async (
  key: string,
  label: string,
  values: string[],
  updatedBy: string
): Promise<void> => {
  const cleaned = values.map(v => v.trim()).filter(Boolean);
  await setDoc(doc(db, DROPDOWN_COL, key), {
    key,
    label,
    values: cleaned,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
};

export const getAllDropdownMasters = async (): Promise<DropdownMaster[]> => {
  try {
    const snap = await getDocs(collection(db, DROPDOWN_COL));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        key: d.id,
        label: String(data.label ?? d.id),
        values: Array.isArray(data.values) ? (data.values as string[]) : [],
        updatedAt: String(data.updatedAt ?? ''),
        updatedBy: String(data.updatedBy ?? ''),
      };
    });
  } catch (err) {
    console.warn('Dropdown masters fetch failed:', err);
    return [];
  }
};

// ─── NUMBERING SYSTEM ────────────────────────
// system_counters/{key} = { value: number }
// runTransaction se race-condition-safe increment
export const getNextNumber = async (
  key: string,
  prefix: string,
  padLength: number = 4
): Promise<string> => {
  const counterRef = doc(db, 'system_counters', key);
  const nextVal = await runTransaction(db, async (txn) => {
    const snap = await txn.get(counterRef);
    const current = snap.exists() ? Number(snap.data().value ?? 0) : 0;
    const next = current + 1;
    txn.set(counterRef, { value: next, updatedAt: new Date().toISOString() }, { merge: true });
    return next;
  });
  return `${prefix}-${String(nextVal).padStart(padLength, '0')}`;
};

export const getCounterSnapshot = async (): Promise<Record<string, number>> => {
  try {
    const snap = await getDocs(collection(db, 'system_counters'));
    const out: Record<string, number> = {};
    snap.docs.forEach(d => { out[d.id] = Number(d.data().value ?? 0); });
    return out;
  } catch {
    return {};
  }
};

// ─── BACKUP EXPORT ───────────────────────────
// Module 18 "Backup & Restore Ready" — poore ERP ka JSON snapshot.
// CC-only screen se call hota hai. Restore admin-side process hai
// (documented), export hi disaster-recovery ka pehla kadam hai.
export const BACKUP_COLLECTIONS: string[] = [
  'users', 'batches', 'trainees', 'staff',
  'staff_leave', 'staff_attendance', 'staff_duty', 'staff_subjects',
  'leave_types', 'duty_types', 'subject_master',
  'trainee_attendance', 'medicalRecords', 'medicine_txns', 'absentRecords',
  'training_tests', 'weeklyTestRecords', 'fptRecords',
  'training_schedule', 'weeklyPrograms', 'deputation_records',
  'issue_records', 'stock_returns',
  'mess_fund_collections', 'mess_fund_expenses',
  'training_fund_collections', 'training_fund_expenses',
  'company_assets_collections', 'company_assets_expenses',
  'general_fund_collections', 'general_fund_expenses',
  'fund_transfers', 'vendors', 'vendor_entries',
  'notifications', 'login_history', 'staff_activity_logs',
  'dropdown_masters', 'system_counters', 'search_logs',
];

// Firestore values ko JSON-safe banata hai (Timestamp → ISO, nested bhi)
const toJsonSafe = (val: unknown): unknown => {
  if (val === null || val === undefined) return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (Array.isArray(val)) return val.map(toJsonSafe);
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
      out[k] = toJsonSafe(v);
    });
    return out;
  }
  return val;
};

export interface BackupResult {
  exportedAt: string;
  exportedBy: string;
  collectionCounts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
}

export const exportFullBackup = async (
  exportedBy: string,
  onProgress?: (done: number, total: number, current: string) => void
): Promise<BackupResult> => {
  const result: BackupResult = {
    exportedAt: new Date().toISOString(),
    exportedBy,
    collectionCounts: {},
    data: {},
  };

  for (let i = 0; i < BACKUP_COLLECTIONS.length; i++) {
    const colName = BACKUP_COLLECTIONS[i];
    onProgress?.(i + 1, BACKUP_COLLECTIONS.length, colName);
    try {
      const snap = await getDocs(collection(db, colName));
      result.collectionCounts[colName] = snap.size;
      result.data[colName] = snap.docs.map(d => ({
        _id: d.id,
        ...(toJsonSafe(d.data()) as Record<string, unknown>),
      }));
    } catch (err) {
      console.warn(`Backup: ${colName} skipped:`, err);
      result.collectionCounts[colName] = -1; // fetch failed marker
      result.data[colName] = [];
    }
  }

  return result;
};

export const downloadBackupFile = (backup: BackupResult): void => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `fcoy_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};
