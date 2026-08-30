// ═══════════════════════════════════════════════════════════════════════
// ENTITY RESOLUTION — "chest 23", "Rahul", "size 9 boot"
// ───────────────────────────────────────────────────────────────────────
// Deterministic, authoritative (Firestore) resolution of the people/items
// a command refers to. Never guesses on ambiguity — returns ALL candidates
// with distinguishing info so the agent can ask the user to choose.
// Batch scoping is enforced here: trainees resolve ONLY inside the
// authorized/selected batch.
// ═══════════════════════════════════════════════════════════════════════

import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import type { AgentContext } from './agentContext';
import { FIXED_ITEMS } from './stockEngine';

const norm = (v: any) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export interface ResolvedTrainee {
  id: string;
  name: string;
  chestNo: string;
  batchId: string;
  batchNumber?: string;
  platoon?: string;
  rank?: string;
  status?: string;
}

export interface ResolutionResult<T> {
  status: 'unique' | 'ambiguous' | 'notfound';
  entity?: T;
  candidates?: T[];
  /** clarifying question when ambiguous/notfound */
  ask?: string;
}

/**
 * Extract a chest-number token from natural text.
 * Handles: "chest 23", "chest no 3", "23 no chest", "#23", "chest number 45"
 */
export function extractChestNo(text: string): string | null {
  const t = ' ' + text.toLowerCase();
  let m =
    t.match(/chest\s*(?:no\.?|number)?\s*(\d{1,3})\b/) ||
    t.match(/(\d{1,3})\s*(?:no\.?|number)?\s*chest\b/) ||
    t.match(/#\s*(\d{1,3})\b/);
  if (m) return String(parseInt(m[1], 10));
  // Hindi: "chest 23 wale"
  m = t.match(/seena\s*(?:number|no)?\s*(\d{1,3})/);
  if (m) return String(parseInt(m[1], 10));
  return null;
}

/** Fetch trainees visible under the current batch authorization. */
export async function fetchScopedTrainees(ctx: AgentContext): Promise<ResolvedTrainee[]> {
  const snap = await getDocs(query(collection(db, 'trainees')));
  const rows: ResolvedTrainee[] = [];
  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, any>;
    if (!showDoc(data)) return;
    const bid = String(data.batchId ?? '');
    // SO: only assigned batches. Others: only selected batch. CC: all.
    if (!ctx.isCC) {
      if (ctx.isSO) {
        if (!(ctx.inspectionScope ?? []).includes(bid)) return;
      } else if (ctx.selectedBatch && bid !== ctx.selectedBatch.id) {
        return;
      }
    }
    rows.push({
      id: d.id,
      name: String(data.name ?? ''),
      chestNo: String(data.chestNo ?? ''),
      batchId: bid,
      batchNumber: data.batchNumber,
      platoon: data.platoon,
      rank: data.rank,
      status: data.status,
    });
  });
  return rows;
}

/**
 * Resolve a trainee by chest number (preferred) or name, within scope.
 * `term` may be free text containing "chest N" or a name.
 */
export async function resolveTrainee(
  ctx: AgentContext,
  term: string,
): Promise<ResolutionResult<ResolvedTrainee>> {
  const trainees = await fetchScopedTrainees(ctx);
  const chest = extractChestNo(term);

  if (chest !== null) {
    const exact = trainees.filter((x) => x.chestNo === chest);
    if (exact.length === 1) return { status: 'unique', entity: exact[0] };
    if (exact.length > 1) {
      return {
        status: 'ambiguous',
        candidates: exact,
        ask: `Chest ${chest} par ${exact.length} trainees mile (${exact
          .map((e) => `${e.name}/${e.batchNumber ?? e.batchId}`)
          .join(', ')}). Kaunsa?`,
      };
    }
    return {
      status: 'notfound',
      ask: `Chest ${chest} ka trainee current batch(es) me nahi mila. Sahi chest number ya naam batao.`,
    };
  }

  // Name match (contains, on name words)
  const wanted = norm(term).replace(/\s*(ki|ka|ke|ko|batao|dikhao|record|attendance|attendence)\b/g, ' ').trim();
  const nameHits = trainees.filter((x) => {
    const n = norm(x.name);
    if (!wanted) return false;
    return n === wanted || n.includes(wanted) || wanted.includes(n) ||
      wanted.split(/\s+/).some((w) => w.length > 2 && n.includes(w));
  });

  if (nameHits.length === 1) return { status: 'unique', entity: nameHits[0] };
  if (nameHits.length > 1) {
    const list = nameHits.slice(0, 8).map((e) => `#${e.chestNo} ${e.name} (${e.batchNumber ?? e.batchId}${e.platoon ? ', ' + e.platoon : ''})`);
    return {
      status: 'ambiguous',
      candidates: nameHits.slice(0, 8),
      ask: `"${term}" se ${nameHits.length} trainees mile:\n${list.join('\n')}\nKaunsa matlab hai? Chest number bata do.`,
    };
  }
  return {
    status: 'notfound',
    ask: `"${term}" naam ka trainee current batch me nahi mila. Chest number ya poora naam batao.`,
  };
}

export interface ResolvedItem {
  itemName: string;
  category: string;
}

/** Resolve an inventory item by name (boot → DM Shoes, t-shirt → PT T-Shirt…). */
export function resolveItem(term: string): { status: 'unique' | 'ambiguous' | 'notfound'; item?: ResolvedItem; candidates?: string[] } {
  const t = norm(term);
  // Map common Hindi/English words → catalog keywords
  const alias: Record<string, string> = {
    boot: 'shoes', boots: 'shoes', joota: 'shoes', jute: 'shoes', shoes: 'shoes',
    't-shirt': 't-shirt', tshirt: 't-shirt', shirt: 't-shirt', kamiz: 't-shirt',
    bucket: 'bucket', balti: 'bucket',
    plate: 'plate', thali: 'plate',
    glass: 'glass', glaas: 'glass',
    mug: 'mug',
    groundsheet: 'ground sheet', 'ground sheet': 'ground sheet',
    tin: 'mess tin', 'mess tin': 'mess tin',
  };
  let key = t;
  for (const [k, v] of Object.entries(alias)) {
    if (t.includes(k)) { key = v; break; }
  }
  const hits = FIXED_ITEMS.filter((i) => norm(i.name).includes(norm(key)) || norm(i.name).includes(t) || t.includes(norm(i.name).split(' ')[0]));
  if (hits.length === 1) return { status: 'unique', item: { itemName: hits[0].name, category: hits[0].category } };
  if (hits.length > 1) return { status: 'ambiguous', candidates: hits.map((h) => h.name) };
  return { status: 'notfound', candidates: FIXED_ITEMS.map((i) => i.name) };
}

/** Extract a size token ("size 9", "size M", "9 size"). */
export function extractSize(text: string): string | null {
  const t = text.toLowerCase();
  let m = t.match(/size\s*([0-9]{1,2}|xxl|xl|[sml])\b/) || t.match(/\b([0-9]{1,2}|xxl|xl|[sml])\s*size\b/);
  if (m) return m[1].toUpperCase();
  return null;
}

/** Extract a leading quantity ("10 trainees", "5 boot", "20 naye"). */
export function extractQuantity(text: string): number | null {
  const m = text.match(/\b(\d{1,4})\s*(naye|new|trainees?|jawan|rangroot|boot|boots|joota|plate|bucket|mug)?/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  // Only treat as quantity when there's a noun hint OR it's the leading token
  if (m[2] || /^\s*\d/.test(text)) return n;
  return null;
}
