import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useBatch } from '../contexts/BatchContext';

export const useAppDb = () => {
  const { activeBatch } = useBatch();

  // 1. TRAINEES (STRICT BATCH FILTER)
  const getBatchTrainees = async () => {
    if (!activeBatch) {
      console.warn("No active batch selected!");
      return []; // Agar batch nahi toh blank return karo
    }
    
    // Yahan sirf ek baar filter lagana hai zindagi mein
    const q = query(
      collection(db, 'trainees'), 
      where('batchId', '==', activeBatch.id)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  // 2. STOCK / INVENTORY (GLOBAL - NO FILTER)
  const getGlobalStock = async () => {
    const q = query(collection(db, 'item_master'), where('isActive', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  // 3. FINANCE / EXPENSE / COLLECTIONS (Example)
  // Inko bhi aap yahan add kar sakte ho aage chal ke

  return {
    getBatchTrainees,
    getGlobalStock
  };
};