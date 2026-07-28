// ═══════════════════════════════════════════════════════════
// FAST PATH — bina AI ke jawab 🚀
// ───────────────────────────────────────────────────────────
// KYUN: Groq free tier = 12,000 token/min. Har AI call ~1,600
// token kha jaati hai, matlab ~3 sawaal per minute. Aam sawaal
// ("kitne trainees hain", "state wise batao") ke liye AI ki
// zaroorat hi nahi — ye seedhe query engine se ban jaate hain.
//
// FARQ purane system se: ye sirf ek SHORTCUT hai, limit nahi.
// Pattern match na ho to poora AI agent chalta hai (jaisa abhi hai).
// Isliye "sirf 4 sawaal ka jawab" wali purani problem wapas nahi aayegi.
// ═══════════════════════════════════════════════════════════

import { runQuery } from './queryEngine';
import { matchCollections, type CollectionDef } from '../knowledge/collectionRegistry';

export interface FastResult {
  reply: string;
  toolSummary: string;
}

// ─────────────────────────────────────────────
// Dimension keywords → field name
// ─────────────────────────────────────────────
const DIMENSIONS: { words: string[]; field: string; label: string }[] = [
  { words: ['state', 'rajya', 'pradesh'],            field: 'state',      label: 'State' },
  { words: ['religion', 'dharm', 'dharam', 'mazhab'],field: 'religion',   label: 'Religion' },
  { words: ['district', 'zila', 'jila'],             field: 'district',   label: 'District' },
  { words: ['category', 'shreni', 'caste', 'jati'],  field: 'category',   label: 'Category' },
  { words: ['platoon', 'pltn'],                      field: 'platoon',    label: 'Platoon' },
  { words: ['section'],                              field: 'section',    label: 'Section' },
  { words: ['blood'],                                field: 'bloodGroup', label: 'Blood Group' },
  { words: ['education', 'padhai', 'qualification'], field: 'education',  label: 'Education' },
  { words: ['gender', 'ling'],                       field: 'gender',     label: 'Gender' },
  { words: ['medical', 'shape', 'medstat'],          field: 'medStat',    label: 'Medical Status' },
];

// Attendance codes
const ATTN_WORDS: { words: string[]; code: string; label: string }[] = [
  { words: ['absent', 'gair hazir', 'gayab', 'nadarad'], code: 'A', label: 'Absent' },
  { words: ['leave', 'chhutti', 'chutti'],               code: 'L', label: 'Leave' },
  { words: ['sick', 'bimar', 'mi room'],                 code: 'S', label: 'Sick' },
  { words: ['hospital', 'admit'],                        code: 'H', label: 'Hospital' },
  { words: ['rest', 'light duty'],                       code: 'R', label: 'Rest' },
  { words: ['present', 'hazir'],                         code: 'P', label: 'Present' },
];

const has = (t: string, ...words: string[]) => words.some(w => t.includes(w));

