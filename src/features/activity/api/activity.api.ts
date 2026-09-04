// ═══════════════════════════════════════════════════════════════════════
// UNIFIED ACTIVITY FEED — "AAJ KYA HUA"
// ───────────────────────────────────────────────────────────────────────
// Problem: app me TEEN alag audit systems bane hue the, teeno alag
// collection me likhte the aur koi bhi ek jagah sab nahi dikhata tha:
//
//   1. staff_activity_logs  — ustad module (attendance, duty, leave,
//                             subject, test, deputation) — sabse active
//   2. auditLogs            — auditLog.service.ts (Lekha-Jokha screen)
//   3. activity_logs        — audit.service.ts (kabhi call hi nahi hua)
//
// Ye file teeno ko padh kar EK normalised feed banati hai, aur saath me
// operational records (absent, medical, relegation, report, notice, file)
// se bhi events nikaalti hai — taaki "aaj kya hua, kaun kaha gaya, kisne
// kya kiya" ek hi jagah news ki tarah dikhe.
//
// Har event me 4 sawaal ka jawab hota hai:
//   KAB   → `at` (ISO timestamp)
//   KISNE → `actor` (naam + role)
//   KYA   → `title` + `action`
//   KYU   → `reason` (jahan record me wajah likhi ho)
// ═══════════════════════════════════════════════════════════════════════

import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { attnMeta } from '../../shared/availability';

/** Feed ka har card is shape me hota hai. */
export interface ActivityEvent {
  id: string;
  /** Kab hua — ISO string */
  at: string;
  /** Kisne kiya */
  actor: string;
  actorRole: string;
  /** Kya hua — chhota heading */
  title: string;
  /** Detail line */
  detail: string;
  /** Kyu hua — wajah, jahan available ho */
  reason: string;
  /** Kis par hua — trainee/staff ka naam */
  subject: string;
  /** Feed category — filter chips ke liye */
  kind: ActivityKind;
  /** Emoji + rang */
  icon: string;
  color: string;
  /** Kitna important — urgent cheezein upar highlight hoti hain */
  importance: 'normal' | 'high' | 'urgent';
  /** Kis collection se aaya — debugging */
  source: string;
}

export type ActivityKind =
  | 'movement'    // kaun kaha gaya — absent, leave, hospital, deputation
  | 'medical'     // MI room, hospital, rest
  | 'report'      // trainee reports + approvals
  | 'notice'      // notice board
  | 'file'        // files upload
  | 'training'    // attendance, test, class, subject
  | 'staff'       // staff add/update, duty, leave
  | 'relegation'  // relegation / rejoin
  | 'admin';      // baaki sab audit entries

export const ACTIVITY_KINDS: { key: ActivityKind; label: string; icon: string }[] = [
  { key: 'movement',   label: 'Kaun kaha gaya', icon: '🚶' },
  { key: 'medical',    label: 'MI / Hospital',  icon: '🏥' },
  { key: 'report',     label: 'Reports',        icon: '📝' },
  { key: 'notice',     label: 'Notices',        icon: '📢' },
  { key: 'file',       label: 'Files',          icon: '📁' },
  { key: 'training',   label: 'Training',       icon: '🎯' },
  { key: 'staff',      label: 'Staff',          icon: '👮' },
  { key: 'relegation', label: 'Relegation',     icon: '⚠️' },
  { key: 'admin',      label: 'Admin',          icon: '⚙️' },
];

const KIND_COLOR: Record<ActivityKind, string> = {
  movement:   'border-l-amber-500 bg-amber-50',
  medical:    'border-l-orange-500 bg-orange-50',
  report:     'border-l-blue-500 bg-blue-50',
  notice:     'border-l-violet-500 bg-violet-50',
  file:       'border-l-cyan-500 bg-cyan-50',
  training:   'border-l-emerald-500 bg-emerald-50',
  staff:      'border-l-indigo-500 bg-indigo-50',
  relegation: 'border-l-red-500 bg-red-50',
  admin:      'border-l-slate-400 bg-slate-50',
};

/** Firestore timestamp / ISO string / Date — sabko ISO string banao. */
const toISO = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v?.toDate) { try { return v.toDate().toISOString(); } catch { return ''; } }
  if (v instanceof Date) return v.toISOString();
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  return '';
};

