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
import type { AgentContext } from './agentContext';
import { resolveBatchForTool, getBatchLabel, canWriteCollection } from './agentContext';
import { resolveTrainee, resolveItem } from './entityResolve';
import { resolveDatePhrase } from './dateResolve';
import { atomicIssue, normalizeKey, type IssueItem } from '../../../utils/inventoryStock';
import {
  getInspections, getFindings, updateFindingStatus,
  type AppUserLike as InspectionUser,
} from '../../inspection/api/inspection.api';
import { getTrainee360 } from './trainee360';
import { getTrainingScheduleFor, getAttendanceSummary } from './opsData';
import { getFinanceSummary, getFundBalance } from './financeData';
import {
  createTrainees as bizCreateTrainees,
  assignChest as bizAssignChest,
  createInspectionTool as bizCreateInspection,
  createFindingTool as bizCreateFinding,
  submitCorrectiveAction as bizSubmitAction,
  recordExpenseTool as bizRecordExpense,
  getStaffData as bizGetStaff,
  getCompanySummary as bizCompanySummary,
} from './businessTools';

export interface ToolContext {
  userEmail: string;
  userRole: string;
  allowWrites: boolean;
  /**
   * Trusted application context (batch/role/SO scope). Built by the screen
   * from AuthContext + BatchContext — the model can never set this.
   */
  agentCtx?: AgentContext;
  /**
   * Pending write awaiting user confirmation. When set, a write tool whose
   * confirmToken matches is allowed to execute; otherwise destructive/impact
   * writes return a confirmation request instead of mutating data.
   */
  confirmToken?: string;
}

/** Mark a write as needing explicit user confirmation. */
const NEEDS_CONFIRM = 'CONFIRMATION_REQUIRED';

// ─────────────────────────────────────────────
// ROLE AUTHORIZATION (defense in depth — the real enforcement is in
// Firestore security rules; this layer fails fast with a clear message)
// ─────────────────────────────────────────────
const NORMALIZED_ROLE = (r: string): string =>
  String(r ?? '').trim().toLowerCase();

/** Finance/inventory writes (funds, expenses, issues, vendors) = CC or QM */
function canFinance(ctx: ToolContext): boolean {
  const r = NORMALIZED_ROLE(ctx.userRole);
  return r === 'company commander' || r === 'quarter master';
}
/** Staff/training administration writes = CC or Clerk */
function canManageStaff(ctx: ToolContext): boolean {
  const r = NORMALIZED_ROLE(ctx.userRole);
  return r === 'company commander' || r === 'clerk';
}

// Collections the AI may NEVER mutate through the generic write tools.
// These are protected/sensitive — approval flows, identity, licensing.
const GENERIC_WRITE_BLOCKED = new Set([
  'users',
  'staff_leave',      // approval fields are CC-only via dedicated rules
  'leave_types',
  'subscriptionHistory',
  'subscriptionPlans',
  'customers',
  'customerSubscriptions',
  'companyBridges',
  'batches',
  'subject_master',
  'staff_subjects',
  // Inventory ledger — these are ONLY mutated by the atomic issue
  // transaction (src/utils/inventoryStock.ts). Generic AI writes must never
  // bypass the concurrency-safe stock decrement / ledger creation.
  'issue_records',
  'stock_ledgers',
  // SO inspection/finding documents carry required ownership/lifecycle
  // fields enforced by Firestore rules; inspection/finding reads and
  // verification go through the dedicated get_inspections / verify_finding
  // tools, and creation through the Inspection screen (which stamps the
  // inspector/createdBy audit fields). Generic AI writes are blocked.
  'inspections',
  'findings',
  // RelID relegation is a multi-doc atomic transaction (trainee freeze +
  // RelID + later rejoin with chest+R). Generic AI writes would leave
  // half-updated records — use the Relegation Register screen.
  'relegations',
  'traineeAccounts',
  'traineeNotices',
  'staff_activity_logs',
]);

// Which tier may write to which collection (generic add/update/delete).
const FINANCE_COLLECTIONS = new Set([
  'mess_fund_expenses', 'mess_fund_collections', 'mess_custom_categories',
  'mess_boys', 'mess_boy_salaries',
  'training_fund_expenses', 'training_fund_collections', 'training_fund_recoveries',
  'training_custom_items',
  'general_fund_expenses', 'general_fund_collections',
  'company_assets_expenses', 'company_assets_collections', 'company_assets_custom_items',
  'vendors', 'vendor_entries', 'vendor_payments', 'bills',
  'fund_transfers', 'collections', 'expenses', 'recoveries',
  'item_master',
]);
const STAFF_COLLECTIONS = new Set([
  'trainees', 'absentRecords', 'medicalRecords', 'relegations',
  'fptRecords', 'weeklyTestRecords', 'weeklyPrograms',
  'staff', 'staff_attendance', 'staff_duty', 'duty_types',
  'deputation_records', 'training_schedule',
]);

