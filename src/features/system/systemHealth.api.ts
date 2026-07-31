// ============================================
// SYSTEM HEALTH & ADMIN API (Module 19 Audit ★ NEW)
// ============================================
// 1) pingKeyCollections — Firestore latency/availability check
// 2) getSecurityStats  — login_history se 24h security events
// 3) error_logs        — client crash/error monitoring
// 4) getActivityPulse  — staff_activity_logs ka module pulse
// 5) Feature Flags     — system_config/flags (maintenance mode,
//                        seed tools) — CC-controlled, real-time
// Sab helpers silent-fail pattern follow karte hain — admin
// dashboard kabhi main app ko break nahi karta.
// ============================================

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, orderBy, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { BACKUP_COLLECTIONS } from './masters.api';

// ─── 1. HEALTH PING ──────────────────────────
export interface PingResult {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
}

const PING_TARGETS = [
  'users', 'trainees', 'staff', 'batches', 'medicalRecords',
  'staff_leave', 'issue_records', 'training_tests', 'notifications',
  'mess_fund_collections', 'login_history', 'dropdown_masters',
];

export const pingKeyCollections = async (): Promise<PingResult[]> => {
  const results: PingResult[] = [];
  for (const name of PING_TARGETS) {
    const start = performance.now();
    try {
      await getDocs(query(collection(db, name), limit(1)));
      results.push({ name, ok: true, ms: Math.round(performance.now() - start) });
    } catch (err: any) {
      results.push({
        name, ok: false,
        ms: Math.round(performance.now() - start),
        error: String(err?.code ?? err?.message ?? 'unknown'),
      });
    }
  }
  return results;
};

// ─── 2. SECURITY STATS (login_history) ───────
export interface SecurityStats {
  last24hSuccess: number;
  last24hFailed: number;
  failedByEmail: { email: string; count: number }[];
  recentEvents: { id: string; email: string; status: string; reason: string; role: string; at: Date | null }[];
}

export const getSecurityStats = async (): Promise<SecurityStats> => {
  const stats: SecurityStats = {
    last24hSuccess: 0, last24hFailed: 0, failedByEmail: [], recentEvents: [],
  };
  try {
    const q = query(collection(db, 'login_history'), orderBy('timestamp', 'desc'), limit(150));
    const snap = await getDocs(q);
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const failMap: Record<string, number> = {};

    snap.docs.forEach(d => {
      const data = d.data();
      const at = data.timestamp ? (data.timestamp as Timestamp).toDate() : null;
      const status = String(data.status ?? 'FAILED');
      const email = String(data.email ?? '');
      if (at && at.getTime() >= dayAgo) {
        if (status === 'SUCCESS') stats.last24hSuccess++;
        else {
          stats.last24hFailed++;
          failMap[email] = (failMap[email] ?? 0) + 1;
        }
      }
    });

    stats.failedByEmail = Object.entries(failMap)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    stats.recentEvents = snap.docs.slice(0, 10).map(d => ({
      id: d.id,
      email: String(d.data().email ?? ''),
      status: String(d.data().status ?? ''),
      reason: String(d.data().reason ?? ''),
      role: String(d.data().role ?? ''),
      at: d.data().timestamp ? (d.data().timestamp as Timestamp).toDate() : null,
    }));
  } catch (err) {
    console.warn('Security stats error:', err);
  }
  return stats;
};

// ─── 3. ERROR MONITORING (error_logs) ────────
let lastErrorSig = '';
let lastErrorAt = 0;

// window error listeners se call hota hai — dedupe + throttle, kabhi throw nahi
export const logClientError = (source: string, message: string, detail: string = ''): void => {
  const sig = `${source}:${message}`.slice(0, 180);
  const now = Date.now();
  if (sig === lastErrorSig && now - lastErrorAt < 60_000) return; // 1/min per unique error
  lastErrorSig = sig;
  lastErrorAt = now;
  addDoc(collection(db, 'error_logs'), {
    source: source.slice(0, 60),
    message: message.slice(0, 400),
    detail: detail.slice(0, 600),
    url: (window.location.pathname ?? '').slice(0, 120),
    userAgent: (navigator.userAgent ?? '').slice(0, 150),
    timestamp: serverTimestamp(),
  }).catch(err => console.warn('error_logs write failed:', err));
};

