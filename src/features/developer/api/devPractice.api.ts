// src/features/developer/api/devPractice.api.ts
// ─────────────────────────────────────────────
// DEV PRACTICE ENGINE
// "Start Practice" → poore DB ka snapshot (doc IDs +
// critical collections ka full data) localStorage me.
// "Clean" → session ke BAAD bana har document delete,
// mutate hue critical docs wapas restore.
// Real data kabhi delete nahi hota (snapshot guarantee).
// ─────────────────────────────────────────────

import {
  collection, doc, getDoc, getDocs, writeBatch, setDoc,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS } from '../../aiAgent/knowledge/collectionRegistry';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const SNAPSHOT_KEY = 'fcoy_dev_practice_snapshot_v1';
const BATCH_CHUNK = 450; // Firestore batch limit 500 se kam

/** Registry ke alawa ye collections bhi scan honge */
const EXTRA_COLLECTIONS = ['config', 'notifications', 'activity_logs'];

/** In collections ko kabhi touch nahi karna */
const EXCLUDED = ['devTools'];

/**
 * Chhote lekin CRITICAL collections — inka FULL DATA snapshot hota hai
 * (cleanup pe content bhi restore). Baaki sabke sirf doc IDs.
 */
const FULL_DATA_COLLECTIONS = [
  'batches',
  'users',
  'config',
  'unitConfig',
  'subscription',
  'subscriptionPlans',
  'subscriptionHistory',
];

export const KNOWN_COLLECTIONS: string[] = Array.from(
  new Set([...COLLECTIONS.map(c => c.name), ...EXTRA_COLLECTIONS]),
).filter(n => !EXCLUDED.includes(n));

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface StoredDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface PracticeSnapshot {
  version: 1;
  startedAt: string;
  startedByUid: string;
  startedByEmail: string;
  /** ID-only collections: name → session start ke existing doc IDs */
  ids: Record<string, string[]>;
  /** Protected collections: name → poora data */
  fullData: Record<string, StoredDoc[]>;
}

export interface CollectionPlan {
  name: string;
  toDelete: string[];
  /** Session me delete hue REAL docs (restore possible sirf agar data stored hai) */
  deletedDuring: string[];
}

export interface CleanupPlan {
  startedAt: string;
  perCollection: CollectionPlan[];
  totalDeletes: number;
  /** Full-data docs jo restore honge (mutated ya deleted real docs) */
  restoreDocs: { col: string; id: string; data: Record<string, unknown> }[];
  /** Real docs jo practice me delete hue aur data stored NAHI hai (warn only) */
  lostDocs: { col: string; id: string }[];
}

export interface CleanupReport {
  deletedPerCollection: { name: string; count: number }[];
  restoredCount: number;
  totalDeleted: number;
  finishedAt: string;
}

// ─────────────────────────────────────────────
// SNAPSHOT STORAGE (localStorage)
// ─────────────────────────────────────────────

export const loadSnapshot = (): PracticeSnapshot | null => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PracticeSnapshot;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
};

export const clearSnapshot = (): void => {
  localStorage.removeItem(SNAPSHOT_KEY);
};

/** Session meta (Firestore) — dusre device se bhi status dikhe */
export const writeSessionMeta = async (meta: Record<string, unknown>): Promise<void> => {
  await setDoc(doc(db, 'devTools', 'practiceSession'), meta);
};

// ─────────────────────────────────────────────
// START PRACTICE — snapshot lo
// ─────────────────────────────────────────────

export const startPracticeSession = async (
  uid: string,
  email: string,
  onProgress?: (done: number, total: number) => void,
): Promise<PracticeSnapshot> => {
  const ids: Record<string, string[]> = {};
  const fullData: Record<string, StoredDoc[]> = {};
  let done = 0;

  for (const name of KNOWN_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, name));
      if (FULL_DATA_COLLECTIONS.includes(name)) {
        fullData[name] = snap.docs.map(d => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }));
      } else {
        ids[name] = snap.docs.map(d => d.id);
      }
    } catch (err) {
      console.warn(`Snapshot skip: ${name}`, err);
      // Collection accessible nahi — empty maan lo (naya data delete ho payega)
      ids[name] = ids[name] ?? [];
    }
    done += 1;
    onProgress?.(done, KNOWN_COLLECTIONS.length);
  }

  const snapshot: PracticeSnapshot = {
    version: 1,
    startedAt: new Date().toISOString(),
    startedByUid: uid,
    startedByEmail: email,
    ids,
    fullData,
  };

  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));

  await writeSessionMeta({
    status: 'running',
    startedAt: snapshot.startedAt,
    startedByUid: uid,
    startedByEmail: email,
  });

  return snapshot;
};

// ─────────────────────────────────────────────
// PREVIEW — kya delete hoga (bina delete kiye)
// ─────────────────────────────────────────────

