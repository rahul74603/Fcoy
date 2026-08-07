// src/contexts/BatchContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  doc, collection, onSnapshot, getDoc,
  updateDoc, query, orderBy, writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { isDevViewer, onDevViewerChange, DEV_TAG } from '../utils/devDataFilter';
import { setBatchScope } from '../utils/batchScope';
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════════
// 🔒 DEV SANDBOX — PERMANENT LOCK (POORE APP KA KANUN)
//
// Developer account ko EK ALAG PROJECT ki tarah treat karo:
//   1. Dev account SIRF apna sandbox batch (TEST-77) dekhta hai —
//      koi dropdown nahi, koi batch-change system nahi.
//   2. Dev account me REAL batch ka ek bhi record NAHI dikhega,
//      aur TEST-77 ka ek bhi record REAL accounts me NAHI dikhega.
//   3. Real batches ke beech STRICT isolation waisa hi rahega.
//   4. Dev sandbox me naya batch banana/complete karna BLOCKED hai —
//      TEST-77 permanent hai. Real batch lifecycle sirf REAL
//      accounts (CC/Clerk) se hota hai.
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
  useEffect(() => {
    if (isDev) return; // dev ki selection listener force karta hai (TEST-77 lock)
    setSelectedBatchIdState(localStorage.getItem(storageKey));
  }, [uid, isDev, storageKey]);

  const setSelectedBatch = (batchId: string | null) => {
    if (isDevRef.current) return; // 🔒 DEV LOCK — sandbox se bahar koi switch nahi
    setSelectedBatchIdState(batchId);
    if (batchId) localStorage.setItem(storageKey, batchId);
    else localStorage.removeItem(storageKey);
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
          // 🔒 DEV SANDBOX LOCK — dev account ke liye SIRF dev batches exist karte hain.
          // Real batches is duniya me dikhte hi nahi, chune hi nahi ja sakte.
          const devOnly = batches.filter(isDevBatch);
          const lock =
            devOnly.find(b => b.id === DEV_SANDBOX_BATCH_ID) ?? devOnly[0] ?? null;
          setAllBatches(devOnly);
          // Dev duniya me TEST-77 hi "active batch" hai (isliye saare screens
          // aur write-side stamping apne aap sandbox batch pe hoti hai)
          setActiveBatch(lock);
          setSelectedBatchIdState(lock?.id ?? null);
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
    // 🔒 KANUN: Dev sandbox me naya batch nahi banega — TEST-77 permanent hai.
    // Real batches sirf REAL accounts (CC/Clerk) se bante hain.
    if (isDevRef.current) {
      throw new Error(
        'Dev sandbox LOCKED hai — TEST-77 permanent batch hai. Real batch banana hai to real (non-dev) account se login karo.'
      );
    }
    try {
      const batch = writeBatch(db);

      // Step 1: Current active batch ko "completed" karo
      const currentActive = allBatches.find(b => b.status === 'active');
      if (currentActive) {
        const oldBatchRef = doc(db, 'batches', currentActive.id);
        batch.update(oldBatchRef, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          completedBy: data.createdBy,
        });
      }

      // Step 2: Naya batch create karo with status "active"
      const batchId = `batch_${data.batchNumber.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const newBatchRef = doc(db, 'batches', batchId);

      // Check if already exists
      const existingDoc = await getDoc(newBatchRef);
      if (existingDoc.exists()) {
        throw new Error(`Batch "${data.batchNumber}" pehle se exist karta hai!`);
      }

      batch.set(newBatchRef, {
        batchNumber: data.batchNumber,
        batchName: data.batchName,
        status: 'active',
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description,
        totalTrainees: 0,
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy,
      });

      // Step 3: activeBatch config doc update
      const configRef = doc(db, 'config', 'activeBatch');
      batch.set(configRef, {
        batchId: batchId,
        batchNumber: data.batchNumber,
        batchName: data.batchName,
        updatedAt: new Date().toISOString(),
        updatedBy: data.createdBy,
      });

      // Commit all changes atomically
      await batch.commit();
    } catch (err: any) {
      console.error('Create batch error:', err);
      throw err;
    }
  }, [allBatches]);

  // ── Complete/Archive a Batch ──
  const completeBatch = useCallback(async (batchId: string, userId: string) => {
    // 🔒 KANUN: Dev sandbox ka batch kabhi complete/archive nahi hoga (TEST-77 permanent)
    if (isDevRef.current) {
      throw new Error('Dev sandbox LOCKED hai — TEST-77 ko complete/archive nahi kar sakte.');
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
  }, []);

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