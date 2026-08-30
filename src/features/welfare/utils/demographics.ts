// ═══════════════════════════════════════════════════════════
// DEMOGRAPHICS ENGINE
// Registration form ke maujooda fields se hi saare counts
// aur filters nikalta hai. Koi nayi field nahi maangta.
// ═══════════════════════════════════════════════════════════

import type {
  WelfareTrainee, DimensionKey, DimensionDef, DimensionStat,
  BucketStat, WelfareFilters, FestivalDef, FestivalPlan, WelfareSummary,
} from '../types/welfare.types';
import {
  STATE_META, STATE_ALIASES, RELIGION_ALIASES,
} from '../data/stateMeta';
import { DEFAULT_PER_HEAD_BUDGET } from '../data/festivalCalendar';

export const MISSING = 'Not Recorded';

// ─────────────────────────────────────────────
// DIMENSION REGISTRY
// pinned:true  → hamesha screen par (State + Religion + Language + Zone)
// pinned:false → "Add Filter" se on/off
// ─────────────────────────────────────────────
export const DIMENSIONS: DimensionDef[] = [
  {
    key: 'state', sourceField: 'state', label: 'State', hindiLabel: 'राज्य',
    pinned: true, derived: false, accent: 'blue',
    hint: 'Registration form → Permanent Address → State',
  },
  {
    key: 'religion', sourceField: 'religion', label: 'Religion', hindiLabel: 'धर्म',
    pinned: true, derived: false, accent: 'orange',
    hint: 'Registration form → Personal Details → Religion',
  },
  {
    key: 'language', sourceField: '-', label: 'Language (Indicative)', hindiLabel: 'भाषा',
    pinned: true, derived: true, accent: 'violet',
    hint: 'State se auto-derived — form me alag field nahi hai',
  },
  {
    key: 'zone', sourceField: '-', label: 'Zone', hindiLabel: 'क्षेत्र',
    pinned: true, derived: true, accent: 'teal',
    hint: 'State se auto-derived (North / South / East / West / Central / NE)',
  },
  {
    key: 'district', sourceField: 'district', label: 'District', hindiLabel: 'जिला',
    pinned: false, derived: false, accent: 'sky',
    hint: 'Registration form → Permanent Address → District',
  },
  {
    key: 'category', sourceField: 'category', label: 'Category', hindiLabel: 'श्रेणी',
    pinned: false, derived: false, accent: 'indigo',
    hint: 'Registration form → Personal Details → Category',
  },
  {
    key: 'gender', sourceField: 'gender', label: 'Gender', hindiLabel: 'लिंग',
    pinned: false, derived: false, accent: 'pink',
    hint: 'Registration form → Personal Details → Gender',
  },
  {
    key: 'bloodGroup', sourceField: 'bloodGroup', label: 'Blood Group', hindiLabel: 'रक्त समूह',
    pinned: false, derived: false, accent: 'red',
    hint: 'Medical camp / emergency planning ke liye',
  },
  {
    key: 'education', sourceField: 'education', label: 'Education', hindiLabel: 'शिक्षा',
    pinned: false, derived: false, accent: 'emerald',
    hint: 'Registration form → Educational Qualification',
  },
  {
    key: 'maritalStatus', sourceField: 'maritalStatus', label: 'Marital Status', hindiLabel: 'वैवाहिक स्थिति',
    pinned: false, derived: false, accent: 'rose',
    hint: 'Family accommodation / leave planning',
  },
  {
    key: 'ageBand', sourceField: '-', label: 'Age Band', hindiLabel: 'आयु वर्ग',
    pinned: false, derived: true, accent: 'amber',
    hint: 'DOB / Age se auto-derived',
  },
  {
    key: 'platoon', sourceField: 'platoon', label: 'Platoon', hindiLabel: 'प्लाटून',
    pinned: false, derived: false, accent: 'slate',
    hint: 'Roster / duty planning',
  },
  {
    key: 'section', sourceField: 'section', label: 'Section', hindiLabel: 'सेक्शन',
    pinned: false, derived: false, accent: 'stone',
    hint: 'Roster / duty planning',
  },
  {
    key: 'medStat', sourceField: 'medStat', label: 'Medical Status', hindiLabel: 'चिकित्सा स्थिति',
    pinned: false, derived: false, accent: 'lime',
    hint: 'SHAPE category — welfare/diet planning',
  },
];