const COUNT_WORDS  = ['kitne', 'kitni', 'kitna', 'how many', 'count', 'total', 'ginti', 'sankhya'];
const GROUP_WORDS  = ['wise', 'breakdown', 'group', 'har ', 'each', 'distribution', 'ke hisab'];
const SUM_WORDS    = ['kharcha', 'kharch', 'expense', 'total', 'kitna paisa', 'amount', 'spending', 'kul'];
const LIST_WORDS   = ['list', 'dikhao', 'batao naam', 'sabhi', 'saare', 'names'];

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export async function tryFastPath(message: string): Promise<FastResult | null> {
  const t = ` ${message.toLowerCase().trim()} `;

  // ══════ 1. GROUP-BY: "state wise trainees" ══════
  if (has(t, ...GROUP_WORDS)) {
    const dim = DIMENSIONS.find(d => has(t, ...d.words));
    if (dim) {
      const r = await runQuery({ collection: 'trainees', groupBy: dim.field });
      if (!r.groups?.length) return null;

      const total = r.groups.reduce((s, g) => s + g.count, 0);
      const lines = r.groups
        .map(g => `• **${g.value}** — ${g.count} (${Math.round((g.count / total) * 100)}%)`)
        .join('\n');

      return {
        reply: `📊 **${dim.label} wise trainees** (kul ${total})\n\n${lines}`,
        toolSummary: `trainees: ${total} records, ${r.groups.length} ${dim.field} groups`,
      };
    }
  }

  // ══════ 2. ATTENDANCE: "aaj kitne absent hain" ══════
  const attn = ATTN_WORDS.find(a => has(t, ...a.words));
  if (attn && has(t, ...COUNT_WORDS, 'kaun', 'who')) {
    const r = await runQuery({
      collection: 'trainees',
      filters: [{ field: 'attn', op: 'eq', value: attn.code }],
      select: ['chestNo', 'name', 'platoon'],
      limit: 30,
    });
    const names = r.rows.length
      ? '\n\n' + r.rows.map((x: any) => `• #${x.chestNo ?? '—'} ${x.name ?? ''}`).join('\n')
      : '';
    return {
      reply: `📋 **${attn.label}: ${r.totalMatched} trainees**${names}` +
             (r.truncated ? `\n\n_(pehle 30 dikhaye)_` : ''),
      toolSummary: `trainees attn=${attn.code}: ${r.totalMatched}`,
    };
  }

  // ══════ 3. FILTERED COUNT: "rajasthan ke kitne trainees" ══════
  if (has(t, ...COUNT_WORDS) && has(t, 'trainee', 'rangroot', 'jawan', 'recruit', 'bacche')) {
    // Kis value par filter? — state/religion/category me se dhoondo
    for (const dim of DIMENSIONS) {
      const probe = await runQuery({ collection: 'trainees', groupBy: dim.field });
      const hit = probe.groups?.find(g =>
        g.value && g.value !== '(blank)' && t.includes(g.value.toLowerCase()),
      );
      if (hit) {
        return {
          reply: `📊 **${hit.value}** ke **${hit.count}** trainees hain.`,
          toolSummary: `trainees ${dim.field}="${hit.value}": ${hit.count}`,
        };
      }
    }

    // Koi filter nahi mila → total count
    if (!has(t, ...GROUP_WORDS)) {
      const r = await runQuery({ collection: 'trainees' });
      return {
        reply: `👥 Is batch me kul **${r.totalMatched} trainees** hain.`,
        toolSummary: `trainees: ${r.totalMatched}`,
      };
    }
  }

  // ══════ 4. FUND TOTALS: "mess fund me kitna kharcha" ══════
  if (has(t, ...SUM_WORDS, ...COUNT_WORDS)) {
    const cands = matchCollections(message).filter(c => c.domain === 'finance');
    const col: CollectionDef | undefined = cands[0];

    if (col) {
      const amtField = col.fields.find(f => f.kind === 'currency')?.name ?? 'amount';
      const r = await runQuery({
        collection: col.name,
        aggregate: { field: amtField, fn: 'sum' },
        useActiveBatch: false,
      });
      if (r.totalMatched > 0) {
        const total = r.aggregate?.value ?? 0;
        return {
          reply: `💰 **${col.description}**\n\n` +
                 `Kul: **₹${total.toLocaleString('en-IN')}**\n` +
                 `Records: ${r.totalMatched}`,
          toolSummary: `${col.name}: sum(${amtField}) = ${total}, ${r.totalMatched} records`,
        };
      }
    }
  }

  // ══════ 5. VENDOR DUE ══════
  if (has(t, 'vendor') && has(t, 'due', 'baaki', 'baki', 'udhaar', 'pending', 'dena')) {
    const r = await runQuery({
      collection: 'vendor_entries',
      aggregate: { field: 'dueAmount', fn: 'sum' },
      groupBy: 'vendorName',
      useActiveBatch: false,
    });
    const withDue = (r.groups ?? []).filter(g => (g.sum ?? 0) > 0);
    const total = r.aggregate?.value ?? 0;
    if (r.totalMatched > 0) {
      const lines = withDue.length
        ? '\n\n' + withDue.map(g => `• **${g.value}** — ₹${(g.sum ?? 0).toLocaleString('en-IN')}`).join('\n')
        : '\n\n✅ Kisi vendor ka paisa baaki nahi hai.';
      return {
        reply: `💳 **Vendor Dues: ₹${total.toLocaleString('en-IN')}**${lines}`,
        toolSummary: `vendor_entries: sum(dueAmount) = ${total}`,
      };
    }
  }

  // ══════ 6. SIMPLE LIST: "trainee list dikhao" ══════
  if (has(t, ...LIST_WORDS) && has(t, 'trainee', 'rangroot', 'jawan')) {
    const r = await runQuery({
      collection: 'trainees',
      select: ['chestNo', 'name', 'platoon', 'state'],
      sortBy: 'chestNo',
      limit: 30,
    });
    if (!r.totalMatched) return null;
    const lines = r.rows
      .map((x: any) => `• #${x.chestNo ?? '—'} **${x.name ?? '—'}** — ${x.platoon ?? ''} ${x.state ? `(${x.state})` : ''}`)
      .join('\n');
    return {
      reply: `👥 **Trainees (${r.totalMatched})**\n\n${lines}` +
             (r.truncated ? `\n\n_(pehle 30 — poori list Reports se export karein)_` : ''),
      toolSummary: `trainees: ${r.totalMatched} listed`,
    };
  }

  // Koi pattern match nahi → AI agent chalega
  return null;
}
