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
  collection, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import {
  runQuery, runJoin, findEntity, getSystemOverview, getActiveBatchInfo,
  type QuerySpec, type JoinSpec,
} from './queryEngine';
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
export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'query_data',
      description:
        'Kisi bhi Firestore collection se data padho. Filter, group-by, aggregate (sum/avg/count), sort sab kar sakte ho. ' +
        'Ye SABSE ZYADA use hone wala tool hai. Counting, listing, totals — sab isi se.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: ALL_COLLECTION_NAMES, description: 'Collection ka naam' },
          filters: {
            type: 'array',
            description: 'Filters. Sab AND me lagte hain.',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', description: 'Field name (nested ke liye dot: documents.aadhar.status)' },
                op: {
                  type: 'string',
                  enum: ['eq','ne','gt','gte','lt','lte','contains','startsWith','in','notIn','exists','empty','between'],
                },
                value:  { description: 'Compare value. "in"/"notIn" ke liye array.' },
                value2: { description: 'Sirf "between" ke liye upper bound.' },
              },
              required: ['field', 'op'],
            },
          },
          groupBy:   { type: 'string', description: 'Is field par group karke counts do (e.g. "state", "religion", "platoon")' },
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
          limit:   { type: 'number', description: 'Default 40, max 200' },
          select:  { type: 'array', items: { type: 'string' }, description: 'Sirf ye fields chahiye' },
          useActiveBatch: { type: 'boolean', description: 'false karo agar saare batches ka data chahiye' },
        },
        required: ['collection'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'join_data',
      description:
        'Do collections ko chestNo (ya kisi aur field) se jodo. ' +
        'Jab sawaal me DO cheezein ho — jaise "Bengal ke trainees jo FPT me fail hue" ' +
        '(trainees.state=West Bengal + fptRecords.status=Fail).',
      parameters: {
        type: 'object',
        properties: {
          left:  { type: 'object', description: 'Pehla query spec (same shape as query_data)' },
          right: { type: 'object', description: 'Dusra query spec' },
          on:    { type: 'string', description: 'Join field, default "chestNo"' },
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
      description:
        'Naam, chest number, reg number ya mobile se koi trainee/staff/vendor dhoondo. ' +
        'Jab user kisi vyakti ka naam le — "Rahul ka detail batao".',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Naam ya number' },
          collections: { type: 'array', items: { type: 'string' }, description: 'Default: trainees, staff, vendors' },
        },
        required: ['term'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'describe_schema',
      description:
        'Kisi collection ke saare fields aur unke possible values dekho. ' +
        'Jab pata na ho ki field ka naam kya hai ya value kaisi dikhti hai, TAB PEHLE ye call karo.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', description: 'Collection name. Khaali chhodo to saari collections ki list milegi.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sample_values',
      description:
        'Kisi field me asal me kaunsi values padi hain, ye dekho (distinct values + counts). ' +
        'Filter lagane se PEHLE ye check karo taaki spelling galat na ho.',
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
      description: 'Active batch, total trainees/staff/vendors ka quick snapshot. Aam sawaalon ke liye.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_trainee',
      description: 'Naya trainee add karo. Sirf tab jab user SAAF taur par add karne bole.',
      parameters: {
        type: 'object',
        properties: {
          names: { type: 'array', items: { type: 'string' }, description: 'Ek ya zyada naam' },
        },
        required: ['names'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_trainee',
      description: 'Kisi trainee ka data update karo (chest number se). Sirf saaf update command par.',
      parameters: {
        type: 'object',
        properties: {
          chestNo: { type: 'string' },
          updates: { type: 'object', description: 'Field:value pairs' },
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
