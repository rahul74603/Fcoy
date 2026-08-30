// ═══════════════════════════════════════════════════════════════════════
// OPERATIONAL READ DATA — training schedule + attendance for the agent
// ───────────────────────────────────────────────────────────────────────
// Read-only, authoritative Firestore reads, batch-scoped via the trusted
// agent context (NOT a model-supplied batchId). Date logic uses the local
// business date.
// ═══════════════════════════════════════════════════════════════════════

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import type { AgentContext } from './agentContext';
import { resolveDatePhrase, dateMatches, type ResolvedDate } from './dateResolve';

const norm = (v: any) => String(v ?? '').trim().toLowerCase();

async function fetchScoped(collectionName: string, ctx: AgentContext): Promise<any[]> {
  const snap = await getDocs(collection(db, collectionName));
  const rows: any[] = [];
  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, any>;
    if (!showDoc(data)) return;
    const bid = String(data.batchId ?? '');
    if (ctx.isCC) { rows.push({ id: d.id, ...data }); return; }
    if (ctx.isSO) {
      if ((ctx.inspectionScope ?? []).includes(bid)) rows.push({ id: d.id, ...data });
      return;
    }
    if (ctx.selectedBatch && bid === ctx.selectedBatch.id) rows.push({ id: d.id, ...data });
  });
  return rows;
}

export interface ScheduleEntry {
  date: string;
  time?: string;
  subject?: string;
  instructor?: string;
  location?: string;
  batchNumber?: string;
  source: 'training_schedule' | 'weeklyPrograms';
}

/**
 * Training schedule for a natural date phrase ("aaj/kal/Monday/15 Sep").
 * Reads both training_schedule (date-field rows) and weeklyPrograms
 * (day-array documents). Returns entries for the CURRENT scope only.
 */
export async function getTrainingScheduleFor(
  ctx: AgentContext,
  phrase: string,
): Promise<{ resolved: ResolvedDate | null; entries: ScheduleEntry[]; note?: string }> {
  const resolved = resolveDatePhrase(phrase) ??
    ({ kind: 'day', dateISO: ctx.todayISO, label: 'aaj (today)' } as ResolvedDate);

  const entries: ScheduleEntry[] = [];

  // 1) training_schedule — rows carry a date
  try {
    const sched = await fetchScoped('training_schedule', ctx);
    for (const s of sched) {
      const day = String(s.date ?? '').slice(0, 10);
      if (dateMatches(resolved, day) || (resolved.kind === 'day' && day === resolved.dateISO)) {
        entries.push({
          date: day, time: s.time, subject: s.subject,
          instructor: s.instructor ?? s.ustad, location: s.location ?? s.venue,
          batchNumber: s.batchNumber, source: 'training_schedule',
        });
      }
    }
  } catch { /* collection may not exist yet */ }

  // 2) weeklyPrograms — documents with fromDate/toDate + schedule array
  try {
    const weeks = await fetchScoped('weeklyPrograms', ctx);
    for (const w of weeks) {
      const from = String(w.fromDate ?? '').slice(0, 10);
      const to = String(w.toDate ?? '').slice(0, 10);
      if (resolved.kind === 'day' && resolved.dateISO) {
        if (from && to && (resolved.dateISO < from || resolved.dateISO > to)) continue;
      }
      const arr = Array.isArray(w.schedule) ? w.schedule : [];
      for (const item of arr) {
        const dayEntry = dayMatches(item, resolved);
        if (dayEntry) {
          entries.push({
            date: resolved.dateISO ?? from,
            time: item.time ?? item.period,
            subject: item.subject ?? item.activity ?? item.topic,
            instructor: item.instructor ?? item.ustad ?? item.staffName,
            location: item.location ?? item.venue ?? item.ground,
            batchNumber: w.batchNumber,
            source: 'weeklyPrograms',
          });
        }
      }
    }
  } catch { /* ignore */ }

  const batchLabel = ctx.selectedBatch?.batchNumber ??
    (ctx.batchMode === 'all' ? 'All Batches' : 'scope');
  const note = entries.length === 0
    ? `No training schedule recorded for ${batchLabel} on ${resolved.label}.`
    : undefined;

  return { resolved, entries, note };
}

function dayMatches(item: any, resolved: ResolvedDate): boolean {
  // weeklyProgram items often carry a day name or date
  const itemDate = String(item.date ?? item.day ?? '').slice(0, 10);
  if (resolved.kind === 'day' && itemDate && itemDate === resolved.dateISO) return true;
  // weekday-name fallback for week-range documents
  if (resolved.kind === 'day' && resolved.dateISO) {
    const dow = new Date(resolved.dateISO + 'T00:00:00').getDay();
    const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dn = norm(item.dayName ?? item.day ?? item.weekday);
    if (dn && (dn === names[dow] || dn === names[dow].slice(0, 3))) return true;
  }
  if (resolved.kind === 'week') return true; // a week query returns the whole program
  return false;
}

// ───────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ───────────────────────────────────────────────────────────────────────
export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  sick: number;
  other: number;
  absentList: { chestNo?: string; name?: string; reason?: string; platoon?: string }[];
  presentPct: number;
}

export async function getAttendanceSummary(
  ctx: AgentContext,
  opts: { phrase?: string; traineeChest?: string } = {},
): Promise<AttendanceSummary> {
  const trainees = await fetchScoped('trainees', ctx);
  const resolved = opts.phrase ? resolveDatePhrase(opts.phrase) : null;

  // absentRecords carry history; trainees.attn carries today's marker
  let absents: any[] = [];
  try {
    absents = await fetchScoped('absentRecords', ctx);
    if (resolved) {
      absents = absents.filter((a) => dateMatches(resolved, String(a.date ?? a.absentDate ?? '').slice(0, 10)) ||
        (!a.date && !a.absentDate)); // undated = current open absence
    }
  } catch { /* ignore */ }

  const count = { P: 0, A: 0, L: 0, S: 0, other: 0 };
  const absentList: AttendanceSummary['absentList'] = [];

  for (const t of trainees) {
    if (opts.traineeChest && String(t.chestNo) !== String(opts.traineeChest)) continue;
    const code = String(t.attn ?? 'P').toUpperCase();
    if (code === 'P') count.P++;
    else if (code === 'A') { count.A++; absentList.push({ chestNo: t.chestNo, name: t.name, reason: 'Absent', platoon: t.platoon }); }
    else if (code === 'L') { count.L++; absentList.push({ chestNo: t.chestNo, name: t.name, reason: 'Leave', platoon: t.platoon }); }
    else if (code === 'S' || code === 'M' || code === 'H') { count.S++; absentList.push({ chestNo: t.chestNo, name: t.name, reason: code, platoon: t.platoon }); }
    else count.other++;
  }

  // Merge recorded absences not reflected in today's marker
  for (const a of absents) {
    const code = String(a.type ?? 'A').toUpperCase();
    if (!absentList.some((x) => x.chestNo === String(a.chestNo))) {
      absentList.push({ chestNo: String(a.chestNo ?? ''), name: a.traineeName, reason: a.reason ?? code, platoon: a.platoon });
    }
  }

  const total = trainees.length;
  const present = count.P;
  return {
    total,
    present,
    absent: count.A,
    onLeave: count.L,
    sick: count.S,
    other: count.other,
    absentList: absentList.slice(0, 60),
    presentPct: total ? Math.round((present / total) * 100) : 0,
  };
}
