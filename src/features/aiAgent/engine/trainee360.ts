// ═══════════════════════════════════════════════════════════════════════
// TRAINEE 360° — one structured profile from authorized collections
// ───────────────────────────────────────────────────────────────────────
// Aggregates the data the ERP already holds for a trainee into a compact,
// useful summary (profile / attendance / training / leave / performance /
// kit). Read-only; every read goes through the same scope rules.
// ═══════════════════════════════════════════════════════════════════════

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import type { ResolvedTrainee } from './entityResolve';

const norm = (v: any) => String(v ?? '').trim().toLowerCase();
const num = (v: any) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

async function fetchAll(collectionName: string): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => showDoc(r as Record<string, unknown>));
  } catch { return []; }
}

export interface Trainee360 {
  profile: Record<string, any>;
  attendance: { todayCode: string; absentRecords: number; leaveRecords: number };
  performance: { fptStatus?: string; weeklyTests: number; weeklyPass: number; latestMarks?: string };
  medical: any[];
  kit: { issued: boolean; items: { item: string; size?: string; qty: number; date?: string }[] };
  documentsComplete?: boolean;
}

export async function getTrainee360(t: ResolvedTrainee): Promise<Trainee360> {
  const chest = String(t.chestNo);
  const name = norm(t.name);
  const matchPerson = (r: any) =>
    norm(r.chestNo) === norm(chest) ||
    (name && norm(r.traineeName) === name);

  const [absent, medical, fpt, weekly, issues, trainees] = await Promise.all([
    fetchAll('absentRecords'),
    fetchAll('medicalRecords'),
    fetchAll('fptRecords'),
    fetchAll('weeklyTestRecords'),
    fetchAll('issue_records'),
    fetchAll('trainees'),
  ]);

  const traineeRow = trainees.find((r) => r.id === t.id) ?? {};

  const abs = absent.filter(matchPerson);
  const med = medical.filter(matchPerson).slice(0, 5).map((r) => ({
    complaint: r.complaint, diagnosis: r.diagnosis, status: r.status, date: r.date,
  }));

  const fptRows = fpt.filter(matchPerson);
  const fptStatus = fptRows[0]?.overallStatus ?? fptRows[0]?.fptResult ?? traineeRow.fptResult;

  const weeklyRows = weekly.filter(matchPerson);
  const weeklyPass = weeklyRows.filter((r) =>
    /pass/i.test(String(r.overallStatus ?? r.weeklyExamResult ?? ''))).length;
  const latestMarks = weeklyRows[0]?.totalMarks ?? weeklyRows[0]?.weeklyExamMarks;

  // Kit issues for this trainee
  const kitItems: Trainee360['kit']['items'] = [];
  for (const iss of issues) {
    const isThis = norm(iss.chestNo) === norm(chest) ||
      (iss.traineeName && norm(iss.traineeName) === name) ||
      (iss.traineeId && iss.traineeId === t.id);
    if (!isThis) continue;
    const items = Array.isArray(iss.issuedItems) ? iss.issuedItems : [];
    for (const it of items) {
      kitItems.push({
        item: it.itemName ?? it.item ?? 'item',
        size: it.assignedSize ?? it.size,
        qty: num(it.quantity ?? 1) || 1,
        date: String(iss.issueDate ?? iss.date ?? '').slice(0, 10),
      });
    }
  }

  return {
    profile: {
      name: traineeRow.name ?? t.name,
      chestNo: chest,
      rank: traineeRow.rank ?? t.rank,
      platoon: traineeRow.platoon ?? t.platoon,
      section: traineeRow.section,
      state: traineeRow.state,
      district: traineeRow.district,
      fatherName: traineeRow.fatherName,
      mobileNo: traineeRow.mobileNo,
      bloodGroup: traineeRow.bloodGroup,
      batch: traineeRow.batchNumber ?? t.batchNumber ?? t.batchId,
      medStat: traineeRow.medStat,
    },
    attendance: {
      todayCode: traineeRow.attn ?? 'P',
      absentRecords: abs.filter((r) => /A/.test(String(r.type ?? 'A'))).length,
      leaveRecords: abs.filter((r) => /L/.test(String(r.type ?? ''))).length,
    },
    performance: {
      fptStatus,
      weeklyTests: weeklyRows.length,
      weeklyPass,
      latestMarks: latestMarks ? String(latestMarks) : undefined,
    },
    medical: med,
    kit: {
      issued: Boolean(traineeRow.kitIssued) || kitItems.length > 0,
      items: kitItems,
    },
    documentsComplete: traineeRow.docsComplete,
  };
}
