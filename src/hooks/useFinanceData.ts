// D:\ALL PROJECTS\BSF COYs\frontend\src\hooks\useFinanceData.ts

import { useState, useCallback } from 'react';
import {
  collection, getDocs, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface FinanceStats {
  // Fund
  totalCollection: number;
  totalExpense: number;
  currentBalance: number;
  // Recovery
  totalExpectedRecovery: number;
  totalPaidRecovery: number;
  totalPendingRecovery: number;
  recoveryRate: number;
  // Inventory
  totalInventoryValue: number;
  totalItemsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  // Purchases
  totalPurchaseAmount: number;
  totalPurchasePaid: number;
  totalPurchaseDue: number;
  purchaseDueCount: number;
  // Combined
  netAssetValue: number;
}

export interface AddCollectionParams {
  amount: number;
  source: string;
  receivedBy: string;
  remarks?: string;
  linkedRecoveryId?: string;
  chestNo?: string;
  traineeName?: string;
}

export interface AddExpenseParams {
  amount: number;
  expenseType: string;
  vendor?: string;
  remarks?: string;
  billStatus?: string;
  recordedBy?: string;
}

const INITIAL_STATS: FinanceStats = {
  totalCollection: 0,
  totalExpense: 0,
  currentBalance: 0,
  totalExpectedRecovery: 0,
  totalPaidRecovery: 0,
  totalPendingRecovery: 0,
  recoveryRate: 0,
  totalInventoryValue: 0,
  totalItemsCount: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  totalPurchaseAmount: 0,
  totalPurchasePaid: 0,
  totalPurchaseDue: 0,
  purchaseDueCount: 0,
  netAssetValue: 0,
};

export const useFinanceData = () => {
  const [stats, setStats] = useState<FinanceStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ── 1. Collections ──
      const colSnap = await getDocs(collection(db, 'collections'));
      let totalCollection = 0;
      colSnap.forEach(d => {
        totalCollection += Number(d.data().amount ?? 0);
      });

      // ── 2. Expenses ──
      const expSnap = await getDocs(collection(db, 'expenses'));
      let totalExpense = 0;
      expSnap.forEach(d => {
        totalExpense += Number(d.data().amount ?? 0);
      });

      // ── 3. Recoveries ──
      const recSnap = await getDocs(collection(db, 'recoveries'));
      let totalExpected = 0;
      let totalPaid = 0;
      recSnap.forEach(d => {
        totalExpected += Number(d.data().expectedAmount ?? 0);
        totalPaid     += Number(d.data().paidAmount     ?? 0);
      });
      const recoveryRate = totalExpected > 0
        ? Math.round((totalPaid / totalExpected) * 100)
        : 0;

      // ── 4. Inventory (item_master) ──
      const itemSnap = await getDocs(collection(db, 'item_master'));
      let totalInventoryValue = 0;
      let totalItemsCount     = 0;
      let lowStockCount       = 0;
      let outOfStockCount     = 0;

      itemSnap.forEach(d => {
        const data = d.data();
        if (data.isActive === false) return;

        const opening   = Number(data.openingStock  ?? 0);
        const received  = Number(data.receivedQty   ?? 0);
        const issued    = Number(data.issuedQty     ?? 0);
        const damaged   = Number(data.damagedQty    ?? 0);
        const unitPrice = Number(data.unitPrice     ?? 0);
        const minAlert  = Number(data.minStockAlert ?? 10);

        const stock = Number(
          data.currentStock ??
          data.remainingQty ??
          (opening + received - issued - damaged)
        );

        totalInventoryValue += stock * unitPrice;
        totalItemsCount     += 1;

        if (stock === 0)            outOfStockCount += 1;
        else if (stock <= minAlert) lowStockCount   += 1;
      });

      // ── 5. ★ FIXED: bills collection se purchase dues fetch karo ──
      // (Pehle 'purchases' collection tha jo exist nahi karta)
      // bills collection mein InventoryStockScreen se Stock Purchase entries aati hain
      const billsSnap = await getDocs(collection(db, 'bills'));
      let totalPurchaseAmount = 0;
      let totalPurchasePaid   = 0;
      let totalPurchaseDue    = 0;
      let purchaseDueCount    = 0;

      billsSnap.forEach(d => {
        const data = d.data();

        // Sirf Stock Purchase type ki bills count karo
        if (data.billType !== 'Stock Purchase') return;

        const total = Number(data.totalAmount ?? 0);
        if (total <= 0) return;

        const paid = Number(data.paidAmount ?? 0);
        const due  = Math.max(0, total - paid);

        // ★ Stored dueAmount prefer karo, fallback to calculation
        const finalDue = Number(data.dueAmount ?? due);

        totalPurchaseAmount += total;
        totalPurchasePaid   += paid;
        totalPurchaseDue    += finalDue;

        if (finalDue > 0) purchaseDueCount += 1;
      });

      // ── 6. Derived values ──
      const currentBalance = totalCollection - totalExpense;

      // netAssetValue = cash in hand + inventory value - purchase dues
      const netAssetValue =
        currentBalance + totalInventoryValue - totalPurchaseDue;

      setStats({
        totalCollection,
        totalExpense,
        currentBalance,
        totalExpectedRecovery : totalExpected,
        totalPaidRecovery     : totalPaid,
        totalPendingRecovery  : totalExpected - totalPaid,
        recoveryRate,
        totalInventoryValue,
        totalItemsCount,
        lowStockCount,
        outOfStockCount,
        totalPurchaseAmount,
        totalPurchasePaid,
        totalPurchaseDue,
        purchaseDueCount,
        netAssetValue,
      });

    } catch (err: any) {
      console.error('useFinanceData → fetchStats error:', err);
      setError(err?.message ?? 'Failed to fetch finance stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Add Collection ──
  const addCollection = useCallback(async (params: AddCollectionParams) => {
    try {
      await addDoc(collection(db, 'collections'), {
        ...params,
        amount    : Number(params.amount),
        date      : new Date().toISOString(),
        createdAt : serverTimestamp(),
        updatedAt : serverTimestamp(),
      });
      await fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('addCollection error:', err);
      return { success: false, error: err?.message };
    }
  }, [fetchStats]);

  // ── Add Expense ──
  const addExpense = useCallback(async (params: AddExpenseParams) => {
    try {
      await addDoc(collection(db, 'expenses'), {
        ...params,
        amount    : Number(params.amount),
        date      : new Date().toISOString(),
        createdAt : serverTimestamp(),
        updatedAt : serverTimestamp(),
      });
      await fetchStats();
      return { success: true };
    } catch (err: any) {
      console.error('addExpense error:', err);
      return { success: false, error: err?.message };
    }
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    fetchStats,
    addCollection,
    addExpense,
  };
};