// src/contexts/BatchContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  doc, collection, onSnapshot,
  updateDoc, query, orderBy, runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { isDevViewer, onDevViewerChange, DEV_TAG } from '../utils/devDataFilter';
import { setBatchScope } from '../utils/batchScope';
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════════
// 🔒 DEV SANDBOX — ISOLATION KANUN (POORE APP KA KANUN)
//
// Developer account ko EK ALAG PROJECT ki tarah treat karo:
//   1. Dev account SIRF dev sandbox batches (TEST-77 jaise) dekhta hai.
//      v2.3.0 se DEV batches ke ANDAR switch/create/complete allowed hai
//      taaki MASTER COY apni poori testing khud kare — par real batch
//      is duniya me AATA hi nahi, switch hona impossible hai.
//   2. Dev account me REAL batch ka ek bhi record NAHI dikhega,
//      aur dev batch (isDevData tagged) ka ek bhi record REAL accounts
//      me NAHI dikhega.
//   3. Real batches ke beech STRICT isolation waisa hi rahega.
//   4. Real batches ka lifecycle (create/complete) SIRF REAL accounts
//      (CC/Clerk) se hota hai — dev se real batch pe koi write nahi.
//   5. Dono duniyon ke beech sirf SUBSCRIPTION + RULES ka rishta hai.
// ═══════════════════════════════════════════════════════════════
const DEV_SANDBOX_BATCH_ID = 'batch_DEV_TEST_01';

// ─── Types ───
export interface Batch {
  id: string;
  batchNumber: string;
  batchName: string;
  status: 'active' | 'completed' | 'upcoming';
  startDate: string;
  endDate: string;
  totalTrainees: number;
  description: string;
  createdAt: string;
  createdBy: string;
  completedAt?: string;
  completedBy?: string;
}

interface BatchContextType {
  activeBatch: Batch | null;
  currentBatch: Batch | null; // ⛓️ SELECTED batch (default = active) — screens isko follow karein
  selectedBatchId: string | null;
  setSelectedBatch: (batchId: string | null) => void;
  allBatches: Batch[];
  loading: boolean;
  error: string;
  createNewBatch: (data: CreateBatchForm) => Promise<void>;
  completeBatch: (batchId: string, userId: string) => Promise<void>;
  refreshBatches: () => void;
}

export interface CreateBatchForm {
  batchNumber: string;
  batchName: string;
  startDate: string;
  endDate: string;
  description: string;
  createdBy: string;
}

const BatchContext = createContext<BatchContextType>({
  activeBatch: null,
  allBatches: [],
  loading: true,
  error: '',
  currentBatch: null,
  selectedBatchId: null,
  setSelectedBatch: () => {},
  createNewBatch: async () => {},
  completeBatch: async () => {},
  refreshBatches: () => {},
});

export const useBatch = () => useContext(BatchContext);

