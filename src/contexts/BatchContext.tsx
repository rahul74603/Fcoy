// src/contexts/BatchContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  doc, collection, onSnapshot, getDoc,
  updateDoc, query, orderBy, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
// ★ Dev Test Lab: hidden test-batch filtering (devSeed)
import { isDevMode } from '../features/system/devSeed';

// ─── Types ───
export interface Batch {
  id: string;
  batchNumber: string;
  isTestData?: boolean;   // ★ Dev Test Lab: hidden fake batch marker
  batchName: string;
  status: 'active' | 'completed' | 'upcoming' | 'test';   // ★ 'test' = hidden dev batch
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
  allBatches: Batch[];
  loading: boolean;
  error: string;
  createNewBatch: (data: CreateBatchForm) => Promise<void>;
  completeBatch: (batchId: string, userId: string) => Promise<void>;
  updateBatchInfo: (batchId: string, data: UpdateBatchForm) => Promise<void>; // ★ NEW — Batch editing
  refreshBatches: () => void;
}

// ★ NEW — editable fields only (batchNumber identity hai, change nahi hoti)
export interface UpdateBatchForm {
  batchName?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  updatedBy?: string;
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
  createNewBatch: async () => {},
  completeBatch: async () => {},
  updateBatchInfo: async () => {},
  refreshBatches: () => {},
});

export const useBatch = () => useContext(BatchContext);

// ─── Provider ───
export const BatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Real-time listener for all batches ──
  // ★ Task 2 (rules-readiness): listener sirf LOGIN KE BAAD attach karo.
  //   Firestore rules batches read = sirf authenticated staff rakhti hain (D3).
  //   Pre-auth attach hua to rules deny kar dengi aur subscription mar jayegi —
  //   phir login ke baad bhi batches dead rahte (refresh tak). Ye fix additive hai;
  //   logged-in behaviour bilkul same hai, sirf boot-order safe hua.
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Login/logout switch par purana listener hamesha band karo (leak nahi)
      unsubscribeFirestore?.();
      unsubscribeFirestore = null;

      if (!firebaseUser) {
        // Pre-auth: kuch fetch nahi — quietly empty state, koi deny-error nahi
        setAllBatches([]);
        setActiveBatch(null);
        setLoading(false);
        setError('');
        return;
      }

      unsubscribeFirestore = onSnapshot(
        query(collection(db, 'batches'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          const raw: Batch[] = [];
          snapshot.forEach((doc) => {
            raw.push({ id: doc.id, ...doc.data() } as Batch);
          });

          // ★ Dev Test Lab: status 'test' ya isTestData wali batches normal users
          //   ko kabhi NAHI dikhti (hidden). Sirf Dev Mode (localStorage
          //   'fcoy_dev_mode'='1') ON hone par developer ko dikhti hain.
          const devOn = isDevMode();
          const batches = devOn ? raw : raw.filter(b => !b.isTestData && b.status !== 'test');
          setAllBatches(batches);

          // Active batch: normal mode me sirf 'active'; Dev Mode me test batch bhi
          // select ho jati hai taaki saari flows fake data par test ho sakein.
          const active = batches.find(b => b.status === 'active')
            || (devOn ? batches.find(b => b.status === 'test' && b.isTestData) : undefined)
            || null;
          setActiveBatch(active);
          setLoading(false);
        },
        (err) => {
          console.error('Batch listener error:', err);
          setError('Batch data load nahi hua');
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeFirestore?.();
      unsubscribeAuth();
    };
  }, []);

  // ── Create New Batch ──
  const createNewBatch = useCallback(async (data: CreateBatchForm) => {
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

  // ── ★ NEW: Edit Batch Info (name/dates/description) ──
  // batchNumber identity hai — kabhi change nahi hoti.
  // status bhi yahan change nahi hota (sirf create/complete se).
  // onSnapshot real-time sync hai → UI apne aap refresh hogi.
  const updateBatchInfo = useCallback(async (batchId: string, data: UpdateBatchForm) => {
    try {
      const patch: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      if (data.updatedBy) patch.updatedBy = data.updatedBy;
      if (data.batchName !== undefined && data.batchName.trim()) {
        patch.batchName = data.batchName.trim();
      }
      if (data.startDate !== undefined) patch.startDate = data.startDate;
      if (data.endDate   !== undefined) patch.endDate   = data.endDate;
      if (data.description !== undefined) patch.description = data.description;

      await updateDoc(doc(db, 'batches', batchId), patch);
    } catch (err: any) {
      console.error('Update batch error:', err);
      throw err;
    }
  }, []);

  const refreshBatches = useCallback(() => {
    console.log('Batches are real-time synced via onSnapshot');
  }, []);

  return (
    <BatchContext.Provider value={{
      activeBatch,
      allBatches,
      loading,
      error,
      createNewBatch,
      completeBatch,
      updateBatchInfo,
      refreshBatches,
    }}>
      {children}
    </BatchContext.Provider>
  );
};