export const PINNED_DIMENSIONS = DIMENSIONS.filter(d => d.pinned).map(d => d.key);
export const OPTIONAL_DIMENSIONS = DIMENSIONS.filter(d => !d.pinned);
export const DIM_MAP: Record<DimensionKey, DimensionDef> =
  DIMENSIONS.reduce((acc, d) => { acc[d.key] = d; return acc; },
    {} as Record<DimensionKey, DimensionDef>);

// ─────────────────────────────────────────────
// NORMALISERS
// ─────────────────────────────────────────────
const clean = (v: any): string => String(v ?? '').trim();

const titleCase = (v: string) =>
  v.toLowerCase().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const normalizeState = (raw: any): string => {
  const v = clean(raw);
  if (!v) return MISSING;
  const key = v.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  if (STATE_ALIASES[key]) return STATE_ALIASES[key];
  // exact match against known states (case-insensitive)
  const exact = Object.keys(STATE_META).find(s => s.toLowerCase() === key);
  if (exact) return exact;
  return titleCase(v);
};

export const normalizeReligion = (raw: any): string => {
  const v = clean(raw);
  if (!v) return MISSING;
  const key = v.toLowerCase();
  if (RELIGION_ALIASES[key]) return RELIGION_ALIASES[key];
  return titleCase(v);
};

export const deriveLanguage = (state: string): string => {
  if (state === MISSING) return MISSING;
  return STATE_META[state]?.language ?? 'Other / Not Mapped';
};

export const deriveZone = (state: string): string => {
  if (state === MISSING) return MISSING;
  return STATE_META[state]?.zone ?? 'Other / Not Mapped';
};

export const deriveAgeBand = (t: WelfareTrainee): string => {
  let age = parseInt(clean(t.age), 10);
  if (!age || Number.isNaN(age)) {
    const dob = clean(t.dob);
    if (!dob) return MISSING;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return MISSING;
    const now = new Date();
    age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  }
  if (age <= 0 || age > 80) return MISSING;
  if (age < 21) return '18 – 20 yrs';
  if (age < 24) return '21 – 23 yrs';
  if (age < 27) return '24 – 26 yrs';
  if (age < 30) return '27 – 29 yrs';
  return '30+ yrs';
};

/**
 * Kisi bhi dimension ki normalised value nikalta hai.
 * Ye SINGLE SOURCE OF TRUTH hai — counting aur filtering
 * dono isi function ko use karte hain, isliye kabhi mismatch nahi hoga.
 */
export const getDimensionValue = (t: WelfareTrainee, dim: DimensionKey): string => {
  switch (dim) {
    case 'state':    return normalizeState(t.state);
    case 'religion': return normalizeReligion(t.religion);
    case 'language': return deriveLanguage(normalizeState(t.state));
    case 'zone':     return deriveZone(normalizeState(t.state));
    case 'ageBand':  return deriveAgeBand(t);
    case 'district': {
      const v = clean(t.district);
      return v ? titleCase(v) : MISSING;
    }
    default: {
      const v = clean((t as any)[DIM_MAP[dim].sourceField]);
      return v || MISSING;
    }
  }
};