function authorizeGenericWrite(ctx: ToolContext, collection: string): string | null {
  if (!ctx.allowWrites) return 'Write permission nahi hai (read-only role).';
  if (GENERIC_WRITE_BLOCKED.has(collection)) {
    return `SURAKSHA: "${collection}" ko generic write se badla nahi ja sakta. Ye protected collection hai (role/approval/licensing) — sahi business screen use karo.`;
  }
  if (FINANCE_COLLECTIONS.has(collection) && !canFinance(ctx)) {
    return `SURAKSHA: finance/inventory ("${collection}") sirf Company Commander ya Quarter Master likh sakte hain.`;
  }
  if (STAFF_COLLECTIONS.has(collection) && !canManageStaff(ctx)) {
    return `SURAKSHA: staff/training ("${collection}") sirf Company Commander ya Clerk likh sakte hain.`;
  }
  return null;
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

  // ═══════════ HIGH-LEVEL ERP OPERATOR TOOLS (360° agent) ═══════════
  {
    type: 'function',
    function: {
      name: 'get_context',
      description:
        'Current authenticated user, role, selected batch, today local date, and write permissions. Call this FIRST for any batch/role/date question.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_date',
      description:
        'Convert a natural date phrase (aaj/kal/parso/Monday/next week/15 Sep) to an exact local YYYY-MM-DD. Use before schedule/attendance/finance date questions.',
      parameters: {
        type: 'object',
        properties: { phrase: { type: 'string' } },
        required: ['phrase'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trainee',
      description:
        'Resolve a trainee authoritatively by chest number or name, WITHIN the current selected/assigned batch. If ambiguous it returns candidates — then ask the user to choose.',
      parameters: {
        type: 'object',
        properties: { term: { type: 'string', description: '"chest 23" or a name' } },
        required: ['term'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trainee_360',
      description:
        'Full profile for a trainee (profile, attendance, leave, training/FPT, weekly tests, kit, documents). Use for "chest 23 ke baare mein sab batao".',
      parameters: {
        type: 'object',
        properties: { term: { type: 'string', description: '"chest 23" or name' } },
        required: ['term'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_training_schedule',
      description:
        'Training program for a date phrase (aaj/kal/parso/Monday/this week) in the current batch. Always uses local business date.',
      parameters: {
        type: 'object',
        properties: { phrase: { type: 'string', description: 'date phrase, e.g. "kal" or "Monday"' } },
        required: ['phrase'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attendance',
      description:
        'Attendance for current batch: present/absent/on-leave counts + absent list. Optionally a date phrase or a specific trainee ("Rahul ki attendance").',
      parameters: {
        type: 'object',
        properties: {
          phrase: { type: 'string', description: 'optional date phrase' },
          term:   { type: 'string', description: 'optional trainee name/chest' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_finance_summary',
      description:
        'All-fund balances, this-month income/expense, top expenses, vendor payments, pending payments. Finance is global (not batch scoped).',
      parameters: {
        type: 'object',
        properties: { phrase: { type: 'string', description: 'optional date phrase e.g. "is month"' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_fund_balance',
      description: 'Balance of one fund (mess/training/general/company assets): collections − expenses.',
      parameters: {
        type: 'object',
        properties: { fund: { type: 'string' } },
        required: ['fund'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inspections',
      description:
        'SO/CC inspection oversight: inspections, findings, critical/open/overdue/verification-pending counts. SO sees assigned batches only; CC sees all.',
      parameters: {
        type: 'object',
        properties: {
          filter: { type: 'string', enum: ['all', 'open', 'critical', 'overdue', 'verification', 'closed', 'rework'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'issue_inventory',
      description:
        'ISSUE kit/stock to a trainee through the AUTHORITATIVE atomic inventory transaction (stock ledger + issue record + trainee kit update, all-or-nothing). Roles: QM/CC only. Requires confirmation token for the issue.',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'trainee "chest 23" or name' },
          item: { type: 'string', description: 'item, e.g. "DM Shoes" / "boot"' },
          size: { type: 'string', description: 'size, e.g. "9" or "M" (optional)' },
          quantity: { type: 'number', description: 'units to issue (default 1)' },
          confirmToken: { type: 'string', description: 'echo the token from the confirmation response' },
        },
        required: ['term', 'item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_finding',
      description:
        'SO/CC verify-and-close or request-rework on a submitted corrective action finding. CC/SO only. Requires confirmation token.',
      parameters: {
        type: 'object',
        properties: {
          findingTitle: { type: 'string', description: 'finding title/keywords to locate it' },
          action: { type: 'string', enum: ['closed', 'rework'] },
          reworkReason: { type: 'string', description: 'required when action=rework' },
          confirmToken: { type: 'string' },
        },
        required: ['findingTitle', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_trainees',
      description:
        'Create one or many trainees in the CURRENT authorized batch. You MUST pass the actual names the user gave — never invent names/service numbers (no fake data). Chest numbers auto-assign from next available; existing numbers are never overwritten. Roles: Clerk/CC only. Shows a preview and asks for confirmation before writing; then re-reads and reports "X created, Y failed" honestly.',
      parameters: {
        type: 'object',
        properties: {
          names: { type: 'array', items: { type: 'string' }, description: 'trainee names as given by the user (optional trailing service number allowed per name)' },
          count: { type: 'number', description: 'how many the user asked for (when names still needed)' },
          serviceNumbers: { type: 'array', items: { type: 'string' }, description: 'service/enrollment numbers in same order (optional)' },
          batchId: { type: 'string', description: 'only an authorized batch id; usually omitted = selected batch' },
          confirmToken: { type: 'string' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_chest',
      description:
        'Assign a new chest number to an existing trainee in the same batch. If the target chest is already held by someone, it REPORTS the holder and never overwrites. Roles: Clerk/CC only. Requires confirmation; re-reads to verify.',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'trainee "chest 23" or current name' },
          newChest: { type: 'string', description: 'the chest number to assign, e.g. "45"' },
          confirmToken: { type: 'string' },
        },
        required: ['term', 'newChest'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_inspection',
      description:
        'Create an inspection event for an assigned batch. SO/CC only; SO limited to assigned batches. Asks for any missing required fields, previews, then requires confirmation.',
      parameters: {
        type: 'object',
        properties: {
          inspectionType: { type: 'string', description: 'Training/Discipline/Attendance/Accommodation/Mess/Kit / Turnout/Documentation/Welfare/Administration/Safety/General' },
          subject: { type: 'string', description: 'short title of what was inspected' },
          observations: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'observation'] },
          inspectionDate: { type: 'string', description: 'YYYY-MM-DD (default today)' },
          batchId: { type: 'string' },
          confirmToken: { type: 'string' },
        },
        required: ['subject', 'inspectionType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_finding',
      description:
        'Record a finding with a corrective action against an inspection/batch, assigned to a responsible role. SO/CC only; assigned batches only. Missing required fields are asked before writing; confirmation required.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'observation'] },
          assignedToRole: { type: 'string', description: 'Company Commander / Clerk / Quarter Master / Ustad / Senior Officer / Inspector' },
          assignedToName: { type: 'string' },
          dueDate: { type: 'string', description: 'YYYY-MM-DD' },
          correctiveAction: { type: 'string', description: 'what the responsible role must do' },
          category: { type: 'string' },
          inspectionId: { type: 'string', description: 'optional; latest batch inspection used if omitted' },
          batchId: { type: 'string' },
          confirmToken: { type: 'string' },
        },
        required: ['title', 'correctiveAction', 'assignedToRole'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_corrective_action',
      description:
        'Responsible staff (Clerk/QM/Ustad) mark their assigned finding action done and submit for SO/CC verification. Only findings assigned to the caller role are visible.',
      parameters: {
        type: 'object',
        properties: {
          findingTitle: { type: 'string', description: 'title/keywords of the finding' },
        },
        required: ['findingTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_expense',
      description:
        'Record an expense into an existing fund (mess/training/general/assets) using the real fund collection fields. QM/CC only. Preview + confirmation required; re-read verified. Never use generic add_record for finance.',
      parameters: {
        type: 'object',
        properties: {
          fund: { type: 'string', enum: ['mess', 'training', 'general', 'assets'] },
          amount: { type: 'number' },
          purpose: { type: 'string', description: 'what the expense was for (remarks/category)' },
          category: { type: 'string' },
          vendor: { type: 'string' },
          paymentMode: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD (default today)' },
          confirmToken: { type: 'string' },
        },
        required: ['fund', 'amount', 'purpose'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_staff_info',
      description:
        'Staff directory and leave list: staff names/rank/status/subjects, or pending leave requests. CC/Clerk fully; SO sees assigned-batch staff for oversight. Leave approval remains CC-only (this tool never approves).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'optional name/rank filter or "pending leave"' },
          filter: { type: 'string', enum: ['staff', 'pending_leave'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_company_operational_summary',
      description:
        'High-level operational snapshot for the current scope: strength + attendance, open/critical/overdue/pending-verification findings (SO/CC), and a pointer to finance detail (QM/CC). Role-filtered — never leaks other domains.',
      parameters: { type: 'object', properties: {} },
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
        // Finance write ops are impactful → require explicit confirmation.
        if (ctx.agentCtx && canWriteCollection(ctx.agentCtx, String(args.collection))?.ok &&
            ['expenses', 'collections', 'vendor_payments', 'fund_transfers',
             'mess_fund_expenses', 'training_fund_expenses', 'general_fund_expenses',
             'company_assets_expenses', 'recoveries'].includes(String(args.collection)) &&
            args.confirmToken !== ctx.confirmToken) {
          const token = `add-${Date.now()}`;
          return {
            ok: false,
            data: { needsConfirmation: true, confirmToken: token, action: 'add_record',
              preview: { collection: args.collection, data: args.data } },
            summary: `${NEEDS_CONFIRM}: Ye ek finance transaction hai (${args.collection}). Amount/purpose confirm karke confirmToken="${token}" ke saath dobara bhejo.`,
          };
        }
        const def = COLLECTION_MAP[args.collection];
        if (!def) {
          return { ok: false, data: { available: ALL_COLLECTION_NAMES },
                   summary: `"${args.collection}" registry me nahi hai.` };
        }

        const authErr = authorizeGenericWrite(ctx, def.name);
        if (authErr) return { ok: false, data: null, summary: authErr };

        // Role/context authorization (defense in depth with Firestore rules).
        if (ctx.agentCtx) {
          const w = canWriteCollection(ctx.agentCtx, def.name);
          if (!w.ok) return { ok: false, data: null, summary: `SURAKSHA: ${w.reason}` };
        }

        const payload: Record<string, any> = { ...(args.data ?? {}) };

        // Batch-scoped collection: stamp the AUTHORIZED batch. The model may
        // NOT supply its own batchId for SO/staff — resolve from trusted context.
        if (def.batchScoped) {
          if (ctx.agentCtx) {
            const rb = resolveBatchForTool(ctx.agentCtx, payload.batchId);
            if (!rb.ok) return { ok: false, data: null, summary: `SURAKSHA: ${rb.reason}` };
            if (rb.batchId) {
              payload.batchId = rb.batchId;
              const label = await getBatchLabel(rb.batchId);
              payload.batchNumber ??= label.batchNumber ?? '';
              payload.batchName   ??= label.batchName ?? '';
            }
          } else if (!payload.batchId) {
            const b = await getActiveBatchInfo();
            if (b?.id) {
              payload.batchId = b.id;
              payload.batchNumber ??= b.batchNumber ?? '';
              payload.batchName   ??= b.batchName ?? '';
            }
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
        const def = COLLECTION_MAP[args.collection];
        if (!def) {
          return { ok: false, data: null, summary: `"${args.collection}" registry me nahi hai.` };
        }

        const authErr = authorizeGenericWrite(ctx, def.name);
        if (authErr) return { ok: false, data: null, summary: authErr };

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

        // Deletes are destructive: only Company Commander may delete.
        if (NORMALIZED_ROLE(ctx.userRole) !== 'company commander') {
          return { ok: false, data: null,
                   summary: 'SURAKSHA: record delete sirf Company Commander kar sakta hai.' };
        }
        const authErr = authorizeGenericWrite(ctx, def.name);
        if (authErr) return { ok: false, data: null, summary: authErr };

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
      case 'add_trainee':
      case 'create_trainees':
        return bizCreateTrainees(ctx, args);

      case 'assign_chest':
        return bizAssignChest(ctx, args);

      case 'create_inspection':
        return bizCreateInspection(ctx, args);

      case 'create_finding':
        return bizCreateFinding(ctx, args);

      case 'submit_corrective_action':
        return bizSubmitAction(ctx, args);

      case 'record_expense':
        return bizRecordExpense(ctx, args);

      case 'get_staff_info':
        return bizGetStaff(ctx, args);

      case 'get_company_operational_summary':
        return bizCompanySummary(ctx);

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
        // 🔒 Kit/ledger fields are managed ONLY by the atomic inventory issue
        // transaction. AI must never mark a trainee as issued bypassing the
        // stock ledger.
        const FORBIDDEN_KIT_FIELDS = ['issuedKitItems', 'lastKitIssueDate', 'kitIssued'];
        const attempted = Object.keys(args.updates ?? {});
        const forbiddenHit = attempted.filter(f => FORBIDDEN_KIT_FIELDS.includes(f));
        if (forbiddenHit.length) {
          return {
            ok: false, data: null,
            summary: `SURAKSHA: kit issue fields (${forbiddenHit.join(', ')}) sirf Inventory Issue screen ke atomic transaction se badle ja sakte hain — AI se nahi.`,
          };
        }
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

      // ═══════════════════════════════════════════════════════════════
      // 360° ERP OPERATOR TOOLS
      // ═══════════════════════════════════════════════════════════════

      // ── CONTEXT (who am I, which batch, what can I do) ──
      case 'get_context': {
        const c = ctx.agentCtx;
        if (!c) return { ok: false, data: null, summary: 'Context unavailable.' };
        return {
          ok: true,
          data: {
            user: { name: c.user.name, role: c.user.role, email: c.user.email },
            selectedBatch: c.selectedBatch ? {
              id: c.selectedBatch.id,
              batchNumber: c.selectedBatch.batchNumber,
              batchName: c.selectedBatch.batchName,
            } : null,
            batchMode: c.batchMode,
            todayISO: c.todayISO,
            assignedBatches: c.isCC ? 'ALL (Company Commander)' : c.user.assignedBatchIds,
            permissions: c.can,
          },
          summary: `User: ${c.user.role} | Batch: ${c.selectedBatch?.batchNumber ?? c.batchMode} | Date: ${c.todayISO}`,
        };
      }

      // ── DATE RESOLUTION ──
      case 'resolve_date': {
        const r = resolveDatePhrase(String(args.phrase ?? ''));
        if (!r) return { ok: false, data: null, summary: `"${args.phrase}" ka date samajh nahi aaya. "aaj/kal/Monday/15 Sep" jaisa likhein.` };
        return { ok: true, data: r, summary: `${r.label} → ${r.kind === 'day' ? r.dateISO : `${r.fromISO}..${r.toISO}`}` };
      }

      // ── TRAINEE RESOLUTION (authoritative, scoped) ──
      case 'get_trainee': {
        const c = ctx.agentCtx;
        if (!c) return { ok: false, data: null, summary: 'Context unavailable.' };
        const res = await resolveTrainee(c, String(args.term ?? ''));
        if (res.status === 'unique' && res.entity) {
          return {
            ok: true,
            data: { trainee: res.entity },
            summary: `Mil gaya: Chest #${res.entity.chestNo} ${res.entity.name} (${res.entity.batchNumber ?? res.entity.batchId}${res.entity.platoon ? ', ' + res.entity.platoon : ''})`,
          };
        }
        if (res.status === 'ambiguous') {
          return { ok: false, data: { candidates: res.candidates, clarify: true }, summary: res.ask ?? 'Multiple matches — user se poochho kaunsa.' };
        }
        return { ok: false, data: { clarify: true }, summary: res.ask ?? 'Trainee nahi mila.' };
      }

      // ── TRAINEE 360 ──
      case 'get_trainee_360': {
        const c = ctx.agentCtx;
        if (!c) return { ok: false, data: null, summary: 'Context unavailable.' };
        const res = await resolveTrainee(c, String(args.term ?? ''));
        if (res.status !== 'unique' || !res.entity) {
          return { ok: false, data: { candidates: res.candidates, clarify: true }, summary: res.ask ?? 'Trainee nahi mila.' };
        }
        const profile = await getTrainee360(res.entity);
        return {
          ok: true,
          data: profile,
          summary: `Chest #${res.entity.chestNo} ${res.entity.name}: attn=${profile.attendance.todayCode}, FPT=${profile.performance.fptStatus ?? '—'}, weekly ${profile.performance.weeklyPass}/${profile.performance.weeklyTests} pass, kit ${profile.kit.items.length} item(s)`,
        };
      }

      // ── TRAINING SCHEDULE ──
      case 'get_training_schedule': {
        const c = ctx.agentCtx;
        if (!c) return { ok: false, data: null, summary: 'Context unavailable.' };
        const r = await getTrainingScheduleFor(c, String(args.phrase ?? 'aaj'));
        return {
          ok: true,
          data: { date: r.resolved, entries: r.entries },
          summary: r.entries.length
            ? `${r.resolved?.label}: ${r.entries.length} session(s) — ` +
              r.entries.map((e) => `${e.time ?? ''} ${e.subject ?? ''} (${e.instructor ?? '?'})`).join('; ')
            : (r.note ?? 'No schedule.'),
        };
      }

      // ── ATTENDANCE ──
      case 'get_attendance': {
        const c = ctx.agentCtx;
        if (!c) return { ok: false, data: null, summary: 'Context unavailable.' };
        let chest: string | undefined;
        if (args.term) {
          const r = await resolveTrainee(c, String(args.term));
          if (r.status === 'unique') chest = r.entity?.chestNo;
          else if (r.status === 'notfound') return { ok: false, data: null, summary: r.ask ?? 'Trainee nahi mila.' };
          else return { ok: false, data: { clarify: true }, summary: r.ask ?? 'Kaunsa trainee?' };
        }
        const a = await getAttendanceSummary(c, { phrase: args.phrase, traineeChest: chest });
        if (chest) {
          const t = a.absentList.find((x) => String(x.chestNo) === String(chest));
          return {
            ok: true, data: a,
            summary: t ? `Chest #${chest}: ${t.reason} (${t.name ?? ''})` : `Chest #${chest}: Present`,
          };
        }
        return {
          ok: true, data: a,
          summary: `Total ${a.total} | Present ${a.present} (${a.presentPct}%) | Absent ${a.absent} | Leave ${a.onLeave} | Sick/Med ${a.sick}`,
        };
      }

      // ── FINANCE ──
      case 'get_finance_summary': {
        const s = await getFinanceSummary({ phrase: args.phrase });
        return {
          ok: true, data: s,
          summary: `Collections ₹${s.totalCollections} − Expenses ₹${s.totalExpenses} = Net ₹${s.netBalance}. This month: exp ₹${s.monthExpenses}, in ₹${s.monthCollections}. Pending vendor payments ₹${s.pendingPayments}.`,
        };
      }
      case 'get_fund_balance': {
        const funds = await getFundBalance(String(args.fund ?? ''));
        if (!funds.length) return { ok: false, data: null, summary: `Fund "${args.fund}" nahi mila.` };
        return {
          ok: true, data: { funds },
          summary: funds.map((f) => `${f.fund}: in ₹${f.collections} − out ₹${f.expenses} = ₹${f.balance}`).join(' | '),
        };
      }

      // ── INSPECTIONS / FINDINGS (SO + CC) ──
      case 'get_inspections': {
        const c = ctx.agentCtx;
        if (!c) return { ok: false, data: null, summary: 'Context unavailable.' };
        if (!c.can.inspections) {
          return { ok: false, data: null, summary: 'SURAKSHA: inspections/findings sirf Senior Officer/Inspector ya Company Commander dekh sakte hain.' };
        }
        const me: InspectionUser = {
          uid: c.user.uid, role: c.user.role,
          displayName: c.user.name, name: c.user.name,
          assignedBatchIds: c.user.assignedBatchIds,
        };
        const [inspections, findings] = await Promise.all([getInspections(me), getFindings(me)]);
        const today = c.todayISO;
        const isOpen = (f: any) => f.status !== 'closed';
        const filtered = findings.filter((f: any) => {
          switch (args.filter) {
            case 'open': return isOpen(f);
            case 'critical': return f.severity === 'critical' && isOpen(f);
            case 'overdue': return isOpen(f) && f.dueDate && f.dueDate < today;
            case 'verification': return f.status === 'submitted';
            case 'closed': return f.status === 'closed';
            case 'rework': return f.status === 'rework';
            default: return true;
          }
        });
        return {
          ok: true,
          data: {
            inspections: inspections.slice(0, 30),
            findings: filtered.slice(0, 40),
            stats: {
              totalInspections: inspections.length,
              open: findings.filter(isOpen).length,
              critical: findings.filter((f: any) => f.severity === 'critical' && isOpen(f)).length,
              overdue: findings.filter((f: any) => isOpen(f) && f.dueDate && f.dueDate < today).length,
              verificationPending: findings.filter((f: any) => f.status === 'submitted').length,
              closed: findings.filter((f: any) => f.status === 'closed').length,
            },
          },
          summary: `Inspections ${inspections.length} | Findings: open ${findings.filter(isOpen).length}, critical ${findings.filter((f: any) => f.severity === 'critical' && isOpen(f)).length}, overdue ${findings.filter((f: any) => isOpen(f) && f.dueDate && f.dueDate < today).length}, verify-pending ${findings.filter((f: any) => f.status === 'submitted').length} (filter=${args.filter ?? 'all'}, ${filtered.length} shown)`,
        };
      }

      // ── INVENTORY ISSUE (atomic business transaction) ──
      case 'issue_inventory': {
        const c = ctx.agentCtx;
        if (!c) return { ok: false, data: null, summary: 'Context unavailable.' };
        // Role: QM/CC only (same as finance/inventory tier + rules)
        if (!c.can.finance) {
          return { ok: false, data: null, summary: 'SURAKSHA: inventory issue sirf Quarter Master ya Company Commander kar sakta hai.' };
        }
        // Confirmation gate — the model must echo the token we issued.
        if (!args.confirmToken || args.confirmToken !== ctx.confirmToken) {
          const token = `issue-${Date.now()}`;
          return {
            ok: false,
            data: { needsConfirmation: true, confirmToken: token, action: 'issue_inventory',
              preview: { term: args.term, item: args.item, size: args.size ?? null, quantity: Number(args.quantity ?? 1) } },
            summary: `${NEEDS_CONFIRM}: Ye ek real inventory issue hai (stock kam hoga + issue record banega). Pehle trainee/item/stock confirm karo, phir confirmToken="${token}" ke saath issue_inventory chalao.`,
          };
        }

        const res = await resolveTrainee(c, String(args.term ?? ''));
        if (res.status !== 'unique' || !res.entity) {
          return { ok: false, data: { candidates: res.candidates, clarify: true }, summary: res.ask ?? 'Trainee nahi mila — issue ruka.' };
        }
        const itemRes = resolveItem(String(args.item ?? ''));
        if (itemRes.status === 'notfound' || !itemRes.item) {
          return { ok: false, data: { available: itemRes.candidates }, summary: `Item "${args.item}" nahi mila. Available: ${(itemRes.candidates ?? []).slice(0, 12).join(', ')}` };
        }
        if (itemRes.status === 'ambiguous') {
          return { ok: false, data: { candidates: itemRes.candidates, clarify: true }, summary: `Kaunsa item? ${(itemRes.candidates ?? []).join(', ')}` };
        }
        const size = args.size ? String(args.size).toUpperCase() : undefined;
        const qty = Math.max(1, Number(args.quantity ?? 1) || 1);

        // Authoritative stock availability (same computation as QM screen)
        const stock = await findStock(itemRes.item.itemName, size);
        const stockItem = stock.items[0];
        const avail = size
          ? stockItem?.sizes.find((s) => s.size.toUpperCase() === size)?.balance ?? 0
          : stockItem?.balance ?? 0;
        if (!stockItem || avail < qty) {
          return {
            ok: false, data: null,
            summary: `STOCK INSUFFICIENT: ${itemRes.item.itemName}${size ? ' size ' + size : ''} — sirf ${avail} bacha hai, ${qty} maanga gaya. Issue NAHI hua.`,
          };
        }

        // Run the SAME atomic transaction the Inventory Issue screen uses.
        const before = avail;
        try {
          // Full trainee read so we can append to the existing kit array.
          const traineeSnap = await getDoc(doc(db, 'trainees', res.entity.id));
          const traineeData = traineeSnap.exists() ? (traineeSnap.data() as any) : {};
          const prevKit = Array.isArray(traineeData.issuedKitItems) ? traineeData.issuedKitItems : [];

          const traineeRef = doc(db, 'trainees', res.entity.id);
          const issueLedgerRef = doc(collection(db, 'issue_records'));
          const issueItem: IssueItem = { itemName: itemRes.item.itemName, assignedSize: size, quantity: qty };
          const now = new Date().toISOString();
          const kitEntry = {
            itemName: itemRes.item.itemName,
            assignedSize: size ?? 'N/A',
            quantity: qty,
            issueDate: now,
            issuedBy: c.user.email || c.user.name,
          };
          const mergedKit = [...prevKit, kitEntry];

          const expectedAvailable = (itemKey: string, sz?: string): number => {
            // Authoritative balance computed by stockEngine (purchases−issues),
            // same source the QM screen passes to atomicIssue.
            if (normalizeKey(itemRes.item!.itemName) === itemKey) {
              if (sz && size && sz.toUpperCase() === size.toUpperCase()) return avail;
              if (!sz) return stockItem!.balance;
            }
            return 0;
          };

          await atomicIssue({
            items: [issueItem],
            expectedAvailable,
            applyWrites: (batch) => {
              // Trainee kit state + issue ledger commit ONLY if all stock
              // checks pass inside the transaction.
              batch.set(traineeRef as never, {
                issuedKitItems: mergedKit,
                kitIssued: true,
                lastKitIssueDate: now,
                updatedAt: serverTimestamp(),
                updatedBy: c.user.email || c.user.name,
              } as never, { merge: true });
              batch.set(issueLedgerRef as never, {
                traineeId: res.entity!.id,
                traineeName: res.entity!.name,
                chestNo: res.entity!.chestNo,
                batchId: res.entity!.batchId,
                batchNumber: res.entity!.batchNumber ?? '',
                issuedItems: [kitEntry],
                totalItemsIssued: qty,
                issuedBy: c.user.email || c.user.name,
                issueDate: now,
                source: 'ai-agent',
                createdAt: serverTimestamp(),
              } as never);
            },
          });

          // ── POST-WRITE VERIFICATION (re-read authoritative stock) ──
          clearStockCache();
          const after = await findStock(itemRes.item.itemName, size);
          const afterItem = after.items[0];
          const afterAvail = size
            ? afterItem?.sizes.find((s) => s.size.toUpperCase() === size)?.balance ?? null
            : afterItem?.balance ?? null;

          return {
            ok: true,
            data: {
              trainee: { chestNo: res.entity.chestNo, name: res.entity.name },
              item: itemRes.item.itemName, size: size ?? null, qty,
              stockBefore: before, stockAfter: afterAvail,
            },
            summary: `ISSUED: Chest #${res.entity.chestNo} ${res.entity.name} → ${qty}× ${itemRes.item.itemName}${size ? ' size ' + size : ''}. Stock ${before} → ${afterAvail ?? '?'} (verified).`,
          };
        } catch (e: any) {
          return { ok: false, data: null, summary: `Issue fail hua (transaction rollback): ${e?.message ?? e}. Koi stock nahi kata.` };
        }
      }

      // ── VERIFY / REWORK FINDING (SO/CC) ──
      case 'verify_finding': {
        const c = ctx.agentCtx;
        if (!c) return { ok: false, data: null, summary: 'Context unavailable.' };
        if (!c.can.inspections) {
          return { ok: false, data: null, summary: 'SURAKSHA: finding verify/rework sirf Senior Officer/Inspector ya Company Commander kar sakta hai.' };
        }
        if (args.action === 'rework' && !args.reworkReason) {
          return { ok: false, data: { clarify: true }, summary: 'Rework ke liye reason zaroori hai.' };
        }
        if (!args.confirmToken || args.confirmToken !== ctx.confirmToken) {
          const token = `verify-${Date.now()}`;
          return {
            ok: false,
            data: { needsConfirmation: true, confirmToken: token, action: 'verify_finding',
              preview: { findingTitle: args.findingTitle, action: args.action } },
            summary: `${NEEDS_CONFIRM}: Finding "${args.findingTitle}" ko ${args.action} karna hai. Confirm karo phir confirmToken="${token}" ke saath dobara bhejo.`,
          };
        }
        const me: InspectionUser = {
          uid: c.user.uid, role: c.user.role,
          displayName: c.user.name, name: c.user.name,
          assignedBatchIds: c.user.assignedBatchIds,
        };
        const findings = await getFindings(me);
        const q = String(args.findingTitle ?? '').toLowerCase();
        const match = findings.find((f) =>
          (f.title ?? '').toLowerCase().includes(q) || q.includes((f.title ?? '').toLowerCase().slice(0, 12)));
        if (!match) return { ok: false, data: null, summary: `Finding "${args.findingTitle}" aapke scope me nahi mili.` };
        if (match.status !== 'submitted' && args.action === 'closed') {
          return { ok: false, data: null, summary: `Finding abhi "${match.status}" hai — verify/close sirf "submitted" finding par hota hai.` };
        }
        try {
          await updateFindingStatus(me, match.id, match, args.action === 'closed'
            ? { to: 'closed', actorName: c.user.name }
            : { to: 'rework', reworkReason: String(args.reworkReason ?? ''), actorName: c.user.name });
          // post-write verification
          const after = await getFindings(me);
          const verified = after.find((f) => f.id === match.id);
          const ok = verified?.status === args.action;
          return {
            ok,
            data: { id: match.id, status: verified?.status },
            summary: ok
              ? `Finding "${match.title}" ab ${args.action === 'closed' ? 'CLOSED/VERIFIED ✓' : 'REWORK'}.`
              : 'Update ka confirmation nahi mila — dobara check karein.',
          };
        } catch (e: any) {
          return { ok: false, data: null, summary: `Action fail: ${e?.message ?? e}` };
        }
      }

      default:
        return { ok: false, data: null, summary: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`Tool "${name}" failed:`, err);
    return { ok: false, data: null, summary: `Tool error: ${err?.message ?? err}` };
  }
}
