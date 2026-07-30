// ═══════════════════════════════════════════════════════════
// SEARCH ACTIVITY LOG (PERMISSION LOG / AUDIT TRAIL)
// ───────────────────────────────────────────────────────────
// Har search Firestore `search_logs` collection mein log hoti hai:
//   - kisne search kiya (uid, naam, role)
//   - kya search kiya (query)
//   - kitne results aaye, kin categories mein
//
// Sirf Company Commander ko poora activity log dikhta hai
// (modal mein "Activity" section). Baaki roles ko sirf apne
// recent searches (localStorage) dikhte hain.
//
// Sab kuch fire-and-forget + try/catch — Firestore rules block
// kar dein to bhi search UX kabhi nahi toot-ti.
// ═══════════════════════════════════════════════════════════

import {
  addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface SearchLogEntry {
  id: string;
  userId: string;
  userName: string;
  role: string;
  query: string;
  resultsCount: number;
  categories: string[];
  timestamp: any;
}

let lastLoggedQuery = '';
let lastLoggedAt = 0;

/** Fire-and-forget audit log — kabhi throw nahi karta */
export function logSearchActivity(params: {
  userId: string;
  userName: string;
  role: string;
  query: string;
  resultsCount: number;
  categories: string[];
}): void {
  const q = params.query.trim();
  if (q.length < 2) return;

  // Same query 20s ke andar dobara log mat karo (typing spam avoid)
  const now = Date.now();
  if (q === lastLoggedQuery && now - lastLoggedAt < 20_000) return;
  lastLoggedQuery = q;
  lastLoggedAt = now;

  addDoc(collection(db, 'search_logs'), {
    userId: params.userId,
    userName: params.userName,
    role: params.role,
    query: q,
    resultsCount: params.resultsCount,
    categories: params.categories,
    timestamp: serverTimestamp(),
  }).catch((err) => {
    // Rules ne block kiya ya offline — sirf console pe note karo
    console.warn('[GlobalSearch] activity log skipped:', err?.message ?? err);
  });
}

/** CC ke liye — poore system ki recent search activity */
export async function fetchSearchActivity(maxRows = 15): Promise<SearchLogEntry[]> {
  const snap = await getDocs(
    query(collection(db, 'search_logs'), orderBy('timestamp', 'desc'), limit(maxRows)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SearchLogEntry, 'id'>) }));
}

// ─────────────────────────────────────────────
// RECENT SEARCHES — per user, localStorage
// ─────────────────────────────────────────────
const RECENT_KEY = (uid: string) => `globalSearch:recent:${uid}`;
const MAX_RECENT = 8;

export function getRecentSearches(uid: string): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY(uid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(uid: string, q: string): void {
  const query = q.trim();
  if (query.length < 2) return;
  try {
    const existing = getRecentSearches(uid).filter((x) => x.toLowerCase() !== query.toLowerCase());
    existing.unshift(query);
    localStorage.setItem(RECENT_KEY(uid), JSON.stringify(existing.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}