const dayOf = (iso: string) => (iso || '').slice(0, 10);

const mk = (e: Partial<ActivityEvent> & { id: string; kind: ActivityKind }): ActivityEvent => ({
  at: '', actor: 'System', actorRole: '', title: '', detail: '', reason: '',
  subject: '', icon: '•', importance: 'normal', source: '',
  color: KIND_COLOR[e.kind],
  ...e,
} as ActivityEvent);

const safeGet = async (fn: () => Promise<any>, label: string) => {
  try { return await fn(); }
  catch (err) { console.warn(`activity: ${label} skipped`, err); return null; }
};

const docsOf = (snap: any): any[] => {
  if (!snap) return [];
  const out: any[] = [];
  snap.forEach((d: any) => out.push({ id: d.id, ...d.data() }));
  return out;
};

/**
 * Ek din (ya date range) ke saare events, sabse naya sabse upar.
 *
 * @param batchId  active batch
 * @param date     YYYY-MM-DD — kis din ka feed chahiye
 */
export const getActivityFeed = async (
  batchId: string,
  date: string,
): Promise<ActivityEvent[]> => {
  const day = date.slice(0, 10);
  const events: ActivityEvent[] = [];

  const [
    staffLogs, auditLogs, legacyLogs,
    absents, medicals, updates, notices, files, relegations,
  ] = await Promise.all([
    safeGet(() => getDocs(query(collection(db, 'staff_activity_logs'), orderBy('timestamp', 'desc'), limit(300))), 'staff_activity_logs'),
    safeGet(() => getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(300))), 'auditLogs'),
    safeGet(() => getDocs(query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(200))), 'activity_logs'),
    safeGet(() => getDocs(query(collection(db, 'absentRecords'), where('batchId', '==', batchId))), 'absentRecords'),
    safeGet(() => getDocs(query(collection(db, 'medicalRecords'), where('batchId', '==', batchId))), 'medicalRecords'),
    safeGet(() => getDocs(query(collection(db, 'traineeUpdates'), where('batchId', '==', batchId))), 'traineeUpdates'),
    safeGet(() => getDocs(query(collection(db, 'traineeNotices'), where('batchId', '==', batchId))), 'traineeNotices'),
    safeGet(() => getDocs(query(collection(db, 'traineeFiles'), where('batchId', '==', batchId))), 'traineeFiles'),
    safeGet(() => getDocs(query(collection(db, 'relegations'), where('fromBatchId', '==', batchId))), 'relegations'),
  ]);

  // ── 1. Ustad module ke logs (sabse active audit source) ──
  for (const l of docsOf(staffLogs)) {
    const at = toISO(l.timestamp);
    if (dayOf(at) !== day) continue;
    const mod = String(l.module || '');
    const kind: ActivityKind =
      /leave|deputation/i.test(mod) ? 'movement'
      : /attendance|subject|test|schedule/i.test(mod) ? 'training'
      : /staff|duty/i.test(mod) ? 'staff' : 'admin';
    const d = l.details || {};
    const bits = Object.entries(d)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined && typeof v !== 'object')
      .slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ');
    events.push(mk({
      id: `sal_${l.id}`, kind, at,
      actor: l.userName || 'Staff', actorRole: l.userRole || '',
      title: l.action || 'Activity',
      detail: bits || mod,
      subject: String(d.staffName || d.traineeName || d.name || ''),
      reason: String(d.reason || d.remarks || ''),
      icon: kind === 'movement' ? '🚶' : kind === 'training' ? '🎯' : kind === 'staff' ? '👮' : '⚙️',
      source: 'staff_activity_logs',
    }));
  }

  // ── 2. auditLogs (Lekha-Jokha) ──
  for (const l of docsOf(auditLogs)) {
    const at = toISO(l.timestamp);
    if (dayOf(at) !== day) continue;
    events.push(mk({
      id: `al_${l.id}`, kind: 'admin', at,
      actor: l.userName || 'User', actorRole: l.userRole || '',
      title: `${l.action || 'Change'} — ${l.collection || ''}`.trim(),
      detail: l.description || '',
      icon: '⚙️', source: 'auditLogs',
    }));
  }

  // ── 3. Purana activity_logs ──
  for (const l of docsOf(legacyLogs)) {
    const at = toISO(l.timestamp) || toISO(l.createdAt);
    if (dayOf(at) !== day) continue;
    events.push(mk({
      id: `ll_${l.id}`, kind: 'admin', at,
      actor: l.userName || 'User', actorRole: l.userRole || '',
      title: `${l.action || 'Change'} — ${l.module || ''}`.trim(),
      detail: l.description || '',
      icon: '⚙️', source: 'activity_logs',
    }));
  }

  // ── 4. KAUN KAHA GAYA — absent / leave / hospital ──
  for (const r of docsOf(absents)) {
    const created = toISO(r.createdAt) || toISO(r.approvedAt);
    const startsToday = (r.fromDate || '').slice(0, 10) === day;
    const loggedToday = dayOf(created) === day;
    if (!startsToday && !loggedToday) continue;
    const m = attnMeta(r.type);
    events.push(mk({
      id: `abs_${r.id}`, kind: 'movement',
      at: created || `${day}T00:00:00.000Z`,
      actor: r.approvedBy || r.createdBy || 'Clerk', actorRole: 'Clerk',
      title: `${m.shortLabel} — ${r.traineeName || 'Trainee'}`,
      detail: `Chest ${r.chestNo || '—'} · ${r.platoon || '—'} · ${r.fromDate || ''}${r.toDate ? ` se ${r.toDate}` : ''}${r.totalDays ? ` (${r.totalDays} din)` : ''}`,
      reason: r.reason || r.remarks || '',
      subject: r.traineeName || '',
      icon: m.icon,
      importance: r.type === 'A' ? 'urgent' : 'high',
      source: 'absentRecords',
    }));
  }

  // ── 5. MI ROOM / HOSPITAL ──
  for (const r of docsOf(medicals)) {
    const created = toISO(r.createdAt);
    const isToday = (r.date || '').slice(0, 10) === day || dayOf(created) === day;
    if (!isToday) continue;
    const hospital = /hospital/i.test(String(r.category || ''));
    events.push(mk({
      id: `med_${r.id}`, kind: 'medical',
      at: created || `${day}T00:00:00.000Z`,
      actor: r.recordedBy || r.approvedBy || 'MI Room', actorRole: 'Medical',
      title: `${r.category || 'Medical'} — ${r.name || r.traineeName || 'Trainee'}`,
      detail: `Chest ${r.chestNo || '—'} · ${r.platoon || '—'}${r.recommendedDays ? ` · ${r.recommendedDays} din rest` : ''}${r.wardNo ? ` · Ward ${r.wardNo}` : ''}`,
      reason: r.diagnosis || r.remarks || '',
      subject: r.name || r.traineeName || '',
      icon: hospital ? '🏥' : '🤒',
      importance: hospital ? 'urgent' : 'high',
      source: 'medicalRecords',
    }));
  }

  // ── 6. TRAINEE REPORTS — bheji gayi + approve/reject hui ──
  for (const u of docsOf(updates)) {
    const sub = toISO(u.submittedAt) || toISO(u.createdAt);
    const app = toISO(u.approvedAt);
    const who = u.isGeneral ? 'General' : `${u.chestNo || '—'} ${u.traineeName || ''}`.trim();

    if (dayOf(sub) === day) {
      events.push(mk({
        id: `rep_${u.id}`, kind: 'report', at: sub,
        actor: u.submittedBy || 'Trainee', actorRole: u.submittedByRole || 'Trainee',
        title: `Report bheji — ${u.title || u.category || ''}`,
        detail: `${who}${u.staffEntry ? ' · clerk entry' : ''} · status: ${u.status || 'pending'}`,
        reason: u.description || '',
        subject: u.traineeName || '',
        icon: '📝',
        importance: u.priority === 'urgent' ? 'urgent' : u.priority === 'high' ? 'high' : 'normal',
        source: 'traineeUpdates',
      }));
    }
    if (app && dayOf(app) === day && u.status !== 'pending') {
      events.push(mk({
        id: `rep_ap_${u.id}`, kind: 'report', at: app,
        actor: u.approvedBy || 'Clerk', actorRole: 'Clerk',
        title: `Report ${u.status === 'approved' ? 'approve' : 'reject'} hui — ${u.title || ''}`,
        detail: who,
        reason: u.status === 'rejected' ? (u.rejectionReason || '') : (u.description || ''),
        subject: u.traineeName || '',
        icon: u.status === 'approved' ? '✅' : '❌',
        source: 'traineeUpdates',
      }));
    }
  }

  // ── 7. NOTICES ──
  for (const n of docsOf(notices)) {
    const at = toISO(n.publishedAt) || toISO(n.createdAt);
    if (dayOf(at) !== day) continue;
    events.push(mk({
      id: `ntc_${n.id}`, kind: 'notice', at,
      actor: n.publishedBy || 'Clerk', actorRole: 'Clerk',
      title: `Notice — ${n.title || ''}`,
      detail: `${n.category || ''} · ${n.targetPlatoon === 'all' || !n.targetPlatoon ? 'Sabke liye' : n.targetPlatoon}`,
      reason: n.content || '',
      icon: '📢',
      importance: n.priority === 'urgent' ? 'urgent' : n.priority === 'important' ? 'high' : 'normal',
      source: 'traineeNotices',
    }));
  }

  // ── 8. FILES ──
  for (const f of docsOf(files)) {
    const at = toISO(f.uploadedAt) || toISO(f.createdAt);
    if (dayOf(at) !== day) continue;
    events.push(mk({
      id: `file_${f.id}`, kind: 'file', at,
      actor: f.uploadedBy || 'Clerk', actorRole: 'Clerk',
      title: `File aayi — ${f.title || f.fileName || ''}`,
      detail: `${f.category || ''} · ${f.targetTraineeLabel || (f.targetPlatoon && f.targetPlatoon !== 'all' ? f.targetPlatoon : 'Sabke liye')}`,
      reason: f.description || '',
      icon: '📁', source: 'traineeFiles',
    }));
  }

  // ── 9. RELEGATION ──
  for (const r of docsOf(relegations)) {
    const at = toISO(r.createdAt) || toISO(r.relegatedAt);
    if (dayOf(at) !== day) continue;
    events.push(mk({
      id: `rel_${r.id}`, kind: 'relegation', at,
      actor: [r.authorityRank, r.authorityName].filter(Boolean).join(' ') || 'Authority',
      actorRole: 'Authority',
      title: `Relegation — ${r.traineeName || ''}`,
      detail: `${r.chestNo || '—'} · ${r.fromBatchName || ''} → ${r.toBatchName || 'TBD'} · ${r.status || ''}`,
      reason: [r.reason, r.reasonDetail].filter(Boolean).join(' — '),
      subject: r.traineeName || '',
      icon: '⚠️', importance: 'high', source: 'relegations',
    }));
  }

  // Sabse naya sabse upar
  events.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return events;
};

