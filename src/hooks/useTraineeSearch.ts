// src/hooks/useTraineeSearch.ts

import { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useBatch } from '../contexts/BatchContext';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface TraineeSearchResult {
  id: string;
  batchId?: string;
  batchNumber?: string;
  batchName?: string;
  name?: string;
  fatherName?: string;
  motherName?: string;
  dob?: string;
  age?: string;
  gender?: string;
  bloodGroup?: string;
  religion?: string;
  category?: string;
  maritalStatus?: string;
  regNo?: string;
  aadharNo?: string;
  panNo?: string;
  mobileNo?: string;
  emergencyContact?: string;
  emergencyContactName?: string;
  relationship?: string;
  village?: string;
  tehsil?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  education?: string;
  boardUniversity?: string;
  passingYear?: string;
  percentage?: string;
  recruitmentBatch?: string;
  recruitmentCenter?: string;
  joinDate?: string;
  platoon?: string;
  section?: string;
  height?: string;
  weight?: string;
  chest?: string;
  medStat?: string;
  medRemarks?: string;
  chestNo?: string;
  remarks?: string;
  shoeSize?: string;
  dressSize?: string;
  weaponNo?: string;
  bankName?: string;
  accountNo?: string;
  ifscCode?: string;
  npciStatus?: string;
  kitIssued?: boolean;
  issuedItems?: string[];
  documents?: Record<string, any>;
  fptResult?: string;
  fptScore?: string;
  weeklyExamResult?: string;
  weeklyExamMarks?: string;
  punishments?: string;
  attn?: string;
  ptScore?: string;
  weaponQual?: string;
  rank?: string;
  photoURL?: string;
  photoPath?: string;
  [key: string]: any;
}

// ─────────────────────────────────────────────
// SEARCH FIELDS - Jin fields se search hogi
// ─────────────────────────────────────────────
const SEARCH_FIELDS = ['chestNo', 'regNo'] as const;

// ═══════════════════════════════════════════════════════════
// HOOK: useTraineeSearch
// ═══════════════════════════════════════════════════════════
export const useTraineeSearch = () => {
  const { activeBatch, allBatches } = useBatch();

  // ── States ──
  const [trainee, setTrainee]       = useState<TraineeSearchResult | null>(null);
  const [traineeId, setTraineeId]   = useState<string>('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // ── Single Trainee Search (Batch-Locked) ──
  const searchTrainee = async (searchQuery: string): Promise<boolean> => {
    // GUARD 1: Empty query
    if (!searchQuery.trim()) {
      setError('Search query khaali hai!');
      return false;
    }

    // GUARD 2: No active batch - YAHI HAI WOH LOCK
    if (!activeBatch) {
      setError('ERROR: Pehle Batch select karo! Bina batch ke search nahi hogi.');
      return false;
    }

    setLoading(true);
    setError('');
    setTrainee(null);
    setTraineeId('');

    try {
      let found = false;

      // ── Har field pe try karo, BATCH FILTER LAGAKE ──
      for (const field of SEARCH_FIELDS) {
        if (found) break;

        const q = query(
          collection(db, 'trainees'),
          where(field, '==', searchQuery.trim()),
          where('batchId', '==', activeBatch.id)  // ← BATCH LOCK - Dusre batch ke trainee nahi aayenge
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docId = snapshot.docs[0].id;
          const data  = snapshot.docs[0].data();

          setTrainee({ id: docId, ...data } as TraineeSearchResult);
          setTraineeId(docId);
          found = true;
        }
      }

      if (!found) {
        setError(
          `Trainee NOT FOUND in batch "${activeBatch.batchNumber}". ` +
          `Dusre batch ka trainee is batch mein nahi milega.`
        );
        return false;
      }

      return true;

    } catch (err: any) {
      setError(`Firebase error: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch ALL trainees of active batch ──
  const fetchBatchTrainees = async (): Promise<TraineeSearchResult[]> => {
    // GUARD: No active batch
    if (!activeBatch) {
      setError('ERROR: Batch select karo pehle!');
      return [];
    }

    setLoading(true);
    setError('');

    try {
      const q = query(
        collection(db, 'trainees'),
        where('batchId', '==', activeBatch.id)  // ← BATCH LOCK
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as TraineeSearchResult[];

      return results;

    } catch (err: any) {
      setError(`Error fetching batch trainees: ${err.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch trainees by Platoon (batch-locked) ──
  const fetchByPlatoon = async (platoon: string): Promise<TraineeSearchResult[]> => {
    if (!activeBatch) {
      setError('Batch select karo!');
      return [];
    }

    try {
      const q = query(
        collection(db, 'trainees'),
        where('batchId', '==', activeBatch.id),  // ← BATCH LOCK
        where('platoon', '==', platoon)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TraineeSearchResult[];

    } catch (err: any) {
      setError(`Error: ${err.message}`);
      return [];
    }
  };

  // ── Fetch trainees by Section (batch-locked) ──
  const fetchBySection = async (section: string): Promise<TraineeSearchResult[]> => {
    if (!activeBatch) {
      setError('Batch select karo!');
      return [];
    }

    try {
      const q = query(
        collection(db, 'trainees'),
        where('batchId', '==', activeBatch.id),  // ← BATCH LOCK
        where('section', '==', section)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TraineeSearchResult[];

    } catch (err: any) {
      setError(`Error: ${err.message}`);
      return [];
    }
  };

  // ── Reset search state ──
  const resetSearch = () => {
    setTrainee(null);
    setTraineeId('');
    setError('');
  };

  // ── Manual trainee set (edit ke baad update karne ke liye) ──
  const updateLocalTrainee = (updatedData: Partial<TraineeSearchResult>) => {
    setTrainee(prev =>
      prev ? { ...prev, ...updatedData } : prev
    );
  };

  return {
    // States
    trainee,
    traineeId,
    loading,
    error,

    // Batch info (banner dikhane ke liye)
    activeBatch,
    allBatches,
    hasBatch: !!activeBatch,

    // Functions
    searchTrainee,
    fetchBatchTrainees,
    fetchByPlatoon,
    fetchBySection,
    resetSearch,
    updateLocalTrainee,

    // Manual setters (zaroorat pade to)
    setTrainee,
    setTraineeId,
    setError,
  };
};