// ═══════════════════════════════════════════════════════════════════════
// INVENTORY STOCK — CONCURRENCY-SAFE ISSUE
// ───────────────────────────────────────────────────────────────────────
// The UI computes "available stock" from purchases minus issues. Two QMs
// issuing the last item simultaneously could both pass that client-side
// check and overspend. To prevent that we maintain an authoritative
// counter collection `stock_ledgers` and decrement it INSIDE a Firestore
// transaction:
//
//   • stock_ledgers/{itemKey}             → total remaining balance
//   • stock_ledgers/{itemKey}/sizes/{size} → per-size remaining balance
//
// The transaction re-reads the counter at commit time, so if another user
// already took the stock, this issue fails and rolls back — the counter,
// the issue ledger doc, and the trainee update all commit together or not
// at all (atomic).
//
// Counters are seeded lazily on first use from the live computed stock
// (purchases − issues) and reconciled upwards when fresh purchases raise
// the computed balance.
// ═══════════════════════════════════════════════════════════════════════

import { runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface IssueItem {
  itemName: string;
  assignedSize?: string;
  quantity: number;
}

/** A minimal set/update surface shared by writeBatch and transactions. */
export interface BatchLike {
  set: (ref: unknown, data: Record<string, unknown>, opts?: { merge?: boolean }) => unknown;
  update: (ref: unknown, data: Record<string, unknown>) => unknown;
}

export const normalizeKey = (name: string): string =>
  String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Atomically verify + decrement stock counters AND stage the caller's
 * ledger/trainee writes in the SAME transaction.
 *
 * @param items              items being issued
 * @param expectedAvailable  (itemKey, size?) => current computed stock
 * @param applyWrites        receives a BatchLike to add the issue record +
 *                           trainee update; these commit only if every stock
 *                           check passes.
 */
export async function atomicIssue(params: {
  items: IssueItem[];
  expectedAvailable: (itemKey: string, size?: string) => number;
  applyWrites: (batch: BatchLike) => void;
}): Promise<void> {
  const { items, expectedAvailable, applyWrites } = params;

  await runTransaction(db, async (txn) => {
    for (const item of items) {
      const key = normalizeKey(item.itemName);
      const size = item.assignedSize && item.assignedSize !== 'N/A'
        ? String(item.assignedSize).trim().toUpperCase()
        : undefined;
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      // ── Total counter ──
      const totalRef = doc(db, 'stock_ledgers', key);
      const totalSnap = await txn.get(totalRef);
      let totalBalance: number;
      if (!totalSnap.exists()) {
        totalBalance = expectedAvailable(key);
      } else {
        const stored = Number(totalSnap.data().balance ?? 0);
        const computed = expectedAvailable(key);
        // Reconcile up when fresh purchases added stock.
        totalBalance = Math.max(stored, computed);
      }
      if (totalBalance < qty) {
        throw new Error(
          `INSUFFICIENT STOCK: "${item.itemName}" — sirf ${totalBalance} bacha hai, ${qty} maanga gaya. Doosri issue ke saath conflict ho sakta hai; refresh karke retry karein.`,
        );
      }
      txn.set(totalRef, {
        itemName: item.itemName,
        balance: totalBalance - qty,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // ── Per-size counter ──
      if (size) {
        const sizeRef = doc(db, 'stock_ledgers', key, 'sizes', size);
        const sizeSnap = await txn.get(sizeRef);
        let sizeBalance: number;
        if (!sizeSnap.exists()) {
          sizeBalance = expectedAvailable(key, size);
        } else {
          const stored = Number(sizeSnap.data().balance ?? 0);
          const computed = expectedAvailable(key, size);
          sizeBalance = Math.max(stored, computed);
        }
        if (sizeBalance < qty) {
          throw new Error(
            `INSUFFICIENT STOCK: "${item.itemName}" size ${size} — sirf ${sizeBalance} bacha hai, ${qty} maanga gaya. Refresh karke retry karein.`,
          );
        }
        txn.set(sizeRef, {
          size,
          balance: sizeBalance - qty,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    }

    // All stock checks passed — stage the caller's writes inside the same
    // transaction so counters + ledger + trainee state commit atomically.
    applyWrites({
      set: (ref, data, opts) =>
        txn.set(ref as never, data as never, opts ?? {}) as never,
      update: (ref, data) => txn.update(ref as never, data as never) as never,
    });
  });
}