export interface ActivityDigest {
  total: number;
  urgent: number;
  byKind: Record<string, number>;
  /** Headline lines — "3 trainee MI room gaye", "2 chutti par" */
  headlines: string[];
}

export const summarizeActivity = (events: ActivityEvent[]): ActivityDigest => {
  const byKind: Record<string, number> = {};
  for (const e of events) byKind[e.kind] = (byKind[e.kind] || 0) + 1;

  const headlines: string[] = [];
  const movement = events.filter(e => e.kind === 'movement');
  const medical = events.filter(e => e.kind === 'medical');
  const reports = events.filter(e => e.kind === 'report' && e.icon === '📝');
  const notices = events.filter(e => e.kind === 'notice');
  const files = events.filter(e => e.kind === 'file');
  const training = events.filter(e => e.kind === 'training');

  if (medical.length)  headlines.push(`🏥 ${medical.length} medical entry (MI room / hospital)`);
  if (movement.length) headlines.push(`🚶 ${movement.length} trainee away hue (chutti / absent)`);
  if (reports.length)  headlines.push(`📝 ${reports.length} nayi report aayi`);
  if (notices.length)  headlines.push(`📢 ${notices.length} notice publish hua`);
  if (files.length)    headlines.push(`📁 ${files.length} nayi file aayi`);
  if (training.length) headlines.push(`🎯 ${training.length} training activity`);
  if (!headlines.length) headlines.push('😴 Aaj koi badi activity record nahi hui');

  return {
    total: events.length,
    urgent: events.filter(e => e.importance === 'urgent').length,
    byKind, headlines,
  };
};
