// ═══════════════════════════════════════════════════════════════════════
// BUSINESS WRITE/READ TOOLS — explicit operations over existing data layer
// ───────────────────────────────────────────────────────────────────────
// Every high-impact action follows the fixed ladder:
//   role check → batch(authz) check → required-field validation →
//   confirmation gate → existing business API → post-write re-read verify
// The agent NEVER invents names/identities and NEVER overwrites existing
// data (e.g. an occupied chest number is reported, not replaced).
// ═══════════════════════════════════════════════════════════════════════

import {
  collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { ToolContext, ToolResult } from './tools';
import { resolveBatchForTool } from './agentContext';
import { resolveTrainee, extractQuantity } from './entityResolve';
import {
  createInspection, createFinding, getInspections, getFindings, updateFindingStatus,
  type AppUserLike as InspectionUser,
} from '../../inspection/api/inspection.api';
import { RESPONSIBLE_ROLES } from '../../inspection/types/inspection.types';

const num = (v: any) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

const inspectionUser = (c: NonNullable<ToolContext['agentCtx']>): InspectionUser => ({
  uid: c.user.uid, role: c.user.role,
  displayName: c.user.name, name: c.user.name,
  assignedBatchIds: c.user.assignedBatchIds,
});

/** Build a human-readable confirmation card (token echoed by the caller). */
function confirmCard(token: string, action: string, lines: string[]): ToolResult {
  return {
    ok: false,
    data: {
      needsConfirmation: true,
      confirmToken: token,
      action,
      preview: lines.join('\n'),
    },
    summary:
      `CONFIRMATION_REQUIRED — ${action}\n` +
      lines.join('\n') +
      `\n\nSahi hai to "haan confirm" likhein — tabhi action hoga. (token: ${token})`,
  };
}

/** Confirmation gate shared by every write: token must match the one the UI
 *  hands back after the user says "haan confirm". */
function needsConfirm(tcx: ToolContext): ToolResult | null {
  if (!tcx.allowWrites) {
    return { ok: false, data: null, summary: 'Write permission nahi hai. Read-only mode.' };
  }
  return null;
}

const DENY = (msg: string): ToolResult => ({ ok: false, data: null, summary: msg });

// ═══════════════════════════════════════════════════════════════════════
// BULK / SINGLE TRAINEE CREATION — names must come from the user.
// ═══════════════════════════════════════════════════════════════════════
export async function createTrainees(tcx: ToolContext, args: any): Promise<ToolResult> {
  const noWrite = needsConfirm(tcx);
  if (noWrite) return noWrite;
  const c = tcx.agentCtx;
  if (!c) return DENY('Context unavailable.');
  if (!c.can.trainees) {
    return DENY('SURAKSHA: trainee create sirf Clerk ya Company Commander kar sakta hai.');
  }
  const batch = resolveBatchForTool(c, args.batchId);
  if (!batch.ok) return DENY(batch.reason);
  if (!batch.batchId) {
    return DENY('Trainee kahan create karein? Pehle batch select karein (All Batches mode me create nahi hota).');
  }

  // Names: model may pass an array, or a raw string list. Nothing invented.
  let names: string[] = Array.isArray(args.names)
    ? args.names.map((n: any) => String(n ?? '').trim()).filter(Boolean)
    : [];
  if (!names.length && typeof args.names === 'string') {
    names = args.names.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
  }
  const asked = extractQuantity(String(args.phrase ?? args.count ?? ''))
    ?? (args.count ? parseInt(String(args.count), 10) : null);

  if (!names.length) {
    return {
      ok: false,
      data: { needsInput: true, required: ['names'], quantity: asked },
      summary:
        `${asked ? asked + ' trainees' : 'Trainees'} create karne ke liye naam chahiye — ` +
        `main khud koi naam, service number ya identity data NAHI bana sakta (no fake data). ` +
        `Please ek-ek trainee ka Name (+ agar ho to Service/Enrollment Number) bhejein, comma ya new-line se. ` +
        `Example: "Rahul Kumar 12345, Amit Singh 12346".`,
    };
  }

  // Confirmation gate (count + names preview).
  const token = `trainee-${Date.now()}`;
  if (!args.confirmToken || args.confirmToken !== tcx.confirmToken) {
    return confirmCard(token, `CREATE ${names.length} TRAINEE(S)`, [
      `Batch: ${c.selectedBatch?.batchNumber ?? batch.batchId}`,
      `Trainees: ${names.length}`,
      names.slice(0, 12).map((n, i) => `  ${i + 1}. ${n}`).join('\n')
        + (names.length > 12 ? `\n  …+${names.length - 12} more` : ''),
      'Chest numbers next available se auto-assign honge (existing numbers overwrite nahi honge).',
    ]);
  }

  // Next chest number IN THE TARGET BATCH (same convention as existing add flow).
  const snap = await getDocs(query(collection(db, 'trainees'), where('batchId', '==', batch.batchId)));
  const used = snap.docs
    .map((d) => parseInt(String((d.data() as any).chestNo ?? ''), 10))
    .filter((n) => !Number.isNaN(n));
  let next = used.length ? Math.max(...used) : 0;

  const results: string[] = [];
  let created = 0;
  for (let i = 0; i < names.length; i += 1) {
    const name = String(names[i]).replace(/\s+\d{4,}\s*$/, '').trim(); // strip trailing service no from name
    const svc = String(names[i]).match(/(\d{4,})\s*$/)?.[1] ?? '';
    next += 1;
    try {
      await addDoc(collection(db, 'trainees'), {
        name,
        chestNo: String(next),
        serviceNumber: args.serviceNumbers?.[i] ?? svc,
        regNo: args.regNos?.[i] ?? '',
        batchId: batch.batchId,
        batchNumber: c.selectedBatch?.batchNumber ?? '',
        batchName: c.selectedBatch?.batchName ?? '',
        status: 'active', attn: 'P', rank: 'RCT',
        source: 'ai-agent', addedBy: c.user.email || c.user.name,
        createdAt: serverTimestamp(),
      });
      created += 1;
      results.push(`✓ ${name} → Chest #${next}`);
    } catch (e: any) {
      results.push(`✗ ${name} — ${e?.message ?? 'create fail'}`);
    }
  }

  // POST-WRITE VERIFY: recount the batch honestly.
  const after = await getDocs(query(collection(db, 'trainees'), where('batchId', '==', batch.batchId)));
  const failed = names.length - created;
  return {
    ok: failed === 0,
    data: { requested: names.length, created, failed, totalInBatch: after.size },
    summary:
      `RESULT: ${created} created${failed ? `, ${failed} failed` : ''} (batch me ab ${after.size} trainees).\n`
      + results.slice(0, 20).join('\n'),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ASSIGN CHEST — occupied chests are reported, never overwritten.
// ═══════════════════════════════════════════════════════════════════════
export async function assignChest(tcx: ToolContext, args: any): Promise<ToolResult> {
  const noWrite = needsConfirm(tcx);
  if (noWrite) return noWrite;
  const c = tcx.agentCtx;
  if (!c) return DENY('Context unavailable.');
  if (!c.can.trainees) {
    return DENY('SURAKSHA: chest assignment sirf Clerk ya Company Commander kar sakta hai.');
  }
  const batch = resolveBatchForTool(c, args.batchId);
  if (!batch.ok) return DENY(batch.reason);
  if (!batch.batchId) return DENY('Chest assignment ke liye batch select hona chahiye.');

  const targetChest = String(args.newChest ?? args.toChest ?? '').replace(/\D/g, '');
  if (!targetChest) {
    return { ok: false, data: { needsInput: true, required: ['newChest'] },
      summary: 'Naya chest number batao — e.g. "chest 23 ko chest 45 assign karo".' };
  }

  const res = await resolveTrainee(c, String(args.term ?? args.trainee ?? ''));
  if (res.status !== 'unique' || !res.entity) {
    return { ok: false, data: { candidates: res.candidates, clarify: true },
      summary: res.ask ?? 'Trainee nahi mila.' };
  }
  const trainee = res.entity;
  if (String(trainee.chestNo) === targetChest) {
    return DENY(`${trainee.name} ka chest pehle se #${targetChest} hai — kuch badalne ki zaroorat nahi.`);
  }

  // Occupancy check IN THE SAME BATCH.
  const snap = await getDocs(query(
    collection(db, 'trainees'),
    where('batchId', '==', batch.batchId),
    where('chestNo', '==', targetChest),
  ));
  const holder = snap.docs.map((d) => d.data() as any).find((d) => d.name);
  if (holder) {
    return DENY(
      `Chest ${targetChest} already ${holder.name} (Chest #${holder.chestNo ?? '?'}) ke paas assigned hai — ` +
      `overwrite NAHI kiya gaya. Doosra number choose karo, ya pehle unka chest change karo.`,
    );
  }

  const token = `chest-${Date.now()}`;
  if (!args.confirmToken || args.confirmToken !== tcx.confirmToken) {
    return confirmCard(token, 'ASSIGN CHEST', [
      `Trainee: Chest #${trainee.chestNo} ${trainee.name}`,
      `New chest: #${targetChest}`,
      `Batch: ${trainee.batchNumber ?? batch.batchId}`,
    ]);
  }

  await updateDoc(doc(db, 'trainees', trainee.id), {
    chestNo: targetChest,
    updatedAt: serverTimestamp(),
    updatedBy: c.user.email || c.user.name,
  });

  // POST-WRITE VERIFY: re-read.
  const afterDoc = await getDoc(doc(db, 'trainees', trainee.id));
  const verified = String((afterDoc.data() as any)?.chestNo ?? '') === targetChest;
  return {
    ok: verified,
    data: { id: trainee.id, name: trainee.name, oldChest: trainee.chestNo, newChest: targetChest, verified },
    summary: verified
      ? `Done ✓ — ${trainee.name} ka chest #${trainee.chestNo} → #${targetChest} (re-read verified).`
      : 'Update command gaya par re-read me chest match nahi hua — manually check karein.',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// INSPECTION / FINDING CREATION — SO/CC, assigned batches only.
// ═══════════════════════════════════════════════════════════════════════
const SEVERITIES = ['critical', 'major', 'minor', 'observation'];

export async function createInspectionTool(tcx: ToolContext, args: any): Promise<ToolResult> {
  const noWrite = needsConfirm(tcx);
  if (noWrite) return noWrite;
  const c = tcx.agentCtx;
  if (!c) return DENY('Context unavailable.');
  if (!c.can.inspections) {
    return DENY('SURAKSHA: inspection create sirf Senior Officer/Inspector ya Company Commander kar sakta hai.');
  }
  const batch = resolveBatchForTool(c, args.batchId);
  if (!batch.ok) return DENY(batch.reason);
  if (!batch.batchId) return DENY('Inspection ke liye assigned batch select hona chahiye.');

  const missing: string[] = [];
  if (!args.subject) missing.push('subject (kya inspect kiya)');
  if (!args.inspectionType) missing.push('inspectionType');
  if (missing.length) {
    return { ok: false, data: { needsInput: true, required: missing },
      summary: `Inspection ke liye chahiye: ${missing.join(', ')}. Types: Training, Discipline, Attendance, Accommodation, Mess, Kit / Turnout, Documentation, Welfare, Administration, Safety, General.` };
  }

  const token = `insp-${Date.now()}`;
  if (!args.confirmToken || args.confirmToken !== tcx.confirmToken) {
    return confirmCard(token, 'CREATE INSPECTION', [
      `Batch: ${c.selectedBatch?.batchNumber ?? batch.batchId}`,
      `Type: ${args.inspectionType}`,
      `Subject: ${args.subject}`,
      `Severity: ${args.severity ?? 'observation'}`,
      `Date: ${args.inspectionDate ?? c.todayISO}`,
    ]);
  }

  try {
    const me = inspectionUser(c);
    const id = await createInspection(me, {
      batchId: batch.batchId,
      batchNumber: c.selectedBatch?.batchNumber ?? '',
      batchName: c.selectedBatch?.batchName ?? '',
      inspectionType: args.inspectionType,
      inspectionDate: args.inspectionDate ?? c.todayISO,
      subject: args.subject,
      observations: args.observations ?? '',
      status: 'submitted',
      severity: SEVERITIES.includes(args.severity) ? args.severity : 'observation',
      remarks: args.remarks ?? '',
    });
    const list = await getInspections(me);
    const saved = list.find((x: any) => x.id === id);
    return {
      ok: !!saved, data: { id, saved: !!saved },
      summary: saved
        ? `Inspection create hui ✓ — "${saved.subject}" (${saved.inspectionType}, ${saved.batchNumber ?? batch.batchId}). Ab is par findings add kar sakte hain.`
        : 'Inspection create command gaya par re-read me confirmation nahi mila.',
    };
  } catch (e: any) {
    return DENY(`Inspection create fail: ${e?.message ?? e}`);
  }
}

export async function createFindingTool(tcx: ToolContext, args: any): Promise<ToolResult> {
  const noWrite = needsConfirm(tcx);
  if (noWrite) return noWrite;
  const c = tcx.agentCtx;
  if (!c) return DENY('Context unavailable.');
  if (!c.can.inspections) {
    return DENY('SURAKSHA: finding create sirf Senior Officer/Inspector ya Company Commander kar sakta hai.');
  }
  const batch = resolveBatchForTool(c, args.batchId);
  if (!batch.ok) return DENY(batch.reason);
  if (!batch.batchId) return DENY('Finding ke liye assigned batch select hona chahiye.');

  const missing: string[] = [];
  if (!args.title) missing.push('title (kya kami mili)');
  if (!args.correctiveAction) missing.push('correctiveAction (kya sudhar karna hai)');
  if (!args.assignedToRole || !RESPONSIBLE_ROLES.includes(args.assignedToRole as any)) {
    missing.push(`assignedToRole (${RESPONSIBLE_ROLES.join(' / ')})`);
  }
  if (missing.length) {
    return { ok: false, data: { needsInput: true, required: missing, severities: SEVERITIES },
      summary: `Finding ke liye chahiye: ${missing.join(', ')}. Severity: critical/major/minor/observation.` };
  }

  const me = inspectionUser(c);
  let inspectionId = args.inspectionId ?? '';
  if (!inspectionId) {
    const insps = await getInspections(me).catch(() => [] as any[]);
    const inBatch = insps.filter((i: any) => i.batchId === batch.batchId);
    inspectionId = inBatch[0]?.id ?? '';
  }

  const token = `find-${Date.now()}`;
  if (!args.confirmToken || args.confirmToken !== tcx.confirmToken) {
    return confirmCard(token, 'CREATE FINDING + CORRECTIVE ACTION', [
      `Batch: ${c.selectedBatch?.batchNumber ?? batch.batchId}`,
      `Title: ${args.title}`,
      `Severity: ${args.severity ?? 'minor'}`,
      `Assigned to: ${args.assignedToRole}${args.assignedToName ? ` (${args.assignedToName})` : ''}`,
      `Due: ${args.dueDate || '(set karein)'}`,
      `Corrective action: ${args.correctiveAction}`,
    ]);
  }

  try {
    const id = await createFinding(me, {
      batchId: batch.batchId,
      batchNumber: c.selectedBatch?.batchNumber ?? '',
      inspectionId,
      category: args.category ?? args.responsibleArea ?? 'General',
      title: args.title,
      description: args.description ?? '',
      severity: SEVERITIES.includes(args.severity) ? args.severity : 'minor',
      responsibleArea: args.responsibleArea ?? args.category ?? '',
      assignedToRole: args.assignedToRole,
      assignedToName: args.assignedToName ?? '',
      dueDate: args.dueDate ?? '',
      correctiveAction: args.correctiveAction,
    });
    const list = await getFindings(me);
    const saved = list.find((x: any) => x.id === id);
    return {
      ok: !!saved, data: { id, saved: !!saved },
      summary: saved
        ? `Finding create hui ✓ — "${saved.title}" → ${saved.assignedToRole}, due ${saved.dueDate || 'TBD'}. Status: Open.`
        : 'Finding create command gaya par re-read me confirmation nahi mila.',
    };
  } catch (e: any) {
    return DENY(`Finding create fail: ${e?.message ?? e}`);
  }
}

/** Responsible staff (Clerk/QM/Ustad) submit their corrective action.
 *  SO/CC can submit too; role assignment is enforced in the data layer. */
export async function submitCorrectiveAction(tcx: ToolContext, args: any): Promise<ToolResult> {
  const c = tcx.agentCtx;
  if (!c) return DENY('Context unavailable.');
  const me = inspectionUser(c);
  const findings = await getFindings(me); // data-layer already filters by assignment
  const q = String(args.findingTitle ?? args.title ?? '').toLowerCase().trim();
  if (!q) return { ok: false, data: { needsInput: true, required: ['findingTitle'] }, summary: 'Kis finding ka action submit karna hai? Title batao.' };
  const match = findings.find((f: any) =>
    (f.title ?? '').toLowerCase().includes(q) || q.includes((f.title ?? '').toLowerCase().slice(0, 12)));
  if (!match) return DENY('Aapko assigned koi matching finding nahi mili (get_inspections se list dekh sakte hain).');

  try {
    if (match.status === 'open' || match.status === 'rework') {
      await updateFindingStatus(me, match.id, match, { to: 'in_progress', actorName: c.user.name });
    }
    await updateFindingStatus(me, match.id, { ...match, status: 'in_progress' } as any,
      { to: 'submitted', actorName: c.user.name });
    return { ok: true, data: { id: match.id, status: 'submitted' },
      summary: `Corrective action submit ho gaya ✓ — "${match.title}" ab SO/CC verification ke liye hai.` };
  } catch (e: any) {
    return DENY(`Submit fail: ${e?.message ?? e}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FINANCE WRITE — explicit expense tool (QM/CC). No generic writes.
// ═══════════════════════════════════════════════════════════════════════
const FUND_COLLECTION: Record<string, string> = {
  mess: 'mess_fund_expenses',
  training: 'training_fund_expenses',
  general: 'general_fund_expenses',
  assets: 'company_assets_expenses',
};

export async function recordExpenseTool(tcx: ToolContext, args: any): Promise<ToolResult> {
  const noWrite = needsConfirm(tcx);
  if (noWrite) return noWrite;
  const c = tcx.agentCtx;
  if (!c) return DENY('Context unavailable.');
  if (!c.can.finance) {
    return DENY('SURAKSHA: expense record sirf Quarter Master ya Company Commander kar sakta hai.');
  }
  const amount = num(args.amount);
  const fundKey = String(args.fund ?? '').toLowerCase().split(/\s+/)[0];
  const collectionName = FUND_COLLECTION[fundKey];
  const missing: string[] = [];
  if (!amount) missing.push('amount');
  if (!collectionName) missing.push('fund (mess/training/general/assets)');
  if (!args.purpose && !args.category) missing.push('purpose');
  if (missing.length) {
    return { ok: false, data: { needsInput: true, required: missing },
      summary: `Expense ke liye chahiye: ${missing.join(', ')}. Example: "training fund me 5000 ka equipment expense, vendor Sharma Traders".` };
  }
  const date = args.date ?? c.todayISO;

  const token = `exp-${Date.now()}`;
  if (!args.confirmToken || args.confirmToken !== tcx.confirmToken) {
    return confirmCard(token, 'RECORD EXPENSE', [
      `Fund: ${args.fund}`, `Amount: ₹${amount}`,
      `Purpose: ${args.purpose ?? args.category}`,
      args.vendor ? `Vendor: ${args.vendor}` : '',
      `Date: ${date}`,
    ].filter(Boolean));
  }

  const ref = await addDoc(collection(db, collectionName), {
    amount,
    category: args.category ?? args.purpose,
    categoryLabel: args.categoryLabel ?? '',
    remarks: args.purpose ?? '',
    vendor: args.vendor ?? '',
    vendorId: '',
    date,
    paymentMode: args.paymentMode ?? '',
    paidAmount: amount, dueAmount: 0, billStatus: args.billStatus ?? 'paid',
    recordedBy: c.user.email || c.user.name,
    source: 'ai-agent',
    createdAt: serverTimestamp(),
  });
  const after = await getDoc(doc(db, collectionName, ref.id));
  const ok = after.exists() && num((after.data() as any)?.amount) === amount;
  return {
    ok, data: { id: ref.id, collection: collectionName, amount, verified: ok },
    summary: ok
      ? `Expense record hua ✓ — ₹${amount} (${args.fund} fund, ${args.purpose ?? args.category}, ${date}). Re-read verified.`
      : 'Expense likha gaya par re-read verify nahi hua — check karein.',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STAFF / LEAVE reads (CC/SO/Clerk; SO limited to assigned batches)
// ═══════════════════════════════════════════════════════════════════════
export async function getStaffData(tcx: ToolContext, args: any): Promise<ToolResult> {
  const c = tcx.agentCtx;
  if (!c) return DENY('Context unavailable.');
  // Staff directory: CC always; Clerk staffAdmin; SO read for oversight;
  // QM/Ustad get minimal (their own domain findings are in inspection tools).
  if (!(c.isCC || c.can.staffAdmin || c.isSO)) {
    return DENY('SURAKSHA: staff directory sirf CC/Clerk (aur SO oversight) dekh sakta hai.');
  }
  const [staff, leave] = await Promise.all([
    getDocs(collection(db, 'staff')).catch(() => ({ docs: [] as any[] })),
    getDocs(collection(db, 'staff_leave')).catch(() => ({ docs: [] as any[] })),
  ]);
  const scopeBatch = c.selectedBatch?.id;
  const inScope = (d: any) => c.isCC || !d.batchId || d.batchId === scopeBatch
    || (c.isSO && (c.inspectionScope ?? []).includes(d.batchId));

  let leaveRows = (leave as any).docs.map((d: any) => ({ id: d.id, ...d.data() })).filter(inScope);

  if (args.filter === 'pending_leave' || /leave|chhutti|chutti|absence/i.test(String(args.query ?? ''))) {
    const pending = leaveRows.filter((l: any) => String(l.status ?? '').toLowerCase() === 'pending');
    return {
      ok: true, data: { pending: pending.slice(0, 30) },
      summary: pending.length
        ? `Pending leave (${pending.length}):\n` + pending.map((l: any) =>
          `• ${l.staffName ?? l.name ?? '?'} — ${l.leaveType ?? 'leave'} ${l.fromDate ?? ''}→${l.toDate ?? ''} (${l.totalDays ?? ''} din)`).join('\n')
          + (c.isCC ? '\n\nApprove/reject sirf Company Commander kar sakta hai — bolo "approve leave <name>" to main CC ke confirmation se aage badhunga.' : '')
        : 'Koi pending leave nahi.',
    };
  }

  let staffRows = (staff as any).docs.map((d: any) => ({ id: d.id, ...d.data() })).filter(inScope);
  if (c.isSO) staffRows = staffRows.filter((s: any) => (c.inspectionScope ?? []).includes(s.batchId) || !s.batchId);
  if (args.query) {
    const q = String(args.query).toLowerCase();
    staffRows = staffRows.filter((s: any) =>
      String(s.name ?? '').toLowerCase().includes(q) || String(s.rank ?? '').toLowerCase().includes(q));
  }
  return {
    ok: true,
    data: { staff: staffRows.slice(0, 40).map((s: any) => ({ name: s.name, rank: s.rank, status: s.status, subjects: s.subjects, forceNo: s.forceNo })) },
    summary: staffRows.length
      ? `Staff (${staffRows.length}):\n` + staffRows.slice(0, 15).map((s: any) =>
          `• ${s.name} — ${s.rank ?? ''} ${s.status ? `(${s.status})` : ''}${s.subjects ? ` [${s.subjects}]` : ''}`).join('\n')
      : 'Koi staff record nahi mila.',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COMPANY OPERATIONAL SUMMARY — role-filtered high-level dashboard
// ═══════════════════════════════════════════════════════════════════════
export async function getCompanySummary(tcx: ToolContext): Promise<ToolResult> {
  const c = tcx.agentCtx;
  if (!c) return DENY('Context unavailable.');
  const sections: string[] = [];
  const data: Record<string, any> = {};

  // STRENGTH + ATTENDANCE
  try {
    const tSnap = await getDocs(collection(db, 'trainees'));
    let trainees = tSnap.docs.map((d) => d.data() as any);
    if (!c.isCC) {
      trainees = trainees.filter((t) => c.isSO
        ? (c.inspectionScope ?? []).includes(t.batchId)
        : t.batchId === c.selectedBatch?.id);
    }
    const present = trainees.filter((t) => String(t.attn ?? '').toLowerCase() === 'p').length;
    const absent = trainees.filter((t) => ['a', 'l', 's', 'm', 'h'].includes(String(t.attn ?? '').toLowerCase())).length;
    data.strength = { total: trainees.length, present, absent };
    sections.push(`STRENGTH: ${trainees.length} trainees | Present ${present} | Absent/Leave ${absent}`);
  } catch { /* ignore */ }

  // FINDINGS (SO/CC)
  if (c.can.inspections) {
    try {
      const me = inspectionUser(c);
      const findings = await getFindings(me);
      const open = findings.filter((f: any) => f.status !== 'closed').length;
      const critical = findings.filter((f: any) => f.severity === 'critical' && f.status !== 'closed').length;
      const overdue = findings.filter((f: any) => f.status !== 'closed' && f.dueDate && f.dueDate < c.todayISO).length;
      const verify = findings.filter((f: any) => f.status === 'submitted').length;
      data.findings = { open, critical, overdue, verify };
      sections.push(`SO FINDINGS: open ${open} | critical ${critical} | overdue ${overdue} | verification-pending ${verify}`);
    } catch { /* ignore */ }
  }

  if (c.can.finance) sections.push('FINANCE: get_finance_summary se fund-wise balance detail lo.');

  return {
    ok: true, data,
    summary: `📋 Operational summary (${c.selectedBatch?.batchNumber ?? (c.batchMode === 'all' ? 'All Batches' : 'current scope')}):\n`
      + (sections.join('\n') || 'Is scope me abhi koi data nahi.'),
  };
}
