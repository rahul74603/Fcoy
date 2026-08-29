// ═══════════════════════════════════════════════════════════
// AGENT TOOLS
// ───────────────────────────────────────────────────────────
// Ye wo "haath" hain jinse AI Firebase ko chhoo sakta hai.
// AI khud decide karta hai kaunsa tool, kaunse arguments —
// hum sirf tool ko execute karke result wapas dete hain.
//
// SAFETY: Default me sab READ-ONLY. Write tools tabhi chalte
// hain jab caller explicitly allowWrites: true bheje.
// ═══════════════════════════════════════════════════════════

import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import {
  runQuery, runJoin, findEntity, getSystemOverview, getActiveBatchInfo,
  clearQueryCache, type QuerySpec, type JoinSpec,
} from './queryEngine';
import { findStock, clearStockCache } from './stockEngine';
import {
  COLLECTIONS, COLLECTION_MAP, ALL_COLLECTION_NAMES,
} from '../knowledge/collectionRegistry';

export interface ToolContext {
  userEmail: string;
  userRole: string;
  allowWrites: boolean;
}

export interface ToolResult {
  ok: boolean;
  data: any;
  /** AI ko dikhane ke liye compact summary */
  summary: string;
}

// ═══════════════════════════════════════════════════════════
// TOOL SCHEMAS (OpenAI/Groq function-calling format)
// ═══════════════════════════════════════════════════════════
// NOTE: Descriptions jaan-boojh kar CHHOTI rakhi hain.
// Har API call me ye poora schema jaata hai — lamba likhne se
// Groq ka free TPM (12,000/min) 3-4 call me hi khatam ho jaata tha.
// Detailed guidance system prompt me hai, yahan nahi.
export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'query_data',
      description: 'Read any collection: filter, groupBy, aggregate (sum/avg/count), sort. Main tool.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: ALL_COLLECTION_NAMES },
          filters: {
            type: 'array',
            description: 'AND-ed filters',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                op: {
                  type: 'string',
                  enum: ['eq','ne','gt','gte','lt','lte','contains','startsWith','in','notIn','exists','empty','between'],
                },
                value:  { type: 'string', description: 'value (array for in/notIn)' },
                value2: { type: 'string', description: 'upper bound for between' },
              },
              required: ['field', 'op'],
            },
          },
          groupBy:   { type: 'string', description: 'group + count by this field' },
          aggregate: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              fn: { type: 'string', enum: ['sum','avg','min','max','count'] },
            },
            required: ['field','fn'],
          },
          sortBy:  { type: 'string' },
          sortDir: { type: 'string', enum: ['asc','desc'] },
          limit:   { type: 'number' },
          select:  { type: 'array', items: { type: 'string' } },
          useActiveBatch: { type: 'boolean', description: 'false = all batches' },
        },
        required: ['collection'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'join_data',
      description: 'Join 2 collections on chestNo. Use when question has 2 conditions across collections.',
      parameters: {
        type: 'object',
        properties: {
          left:  { type: 'object', description: 'query_data spec' },
          right: { type: 'object', description: 'query_data spec' },
          on:    { type: 'string', description: 'default chestNo' },
          limit: { type: 'number' },
        },
        required: ['left','right'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_entity',
      description: 'Find person by name/chest/reg/mobile across trainees, staff, vendors.',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'string' },
          collections: { type: 'array', items: { type: 'string' } },
        },
        required: ['term'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'describe_schema',
      description: 'Get fields + possible values of a collection. Empty arg = list all collections.',
      parameters: {
        type: 'object',
        properties: { collection: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sample_values',
      description: 'See actual distinct values in a field. Use before filtering to avoid spelling mismatch.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string' },
          field: { type: 'string' },
        },
        required: ['collection','field'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'system_overview',
      description: 'Active batch + total trainees/staff/vendors snapshot.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stock',
      description:
        'Inventory/stock. ALWAYS use this for stock questions (item_master is empty legacy). ' +
        'Computes purchased minus issued, with size breakdown.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'item name, partial ok (e.g. "t-shirt", "shoes"). omit = all' },
          size: { type: 'string', description: 'size filter (S/M/L/XL or shoe size)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_record',
      description:
        'Create a document in ANY collection. Use only on explicit user command to add/create/save.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: ALL_COLLECTION_NAMES },
          data: { type: 'object', description: 'field:value pairs' },
        },
        required: ['collection', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_record',
      description:
        'Update a document in ANY collection. Find the doc first (query_data/find_entity) to get its id.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: ALL_COLLECTION_NAMES },
          docId: { type: 'string', description: 'document id' },
          updates: { type: 'object', description: 'field:value pairs to change' },
        },
        required: ['collection', 'docId', 'updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_record',
      description:
        'Delete a document. DESTRUCTIVE — only when user clearly says delete/hatao/remove. ' +
        'Always confirm what will be deleted in your reply.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: ALL_COLLECTION_NAMES },
          docId: { type: 'string' },
        },
        required: ['collection', 'docId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_trainee',
      description: 'Add new trainee(s) with auto chest number. Only on explicit add command.',
      parameters: {
        type: 'object',
        properties: { names: { type: 'array', items: { type: 'string' } } },
        required: ['names'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_trainee',
      description: 'Update a trainee by chest number. Only on explicit update command.',
      parameters: {
        type: 'object',
        properties: {
          chestNo: { type: 'string' },
          updates: { type: 'object', description: 'field:value pairs' },
        },
        required: ['chestNo','updates'],
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════
// TOOL EXECUTOR
// ═══════════════════════════════════════════════════════════
export async function executeTool(
  name: string,
  args: any,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    switch (name) {

      // ─────────── QUERY ───────────
      case 'query_data': {
        const r = await runQuery(args as QuerySpec);
        let summary = `${r.collection}: ${r.totalMatched} records mile`;
        if (r.aggregate) summary += ` | ${r.aggregate.fn}(${r.aggregate.field}) = ${r.aggregate.value}`;
        if (r.groups)    summary += ` | ${r.groups.length} groups`;
        if (r.note)      summary += ` | ${r.note}`;
        return { ok: true, data: r, summary };
      }

      // ─────────── JOIN ───────────
      case 'join_data': {
        const r = await runJoin(args as JoinSpec);
        return {
          ok: true, data: r,
          summary: `Join: ${r.totalMatched} matched. ${r.note ?? ''}`,
        };
      }

      // ─────────── FIND ───────────
      case 'find_entity': {
        const results = await findEntity(args.term, args.collections);
        const total = results.reduce((s, r) => s + r.totalMatched, 0);
        return {
          ok: true,
          data: results,
          summary: total ? `"${args.term}" ke liye ${total} match mile` : `"${args.term}" kahin nahi mila`,
        };
      }

      // ─────────── SCHEMA ───────────
      case 'describe_schema': {
        if (!args?.collection) {
          const list = COLLECTIONS.map(c => ({
            name: c.name, domain: c.domain, description: c.description,
            batchScoped: c.batchScoped,
          }));
          return { ok: true, data: list, summary: `${list.length} collections available` };
        }
        const def = COLLECTION_MAP[args.collection];
        if (!def) {
          return {
            ok: false,
            data: { available: ALL_COLLECTION_NAMES },
            summary: `"${args.collection}" nahi mila. Sahi naam list me se chuno.`,
          };
        }
        return {
          ok: true,
          data: {
            name: def.name, description: def.description,
            batchScoped: def.batchScoped, linkField: def.linkField,
            fields: def.fields.map(f => ({
              name: f.name, kind: f.kind, label: f.label,
              ...(f.values ? { possibleValues: f.values } : {}),
            })),
          },
          summary: `${def.name}: ${def.fields.length} fields`,
        };
      }

      // ─────────── SAMPLE VALUES ───────────
      case 'sample_values': {
        const r = await runQuery({
          collection: args.collection,
          groupBy: args.field,
          limit: 1,
          useActiveBatch: false,
        });
        const groups = (r.groups ?? []).slice(0, 40);
        return {
          ok: true,
          data: { field: args.field, distinctCount: r.groups?.length ?? 0, values: groups },
          summary: `${args.collection}.${args.field} me ${groups.length} alag values hain`,
        };
      }

      // ─────────── OVERVIEW ───────────
      case 'system_overview': {
        const o = await getSystemOverview();
        return { ok: true, data: o, summary: JSON.stringify(o) };
      }

      // ─────────── STOCK (asli inventory) ───────────
      case 'get_stock': {
        const r = await findStock(args?.item, args?.size);

        // AI ko compact bhejo — poora object bahut bada ho jaata hai
        const compact = r.items.slice(0, 40).map(i => ({
          item: i.itemName,
          category: i.category,
          purchased: i.purchased,
          issued: i.issued,
          balance: i.balance,
          ...(i.sizes.length
            ? { sizes: i.sizes.map(s => `${s.size}: ${s.balance} left (${s.purchased} bought, ${s.issued} issued)`) }
            : {}),
          ...(i.totalValue ? { value: i.totalValue } : {}),
        }));

        return {
          ok: true,
          data: { items: compact, totals: r.totals, note: r.note, sources: r.sources },
          summary: r.items.length
            ? `${r.items.length} item(s): ${r.totals.totalBalance} balance ` +
              `(${r.totals.totalPurchased} bought − ${r.totals.totalIssued} issued)`
            : r.note,
        };
      }

      // ─────────── WRITE: ANY COLLECTION ───────────
      case 'add_record': {
        if (!ctx.allowWrites) {
          return { ok: false, data: null, summary: 'Write permission nahi hai (read-only role).' };
        }
        const def = COLLECTION_MAP[args.collection];
        if (!def) {
          return { ok: false, data: { available: ALL_COLLECTION_NAMES },
                   summary: `"${args.collection}" registry me nahi hai.` };
        }

        const payload: Record<string, any> = { ...(args.data ?? {}) };

        // Batch-scoped collection me batchId apne aap lag jaye
        if (def.batchScoped && !payload.batchId) {
          const b = await getActiveBatchInfo();
          if (b?.id) {
            payload.batchId = b.id;
            payload.batchNumber ??= b.batchNumber ?? '';
            payload.batchName   ??= b.batchName ?? '';
          }
        }
        payload.source    = 'ai-agent';
        payload.addedBy   = ctx.userEmail;
        payload.createdAt = serverTimestamp();

        const ref = await addDoc(collection(db, def.name), payload);
        clearQueryCache(); clearStockCache();

        return {
          ok: true,
          data: { id: ref.id, collection: def.name, saved: args.data },
          summary: `${def.name} me naya record bana (id: ${ref.id})`,
        };
      }

      case 'update_record': {
        if (!ctx.allowWrites) {
          return { ok: false, data: null, summary: 'Write permission nahi hai (read-only role).' };
        }
        if (args.collection === 'staff_leave' && args.updates && (args.updates.status === 'approved' || args.updates.status === 'rejected' || args.updates.status === 'cancelled')) {
          if (ctx.userRole !== 'Company Commander') {
            return { ok: false, data: null, summary: 'Permission denied: Only Company Commander can approve/reject leave.' };
          }
        }
        const def = COLLECTION_MAP[args.collection];
        if (!def) {
          return { ok: false, data: null, summary: `"${args.collection}" registry me nahi hai.` };
        }

        const ref  = doc(db, def.name, args.docId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          return { ok: false, data: null,
                   summary: `${def.name} me id "${args.docId}" nahi mila. Pehle query_data se sahi id lo.` };
        }

        await updateDoc(ref, {
          ...args.updates,
          updatedAt: serverTimestamp(),
          updatedBy: ctx.userEmail,
        });
        clearQueryCache(); clearStockCache();

        const before = snap.data() as any;
        return {
          ok: true,
          data: {
            id: args.docId,
            name: before?.name ?? before?.itemName ?? before?.traineeName ?? '',
            changed: args.updates,
          },
          summary: `${def.name}/${args.docId} update ho gaya: ` +
                   Object.entries(args.updates ?? {}).map(([k, v]) => `${k}=${v}`).join(', '),
        };
      }

      case 'delete_record': {
        if (!ctx.allowWrites) {
          return { ok: false, data: null, summary: 'Write permission nahi hai (read-only role).' };
        }
        const def = COLLECTION_MAP[args.collection];
        if (!def) {
          return { ok: false, data: null, summary: `"${args.collection}" registry me nahi hai.` };
        }

        const ref  = doc(db, def.name, args.docId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          return { ok: false, data: null, summary: `${def.name} me id "${args.docId}" nahi mila.` };
        }
        const before = snap.data() as any;

        await deleteDoc(ref);
        clearQueryCache(); clearStockCache();

        return {
          ok: true,
          data: { deleted: args.docId, collection: def.name, was: before },
          summary: `DELETED ${def.name}/${args.docId} ` +
                   `(${before?.name ?? before?.itemName ?? before?.traineeName ?? 'record'})`,
        };
      }

      // ─────────── WRITE: ADD ───────────
      case 'add_trainee': {
        if (!ctx.allowWrites) {
          return { ok: false, data: null, summary: 'Write permission nahi hai. Read-only mode.' };
        }
        const batch = await getActiveBatchInfo();
        if (!batch?.id) return { ok: false, data: null, summary: 'Koi batch nahi mila. Pehle batch banao.' };

        const existing = await runQuery({ collection: 'trainees', limit: 2000, useActiveBatch: true, select: ['chestNo'] });
        let next = Math.max(0, ...existing.rows.map(r => parseInt(String(r.chestNo), 10)).filter(n => !Number.isNaN(n)));

        const added: string[] = [];
        for (const nm of (args.names ?? [])) {
          next += 1;
          await addDoc(collection(db, 'trainees'), {
            name: String(nm).trim(),
            chestNo: String(next),
            batchId: batch.id,
            batchName: batch.batchName ?? '',
            batchNumber: batch.batchNumber ?? '',
            status: 'active', attn: 'P', rank: 'RCT',
            source: 'ai-agent', addedBy: ctx.userEmail,
            createdAt: serverTimestamp(),
          });
          added.push(`${nm} → Chest #${next}`);
        }
        return { ok: true, data: { added }, summary: `${added.length} trainee add hue: ${added.join(', ')}` };
      }

      // ─────────── WRITE: UPDATE ───────────
      case 'update_trainee': {
        if (!ctx.allowWrites) {
          return { ok: false, data: null, summary: 'Write permission nahi hai. Read-only mode.' };
        }
        const found = await runQuery({
          collection: 'trainees',
          filters: [{ field: 'chestNo', op: 'eq', value: String(args.chestNo) }],
          limit: 1, useActiveBatch: true, select: undefined,
        });
        if (!found.rows.length) {
          return { ok: false, data: null, summary: `Chest #${args.chestNo} nahi mila` };
        }
        const target: any = found.rows[0];
        await updateDoc(doc(db, 'trainees', target.id), {
          ...args.updates,
          updatedAt: serverTimestamp(),
          updatedBy: ctx.userEmail,
        });
        return {
          ok: true,
          data: { chestNo: args.chestNo, updates: args.updates },
          summary: `Chest #${args.chestNo} (${target.name ?? ''}) update ho gaya`,
        };
      }

      default:
        return { ok: false, data: null, summary: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`Tool "${name}" failed:`, err);
    return { ok: false, data: null, summary: `Tool error: ${err?.message ?? err}` };
  }
}
