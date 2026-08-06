// src/contexts/BatchContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  doc, collection, onSnapshot, getDoc,
  updateDoc, query, orderBy, writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { isDevViewer, onDevViewerChange, DEV_TAG } from '../utils/devDataFilter';

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
  createNewBatch: async () => {},
  completeBatch: async () => {},
  refreshBatches: () => {},
});

export const useBatch = () => useContext(BatchContext);

// ─── Provider ───
export const BatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 🧪 Dev viewer flag — dev-tagged batches sirf dev account ko dikhenge
  const [isDev, setIsDev] = useState(isDevViewer());

  useEffect(() => onDevViewerChange(setIsDev), []);

  // ── Real-time listener for all batches ──
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'batches'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const batches: Batch[] = [];
        snapshot.forEach((doc) => {
          batches.push({ id: doc.id, ...doc.data() } as Batch);
        });

        // 🧪 Dev/test batches (isDevData: true) — non-dev users ko KABHI nahi dikhenge
        const visible = isDev
          ? batches
          : batches.filter(b => (b as unknown as Record<string, unknown>)[DEV_TAG] !== true);

        setAllBatches(visible);

        // Find active batch
        const active = visible.find(b => b.status === 'active') || null;
        setActiveBatch(active);
        setLoading(false);
      },
      (err) => {
        console.error('Batch listener error:', err);
        setError('Batch data load nahi hua');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isDev]);

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
      refreshBatches,
    }}>
      {children}
    </BatchContext.Provider>
  );
};