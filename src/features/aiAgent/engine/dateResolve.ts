// ═══════════════════════════════════════════════════════════════════════
// DATE INTELLIGENCE — natural-language Hindi/English business dates
// ───────────────────────────────────────────────────────────────────────
// Deterministic local-date resolution for "aaj/kal/parso/Monday/this week".
// Uses the application's LOCAL date convention (YYYY-MM-DD business date),
// never UTC string splitting. All outputs are local calendar dates.
// ═══════════════════════════════════════════════════════════════════════

import { localDateISOString } from '../../../utils/localDate';

export interface ResolvedDate {
  kind: 'day' | 'week' | 'month';
  /** YYYY-MM-DD for 'day' */
  dateISO?: string;
  /** inclusive range [from, to] YYYY-MM-DD for week/month */
  fromISO?: string;
  toISO?: string;
  /** human label used in replies */
  label: string;
  relative?: string; // 'today' | 'tomorrow' | 'yesterday' | ...
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, ravivaar: 0, ravivar: 0, itwaar: 0,
  monday: 1, somvaar: 1, somvar: 1, peer: 1,
  tuesday: 2, mangalvaar: 2, mangalvar: 2,
  wednesday: 3, budhvaar: 3, budhvar: 3,
  thursday: 4, guruvaar: 4, guruvar: 4,
  friday: 5, shukravaar: 5, shukravar: 5, juma: 5,
  saturday: 6, shanivaar: 6, shanivar: 6,
};


/** Resolve a natural-language phrase into a concrete local date/range. */
export function resolveDatePhrase(text: string, now: Date = new Date()): ResolvedDate | null {
  const t = ` ${text.toLowerCase().trim()} `;

  const pad = (d: Date) => localDateISOString(d);
  const d = (offset: number): Date => {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dt.setDate(dt.getDate() + offset);
    return dt;
  };
  const dFrom = (base: Date, offset: number): Date => {
    const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    dt.setDate(dt.getDate() + offset);
    return dt;
  };

  // ── Relative days ──
  if (/\b(aaj|aj|today)\b/.test(t)) {
    return { kind: 'day', dateISO: pad(now), label: 'aaj (today)', relative: 'today' };
  }
  if (/\b(kal|tomorrow)\b/.test(t)) {
    // "kal" alone = tomorrow in operational context (future schedule)
    return { kind: 'day', dateISO: pad(d(1)), label: 'kal (tomorrow)', relative: 'tomorrow' };
  }
  if (/\b(parso|parsun|day after tomorrow)\b/.test(t)) {
    return { kind: 'day', dateISO: pad(d(2)), label: 'parso (day after tomorrow)', relative: 'dat' };
  }
  if (/\b(bita kal|beeta kal|yesterday)\b/.test(t)) {
    return { kind: 'day', dateISO: pad(d(-1)), label: 'kal (yesterday)', relative: 'yesterday' };
  }
  if (/\b(narso|3 din baad|three days)\b/.test(t)) {
    return { kind: 'day', dateISO: pad(d(3)), label: '3 din baad' };
  }

  // ── This / next week ──
  if (/\b(this week|is hafte|is hafta|current week)\b/.test(t)) {
    const monday = startOfWeek(now, 0);
    return {
      kind: 'week',
      fromISO: pad(monday), toISO: pad(dFrom(monday, 6)),
      label: 'is hafta (this week, Mon–Sun)',
    };
  }
  if (/\b(next week|agle hafte|agla hafta)\b/.test(t)) {
    const monday = dFrom(startOfWeek(now, 0), 7);
    return {
      kind: 'week',
      fromISO: pad(monday), toISO: pad(dFrom(monday, 6)),
      label: 'agle hafta (next week)',
    };
  }
  if (/\b(last week|pichhle hafte|pichla hafta)\b/.test(t)) {
    const monday = dFrom(startOfWeek(now, 0), -7);
    return {
      kind: 'week',
      fromISO: pad(monday), toISO: pad(dFrom(monday, 6)),
      label: 'pichhle hafta (last week)',
    };
  }

  // ── This / last month ──
  if (/\b(this month|is mahine|is maheene|current month|abhi ka mahina)\b/.test(t)) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { kind: 'month', fromISO: pad(from), toISO: pad(to), label: 'is mahine (this month)' };
  }
  if (/\b(last month|pichhle mahine|pichla mahina)\b/.test(t)) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { kind: 'month', fromISO: pad(from), toISO: pad(to), label: 'pichhle mahine (last month)' };
  }

  // ── Named weekday (Monday / somvaar …), with optional next ──
  const wantNext = /\b(next|agla|aane wala)\b/.test(t);
  for (const [word, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) {
      const cur = now.getDay();
      let delta: number;
      if (wantNext) {
        // Always the occurrence in the FOLLOWING week(s), never today.
        delta = ((dow - cur + 7) % 7) || 7;
      } else {
        // Nearest future occurrence; if today IS that weekday, mean today.
        delta = (dow - cur + 7) % 7;
      }
      const label = wantNext ? `next ${word}` : word;
      return { kind: 'day', dateISO: pad(d(delta)), label };
    }
  }

  // ── Explicit date: 15 September / 15 Sep / 2026-09-15 ──
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return { kind: 'day', dateISO: `${iso[1]}-${iso[2]}-${iso[3]}`, label: iso[0] };

  const m = t.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2]);
    let year = now.getFullYear();
    const candidate = new Date(year, mon, day);
    if (candidate < now && /\b(next|aane wala)\b/.test(t)) year += 1;
    const dt = new Date(year, mon, day);
    return { kind: 'day', dateISO: pad(dt), label: `${day} ${m[2]} ${year}` };
  }

  return null;
}


function startOfWeek(now: Date, _firstDow: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}


/** True when an ISO date string falls inside a resolved range/day. */
export function dateMatches(resolved: ResolvedDate, isoDate: string | undefined | null): boolean {
  if (!isoDate) return false;
  const day = String(isoDate).slice(0, 10);
  if (resolved.kind === 'day') return day === resolved.dateISO;
  if (resolved.fromISO && resolved.toISO) {
    return day >= resolved.fromISO && day <= resolved.toISO;
  }
  return false;
}
