// ═══════════════════════════════════════════════════════════
// UNIVERSAL QUERY ENGINE
// ───────────────────────────────────────────────────────────
// Ye engine KISI BHI collection ko padh sakta hai, filter laga
// sakta hai, group kar sakta hai, sum/avg nikaal sakta hai,
// aur do collections ko chest number se JOIN kar sakta hai.
//
// AI ise "tool" ki tarah call karta hai — hardcoded if-else nahi.
// ═══════════════════════════════════════════════════════════

import { collection, getDocs, query, where, limit as fbLimit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import { currentScopedBatchId } from '../../../utils/batchScope';
import { COLLECTION_MAP, type CollectionDef } from '../knowledge/collectionRegistry';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export type Op =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'startsWith' | 'in' | 'notIn'
  | 'exists' | 'empty' | 'between';

export interface Filter {
  field: string;
  op: Op;
  value?: any;
  /** between ke liye */
  value2?: any;
}

export interface QuerySpec {
  collection: string;
  filters?: Filter[];
  /** kis field par group karke count nikalna hai */
  groupBy?: string;
  /** numeric field jiska sum/avg chahiye */
  aggregate?: { field: string; fn: 'sum' | 'avg' | 'min' | 'max' | 'count' };
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  /** sirf ye fields return karo (response chhota rakhne ke liye) */
  select?: string[];
  /** active batch tak simit rakhein? (default: collection ki setting) */
  useActiveBatch?: boolean;
}

export interface QueryResult {
  collection: string;
  totalMatched: number;
  totalScanned: number;
  rows: Record<string, any>[];
  groups?: { value: string; count: number; sum?: number }[];
  aggregate?: { fn: string; field: string; value: number };
  truncated: boolean;
  note?: string;
}

// ─────────────────────────────────────────────
// CACHE — ek hi sawaal me bar bar same collection na padhein
// ─────────────────────────────────────────────
const docCache = new Map<string, { at: number; docs: any[] }>();
const CACHE_TTL = 60_000; // 60 sec

export function clearQueryCache() { docCache.clear(); }

// ─────────────────────────────────────────────
// ACTIVE / SELECTED BATCH
// ─────────────────────────────────────────────
// ⛓️ The AI MUST follow the same batch the user is currently viewing in the
// UI. BatchContext keeps `batchScope` synced to the user's selected batch
// (default = the real active batch). We prefer that scope; we only fall
// back to a Firestore lookup when no scope is registered (e.g. standalone
// scripts/tests).
let activeBatchCache: { at: number; batch: any } | null = null;
let batchDocCache: { at: number; docs: Map<string, any> } | null = null;

export async function getActiveBatchInfo(): Promise<any | null> {
  // 1) Prefer the batch the user has actually selected in the UI.
  const scopedId = currentScopedBatchId();
  if (scopedId) {
    try {
      const batchDocs = await getBatchDocs();
      const selected = batchDocs.get(scopedId);
      if (selected) return selected;
      // scope id not found in Firestore — synthesize a minimal stub so the
      // batch filter still applies (empty result instead of leaking others)
      return { id: scopedId, batchNumber: scopedId, batchName: scopedId, status: 'active' };
    } catch {
      return { id: scopedId, batchNumber: scopedId, batchName: scopedId, status: 'active' };
    }
  }

  if (activeBatchCache && Date.now() - activeBatchCache.at < CACHE_TTL) {
    return activeBatchCache.batch;
  }
  try {
    const snap = await getDocs(
      query(collection(db, 'batches'), where('status', '==', 'active'), fbLimit(1)),
    );
    let batch: any = null;
    if (!snap.empty) batch = { id: snap.docs[0].id, ...snap.docs[0].data() };
    else {
      const any = await getDocs(query(collection(db, 'batches'), fbLimit(1)));
      if (!any.empty) batch = { id: any.docs[0].id, ...any.docs[0].data() };
    }
    activeBatchCache = { at: Date.now(), batch };
    return batch;
  } catch {
    return null;
  }
}

async function getBatchDocs(): Promise<Map<string, any>> {
  if (batchDocCache && Date.now() - batchDocCache.at < CACHE_TTL) {
    return batchDocCache.docs;
  }
  const snap = await getDocs(query(collection(db, 'batches')));
  const map = new Map<string, any>();
  snap.docs.forEach(d => {
    const b = { id: d.id, ...d.data() } as any;
    map.set(d.id, b);
  });
  batchDocCache = { at: Date.now(), docs: map };
  activeBatchCache = { at: Date.now(), batch: map.get([...map.values()].find((b: any) => b.status === 'active')?.id ?? '') ?? null };
  return map;
}

// ─────────────────────────────────────────────
// RAW FETCH
// ─────────────────────────────────────────────
async function fetchCollection(name: string, max: number): Promise<any[]> {
  const key = `${name}:${max}`;
  const hit = docCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.docs;

  const snap = await getDocs(query(collection(db, name), fbLimit(max)));
  const docs = snap.docs.filter(d => showDoc(d.data() as Record<string, unknown>)).map(d => ({ id: d.id, ...d.data() } as any));
  docCache.set(key, { at: Date.now(), docs });
  return docs;
}

// ─────────────────────────────────────────────
// VALUE HELPERS
// ─────────────────────────────────────────────
const norm = (v: any): string => String(v ?? '').trim().toLowerCase();

const num = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

/** nested path support: "documents.aadhar.status" */
function getPath(obj: any, path: string): any {
  if (!path.includes('.')) return obj?.[path];
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function toDate(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().getTime();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// ─────────────────────────────────────────────
// FILTER MATCHING
// ─────────────────────────────────────────────
function matchFilter(row: any, f: Filter): boolean {
  const raw = getPath(row, f.field);

  switch (f.op) {
    case 'exists': return raw !== undefined && raw !== null && String(raw).trim() !== '';
    case 'empty':  return raw === undefined || raw === null || String(raw).trim() === '';

    case 'eq':  return norm(raw) === norm(f.value);
    case 'ne':  return norm(raw) !== norm(f.value);

    case 'contains':   return norm(raw).includes(norm(f.value));
    case 'startsWith': return norm(raw).startsWith(norm(f.value));

    case 'in': {
      const list = (Array.isArray(f.value) ? f.value : [f.value]).map(norm);
      // agar field khud array hai
      if (Array.isArray(raw)) return raw.some(x => list.includes(norm(x)));
      return list.includes(norm(raw));
    }
    case 'notIn': {
      const list = (Array.isArray(f.value) ? f.value : [f.value]).map(norm);
      if (Array.isArray(raw)) return !raw.some(x => list.includes(norm(x)));
      return !list.includes(norm(raw));
    }

    case 'gt': case 'gte': case 'lt': case 'lte': {
      const d1 = toDate(raw), d2 = toDate(f.value);
      const useDate = d1 !== null && d2 !== null && typeof f.value === 'string' && /\d{4}-\d{2}-\d{2}/.test(f.value);
      const a = useDate ? d1! : num(raw);
      const b = useDate ? d2! : num(f.value);
      if (f.op === 'gt')  return a > b;
      if (f.op === 'gte') return a >= b;
      if (f.op === 'lt')  return a < b;
      return a <= b;
    }

    case 'between': {
      const d = toDate(raw);
      const lo = toDate(f.value), hi = toDate(f.value2);
      if (d !== null && lo !== null && hi !== null) return d >= lo && d <= hi;
      const n = num(raw);
      return n >= num(f.value) && n <= num(f.value2);
    }

    default: return true;
  }
}

// ─────────────────────────────────────────────
// MAIN: runQuery
// ─────────────────────────────────────────────
export async function runQuery(spec: QuerySpec): Promise<QueryResult> {
  const def: CollectionDef | undefined = COLLECTION_MAP[spec.collection];

  if (!def) {
    return {
      collection: spec.collection,
      totalMatched: 0, totalScanned: 0, rows: [], truncated: false,
      note: `Collection "${spec.collection}" registry me nahi hai. Available: ${Object.keys(COLLECTION_MAP).slice(0, 12).join(', ')}...`,
    };
  }

  const maxDocs = def.maxDocs ?? 1500;
  let docs = await fetchCollection(def.name, maxDocs);
  const totalScanned = docs.length;

  // ── Batch scoping ──
  // ⛓️ STRICT: an empty scoped result must NEVER fall back to all batches.
  // If the selected batch has 0 records we return 0 records — records from
  // other batches are never shown. Legacy docs without batchId are only
  // included when the scope targets the *real active* batch (handled via
  // scopeVisible semantics), never when scoping returned zero.
  const wantBatch = spec.useActiveBatch ?? def.batchScoped;
  let batchNote = '';
  if (wantBatch && def.batchScoped) {
    const batch = await getActiveBatchInfo();
    if (batch?.id) {
      const before = docs.length;
      const scoped = docs.filter(d => d.batchId === batch.id);
      // ALWAYS apply the filter — zero stays zero, no cross-batch leak.
      docs = scoped;
      batchNote = `Batch "${batch.batchNumber ?? batch.id}" tak simit (${before}→${docs.length} records).`;
    } else {
      // No batch context at all → a batch-scoped collection returns nothing
      // rather than every batch's data.
      docs = [];
      batchNote = 'Koi selected batch nahi — batch-scoped data nahi dikhaya gaya.';
    }
  }

  // ── Filters ──
  for (const f of spec.filters ?? []) {
    docs = docs.filter(d => matchFilter(d, f));
  }
  const totalMatched = docs.length;

  // ── Group by ──
  let groups: QueryResult['groups'];
  if (spec.groupBy) {
    const map = new Map<string, { count: number; sum: number }>();
    for (const d of docs) {
      const key = String(getPath(d, spec.groupBy) ?? '').trim() || '(blank)';
      const cur = map.get(key) ?? { count: 0, sum: 0 };
      cur.count++;
      if (spec.aggregate?.field) cur.sum += num(getPath(d, spec.aggregate.field));
      map.set(key, cur);
    }
    groups = Array.from(map.entries())
      .map(([value, v]) => ({
        value, count: v.count,
        ...(spec.aggregate?.field ? { sum: Math.round(v.sum * 100) / 100 } : {}),
      }))
      .sort((a, b) => b.count - a.count);
  }

  // ── Aggregate ──
  let aggregate: QueryResult['aggregate'];
  if (spec.aggregate) {
    const { field, fn } = spec.aggregate;
    const vals = docs.map(d => num(getPath(d, field)));
    let value = 0;
    if (fn === 'count') value = docs.length;
    else if (fn === 'sum') value = vals.reduce((s, v) => s + v, 0);
    else if (fn === 'avg') value = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    else if (fn === 'min') value = vals.length ? Math.min(...vals) : 0;
    else if (fn === 'max') value = vals.length ? Math.max(...vals) : 0;
    aggregate = { fn, field, value: Math.round(value * 100) / 100 };
  }

  // ── Sort ──
  if (spec.sortBy) {
    const dir = spec.sortDir === 'desc' ? -1 : 1;
    docs = [...docs].sort((a, b) => {
      const av = getPath(a, spec.sortBy!), bv = getPath(b, spec.sortBy!);
      const an = num(av), bn = num(bv);
      if (an !== 0 || bn !== 0) return (an - bn) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }

  // ── Limit + select ──
  const lim = Math.min(spec.limit ?? 40, 200);
  const truncated = docs.length > lim;
  let rows = docs.slice(0, lim);

  const selectFields = spec.select?.length
    ? spec.select
    : [
        def.titleField ?? 'name',
        def.linkField ?? 'chestNo',
        // jin fields par filter/sort/group laga, wo jawab me dikhni chahiye —
        // warna user ko samajh nahi aayega ki row kyun match hui
        ...(spec.filters ?? []).map(f => f.field),
        ...(spec.sortBy ? [spec.sortBy] : []),
        ...(spec.groupBy ? [spec.groupBy] : []),
        ...def.fields.slice(0, 6).map(f => f.name),
      ].filter(Boolean);

  rows = rows.map(r => {
    const out: Record<string, any> = {};
    for (const f of new Set(selectFields)) {
      const v = getPath(r, f);
      if (v !== undefined && v !== null && v !== '') out[f] = v;
    }
    if (Object.keys(out).length === 0) return r;
    return out;
  });

  return {
    collection: def.name,
    totalMatched, totalScanned,
    rows, groups, aggregate, truncated,
    note: batchNote || undefined,
  };
}

// ─────────────────────────────────────────────
// JOIN: do collections ko chestNo se jodo
// e.g. "Bengal ke kitne trainees FPT me fail hue"
// ─────────────────────────────────────────────
export interface JoinSpec {
  left: QuerySpec;
  right: QuerySpec;
  /** default: chestNo */
  on?: string;
  limit?: number;
}

export async function runJoin(spec: JoinSpec): Promise<QueryResult> {
  const on = spec.on ?? 'chestNo';
  const L = await runQuery({ ...spec.left,  limit: 2000, select: undefined });
  const R = await runQuery({ ...spec.right, limit: 2000, select: undefined });

  const rightKeys = new Set(R.rows.map(r => norm(getPath(r, on))).filter(Boolean));
  const matched = L.rows.filter(l => rightKeys.has(norm(getPath(l, on))));

  const lim = Math.min(spec.limit ?? 40, 200);
  return {
    collection: `${L.collection} ⋈ ${R.collection}`,
    totalMatched: matched.length,
    totalScanned: L.totalScanned + R.totalScanned,
    rows: matched.slice(0, lim),
    truncated: matched.length > lim,
    note: `${L.collection}: ${L.totalMatched} rows, ${R.collection}: ${R.totalMatched} rows, joined on "${on}".`,
  };
}

// ─────────────────────────────────────────────
// FIND: naam ya chest se koi bhi entity dhoondo
// ─────────────────────────────────────────────
export async function findEntity(
  term: string,
  collections: string[] = ['trainees', 'staff', 'vendors'],
): Promise<QueryResult[]> {
  const out: QueryResult[] = [];
  const t = norm(term);

  for (const cName of collections) {
    const def = COLLECTION_MAP[cName];
    if (!def) continue;
    const docs = await fetchCollection(cName, def.maxDocs ?? 1500);

    const hits = docs.filter(d => {
      const searchable = [
        d.name, d.traineeName, d.staffName, d.vendorName,
        d.chestNo, d.regNo, d.forceNo, d.fatherName, d.mobileNo,
      ].map(norm).join(' ');
      return searchable.includes(t);
    });

    if (hits.length) {
      out.push({
        collection: cName,
        totalMatched: hits.length,
        totalScanned: docs.length,
        rows: hits.slice(0, 10),
        truncated: hits.length > 10,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// OVERVIEW: poore system ka snapshot
// ─────────────────────────────────────────────
export async function getSystemOverview(): Promise<Record<string, any>> {
  const batch = await getActiveBatchInfo();
  const out: Record<string, any> = {
    activeBatch: batch
      ? { number: batch.batchNumber, name: batch.batchName, status: batch.status }
      : 'Koi active batch nahi',
    today: new Date().toISOString().split('T')[0],
  };

  const quick = async (name: string, label: string) => {
    try {
      const r = await runQuery({ collection: name, limit: 1 });
      out[label] = r.totalMatched;
    } catch { /* ignore */ }
  };

  await Promise.all([
    quick('trainees', 'totalTrainees'),
    quick('staff', 'totalStaff'),
    quick('vendors', 'totalVendors'),
    quick('absentRecords', 'absentRecords'),
  ]);

  return out;
}
