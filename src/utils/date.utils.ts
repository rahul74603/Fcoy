// src/utils/date.utils.ts
// ─────────────────────────────────────────────
// 🛡️ SAFE DATE CONVERTER (Central)
// Firestore se aaya data hamesha Timestamp nahi hota —
// seed / purane docs / serialized data me kabhi-kabhi
// string, Date, ya {seconds, nanoseconds} bhi aa jata hai.
// `data.x.toDate()` direct call karne par aise docs par
// "x.toDate is not a function" crash hota tha.
// toJSDate() har format ko safely handle karta hai.
// ─────────────────────────────────────────────

import { Timestamp } from 'firebase/firestore';

/**
 * Kisi bhi date-like value ko safely JS Date me convert karta hai.
 *
 * Handles:
 *  - Firestore Timestamp (instanceof + duck-typed .toDate())
 *  - Serialized timestamp  ({ seconds, nanoseconds })
 *  - JS Date
 *  - ISO / date string     ('2026-02-02', '2026-02-02T05:30:00.000Z')
 *  - Epoch number          (ms ya seconds)
 *  - null / undefined / '' / invalid → null
 */
export const toJSDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;

  // JS Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Firestore Timestamp
  if (value instanceof Timestamp) return value.toDate();

  if (typeof value === 'object') {
    const v = value as { toDate?: unknown; seconds?: unknown };
    // Timestamp-like object (cross-SDK / deserialized)
    if (typeof v.toDate === 'function') {
      try {
        const d = (v.toDate as () => Date)();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    // Serialized Firestore timestamp { seconds, nanoseconds }
    if (typeof v.seconds === 'number') {
      return new Date(v.seconds * 1000);
    }
    return null;
  }

  // String ya epoch number
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

export const getLocalDateString = (): string => {
  const d = new Date();
  const offset = d.getTimezoneOffset(); // in minutes
  // Convert to local time by shifting the UTC time
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};