// ─── Provider ───
export const BatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid ?? 'anon';
  const storageKey = `fcoy_batch_scope:${uid}`; // per-user selection memory
  const devStorageKey = `fcoy_batch_scope_dev:${uid}`; // 🧪 dev sandbox ki ALAG memory (real selection se mix nahi)

  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  // ⛓️ STRICT BATCH RULE — user ka selected batch (per-user persisted)
  const [selectedBatchId, setSelectedBatchIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 🧪 Dev viewer flag — dev account = sandbox mode (LOCKED)
  const [isDev, setIsDev] = useState(isDevViewer());
  const isDevRef = useRef(isDev);
  isDevRef.current = isDev;

  useEffect(() => onDevViewerChange(setIsDev), []);

  // Account badalte hi us account ki apni saved selection load karo
  // (dev ki selection alag key me — real duniya ki memory se kabhi mix nahi)
  useEffect(() => {
    setSelectedBatchIdState(localStorage.getItem(isDev ? devStorageKey : storageKey));
  }, [uid, isDev, storageKey, devStorageKey]);

  const setSelectedBatch = (batchId: string | null) => {
    // 🧪 Dev bhi switch kar sakta hai — par SIRF dev batches ke beech.
    // allBatches me dev ke liye real batch hota hi nahi, isliye sandbox se
    // bahar switch hona STRUCTURALLY impossible hai.
    const key = isDevRef.current ? devStorageKey : storageKey;
    setSelectedBatchIdState(batchId);
    if (batchId) localStorage.setItem(key, batchId);
    else localStorage.removeItem(key);
  };

  // ── Real-time listener for all batches ──
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'batches'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const batches: Batch[] = [];
        snapshot.forEach((doc) => {
          batches.push({ id: doc.id, ...doc.data() } as Batch);
        });
        const isDevBatch = (b: Batch) =>
          (b as unknown as Record<string, unknown>)[DEV_TAG] === true;

        if (isDev) {
          // 🧪 DEV SANDBOX — dev account ke liye SIRF dev batches exist karte hain.
          // Real batches is duniya me dikhte hi nahi, chune hi nahi ja sakte.
          const devOnly = batches.filter(isDevBatch);
          const lock =
            devOnly.find(b => b.id === DEV_SANDBOX_BATCH_ID) ?? devOnly[0] ?? null;
          setAllBatches(devOnly);
          // Sandbox ka ACTIVE dev batch default hai (nayi test entries usi pe stamp hongi)
          setActiveBatch(devOnly.find(b => b.status === 'active') ?? lock);
          // Dev ki saved selection sirf dev batches me valid ho tabhi rakho
          setSelectedBatchIdState(prev =>
            prev && devOnly.some(b => b.id === prev) ? prev : null
          );
        } else {
          // 🏢 REAL WORLD — dev/test batches yahan kabhi exist hi nahi karte
          const realOnly = batches.filter(b => !isDevBatch(b));
          setAllBatches(realOnly);
          setActiveBatch(realOnly.find(b => b.status === 'active') || null);
          // Saved selection real batches me valid hai tabhi rakho
          // (dev batch id ya kisi dusre user ka selection yahan survive nahi karega)
          setSelectedBatchIdState(prev =>
            prev && realOnly.some(b => b.id === prev) ? prev : null
          );
        }
        setLoading(false);
      },
      (err) => {
        console.error('Batch listener error:', err);
        setError('Batch data load nahi hua');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isDev, uid, storageKey]);

  // ⛓️ currentBatch = selected (agar list me hai) warna active — STRICT RULE ka base
  const currentBatch = (() => {
    if (selectedBatchId) {
      const chosen = allBatches.find(b => b.id === selectedBatchId);
      if (chosen) return chosen;
    }
    return activeBatch;
  })();

  // Rule engine ko sync karo (screens/apis batchScopeRule use karti hain)
  useEffect(() => {
    const isRealActive = Boolean(currentBatch && currentBatch.status === 'active' && (currentBatch as unknown as Record<string, unknown>)[DEV_TAG] !== true);
    setBatchScope(currentBatch?.id ?? null, isRealActive);
  }, [currentBatch]);

  // ── Create New Batch ──
  const createNewBatch = useCallback(async (data: CreateBatchForm) => {
    // 🧪 DEV MODE: sandbox ke andar naya TEST batch banana allowed hai
    // (MASTER COY apni testing khud karega). Naya batch DEV_TAG ke saath banta
    // hai — real duniya me kabhi nahi dikhega. Dev ka allBatches pehle se
    // dev-only hai, isliye "complete" hone wala purana batch bhi sirf dev batch hoga.
    const isDevMode = isDevRef.current;

    // 🔒 BUSINESS RULE (enforced here too, not just in the screen):
    // Real batch creation/activation is a Company Commander action.
    // Dev sandbox accounts may create isDevData-tagged test batches.
    if (!isDevMode && user?.role !== 'Company Commander') {
      throw new Error('Sirf Company Commander naya batch create/activate kar sakta hai.');
    }

    try {
      const batchId = `batch_${data.batchNumber.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const newBatchRef = doc(db, 'batches', batchId);
      const currentActive = allBatches.find(b => b.status === 'active');

      // 🔐 TRANSACTION — duplicate check + archive + create + config update
      // happen atomically. Two simultaneous creations of the same batch
      // number can never both succeed (the read is re-validated at commit).
      await runTransaction(db, async (tx) => {
        const existingDoc = await tx.get(newBatchRef);
        if (existingDoc.exists()) {
          throw new Error(`Batch "${data.batchNumber}" pehle se exist karta hai!`);
        }

        // Step 1: Current active batch ko "completed" karo
        if (currentActive) {
          tx.update(doc(db, 'batches', currentActive.id), {
            status: 'completed',
            completedAt: new Date().toISOString(),
            completedBy: data.createdBy,
          });
        }

        // Step 2: Naya batch create karo with status "active"
        tx.set(newBatchRef, {
          batchNumber: data.batchNumber,
          batchName: data.batchName,
          status: 'active',
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description,
          totalTrainees: 0,
          createdAt: new Date().toISOString(),
          createdBy: data.createdBy,
          // 🧪 Dev sandbox ka batch hamesha tagged — real accounts me kabhi nahi dikhega
          ...(isDevMode ? { [DEV_TAG]: true } : {}),
        });

        // Step 3: activeBatch config doc update (dev sandbox real config nahi chhedta)
        if (!isDevMode) {
          tx.set(doc(db, 'config', 'activeBatch'), {
            batchId: batchId,
            batchNumber: data.batchNumber,
            batchName: data.batchName,
            updatedAt: new Date().toISOString(),
            updatedBy: data.createdBy,
          });
        }
      });
    } catch (err: any) {
      console.error('Create batch error:', err);
      throw err;
    }
  }, [allBatches, user?.role]);

  // ── Complete/Archive a Batch ──
  const completeBatch = useCallback(async (batchId: string, userId: string) => {
    // 🧪 DEV MODE: sandbox batch complete karna allowed hai — par SIRF dev batch.
    // Dev ka allBatches dev-only hai; list me na milna = real batch = BLOCK.
    if (isDevRef.current && !allBatches.some(b => b.id === batchId)) {
      throw new Error('Ye dev sandbox ka batch nahi hai — dev account se complete nahi ho sakta.');
    }
    try {
      await updateDoc(doc(db, 'batches', batchId), {
        status: 'completed',
        completedAt: new Date().toISOString(),
        completedBy: userId,
      });
    } catch (err: any) {
      console.error('Complete batch error:', err);
      throw err;
    }
  }, [allBatches]);

  const refreshBatches = useCallback(() => {
    console.log('Batches are real-time synced via onSnapshot');
  }, []);

  return (
    <BatchContext.Provider value={{
      activeBatch,
      currentBatch,
      selectedBatchId,
      setSelectedBatch,
      allBatches,
      loading,
      error,
      createNewBatch,
      completeBatch,
      refreshBatches,
    }}>
      {children}
    </BatchContext.Provider>
  );
};