export interface ErrorLogEntry {
  id: string;
  source: string;
  message: string;
  url: string;
  at: Date | null;
}

export const getRecentErrors = async (count: number = 15): Promise<{ total: number; entries: ErrorLogEntry[] }> => {
  try {
    const q = query(collection(db, 'error_logs'), orderBy('timestamp', 'desc'), limit(count));
    const snap = await getDocs(q);
    return {
      total: snap.size,
      entries: snap.docs.map(d => ({
        id: d.id,
        source: String(d.data().source ?? ''),
        message: String(d.data().message ?? ''),
        url: String(d.data().url ?? ''),
        at: d.data().timestamp ? (d.data().timestamp as Timestamp).toDate() : null,
      })),
    };
  } catch {
    return { total: 0, entries: [] };
  }
};

// ─── 4. ACTIVITY PULSE ───────────────────────
export interface ActivityPulse {
  todayTotal: number;
  byModule: { module: string; count: number }[];
  recent: { id: string; userName: string; role: string; module: string; action: string; at: Date | null }[];
}

export const getActivityPulse = async (): Promise<ActivityPulse> => {
  const pulse: ActivityPulse = { todayTotal: 0, byModule: [], recent: [] };
  try {
    const q = query(collection(db, 'staff_activity_logs'), orderBy('timestamp', 'desc'), limit(60));
    const snap = await getDocs(q);
    const todayStr = new Date().toISOString().split('T')[0];
    const modMap: Record<string, number> = {};

    snap.docs.forEach(d => {
      const data = d.data();
      const at = data.timestamp ? (data.timestamp as Timestamp).toDate() : null;
      const mod = String(data.module ?? 'unknown');
      if (at && at.toISOString().split('T')[0] === todayStr) {
        pulse.todayTotal++;
        modMap[mod] = (modMap[mod] ?? 0) + 1;
      }
    });

    pulse.byModule = Object.entries(modMap)
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count);

    pulse.recent = snap.docs.slice(0, 12).map(d => ({
      id: d.id,
      userName: String(d.data().userName ?? ''),
      role: String(d.data().userRole ?? ''),
      module: String(d.data().module ?? ''),
      action: String(d.data().action ?? ''),
      at: d.data().timestamp ? (d.data().timestamp as Timestamp).toDate() : null,
    }));
  } catch (err) {
    console.warn('Activity pulse error:', err);
  }
  return pulse;
};

// ─── 5. COLLECTION SIZE SNAPSHOT ─────────────
export const getCollectionCounts = async (): Promise<Record<string, number>> => {
  const out: Record<string, number> = {};
  await Promise.all(BACKUP_COLLECTIONS.slice(0, 24).map(async col => {
    try {
      const snap = await getDocs(collection(db, col));
      out[col] = snap.size;
    } catch {
      out[col] = -1;
    }
  }));
  return out;
};

// ─── 6. FEATURE FLAGS ────────────────────────
export interface SystemFlags {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enableSeedTools: boolean;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_FLAGS: SystemFlags = {
  maintenanceMode: false,
  maintenanceMessage: 'ERP maintenance chal raha hai. Kripya thodi der baad try karein. — CC Office',
  enableSeedTools: true,
  updatedAt: '',
  updatedBy: '',
};

export const getSystemFlags = async (): Promise<SystemFlags> => {
  try {
    const snap = await getDoc(doc(db, 'system_config', 'flags'));
    if (!snap.exists()) return DEFAULT_FLAGS;
    return { ...DEFAULT_FLAGS, ...(snap.data() as Partial<SystemFlags>) };
  } catch {
    return DEFAULT_FLAGS;
  }
};

export const saveSystemFlags = async (
  flags: Partial<SystemFlags>,
  updatedBy: string
): Promise<void> => {
  await setDoc(doc(db, 'system_config', 'flags'), {
    ...flags,
    updatedAt: new Date().toISOString(),
    updatedBy,
  }, { merge: true });
};
