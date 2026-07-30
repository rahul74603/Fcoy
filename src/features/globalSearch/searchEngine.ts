// ═══════════════════════════════════════════════════════════
// GLOBAL SEARCH ENGINE
// ───────────────────────────────────────────────────────────
// Firestore "LIKE / full-text" support nahi karta, isliye pattern:
//   1. Har allowed collection se limited docs fetch (cached ~90s)
//   2. Client-side pe sab text/number fields scan karke scoring
//   3. Role permission ke hisaab se sirf allowed entities search hoti hain
//
// Scoring: title match > priority fields > baaki fields.
// Multi-word query: har token kahin na kahin match hona chahiye (AND).
// ═══════════════════════════════════════════════════════════

import { collection, getDocs, limit as fsLimit, query as fsQuery } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  SEARCH_ENTITIES, canAccess,
  type SearchEntityConfig,
} from './searchConfig';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface SearchResultItem {
  docId: string;
  entityId: string;
  entityLabel: string;
  title: string;
  subtitle: string;
  badge: string | null;
  route: string;
  score: number;
}

export interface SearchGroup {
  entity: SearchEntityConfig;
  items: SearchResultItem[];
  totalMatches: number;
  error?: boolean;
}

// ─────────────────────────────────────────────
// DOC CACHE — typing pe baar-baar Firestore hit na ho
// ─────────────────────────────────────────────
interface CacheEntry { ts: number; docs: { id: string; data: Record<string, any> }[] }
const docCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 90_000; // 90 sec

async function getCollectionDocs(
  collectionName: string,
  maxFetch: number,
): Promise<{ id: string; data: Record<string, any> }[]> {
  const cached = docCache.get(collectionName);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.docs;

  const snap = await getDocs(fsQuery(collection(db, collectionName), fsLimit(maxFetch)));
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }));
  docCache.set(collectionName, { ts: Date.now(), docs });
  return docs;
}

/** Naya data likhne ke baad cache fresh karne ke liye */
export const invalidateSearchCache = (collectionName?: string) => {
  if (collectionName) docCache.delete(collectionName);
  else docCache.clear();
};

// ─────────────────────────────────────────────
// FIELD SCANNING
// ─────────────────────────────────────────────
// Sensative / non-searchable fields skip karo
const SKIP_FIELD_RE = /(url|uri|photo|image|avatar|token|password|secret|signature|storagePath|filePath|createdAt|updatedAt|timestamp)/i;

/** Any Firestore value → searchable lowercase text */
const toSearchText = (v: any, depth = 0): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v).toLowerCase();
  if (typeof v === 'object') {
    if (typeof v.toDate === 'function') {
      try { return v.toDate().toISOString().slice(0, 10); } catch { return ''; }
    }
    if (typeof v.seconds === 'number') {
      try { return new Date(v.seconds * 1000).toISOString().slice(0, 10); } catch { return ''; }
    }
    if (depth >= 2) return '';
    if (Array.isArray(v)) return v.map((x) => toSearchText(x, depth + 1)).join(' ');
    return Object.values(v).map((x) => toSearchText(x, depth + 1)).join(' ');
  }
  return '';
};

/** Ek doc ke liye score nikalo. 0 => no match */
function scoreDoc(
  data: Record<string, any>,
  tokens: string[],
  entity: SearchEntityConfig,
  titleText: string,
): number {
  const titleLower = titleText.toLowerCase();

  // Priority field texts (config order = weight order)
  const priorityTexts = entity.searchFields.map((f) => toSearchText(data[f]));

  // Baaki sab fields ka combined text (har cheez searchable — "sara kuch")
  let restText = '';
  for (const [key, val] of Object.entries(data)) {
    if (entity.searchFields.includes(key)) continue;
    if (SKIP_FIELD_RE.test(key)) continue;
    restText += ' ' + toSearchText(val);
  }

  let total = 0;

  for (const token of tokens) {
    let tokenScore = 0;

    // 1) Title — sabse strong
    if (titleLower === token) tokenScore = Math.max(tokenScore, 120);
    else if (titleLower.startsWith(token)) tokenScore = Math.max(tokenScore, 70);
    else if (titleLower.includes(token)) tokenScore = Math.max(tokenScore, 45);

    // 2) Priority fields
    for (let i = 0; i < priorityTexts.length; i++) {
      const pt = priorityTexts[i];
      if (!pt) continue;
      if (pt.includes(token)) {
        tokenScore = Math.max(tokenScore, Math.max(12, 30 - i * 2));
      }
      // numeric exact match (chest no, amount, phone)
      if (pt.split(/[^a-z0-9]+/).includes(token)) {
        tokenScore = Math.max(tokenScore, 40);
      }
    }

    // 3) Baaki fields
    if (tokenScore === 0 && restText.includes(token)) tokenScore = 6;

    if (tokenScore === 0) return 0; // AND semantics — har token zaroori
    total += tokenScore;
  }

  return total;
}

// ─────────────────────────────────────────────
// MAIN SEARCH
// ─────────────────────────────────────────────
const PER_ENTITY_RESULTS = 8;

export async function searchAll(rawQuery: string, userRole: string): Promise<SearchGroup[]> {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const entities = SEARCH_ENTITIES.filter((e) => canAccess(e.roles, userRole));

  const settled = await Promise.allSettled(
    entities.map(async (entity): Promise<SearchGroup> => {
      const docs = await getCollectionDocs(entity.collection, entity.maxFetch);

      const scored: SearchResultItem[] = [];
      for (const { id, data } of docs) {
        let title = '';
        try { title = entity.title(data) || '(Record)'; } catch { title = '(Record)'; }
        const score = scoreDoc(data, tokens, entity, title);
        if (score <= 0) continue;

        let subtitle = '';
        let badge: string | null = null;
        try { subtitle = entity.subtitle(data) || ''; } catch { /* ignore */ }
        try { badge = entity.badge ? entity.badge(data) : null; } catch { /* ignore */ }

        scored.push({
          docId: id,
          entityId: entity.id,
          entityLabel: entity.label,
          title,
          subtitle,
          badge,
          route: entity.route(userRole),
          score,
        });
      }

      scored.sort((a, b) => b.score - a.score);
      return {
        entity,
        items: scored.slice(0, PER_ENTITY_RESULTS),
        totalMatches: scored.length,
      };
    }),
  );

  return settled
    .map((r, i): SearchGroup | null => {
      if (r.status === 'fulfilled') return r.value;
      // Firestore rules ne block kiya ya network error — section chhupa do, crash mat karo
      console.warn(`[GlobalSearch] ${entities[i].collection} search failed:`, r.reason);
      return null;
    })
    .filter((g): g is SearchGroup => g !== null && g.items.length > 0);
}

/** Permission summary — modal mein "Aap kya-kya search kar sakte ho" dikhane ke liye */
export function getAllowedEntityLabels(userRole: string): string[] {
  return SEARCH_ENTITIES.filter((e) => canAccess(e.roles, userRole)).map((e) => e.label);
}