// ─────────────────────────────────────────────
// AGGREGATION
// ─────────────────────────────────────────────
export const buildDimensionStat = (
  trainees: WelfareTrainee[],
  dim: DimensionKey,
): DimensionStat => {
  const def = DIM_MAP[dim];
  const counts = new Map<string, number>();
  let missing = 0;

  trainees.forEach(t => {
    const v = getDimensionValue(t, dim);
    if (v === MISSING) { missing++; return; }
    counts.set(v, (counts.get(v) ?? 0) + 1);
  });

  const known = trainees.length - missing;

  const buckets: BucketStat[] = Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      count,
      percent: known > 0 ? Math.round((count / known) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  if (missing > 0) {
    buckets.push({
      value: MISSING,
      count: missing,
      percent: trainees.length > 0
        ? Math.round((missing / trainees.length) * 1000) / 10 : 0,
      isMissing: true,
    });
  }

  return {
    key: dim,
    label: def.label,
    hindiLabel: def.hindiLabel,
    total: trainees.length,
    known,
    missing,
    distinct: counts.size,
    buckets,
  };
};

// ─────────────────────────────────────────────
// FILTERING
// Rule: ek dimension ke andar OR, alag dimensions ke beech AND
// ─────────────────────────────────────────────
export const applyFilters = (
  all: WelfareTrainee[],
  filters: WelfareFilters,
): WelfareTrainee[] => {
  const q = filters.search.trim().toLowerCase();

  return all.filter(t => {
    // Batch
    if (filters.batchId !== 'ALL' && t.batchId !== filters.batchId) return false;

    // Free text search
    if (q) {
      const hay = [
        t.name, t.chestNo, t.regNo, t.district, t.state,
        t.village, t.tehsil, t.fatherName, t.mobileNo, t.platoon,
      ].map(x => String(x ?? '').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }

    // Dimension selections
    for (const [dimKey, values] of Object.entries(filters.selections)) {
      if (!values || values.length === 0) continue;
      const v = getDimensionValue(t, dimKey as DimensionKey);
      if (!values.includes(v)) return false;
    }

    return true;
  });
};

/**
 * Cross-filtered stat: kisi ek dimension ke counts nikalte waqt
 * USI dimension ka apna filter hata dete hain, taaki user dusre
 * options bhi dekh sake (Amazon-style facet behaviour).
 */
export const buildFacetStat = (
  all: WelfareTrainee[],
  filters: WelfareFilters,
  dim: DimensionKey,
): DimensionStat => {
  const withoutSelf: WelfareFilters = {
    ...filters,
    selections: { ...filters.selections, [dim]: [] },
  };
  return buildDimensionStat(applyFilters(all, withoutSelf), dim);
};

// ─────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────
export const buildSummary = (
  all: WelfareTrainee[],
  filtered: WelfareTrainee[],
): WelfareSummary => {
  const states    = new Set<string>();
  const religions = new Set<string>();
  const languages = new Set<string>();
  let incomplete = 0;

  filtered.forEach(t => {
    const s = getDimensionValue(t, 'state');
    const r = getDimensionValue(t, 'religion');
    const l = getDimensionValue(t, 'language');
    if (s !== MISSING) states.add(s);       else incomplete++;
    if (r !== MISSING) religions.add(r);
    if (l !== MISSING) languages.add(l);
    if (s !== MISSING && r === MISSING) incomplete++;
  });

  // Data completeness = kitne % core welfare fields bhare hain
  const CORE: DimensionKey[] = ['state', 'religion', 'district', 'category', 'bloodGroup'];
  let filledCells = 0;
  filtered.forEach(t => {
    CORE.forEach(d => { if (getDimensionValue(t, d) !== MISSING) filledCells++; });
  });
  const totalCells = filtered.length * CORE.length;

  return {
    totalTrainees:    all.length,
    filteredTrainees: filtered.length,
    statesCovered:    states.size,
    religionsCovered: religions.size,
    languagesCovered: languages.size,
    dataCompleteness: totalCells > 0
      ? Math.round((filledCells / totalCells) * 100) : 0,
    incompleteRecords: incomplete,
  };
};

// ─────────────────────────────────────────────
// FESTIVAL MATCHING
// ─────────────────────────────────────────────
export const isEligibleForFestival = (
  t: WelfareTrainee,
  f: FestivalDef,
): boolean => {
  const hasReligionRule = f.religions.length > 0;
  const hasStateRule    = f.states.length > 0;

  // Koi rule nahi = National / universal → sabke liye
  if (!hasReligionRule && !hasStateRule) return true;

  const religion = getDimensionValue(t, 'religion');
  const state    = getDimensionValue(t, 'state');

  const religionMatch = hasReligionRule && f.religions.includes(religion);
  const stateMatch    = hasStateRule    && f.states.includes(state);

  if (f.mode === 'ALL') {
    // Jitne rule set hain, sab match hone chahiye
    // (e.g. Chhath = Hindu AND Bihar/JH/UP)
    return (!hasReligionRule || religionMatch)
        && (!hasStateRule    || stateMatch);
  }

  // ANY = jo rule set hai, unme se kam se kam ek match ho
  // (e.g. Baisakhi = Sikh YA Punjab)
  // ⚠ Jo rule set hi nahi hai wo "match" nahi maana jaata —
  //   warna sirf-religion wale festival (Eid) me sab aa jaate.
  return religionMatch || stateMatch;
};

export const daysUntil = (iso: string, from: Date = new Date()): number => {
  const target = new Date(`${iso}T00:00:00`);
  const base   = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
};

export const buildFestivalPlans = (
  trainees: WelfareTrainee[],
  calendar: FestivalDef[],
  opts: { horizonDays?: number; today?: Date; perHeadOverride?: Record<string, number> } = {},
): FestivalPlan[] => {
  const { horizonDays = 400, today = new Date(), perHeadOverride } = opts;
  const rates = { ...DEFAULT_PER_HEAD_BUDGET, ...(perHeadOverride ?? {}) };

  return calendar
    .map(f => {
      const d = daysUntil(f.date, today);
      const eligible = trainees.filter(t => isEligibleForFestival(t, f));
      const stateCounts = new Map<string, number>();
      eligible.forEach(t => {
        const s = getDimensionValue(t, 'state');
        stateCounts.set(s, (stateCounts.get(s) ?? 0) + 1);
      });
      const topStates: BucketStat[] = Array.from(stateCounts.entries())
        .map(([value, count]) => ({
          value, count,
          percent: eligible.length ? Math.round((count / eligible.length) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        festival: f,
        daysAway: d,
        eligibleCount: eligible.length,
        eligible,
        topStates,
        estimatedBudget: eligible.length * (rates[f.kind] ?? 150),
      } as FestivalPlan;
    })
    .filter(p => p.daysAway >= 0 && p.daysAway <= horizonDays)
    .sort((a, b) => a.daysAway - b.daysAway);
};

// ─────────────────────────────────────────────
// CSV EXPORT (ReportsScreen jaisa hi format)
// ─────────────────────────────────────────────
export const downloadCSV = (
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) => {
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// ─────────────────────────────────────────────
// PRINT (A4 report, ReportsScreen ke style me)
// ─────────────────────────────────────────────
/**
 * Escape user/database-derived text before inserting into generated HTML,
 * so stored content can never become executable markup in a print preview
 * (HTML-injection / stored-XSS protection).
 */
const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const printWelfareReport = (
  title: string,
  subtitle: string,
  sections: { heading: string; headers: string[]; rows: (string | number)[][] }[],
  footNote?: string,
) => {
  const body = sections.map(s => `
    <h3>${escapeHtml(s.heading)}</h3>
    <table>
      <thead><tr>${s.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${s.rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `).join('');

  const html = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><style>
    @page { margin: 12mm; size: A4 portrait; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a1a; }
    .header { text-align:center; border-bottom:3px double #1f2937; padding-bottom:8px; margin-bottom:10px; }
    .header h1 { font-size:17px; font-weight:900; text-transform:uppercase; letter-spacing:3px; margin:0; }
    .header h2 { font-size:12px; font-weight:700; margin:4px 0 0; color:#4b5563; }
    .purpose { margin:8px 0 12px; padding:8px 10px; background:#ecfdf5; border-left:4px solid #059669; font-size:9.5px; color:#065f46; }
    h3 { font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:14px 0 4px; padding-bottom:3px; border-bottom:1.5px solid #1f2937; }
    table { width:100%; border-collapse:collapse; margin-bottom:6px; }
    th { background:#1f2937; color:#fff; padding:5px; text-align:left; font-size:9px; text-transform:uppercase; }
    td { padding:4px 5px; border-bottom:1px solid #e5e7eb; font-size:9.5px; }
    tr:nth-child(even) { background:#f9fafb; }
    .foot { margin-top:14px; padding:8px 10px; background:#fef3c7; border-left:4px solid #f59e0b; font-size:9.5px; font-weight:bold; color:#78350f; }
    .stamp { margin-top:34px; display:flex; justify-content:space-between; padding:0 30px; }
    .stamp div { text-align:center; width:180px; }
    .stamp .line { border-top:1.5px solid #1f2937; margin-top:38px; padding-top:4px; font-size:9.5px; font-weight:bold; text-transform:uppercase; }
    @media print { button { display:none !important; } }
  </style></head><body>
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <h2>${escapeHtml(subtitle)}</h2>
    </div>
    <div class="purpose">
      <b>PURPOSE / प्रयोजन:</b> Ye report keval <b>KALYAN (WELFARE) NIYOJAN</b> ke liye hai —
      tyohaar par ration, mithai, puja saamagri, mess menu, chhutti roster aur
      welfare grant ki planning. Ye kisi bhi prakar ke bhedbhav ke liye
      prayog nahi ki jaayegi. Data source: Trainee Registration Form (koi nayi jaankari nahi li gayi).
    </div>
    ${body}
    ${footNote ? `<div class="foot">${escapeHtml(footNote)}</div>` : ''}
    <div class="stamp">
      <div><div class="line">Clerk / Head Clerk</div></div>
      <div><div class="line">Company Commander</div></div>
    </div>
    <script>window.onload = () => { window.print(); }<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
};