export const previewCleanup = async (
  onProgress?: (done: number, total: number) => void,
): Promise<CleanupPlan> => {
  const snapshot = loadSnapshot();
  if (!snapshot) {
    throw new Error('Koi practice session nahi mila. Pehle "Start Practice" dabao.');
  }

  const perCollection: CollectionPlan[] = [];
  const restoreDocs: CleanupPlan['restoreDocs'] = [];
  const lostDocs: CleanupPlan['lostDocs'] = [];
  let totalDeletes = 0;
  let done = 0;

  for (const name of KNOWN_COLLECTIONS) {
    try {
      const snapNow = await getDocs(collection(db, name));
      const currentIds = snapNow.docs.map(d => d.id);
      const currentSet = new Set(currentIds);

      if (FULL_DATA_COLLECTIONS.includes(name)) {
        const stored = snapshot.fullData[name] ?? [];
        const storedIds = new Set(stored.map(s => s.id));

        // Naye docs (session me bane) → delete
        const toDelete = currentIds.filter(id => !storedIds.has(id));

        // Sab stored docs → restore (mutated content bhi theek ho jayega)
        stored.forEach(s => restoreDocs.push({ col: name, id: s.id, data: s.data }));

        // Stored par ab gayab → restoreDocs se wapas aa jayenge
        const deletedDuring = stored.filter(s => !currentSet.has(s.id)).map(s => s.id);

        if (toDelete.length || deletedDuring.length) {
          perCollection.push({ name, toDelete, deletedDuring });
        }
        totalDeletes += toDelete.length;
      } else {
        const oldIds = new Set(snapshot.ids[name] ?? []);

        const toDelete = currentIds.filter(id => !oldIds.has(id));
        // Real doc session me delete hua + data stored nahi → warn only
        const deletedDuring = [...oldIds].filter(id => !currentSet.has(id));
        deletedDuring.forEach(id => lostDocs.push({ col: name, id }));

        if (toDelete.length || deletedDuring.length) {
          perCollection.push({ name, toDelete, deletedDuring });
        }
        totalDeletes += toDelete.length;
      }
    } catch (err) {
      console.warn(`Preview skip: ${name}`, err);
    }
    done += 1;
    onProgress?.(done, KNOWN_COLLECTIONS.length);
  }

  return {
    startedAt: snapshot.startedAt,
    perCollection,
    totalDeletes,
    restoreDocs,
    lostDocs,
  };
};

// ─────────────────────────────────────────────
// RUN CLEANUP — delete + restore
// ─────────────────────────────────────────────

export const runCleanup = async (
  plan: CleanupPlan,
  finishedBy: string,
): Promise<CleanupReport> => {
  type Op = { type: 'del' | 'set'; col: string; id: string; data?: Record<string, unknown> };
  const ops: Op[] = [];

  plan.perCollection.forEach(pc =>
    pc.toDelete.forEach(id => ops.push({ type: 'del', col: pc.name, id })),
  );
  plan.restoreDocs.forEach(r =>
    ops.push({ type: 'set', col: r.col, id: r.id, data: r.data }),
  );

  // Chunked batch commits
  for (let i = 0; i < ops.length; i += BATCH_CHUNK) {
    const wb = writeBatch(db);
    ops.slice(i, i + BATCH_CHUNK).forEach(op => {
      const ref = doc(db, op.col, op.id);
      if (op.type === 'del') wb.delete(ref);
      else wb.set(ref, op.data as Record<string, unknown>);
    });
    await wb.commit();
  }

  // totalTrainees counters dobara sahi karo (test trainees ne bigaade the)
  try {
    const tSnap = await getDocs(collection(db, 'trainees'));
    const counts: Record<string, number> = {};
    tSnap.forEach(d => {
      const b = (d.data() as { batchId?: string }).batchId;
      if (b) counts[b] = (counts[b] ?? 0) + 1;
    });
    const bSnap = await getDocs(collection(db, 'batches'));
    const wb = writeBatch(db);
    bSnap.forEach(d => wb.update(d.ref, { totalTrainees: counts[d.id] ?? 0 }));
    await wb.commit();
  } catch (err) {
    console.warn('Trainee count recompute skip:', err);
  }

  clearSnapshot();

  const finishedAt = new Date().toISOString();
  await writeSessionMeta({
    status: 'done',
    startedAt: plan.startedAt,
    endedAt: finishedAt,
    endedBy: finishedBy,
    totalDeleted: plan.totalDeletes,
    restored: plan.restoreDocs.length,
  });

  return {
    deletedPerCollection: plan.perCollection
      .filter(pc => pc.toDelete.length)
      .map(pc => ({ name: pc.name, count: pc.toDelete.length })),
    restoredCount: plan.restoreDocs.length,
    totalDeleted: plan.totalDeletes,
    finishedAt,
  };
};

// ─────────────────────────────────────────────
// SESSION META READ
// ─────────────────────────────────────────────

export const fetchSessionMeta = async (): Promise<Record<string, unknown> | null> => {
  try {
    const snap = await getDoc(doc(db, 'devTools', 'practiceSession'));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
